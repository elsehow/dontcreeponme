// Libraries

var express = require('express');
var app = express();

var http = require('http');
var httpServer = http.createServer(app);
var io = require('socket.io').listen(httpServer);
var sanitizeHtml = require('sanitize-html');

var jade = require('jade');
var _ = require('underscore');

// My stuff
var appPort = 18696; //29420;
var regex =  /[^A-Za-z0-9\(\)]/; // regular expression for validating usernames

// Views Options

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', { layout: false });
app.use(express.static(__dirname + '/public'));
//io.set('log level', 0);  // shouldnt be necessary given that logging is set to false in io's require statement, but just for kicks...

// Render and send the main page
app.get('/', function(req, res){
  res.render('home.jade');
});

// lazy handling for chatroom IDs.
app.get('/:id', function(req, res) {
	var id = req.params.id;
	res.render('chat.jade');
});

httpServer.listen(appPort);
console.log('Server listening on port ' + appPort);

// Handle the socket.io connections

var global_users = 0; //count the global_users

io.sockets.on('connection', function(socket) { // First connection
	
	global_users += 1; // Add 1 to the count
	
	socket.on('joinattempt', function(roomName, pseudo, color) {

		// verify that they entered something
		if (!pseudo || pseudo.length==0) {
			socket.emit('authresponse', 
				{'status':'Enter a pseudonym.'});
		}

		// verify that the username is 3-140 char
		else if (pseudo.length>140) {
			socket.emit('authresponse', 
				{'status':"Pseudonyms have to be 1-140 characters. Sorry."});
		}

		// verify that username doesn't contain any bad chars
		else if (regex.test(pseudo)) {
			socket.emit('authresponse', 
				{'status':"For now no spaces, letters a-z and numbers only. This will be more permissive soon."});
		}

		// check that username is unique in this room
		else if(!isUsernameUnique(pseudo,roomName)) {
			socket.emit('authresponse', 
				{'status':"That pseudonym's already taken in this room."});
		}

		// if all's well, allow joining:
		else {
			//store color in the session for this client
			socket.color = color;
			//store username in the session for this client
			socket.username = pseudo;
			//store chatroom in the session for this client
			socket.room = roomName;
			// only at this point does the socket officially join the room.
			socket.join(roomName);
			// tell user that they've been accepted
			socket.emit('authresponse', {'status':'ok'});
			//tell room to reload users now that a new person's joined 
			// room, username, is_join event
			announceNewUser(socket.room, socket.username, true);
		}
	});

	socket.on('message', function (data) { // Broadcast the message to all

		//parse the message
		var transmit = {pseudo : socket.username, message : sanitizeHtml(data, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'style' ])
})}; 
		io.sockets.in(socket.room).emit('message', transmit);
	});

	socket.on('leaveroom', function () { // Disconnection of the client
		leaveRoom(socket);
	});

	socket.on('disconnect', function () { // Disconnection of the client
		leaveRoom(socket);
	});
});


function leaveRoom(socket) {
	global_users -= 1;
        if (socket.room) {
                  socket.leave(socket.room);
                  announceNewUser(socket.room, socket.username, false);
       }
}

// Send the list of users to everyone in the room
// announce new user's name over chat too
function announceNewUser(room) { 

	var userlist = _.object(_.map(io.sockets.clients(room), function(o,v) {
		try {
			if (o.username) {	
				return[o.username,o.color];
			}
		} catch(e) {}
	}));

	//send this list to the clients in the room	
	io.sockets.in(room).emit('newuserlist',userlist);

	//send a message to all users announcing the join
	if (arguments[1]) {

		var username = arguments[1];
		var isConnectEvent = arguments[2];

		var msg = username;

		if (isConnectEvent) {
			msg += " enters the room.";
		} else {
			msg += " leaves the room.";
		}
		io.sockets.in(room).emit('announcement', msg);
	}

}



function isUsernameUnique(username, roomName) {
	//verify that username is unique
	var roomClients = io.sockets.clients(roomName);
	// search for the username
	var filter = roomClients.filter(function(v){ return v["username"] == username; });
	// if we return results, username is not unique
	if (filter.length>0) {
		return false;
	} // otherwise it's unique
	return true;
}

// Libraries

var express = require('express');
var app = express();

var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var jade = require('jade');
var underscore = require('underscore');

// My stuff


var appPort = 29420;

// Views Options

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', { layout: false });

app.configure(function() {
	app.use(express.static(__dirname + '/public'));
});

// Render and send the main page
app.get('/', function(req, res){
  res.render('home.jade');
});

// lazy handling for chatroom IDs.
app.get('/:id', function(req, res) {
	var id = req.params.id;
	console.log('requesting ' + id);
	res.render('chat.jade');
});

server.listen(appPort);
console.log('Server listening on port ' + appPort);

// Handle the socket.io connections

var global_users = 0; //count the global_users
var regex =  /[^A-Za-z0-9 ]/; // regular expression for validating usernames

io.sockets.on('connection', function(socket) { // First connection
	global_users += 1; // Add 1 to the count
	
	socket.on('joinattempt', function(roomName, pseudo) {

		// verify that they entered something
		if (!pseudo || pseudo.length==0) {
			socket.emit('authresponse', {'status':'Enter a username.'});
		}

		// verify that the username is 3-140 char
		else if (pseudo.length>140) {
			socket.emit('authresponse', {'status':"Usernames have to be 1-140 characters. Sorry."});
		}

		// verify that username doesn't contain any bad chars
		else if (regex.test(pseudo)) {
			socket.emit('authresponse', {'status':"For now usernames can only contain letters a-z and numbers. Sorry."});
		}

		// check that username is unique in this room
		else if(!isUsernameUnique(pseudo,roomName)) {
			socket.emit('authresponse', {'status':"That username's already taken in this room."});
		}

		// if all's well, allow joining:
		else {
			console.log(roomName + ":" + pseudo);
			//store username in the session for this client
			socket.username = pseudo;
			//store chatroom in the session for this client
			socket.room = roomName;
			// only at this point does the socket officially join the room.
			socket.join(roomName);
			// tell user that they've been accepted
			socket.emit('authresponse', {'status':'ok'});
			//tell room to reload users now that a new person's joined 
			refreshUserlist(socket.room);
		}
	});

	socket.on('message', function (data) { // Broadcast the message to all
		var transmit = {date : new Date().toISOString(), pseudo : socket.username, message : data};
		io.sockets.in(socket.room).emit('message', transmit);
		console.log("user "+ transmit['pseudo'] +" said \""+data+"\" to " + socket.room);
	});

	socket.on('disconnect', function () { // Disconnection of the client
		global_users -= 1;
		socket.leave(socket.room);
		refreshUserlist(socket.room);
	});
});

// Send the list of users to everyone in the room
function refreshUserlist(room) { 

	//compile a list of all usernames in the room
	var room_usernames = underscore.pluck( io.sockets.clients(room), 'username');

	//send this list to the clients in the room	
	io.sockets.in(room).emit('newuserlist', {"userlist":room_usernames});

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

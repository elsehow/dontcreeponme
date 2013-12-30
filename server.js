// Libraries

var express = require('express');
var app = express();

var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var jade = require('jade');

// My stuff


var appPort = 16560;

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
		if (!pseudo) {
			socket.emit('error', {'reason':'Enter a username.'});
		}

		// verify that the username is 3-12 char
		else if (pseudo.length<3 || pseudo.length>12) {
			socket.emit('error', {'reason':"Usernames have to be 3-12 characters. Sorry."});
		}

		// verify that username doesn't contain any bad chars
		else if (regex.test(pseudo)) {
			socket.emit('error', {'reason':"For now usernames can only contain letters a-z and numbers. Sorry."});
		}

		// check that username is unique in this room
		else if(!isUsernameUnique(pseudo,roomName)) {
			socket.emit('error', {'reason':"That username's already taken in this room."});
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
			// echo to room 1 that a person has connected to their room
			socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username + ' has connected to this room');
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
	var roomClients = io.sockets.clients(room);
	var room_usernames = [];
	for (var i=0;i<roomClients.length;i++) {
		room_usernames.push(roomClients[i]['username']);

	}

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

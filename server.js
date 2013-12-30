// Libraries

var express = require('express');
var app = express();

var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var jade = require('jade');

// My stuff


var appPort = 16560;

var usernames = {};

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
app.get('/chat/:id', function(req, res) {
	var id = req.params.id;
	console.log('requesting ' + id);

	res.render('chat.jade');
});

server.listen(appPort);
console.log('Server listening on port ' + appPort);

// Handle the socket.io connections

var users = 0; //count the users


io.sockets.on('connection', function(socket) { // First connection
	users += 1; // Add 1 to the count
	reloadUsers(); // Send the count to all the users
	
	socket.on('join', function(chatroomid, psuedo) {
		console.log(chatroomid + ":" + psuedo);
		//store username in the session for this client
		socket.username = psuedo;
		//store chatroom in the session for this client
		socket.room = chatroomid;
		// add the client's username to the global list
		usernames[socket.username] = socket.username;
		// chatroomid is the room name
		socket.join(chatroomid);
		// echo to room 1 that a person has connected to their room
		socket.broadcast.to(socket.room).emit('updatechat', 'SERVER', socket.username + ' has connected to this room');
	});

	socket.on('message', function (data) { // Broadcast the message to all
		// if(pseudoSet(socket))
		// {
			var transmit = {date : new Date().toISOString(), pseudo : socket.username, message : data};
			io.sockets.in(socket.room).emit('message', transmit);
			//socket.broadcast.emit('message', transmit);
			console.log("user "+ transmit['pseudo'] +" said \""+data+"\" to " + socket.room);
		//}
	});

	// socket.on('setPseudo', function (data) { // Assign a name to the user
	// 	if (pseudoArray.indexOf(data) == -1) // Test if the name is already taken
	// 	{
	// 		socket.set('pseudo', data, function(){
	// 			pseudoArray.push(data);
	// 			socket.emit('pseudoStatus', 'ok');
	// 			console.log("user " + data + " connected");
	// 		});
	// 	}
	// 	else
	// 	{
	// 		socket.emit('pseudoStatus', 'error') // Send the error
	// 	}
	// });
	socket.on('disconnect', function () { // Disconnection of the client
		users -= 1;
		reloadUsers();
		if (pseudoSet(socket))
		{
			var pseudo;
			socket.get('pseudo', function(err, name) {
				pseudo = name;
			});
			var index = pseudoArray.indexOf(pseudo);
			pseudo.slice(index - 1, 1);
		}
	});
});

function reloadUsers() { // Send the count of the users to all
	io.sockets.emit('nbUsers', {"nb": users});
}

function pseudoSet(socket) { // Test if the user has a name
	var test;
	socket.get('pseudo', function(err, name) {
		if (name == null ) test = false;
		else test = true;
	});
	return test;
}

function returnPseudo(socket) { // Return the name of the user
	var pseudo;
	socket.get('pseudo', function(err, name) {
		if (name == null ) pseudo = false;
		else pseudo = name;
	});
	return pseudo;
}

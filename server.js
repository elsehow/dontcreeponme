// Libraries

var express = require('express')
var app = express()

var http = require('http')
var server = http.Server(app)
var io = require('socket.io')(server)
var sanitizeHtml = require('sanitize-html')

var jade = require('jade')
var _ = require('lodash')

// My stuff
var appPort = 18696 //29420
var regex =  /[^a-zA-Z1-9]+/ // regular expression for validating usernames

// Views Options

app.set('views', __dirname + '/views')
app.set('view engine', 'jade')
app.set('view options', { layout: false })
app.use(express.static(__dirname + '/public'))
// io.set('log level', 0)

server.listen(appPort)
console.log('Server listening on port ' + appPort)

// Express handlers

// Render and send the main page
app.get('/', function(req, res){
  res.render('home.jade')
})

// lazy handling for chatroom IDs.
app.get('/:id', function(req, res) {
  res.render('chat.jade', 
    {roomName: req.params.id}
  )
})

var roomToUsernames = {}

// socket.io handlers

// First connection
io.sockets.on('connection', function(socket) {
  
  socket.on('joinattempt', function(roomName, pseudo, color) {
    
    // if all's well, allow joining:
    if (isUsernameValid(socket, pseudo,roomName)) {
      // store color in the session for this client
      socket.color = color
      // store username in the session for this client
      socket.username = pseudo
      // tell user that they've been accepted
      socket.emit('authresponse', {'status':'ok'})
      // tell room to reload users now that a new person's joined 
      // room, username, is_join event
      joinRoom(socket, roomName)
    }
  })

  // Broadcast the message to all
  socket.on('message', function(data) {
    io.sockets.in(socket.roomName).emit(
      'message', 
      getMessagePayload(socket.username, data)
    )
  })

  // Disconnecton of the client
  socket.on('leaveroom', function() {
    leaveRoom(socket)
  })

  // Disconnection of the client
  socket.on('disconnect', function() {
    leaveRoom(socket)
  })
})


function joinRoom(socket, roomName) {
  // store chatroom in the session for this client
  socket.roomName = roomName

  // only at this point does the socket officially join the room.
  socket.join(socket.roomName)
  if (!(socket.roomName in roomToUsernames)) {
    roomToUsernames[socket.roomName] = {}
  }
  roomToUsernames[socket.roomName][socket.username] = socket.color 
  updateUserList(socket)

  io.sockets.in(socket.roomName).emit(
    'announcement', 
    socket.username + ' joins the room.'
  )
}


function leaveRoom(socket) {
  if (socket.roomName) {
    socket.leave(socket.roomName)

    io.sockets.in(socket.roomName).emit(
      'announcement', 
      socket.username + ' leaves the room.'
    )

    delete roomToUsernames[socket.roomName][socket.username]
    if (roomToUsernames[socket.roomName].size == 0) {
      delete roomToUsernames[socket.roomName]
    }
    updateUserList(socket)

    socket.roomName = null
  }
}

// Send the list of users to everyone in the room
function updateUserList(socket) {
  io.sockets.in(socket.roomName).emit(
    'newuserlist', 
    roomToUsernames[socket.roomName]
  )
}


function getMessagePayload(pseudo, message) {
  return {
    pseudo: pseudo,
    message: sanitizeHtml(
      message,
      {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['marquee', 'blink'])
      }
    )
  }
}

function isUsernameValid(socket, pseudo, roomName) {

  // verify that they entered something
    if (!pseudo || pseudo.length==0) {
      socket.emit('authresponse', 
        {'status':'Enter a pseudonym.'})
      return false
    }

    // verify that the username is 3-140 char
    else if (pseudo.length>140) {
      socket.emit('authresponse', 
        {'status':"Pseudonyms have to be 1-140 characters. Sorry."})
      return false
    }

    // verify that username doesn't contain any bad chars
    else if (regex.test(pseudo)) {
      socket.emit('authresponse', 
        {'status':"For now no spaces, letters a-z and numbers only. This will be more permissive soon."})
      return false
    }

    // check that username is unique in this room
    else if (roomToUsernames[roomName] && pseudo in roomToUsernames[roomName]) {
      socket.emit('authresponse', 
        {'status':"That pseudonym's already taken in this room."})
      return false
    }
    return true

}


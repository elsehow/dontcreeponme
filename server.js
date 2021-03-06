// App
var express = require('express')
  , app     = express()
  , http    = require('http')
  , server  = http.Server(app)
  , io      = require('socket.io')(server)

// Libraries
var path         = require('path')
  , sanitizeHtml = require('sanitize-html')
  , _            = require('lodash')


// Express
app.set('port', process.env.PORT || 18696) // 29420
app.set('view engine', 'jade')
app.set('view options', {layout: false})
app.use(express.static(path.join(__dirname, 'public')))


// Actually start the app
server.listen(app.get('port'))
console.log('Server listening on port ' + app.get('port'))


// Routes
app.get('/', function(req, res) {
  // Render and send the main page
  res.render('home')
})

app.get('/:id', function(req, res) {
  // lazy handling for chatroom IDs.
  res.render(
    'chat',
    {roomName: req.params.id}
  )
})

var roomToUsernames = {}

// socket.io handlers

// First connection
io.sockets.on('connection', function(socket) {
  
  socket.on('joinattempt', function(data) {
    var validity = isUserValid(data, data.room)
    if (validity.isValid) {
      // store session variables for this user
      socket.color = data.color
      socket.username = data.username
      socket.publicKey = data.publicKey
      // tell user that they've been accepted
      socket.emit(
        'authresponse',
        {status: 'ok'}
      )
      // tell room to reload users now that a new person's joined 
      // room, username, is_join event
      joinRoom(socket, data.room)
    } else {
      socket.emit(
        'authresponse',
        {status: validity.message}
      )
    }
  })

  // Broadcast the message to all
  socket.on('message', function(data) {
    io.sockets.in(socket.roomName).emit(
      'message', 
      buildMessagePayload(socket.username, data)
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
  roomToUsernames[socket.roomName][socket.username] = {
    color: socket.color,
    username: socket.username,
    publicKey: socket.publicKey
  }
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

function buildMessagePayload(pseudo, message) {
  return {
    pseudo: pseudo,
    message: sanitizeHtml(
      message,
      {allowedTags: sanitizeHtml.defaults.allowedTags.concat(['marquee', 'blink'])}
    )
  }
}

var usernameRegex =  /[^a-zA-Z1-9]+/ // regular expression for validating usernames

function isUserValid(join, roomName) {
  var isValid = false
  var message = ''

  var username = join.username

  if (!username || username.length == 0) {
    // pseudo must not be null or empty
    message = 'Enter a pseudonym.'
  } else if (username.length > 140) {
    // username must be <= 140 characters long
    message = 'Pseudonyms must be between 1 and 140 characters in length.'
  } else if (usernameRegex.test(username)) {
    // username must not contain bad characters
    message = 'For now usernames may only contain the letters a-z and numbers. This will be more permissive soon.'
  } else if (roomToUsernames[roomName] && username in roomToUsernames[roomName]) {
    // username must be unique within this room
    message = "That pseudonym's already taken in this room."
  } if (!join.publicKey) {
    message = "You need a public key!"
  } else {
    isValid = true
  }

  return {
    isValid: isValid,
    message: message
  }
}


/*
Signaling erver code used for managing the rooms and the peers
*/

'use strict';

// Requirements

// OS information, used for the ipaddr event
var os = require('os');
// File streaming module using an HTTP server
var nodeStatic = require('node-static');
// HTTP core module of Node.js. Creates an HTTP server
var http = require('http');
// Open and manage the WebSocket connection
var socketIO = require('socket.io');


// Define the HTTP server
var fileServer = new (nodeStatic.Server)();
var app = http.createServer(function (req, res) {
  fileServer.serve(req, res);
}).listen(8080);

// Listen for client connection on socket
var io = socketIO.listen(app);
io.on('connection', (socket) => {
  // Convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  // Manage messages sent by user, for a real app, the event would be emitted room-only, not broadcast
  socket.on('message', function (message) {
    log('Client said: ', message);
    socket.broadcast.emit('message', message);
  });

  // Manage 'create or join' events sent by clients
  socket.on('create or join', function (room) {
    log('Received request to create or join room ' + room);

    // Exctract the clients already in the room, their number, then log
    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;

    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      // If there are no clinets, create the room and send the event 'created'
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } else if (numClients === 1) {
      // If the room already exists and there is a client, send a 'joined' event
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      // If there are already two clients, the max number, send a 'full' event
      socket.emit('full', room);
    }

    // Manage the ipaddr event. Send an ipaddr event for each IPV4 address not localhost of the current network interfaces.
    socket.on('ipaddr', function () {
      var ifaces = os.networkInterfaces();
      for (var dev in ifaces) {
        ifaces[dev].forEach(function (details) {
          if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
            socket.emit('ipaddr', details.address);
          }
        });
      }
    });
  });
})

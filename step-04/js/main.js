/*
In order to setup and maintain a WebRTC call, the peers need to exchange candidate information, and offer and answers related to media, resolution, and codecs.
This exchange of metadata is called signaling, and it is done through a signaling server that passes plain text messages between the peers.
Signaling is not defined by WebRTC to avoid redundancy and maximise compatibility
In the previous steps signaling was just a matter of passing metadata between objects, since the RTCPeerConnection objects were in the same scope.
In this step, the signaling server is a Node.js server that uses the socket.io library to pass messages between clients in different browser windows.
The server is implemented in index.js, while the web app is in index.html and main.js.
The web page won't display anything, but the console will log messages about the signaling process.
*/

'use strict';

// Variable that indicates whether the client initiates or joins a room
var isInitiator;

// Set window room using the location or, if absent, asking to the user
window.room = location.search.split('room=')[1]

if (!window.room) {
  window.room = prompt("Enter room name:")
}

// Define a socket for communication
var socket = io.connect();

// If the room is valid log and emit it to the socket as the event 'create or join'
if (room != '') {
  console.log('Message from client: Asking to join room ' + room);
  socket.emit('create or join', room);
}


// Manage socket events

// The room was created by the client, so it is the initiator
socket.on('created', function (room, clientId) {
  isInitiator = true;
});

// The room is full
socket.on('full', function (room) {
  console.log('Message from client: Room ' + room + ' is full :^(');
});

// The server sends the IP addresses of the peers
socket.on('ipaddr', function (ipaddr) {
  console.log('Message from client: Server IP address is ' + ipaddr);
});

// The client just joined the room
socket.on('joined', function (room, clientId) {
  isInitiator = false;
});

// Logger
socket.on('log', function (array) {
  console.log.apply(console, array);
});

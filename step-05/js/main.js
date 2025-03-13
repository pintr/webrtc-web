/*
Combine peer connection with signaling.
The signaling is done, as in step-04, with Socket.IO running on Node.js.
The stream is managed using a WebRTC connection (RTCPeerConnection), similarly to step-02
*/

'use strict';

// Variables used for communication

// Variable indicating if someone joined the room, and the communication can start
var isChannelReady = false;
// Variable that indicates whether the client initiates or joins a room. Default: false.
var isInitiator = false;
// Variable indicating that the peer communication is up and running.
var isStarted = false;
// The RTCPeerConneciton
var pc;
// Variables containing the media stream for debugging, both of local and remote videos.
var localStream;
var remoteStream;
// Variable used for TURN servers. True if it exists and it's ready. 
var turnReady;


// Configs

// Configuration for the peer connection. It contains a freely available Google STUN server
var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};
// Set up audio and video regardless of what devices are present.
// Not used in the example.
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};


// Signaling server

// Define a socket for communication
var socket = io.connect();

// Setup room name and creation/join
var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');
if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

// The room was created by the client, so it is the initiator
socket.on('created', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

// The room is full
socket.on('full', function (room) {
  console.log('Room ' + room + ' is full');
});

// Event sent to the initiator of the room when a new peer joins.
socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

// Event sent to the newly added peer when it joins the room.
socket.on('joined', function (room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

// Manage the event of a generic message
socket.on('message', function (message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    // The local stream has been added to the video element. Create the peer connection and the offer.
    maybeStart();
  } else if (message.type === 'offer') {
    // The client receives an offer already created.
    // If it's not the initiator and the communication is not started yet, create an offer.
    // Otherwise set the remote description and send answer.
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    // If the message is an answer set the remote description to the peer connection.
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    // If the message is a candidate create it and add to the peer connection
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    // If a peer closes a connection manage the remote peer quit.
    handleRemoteHangup();
  }
});

// Logger
socket.on('log', function (array) {
  console.log.apply(console, array);
});

// Send a generic message that can have different types.
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}


// Manage HTML elements and the media devices

// Select video element in the HTML page where the stream will be placed.
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

// Define the constraints and log them.
var constraints = {
  audio: true,
  video: true,
};
console.log('Getting user media with constraints', constraints);

// Check if the host is local, otherwise request TURN. NOT WORKING.
if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

// Prompt the user for permission to access a media input (camera), if granted start local streaming
navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
}).then(gotStream).catch(function (e) {
  alert('getUserMedia() error: ' + e.name);
});

// Close connection when the current window, contained document, and associated resources are about to be unloaded.
window.onbeforeunload = function () {
  sendMessage('bye');
};

// Request turn, if it is present in the pcConfig.iceServers use it
// Otherwise get one from computeengineondemand.appspot.com. NOT WORKING.
function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.startsWith('turn:')) {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

// Set the MediaStream as the source of the local video element
// Send a message saying that the media is available
// Try to start the communication by creating the stream connection, adding the stream and create the offer.
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}


// Manage the RTC communication

// Function that checks if the communication hasn't started yet.
// In case create the RTCPeerCOnnection, add the local stream, and send an offer.
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    // pc.addStream(localStream);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

// Create a new RTCPeerCOnnection and manage all its events
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteTrackAdded;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

// Create the offer and handle it.
function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

// Similarly to the offer, create the answer.
function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(setLocalAndSendMessage, onCreateSessionDescriptionError);
}

// Function used when offer and answer are created.
// Set the local description to the peer connection and send a message with the session description.
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

// Send the candidate message when received in the event. In case add it to the peer connection.
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

// Stream the remote video when the remote track gets added.
function handleRemoteTrackAdded(event) {
  console.log('Remote track added.', event);
  remoteStream = event.streams[0]
  if (!remoteStream) {
    remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);
    remoteStream.onremovetrack = handleRemoteTrackRemoved;
    console.log('Created stream from track:', remoteStream);
  }
  remoteVideo.srcObject = remoteStream;
}

// Close the connection

// Hangup and send the bye message.
function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

// Handle when the remote peer disconnects.
function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

// Close the peer connection.
function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

// Logs

// Logs an error related to the creation of the offer.
function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

// Logs an error related to the session description.
function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

// Log that the remote stream has been removed.
function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

// Log that the remote track has been removed.
function handleRemoteTrackRemoved(event) {
  console.log('Remote track removed. Event: ', event);
}
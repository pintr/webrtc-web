/*
Share files between peers using RTCDataChannel
The core parts are:
1. Establish a data channel between peers (no need to add media streams)
2. Capture the user's webcam using getMediaUser()
3. When the user clicks the Snap button, get a snapshot (a video frame) from the video stream and display it in a canvas element
4. When the user clicks the Send button, convert the image to bytes and send them via a data channel
5. The receiving side converts data channel message bytes back to an image and displays the image to the user
*/

'use strict';

// Variables and configuration

// Configuration for the peer connection if needed.
// var configuration = {
//   'iceServers': [{
//     'urls': 'stun:stun.l.google.com:19302'
//   }]
// };
var configuration = null;

// Variables used for the communication: peer connection and data channel
var pc;
var dataChannel;

// Variables used for the dimensions (width and height) of the canvas based on the dimensions of the video stream
var photoContextW;
var photoContextH;

// Variable that indicates whether the client initiates or joins a room. Default: false.
var isInitiator = false;

// Setup room name
var room = window.location.hash.substring(1);
if (!room) {
  room = window.location.hash = randomToken();
}


// Signaling server

// Define a socket for communication
var socket = io.connect();

// Get the server IP address
socket.on('ipaddr', function (ipaddr) {
  console.log('Server IP address is: ' + ipaddr);
  // updateRoomURL(ipaddr);
});

// The room was created by the client, so it is the initiator. Get the user media. 
socket.on('created', function (room, clientId) {
  console.log('Created room', room, '- my client ID is', clientId);
  isInitiator = true;
  grabWebCamVideo();
});

// Event sent to the newly added peer when it joins the room.
socket.on('joined', function (room, clientId) {
  console.log('This peer has joined room', room, 'with client ID', clientId);
  isInitiator = false;
  createPeerConnection(isInitiator, configuration);
  grabWebCamVideo();
});

// The room is full. Create another room for the user.
socket.on('full', function (room) {
  alert('Room ' + room + ' is full. We will create a new room for you.');
  window.location.hash = '';
  window.location.reload();
});

// The socket is ready. The communication can start.
socket.on('ready', function () {
  console.log('Socket is ready');
  createPeerConnection(isInitiator, configuration);
});

// Manage the event of a generic message
socket.on('message', function (message) {
  console.log('Client received message:', message);
  signalingMessageCallback(message);
});

// Manage the event of a peer disconnecting.
socket.on('disconnect', function (reason) {
  console.log(`Disconnected: ${reason}.`);
  sendBtn.disabled = true;
  snapAndSendBtn.disabled = true;
});

// Manage the event of a peer leaving the room.
socket.on('bye', function (room) {
  console.log(`Peer leaving room ${room}.`);
  sendBtn.disabled = true;
  snapAndSendBtn.disabled = true;
  // If peer did not create the room, re-enter to be creator.
  if (!isInitiator) {
    window.location.reload();
  }
});

// Logger
socket.on('log', function (array) {
  console.log.apply(console, array);
});

// Send a generic message that can have different types.
function sendMessage(message) {
  console.log(`Client [init:${isInitiator}] sending message:`, message);
  socket.emit('message', message);
}

// Join a room and manage the unloading of the window.
socket.emit('create or join', room);
// if the host is local, get the IP address
if (location.hostname.match(/localhost|127\.0\.0/)) {
  socket.emit('ipaddr');
}
// Notify the peers when the window is unloaded.
window.addEventListener('unload', function () {
  console.log(`Unloading window. Notifying peers in ${room}.`);
  socket.emit('bye', room);
});

// Manage HTML elements and functions, and the media devices

// Component used for streaming the webcam video
var video = document.querySelector('video');
// Component that displays a snapshot of a video stream
var photo = document.getElementById('photo');
// Component that allows to draw the image to the canvas
var photoContext = photo.getContext('2d');
// Components that displays the received images
var trail = document.getElementById('trail');
// Button for taking a snapshot of the video stream
var snapBtn = document.getElementById('snap');
snapBtn.addEventListener('click', snapPhoto);
// Button for sending the snapshot to the peer
var sendBtn = document.getElementById('send');
sendBtn.addEventListener('click', sendPhoto);
sendBtn.disabled = true;
// Button for taking a snapshot and sending it to the peer
var snapAndSendBtn = document.getElementById('snapAndSend');
snapAndSendBtn.addEventListener('click', snapAndSend);
snapAndSendBtn.disabled = true;

// Prompt the user for permission to access a media input (camera), if granted start local streaming
function grabWebCamVideo() {
  console.log('Getting user media (video) ...');
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
    .then(gotStream)
    .catch(function (e) {
      alert('getUserMedia() error: ' + e.name);
    });
}

// Set the MediaStream as the source of the local video element and enable the snap button
function gotStream(stream) {
  console.log('getUserMedia video stream URL:', stream);
  window.stream = stream; // stream available to console
  video.srcObject = stream;
  video.onloadedmetadata = function () {
    photo.width = photoContextW = video.videoWidth;
    photo.height = photoContextH = video.videoHeight;
    console.log('gotStream with width and height:', photoContextW, photoContextH);
  };
  show(snapBtn);
}

// Display image on the canvas and enable the send button
function snapPhoto() {
  photoContext.drawImage(video, 0, 0, photo.width, photo.height);
  show(photo, sendBtn);
}

// Convert the image to bytes and send them via the data channel
function sendPhoto() {
  // Split data channel message in chunks of this byte length.
  var CHUNK_LEN = 64000;
  console.log('width and height ', photoContextW, photoContextH);
  var img = photoContext.getImageData(0, 0, photoContextW, photoContextH),
    len = img.data.byteLength,
    n = len / CHUNK_LEN | 0;

  console.log('Sending a total of ' + len + ' byte(s)');

  if (!dataChannel) {
    logError('Connection has not been initiated. Get two peers in the same room first');
    return;
  } else if (dataChannel.readyState === 'closed') {
    logError('Connection was lost. Peer closed the connection.');
    return;
  }

  dataChannel.send(len);

  // split the photo and send in chunks of about 64KB
  for (var i = 0; i < n; i++) {
    var start = i * CHUNK_LEN,
      end = (i + 1) * CHUNK_LEN;
    console.log(start + ' - ' + (end - 1));
    dataChannel.send(img.data.subarray(start, end));
  }

  // send the reminder, if any
  if (len % CHUNK_LEN) {
    console.log('last ' + len % CHUNK_LEN + ' byte(s)');
    dataChannel.send(img.data.subarray(n * CHUNK_LEN));
  }
}

// Create the snapshot and send it to the peer
function snapAndSend() {
  snapPhoto();
  sendPhoto();
}

// Properly render the image received from the peer and display it
function renderPhoto(data) {
  var canvas = document.createElement('canvas');
  canvas.width = photoContextW;
  canvas.height = photoContextH;
  canvas.classList.add('incomingPhoto');
  // trail is the element holding the incoming images
  trail.insertBefore(canvas, trail.firstChild);

  var context = canvas.getContext('2d');
  var img = context.createImageData(photoContextW, photoContextH);
  img.data.set(data);
  context.putImageData(img, 0, 0);
}

// Function for enabling HTML elements
function show() {
  Array.prototype.forEach.call(arguments, function (elem) {
    elem.style.display = null;
  });
}

// Function for hiding HTML elements
function hide() {
  Array.prototype.forEach.call(arguments, function (elem) {
    elem.style.display = 'none';
  });
}

// Create a random token for the room name.
function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}


// Manage the RTC communication

// Manage a signaling messages received from the peer, it could be an offer, an answer, or a candidate.
function signalingMessageCallback(message) {
  if (message.type === 'offer') {
    console.log('Got offer. Sending answer to peer.');
    pc.setRemoteDescription(new RTCSessionDescription(message), function () { }, logError);
    pc.createAnswer(onLocalSessionCreated, logError);
  } else if (message.type === 'answer') {
    console.log('Got answer.');
    pc.setRemoteDescription(new RTCSessionDescription(message), function () { }, logError);
  } else if (message.type === 'candidate') {
    pc.addIceCandidate(new RTCIceCandidate({
      candidate: message.candidate,
      sdpMLineIndex: message.label,
      sdpMid: message.id
    }));

  }
}

// Create a new RTCPeerCOnnection and manage all its events
function createPeerConnection(isInitiator, config) {
  console.log('Creating Peer connection as initiator?', isInitiator, 'config:', config);
  pc = new RTCPeerConnection(config);

  // send any ice candidates to the other peer
  pc.onicecandidate = function (event) {
    console.log('icecandidate event:', event);
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
  };

  if (isInitiator) {
    console.log('Creating Data Channel');
    dataChannel = pc.createDataChannel('photos');
    onDataChannelCreated(dataChannel);

    console.log('Creating an offer');
    pc.createOffer().then(function (offer) {
      return pc.setLocalDescription(offer);
    }).then(() => {
      console.log('sending local desc:', pc.localDescription);
      sendMessage(pc.localDescription);
    }).catch(logError);
  } else {
    pc.ondatachannel = function (event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      onDataChannelCreated(dataChannel);
    };
  }
}

// Set the local session description that will be sent as an answer to the peer
function onLocalSessionCreated(desc) {
  console.log('local session created:', desc);
  pc.setLocalDescription(desc).then(function () {
    console.log('sending local desc:', pc.localDescription);
    sendMessage(pc.localDescription);
  }).catch(logError);
}

// When the data channel is created, manage its events and HTML elements: open, close, and message
function onDataChannelCreated(channel) {
  console.log('onDataChannelCreated:', channel);

  channel.onopen = function () {
    console.log('CHANNEL opened!!!');
    sendBtn.disabled = false;
    snapAndSendBtn.disabled = false;
  };

  channel.onclose = function () {
    console.log('Channel closed.');
    sendBtn.disabled = true;
    snapAndSendBtn.disabled = true;
  }

  channel.onmessage = (adapter.browserDetails.browser === 'firefox') ?
    receiveDataFirefoxFactory() : receiveDataChromeFactory();
}

// Manage data coming from a Chrome based browser
function receiveDataChromeFactory() {
  var buf, count;

  return function onmessage(event) {
    if (typeof event.data === 'string') {
      buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
      count = 0;
      console.log('Expecting a total of ' + buf.byteLength + ' bytes');
      return;
    }

    var data = new Uint8ClampedArray(event.data);
    buf.set(data, count);

    count += data.byteLength;
    console.log('count: ' + count);

    if (count === buf.byteLength) {
      // we're done: all data chunks have been received
      console.log('Done. Rendering photo.');
      renderPhoto(buf);
    }
  };
}

// Manage data coming from a Firefox based browser
function receiveDataFirefoxFactory() {
  var count, total, parts;

  return function onmessage(event) {
    if (typeof event.data === 'string') {
      total = parseInt(event.data);
      parts = [];
      count = 0;
      console.log('Expecting a total of ' + total + ' bytes');
      return;
    }

    parts.push(event.data);
    count += event.data.size;
    console.log('Got ' + event.data.size + ' byte(s), ' + (total - count) +
      ' to go.');

    if (count === total) {
      console.log('Assembling payload');
      var buf = new Uint8ClampedArray(total);
      var compose = function (i, pos) {
        var reader = new FileReader();
        reader.onload = function () {
          buf.set(new Uint8ClampedArray(this.result), pos);
          if (i + 1 === parts.length) {
            console.log('Done. Rendering photo.');
            renderPhoto(buf);
          } else {
            compose(i + 1, pos + this.result.byteLength);
          }
        };
        reader.readAsArrayBuffer(parts[i]);
      };
      compose(0, 0);
    }
  };
}


// Logs

// Logs generic errors.
function logError(err) {
  if (!err) return;
  if (typeof err === 'string') {
    console.warn(err);
  } else {
    console.warn(err.toString(), err);
  }
}
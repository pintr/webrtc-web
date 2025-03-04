/*
This code uses RTCPeerConnection and RTCDataChannel to enable exchange of text messages between two peers.
Much of the code in this step is the same as for the RTCPeerConnection example.
The sendData() and createConnection() functions have most of the new code.
*/

'use strict';

// Define the variables used for the local and remote RTCPeerConnections
// They include the RTCPeerConnection objects, the RTCDataChannel objects.
// Additionally, there are the variables for the constraints.
var localConnection;
var remoteConnection;
var sendChannel;
var receiveChannel;
var pcConstraint;
var dataConstraint;

// Assign the elements of the UI to variables
var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var startButton = document.querySelector('button#startButton');
var sendButton = document.querySelector('button#sendButton');
var closeButton = document.querySelector('button#closeButton');

// Define the handler functions for the start, send, and close buttons
startButton.onclick = createConnection;
sendButton.onclick = sendData;
closeButton.onclick = closeDataChannels;

// The createConnection function sets up the RTCPeerConnection objects and the RTCDataChannel objects.
// It also sets up the constraints, the onicecandidate, and ondatachannel event handlers.
// Finally, it creates the local offer and manages the button states.
function createConnection() {
  dataChannelSend.placeholder = '';
  dataChannelReceive.placeholder = 'Ready to print messages';
  var servers = null;
  pcConstraint = null;
  dataConstraint = null;
  trace('Using SCTP based data channels');
  // Initialise the local RTCPeerConnection object
  // For SCTP, reliable and ordered delivery is true by default.
  // Add localConnection to global scope to make it visible from the browser console.
  window.localConnection = localConnection =
    new RTCPeerConnection(servers, pcConstraint);
  trace('Created local peer connection object localConnection');

  // Initialise the local RTCPeerConnection object's data channel (RTCDataChannel).
  // RTCDataChannel API enables peer-to-peer exchange of arbitrary data with low latency and high throughput.
  sendChannel = localConnection.createDataChannel('sendDataChannel',
    dataConstraint);
  trace('Created send data channel');

  // Set up the event handlers for the ICE candidate of the local connection,
  // This is called when the local ICE candidate is available, so it can be added to the remote peer connection.
  localConnection.onicecandidate = iceCallback1;
  // Set up the event handlers for the send RTCDataChannel:
  // - onopen: This is called when the data channel is open and ready to send data.
  // - onclose: This is called when the data channel closes.
  sendChannel.onopen = onSendChannelStateChange;
  sendChannel.onclose = onSendChannelStateChange;

  // Initialise the local RTCPeerConnection object
  // Add remoteConnection to global scope to make it visible
  // from the browser console.
  window.remoteConnection = remoteConnection =
    new RTCPeerConnection(servers, pcConstraint);
  trace('Created remote peer connection object remoteConnection');

  // Set up the event handlers for the ICE candidate of the remote connection, similarly to the local connection.
  remoteConnection.onicecandidate = iceCallback2;
  // Event handler used when an RTCDataChannel is added to the remote peer connection.
  remoteConnection.ondatachannel = receiveChannelCallback;

  // Create an offer using the local RTCPeerConnection object
  // When the offer is ready, the gotDescription1 function is called.
  // This function sets local and remote descriptions and creates an answer.
  // Otherwise il logs an error.
  localConnection.createOffer().then(
    gotDescription1,
    onCreateSessionDescriptionError
  );
  // Manage buttons states
  startButton.disabled = true;
  closeButton.disabled = false;
}

// The sendData function reads the data from the text area, sends it using the sendChannel, and logs the data.
function sendData() {
  var data = dataChannelSend.value;
  sendChannel.send(data);
  trace('Sent Data: ' + data);
}

// The cloiseDataChannels function closes the data channels and the peer connections.
// It also resets the UI elements and manages the button states.
function closeDataChannels() {
  trace('Closing data channels');
  sendChannel.close();
  trace('Closed data channel with label: ' + sendChannel.label);
  receiveChannel.close();
  trace('Closed data channel with label: ' + receiveChannel.label);
  localConnection.close();
  remoteConnection.close();
  localConnection = null;
  remoteConnection = null;
  trace('Closed peer connections');
  startButton.disabled = false;
  sendButton.disabled = true;
  closeButton.disabled = true;
  dataChannelSend.value = '';
  dataChannelReceive.value = '';
  dataChannelSend.disabled = true;
}


// Define RTC peer connections callbacks.

// The iceCallback1 functions is called when the local candidate is available.
// It logs the candidate, and adds it to the remote peer connection.
function iceCallback1(event) {
  trace('local ice callback');
  if (event.candidate) {
    remoteConnection.addIceCandidate(
      event.candidate
    ).then(
      onAddIceCandidateSuccess,
      onAddIceCandidateError
    );
    trace('Local ICE candidate: \n' + event.candidate.candidate);
  }
}

// The iceCallback2 functions is called when the remote candidate is available.
// It logs the candidate, and adds it to the local peer connection.
function iceCallback2(event) {
  trace('remote ice callback');
  if (event.candidate) {
    localConnection.addIceCandidate(
      event.candidate
    ).then(
      onAddIceCandidateSuccess,
      onAddIceCandidateError
    );
    trace('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

// Callback used when the local RTCDataChannel is added to the remote peer connection.
// It sets the receiveChannel event handlers:
// - onmessage: This is called when a message is received.
// - onopen: This is called when the data channel is open and ready to receive data.
// - onclose: This is called when the data channel closes.
// The last two are managed bychanging the ready state of the receiveChannel, and log.
function receiveChannelCallback(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}

// Set the value of the dataChannelReceive textarea to the received message, and log the event.
function onReceiveMessageCallback(event) {
  trace('Received Message');
  dataChannelReceive.value = event.data;
}

// Read the ready state of the sendChannel, and manage the channels, and button states accordingly.
function onSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    sendButton.disabled = false;
    closeButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
    closeButton.disabled = true;
  }
}

// Set the readyState of the receiveChannel when it changes, and log the event.
function onReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
}


// RTC Session Offer and Answer management

// Handle the local description (RTCSessionDescriptionInit) object created by the createOffer method.
// It sets the local description to the local connection, and sets it as the remote description of the remote connection.
// It creates an answer using the remote connection, when it's ready, the gotDescription2 function is called.
function gotDescription1(desc) {
  localConnection.setLocalDescription(desc);
  trace('Offer from localConnection \n' + desc.sdp);
  remoteConnection.setRemoteDescription(desc);
  remoteConnection.createAnswer().then(
    gotDescription2,
    onCreateSessionDescriptionError
  );
}

// Handle the remote description (RTCSessionDescriptionInit) object created by the createAnswer method.
// It sets the remote connection's local description, and sets it as the remote description of the local connection.
function gotDescription2(desc) {
  remoteConnection.setLocalDescription(desc);
  trace('Answer from remoteConnection \n' + desc.sdp);
  localConnection.setRemoteDescription(desc);
}


// Logs

// Logs when a session description fails to be created.
function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

// Logs when an ICE candidate is successfully added.
function onAddIceCandidateSuccess() {
  trace('AddIceCandidate success.');
}

// Logs when an ICE candidate fails to be added.
function onAddIceCandidateError(error) {
  trace('Failed to add Ice Candidate: ' + error.toString());
}


// Define helper functions.

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
  if (text[text.length - 1] === '\n') {
    text = text.substring(0, text.length - 1);
  }
  if (window.performance) {
    var now = (window.performance.now() / 1000).toFixed(3);
    console.log(now + ': ' + text);
  } else {
    console.log(text);
  }
}

/*
First up, Alice and Bob exchange network information. 
The expression ‘finding candidates' refers to the process of finding network interfaces and ports using the ICE framework.

1. Alice creates an RTCPeerConnection object with an onicecandidate (addEventListener('icecandidate')) handler.
   In the code is the localPeerConnection initialisation and event handler definition 

2. Alice calls getUserMedia() and adds the stream to localPeerConnection.

3. The onicehandler is called when candidates become available.

4. Alice sends serialized candidate data to Bob.
   This is the signaling process, usually done via a messaging service.

5. When Bob gets a candidate message from Alice, 
   He calls addIceCandidate(), to add the candidate to the remote peer description.
*/

/*
WebRTC need to find out and exchange local and remote media streams, and media information.
Signaling to exchange media configuration information proceeds by exchanging blobs of metadata, known as an offer and an answer, using the Session Description Protocol.

1. Alice creates the offer using the createOffer method, that returns a promise with the Alice's RTCSessionDescription.

2. If successfull, Alice sets the local description and sends it to Bob using the signaling channel

3. Bob sets the received description as the remote description

4. Bob then creates the answer and passses the remote description he got from Alice.
   At this point a local session can be generated. 
   The createAnswer() promise passes on an RTCSessionDescription: Bob sets that as the local description and sends it to Alice.

5. When Alice gets Bob's session description, she sets that as the remote description and the conneciton is created.
*/

'use strict';

// Define variables, and media constraints for the local stream.

// In this case only video will be streamed, without particular constraints
const mediaStreamConstraints = {
  video: true,
};

// Set up the offer to excange only video.
const offerOptions = {
  offerToReceiveVideo: 1,
};

// Define a variable for the start time of the call, null until the call starts.
let startTime = null;

// Select video element in the HTML page where the stream will be placed.
// In this case for both the local and remote videos.
const localVideo = document.getElementById('localVideo')
const remoteVideo = document.getElementById('remoteVideo')

// Variables containing the media stream for debugging, both of local and remote videos.
let localStream;
let remoteStream;

// Variable the local tracks
let localTracks;

// Variables for the RTCPeerConnection, both local and remote.
// The RTCPeerConnection represents the WebRTC session: it allows to connection and communication between peers (browsers)
// It contains all the protocols used by WebRTC, except the Signaling
let localPeerConnection;
let remotePeerConnection;


// Define MediaStreams callbacks.

// Set the MediaStream as the source of the local video element
function gotLocalMediaStream(mediaStream) {
  localStream = mediaStream;
  localTracks = localStream.getTracks();
  localVideo.srcObject = mediaStream;
  trace('Received local stream.');
  callButton.disabled = false;  // Enable call button.
}

// Handle the track event triggered when a new track is added
// Adding a new track means that a remote peer has accepted the local offer and connected to the local peer.
// The MediaStream included in the event is added as source of the remote video element
function gotRemoteMediaStream(event) {
  let remoteStream = event.streams[0]
  if (!remoteStream) {
    remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);
    console.log('Created stream from track:', remoteStream);
  }
  remoteVideo.srcObject = remoteStream;
  trace('Remote peer connection received remote stream.');
}


// Add behavior for video streams.

// Logs the local video ID and size when added (start button click).
localVideo.addEventListener('loadedmetadata', logVideoLoaded);
// Logs the remote video ID and size when added (call button click).
remoteVideo.addEventListener('loadedmetadata', logVideoLoaded);
// Logs the local video ID and size when it is resized during the call.
remoteVideo.addEventListener('onresize', logResizedVideo);


// Define and add behavior to buttons.

// Handle start button click: creation of the LocalStream.
function startAction() {
  startButton.disabled = true;

  // Prompt the user for permission to access a media input (camera), if granted start local streaming
  navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    .then(gotLocalMediaStream).catch(handleLocalMediaStreamError);
  trace('Requesting local stream.');
}

// Handle call button click: creation of the peer connection.
function callAction() {
  callButton.disabled = true;
  hangupButton.disabled = false;

  trace('Starting call.');
  startTime = window.performance.now(); // Set the start time when button is pushed.
  // Get local stream tracks, to print those in use, ìn this case only one.
  const videoTracks = localTracks.filter(track => track.kind === 'video');
  const audioTracks = localTracks.filter(track => track.kind === 'audio');
  if (videoTracks.length > 0) {
    trace(`Using video device: ${videoTracks[0].label}.`);
  }
  if (audioTracks.length > 0) {
    trace(`Using audio device: ${audioTracks[0].label}.`);
  }

  // Create the local peer connection and add behaviour
  localPeerConnection = new RTCPeerConnection();

  // The event icecandidate is sent to the RTCPeerConnection when:
  // - An RTCIceCandidate has been identified and added to the local peer (using RTCPeerConnection.setLocalDescription()) and
  // - Every ICE candidate correlated with a generation (username + password) has been identified and added, and
  // - All ICE gathering on all transports is complete, so all the possible participants of the call hav ebeen collected, and no more addresses will be collcted after it.
  localPeerConnection.addEventListener('icecandidate', handleConnection);
  // The event iceconnectionstatechange is sent when the ICE connection changes during the negotiation process.
  localPeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);


  // Create the remote peer connection and add behaviour
  remotePeerConnection = new RTCPeerConnection();
  trace('Created remote peer connection object remotePeerConnection.');

  // Same as above
  remotePeerConnection.addEventListener('icecandidate', handleConnection);
  remotePeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);
  // The track event is sent to the handler when a new track has been added to an RTCRtpReceiver, which is part of the connection.
  remotePeerConnection.addEventListener('track', gotRemoteMediaStream);

  // Add a new media track to the set of tracks to be transmitted to other peers.
  localPeerConnection.addTrack(localTracks[0]);
  trace('Added local track to localPeerConnection.');

  trace('localPeerConnection createOffer start.');

  // Create and SDP offer for starting the connection to a remote peer
  // SDP offer includes information about the MediaStreamTrack objects attached to the WebRTC stream, codec, and options supported by the browser
  // it also collects the candidates already gathered by the ICE agent in order to be sent on the signaling channel to a potential peer to request or update a connection.
  localPeerConnection.createOffer(offerOptions)
    .then(createdOffer).catch(setSessionDescriptionError);
}

// Handle hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
  // Close connections
  localPeerConnection.close();
  remotePeerConnection.close();
  // Set the connections to null
  localPeerConnection = null;
  remotePeerConnection = null;
  // Reset the buttons
  hangupButton.disabled = true;
  callButton.disabled = false;
  trace('Ending call.');
}

// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;

// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);


// Define RTC peer connection behavior.

// Handle the icecandidate event: Connection with new peer candidate.
function handleConnection(event) {
  // Extract the peer and the ICE candidate
  const peerConnection = event.target;
  const iceCandidate = event.candidate;

  if (iceCandidate) {
    // If there is the ICE candidate instantaite it and extract the other peer (local or remote, depending on the candidate)
    const newIceCandidate = new RTCIceCandidate(iceCandidate);
    const otherPeer = getOtherPeer(peerConnection);

    // Add the new ICE candidate to the other peer
    otherPeer.addIceCandidate(newIceCandidate)
      // Handle connection success or failure by logging it to the console
      // In case of failure log the error too.
      .then(() => {
        handleConnectionSuccess(peerConnection);
      }).catch((error) => {
        handleConnectionFailure(peerConnection, error);
      });

    // Log peer name and ICE candidate
    trace(`${getPeerName(peerConnection)} ICE candidate:\n` +
      `${event.candidate.candidate}.`);
  }
}

// Handle the iceconnectionstatechange event: Log the ICE state change. 
function handleConnectionChange(event) {
  const peerConnection = event.target;
  console.log('ICE state change event: ', event);
  trace(`${getPeerName(peerConnection)} ICE state: ` +
    `${peerConnection.iceConnectionState}.`);
}

// Handle the RTCSessionDescription initiation promise generated by the local peer connection offer creation.
function createdOffer(description) {
  trace(`Offer from localPeerConnection:\n${description.sdp}`);

  trace('localPeerConnection setLocalDescription start.');
  localPeerConnection.setLocalDescription(description)
    .then(() => {
      // Logs when the local description is set, or logs an error if it fails
      setLocalDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);

  trace('remotePeerConnection setRemoteDescription start.');
  remotePeerConnection.setRemoteDescription(description)
    .then(() => {
      // Logs when the remote description is set, or logs an error if it fails
      setRemoteDescriptionSuccess(remotePeerConnection);
    }).catch(setSessionDescriptionError);

  trace('remotePeerConnection createAnswer start.');
  // Create the SDP answer to the offer received by the remote peer or handle the error.
  // The answer contains information about the media already attached to the session, codecs, options, and ICE candidates already gathered.
  remotePeerConnection.createAnswer()
    .then(createdAnswer)
    .catch(setSessionDescriptionError);
}

// When the offer is accepted the answer is created, a log is created in case of error 
function createdAnswer(description) {
  trace(`Answer from remotePeerConnection:\n${description.sdp}.`);

  trace('remotePeerConnection setLocalDescription start.');
  // Change the remote peer connection by associating the local peer, logs for both success and error
  remotePeerConnection.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(remotePeerConnection);
    }).catch(setSessionDescriptionError);

  trace('localPeerConnection setRemoteDescription start.');
  // Change the local peer connection by associating the remote peer, logs for both success and error
  localPeerConnection.setRemoteDescription(description)
    .then(() => {
      setRemoteDescriptionSuccess(localPeerConnection);
    }).catch(setSessionDescriptionError);
}


// Define helper functions.

// Gets the "other" peer connection.
function getOtherPeer(peerConnection) {
  return (peerConnection === localPeerConnection) ?
    remotePeerConnection : localPeerConnection;
}

// Gets the name of a certain peer connection.
function getPeerName(peerConnection) {
  return (peerConnection === localPeerConnection) ?
    'localPeerConnection' : 'remotePeerConnection';
}

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
  text = text.trim();
  const now = (window.performance.now() / 1000).toFixed(3);

  console.log(now, text);
}


// Logs

// Function that handles the arror given by the media stream by printing it
function handleLocalMediaStreamError(error) {
  console.log('navigator.mediaDevices.getUserMedia error: ', error);
};

// Logs a message with the id and size of a video element.
function logVideoLoaded(event) {
  const video = event.target;
  trace(`${video.id} videoWidth: ${video.videoWidth}px, ` +
    `videoHeight: ${video.videoHeight}px.`);
}

// Logs a message with the id and size of a video element.
// This event is fired when video begins streaming.
function logResizedVideo(event) {
  logVideoLoaded(event);

  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    startTime = null;
    trace(`Setup time: ${elapsedTime.toFixed(3)}ms.`);
  }
}

// Logs that the connection succeeded.
function handleConnectionSuccess(peerConnection) {
  trace(`${getPeerName(peerConnection)} addIceCandidate success.`);
};

// Logs that the connection failed.
function handleConnectionFailure(peerConnection, error) {
  trace(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
    `${error.toString()}.`);
}

// Logs success when setting session description.
function setDescriptionSuccess(peerConnection, functionName) {
  const peerName = getPeerName(peerConnection);
  trace(`${peerName} ${functionName} complete.`);
}

// Logs changes to the connection state.
function handleConnectionChange(event) {
  const peerConnection = event.target;
  console.log('ICE state change event: ', event);
  trace(`${getPeerName(peerConnection)} ICE state: ` +
    `${peerConnection.iceConnectionState}.`);
}

// Logs error when setting session description fails.
function setSessionDescriptionError(error) {
  trace(`Failed to create session description: ${error.toString()}.`);
}

// Logs success when localDescription is set.
function setLocalDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setLocalDescription');
}

// Logs success when remoteDescription is set.
function setRemoteDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setRemoteDescription');
}

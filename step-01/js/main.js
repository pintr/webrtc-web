'use strict';

// const used as an argument to getUserMedia, specifying what media to get, could have had "audio" too
// The constraints concern other paramteres too, such as widht, height, and frame rate for videos.
const mediaStreamingConstraints = {
  audio: false,
  // video: true,
  video: {
    width: {
      min: 640,
      max: 1920
    },
    height: {
      max: 1080
    },
    frameRate: {
      min: 3,
      max: 60
    }
  }
}

// Select video element in the HTML page where the stream will be placed.
const localVideo = document.querySelector('video')

// Variable containing the media stream for debugging
let localStream;

// Function that handles the webcam media stream if the browser can access it succesfully.
// It set the stream to the video element, and to the localStream variable
function gotLocalVideoStream(mediaStream) {
  localStream = mediaStream;
  localVideo.srcObject = mediaStream;
}

// Function that handles the arror given by the media stream by printing it
function handleLocalMediaStreamError(error) {
  console.log('navigator.mediaDevices.getUserMedia error: ', error);
};

// Initialise the video stream.
// The navigator.mediaDevices.getUserMedia function lets the browser request permission from user to access the camera.
// If successful the stream is returned to gotLocalVideoStream that assigns it to the video element.
// Otherwise an error is caught by the handleLocalMediaStreamError function, that prints it.
navigator.mediaDevices.getUserMedia(mediaStreamingConstraints)
  .then(gotLocalVideoStream).catch(handleLocalMediaStreamError)
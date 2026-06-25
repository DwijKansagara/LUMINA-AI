// Compute a robust model base path that works on GitHub Pages (project pages)
// and on user pages (username.github.io). For project pages the first
// pathname segment is usually the repository name (e.g. /Video-Player/).
const _pathParts = window.location.pathname.split('/').filter(Boolean);
const _repoBase = _pathParts.length ? '/' + _pathParts[0] : '';
const _siteOrigin = window.location.origin;
const _basePath = _siteOrigin + _repoBase;

// Use absolute URLs so libraries that require http/https schemes accept them.
const imageURL = new URL('models/image/', window.location.href).href;
const audioURL = new URL('models/audio/', window.location.href).href;

let imageModel;
let imageLabels;
let webcam;
let videoElement;
let cameraGestureState = {
  lastLabel: "",
  musicPlaying: false
};

function showSupportWarning(message){
  const warning = document.getElementById("support-warning");
  if(warning){
    warning.innerText = message;
    warning.classList.remove("hidden");
  }
}

function hideSupportWarning(){
  const warning = document.getElementById("support-warning");
  if(warning){
    warning.classList.add("hidden");
  }
}

function checkBrowserSupport(){
  const warnings = [];

  if (!("speechSynthesis" in window)){
    warnings.push("Speech synthesis is not supported.");
  }

  if (typeof window.AudioContext === "undefined" &&
      typeof window.webkitAudioContext === "undefined"){
    warnings.push("Web Audio API is not supported.");
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    warnings.push("Camera and microphone access are not supported.");
  }

  if (warnings.length){
    showSupportWarning("Warning: " + warnings.join(" "));
  } else {
    hideSupportWarning();
  }
}

/* YOUR SONG */

const music = new Audio("song.mp3");
let audioUnlocked = false;

music.preload = "auto";
music.loop = true;

async function unlockAudio(){
  if (audioUnlocked) return;

  try {
    music.muted = true;
    await music.play();
    music.pause();
    music.currentTime = 0;
    audioUnlocked = true;
    addTerminalMessage("Audio unlocked successfully.");
  } catch (error) {
    console.warn("Audio unlock attempt failed:", error);
    addTerminalMessage("Audio unlock blocked by browser. Tap the page to enable sound.");
  } finally {
    music.muted = false;
  }
}

function isPlayLabel(label){
  const normalized = label.toLowerCase();
  return normalized.includes("play") || normalized.includes("music") || normalized.includes("thumbs up");
}

function isStopLabel(label){
  const normalized = label.toLowerCase();
  return normalized.includes("stop") || normalized.includes("pause") || normalized.includes("thumbs down");
}

/* LOADER */

window.onload = () => {

  checkBrowserSupport();

  document.body.addEventListener("click", async () => {
    await unlockAudio();
  }, { once: true });

  setTimeout(() => {

    document.getElementById(
      "loader"
    ).style.display = "none";

  },2500);
};

/* CLOCK */

setInterval(() => {

  const now = new Date();

  document.getElementById(
    "clock"
  ).innerText = now.toLocaleTimeString();

},1000);

/* MOUSE GLOW */

const glow = document.querySelector(
  ".mouse-glow"
);

window.addEventListener("mousemove",e => {

  glow.style.left = e.clientX - 100 + "px";
  glow.style.top = e.clientY - 100 + "px";

});

/* TERMINAL */

function addTerminalMessage(text){

  const terminal = document.getElementById(
    "terminalBody"
  );

  const p = document.createElement("p");

  p.innerText = "> " + text;

  terminal.appendChild(p);

  terminal.scrollTop = terminal.scrollHeight;
}

/* SPEAK */

function speak(text){

  const speech = new SpeechSynthesisUtterance(text);

  speech.rate = 1;

  window.speechSynthesis.speak(speech);
}

async function requestCameraStream(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera access is not supported by this browser.");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (error) {
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");

      if (videoDevices.length === 0) {
        throw new Error(
          "No camera device was found. Please connect a webcam or enable an internal camera and reload."
        );
      }

      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: videoDevices[0].deviceId }
        });
      } catch (fallbackError) {
        throw new Error(
          "Unable to access the selected camera device. " + fallbackError.message
        );
      }
    }

    throw error;
  }
}

/* VOICE AI */

async function selectVoiceAI(){

  document.getElementById(
    "modeText"
  ).innerText = "VOICE";

  addTerminalMessage(
    "Voice systems activated"
  );

  speak("Voice systems activated");

  try{

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      throw new Error("Microphone access is not available in this browser.");
    }

    // Preflight check: ensure audio model JSON is reachable and valid JSON
    try {
      const resp = await fetch(audioURL + "model.json");
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error("Audio model not found at " + audioURL + "model.json (status " + resp.status + ")");
      }
      try { JSON.parse(text); } catch (e) {
        throw new Error("Audio model JSON is invalid or returned HTML. Check " + audioURL + "model.json");
      }
    } catch (preflightErr) {
      throw preflightErr;
    }

    const recognizer = speechCommands.create(
      "BROWSER_FFT",
      undefined,
      audioURL + "model.json",
      audioURL + "metadata.json"
    );

    if (typeof recognizer.setOverlapFactor === "function") {
      recognizer.setOverlapFactor(0.5);
    }

    await recognizer.ensureModelLoaded();

    const labels = recognizer.wordLabels();

    addTerminalMessage(
      "Voice model loaded. Labels: " + labels.join(", ")
    );

    recognizer.listen(result => {

      const scores = result.scores;

      let maxScore = 0;
      let maxIndex = 0;

      for(let i=0;i<scores.length;i++){

        if(scores[i] > maxScore){

          maxScore = scores[i];
          maxIndex = i;
        }
      }

      const prediction = labels[maxIndex];

      document.getElementById(
        "predictionText"
      ).innerText = prediction;

      document.getElementById(
        "confidenceText"
      ).innerText =
      Math.floor(maxScore * 100) + "%";

      addTerminalMessage(
        "Voice Prediction: " + prediction + " (" + Math.floor(maxScore * 100) + "%)"
      );

      /* PLAY */

      if(prediction.toLowerCase() === "play"){

        music.play();

        addTerminalMessage(
          "Playing song.mp3"
        );

        speak("Playing music");
      }

      /* STOP */

      if(prediction.toLowerCase() === "stop"){

        music.pause();

        addTerminalMessage(
          "Music stopped"
        );

        speak("Music stopped");
      }

    },{

      probabilityThreshold:0.75

    });

    addTerminalMessage("Voice AI listening...");

  }catch(error){

    console.error("VOICE AI ERROR:", error);

    alert(
      "VOICE AI ERROR:\n" + error.message
    );

    addTerminalMessage(
      "ERROR: " + error.message
    );
  }
}

/* CAMERA AI */

async function selectCameraAI(){

  document.getElementById(
    "modeText"
  ).innerText = "CAMERA";

  addTerminalMessage(
    "Vision systems activated"
  );

  speak("Vision systems activated");
  await unlockAudio();

  try {

    /* Load image model using tmImage (from CDN) */
    const tmImageLib = window.tmImage || window.teachablemachine?.image;

    if (!tmImageLib) {
      throw new Error(
        "Teachable Machine image library not loaded. Check your script import."
      );
    }

    // Preflight check: ensure image model JSON is reachable
    try {
      const resp = await fetch(imageURL + "model.json");
      const text = await resp.text();
      if (!resp.ok) {
        throw new Error("Image model not found at " + imageURL + "model.json (status " + resp.status + ")");
      }
      try { JSON.parse(text); } catch (e) {
        throw new Error("Image model JSON is invalid or returned HTML. Check " + imageURL + "model.json");
      }
    } catch (preflightErr) {
      throw preflightErr;
    }

    const modelResult = await tmImageLib.load(
      imageURL + "model.json",
      imageURL + "metadata.json"
    );

    imageModel = modelResult;

    /* Read labels from metadata */
    const metaResp = await fetch(imageURL + "metadata.json");
    const meta = await metaResp.json();
    imageLabels = meta.labels || [];

    addTerminalMessage(
      "Image model loaded. Labels: " + (imageLabels.join(", ") || "unknown")
    );

    /* CREATE NATIVE VIDEO ELEMENT FOR CAMERA DISPLAY */
    const webcamContainer =
    document.getElementById(
      "webcam-container"
    );

    webcamContainer.innerHTML = "";

    videoElement = document.createElement("video");

    videoElement.setAttribute("autoplay","");
    videoElement.setAttribute("playsinline","");
    videoElement.style.width = "100%";
    videoElement.style.height = "100%";
    videoElement.style.objectFit = "cover";

    webcamContainer.appendChild(videoElement);

    /* GET CAMERA STREAM */
    const stream = await requestCameraStream();

    videoElement.srcObject = stream;

    /* Create an offscreen canvas for predictions */
    const predictCanvas = document.createElement("canvas");

    predictCanvas.width = 224;
    predictCanvas.height = 224;

    webcam = {
      canvas: predictCanvas,
      video: videoElement
    };

    /* Start prediction loop */
    window.requestAnimationFrame(loop);

    await unlockAudio();
    cameraGestureState.lastLabel = "";
    cameraGestureState.musicPlaying = false;
    addTerminalMessage("Camera AI running");

  } catch (error) {

    console.error("CAMERA AI ERROR:", error);

    alert(
      "CAMERA AI ERROR:\n" + error.message
    );

    addTerminalMessage(
      "ERROR: " + error.message
    );
  }
}

async function loop(){

  /* Draw the current video frame to the prediction canvas */
  if (videoElement && videoElement.readyState >= 2) {

    const ctx = webcam.canvas.getContext("2d");

    ctx.drawImage(
      videoElement,
      0, 0,
      224, 224
    );
  }

  await predict();

  window.requestAnimationFrame(loop);
}

async function predict(){

  if (!imageModel || !webcam || !imageLabels) return;

  const predictions =
  await imageModel.predict(webcam.canvas);

  let highest = predictions[0];

  for(let i=1;i<predictions.length;i++){

    if(
      predictions[i].probability >
      highest.probability
    ){

      highest = predictions[i];
    }
  }

  document.getElementById(
    "predictionText"
  ).innerText = highest.className;

  document.getElementById(
    "confidenceText"
  ).innerText =
  Math.floor(
    highest.probability * 100
  ) + "%";

  const currentLabel = highest.className || "";
  document.getElementById(
    "predictionText"
  ).innerText = currentLabel;

  if (currentLabel !== cameraGestureState.lastLabel) {
    addTerminalMessage(
      "Camera Prediction: " + currentLabel + " (" + Math.floor(highest.probability * 100) + "%)"
    );
    cameraGestureState.lastLabel = currentLabel;
  }

  if (highest.probability >= 0.75) {
    if (isPlayLabel(currentLabel)) {
      if (!cameraGestureState.musicPlaying) {
        try {
          await music.play();
          cameraGestureState.musicPlaying = true;
          addTerminalMessage("Detected play signal: playing music");
          speak("Playing music");
        } catch (error) {
          console.warn("Music playback failed:", error);
          addTerminalMessage("Music playback blocked by browser autoplay policy.");
        }
      }
    } else if (isStopLabel(currentLabel)) {
      if (cameraGestureState.musicPlaying) {
        music.pause();
        cameraGestureState.musicPlaying = false;
        addTerminalMessage("Detected stop signal: music paused");
        speak("Stopping music");
      }
    }
  }
}

/* SNAPSHOT */

function captureSnapshot(){

  if(!videoElement){

    alert(
      "Start Camera AI first!"
    );

    return;
  }

  const snapshotCanvas = webcam && webcam.canvas ? webcam.canvas : document.createElement("canvas");
  const width = videoElement.videoWidth || 640;
  const height = videoElement.videoHeight || 480;

  if (!webcam || !webcam.canvas) {
    snapshotCanvas.width = width;
    snapshotCanvas.height = height;
    const ctx = snapshotCanvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0, width, height);
  }

  const link =
  document.createElement("a");

  link.download =
  "lumina_scan.png";

  link.href =
  snapshotCanvas.toDataURL();

  link.click();

  addTerminalMessage(
    "Snapshot captured"
  );

  speak(
    "Snapshot captured"
  );
}

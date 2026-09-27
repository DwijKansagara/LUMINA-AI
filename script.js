const imageURL = new URL("models/image/", window.location.href).href;
const audioURL = new URL("models/audio/", window.location.href).href;

const elements = {
  warning: document.getElementById("support-warning"),
  clock: document.getElementById("clock"),
  mode: document.getElementById("modeText"),
  prediction: document.getElementById("predictionText"),
  confidence: document.getElementById("confidenceText"),
  terminal: document.getElementById("terminalBody"),
  webcam: document.getElementById("webcam-container"),
  cameraBox: document.querySelector(".camera-box"),
  voiceButton: document.getElementById("voiceAiBtn"),
  cameraButton: document.getElementById("cameraAiBtn"),
  stopButton: document.getElementById("stopAiBtn"),
  captureButton: document.getElementById("captureBtn")
};

const music = {
  context: null,
  gain: null,
  oscillators: [],
  async play() {
    if (this.oscillators.length) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Web Audio is unavailable in this browser.");
    this.context = this.context || new AudioContext();
    await this.context.resume();
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.035;
    this.gain.connect(this.context.destination);
    this.oscillators = [110, 164.81].map(frequency => {
      const oscillator = this.context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(this.gain);
      oscillator.start();
      return oscillator;
    });
  },
  pause() {
    this.oscillators.forEach(oscillator => oscillator.stop());
    this.oscillators = [];
    if (this.gain) this.gain.disconnect();
    this.gain = null;
  }
};

let voiceRecognizer = null;
let imageModel = null;
let videoElement = null;
let mediaStream = null;
let animationFrameId = null;
let predictionCanvas = null;
let lastCameraLabel = "";
let cameraMusicPlaying = false;

function addTerminalMessage(text) {
  const item = document.createElement("p");
  item.textContent = `> ${text}`;
  elements.terminal.appendChild(item);
  elements.terminal.scrollTop = elements.terminal.scrollHeight;
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  elements.warning.textContent = message;
  elements.warning.classList.remove("hidden");
  addTerminalMessage(`Error: ${message}`);
}

function clearError() {
  elements.warning.textContent = "";
  elements.warning.classList.add("hidden");
}

function setStatus(mode, prediction = "WAITING", confidence = "0%") {
  elements.mode.textContent = mode;
  elements.prediction.textContent = prediction;
  elements.confidence.textContent = confidence;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function isPlayLabel(label) {
  const value = label.toLowerCase();
  return value.includes("play") || value.includes("music") || value.includes("thumbs up");
}

function isStopLabel(label) {
  const value = label.toLowerCase();
  return value.includes("stop") || value.includes("pause") || value.includes("thumbs down");
}

async function validateModelFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model file could not be loaded (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    const text = await response.text();
    try { JSON.parse(text); } catch { throw new Error("A model JSON file returned invalid content."); }
  }
}

async function stopActiveMode({ announce = true } = {}) {
  if (voiceRecognizer?.isListening?.()) {
    await voiceRecognizer.stopListening();
  }
  voiceRecognizer = null;

  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;

  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  mediaStream = null;
  videoElement = null;
  predictionCanvas = null;
  lastCameraLabel = "";
  cameraMusicPlaying = false;
  music.pause();

  elements.webcam.innerHTML = '<p class="camera-empty">Camera preview appears here after permission is granted.</p>';
  elements.cameraBox.classList.remove("active");
  setStatus("NONE");
  if (announce) addTerminalMessage("Active mode stopped.");
}

async function startVoiceMode() {
  clearError();
  await stopActiveMode({ announce: false });
  setStatus("VOICE", "LOADING");
  elements.voiceButton.disabled = true;

  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this browser.");
    if (!window.speechCommands) throw new Error("The speech model library did not load.");

    await validateModelFile(`${audioURL}model.json`);
    voiceRecognizer = window.speechCommands.create(
      "BROWSER_FFT",
      undefined,
      `${audioURL}model.json`,
      `${audioURL}metadata.json`
    );
    await voiceRecognizer.ensureModelLoaded();
    const labels = voiceRecognizer.wordLabels();
    addTerminalMessage(`Voice model ready: ${labels.join(", ")}`);

    voiceRecognizer.listen(result => {
      const scores = Array.from(result.scores);
      const maxScore = Math.max(...scores);
      const label = labels[scores.indexOf(maxScore)] || "Unknown";
      setStatus("VOICE", label, `${Math.round(maxScore * 100)}%`);

      if (maxScore >= 0.75 && isPlayLabel(label)) {
        void music.play().catch(() => showError(new Error("Audio playback was blocked. Select the page and try again.")));
      } else if (maxScore >= 0.75 && isStopLabel(label)) {
        music.pause();
      }
    }, { probabilityThreshold: 0.75, overlapFactor: 0.5 });

    setStatus("VOICE", "LISTENING");
    addTerminalMessage("Voice mode started. Microphone samples stay in this browser tab.");
    speak("Voice mode started");
  } catch (error) {
    await stopActiveMode({ announce: false });
    showError(error);
  } finally {
    elements.voiceButton.disabled = false;
  }
}

async function startCameraMode() {
  clearError();
  await stopActiveMode({ announce: false });
  setStatus("CAMERA", "LOADING");
  elements.cameraButton.disabled = true;

  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this browser.");
    if (!window.tmImage) throw new Error("The image model library did not load.");

    await validateModelFile(`${imageURL}model.json`);
    imageModel = await window.tmImage.load(`${imageURL}model.json`, `${imageURL}metadata.json`);
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

    videoElement = document.createElement("video");
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.srcObject = mediaStream;
    elements.webcam.replaceChildren(videoElement);
    elements.cameraBox.classList.add("active");
    await videoElement.play();

    predictionCanvas = document.createElement("canvas");
    predictionCanvas.width = 224;
    predictionCanvas.height = 224;
    setStatus("CAMERA", "ANALYSING");
    addTerminalMessage("Camera mode started. Frames stay in this browser tab.");
    speak("Camera mode started");
    animationFrameId = requestAnimationFrame(cameraLoop);
  } catch (error) {
    await stopActiveMode({ announce: false });
    showError(error);
  } finally {
    elements.cameraButton.disabled = false;
  }
}

async function cameraLoop() {
  if (!videoElement || !predictionCanvas || !imageModel) return;
  try {
    if (videoElement.readyState >= 2) {
      const context = predictionCanvas.getContext("2d");
      context.drawImage(videoElement, 0, 0, 224, 224);
      const predictions = await imageModel.predict(predictionCanvas);
      const highest = predictions.reduce((best, item) => item.probability > best.probability ? item : best, predictions[0]);
      if (highest) {
        const label = highest.className || "Unknown";
        setStatus("CAMERA", label, `${Math.round(highest.probability * 100)}%`);
        if (label !== lastCameraLabel) {
          addTerminalMessage(`Camera prediction: ${label}`);
          lastCameraLabel = label;
        }

        if (highest.probability >= 0.75 && isPlayLabel(label) && !cameraMusicPlaying) {
          await music.play();
          cameraMusicPlaying = true;
        } else if (highest.probability >= 0.75 && isStopLabel(label) && cameraMusicPlaying) {
          music.pause();
          cameraMusicPlaying = false;
        }
      }
    }
  } catch (error) {
    showError(error);
  }
  animationFrameId = requestAnimationFrame(cameraLoop);
}

function saveSnapshot() {
  if (!videoElement || videoElement.readyState < 2) {
    showError(new Error("Start camera mode before saving a snapshot."));
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  canvas.getContext("2d").drawImage(videoElement, 0, 0);
  const link = document.createElement("a");
  link.download = "lumina-snapshot.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  addTerminalMessage("Snapshot saved to this device.");
}

function checkBrowserSupport() {
  const missing = [];
  if (!("speechSynthesis" in window)) missing.push("speech output");
  if (!navigator.mediaDevices?.getUserMedia) missing.push("camera and microphone access");
  if (missing.length) showError(new Error(`This browser does not support ${missing.join(" or ")}.`));
}

setInterval(() => {
  elements.clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}, 1000);
elements.clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

elements.voiceButton.addEventListener("click", () => void startVoiceMode());
elements.cameraButton.addEventListener("click", () => void startCameraMode());
elements.stopButton.addEventListener("click", () => void stopActiveMode());
elements.captureButton.addEventListener("click", saveSnapshot);
window.addEventListener("beforeunload", () => {
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
});

checkBrowserSupport();

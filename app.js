import { createInitialState, stepGame, handToPaddleY } from "./src/gameEngine.js";
import { createOneEuro } from "./src/oneEuro.js";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const HAND_MODEL_TIMEOUT_MS = 12000;

const elements = {
  canvas: document.getElementById("gameCanvas"),
  playerScore: document.getElementById("playerScore"),
  cpuScore: document.getElementById("cpuScore"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  keyboardBtn: document.getElementById("keyboardBtn"),
  resetBtn: document.getElementById("resetBtn"),
  difficultySelect: document.getElementById("difficultySelect"),
  modeLabel: document.getElementById("modeLabel"),
  statusLabel: document.getElementById("statusLabel"),
  previewVideo: document.getElementById("previewVideo"),
  previewCanvas: document.getElementById("previewCanvas"),
  matchOverlay: document.getElementById("matchOverlay"),
  winnerLabel: document.getElementById("winnerLabel"),
  playAgainBtn: document.getElementById("playAgainBtn"),
};

const context = elements.canvas.getContext("2d");
const previewContext = elements.previewCanvas.getContext("2d", { willReadFrequently: true });

const appState = {
  game: createInitialState({ width: GAME_WIDTH, height: GAME_HEIGHT }),
  lastFrameAt: 0,
  keyState: {
    up: false,
    down: false,
  },
  controlMode: "keyboard",
  stream: null,
  handModel: null,
  handY: null,
  modelLoading: false,
  // Fingertip landmarks shake by a few pixels every frame. A 1€ filter
  // (Casiez et al., CHI 2012) smooths that while the hand is still and
  // keeps up when it moves fast.
  handFilter: createOneEuro({ minCutoff: 1.2, beta: 4 }),
};

function setStatus(message) {
  elements.statusLabel.textContent = message;
}

function setMode(mode) {
  appState.controlMode = mode;
  elements.modeLabel.textContent = `Mode: ${mode}`;
}

function setOverlay(mode, winner = "") {
  if (mode === "gameover") {
    elements.winnerLabel.textContent = `${winner} Wins`;
    elements.matchOverlay.hidden = false;
    return;
  }

  elements.matchOverlay.hidden = true;
}

function resetTransientRuntime() {
  appState.lastFrameAt = 0;
  appState.keyState.up = false;
  appState.keyState.down = false;
  appState.handY = null;
}

function drawCenterLine() {
  context.save();
  context.setLineDash([12, 12]);
  context.strokeStyle = "rgba(0, 0, 0, 0.15)";
  context.beginPath();
  context.moveTo(GAME_WIDTH / 2, 0);
  context.lineTo(GAME_WIDTH / 2, GAME_HEIGHT);
  context.stroke();
  context.restore();
}

function drawGame() {
  const { game } = appState;

  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  context.fillStyle = "rgba(255,255,255,0.3)";
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  drawCenterLine();

  context.fillStyle = "#113b2f";
  context.fillRect(game.player.x, game.player.y, game.player.width, game.player.height);
  context.fillRect(game.cpu.x, game.cpu.y, game.cpu.width, game.cpu.height);

  context.fillStyle = "#f1543f";
  context.beginPath();
  context.arc(game.ball.x, game.ball.y, game.ball.radius, 0, Math.PI * 2);
  context.fill();

  elements.playerScore.textContent = String(game.player.score);
  elements.cpuScore.textContent = String(game.cpu.score);

  if (game.isGameOver) {
    setOverlay("gameover", game.winner || "CPU");
  } else {
    setOverlay("none");
  }
}

function getKeyboardPlayerY(dt) {
  const speed = 520;
  const direction = (appState.keyState.down ? 1 : 0) - (appState.keyState.up ? 1 : 0);
  if (direction === 0) {
    return appState.game.player.y;
  }

  return appState.game.player.y + direction * speed * dt;
}

function getHandPlayerY() {
  if (!Number.isFinite(appState.handY)) {
    return appState.game.player.y;
  }

  return handToPaddleY(appState.handY, { height: GAME_HEIGHT, paddleHeight: appState.game.player.height });
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(label));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function drawPreviewFrame() {
  if (!appState.stream || elements.previewVideo.readyState < 2) {
    return;
  }

  previewContext.drawImage(
    elements.previewVideo,
    0,
    0,
    elements.previewCanvas.width,
    elements.previewCanvas.height,
  );
}

function updateHandTracking() {
  if (!appState.handModel || !appState.stream || appState.controlMode !== "hand") {
    drawPreviewFrame();
    return;
  }

  if (elements.previewVideo.readyState < 2) {
    return;
  }

  try {
    const now = performance.now();
    const result = appState.handModel.detectForVideo(elements.previewVideo, now);

    drawPreviewFrame();

    if (result.landmarks?.length) {
      const indexTip = result.landmarks[0][8];
      appState.handY = appState.handFilter.filter(indexTip.y, now);

      previewContext.fillStyle = "#f1543f";
      previewContext.beginPath();
      previewContext.arc(
        (1 - indexTip.x) * elements.previewCanvas.width,
        indexTip.y * elements.previewCanvas.height,
        6,
        0,
        Math.PI * 2,
      );
      previewContext.fill();
      return;
    }

    appState.handY = null;
    appState.handFilter.reset();
  } catch (error) {
    console.error(error);
    enableKeyboardMode("Tracking error. Switched to keyboard mode.");
  }
}

function animate(timestamp) {
  if (!appState.lastFrameAt) {
    appState.lastFrameAt = timestamp;
  }

  const dt = Math.min((timestamp - appState.lastFrameAt) / 1000, 0.033);
  appState.lastFrameAt = timestamp;

  updateHandTracking();

  const playerY = appState.controlMode === "hand" ? getHandPlayerY() : getKeyboardPlayerY(dt);

  appState.game = stepGame(appState.game, { dt, playerY, difficulty: elements.difficultySelect.value });
  drawGame();

  requestAnimationFrame(animate);
}

async function loadHandModel() {
  if (appState.handModel || appState.modelLoading) {
    return appState.handModel;
  }

  appState.modelLoading = true;
  setStatus("Loading hand tracking model...");

  try {
    const modelPromise = (async () => {
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );

      return vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        },
        numHands: 1,
        runningMode: "VIDEO",
        minHandDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();

    appState.handModel = await withTimeout(
      modelPromise,
      HAND_MODEL_TIMEOUT_MS,
      "Hand model load timed out",
    );

    setStatus("Model ready. Raise one hand in frame.");
    return appState.handModel;
  } catch (error) {
    console.error(error);
    setStatus("Hand model failed. Keyboard mode remains active.");
    return null;
  } finally {
    appState.modelLoading = false;
  }
}

async function ensureStream() {
  if (appState.stream) {
    return appState.stream;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 360 },
      facingMode: "user",
    },
    audio: false,
  });

  appState.stream = stream;
  elements.previewVideo.srcObject = stream;
  await elements.previewVideo.play();

  return stream;
}

async function enableHandControl() {
  const model = await loadHandModel();
  if (!model) {
    setMode("keyboard");
    return;
  }

  try {
    await ensureStream();
    setMode("hand");
    setStatus("Gesture mode live. Track your index finger vertically.");
  } catch (error) {
    console.error(error);
    setMode("keyboard");
    setStatus("Camera permission denied. Keyboard mode active.");
  }
}

function stopStream() {
  if (!appState.stream) {
    return;
  }

  appState.stream.getTracks().forEach((track) => track.stop());
  appState.stream = null;
  elements.previewVideo.srcObject = null;
}

function enableKeyboardMode(statusMessage = "Keyboard mode active. Use W/S or Arrow Up/Down.") {
  setMode("keyboard");
  setStatus(statusMessage);
}

function resetMatch() {
  appState.game = createInitialState({ width: GAME_WIDTH, height: GAME_HEIGHT });
  resetTransientRuntime();
  setOverlay("none");
  drawGame();
}

elements.startCameraBtn.addEventListener("click", enableHandControl);
elements.keyboardBtn.addEventListener("click", () => {
  stopStream();
  enableKeyboardMode();
});
elements.resetBtn.addEventListener("click", resetMatch);

const DIFFICULTY_KEY = "gesture-pong:difficulty";
try {
  const saved = localStorage.getItem(DIFFICULTY_KEY);
  if (saved && [...elements.difficultySelect.options].some((o) => o.value === saved)) {
    elements.difficultySelect.value = saved;
  }
} catch {}
elements.difficultySelect.addEventListener("change", () => {
  try {
    localStorage.setItem(DIFFICULTY_KEY, elements.difficultySelect.value);
  } catch {}
  elements.difficultySelect.blur();
  resetMatch();
});
elements.playAgainBtn.addEventListener("click", resetMatch);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    // The arrows move the paddle, not the page.
    event.preventDefault();
  }

  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
    appState.keyState.up = true;
  }

  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
    appState.keyState.down = true;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
    appState.keyState.up = false;
  }

  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
    appState.keyState.down = false;
  }
});

window.addEventListener("beforeunload", () => {
  stopStream();
});

drawGame();
requestAnimationFrame(animate);

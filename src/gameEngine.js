export const GAME_DIMENSIONS = {
  width: 960,
  height: 540,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomVerticalSpeed() {
  return (Math.random() * 2 - 1) * 230;
}

function createBall(width, height, direction = 1) {
  return {
    x: width / 2,
    y: height / 2,
    radius: 9,
    vx: 360 * direction,
    vy: randomVerticalSpeed(),
  };
}

export function createInitialState({ width = GAME_DIMENSIONS.width, height = GAME_DIMENSIONS.height, winningScore = 7 } = {}) {
  const paddleHeight = 96;

  return {
    width,
    height,
    winningScore,
    player: {
      x: 20,
      y: height / 2 - paddleHeight / 2,
      width: 14,
      height: paddleHeight,
      score: 0,
    },
    cpu: {
      x: width - 34,
      y: height / 2 - paddleHeight / 2,
      width: 14,
      height: paddleHeight,
      score: 0,
    },
    ball: createBall(width, height, Math.random() > 0.5 ? 1 : -1),
    isGameOver: false,
    winner: null,
    serveMs: 0,
  };
}

// After a point the ball waits in the middle this long, so the player can
// get their hand back to the centre before it comes at them.
export const SERVE_PAUSE_MS = 900;

function paddleBounce(ball, paddle, direction) {
  const paddleCenter = paddle.y + paddle.height / 2;
  const normalizedOffset = (ball.y - paddleCenter) / (paddle.height / 2);
  const cappedOffset = clamp(normalizedOffset, -1, 1);
  const speed = Math.min(860, Math.hypot(ball.vx, ball.vy) * 1.04 + 20);

  return {
    ...ball,
    vx: Math.abs(speed * direction),
    vy: clamp(ball.vy + cappedOffset * 260, -460, 460),
  };
}

function overlapsY(ball, paddle) {
  return ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height;
}

// Did the ball's leading edge cross the paddle's face during this step?
// At top speed the ball moves 860 px/s; a 30 fps frame is 28 px, more than
// the 14 px paddle plus the ball, so checking only the end position let
// fast balls pass straight through. This checks the path instead, and finds
// where along it the ball was when it reached the face.
function sweptHit(prev, ball, paddle, faceX, direction) {
  const prevEdge = prev.x + prev.radius * -direction;
  const edge = ball.x + ball.radius * -direction;
  const crossed = direction > 0 ? prevEdge >= faceX && edge <= faceX : prevEdge <= faceX && edge >= faceX;
  if (!crossed || prevEdge === edge) {
    return null;
  }
  const t = (prevEdge - faceX) / (prevEdge - edge);
  const y = prev.y + (ball.y - prev.y) * t;
  return overlapsY({ y, radius: ball.radius }, paddle) ? y : null;
}

function cloneState(state) {
  return {
    ...state,
    player: { ...state.player },
    cpu: { ...state.cpu },
    ball: { ...state.ball },
  };
}

export function stepGame(state, { dt = 1 / 60, playerY, aiSkill = 0.94 } = {}) {
  if (state.isGameOver) {
    return state;
  }

  const next = cloneState(state);

  if (Number.isFinite(playerY)) {
    next.player.y = clamp(playerY, 0, next.height - next.player.height);
  }

  if (next.serveMs > 0) {
    next.serveMs = Math.max(0, next.serveMs - dt * 1000);
    return next;
  }

  const prev = { ...next.ball };

  const aiTarget = next.ball.y - next.cpu.height / 2;
  const aiDelta = clamp(aiTarget - next.cpu.y, -1, 1);
  next.cpu.y = clamp(next.cpu.y + aiDelta * dt * (420 * aiSkill), 0, next.height - next.cpu.height);

  next.ball.x += next.ball.vx * dt;
  next.ball.y += next.ball.vy * dt;

  if (next.ball.y - next.ball.radius <= 0) {
    next.ball.y = next.ball.radius;
    next.ball.vy = Math.abs(next.ball.vy);
  }

  if (next.ball.y + next.ball.radius >= next.height) {
    next.ball.y = next.height - next.ball.radius;
    next.ball.vy = -Math.abs(next.ball.vy);
  }

  const playerFace = next.player.x + next.player.width;
  const playerSwept = next.ball.vx < 0 ? sweptHit(prev, next.ball, next.player, playerFace, 1) : null;
  if (
    next.ball.vx < 0 &&
    (playerSwept !== null ||
      (next.ball.x - next.ball.radius <= playerFace && next.ball.x > next.player.x && overlapsY(next.ball, next.player)))
  ) {
    if (playerSwept !== null) {
      next.ball.y = playerSwept;
    }
    next.ball.x = playerFace + next.ball.radius;
    next.ball = paddleBounce(next.ball, next.player, 1);
  }

  const cpuSwept = next.ball.vx > 0 ? sweptHit(prev, next.ball, next.cpu, next.cpu.x, -1) : null;
  if (
    next.ball.vx > 0 &&
    (cpuSwept !== null ||
      (next.ball.x + next.ball.radius >= next.cpu.x && next.ball.x < next.cpu.x + next.cpu.width && overlapsY(next.ball, next.cpu)))
  ) {
    if (cpuSwept !== null) {
      next.ball.y = cpuSwept;
    }
    next.ball.x = next.cpu.x - next.ball.radius;
    next.ball = paddleBounce(next.ball, next.cpu, -1);
  }

  if (next.ball.x + next.ball.radius < 0) {
    next.cpu.score += 1;
    next.ball = createBall(next.width, next.height, -1);
    next.serveMs = SERVE_PAUSE_MS;
  }

  if (next.ball.x - next.ball.radius > next.width) {
    next.player.score += 1;
    next.ball = createBall(next.width, next.height, 1);
    next.serveMs = SERVE_PAUSE_MS;
  }

  if (next.player.score >= next.winningScore) {
    next.isGameOver = true;
    next.winner = "You";
  }

  if (next.cpu.score >= next.winningScore) {
    next.isGameOver = true;
    next.winner = "CPU";
  }

  return next;
}

// Map the fingertip's height in the camera frame (0 top, 1 bottom) to the
// paddle's top edge. Nobody can hold a finger at the very edge of the frame
// without it dropping out of view, so the middle band of the frame (15% to
// 85% by default) covers the whole court.
export function handToPaddleY(handY, { height, paddleHeight, band = [0.15, 0.85] }) {
  const t = clamp((handY - band[0]) / (band[1] - band[0]), 0, 1);
  return t * (height - paddleHeight);
}

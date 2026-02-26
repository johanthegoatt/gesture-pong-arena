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
  };
}

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

  if (
    next.ball.vx < 0 &&
    next.ball.x - next.ball.radius <= next.player.x + next.player.width &&
    next.ball.x > next.player.x &&
    overlapsY(next.ball, next.player)
  ) {
    next.ball.x = next.player.x + next.player.width + next.ball.radius;
    next.ball = paddleBounce(next.ball, next.player, 1);
  }

  if (
    next.ball.vx > 0 &&
    next.ball.x + next.ball.radius >= next.cpu.x &&
    next.ball.x < next.cpu.x + next.cpu.width &&
    overlapsY(next.ball, next.cpu)
  ) {
    next.ball.x = next.cpu.x - next.ball.radius;
    next.ball = paddleBounce(next.ball, next.cpu, -1);
  }

  if (next.ball.x + next.ball.radius < 0) {
    next.cpu.score += 1;
    next.ball = createBall(next.width, next.height, -1);
  }

  if (next.ball.x - next.ball.radius > next.width) {
    next.player.score += 1;
    next.ball = createBall(next.width, next.height, 1);
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

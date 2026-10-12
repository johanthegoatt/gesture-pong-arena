import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, stepGame } from "../src/gameEngine.js";

test("createInitialState sets baseline dimensions and scores", () => {
  const state = createInitialState({ width: 900, height: 500, winningScore: 5 });

  assert.equal(state.width, 900);
  assert.equal(state.height, 500);
  assert.equal(state.player.score, 0);
  assert.equal(state.cpu.score, 0);
  assert.equal(state.winningScore, 5);
});

test("ball bounces off top wall", () => {
  const state = createInitialState();
  state.ball.y = 4;
  state.ball.vy = -240;

  const next = stepGame(state, { dt: 0.016, playerY: state.player.y });
  assert.ok(next.ball.vy > 0, `expected positive vertical velocity, got ${next.ball.vy}`);
});

test("ball bounces from player paddle", () => {
  const state = createInitialState();
  state.ball.x = state.player.x + state.player.width + state.ball.radius - 1;
  state.ball.y = state.player.y + state.player.height / 2;
  state.ball.vx = -320;
  state.ball.vy = 0;

  const next = stepGame(state, { dt: 0.016, playerY: state.player.y });
  assert.ok(next.ball.vx > 0, `expected rightward bounce, got ${next.ball.vx}`);
});

test("cpu score increments when ball exits left", () => {
  const state = createInitialState();
  state.ball.x = -20;
  state.ball.vx = -300;

  const next = stepGame(state, { dt: 0.016, playerY: state.player.y });
  assert.equal(next.cpu.score, 1);
  assert.equal(next.player.score, 0);
  assert.equal(next.ball.x, next.width / 2);
});

test("game ends when winning score is reached", () => {
  const state = createInitialState({ winningScore: 1 });
  state.ball.x = state.width + 20;
  state.ball.vx = 320;

  const next = stepGame(state, { dt: 0.016, playerY: state.player.y });
  assert.equal(next.player.score, 1);
  assert.equal(next.isGameOver, true);
  assert.equal(next.winner, "You");
});

test("a fast ball cannot pass through the paddle between frames", () => {
  const state = createInitialState();
  const face = state.player.x + state.player.width;
  // Leading edge 4 px in front of the paddle, moving 860 px/s at 30 fps:
  // the next end position is already behind the paddle's back edge.
  state.ball.x = face + state.ball.radius + 4;
  state.ball.y = state.player.y + state.player.height / 2;
  state.ball.vx = -860;
  state.ball.vy = 0;

  const next = stepGame(state, { dt: 1 / 30, playerY: state.player.y });
  assert.ok(next.ball.vx > 0, `expected a bounce, got vx ${next.ball.vx}`);
  assert.equal(next.cpu.score, 0);
});

test("a fast ball that misses the paddle still goes past", () => {
  const state = createInitialState();
  state.ball.x = state.player.x + state.player.width + state.ball.radius + 4;
  state.ball.y = 20;
  state.player.y = 400;
  state.ball.vx = -860;
  state.ball.vy = 0;

  const next = stepGame(state, { dt: 1 / 30, playerY: 400 });
  assert.ok(next.ball.vx < 0);
});

test("the ball waits in the middle after a point", () => {
  const state = createInitialState();
  state.ball.x = -20;
  state.ball.vx = -300;

  let next = stepGame(state, { dt: 0.016, playerY: state.player.y });
  assert.equal(next.cpu.score, 1);
  next = stepGame(next, { dt: 0.5, playerY: next.player.y });
  assert.equal(next.ball.x, next.width / 2);
  next = stepGame(next, { dt: 0.5, playerY: next.player.y });
  next = stepGame(next, { dt: 0.016, playerY: next.player.y });
  assert.notEqual(next.ball.x, next.width / 2);
});

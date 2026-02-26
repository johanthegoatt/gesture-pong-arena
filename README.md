# Gesture Pong Arena

## Description
Gesture Pong Arena is a webcam-powered Pong experience with MediaPipe hand tracking and a keyboard fallback mode.

## Features
- Real-time Pong gameplay rendered on canvas
- Hand-based paddle control using MediaPipe Hand Landmarker
- Keyboard fallback controls (`W/S` or arrow keys)
- Match scoring with win overlay and replay flow
- Hardened overlay visibility + reset logic to prevent stuck game-over state
- Live webcam preview with tracked fingertip marker
- Unit-tested game simulation engine
- Static Vercel-ready deployment setup

## Run
```bash
cd gesture-pong-arena
npm run dev
```
Open `http://127.0.0.1:8102/gesture-pong-arena/index.html`.

## Test
```bash
cd gesture-pong-arena
npm test
```

## Deploy (Vercel)
```bash
cd gesture-pong-arena
npx vercel --prod
```

## Inspiration Repos
- https://github.com/collidingScopes/manual-brick-breaker
- https://github.com/collidingScopes/threejs-handtracking-101
- https://github.com/google-ai-edge/mediapipe

## Project Structure
```text
gesture-pong-arena/
  index.html
  styles.css
  app.js
  src/
    gameEngine.js
  tests/
    gameEngine.test.js
  package.json
  vercel.json
  README.md
```

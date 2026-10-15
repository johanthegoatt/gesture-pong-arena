# Gesture Pong Arena

## Description
Gesture Pong Arena is a webcam-powered Pong experience with MediaPipe hand tracking and a keyboard fallback mode.

## Features
- Real-time Pong gameplay rendered on canvas
- Hand-based paddle control using MediaPipe Hand Landmarker; the middle 70% of the camera frame covers the whole court, and the fingertip is smoothed with a 1€ filter (Casiez et al., CHI 2012)
- Swept paddle collisions, so a ball at top speed (28 px per frame at 30 fps) can't slip through a 14 px paddle
- A short pause before each serve
- CPU on easy, normal or hard: it aims where the ball will cross its side (walls included), misjudges by a set margin each rally and reacts after a short delay
- Keyboard fallback controls (`W/S` or arrow keys), or drag on the court with a finger or mouse
- `P` pauses; switching tabs or windows pauses on its own
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
Open the URL `npm run dev` prints.

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

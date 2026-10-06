# Mock AI Web

Responsive student web application for the Mock AI IELTS platform. It supports
email, Google, and Telegram authentication; Listening and Reading exam flows;
answer autosaving; results; history; progress summaries; Writing Task 2 feedback;
and three-part Speaking interviews with regional examiner voices and audio-based reports.

## Development

Requirements: Node.js 22 or newer.

```sh
npm ci
npm run dev
```

The development server proxies `/api` and `/healthz` to
`http://localhost:8080`. In production, Nginx serves the static build and
proxies those paths to the API.

## Build

```sh
npm run build
npm run preview
```

The production output is written to `dist/`.

## Speaking and verification

Speaking is accessible from the desktop sidebar, Practice, Home, and the profile
menu. It requires HTTPS (localhost is permitted), microphone permission and a
browser supporting MediaRecorder and AudioContext. The browser converts captured
audio to bounded 16 kHz mono WAV before authenticated upload. Saved answers resume
after refresh; unfinished recordings do not. AI scores are practice estimates.

```sh
npm test
npm run build
npm run test:e2e
```

Playwright uses a real local backend/database for the student journey and mobile
Speaking discovery. The live interview test is opt-in because it calls Gemini:

```sh
SPEAKING_LIVE_E2E=1 SPEAKING_AUDIO_FIXTURE=/absolute/speech.wav npm run test:e2e -- e2e/speaking.spec.ts
```

Use an isolated backend configured with provider credentials, never a student's
account. The live test feeds synthetic speech through Chromium's MediaRecorder,
records all 11 turns, resumes, requests a real report, plays saved audio and deletes
the interview. A repeated fixture can legitimately produce an unassessable report.
The backend has a separate opt-in distinct-answer test for real scored reports.
Synthetic tests verify functionality, not human accent/scoring calibration.
Physical Telegram iOS/Android microphone permission checks must be done on-device.
API keys remain server-side; the frontend needs no Gemini secret.

## Deployment

Pushes to `main` run the frontend workflow, publish an immutable image to GHCR,
and deploy it to the VPS on `127.0.0.1:8082`. Host Nginx proxies the two public
domains to that container and sends `/api/` requests to the backend on port
`8081`.

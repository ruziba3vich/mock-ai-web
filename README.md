# Mock AI Web

Responsive student web application for the Mock AI IELTS platform. It supports
email, Google, and Telegram authentication; Listening and Reading exam flows;
answer autosaving; results; history; and progress summaries.

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

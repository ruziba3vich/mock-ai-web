import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./AdminApp";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/onest";
import "@fontsource-variable/source-serif-4";
import "./theme.css";
import "./styles/base.css";
import "./styles/poster.css";
import "./styles/home.css";
import "./styles/exam.css";
import "./styles/report.css";
import "./styles/account.css";
import "./styles/admin.css";
import { initializeTelegramViewport } from "./telegramViewport";

initializeTelegramViewport();

/**
 * Where each retired host now lives.
 *
 * These still resolve and still serve, but the API matches one exact Origin
 * for the student app and one for the panel. That made the old hosts worse
 * than offline: reads succeeded, writes came back "Admin requests must
 * originate from the admin panel", and a student's speaking failed the same
 * way. Forwarding is the honest behaviour -- the app moved.
 */
const MOVED: Record<string, string> = {
  "mockai.admin.chessinsight.uz": "panel.mock-ai.uz",
  "mock.web.chessinsight.uz": "mock-ai.uz",
};

const moved = MOVED[window.location.hostname];
if (moved && moved !== window.location.hostname) {
  window.location.replace(`https://${moved}${window.location.pathname}${window.location.search}${window.location.hash}`);
}

/** Hosts that serve the admin panel instead of the student app. */
const ADMIN_HOSTS = new Set(["panel.mock-ai.uz"]);

function isAdminHost() {
  const { hostname, pathname } = window.location;
  if (ADMIN_HOSTS.has(hostname)) return true;
  // Local development serves both from one origin, so the path chooses.
  return ["localhost", "127.0.0.1"].includes(hostname) && pathname === "/admin";
}

// The panel shares this index.html, so it must opt out of search results
// itself; otherwise Google could list the admin sign-in for "mock ai".
if (isAdminHost()) {
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  document.querySelector('meta[name="robots"]')?.remove();
  document.head.appendChild(robots);
  document.title = "Mock AI — Admin panel";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdminHost() ? <AdminApp /> : <App />}
  </StrictMode>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./AdminApp";
import "./theme.css";
import "@fontsource-variable/archivo";
import "./styles.css";
import "./mobile.css";
import "./world.css";
import { initializeTelegramViewport } from "./telegramViewport";

initializeTelegramViewport();

/**
 * Hosts that serve the admin panel instead of the student app.
 *
 * The old chessinsight host stays listed until its DNS is retired: both
 * resolve to the same server, and dropping it here would take the panel
 * offline for anyone still using the old link.
 */
const ADMIN_HOSTS = new Set(["panel.mock-ai.uz", "mockai.admin.chessinsight.uz"]);

function isAdminHost() {
  const { hostname, pathname } = window.location;
  if (ADMIN_HOSTS.has(hostname)) return true;
  // Local development serves both from one origin, so the path chooses.
  return ["localhost", "127.0.0.1"].includes(hostname) && pathname === "/admin";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdminHost() ? <AdminApp /> : <App />}
  </StrictMode>
);

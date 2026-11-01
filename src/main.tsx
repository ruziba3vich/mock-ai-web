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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.hostname === "mockai.admin.chessinsight.uz" || (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.pathname === "/admin") ? <AdminApp /> : <App />}
  </StrictMode>
);

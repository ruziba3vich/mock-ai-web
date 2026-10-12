import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./AdminApp";
import "./styles.css";
import "./mobile.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.hostname === "mockai.admin.chessinsight.uz" || (["localhost", "127.0.0.1"].includes(window.location.hostname) && window.location.pathname === "/admin") ? <AdminApp /> : <App />}
  </StrictMode>
);

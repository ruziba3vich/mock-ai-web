import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./auth";

export type TelegramStatus = { linked: boolean; started: boolean; results_enabled: boolean };

const BOT = (import.meta.env.VITE_TELEGRAM_BOT as string | undefined) || "mockai_bot";

export const telegramAPI = {
  status: () => apiRequest<TelegramStatus>("/api/v1/me/telegram"),
  link: () => apiRequest<{ token: string; start: string; expires_at: string }>("/api/v1/me/telegram/link", { method: "POST" }),
  setResults: (enabled: boolean) => apiRequest<TelegramStatus>("/api/v1/me/telegram/results", { method: "PUT", body: JSON.stringify({ enabled }) }),
};

/**
 * Profile card: connect Telegram and get every result there, from Reading and
 * Listening scores to Writing and Speaking reports.
 */
export default function TelegramResults({ pollMs = 3000 }: { pollMs?: number }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const stopAt = useRef(0);

  useEffect(() => {
    telegramAPI.status().then(setStatus).catch(() => setMessage("Telegram settings could not be loaded. Reopen your profile to retry."));
  }, []);

  // After the student is sent to the bot, watch for them pressing Start.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(async () => {
      if (Date.now() > stopAt.current) { setWaiting(false); return; }
      try {
        const next = await telegramAPI.status();
        if (next.linked && next.started) {
          setStatus(next); setWaiting(false);
          setMessage("Connected. Your next result will arrive in Telegram.");
        }
      } catch { /* keep waiting */ }
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [waiting, pollMs]);

  async function connect() {
    // Open the tab now, while the click still counts as a user gesture.
    const tg = window.Telegram?.WebApp;
    const tab = tg?.openTelegramLink ? null : window.open("", "_blank");
    setBusy(true); setMessage("");
    try {
      const { start } = await telegramAPI.link();
      const url = `https://t.me/${BOT}?start=${encodeURIComponent(start)}`;
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else if (tab) tab.location.href = url;
      else window.location.href = url;
      stopAt.current = Date.now() + 10 * 60_000;
      setWaiting(true);
    } catch (e) {
      tab?.close();
      setMessage(e instanceof Error ? e.message : "Telegram could not be opened. Try again.");
    } finally { setBusy(false); }
  }

  async function toggle(enabled: boolean) {
    setBusy(true); setMessage("");
    try {
      setStatus(await telegramAPI.setResults(enabled));
      setMessage(enabled ? "Results will be sent to Telegram." : "Results won’t be sent to Telegram.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The setting could not be saved.");
    } finally { setBusy(false); }
  }

  const connected = status?.linked && status.started;
  return <section className="telegram-results" aria-labelledby="telegram-results-title">
    <div className="telegram-results-head">
      <span className="telegram-results-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M21.4 4.3 2.9 11.4c-1.3.5-1.2 1.3-.2 1.6l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5Zm-3.3 3.4-8.7 7.9-.4 3.6-1.5-4.8 10.1-6.4c.5-.3.9-.1.5-.3Z"/></svg></span>
      <div>
        <h3 id="telegram-results-title">Results in Telegram</h3>
        <p>Get every score and report from @{BOT}, so you can look back at them later.</p>
      </div>
    </div>
    {!status ? (!message && <p>Loading…</p>) : connected ? (
      <label className="telegram-results-toggle">
        <input type="checkbox" checked={status.results_enabled} disabled={busy} onChange={e => void toggle(e.target.checked)} />
        <span>Send my results to Telegram<small>Reading and Listening right after you submit, Writing and Speaking when the report is ready.</small></span>
      </label>
    ) : (
      <>
        <button className="primary-action telegram-connect" disabled={busy} onClick={() => void connect()}>
          {busy ? "Opening Telegram…" : waiting ? "Open Telegram again" : "Connect Telegram"}
        </button>
        {waiting && <p className="telegram-results-wait" role="status">Press <strong>Start</strong> in the bot. This page updates by itself.</p>}
      </>
    )}
    {message && <p role="status">{message}</p>}
  </section>;
}

import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { TELEGRAM_BOT } from "./AuthScreen";
import { telegramAPI } from "./TelegramResults";

/**
 * Exam day: the student is on the centre's computer with no Telegram on it.
 * Scanning this with their own phone attaches the account to their Telegram,
 * which is how they get their results and sign in again at home.
 */
export default function ClaimResults({ pollMs = 3000 }: { pollMs?: number }) {
  const [url, setUrl] = useState("");
  const [linked, setLinked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await telegramAPI.status();
        if (!active) return;
        if (status.linked && status.started) { setLinked(true); return; }
        const { start } = await telegramAPI.link();
        if (active) setUrl(`https://t.me/${TELEGRAM_BOT}?start=${encodeURIComponent(start)}`);
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; };
  }, []);

  // Watch for the student pressing Start on their phone. The link lasts 30 minutes.
  useEffect(() => {
    if (!url || linked) return;
    const stopAt = Date.now() + 30 * 60_000;
    const timer = window.setInterval(async () => {
      if (Date.now() > stopAt) { window.clearInterval(timer); return; }
      try { const next = await telegramAPI.status(); if (next.linked && next.started) setLinked(true); } catch { /* keep waiting */ }
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [url, linked, pollMs]);

  if (linked) return <section className="claim-results" role="status"><div><h3>Your results go to your Telegram</h3><p>Scores and reports arrive from @{TELEGRAM_BOT}. Open the bot at home to sign in and review them.</p></div></section>;
  if (failed) return <section className="claim-results"><div><h3>Keep your results</h3><p>The Telegram link could not be made. Ask your centre for your results, or reload this page to try again.</p></div></section>;
  if (!url) return null;
  return <section className="claim-results" aria-labelledby="claim-results-title">
    <QR value={url} />
    <div>
      <h3 id="claim-results-title">Keep your results</h3>
      <p>Scan with your phone camera. Telegram opens @{TELEGRAM_BOT}; press <strong>Start</strong>. Your scores and reports then arrive there, and you can sign in at home.</p>
    </div>
  </section>;
}

export function QR({ value, label = "QR code that opens the mock-ai bot in Telegram" }: { value: string; label?: string }) {
  const code = qrcode(0, "M");
  code.addData(value);
  code.make();
  const n = code.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  // Margin of 4 modules: scanners need the quiet zone.
  return <svg className="claim-qr" viewBox={`-4 -4 ${n + 8} ${n + 8}`} role="img" aria-label={label} shapeRendering="crispEdges"><path d={d} /></svg>;
}

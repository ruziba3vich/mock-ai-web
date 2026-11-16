import { useEffect, useState } from "react";

/** Asks the browser for full screen. Only works from a click or key press; otherwise nothing happens. */
export const enterFullscreen = () => { void document.documentElement.requestFullscreen?.()?.catch(() => undefined); };
export const leaveFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => undefined); };

/** Full-screen switch. Renders nothing where the browser has no full screen (iPhone). */
export function FullscreenButton({ className }: { className: string }) {
  const [on, setOn] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!document.fullscreenEnabled) return null;
  return <button type="button" className={className} aria-pressed={on} aria-label={on ? "Exit full screen" : "Full screen"} title={on ? "Exit full screen" : "Full screen"} onClick={on ? leaveFullscreen : enterFullscreen}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{on ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}</svg>
  </button>;
}

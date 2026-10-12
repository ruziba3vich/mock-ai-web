import type {} from './auth';

// Native fullscreen is distinct from expand(). Unsupported clients retain the
// existing expanded layout; never retry after the user exits fullscreen.
export function initializeTelegramViewport() {
  const app = window.Telegram?.WebApp;
  if (!app?.initData) return () => {};
  const root = document.documentElement;
  const sync = () => {
    root.classList.toggle('telegram-fullscreen', Boolean(app.isFullscreen));
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      for (const [prefix, insets] of [['device', app.safeAreaInset], ['content', app.contentSafeAreaInset]] as const) {
        const value = insets?.[edge];
        root.style.setProperty(`--mini-${prefix}-${edge}`, `${typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0}px`);
      }
    }
  };
  const events = ['fullscreenChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenFailed'];
  events.forEach(event => app.onEvent?.(event, sync));
  sync();
  if (!app.isFullscreen && app.requestFullscreen && app.isVersionAtLeast?.('8.0')) {
    try { app.requestFullscreen(); } catch { /* Keep expanded mode usable. */ }
  }
  return () => {
    events.forEach(event => app.offEvent?.(event, sync));
    root.classList.remove('telegram-fullscreen');
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      root.style.removeProperty(`--mini-device-${edge}`);
      root.style.removeProperty(`--mini-content-${edge}`);
    }
  };
}

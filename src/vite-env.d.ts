/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Telegram bot username the sign-in button opens, without the leading @. */
  readonly VITE_TELEGRAM_BOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

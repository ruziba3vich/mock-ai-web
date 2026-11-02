import { createHmac } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

/**
 * Signs Telegram Mini App init data the way Telegram does, so end-to-end tests
 * authenticate through the same door students use.
 *
 * Password sign-in no longer exists, and the bot's login links are minted from
 * a private chat the tests cannot hold. Signing init data with the test bot
 * token is the remaining honest option: the server verifies it with exactly the
 * HMAC it verifies in production, so a test that passes here proves the real
 * path works rather than a seam built for testing.
 */
export const TEST_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "e2e-telegram-bot-token";

export function signInitData(user: { id: number; first_name: string; last_name?: string; username?: string }): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  };
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(TEST_BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  const query = new URLSearchParams(fields);
  query.set("hash", hash);
  return query.toString();
}

/** A distinct Telegram account per test run, so runs never share a student. */
export function uniqueStudent(name = "E2E Student") {
  const [first, ...rest] = name.split(" ");
  return {
    // Telegram IDs are positive int64; the clock keeps runs apart.
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    first_name: first,
    last_name: rest.join(" ") || undefined,
  };
}

/** Signs in a fresh student and leaves the session cookie on the context. */
export async function signInAsStudent(request: APIRequestContext, origin: string, name?: string) {
  const user = uniqueStudent(name);
  const response = await request.post("/api/v1/auth/telegram", {
    headers: { Origin: origin },
    data: { init_data: signInitData(user) },
  });
  if (response.status() !== 200) {
    throw new Error(`Telegram sign-in failed: ${response.status()} ${await response.text()}`);
  }
  return { user, body: await response.json() };
}

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { SpeakingSession } from "../src/speaking";

function canonicalWav(input: Buffer): Buffer {
  expect(input.toString("ascii", 0, 4)).toBe("RIFF");
  expect(input.toString("ascii", 8, 12)).toBe("WAVE");
  let format: Buffer | undefined, pcm: Buffer | undefined;
  for (let offset = 12; offset + 8 <= input.length;) {
    const size = input.readUInt32LE(offset + 4);
    const chunk = input.subarray(offset + 8, offset + 8 + size);
    if (input.toString("ascii", offset, offset + 4) === "fmt ") format = chunk;
    if (input.toString("ascii", offset, offset + 4) === "data") pcm = chunk;
    offset += 8 + size + size % 2;
  }
  expect(format).toBeDefined(); expect(pcm).toBeDefined();
  expect([format!.readUInt16LE(0), format!.readUInt16LE(2), format!.readUInt32LE(4), format!.readUInt16LE(14)]).toEqual([1, 1, 16000, 16]);
  const header = Buffer.alloc(44);
  header.write("RIFF"); header.writeUInt32LE(36 + pcm!.length, 4);
  header.write("WAVEfmt ", 8); header.writeUInt32LE(16, 16);
  format!.copy(header, 20, 0, 16);
  header.write("data", 36); header.writeUInt32LE(pcm!.length, 40);
  return Buffer.concat([header, pcm!]);
}

// Real API, stored recordings, evaluation workers, provider and browser UI.
// Audio is supplied through the recorded-answer API, not a live microphone.
test("real speaking evaluation displays fluency and pronunciation feedback", async ({ page }, info) => {
  test.skip(!process.env.SPEAKING_REPORT_E2E, "Opt-in: requires speech fixtures and incurs provider usage");
  test.setTimeout(1_500_000);
  const directory = process.env.SPEAKING_LIVE_FIXTURES;
  expect(directory, "Provide eleven distinct WAV speech fixtures (0.wav–10.wav)").toBeTruthy();
  const recordings = Array.from({ length: 11 }, (_, i) => canonicalWav(readFileSync(`${directory}/${i}.wav`)));
  const origin = new URL(info.project.use.baseURL!).origin;
  const email = `speaking-report-${randomUUID()}@example.test`;
  let sessionID = "";
  const headers = { Origin: origin };
  const registered = await page.request.post("/api/v1/auth/register", {
    headers, data: { display_name: "Temporary Speaking report E2E", email, password: randomUUID() + "Aa1!" }
  });
  expect(registered.status()).toBe(201);
  const { user } = await registered.json();
  console.log(`Temporary speaking E2E account: ${user.id} ${email}`);
  try {
    const created = await page.request.post("/api/v1/speaking/sessions", { headers, data: { consent: true } });
    expect(created.status()).toBe(201);
    const session: SpeakingSession = await created.json();
    sessionID = session.id;
    expect(session.turns).toHaveLength(11);
    expect(new Set(session.turns.map(t => t.part))).toEqual(new Set([1, 2, 3]));
    for (const turn of session.turns) {
      await expect.poll(async () => {
        const response = await page.request.get(`/api/v1/speaking/sessions/${sessionID}`);
        expect(response.ok()).toBeTruthy();
        const current: SpeakingSession = await response.json();
        const voice = current.turns[turn.position].voice_status;
        expect(voice, `Examiner audio ${turn.position}`).not.toBe("failed");
        return voice;
      }, { timeout: 150_000, intervals: [2000] }).toBe("ready");
      const saved = await page.request.put(`/api/v1/speaking/sessions/${sessionID}/turns/${turn.position}/answer`, {
        headers: { ...headers, "Content-Type": "audio/wav" }, data: recordings[turn.position]
      });
      expect(saved.ok(), `Save answer ${turn.position}: ${saved.status()}`).toBeTruthy();
      console.log(`Saved speaking answer ${turn.position + 1}/11`);
    }
    await page.goto("/");
    await page.getByRole("button", { name: "Practice", exact: true }).first().click();
    await page.getByRole("button", { name: /Speaking Three-part interviews/ }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: "Continue your interview" }).click();
    await page.getByRole("button", { name: "Get my speaking report" }).click();
    await expect(page.getByText(/of 3 speaking parts evaluated/)).toBeVisible();
    let completed: SpeakingSession | undefined;
    await expect.poll(async () => {
      const response = await page.request.get(`/api/v1/speaking/sessions/${sessionID}`);
      expect(response.ok()).toBeTruthy();
      completed = await response.json();
      expect(completed!.status, "Evaluation must not fail").not.toBe("failed");
      return completed!.status;
    }, { timeout: 750_000, intervals: [3000, 5000] }).toBe("completed");
    const report = completed!.report!;
    expect(report.assessable).toBe(true);
    expect(report.responses).toHaveLength(11);
    expect(report.criteria).toHaveLength(4);
    const average = report.criteria.reduce((sum, c) => sum + c.score!, 0) / 4;
    expect(report.overall).toBe(Math.round(average * 2) / 2);
    await expect(page.getByRole("heading", { name: "Listen. Notice. Improve." })).toBeVisible({ timeout: 15_000 });
    for (const [key, title] of [["fluency_coherence", "Fluency & Coherence"], ["pronunciation", "Pronunciation"]]) {
      const criterion = report.criteria.find(c => c.key === key)!;
      expect(criterion.score).toBeGreaterThanOrEqual(0);
      expect(criterion.score).toBeLessThanOrEqual(9);
      expect(criterion.score! * 2 % 1).toBe(0);
      expect(criterion.reason.trim().length).toBeGreaterThan(10);
      expect(criterion.how_to_improve.trim().length).toBeGreaterThan(10);
      const card = page.locator(".writing-criteria article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText(criterion.score!.toFixed(1));
      await expect(card).toContainText(criterion.reason);
      await expect(card).toContainText(criterion.how_to_improve);
    }
    await page.getByLabel("Review an answer").selectOption("0");
    await expect(page.locator("blockquote")).toHaveText(report.responses.find(r => r.position === 0)!.transcript);
    const audio = page.getByLabel("Recorded answer");
    await audio.evaluate(async (el: HTMLAudioElement) => { await el.play(); });
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath("speaking-report-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: info.outputPath("speaking-report-mobile.png"), fullPage: true });
    await page.reload();
    await page.getByRole("button", { name: "Practice", exact: true }).first().click();
    await page.getByRole("button", { name: /Speaking Three-part interviews/ }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("complementary", { name: "Speaking history" }).getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: "Pronunciation", exact: true })).toBeVisible();
  } finally {
    if (sessionID) {
      const removed = await page.request.delete(`/api/v1/speaking/sessions/${sessionID}`, { headers });
      expect(removed.status()).toBe(204);
      expect((await page.request.get(`/api/v1/speaking/sessions/${sessionID}`)).status()).toBe(404);
    }
  }
});

import { expect, test, type Page } from "@playwright/test";

// The recording is downloaded before a listening test starts, and the test can be put in full screen.
// Deterministic API fixtures, not backend E2E.
const exam = {
  id: "listening-1", slug: "sunday", title: "Sunday Mock Test · Listening", description: "", skill: "listening", duration_seconds: 2400, question_count: 1,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "",
  sections: [{ id: "s1", position: 1, title: "Parts 1-4", instructions: "Complete the notes.", audio_url: "/api/v1/private-media/recording", questions: [{ id: "q1", position: 1, type: "short_answer", prompt: "Question 1", points: 1, config: {}, options: [] }] }]
};

async function open(page: Page, recording: number) {
  const calls: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname, method = route.request().method();
    if (path.endsWith("/recording")) { calls.push("recording"); return route.fulfill({ status: recording, contentType: "audio/mpeg", body: Buffer.alloc(2048) }); }
    if (method === "POST" && path.endsWith("/attempts")) calls.push("attempt");
    const attempt = { id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 2_400_000).toISOString(), question_count: 1, answers: [] };
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "offline-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams/listening-1": { exam },
      "/api/v1/exams/listening-1/attempts": { attempt },
      "/api/v1/attempts/attempt-1": { attempt },
      "/api/v1/attempts/attempt-1/workspace": { flags: [], notes: {}, highlights: {} }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [], sessions: [], exams: [], attempts: [], skills: [], plan: null } });
  });
  await page.addInitScript(() => localStorage.setItem("mockai.full-mock.offline-user", JSON.stringify({
    id: "listening-1reading-1", started_at: new Date().toISOString(), stage: "listening", listening_exam_id: "listening-1", reading_exam_id: "reading-1"
  })));
  await page.goto("/");
  await page.getByRole("button", { name: "Start listening section →" }).click();
  return calls;
}

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`the recording is downloaded before the listening test starts at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const calls = await open(page, 200);
    const player = page.locator(".material audio");
    await expect(player).toHaveAttribute("src", /^blob:/); // plays from the copy in the browser, not from the network
    expect(calls).toEqual(["recording", "attempt"]); // downloaded first, so the download uses no exam time

    // Full screen can be switched on and off from the test's top bar (a phone's bar has no room for the switch).
    if (width < 800) return;
    await page.evaluate(() => document.exitFullscreen().catch(() => undefined));
    await page.getByRole("button", { name: "Full screen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`listening-fullscreen-${width}.png`) });
    await page.getByRole("button", { name: "Exit full screen" }).click();
    await expect(page.getByRole("button", { name: "Full screen", exact: true })).toBeVisible();
  });
}

test("a listening test does not start when its recording cannot be downloaded", async ({ page }) => {
  const calls = await open(page, 503);
  await expect(page.getByRole("alert")).toHaveText("The recording could not be downloaded. Check your internet connection and try again.");
  await expect(page.getByRole("button", { name: "Start listening section →" })).toBeEnabled();
  expect(calls).toEqual(["recording"]);
});

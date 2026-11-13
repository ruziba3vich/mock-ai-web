import { expect, test } from "@playwright/test";

// A Listening paper with long instructions must show its player without scrolling.
// Deterministic API fixtures, not backend E2E.
const instructions = Array.from({ length: 8 }, (_, i) => `Part ${i + 1} · Questions ${i * 5 + 1}-${i * 5 + 5}\nComplete the notes below. Write ONE WORD AND/OR A NUMBER for each answer.`).join("\n\n");
const exam = {
  id: "listening-1", slug: "sunday", title: "Sunday Mock Test · Listening", description: "", skill: "listening", duration_seconds: 2400, question_count: 10,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "",
  sections: [{ id: "s1", position: 1, title: "Parts 1-4", instructions, audio_url: "/api/v1/private-media/recording", questions: Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, position: i + 1, type: "short_answer", prompt: `Question ${i + 1}`, points: 1, config: {}, options: [] })) }]
};

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`the listening player is on screen when the paper opens at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("mockai.runner.audio-user", JSON.stringify({ exam_id: "listening-1", attempt_id: "attempt-1" })));
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const attempt = { id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 2_400_000).toISOString(), question_count: 10, answers: [] };
      const bodies: Record<string, unknown> = {
        "/api/v1/me": { user: { id: "audio-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
        "/api/v1/exams": { exams: [exam] },
        "/api/v1/exams/listening-1": { exam },
        "/api/v1/attempts/attempt-1": { attempt },
        "/api/v1/attempts/attempt-1/workspace": { flags: [], notes: {}, highlights: {} }
      };
      await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [] } });
    });
    await page.goto("/");
    const player = page.locator(".material audio");
    await expect(player).toBeVisible();
    await page.screenshot({ path: info.outputPath(`listening-${width}.png`) });
    await expect(player).toBeInViewport({ ratio: 1 });
  });
}

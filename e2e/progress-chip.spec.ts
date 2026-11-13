import { expect, test } from "@playwright/test";

// A test the student left half-way is marked "In progress" on its library card.
// The label once rendered white on white: an empty pill. Deterministic API fixtures, not backend E2E.
test("a started test's card says In progress in a colour that can be read", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "chip-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams": { exams: [{ id: "reading-1", title: "Urban Gardens", slug: "urban-gardens", skill: "reading", duration_seconds: 3600, question_count: 40 }] },
      "/api/v1/me/attempts": { attempts: [{ id: "a1", exam_version_id: "v1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 3_600_000).toISOString(), question_count: 40, answers: [], title: "Urban Gardens", skill: "reading" }] },
      "/api/v1/me/progress": { skills: [] },
      "/api/v1/me/study-plan": { plan: null }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], content: [] } });
  });
  await page.goto("/#practice");
  const chip = page.locator(".library-card").getByText("In progress");
  await expect(chip).toBeVisible();
  const [ink, paper] = await chip.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  expect(ink).not.toBe(paper);
  await chip.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("chip.png") });
});

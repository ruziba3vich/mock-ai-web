import { expect, test, type Page } from "@playwright/test";

// A reload must leave the student inside the test they started, at the same question.
// Deterministic API fixtures, not backend E2E.
const passage = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}. The zoetrope spins a strip of drawings past a row of slits.`).join("\n\n");
const question = (n: number) => ({ id: `q${n}`, position: n, type: "short_answer", prompt: `Question ${n} about the passage`, points: 1, config: {}, options: [] });
const exam = {
  id: "reading-1", slug: "zoetrope", title: "Zoetrope", description: "Reading mock", skill: "reading", duration_seconds: 3600, question_count: 26,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "Read carefully.",
  sections: [
    { id: "s1", position: 1, title: "Passage 1", instructions: "Answer.", passage, questions: Array.from({ length: 13 }, (_, i) => question(i + 1)) },
    { id: "s2", position: 2, title: "Passage 2", instructions: "Answer.", passage, questions: Array.from({ length: 13 }, (_, i) => question(i + 14)) }
  ]
};

async function mockAPI(page: Page, status: () => string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const attempt = { id: "attempt-1", exam_version_id: "version-1", status: status(), started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 3_600_000).toISOString(), question_count: 26, answers: [] };
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "refresh-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams": { exams: [exam] },
      "/api/v1/exams/reading-1": { exam },
      "/api/v1/exams/reading-1/attempts": { attempt },
      "/api/v1/attempts/attempt-1": { attempt },
      "/api/v1/attempts/attempt-1/workspace": { flags: [], notes: {}, highlights: {} },
      "/api/v1/me/attempts": { attempts: [] },
      "/api/v1/me/progress": { skills: [] },
      "/api/v1/me/study-plan": { plan: null }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [] } });
  });
}
const inView = (page: Page, selector: string) => page.locator(selector).evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`a reload keeps the student in the test at ${width}px`, async ({ page }) => {
    let status = "in_progress";
    await page.setViewportSize({ width, height });
    await mockAPI(page, () => status);
    await page.goto("/#dashboard");
    await page.getByRole("region", { name: /^Moves your/ }).getByRole("button", { name: /^Zoetrope/ }).first().click();
    await page.getByRole("button", { name: "Start timed exam" }).click();

    await page.locator("#question-q20").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 300);
    await expect(page.locator(".question.is-current")).not.toHaveId("question-q1");
    const place = await page.locator(".question.is-current").getAttribute("id");

    // Twice: the place must not drift from one reload to the next.
    for (let i = 0; i < 2; i++) {
      await page.reload();
      await expect(page.locator(".question.is-current")).toHaveId(place!);
      await expect.poll(() => inView(page, `#${place}`)).toBe(true);
    }

    // Leaving the test is remembered too.
    page.once("dialog", dialog => void dialog.accept());
    await page.getByRole("button", { name: "Exit" }).click();
    await page.reload();
    await expect(page.getByRole("region", { name: /^Moves your/ })).toBeVisible();
    await expect(page.locator(".question")).toHaveCount(0);
  });
}

test("a reload after the test is over does not reopen it", async ({ page }) => {
  let status = "in_progress";
  await mockAPI(page, () => status);
  await page.goto("/#dashboard");
  await page.getByRole("region", { name: /^Moves your/ }).getByRole("button", { name: /^Zoetrope/ }).first().click();
  await page.getByRole("button", { name: "Start timed exam" }).click();
  await expect(page.locator("#question-q1")).toBeVisible();
  status = "expired";
  await page.reload();
  await expect(page.getByRole("region", { name: /^Moves your/ })).toBeVisible();
  await expect(page.locator("#question-q1")).toHaveCount(0);
});

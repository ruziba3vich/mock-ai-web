import { expect, test, type Page } from "@playwright/test";

// A mock's free AI checks run out. From then on the student is told the price before a check spends stars.
// Deterministic API fixtures, not backend E2E.
const content = [["one", "task_1", "Describe the changes shown in the chart."], ["two", "task_2", "Discuss public transport investment in cities."]]
  .map(([id, task, prompt]) => ({ id, kind: "writing_prompt", slug: id, title: id, summary: "", status: "published", sort_order: 1, data: { task, prompt } }));
const essay = Array.from({ length: 60 }, () => "word").join(" ");

async function open(page: Page, stage: "writing" | "speaking", stars: object) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "retake-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/stars": { source: "personal", balance: 50, full_mock_cost: 35, costs: { listening: 5, reading: 5, writing: 10, speaking: 15 }, payments_available: true, ...stars },
      "/api/v1/content": { items: content },
      "/api/v1/writing/settings": { enabled: true, daily_limit: 5 },
      "/api/v1/speaking/settings": { enabled: true, live: true, countries: [], daily_limit: 3, audio_retention_days: 30 }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], submissions: [], sessions: [], exams: [], attempts: [], skills: [], plan: null } });
  });
  await page.addInitScript(stage => localStorage.setItem("mockai.full-mock.retake-user", JSON.stringify({
    id: "lsundayrsunday", started_at: new Date().toISOString(), stage, listening_exam_id: "l-sunday", reading_exam_id: "r-sunday",
    writing_task1_content_id: "one", writing_task2_content_id: "two"
  })), stage);
  await page.goto("/");
}

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`a Writing check the mock no longer covers shows its price at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await open(page, "writing", { mock_checks: { lsundayrsunday: { writing: 0, speaking: 2 } } });
    await expect(page.getByText("This mock no longer includes a free AI check. Costs 10 stars · you have 50")).toBeVisible();
    await page.getByLabel("Your essay").fill(essay);
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("button", { name: "Submit Task 1 and continue" })).toBeEnabled();
    await page.getByText("This mock no longer includes").scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`writing-warning-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("too few stars for the check: it cannot be sent, and the page says why", async ({ page }) => {
  await open(page, "writing", { balance: 3, mock_checks: {} }); // paid more than 48 hours ago
  await expect(page.getByText("An AI Writing check costs 10 stars and you have 3. Get more on the Stars page.")).toBeVisible();
  await page.getByLabel("Your essay").fill(essay);
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Submit Task 1 and continue" })).toBeDisabled();
});

test("a check the mock still covers is not priced", async ({ page }) => {
  await open(page, "writing", { mock_checks: { lsundayrsunday: { writing: 1, speaking: 2 } } });
  await page.getByLabel("Your essay").fill(essay);
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Submit Task 1 and continue" })).toBeEnabled();
  await expect(page.getByText(/stars/)).toHaveCount(0);
});

test("a centre's student is not shown a price", async ({ page }) => {
  await open(page, "writing", { source: "centre", centre_name: "Zehn Academy", balance: 0, mock_checks: {} });
  await page.getByLabel("Your essay").fill(essay);
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Submit Task 1 and continue" })).toBeEnabled();
  await expect(page.getByText(/stars/)).toHaveCount(0);
});

test("a Speaking interview the mock no longer covers shows its price", async ({ page }, info) => {
  await open(page, "speaking", { mock_checks: { lsundayrsunday: { writing: 2, speaking: 0 } } });
  await expect(page.getByText("This mock no longer includes a free AI interview. Costs 15 stars · you have 50")).toBeVisible();
  await page.screenshot({ path: info.outputPath("speaking-warning.png") });
});

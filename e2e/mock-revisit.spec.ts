import { expect, test, type Page } from "@playwright/test";

// A mock sat once runs in order. Opened again after it was finished, it offers any section and the way to earlier results.
// Deterministic API fixtures, not backend E2E.
const paper = (id: string, title: string, skill: string) => ({ id, slug: id, code: `code-${id}`, source: "global", title, description: "", skill, duration_seconds: 3600, question_count: 40, published_at: "2026-10-01T00:00:00Z" });
const exams = [paper("l-sunday", "Sunday Mock Test · Listening", "listening"), paper("r-sunday", "Sunday Mock Test · Reading", "reading")];
const scored = (id: string, title: string, skill: string) => ({ id, exam_version_id: "v", status: "scored", started_at: "2026-11-01T09:00:00Z", deadline_at: "2026-11-01T10:00:00Z", submitted_at: "2026-11-01T09:50:00Z", raw_score: 30, band_score: 7, question_count: 40, answers: [], title, skill });

const blank = { id: "q2", position: 2, section_title: "Part 1", type: "gap_fill", prompt: "The roof is made of ____.", submitted_answers: null, accepted_answers: ["slate"], correct: false, explanation: "" };

async function open(page: Page, attempts: object[], questions: object[] | null = [blank]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "revisit-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams": { exams },
      "/api/v1/stars": { source: "personal", balance: 50, full_mock_cost: 35, payments_available: true, paid_mocks: ["lsundayrsunday"] },
      "/api/v1/me/attempts": { attempts },
      "/api/v1/attempts/a1/review": { review: { attempt_id: "a1", exam_title: exams[0].title, skill: "listening", band_score: 7, questions } },
      "/api/v1/me/progress": { skills: [] },
      "/api/v1/me/study-plan": { plan: null }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [], sessions: [] } });
  });
  await page.goto("/#exams");
  await page.getByRole("button", { name: "Open Sunday Mock Test" }).click();
}

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`a finished mock opens to any section and its results at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await open(page, [scored("a1", exams[0].title, "listening"), scored("a2", exams[1].title, "reading")]);
    await expect(page.getByRole("heading", { name: "Choose any section." })).toBeVisible();
    for (const skill of ["Listening", "Reading", "Writing", "Speaking"]) {
      await expect(page.getByRole("button", { name: `Start ${skill}` })).toBeVisible();
      await expect(page.getByRole("button", { name: `${skill} analysis` })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`revisit-${width}.png`), fullPage: true });

    // Straight to Writing, without sitting Listening and Reading first.
    await page.getByRole("button", { name: "Start Writing" }).click();
    await expect(page.getByLabel(/remaining for Writing$/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/remaining for Writing$/)).toBeVisible();
  });
}

test("analysis opens the earlier results for that skill", async ({ page }) => {
  await open(page, [scored("a1", exams[0].title, "listening"), scored("a2", exams[1].title, "reading")]);
  // Straight to that paper's own result, not to the list of every attempt.
  await page.getByRole("button", { name: "Listening analysis" }).click();
  await expect(page.getByRole("heading", { name: "Sunday Mock Test · Listening" })).toBeVisible();
  await page.getByRole("button", { name: "← All attempts" }).click();
  await expect(page.getByRole("heading", { name: "Review and learn" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sunday Mock Test · Reading/ })).toBeVisible();
});

test("a Listening attempt with a question left blank opens, and shows it as not answered", async ({ page }, info) => {
  await open(page, [scored("a1", exams[0].title, "listening"), scored("a2", exams[1].title, "reading")]);
  await page.getByRole("button", { name: "Listening analysis" }).click();
  await expect(page.getByText("Not answered")).toBeVisible();
  await page.screenshot({ path: info.outputPath("blank-answer.png") });
});

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`a page that cannot be drawn says so and offers a reload at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await open(page, [scored("a1", exams[0].title, "listening"), scored("a2", exams[1].title, "reading")], null);
    await page.getByRole("button", { name: "Listening analysis" }).click();
    await expect(page.getByRole("heading", { name: "This page could not be shown." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload" })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`crash-${width}.png`) });
  });
}

test("a paid mock not yet finished still runs in order", async ({ page }) => {
  await open(page, [scored("a1", exams[0].title, "listening")]);
  await expect(page.getByRole("button", { name: /Begin with Listening/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Writing" })).toHaveCount(0);
});

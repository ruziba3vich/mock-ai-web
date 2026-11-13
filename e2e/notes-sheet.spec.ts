import { expect, test } from "@playwright/test";

// A completion task prints as one sheet, the way the paper shows it.
// Deterministic API fixtures, not backend E2E.
const G = "______";
const gapQ = (prompt: string, config: Record<string, unknown> = {}) => ({ type: "short_answer", prompt, config, options: [] });
const list = [
  gapQ(`General counsellors – need experience of working with children as a ${G}`, { intro: ["# Questions 1–10", "Complete the notes below.", "Write **ONE WORD AND/OR A NUMBER** for each answer."], title: "Working in a summer camp in the USA", before: ["Job involves being with children for 24 hours per day"] }),
  gapQ(`sport, e.g. ${G}`, { before: ["Specialist counsellors could use skills in:"], sub: true }),
  gapQ(`Job in summer camp lasts for ${G} weeks with the chance to travel afterwards`, { before: ["  art"] }),
  gapQ(`Salary: ${G} US $`),
  gapQ(`own ${G} (£138)`, { before: ["# Must pay for:"] }),
  { type: "multiple_choice", prompt: "Simon thinks the Global Communications major", config: { intro: ["# Questions 6–7", "Choose the correct letter, **A**, **B** or **C**."] }, options: ["will help him get work in other countries.", "has easier courses.", "could lead to a well-paid job."].map((value, i) => ({ id: `o${i}`, label: "ABC"[i], value })) },
  gapQ(`1861 | Kinematoscope | displayed 3D images on ${G}`, { intro: ["# Questions 7–8", "Complete the table below."], sheet: "table", columns: ["Year", "Invention", "Description"] }),
  gapQ(`1870 | Phasmatrope | showed an audience images that appeared ${G}`, { after: ["1890 | Kinetograph | a motion-picture camera moving a film through its sprocket system"] }),
  gapQ(`David Hume examined how people are controlled by ${G}.`, { intro: ["# Questions 9–10", "Complete the summary below."], sheet: "summary" }),
  gapQ(`The book studies people’s reactions to various ${G} and their expectations.`)
];
const exam = {
  id: "listening-1", slug: "sunday", title: "Sunday Mock Test · Listening", description: "", skill: "listening", duration_seconds: 2400, question_count: list.length,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "",
  sections: [{ id: "s1", position: 1, title: "Parts 1-4", instructions: "Listen and answer questions 1–40.", audio_url: "/api/v1/private-media/recording", questions: list.map((q, i) => ({ ...q, id: `q${i + 1}`, position: i + 1, points: 1 })) }]
};

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`a notes task prints as one sheet at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("mockai.runner.sheet-user", JSON.stringify({ exam_id: "listening-1", attempt_id: "attempt-1" })));
    const saved: string[] = [];
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET" && path.includes("/answers")) saved.push(path);
      const attempt = { id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 2_400_000).toISOString(), question_count: list.length, answers: [] };
      const bodies: Record<string, unknown> = {
        "/api/v1/me": { user: { id: "sheet-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
        "/api/v1/exams": { exams: [exam] },
        "/api/v1/exams/listening-1": { exam },
        "/api/v1/attempts/attempt-1": { attempt },
        "/api/v1/attempts/attempt-1/workspace": { flags: [], notes: {}, highlights: {} }
      };
      await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [] } });
    });
    await page.goto("/");
    await expect(page.getByText("Working in a summer camp in the USA")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`sheet-${width}.png`), fullPage: true });

    const notes = page.locator(".note-sheet").first();
    await expect(notes.getByRole("textbox")).toHaveCount(5);
    await expect(notes.getByText("Job involves being with children for 24 hours per day")).toBeVisible();
    await expect(notes.getByRole("heading", { name: "Must pay for:" })).toBeVisible();
    await expect(page.getByText("ONE WORD AND/OR A NUMBER")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Invention" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Kinetograph" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".note-table").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    // The question map still reaches a gap inside the sheet, and its answer is saved.
    await page.getByRole("link", { name: "Question 5, unanswered" }).click();
    const fifth = page.getByRole("textbox", { name: "Answer to question 5" });
    await expect(fifth).toBeInViewport();
    await fifth.fill("insurance");
    await fifth.blur();
    await expect(page.getByRole("link", { name: "Question 5, answered" })).toBeVisible();
    await expect.poll(() => saved.length).toBe(1);
  });
}

import { expect, test } from "@playwright/test";

// "Which paragraph" matching is one dropdown per statement, and the divider between passage and questions drags.
// Deterministic API fixtures, not backend E2E.
const paragraphs = "ABCDEFG".split("").map((label, i) => ({ id: `p${i}`, label, value: `Paragraph ${label}` }));
const writers = ["Daniel Kahneman", "Charles Duhigg"].map((value, i) => ({ id: `w${i}`, label: "AB"[i], value }));
const list = [
  { type: "matching", prompt: "an account of changed behaviour reversing failure", options: paragraphs, config: { select: true, intro: ["# Questions 1–2", "Which paragraph contains the following information?"] } },
  { type: "matching", prompt: "Quick responses occur if someone feels unsafe.", options: writers, config: { select: true } },
  { type: "multiple_choice", prompt: "The writer's main point is", options: writers, config: {} }
];
const exam = {
  id: "reading-1", slug: "sunday", title: "Sunday Mock Test · Reading", description: "", skill: "reading", duration_seconds: 3600, question_count: list.length,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "",
  sections: [{ id: "s1", position: 1, title: "Passage 2", instructions: "Read the text and answer questions 1–3.", passage: Array(30).fill("The habit of rewriting how we think has a long history in popular science.").join("\n\n"), questions: list.map((q, i) => ({ ...q, id: `q${i + 1}`, position: i + 1, points: 1 })) }]
};

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`reading matching is a dropdown and the panes resize at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("mockai.runner.select-user", JSON.stringify({ exam_id: "reading-1", attempt_id: "attempt-1" })));
    const saved: string[] = [];
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET" && path.endsWith("/answers/q1")) saved.push(route.request().postData() || "");
      const attempt = { id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 3_600_000).toISOString(), question_count: list.length, answers: [] };
      const bodies: Record<string, unknown> = {
        "/api/v1/me": { user: { id: "select-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
        "/api/v1/exams": { exams: [exam] },
        "/api/v1/exams/reading-1": { exam },
        "/api/v1/attempts/attempt-1": { attempt },
        "/api/v1/attempts/attempt-1/workspace": { flags: [], notes: {}, highlights: {} }
      };
      await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [] } });
    });
    await page.goto("/");

    // One dropdown per statement; the plain multiple choice keeps its radio buttons.
    const first = page.getByRole("combobox", { name: "Answer to question 1" });
    await expect(first).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Answer to question 2" }).getByRole("option")).toHaveText(["— choose —", "A · Daniel Kahneman", "B · Charles Duhigg"]);
    await expect(page.getByRole("radio")).toHaveCount(2);
    await first.selectOption("Paragraph B");
    await expect(page.getByRole("link", { name: "Question 1, answered" })).toBeVisible();
    await expect.poll(() => saved.at(-1)).toBe('{"values":["Paragraph B"]}');
    await page.screenshot({ path: info.outputPath(`select-${width}.png`) });
    // Back to "— choose —" takes the answer out, and that is saved too.
    await first.selectOption("");
    await expect(page.getByRole("link", { name: "Question 1, unanswered" })).toBeVisible();
    await expect.poll(() => saved.at(-1)).toBe('{"values":[]}');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const handle = page.getByRole("separator", { name: "Resize the passage and the questions" });
    if (width < 1024) { await expect(handle).toBeHidden(); return; }
    const questions = page.locator(".questions"), size = async () => Math.round((await questions.boundingBox())!.width);
    const before = await size(), box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(size).toBe(before + 200);
    await handle.press("ArrowRight");
    await expect.poll(size).toBe(before + 176);
    // Neither pane can be dragged shut.
    const moved = (await handle.boundingBox())!;
    await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.mouse.down();
    await page.mouse.move(40, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(size).toBe(width - 320);
    await page.screenshot({ path: info.outputPath(`resized-${width}.png`) });
  });
}

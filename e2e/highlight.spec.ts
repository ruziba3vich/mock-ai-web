import { expect, test, type Locator, type Page } from "@playwright/test";

// Selecting text in an exam highlights it at once, with no button. Selecting it again clears it.
// Deterministic API fixtures, not backend E2E.
const exam = {
  id: "reading-1", slug: "sunday", title: "Sunday Mock Test · Reading", description: "", skill: "reading", duration_seconds: 3600, question_count: 1,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "",
  sections: [{ id: "s1", position: 1, title: "Passage 1", instructions: "Read the text and answer question 1.", passage: "The habit of rewriting how we think has a long history in popular science.", questions: [
    { id: "q1", position: 1, points: 1, type: "multiple_choice", prompt: "The writer's main point is", options: [{ id: "a", label: "A", value: "Daniel Kahneman" }, { id: "b", label: "B", value: "Charles Duhigg" }], config: {} }
  ] }]
};
const prompts = [["one", "task_1", "Describe the changes shown in the chart."], ["two", "task_2", "Discuss public transport investment in cities."]]
  .map(([id, task, prompt]) => ({ id, kind: "writing_prompt", slug: id, title: id, summary: "", status: "published", sort_order: 1, data: { task, prompt } }));

// Drags the mouse over characters [from, to) of the element's first text, the way a student does.
async function drag(page: Page, target: Locator, from: number, to: number) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.evaluate((el, [from, to]) => {
    const node = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange();
    range.setStart(node, from); range.setEnd(node, to);
    const r = range.getBoundingClientRect();
    return { left: r.left, right: r.right, y: r.top + r.height / 2 };
  }, [from, to]);
  await page.mouse.move(box.left + 1, box.y);
  await page.mouse.down();
  await page.mouse.move(box.right - 1, box.y, { steps: 4 });
  await page.mouse.up();
}
const drawn = (page: Page) => page.evaluate(() => CSS.highlights.get("exam")?.size ?? 0);

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`selected text in a passage and a question is highlighted at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("mockai.runner.select-user", JSON.stringify({ exam_id: "reading-1", attempt_id: "attempt-1" })));
    const saved: string[] = [];
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET" && path.endsWith("/workspace")) saved.push(route.request().postData() || "");
      const attempt = { id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 3_600_000).toISOString(), question_count: 1, answers: [] };
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

    const passage = page.locator(".exam-content article").first();
    await expect(passage).toBeVisible();
    await expect(page.getByRole("button", { name: /highlight/i })).toHaveCount(0);

    await drag(page, passage, 4, 22);
    await expect.poll(() => drawn(page)).toBe(1);
    // The selection itself is dropped, so the highlight is what the student sees.
    expect(await page.evaluate(() => getSelection()!.isCollapsed)).toBe(true);
    await drag(page, page.getByText("The writer's main point is"), 4, 17);
    await expect.poll(() => drawn(page)).toBe(2);
    await page.screenshot({ path: info.outputPath(`highlight-reading-${width}.png`) });
    await expect.poll(() => saved.at(-1) ?? "").toContain("habit of rewriting");
    expect(saved.at(-1)).toContain("writer's main");

    // Selecting inside a highlight clears it.
    await drag(page, passage, 8, 16);
    await expect.poll(() => drawn(page)).toBe(1);
    await expect.poll(() => saved.at(-1) ?? "").not.toContain("habit of rewriting");
  });

  test(`the full-mock Writing prompt is highlighted on selection at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      const bodies: Record<string, unknown> = {
        "/api/v1/me": { user: { id: "retake-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
        "/api/v1/stars": { balance: 50, full_mock_cost: 35, costs: { listening: 5, reading: 5, writing: 10, speaking: 15 }, payments_available: true },
        "/api/v1/content": { items: prompts },
        "/api/v1/writing/settings": { enabled: true, daily_limit: 5 }
      };
      await route.fulfill({ json: bodies[path] ?? { items: [], submissions: [], sessions: [], exams: [], attempts: [], skills: [], plan: null } });
    });
    await page.addInitScript(() => localStorage.setItem("mockai.full-mock.retake-user", JSON.stringify({
      id: "lsundayrsunday", started_at: new Date().toISOString(), stage: "writing", listening_exam_id: "l-sunday", reading_exam_id: "r-sunday",
      writing_task1_content_id: "one", writing_task2_content_id: "two"
    })));
    await page.goto("/");

    const prompt = page.locator(".rp-prompt");
    await expect(prompt).toHaveText("Describe the changes shown in the chart.");
    await drag(page, prompt, 13, 20);
    await expect.poll(() => drawn(page)).toBe(1);
    await page.screenshot({ path: info.outputPath(`highlight-writing-${width}.png`) });
    // Kept across a refresh.
    await page.reload();
    await expect(prompt).toBeVisible();
    await expect.poll(() => drawn(page)).toBe(1);
    await drag(page, prompt, 14, 19);
    await expect.poll(() => drawn(page)).toBe(0);
  });
}

import { expect, test, type Page } from "@playwright/test";

// A passage's figure must stay in view while its text scrolls, and leave with its section.
// Deterministic API fixtures, not backend E2E.
const passage = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}. The zoetrope spins a strip of drawings past a row of slits, and the eye joins them into movement.`).join("\n\n");
const question = (id: string, position: number) => ({ id, position, type: "short_answer", prompt: `Label ${position} of the diagram`, points: 1, config: {}, options: [] });
const exam = {
  id: "reading-1", slug: "zoetrope", title: "Zoetrope", description: "Reading mock", skill: "reading", duration_seconds: 3600, question_count: 12,
  published_at: "2026-10-01T00:00:00Z", version_id: "version-1", version: 1, instructions: "Read carefully.",
  sections: [
    { id: "s1", position: 1, title: "Passage 1", instructions: "Label the diagram.", passage, source_image_urls: ["/api/v1/private-media/fig-1", "/api/v1/private-media/fig-2"], questions: [1, 2, 3, 4, 5, 6].map(n => question(`q${n}`, n)) },
    { id: "s2", position: 2, title: "Passage 2", instructions: "Answer the questions.", passage, questions: [7, 8, 9, 10, 11, 12].map(n => question(`q${n}`, n)) }
  ]
};
const prompt = "The chart shows CO2 emissions by income group. Summarise the information.";
const figure = (label: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1216" height="848"><rect width="1216" height="848" fill="#e8e4dc"/><circle cx="608" cy="424" r="260" fill="none" stroke="#333" stroke-width="12"/><text x="608" y="450" font-size="90" text-anchor="middle" fill="#333">${label}</text></svg>`;

async function mockAPI(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" }); // entrance animations would blank the screenshots
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    if (path.includes("/private-media/")) return route.fulfill({ body: figure(path.split("/").pop()!), contentType: "image/svg+xml" });
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "figure-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams": { exams: [exam] },
      "/api/v1/exams/reading-1": { exam },
      "/api/v1/exams/reading-1/attempts": { attempt: { id: "attempt-1", exam_version_id: "version-1", status: "in_progress", started_at: new Date().toISOString(), deadline_at: new Date(Date.now() + 3_600_000).toISOString(), question_count: 12, answers: [] } },
      "/api/v1/attempts/attempt-1/workspace": { flags: [], notes: {}, highlights: {} },
      "/api/v1/me/attempts": { attempts: [] },
      "/api/v1/me/progress": { skills: [] },
      "/api/v1/me/study-plan": { plan: null },
      "/api/v1/content": { items: url.searchParams.get("kind") === "writing_prompt" ? [{ id: "p1", kind: "writing_prompt", slug: "co2", title: "CO2 by income group", summary: "", status: "published", sort_order: 1, data: { task: "task_1", prompt, source_image_urls: ["/api/v1/private-media/chart"] } }] : [] }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [] } });
  });
}
const inView = (page: Page, selector: string) => page.locator(selector).first().evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top >= 0 && r.bottom <= innerHeight; });

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`reading figure stays pinned at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await mockAPI(page);
    await page.goto("/#dashboard");
    await page.getByRole("region", { name: /^Moves your/ }).getByRole("button", { name: /^Zoetrope/ }).first().click();
    await page.getByRole("button", { name: "Start timed exam" }).click();
    const figureImage = page.getByRole("img", { name: "Passage 1, figure 1" });
    await expect(figureImage).toBeVisible();
    await page.screenshot({ path: info.outputPath(`runner-top-${width}.png`) });

    // Scroll the passage a long way: the figure is still there, and so is the text.
    const scroller = width >= 1024 ? ".runner-section:first-child .material" : "html";
    await page.locator(scroller).evaluate(el => el.scrollBy(0, 1500));
    await expect.poll(() => inView(page, ".pinned-figures > img")).toBe(true);
    await page.screenshot({ path: info.outputPath(`runner-scrolled-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Two figures share the one slot.
    await page.getByRole("button", { name: "Next figure" }).click();
    await expect(page.getByRole("img", { name: "Passage 1, figure 2" })).toBeVisible();
    await expect(figureImage).toHaveCount(0);

    // Hidden, it gives the space back and can be brought back without scrolling.
    await page.getByRole("button", { name: "Hide figure" }).click();
    await expect(page.locator(".pinned-figures > img")).toHaveCount(0);
    expect(await inView(page, ".pinned-figures figcaption")).toBe(true);
    await page.getByRole("button", { name: "Show figure" }).click();

    // The next passage does not carry the old passage's figure.
    await page.locator(".runner-section:nth-child(2) .material h2").scrollIntoViewIfNeeded();
    await page.locator(width >= 1024 ? ".exam-content" : "html").evaluate(el => el.scrollBy(0, 600));
    await expect.poll(() => inView(page, ".pinned-figures > img")).toBe(false);
    await page.screenshot({ path: info.outputPath(`runner-next-${width}.png`) });
  });

  test(`writing chart stays pinned while the essay is written at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await mockAPI(page);
    await page.goto("/#writing");
    await expect(page.getByRole("img", { name: "CO2 by income group, figure 1" })).toBeVisible();
    await page.getByLabel("Your essay").fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1} of the report.`).join("\n"));
    await page.getByLabel("Your essay").evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY));
    await expect.poll(() => inView(page, ".pinned-figures > img")).toBe(true);
    await page.screenshot({ path: info.outputPath(`writing-${width}.png`) });
  });
}

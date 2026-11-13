import { expect, test, type Page } from "@playwright/test";

// Every mock is listed with a link, and the link opens that mock for whoever follows it.
// Deterministic API fixtures, not backend E2E.
const paper = (id: string, title: string, skill: string) => ({ id, slug: `${id}-paper`, title, description: "", skill, duration_seconds: 3600, question_count: 40, published_at: "2026-10-01T00:00:00Z" });
const exams = [
  paper("l-sunday", "Sunday Mock Test · Listening", "listening"), paper("r-sunday", "Sunday Mock Test · Reading", "reading"),
  paper("l-cam", "Cambridge 18 Test 2 Listening", "listening"), paper("r-cam", "Cambridge 18 Test 2 Reading", "reading"),
  paper("r-alone", "Zoetrope", "reading")
];

async function mockAPI(page: Page, spent: string[]) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/stars/spend") { spent.push(route.request().postDataJSON().purpose); return route.fulfill({ json: { balance: 15 } }); }
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "invite-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams": { exams },
      "/api/v1/stars": { source: "personal", balance: 50, full_mock_cost: 35, payments_available: true },
      "/api/v1/me/attempts": { attempts: [] },
      "/api/v1/me/progress": { skills: [] },
      "/api/v1/me/study-plan": { plan: null }
    };
    await route.fulfill({ json: bodies[path] ?? { items: [], content: [], submissions: [] } });
  });
}

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`mocks are listed and shared by link at ${width}px`, async ({ page, context }, info) => {
    const spent: string[] = [];
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height });
    await mockAPI(page, spent);
    await page.goto("/#exams");
    await expect(page.getByRole("heading", { name: "Full mock exam" })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`exams-${width}.png`), fullPage: true });

    const list = page.getByRole("region", { name: "Mock exams" });
    await expect(list.getByRole("listitem")).toHaveCount(2); // the lone Reading paper is not a mock
    const sunday = list.getByRole("listitem").filter({ hasText: "Sunday Mock Test" });
    await sunday.getByRole("button", { name: "Copy invite link" }).click();
    await expect(sunday.getByRole("button", { name: "Link copied" })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get("mock")).toBe("l-sunday-paper"); // the public slug, never the internal id
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Whoever follows the link is asked to pay for that mock, and then sits exactly it.
    await page.goto(link);
    await page.getByRole("button", { name: "Use 35 stars and start" }).click();
    await expect(page.getByText("Full IELTS mock")).toBeVisible();
    expect(spent).toEqual(["full_mock"]);
    const mock = await page.evaluate(() => JSON.parse(localStorage.getItem("mockai.full-mock.invite-user")!));
    expect([mock.listening_exam_id, mock.reading_exam_id, mock.set_key]).toEqual(["l-sunday", "r-sunday", "sunday mock test"]);
    expect(new URL(page.url()).search).toBe(""); // a reload must not ask again
  });
}

test("a link shared before, carrying the paper id, still opens its mock", async ({ page }) => {
  await mockAPI(page, []);
  await page.goto("/?mock=l-sunday");
  await expect(page.getByRole("button", { name: "Use 35 stars and start" })).toBeVisible();
});

test("a link to a mock this account cannot open says so", async ({ page }) => {
  await mockAPI(page, []);
  await page.goto("/?mock=gone");
  await expect(page.getByRole("alert")).toContainText("not available");
  await expect(page.getByRole("region", { name: "Mock exams" })).toBeVisible();
});

test("a centre's exam link opens its exam code", async ({ page }) => {
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/exam-sessions/lookup") {
      expect(route.request().postDataJSON().code).toBe("ABC234");
      return route.fulfill({ json: { session: { id: "s1", title: "Saturday mock", centre_name: "Zehn Academy", starts_at: new Date(Date.now() + 600_000).toISOString(), ends_at: new Date(Date.now() + 9_000_000).toISOString(), now: new Date().toISOString() } } });
    }
    await route.fulfill(path === "/api/v1/me" ? { status: 401, json: { error: "unauthorized" } } : { json: { pc: null } });
  });
  await page.goto("/join?code=abc-234");
  await expect(page.getByText("Saturday mock")).toBeVisible();
  await expect(page.getByText("Zehn Academy")).toBeVisible();
});

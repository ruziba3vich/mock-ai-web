import { expect, test, type Page } from "@playwright/test";

// Every mock is listed with a link, and the link opens that mock for whoever follows it.
// Deterministic API fixtures, not backend E2E.
const paper = (id: string, title: string, skill: string, source = "global") => ({ id, slug: `content-${id}`, code: `code-${id}`, source, title, description: "", skill, duration_seconds: 3600, question_count: 40, published_at: "2026-10-01T00:00:00Z" });
const exams = [
  // The viewer's centre uploaded the same file under the same name as the global mock.
  paper("l-centre", "Sunday Mock Test · Listening", "listening", "centre"), paper("r-centre", "Sunday Mock Test · Reading", "reading", "centre"),
  paper("l-sunday", "Sunday Mock Test · Listening", "listening"), paper("r-sunday", "Sunday Mock Test · Reading", "reading"),
  paper("l-cam", "Cambridge 18 Test 2 Listening", "listening"), paper("r-cam", "Cambridge 18 Test 2 Reading", "reading"),
  paper("r-alone", "Zoetrope", "reading")
];

async function mockAPI(page: Page, spent: string[], stars: object = {}) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/stars/spend") { spent.push(route.request().postDataJSON().reference); return route.fulfill({ json: { balance: 15 } }); }
    const bodies: Record<string, unknown> = {
      "/api/v1/me": { user: { id: "invite-user", display_name: "Dostonbek Soliyev", roles: ["student"], email_verified: true } },
      "/api/v1/exams": { exams },
      "/api/v1/stars": { balance: 50, full_mock_cost: 35, payments_available: true, ...stars },
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
    await expect(list.getByRole("listitem")).toHaveCount(3); // the lone Reading paper is not a mock
    const sunday = list.getByRole("listitem").filter({ hasText: "Sunday Mock Test" }).nth(1); // the global one, listed after the centre's
    await sunday.getByRole("button", { name: "Copy invite link" }).click();
    await expect(sunday.getByRole("button", { name: "Link copied" })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).searchParams.get("mock")).toBe("code-l-sunday"); // the paper's public code, never an internal id or slug
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // Whoever follows the link is asked to pay for that mock, and then sits exactly it.
    await page.goto(link);
    await page.getByRole("button", { name: "Use 35 stars and start" }).click();
    await expect(page.getByText("Full IELTS mock")).toBeVisible();
    expect(spent).toEqual(["lsundayrsunday"]); // paid under the mock's own papers, so the server knows it next time
    const mock = await page.evaluate(() => JSON.parse(localStorage.getItem("mockai.full-mock.invite-user")!));
    expect([mock.listening_exam_id, mock.reading_exam_id, mock.set_key]).toEqual(["l-sunday", "r-sunday", "sunday mock test"]);
    expect(new URL(page.url()).search).toBe(""); // a reload must not ask again
  });

  test(`a mock already paid for opens again without stars at ${width}px`, async ({ page }, info) => {
    const spent: string[] = [];
    await page.setViewportSize({ width, height });
    // Paid on another device, or ended before the last section: nothing about it is left in this browser.
    await mockAPI(page, spent, { balance: 0, paid_mocks: ["lsundayrsunday"] });
    await page.goto("/#exams");
    const list = page.getByRole("region", { name: "Mock exams" });
    await expect(list.getByRole("button", { name: "Open Sunday Mock Test" })).toBeVisible();
    await expect(list.getByRole("button", { name: /^Start / })).toHaveCount(2);
    await page.screenshot({ path: info.outputPath(`paid-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await list.getByRole("button", { name: "Open Sunday Mock Test" }).click();
    await expect(page.getByText("Full IELTS mock")).toBeVisible();
    expect(spent).toEqual([]);
    const mock = await page.evaluate(() => JSON.parse(localStorage.getItem("mockai.full-mock.invite-user")!));
    expect([mock.id, mock.listening_exam_id, mock.reading_exam_id]).toEqual(["lsundayrsunday", "l-sunday", "r-sunday"]);
  });
}

for (const old of ["l-sunday", "sunday-mock-test"]) {
  test(`a link shared before, carrying ${old}, still opens a mock`, async ({ page }) => {
    await mockAPI(page, []);
    await page.goto(`/?mock=${old}`);
    await expect(page.getByRole("button", { name: "Use 35 stars and start" })).toBeVisible();
  });
}

test("a link to a mock this account cannot open says so", async ({ page }) => {
  await mockAPI(page, []);
  await page.goto("/?mock=gone");
  await expect(page.getByRole("alert")).toContainText("not available");
  await expect(page.getByRole("region", { name: "Mock exams" })).toBeVisible();
});

// A mock an administrator saved: a public one is listed, a centre's one opens from its link alone.
const saved = (id: string, title: string, code: string, centre_id = "") => ({ id, title, code, listening_exam_id: `l-${id}`, reading_exam_id: `r-${id}`, writing_task1_content_id: `w1-${id}`, writing_task2_content_id: "", joined: 0, centre_id, centre_name: "" });

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`a saved mock is listed, and a centre's opens from its invite link at ${width}px`, async ({ page }, info) => {
    const spent: string[] = [], joined: string[] = [];
    await page.setViewportSize({ width, height });
    await mockAPI(page, spent);
    await page.route("**/api/v1/mock-exams**", route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { mocks: [saved("open", "Open Mock 1", "PUB234")] } });
      const code = route.request().postDataJSON().code;
      joined.push(code);
      return code === "gone" ? route.fulfill({ status: 404, json: { error: { message: "That mock exam link is not valid any more." } } })
        : route.fulfill({ json: { mock: code === "PUB234" ? saved("open", "Open Mock 1", "PUB234") : saved("inv", "Zehn Mock 3", "ZXC234", "c1") } });
    });
    await page.goto("/#exams");
    const list = page.getByRole("region", { name: "Mock exams" });
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(list.getByRole("listitem").first()).toContainText("Open Mock 1"); // its papers are in no library list of this student
    await page.screenshot({ path: info.outputPath(`saved-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto("/?mock=ZXC234");
    await expect(list.getByRole("listitem").first()).toContainText("Zehn Mock 3"); // now in this student's list
    await page.getByRole("button", { name: "Start the mock" }).click();
    await expect(page.getByText("Full IELTS mock")).toBeVisible();
    expect(joined).toEqual(["ZXC234"]);
    const mock = await page.evaluate(() => JSON.parse(localStorage.getItem("mockai.full-mock.invite-user")!));
    expect([mock.listening_exam_id, mock.reading_exam_id, mock.writing_task1_content_id, mock.writing_task2_content_id]).toEqual(["l-inv", "r-inv", "w1-inv", undefined]);
  });
}

// A centre's mock is paid by the centre: a student with no stars still sits it.
test("a centre's mock starts for a student with no stars, and says so when the centre cannot pay", async ({ page }) => {
  const spent: string[] = [];
  await mockAPI(page, spent, { balance: 0 });
  let centrePays = false;
  await page.route("**/api/v1/stars/spend", route => centrePays
    ? route.fulfill({ json: { balance: 0 } })
    : route.fulfill({ status: 402, json: { error: { code: "centre_out_of_stars", message: "centre out of stars" } } }));
  await page.route("**/api/v1/mock-exams**", route => route.fulfill({ json: route.request().method() === "GET" ? { mocks: [] } : { mock: { ...saved("inv", "Zehn Mock 3", "ZXC234", "c1"), centre_name: "Zehn Academy" } } }));
  await page.goto("/?mock=ZXC234");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Zehn Academy pays the 35 stars for this mock. Your own 0 stars are not used.");
  await expect(page.getByRole("region", { name: "Mock exams" }).getByRole("listitem").first()).toContainText("Paid by Zehn Academy");
  await dialog.getByRole("button", { name: "Start the mock" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Zehn Academy does not have enough stars");
  centrePays = true;
  await dialog.getByRole("button", { name: "Start the mock" }).click();
  await expect(page.getByText("Full IELTS mock")).toBeVisible();
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

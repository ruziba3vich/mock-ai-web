import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.describe("deployed website readiness", () => {
  test.skip(!process.env.DEMO_E2E, "Opt-in: creates a temporary account on the target deployment");
  let cookies: Awaited<ReturnType<import("@playwright/test").APIRequestContext["storageState"]>>["cookies"];
  const email = `demo-qa-${randomUUID()}@example.test`;
  const password = randomUUID() + "Aa1!";
  test.beforeAll(async ({ request, baseURL }) => {
    const response = await request.post("/api/v1/auth/register", {
      headers: { Origin: new URL(baseURL!).origin },
      data: { display_name: "Temporary Demo QA", email, password }
    });
    expect(response.status()).toBe(201);
    console.log("Demo QA account", (await response.json()).user.id, email);
    cookies = (await request.storageState()).cookies;
  });
  test.beforeEach(async ({ context, page }) => {
    page.setDefaultTimeout(12_000);
    await context.addCookies(cookies);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Let’s practise/ })).toBeVisible();
  });
  const navigate = async (page: Page, name: string) => {
    await page.getByRole("button", { name, exact: true }).filter({ visible: true }).first().click();
  };
  const practice = async (page: Page, skill: string) => {
    await navigate(page, "Practice");
    await page.locator(".practice-setup").getByRole("button", { name: new RegExp(`^${skill} `) }).click();
  };

  test("desktop navigation, profile and four content libraries", async ({ page }, info) => {
    for (const tab of ["Explore", "Mistake notebook", "Dashboard", "Study plan", "Review", "Progress"]) {
      await navigate(page, tab);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Open profile", exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close profile" }).click();
    for (const skill of ["Reading", "Listening", "Writing", "Speaking"]) {
      await practice(page, skill);
      await expect(page.getByRole("heading", { name: `${skill} test library` })).toBeVisible();
      await expect(page.locator("article.library-card").first(), `${skill} published content`).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${skill}-library.png`), fullPage: true });
    }
  });

  test("reading practice gives feedback and saves a mistake", async ({ page }) => {
    await practice(page, "Reading");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Question 1 of/ })).toBeVisible();
    const choices = page.locator(".practice-options label");
    if (await choices.count()) await choices.first().click();
    else await page.getByPlaceholder("Type your answer").fill("demo answer");
    await page.getByRole("button", { name: "Check answer" }).click();
    await expect(page.locator(".practice-feedback")).toContainText(/Correct|Not quite/);
    await page.getByRole("button", { name: "End practice" }).click();
    await navigate(page, "Mistake notebook");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("reading exam saves answers, flags and scores submission", async ({ page }) => {
    await practice(page, "Reading");
    await page.locator("article.library-card").first().getByRole("button", { name: "View test" }).click();
    await page.getByRole("button", { name: "Start timed exam" }).click();
    await page.getByRole("button", { name: "⚐ Flag for review" }).first().click();
    await expect(page.getByRole("link", { name: /Question 1, unanswered, flagged/ })).toBeVisible();
    const q = page.locator("article.question").first();
    const saved = page.waitForResponse(r => r.url().includes("/answers/") && r.request().method() === "PUT" && r.ok());
    if (await q.locator("label").count()) await q.locator("label").first().click();
    else { await q.getByPlaceholder("Type your answer").fill("demo answer"); await q.getByPlaceholder("Type your answer").blur(); }
    await saved;
    await expect(page.getByRole("link", { name: /Question 1, answered, flagged/ })).toBeVisible();
    await page.getByRole("button", { name: "Review and submit" }).click();
    await page.getByRole("button", { name: "Submit for scoring" }).click();
    await expect(page.getByRole("heading", { name: /Band \d\.\d/ })).toBeVisible();
  });

  test("listening exam loads and plays a real recording", async ({ page }) => {
    await practice(page, "Listening");
    await page.locator("article.library-card").first().getByRole("button", { name: "View test" }).click();
    await page.getByRole("button", { name: "Start timed exam" }).click();
    const audio = page.locator("audio").first();
    await expect(audio).toBeVisible();
    await audio.evaluate(async (el: HTMLAudioElement) => { await el.play(); });
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0);
    await audio.evaluate((el: HTMLAudioElement) => el.pause());
  });

  test("writing draft persists and speaking consent gates recording", async ({ page }) => {
    await practice(page, "Writing");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
    await page.getByLabel("Your essay").fill("Public transport makes travel more accessible and reduces congestion. Cities should improve reliable bus services before building more roads.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved to your account.")).toBeVisible();
    await expect(page.locator(".writing-history button").first()).toBeVisible();
    await practice(page, "Speaking");
    await page.getByRole("button", { name: "Part 2", exact: true }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start speaking interview" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("button", { name: "Start speaking interview" })).toBeEnabled();
  });

  test("live speaking connects and streams examiner audio", async ({ page }) => {
    test.setTimeout(150_000);
    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
        const ctx = new AudioContext();
        return ctx.createMediaStreamDestination().stream;
      }});
    });
    let received = 0;
    page.on("websocket", socket => socket.on("framereceived", frame => {
      if (Buffer.isBuffer(frame.payload)) received += frame.payload.length;
    }));
    await practice(page, "Speaking");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Start speaking interview" }).click();
    await page.getByRole("button", { name: "Connect to examiner" }).click();
    await expect(page.getByText("Listening. Take your time to finish your thought.", { exact: true })).toBeVisible({ timeout: 100_000 });
    expect(received).toBeGreaterThan(10000);
    await page.getByRole("button", { name: "Pause interview" }).click();
    await expect(page.getByRole("button", { name: "Connect to examiner" })).toBeVisible();
  });

  test("full mock opens and selects a Listening section", async ({ page }) => {
    await navigate(page, "Mock exams");
    await page.getByRole("button", { name: /Start full mock/ }).click();
    await expect(page.getByRole("heading", { name: "One mock. All four skills." })).toBeVisible();
    await page.getByRole("button", { name: /Begin with Listening/ }).click();
    await page.getByRole("button", { name: /Start listening section/i }).click();
    await expect(page.locator(".runner-header")).toBeVisible();
  });

  test("mobile navigation and sign-out/sign-in", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["Practice", "Review", "Explore"]) {
      await navigate(page, tab);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
    await page.screenshot({ path: info.outputPath("mobile-progress.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open profile", exact: true }).filter({ visible: true })).toBeVisible();
    await navigate(page, "Dashboard");
    await expect(page.getByRole("heading", { name: /Let’s practise/ })).toBeVisible();
    cookies = (await page.context().storageState()).cookies;
  });

  test("admin login is reachable and student credentials cannot enter", async ({ page }) => {
    await page.goto(process.env.DEMO_ADMIN_URL || "https://mockai.admin.chessinsight.uz");
    await expect(page.getByRole("button", { name: "Sign in to admin panel" })).toBeVisible();
    await page.getByLabel("Admin email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in to admin panel" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in to admin panel" })).toBeVisible();
  });
});

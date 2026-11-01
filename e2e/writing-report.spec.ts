import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("real writing evaluation renders scores and persists its report", async ({ page }, info) => {
  test.skip(!process.env.WRITING_REPORT_E2E, "Opt-in: creates a temporary account and incurs provider usage");
  test.setTimeout(300_000);
  page.setDefaultTimeout(15_000);
  const email = `writing-report-${randomUUID()}@example.test`;
  const headers = { Origin: new URL(info.project.use.baseURL!).origin };
  const registered = await page.request.post("/api/v1/auth/register", {
    headers, data: { display_name: "Temporary Writing report E2E", email, password: randomUUID() + "Aa1!" }
  });
  expect(registered.status()).toBe(201);
  console.log("Temporary writing E2E account", (await registered.json()).user.id, email);
  await page.goto("/");
  await page.getByRole("button", { name: "Practice", exact: true }).first().click();
  await page.locator(".practice-setup").getByRole("button", { name: /^Writing / }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Task prompt", exact: true }).fill("Some people believe cities should invest more in public transport than in new roads. To what extent do you agree or disagree?");
  await page.getByLabel("Your essay").fill(`Cities face growing traffic congestion, and governments must decide how to spend limited transport budgets. I largely agree that public transport should receive more investment than new roads, although essential road maintenance should not be neglected.

Reliable buses and trains can move many people while using relatively little space. A bus carrying forty commuters replaces numerous private vehicles, reducing congestion on busy routes. If services arrive frequently and connect residential areas with workplaces, residents have a practical reason to leave their cars at home. For example, a dedicated bus lane can make commuting times more predictable than driving through crowded junctions. These improvements also benefit people who cannot afford a car, allowing them to reach jobs and education more easily.

By contrast, building additional roads may provide only temporary relief. When driving becomes easier, more residents may choose to drive, eventually filling the new capacity. Roads also occupy valuable land that could otherwise support housing or public spaces. Nevertheless, public transport cannot meet every need. Emergency vehicles, delivery services and people living far from urban centres still require safe roads. Governments should therefore maintain existing routes and address dangerous bottlenecks rather than treating road construction as the main solution.

Public transport investment must also be planned carefully. Empty trains and poorly connected bus routes waste money, so authorities should study travel patterns and consult passengers before expanding services. Affordable fares and accessible stations are as important as new vehicles.

In conclusion, improving public transport offers a more sustainable response to urban congestion than continually expanding roads. A balanced policy should prioritise reliable and affordable services while preserving the road network needed for essential journeys.`);
  const submit = page.getByRole("button", { name: "Evaluate my essay" });
  await expect(submit).toBeDisabled();
  await page.getByRole("checkbox").check();
  const created = page.waitForResponse(r => r.url().endsWith("/writing/submissions") && r.request().method() === "POST");
  await submit.click();
  const submission = await (await created).json();
  try {
    let result: any;
    await expect.poll(async () => {
      const response = await page.request.get(`/api/v1/writing/submissions/${submission.id}`);
      expect(response.ok()).toBeTruthy();
      result = await response.json();
      expect(result.status, `Evaluation error: ${result.error_code}`).not.toBe("failed");
      return result.status;
    }, { timeout: 240_000, intervals: [2000, 5000] }).toBe("completed");
    expect(result.report.criteria).toHaveLength(4);
    const average = result.report.criteria.reduce((sum: number, c: { score: number }) => sum + c.score, 0) / 4;
    expect(result.report.overall).toBe(Math.round(average * 2) / 2);
    await expect(page.getByRole("heading", { name: "Your next step, made clearer." })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".writing-criteria article")).toHaveCount(4);
    await expect(page.getByRole("heading", { name: "Your revision plan" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("writing-report.png"), fullPage: true });
    await page.reload();
    await page.getByRole("button", { name: "Practice", exact: true }).first().click();
    await page.locator(".practice-setup").getByRole("button", { name: /^Writing / }).click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.locator(".writing-history button").first().click();
    await expect(page.getByRole("heading", { name: "Your next step, made clearer." })).toBeVisible();
  } finally {
    expect((await page.request.delete(`/api/v1/writing/submissions/${submission.id}`, { headers })).status()).toBe(204);
  }
});

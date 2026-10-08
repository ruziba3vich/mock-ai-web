import { expect, test } from "@playwright/test";

test("a student can register, practise, save writing, and complete a mock", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${suffix}@example.test`;
  const password = `E2e-safe-${suffix}!`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Full name").fill("E2E Student");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /Let’s practise, E2E/ })).toBeVisible();
  await expect(page.getByText("Urban Gardens", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Practice" }).first().click();
  await page.getByRole("button", { name: /Writing\s*Task 1 and Task 2 with feedback/ }).click();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: "Write. Understand. Revise." })).toBeVisible();
  await page.getByLabel("Your essay").fill("Public transport can reduce traffic and make daily travel more reliable for workers and students.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved to your account.")).toBeVisible();
  await expect(page.getByRole("button", { name: /cities should invest more in public transport/i })).toContainText("draft");

  await page.getByRole("button", { name: "Practice" }).first().click();
  await page.getByRole("button", { name: /Reading\s*Passages, detail and inference/ }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: /Question 1 of/ })).toBeVisible();
  const choices = page.locator(".practice-options label");
  if (await choices.count()) await choices.first().click();
  else await page.getByPlaceholder("Type your answer").fill("e2e test answer");
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.locator(".practice-feedback")).toBeVisible();
  await expect(page.locator(".practice-feedback")).toContainText(/Correct|Not quite/);

  await page.getByRole("button", { name: "End practice" }).click();
  await expect(page.getByRole("heading", { name: "Reading test library" })).toBeVisible();
  const readingCard = page.locator("article.library-card").filter({ hasText: "Urban Gardens" });
  await readingCard.getByRole("button", { name: "View test" }).click();
  await expect(page.getByRole("dialog", { name: "Urban Gardens" })).toBeVisible();
  await page.getByRole("button", { name: "Start timed exam" }).click();
  await expect(page.getByText("Urban Gardens", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "⚐ Flag for review" }).first().click();
  await expect(page.getByRole("link", { name: /Question 1, unanswered, flagged/ })).toBeVisible();
  const saved = page.waitForResponse(response => response.url().includes("/answers/") && response.request().method() === "PUT" && response.ok());
  const firstQuestion = page.locator("article.question").first();
  const firstOption = firstQuestion.locator("label").first();
  if (await firstOption.count()) await firstOption.click();
  else {
    await firstQuestion.getByPlaceholder("Type your answer").fill("e2e exam answer");
    await firstQuestion.getByPlaceholder("Type your answer").blur();
  }
  await saved;
  await expect(page.getByRole("link", { name: /Question 1, answered, flagged/ })).toBeVisible();
  await page.getByRole("button", { name: "Review and submit" }).click();
  await expect(page.getByRole("dialog", { name: "Submit this exam?" })).toContainText(/unanswered questions/);
  await page.getByRole("button", { name: "Submit for scoring" }).click();
  await expect(page.getByRole("heading", { name: /Band \d\.\d/ })).toBeVisible();
  await expect(page.locator(".result-lead")).toContainText(/You answered\s*\d+\s*of\s*\d+/);
  await page.getByRole("button", { name: "Return to dashboard" }).click();
  await page.getByRole("button", { name: "Progress" }).first().click();
  await expect(page.getByText("Completed exams").locator("..")).toContainText("1");
  await expect(page.getByText("Urban Gardens", { exact: true })).toBeVisible();
});

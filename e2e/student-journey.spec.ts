import { expect, test } from "@playwright/test";
import { signInAsStudent } from "./helpers/telegram-auth";

test("a student can sign in, practise, save writing, and complete a mock", async ({ page, baseURL }) => {
  await page.goto("/");
  // The root path is the landing page now, and it has to speak to both
  // audiences before it asks anyone to sign in.
  await expect(page.getByRole("heading", { name: /Practise IELTS/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "For learning centres" })).toBeVisible();
  // Sign-in is one click away, Telegram-only, with no password form.
  await page.getByRole("button", { name: "Start practising" }).first().click();
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue with Telegram/ })).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);

  // The bot hands out login links from a private chat a browser cannot hold,
  // so the test signs in through the Mini App door with signed init data.
  await signInAsStudent(page.request, new URL(baseURL!).origin, "E2E Student");
  await page.reload();
  await expect(page.getByRole("heading", { name: /Keep building, E2E/ })).toBeVisible();
  await expect(page.getByText("Urban Gardens", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Practice" }).first().click();
  await page.getByRole("button", { name: /Writing\s*Task 1 and Task 2 with feedback/ }).click();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: "Write. Understand. Revise." })).toBeVisible();
  await page.getByLabel("Your essay").fill("Public transport can reduce traffic and make daily travel more reliable for workers and students.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved to your account.")).toBeVisible();
  await expect(page.locator(".writing-history button").filter({ hasText: "draft" }).first()).toBeVisible();

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

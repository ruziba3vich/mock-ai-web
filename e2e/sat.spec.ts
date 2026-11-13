import { expect, test } from "@playwright/test";

// mock-ai.uz/sat holds the address until SAT practice exists, and sends the visitor back to IELTS.
for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`the SAT page says coming soon and leads back to IELTS at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/**", route => route.fulfill({ status: 401, json: {} }));
    await page.goto("/sat");
    await expect(page.getByRole("heading", { name: /SAT practice.*Coming soon!/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`sat-${width}.png`) });
    await page.getByRole("link", { name: "Go to IELTS practice" }).click();
    await expect(page).toHaveURL(/\/$/);
    if (width > 1000) await expect(page.getByRole("link", { name: "SAT", exact: true })).toHaveAttribute("href", "/sat");
    await expect(page.getByRole("heading", { name: /Know your IELTS band/ })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`landing-${width}.png`) });
  });
}

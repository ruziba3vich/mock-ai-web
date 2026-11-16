import type { Page } from "@playwright/test";

/** Opens an admin section. Below 1024 px the side nav is a drawer behind the menu button. */
export async function openSection(page: Page, name: string) {
  const item = page.getByRole("navigation", { name: "Admin sections", includeHidden: true }).getByRole("button", { name, exact: true, includeHidden: true });
  await item.waitFor({ state: "attached" });
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await item.click();
}

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StarsAdmin from "./StarsAdmin";
import { starsAdminAPI } from "./stars";

vi.mock("./stars", async importOriginal => ({
  ...(await importOriginal<typeof import("./stars")>()),
  starsAdminAPI: { get: vi.fn(), setPrice: vi.fn() },
}));

const pricing = { price_per_star_minor: 100_000, currency: "UZS", updated_at: "2026-11-10T00:00:00Z" };

describe("pricing tab", () => {
  it("shows the price of one star and recent purchases, and saves a new price in so'm", async () => {
    vi.mocked(starsAdminAPI.get).mockResolvedValueOnce({ pricing, payments_available: true, provider: "inpay", purchases: [
      { id: "p1", kind: "star", package_id: "stars-350", stars: 350, amount_minor: 35_000_000, currency: "UZS", status: "paid", buyer: "Cambridge Centre", buyer_kind: "centre", created_at: "2026-11-10T09:00:00Z" },
    ] });
    vi.mocked(starsAdminAPI.setPrice).mockResolvedValueOnce({ ...pricing, price_per_star_minor: 120_000 });
    const user = userEvent.setup();
    render(<StarsAdmin />);
    const price = await screen.findByRole("textbox", { name: "Price of one star in so'm" });
    expect(price).toHaveValue("1000");
    expect(screen.getByText(/35 stars\) costs 35 000 so'm/)).toBeInTheDocument();
    expect(screen.getByText("Selling via inpay")).toBeInTheDocument();
    expect(screen.getByText(/Cambridge Centre · 350 stars/)).toBeInTheDocument();
    await user.clear(price); await user.type(price, "1200");
    await user.click(screen.getByRole("button", { name: "Save price" }));
    expect(starsAdminAPI.setPrice).toHaveBeenCalledWith(120_000);
    expect(await screen.findByText("Saved. One star costs 1 200 so'm.")).toBeInTheDocument();
  });

  it("refuses a price below 1 000 so'm before asking the server", async () => {
    vi.mocked(starsAdminAPI.get).mockResolvedValueOnce({ pricing, payments_available: false, provider: "none", purchases: [] });
    const user = userEvent.setup();
    render(<StarsAdmin />);
    const price = await screen.findByRole("textbox", { name: "Price of one star in so'm" });
    await user.clear(price); await user.type(price, "500");
    await user.click(screen.getByRole("button", { name: "Save price" }));
    expect(starsAdminAPI.setPrice).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number of so'm between 1 000 and 10 000 000");
  });
});

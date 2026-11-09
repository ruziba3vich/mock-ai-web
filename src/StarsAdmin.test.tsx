import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StarsAdmin from "./StarsAdmin";
import { starsAdminAPI } from "./stars";

vi.mock("./stars", async importOriginal => ({
  ...(await importOriginal<typeof import("./stars")>()),
  starsAdminAPI: { get: vi.fn(), setPrice: vi.fn() },
}));

const pricing = { price_per_star_minor: 3_000_000, currency: "UZS", updated_at: "2026-11-10T00:00:00Z" };

describe("pricing tab", () => {
  it("shows the current price and recent purchases, and saves a new price in so'm", async () => {
    vi.mocked(starsAdminAPI.get).mockResolvedValueOnce({ pricing, payments_available: true, provider: "inpay", purchases: [
      { id: "p1", package_id: "stars-40", stars: 40, amount_minor: 120_000_000, currency: "UZS", status: "paid", buyer: "Cambridge Centre", buyer_kind: "centre", created_at: "2026-11-10T09:00:00Z" },
    ] });
    vi.mocked(starsAdminAPI.setPrice).mockResolvedValueOnce({ ...pricing, price_per_star_minor: 2_500_000 });
    const user = userEvent.setup();
    render(<StarsAdmin />);
    const input = await screen.findByRole("textbox", { name: "Price in so'm" });
    expect(input).toHaveValue("30000");
    expect(screen.getByText("Selling via inpay")).toBeInTheDocument();
    expect(screen.getByText(/Cambridge Centre · 40 stars/)).toBeInTheDocument();
    await user.clear(input); await user.type(input, "25000");
    expect(screen.getByText("125 000 so'm")).toBeInTheDocument(); // 5 mocks preview
    await user.click(screen.getByRole("button", { name: "Save price" }));
    expect(starsAdminAPI.setPrice).toHaveBeenCalledWith(2_500_000);
    expect(await screen.findByText("Saved. One full mock now costs 25 000 so'm.")).toBeInTheDocument();
  });

  it("refuses a price below 1 000 so'm before asking the server", async () => {
    vi.mocked(starsAdminAPI.get).mockResolvedValueOnce({ pricing, payments_available: false, provider: "none", purchases: [] });
    const user = userEvent.setup();
    render(<StarsAdmin />);
    const input = await screen.findByRole("textbox", { name: "Price in so'm" });
    await user.clear(input); await user.type(input, "500");
    await user.click(screen.getByRole("button", { name: "Save price" }));
    expect(starsAdminAPI.setPrice).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("between 1 000 and 10 000 000");
  });
});

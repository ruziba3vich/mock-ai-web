import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StarsAdmin from "./StarsAdmin";
import { starsAdminAPI } from "./stars";

vi.mock("./stars", async importOriginal => ({
  ...(await importOriginal<typeof import("./stars")>()),
  starsAdminAPI: { get: vi.fn(), setPrices: vi.fn() },
}));

const pricing = { price_per_star_minor: 3_000_000, writing_price_minor: 1_000_000, speaking_price_minor: 1_000_000, currency: "UZS", updated_at: "2026-11-10T00:00:00Z" };

describe("pricing tab", () => {
  it("shows all three prices and recent purchases, and saves new prices in so'm", async () => {
    vi.mocked(starsAdminAPI.get).mockResolvedValueOnce({ pricing, payments_available: true, provider: "inpay", purchases: [
      { id: "p1", kind: "star", package_id: "stars-40", stars: 40, amount_minor: 120_000_000, currency: "UZS", status: "paid", buyer: "Cambridge Centre", buyer_kind: "centre", created_at: "2026-11-10T09:00:00Z" },
      { id: "p2", kind: "writing", package_id: "writing-5", stars: 5, amount_minor: 5_000_000, currency: "UZS", status: "pending", buyer: "Aziz", buyer_kind: "student", created_at: "2026-11-10T10:00:00Z" },
    ] });
    vi.mocked(starsAdminAPI.setPrices).mockResolvedValueOnce({ ...pricing, writing_price_minor: 800_000 });
    const user = userEvent.setup();
    render(<StarsAdmin />);
    expect(await screen.findByRole("textbox", { name: "Full mock (1 star) price in so'm" })).toHaveValue("30000");
    const writing = screen.getByRole("textbox", { name: "Writing check price in so'm" });
    expect(writing).toHaveValue("10000");
    expect(screen.getByRole("textbox", { name: "Speaking interview price in so'm" })).toHaveValue("10000");
    expect(screen.getByText("Selling via inpay")).toBeInTheDocument();
    expect(screen.getByText(/Cambridge Centre · 40 stars/)).toBeInTheDocument();
    expect(screen.getByText(/Aziz · 5 Writing checks/)).toBeInTheDocument();
    await user.clear(writing); await user.type(writing, "8000");
    await user.click(screen.getByRole("button", { name: "Save prices" }));
    expect(starsAdminAPI.setPrices).toHaveBeenCalledWith({ price_per_star_minor: 3_000_000, writing_price_minor: 800_000, speaking_price_minor: 1_000_000 });
    expect(await screen.findByText(/a Writing check 8 000 so'm/)).toBeInTheDocument();
  });

  it("refuses a price below 1 000 so'm before asking the server", async () => {
    vi.mocked(starsAdminAPI.get).mockResolvedValueOnce({ pricing, payments_available: false, provider: "none", purchases: [] });
    const user = userEvent.setup();
    render(<StarsAdmin />);
    const speaking = await screen.findByRole("textbox", { name: "Speaking interview price in so'm" });
    await user.clear(speaking); await user.type(speaking, "500");
    await user.click(screen.getByRole("button", { name: "Save prices" }));
    expect(starsAdminAPI.setPrices).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Speaking interview: enter a whole number");
  });
});

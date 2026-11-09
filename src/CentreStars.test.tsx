import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CentreStars from "./CentreStars";
import { centreStarsAPI } from "./stars";

vi.mock("./stars", async importOriginal => ({
  ...(await importOriginal<typeof import("./stars")>()),
  centreStarsAPI: { get: vi.fn(), grant: vi.fn() },
}));

const activity = [
  { id: "l2", reason: "full_mock" as const, delta: -1, balance_after: 9, student_name: "Aziz Karimov", created_at: "2026-11-09T10:00:00Z" },
  { id: "l1", reason: "grant" as const, delta: 10, balance_after: 10, note: "Invoice 17", created_at: "2026-11-08T10:00:00Z" },
];

describe("centre stars panel", () => {
  it("shows a centre administrator the balance and who used stars, without a way to add them", async () => {
    vi.mocked(centreStarsAPI.get).mockResolvedValueOnce({ centre_id: "c1", balance: 9, full_mock_cost: 1, can_grant: false, activity });
    render(<CentreStars centreID="c1" />);
    expect(await screen.findByText("Enough for 9 full mocks.")).toBeInTheDocument();
    expect(screen.getByText("Aziz Karimov started a full mock")).toBeInTheDocument();
    expect(screen.getByText("Invoice 17")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add stars" })).not.toBeInTheDocument();
  });

  it("lets a platform administrator add stars with a note", async () => {
    vi.mocked(centreStarsAPI.get).mockResolvedValueOnce({ centre_id: "c1", balance: 0, full_mock_cost: 1, can_grant: true, activity: [] });
    vi.mocked(centreStarsAPI.grant).mockResolvedValueOnce({ centre_id: "c1", balance: 25, full_mock_cost: 1, can_grant: true, activity: [{ id: "l3", reason: "grant", delta: 25, balance_after: 25, note: "Contract Nov", created_at: "2026-11-10T10:00:00Z" }] });
    const user = userEvent.setup();
    render(<CentreStars centreID="c1" />);
    expect(await screen.findByText(/No stars left/)).toBeInTheDocument();
    const amount = screen.getByRole("spinbutton", { name: "Add stars" });
    await user.clear(amount); await user.type(amount, "25");
    await user.type(screen.getByRole("textbox", { name: /Note/ }), "Contract Nov");
    await user.click(screen.getByRole("button", { name: "Add stars" }));
    expect(centreStarsAPI.grant).toHaveBeenCalledWith("c1", 25, expect.any(String), "Contract Nov");
    expect(await screen.findByText("25 stars added.")).toBeInTheDocument();
    expect(screen.getByText("Enough for 25 full mocks.")).toBeInTheDocument();
  });
});

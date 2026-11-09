import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TelegramResults, { telegramAPI } from "./TelegramResults";

afterEach(() => { vi.restoreAllMocks(); delete window.Telegram; });

describe("Telegram results card", () => {
  it("connects through the bot and notices when the student pressed Start", async () => {
    vi.spyOn(telegramAPI, "status")
      .mockResolvedValueOnce({ linked: false, started: false, results_enabled: true })
      .mockResolvedValueOnce({ linked: false, started: false, results_enabled: true })
      .mockResolvedValue({ linked: true, started: true, results_enabled: true });
    vi.spyOn(telegramAPI, "link").mockResolvedValue({ token: "abc", start: "l_abc", expires_at: "2026-11-10T10:30:00Z" });
    const openTelegramLink = vi.fn();
    window.Telegram = { WebApp: { initData: "x", ready() {}, expand() {}, close() {}, openTelegramLink } };
    const user = userEvent.setup();
    render(<TelegramResults pollMs={20} />);
    await user.click(await screen.findByRole("button", { name: "Connect Telegram" }));
    expect(openTelegramLink).toHaveBeenCalledWith("https://t.me/mockai_bot?start=l_abc");
    expect(screen.getByText(/Press/)).toHaveTextContent("Press Start in the bot");
    expect(await screen.findByText("Connected. Your next result will arrive in Telegram.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Send my results to Telegram/ })).toBeChecked();
  });

  it("lets a connected student switch results off", async () => {
    vi.spyOn(telegramAPI, "status").mockResolvedValue({ linked: true, started: true, results_enabled: true });
    const set = vi.spyOn(telegramAPI, "setResults").mockResolvedValue({ linked: true, started: true, results_enabled: false });
    const user = userEvent.setup();
    render(<TelegramResults />);
    await user.click(await screen.findByRole("checkbox", { name: /Send my results to Telegram/ }));
    expect(set).toHaveBeenCalledWith(false);
    expect(await screen.findByText("Results won’t be sent to Telegram.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});

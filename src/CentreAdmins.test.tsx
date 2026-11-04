import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import CentreAdmins from "./CentreAdmins";
import { apiRequest } from "./auth";
vi.mock("./auth", async importOriginal => ({ ...await importOriginal<typeof import("./auth")>(), apiRequest: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const centre = { id: "c1", slug: "s", name: "Oxford Study Centre", join_code: "AAAAAAAAAAAAAAAA", include_global: true, ai_enabled: true, disabled: false, students: 1, exams: 0 };
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<CentreAdmins centre={centre} />);
  await user.click(screen.getByRole("button", { name: "Administrators" }));
};

it("shows a new administrator's password once, because it is never shown again", async () => {
  const request = vi.mocked(apiRequest);
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ admins: [] });
  await open(user);
  await screen.findByText("No one can administer this centre yet.");
  await user.type(screen.getByLabelText("Name"), "Dilnoza Karimova");
  await user.type(screen.getByLabelText("Email"), "dilnoza@centre.uz");
  request
    .mockResolvedValueOnce({ admin: { id: "ad1", email: "dilnoza@centre.uz", display_name: "Dilnoza Karimova", disabled: false, created_at: "", password: "qmxtp-vhjkd-wnrsz-bcfgy-23456" } })
    .mockResolvedValueOnce({ admins: [{ id: "ad1", email: "dilnoza@centre.uz", display_name: "Dilnoza Karimova", disabled: false, created_at: "" }] });
  await user.click(screen.getByRole("button", { name: "Add administrator" }));
  const shown = await screen.findByLabelText("One-time password");
  expect(shown).toHaveValue("qmxtp-vhjkd-wnrsz-bcfgy-23456");
  // The listing that follows never carries a password, so dismissing the
  // block is the last chance to copy it.
  await user.click(screen.getByRole("button", { name: "I have saved it" }));
  expect(screen.queryByLabelText("One-time password")).not.toBeInTheDocument();
  expect(screen.getByText("dilnoza@centre.uz")).toBeInTheDocument();
});

it("re-keys a locked-out administrator, since there is no reset email to send", async () => {
  const request = vi.mocked(apiRequest);
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ admins: [{ id: "ad1", email: "dilnoza@centre.uz", display_name: "Dilnoza Karimova", disabled: false, created_at: "" }] });
  await open(user);
  await screen.findByText("dilnoza@centre.uz");
  request.mockResolvedValueOnce({ admin: { id: "ad1", email: "dilnoza@centre.uz", display_name: "D", disabled: false, created_at: "", password: "newpw-newpw-newpw-newpw-newpw" } });
  await user.click(screen.getByRole("button", { name: "New password" }));
  expect(await screen.findByLabelText("One-time password")).toHaveValue("newpw-newpw-newpw-newpw-newpw");
  await waitFor(() => expect(request).toHaveBeenCalledWith("/api/v1/admin/centres/c1/admins/ad1", {
    method: "PUT", body: JSON.stringify({ reset_password: true }),
  }));
});

it("blocks and restores sign-in for an administrator", async () => {
  const request = vi.mocked(apiRequest);
  const user = userEvent.setup();
  request.mockResolvedValueOnce({ admins: [{ id: "ad1", email: "a@b.uz", display_name: "A", disabled: false, created_at: "" }] });
  await open(user);
  await screen.findByText("a@b.uz");
  request
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce({ admins: [{ id: "ad1", email: "a@b.uz", display_name: "A", disabled: true, created_at: "" }] });
  await user.click(screen.getByRole("button", { name: "Block sign-in" }));
  expect(await screen.findByRole("button", { name: "Allow sign-in" })).toBeInTheDocument();
  await waitFor(() => expect(request).toHaveBeenCalledWith("/api/v1/admin/centres/c1/admins/ad1", {
    method: "PUT", body: JSON.stringify({ disabled: true }),
  }));
});

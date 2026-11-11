import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import AdminApp from "./AdminApp";
import { APIError, apiRequest } from "./auth";
vi.mock("./auth", async importOriginal => ({ ...await importOriginal<typeof import("./auth")>(), apiRequest: vi.fn() }));
vi.mock("./ContentAdmin", () => ({ default: () => <div>Private content editor</div> }));
vi.mock("./AdminDashboard", () => ({ default: () => <div>Private dashboard</div> }));
vi.mock("./AdminStudents", () => ({ default: () => <div>Private student progress</div> }));
vi.mock("./MarkingAdmin", () => ({ default: () => <div>Private marking queue</div> }));
vi.mock("./MyCentre", () => ({ default: () => <div>Private centre details</div> }));
vi.mock("./CentresAdmin", () => ({ default: () => <div>Private centre list</div> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("uses only the separate admin login and logout endpoints", async () => {
 const request = vi.mocked(apiRequest);
 request.mockRejectedValueOnce(new APIError(401, "Admin sign-in required"));
 const user = userEvent.setup(); render(<AdminApp />);
 expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
 expect(screen.queryByText("Private content editor")).not.toBeInTheDocument();
 await user.type(screen.getByLabelText("Admin email"), "editor@example.com");
 await user.type(screen.getByLabelText("Password"), "separate-password");
 request.mockResolvedValueOnce({ admin: { id: "a1", email: "editor@example.com", display_name: "Editor", role: "platform", permissions: ["overview","students","exams","challenges","vocabulary","writing","speaking","centres"] } });
 await user.click(screen.getByRole("button", { name: "Sign in to admin panel" }));
 await screen.findByText("Private dashboard");
 await user.click(screen.getByRole("button",{name:"Exams"}));
 expect(await screen.findByText("Private content editor")).toBeInTheDocument();
 expect(request).toHaveBeenCalledWith("/api/v1/admin/auth/login", { method: "POST", body: JSON.stringify({ email: "editor@example.com", password: "separate-password" }) });
 request.mockResolvedValueOnce(undefined);
 await user.click(screen.getByRole("button", { name: "Sign out" }));
 expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
 expect(request).toHaveBeenCalledWith("/api/v1/admin/auth/logout", { method: "POST" });
 expect(screen.getByLabelText("Password")).toHaveValue("");
});
it("does not unlock content when login fails", async () => {
 vi.mocked(apiRequest).mockRejectedValue(new APIError(401, "Invalid admin credentials"));
 const user = userEvent.setup(); render(<AdminApp />);
 await screen.findByRole("heading", { name: "Admin sign in" });
 await user.type(screen.getByLabelText("Admin email"), "student@example.com");
 await user.type(screen.getByLabelText("Password"), "student-password");
 await user.click(screen.getByRole("button", { name: "Sign in to admin panel" }));
 expect(await screen.findByRole("alert")).toHaveTextContent("Invalid admin credentials");
 expect(screen.queryByText("Private content editor")).not.toBeInTheDocument();
});

it("offers learning centres to a platform administrator only", async () => {
 const request = vi.mocked(apiRequest);
 request.mockResolvedValueOnce({ admin: { id: "a1", email: "platform@example.com", display_name: "Platform", role: "platform", permissions: ["overview","students","exams","centres"] } });
 render(<AdminApp />);
 expect(await screen.findByRole("button", { name: "Centres" })).toBeInTheDocument();
});

it("hides learning centres from a centre's own administrator and names their centre", async () => {
 const request = vi.mocked(apiRequest);
 request.mockResolvedValueOnce({ admin: { id: "a2", email: "alpha@example.com", display_name: "Alpha Admin", centre_id: "c1", centre_name: "Alpha Centre", role: "centre", permissions: ["overview","students","marking","centre"] } });
 render(<AdminApp />);
 await screen.findByText("Private dashboard");
 // The tab is the only route to the centre list, and a centre admin is
 // refused by the API as well; this keeps them from seeing a dead end.
 expect(screen.queryByRole("button", { name: "Centres" })).not.toBeInTheDocument();
 // Every save they make lands in their centre, so the panel says which one.
 expect(screen.getByText("Alpha Centre")).toBeInTheDocument();
});

it("offers only the tabs the server permits, whatever the account looks like", async () => {
 const request = vi.mocked(apiRequest);
 // A centre administrator: no Centres tab, and Marking and Your centre instead.
 request.mockResolvedValueOnce({ admin: { id: "a3", email: "c@x", display_name: "Centre Admin",
   centre_id: "c1", centre_name: "Oxford", role: "centre",
   permissions: ["overview","students","marking","centre"] } });
 render(<AdminApp />);
 await screen.findByText("Private dashboard");
 expect(screen.queryByRole("button", { name: "Centres" })).not.toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Marking" })).toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Your centre" })).toBeInTheDocument();
 // Permissions drive it, not the presence of centre_id: an account carrying a
 // centre but permitted Centres would still be shown it.
 expect(screen.queryByRole("button", { name: "Exams" })).not.toBeInTheDocument();
});

it("never leaves an unpermitted tab selected", async () => {
 const request = vi.mocked(apiRequest);
 request.mockResolvedValueOnce({ admin: { id: "a4", email: "p@x", display_name: "Platform",
   role: "platform", permissions: ["overview","centres"] } });
 const user = userEvent.setup();
 render(<AdminApp />);
 await user.click(await screen.findByRole("button", { name: "Centres" }));
 // Signing in as someone without that tab must not strand them on a blank page.
 cleanup();
 request.mockResolvedValueOnce({ admin: { id: "a5", email: "c@x", display_name: "Centre",
   centre_id: "c1", role: "centre", permissions: ["overview","marking"] } });
 render(<AdminApp />);
 await screen.findByText("Private dashboard");
 expect(screen.queryByRole("button", { name: "Centres" })).not.toBeInTheDocument();
});

it("still shows a usable panel when the API sends no permissions", async () => {
 const request = vi.mocked(apiRequest);
 // An API older than this build, which is possible at any moment: the panel
 // and the server deploy from separate repositories.
 request.mockResolvedValueOnce({ admin: { id: "a6", email: "old@x", display_name: "Legacy" } });
 render(<AdminApp />);
 await screen.findByText("Private dashboard");
 expect(screen.getByRole("button", { name: "Students" })).toBeInTheDocument();
 // Derived the old way: no centre means a platform administrator.
 expect(screen.getByRole("button", { name: "Centres" })).toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Marking" })).not.toBeInTheDocument();
});

it("registers a learning centre through Google, carrying only the centre name", async () => {
 vi.mocked(apiRequest).mockRejectedValueOnce(new APIError(401, "Admin sign-in required"));
 const user = userEvent.setup(); render(<AdminApp />);
 expect(await screen.findByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/v1/admin/auth/google/start");
 await user.click(screen.getByRole("button", { name: "Register your centre" }));
 const name = screen.getByLabelText("Centre name");
 expect(name).toHaveAttribute("name", "centre_name");
 expect(name.closest("form")).toHaveAttribute("action", "/api/v1/admin/auth/google/start");
 expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
});

it("lands a centre that just registered with Google on its centre page", async () => {
 window.history.replaceState(null, "", "/?registered");
 vi.mocked(apiRequest).mockResolvedValueOnce({ admin: { id: "a2", email: "owner@example.com", display_name: "Owner", centre_id: "c1", centre_name: "Registon", role: "centre", permissions: ["overview", "centre", "sessions"] } });
 render(<AdminApp />);
 expect(await screen.findByText("Private centre details")).toBeInTheDocument();
 expect(window.location.search).toBe("");
});

it("sends a Google account with no centre to the registration screen with the reason", async () => {
 window.history.replaceState(null, "", "/?register&auth=no_account");
 vi.mocked(apiRequest).mockRejectedValueOnce(new APIError(401, "Admin sign-in required"));
 render(<AdminApp />);
 expect(await screen.findByRole("alert")).toHaveTextContent("No learning centre is registered with that Google account");
 expect(screen.getByLabelText("Centre name")).toBeInTheDocument();
 expect(window.location.search).toBe("?register=");
 window.history.replaceState(null, "", "/");
});

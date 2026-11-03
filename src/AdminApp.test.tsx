import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import AdminApp from "./AdminApp";
import { APIError, apiRequest } from "./auth";
vi.mock("./auth", async importOriginal => ({ ...await importOriginal<typeof import("./auth")>(), apiRequest: vi.fn() }));
vi.mock("./ContentAdmin", () => ({ default: () => <div>Private content editor</div> }));
vi.mock("./AdminDashboard", () => ({ default: () => <div>Private dashboard</div> }));
vi.mock("./AdminStudents", () => ({ default: () => <div>Private student progress</div> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("uses only the separate admin login and logout endpoints", async () => {
 const request = vi.mocked(apiRequest);
 request.mockRejectedValueOnce(new APIError(401, "Admin sign-in required"));
 const user = userEvent.setup(); render(<AdminApp />);
 expect(await screen.findByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
 expect(screen.queryByText("Private content editor")).not.toBeInTheDocument();
 await user.type(screen.getByLabelText("Admin email"), "editor@example.com");
 await user.type(screen.getByLabelText("Password"), "separate-password");
 request.mockResolvedValueOnce({ admin: { id: "a1", email: "editor@example.com", display_name: "Editor" } });
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
 request.mockResolvedValueOnce({ admin: { id: "a1", email: "platform@example.com", display_name: "Platform" } });
 render(<AdminApp />);
 expect(await screen.findByRole("button", { name: "Centres" })).toBeInTheDocument();
});

it("hides learning centres from a centre's own administrator and names their centre", async () => {
 const request = vi.mocked(apiRequest);
 request.mockResolvedValueOnce({ admin: { id: "a2", email: "alpha@example.com", display_name: "Alpha Admin", centre_id: "c1", centre_name: "Alpha Centre" } });
 render(<AdminApp />);
 await screen.findByText("Private dashboard");
 // The tab is the only route to the centre list, and a centre admin is
 // refused by the API as well; this keeps them from seeing a dead end.
 expect(screen.queryByRole("button", { name: "Centres" })).not.toBeInTheDocument();
 // Every save they make lands in their centre, so the panel says which one.
 expect(screen.getByText("Alpha Centre")).toBeInTheDocument();
});

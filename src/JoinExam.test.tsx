import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APIError, User, authAPI } from "./auth";
import JoinExam, { ExamLobby } from "./JoinExam";
import ExamSessions from "./ExamSessions";
import { ExamSeat, PCState, examSessionAPI, pcAPI } from "./examSession";
import { starsAPI } from "./stars";
import { telegramAPI } from "./TelegramResults";

// Most tests run in an ordinary browser, which is not a centre computer.
beforeEach(() => { vi.spyOn(pcAPI, "me").mockResolvedValue(null); });
afterEach(() => { vi.restoreAllMocks(); });

const aziza = { id: "u1", display_name: "Aziza Karimova" } as User;
const seat = (over: Partial<ExamSeat> = {}): ExamSeat => ({
  id: "s1", title: "Saturday mock", centre_name: "Oxford Study Centre",
  starts_at: "2026-11-14T05:00:00Z", ends_at: "2026-11-14T10:00:00Z", now: new Date().toISOString(), ...over,
});
const noop = async () => undefined;

describe("joining a centre's mock with an exam code", () => {
  it("seats a student who has no account and tells the app who they now are", async () => {
    const lookup = vi.spyOn(examSessionAPI, "lookup").mockResolvedValue(seat());
    const join = vi.spyOn(examSessionAPI, "join").mockResolvedValue(seat({ listening_exam_id: "l1", reading_exam_id: "r1" }));
    vi.spyOn(authAPI, "me").mockResolvedValue(aziza);
    const onUser = vi.fn(), onJoined = vi.fn();
    const user = userEvent.setup();
    render(<JoinExam user={null} onUser={onUser} onJoined={onJoined} onLogout={noop} />);

    await user.type(screen.getByLabelText("Exam code"), "ab c-234");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(lookup).toHaveBeenCalledWith("ABC234");
    expect(await screen.findByRole("heading", { name: "Saturday mock" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Full name"), "Aziza Karimova");
    await user.type(screen.getByLabelText("Phone or Telegram username"), "@aziza");
    await user.click(screen.getByRole("button", { name: "Join the exam" }));
    await vi.waitFor(() => expect(onJoined).toHaveBeenCalled());
    expect(join).toHaveBeenCalledWith("ABC234", "Aziza Karimova", "@aziza");
    expect(onUser).toHaveBeenCalledWith(aziza);
    expect(onJoined.mock.calls[0][0]).toMatchObject({ user_id: "u1", seat: { listening_exam_id: "l1" } });
  });

  it("says why a code was refused and stays on the code step", async () => {
    vi.spyOn(examSessionAPI, "lookup").mockRejectedValue(new APIError(404, "This exam code is not active."));
    const user = userEvent.setup();
    render(<JoinExam user={null} onUser={vi.fn()} onJoined={vi.fn()} onLogout={noop} />);
    await user.type(screen.getByLabelText("Exam code"), "ZZZ999");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This exam code is not active.");
    expect(screen.getByLabelText("Exam code")).toBeInTheDocument();
  });
});

describe("a centre computer", () => {
  const paired = (session?: PCState["session"]): PCState => ({ status: "paired", number: 7, centre_name: "Oxford Study Centre", session });
  const exam = { id: "s1", title: "Saturday mock", starts_at: "2026-11-14T05:00:00Z", ends_at: "2026-11-14T10:00:00Z", open: true, code: "ABC234" };

  it("shows a pairing code until an administrator approves it, then its number", async () => {
    let state: PCState = { status: "pending", pair_code: "K7M2QX" };
    vi.spyOn(pcAPI, "me").mockImplementation(async () => state);
    render(<JoinExam user={null} onUser={vi.fn()} onJoined={vi.fn()} onLogout={noop} pollMs={20} />);
    expect(await screen.findByLabelText("Pairing code")).toHaveTextContent("K7M2QX");
    expect(screen.getByRole("img", { name: /approve this computer/ })).toBeInTheDocument();
    state = paired();
    expect(await screen.findByRole("heading", { name: "PC 7" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No exam right now" })).toBeInTheDocument();
  });

  it("joins the student who scanned its QR without asking for anything", async () => {
    vi.spyOn(pcAPI, "me").mockResolvedValue(paired(exam));
    vi.spyOn(pcAPI, "login").mockResolvedValue({ token: "tok-1", expires_at: "2026-11-14T05:05:00Z" });
    const poll = vi.spyOn(pcAPI, "poll").mockResolvedValueOnce({ signed_in: false, contact: "" }).mockResolvedValue({ signed_in: true, contact: "@aziza" });
    vi.spyOn(authAPI, "me").mockResolvedValue(aziza);
    vi.spyOn(examSessionAPI, "lookup").mockResolvedValue(seat());
    const join = vi.spyOn(examSessionAPI, "join").mockResolvedValue(seat());
    const onJoined = vi.fn();
    function Computer() {
      const [user, setUser] = useState<User | null>(null);
      return <JoinExam user={user} onUser={setUser} onJoined={onJoined} onLogout={noop} pollMs={20} />;
    }
    render(<Computer />);
    expect(await screen.findByRole("img", { name: /signs you in on this computer/ })).toBeInTheDocument();
    await waitFor(() => expect(onJoined).toHaveBeenCalled());
    expect(poll).toHaveBeenCalledWith("tok-1");
    expect(join).toHaveBeenCalledTimes(1);
    expect(join).toHaveBeenCalledWith("ABC234", "Aziza Karimova", "@aziza");
    expect(screen.queryByLabelText("Phone or Telegram username")).not.toBeInTheDocument();
  });

  it("shows the details form with the reason when that join is refused", async () => {
    vi.spyOn(pcAPI, "me").mockResolvedValue(paired(exam));
    vi.spyOn(pcAPI, "login").mockResolvedValue({ token: "tok-1", expires_at: "2026-11-14T05:05:00Z" });
    vi.spyOn(pcAPI, "poll").mockResolvedValue({ signed_in: true, contact: "@aziza" });
    vi.spyOn(authAPI, "me").mockResolvedValue(aziza);
    vi.spyOn(examSessionAPI, "lookup").mockResolvedValue(seat());
    vi.spyOn(examSessionAPI, "join").mockRejectedValue(new APIError(409, "This exam is full."));
    function Computer() {
      const [user, setUser] = useState<User | null>(null);
      return <JoinExam user={user} onUser={setUser} onJoined={vi.fn()} onLogout={noop} pollMs={20} />;
    }
    render(<Computer />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This exam is full.");
    expect(screen.getByLabelText("Full name")).toHaveValue("Aziza Karimova");
    expect(screen.getByLabelText("Phone or Telegram username")).toHaveValue("@aziza");
  });

  it("lets a student without Telegram type their details instead", async () => {
    vi.spyOn(pcAPI, "me").mockResolvedValue(paired(exam));
    vi.spyOn(pcAPI, "login").mockResolvedValue({ token: "tok-1", expires_at: "2026-11-14T05:05:00Z" });
    vi.spyOn(pcAPI, "poll").mockResolvedValue({ signed_in: false, contact: "" });
    vi.spyOn(examSessionAPI, "lookup").mockResolvedValue(seat());
    const user = userEvent.setup();
    render(<JoinExam user={null} onUser={vi.fn()} onJoined={vi.fn()} onLogout={noop} pollMs={20} />);
    await user.click(await screen.findByRole("button", { name: "No Telegram? Type your details" }));
    expect(await screen.findByLabelText("Full name")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Back to the QR code" })).toBeInTheDocument();
  });
});

describe("the waiting screen", () => {
  const held = (s: ExamSeat) => ({ user_id: "u1", seat: s, reference: "ref-1", skew_ms: 0 });
  const linked = () => vi.spyOn(telegramAPI, "status").mockResolvedValue({ linked: true, started: true, results_enabled: true });

  it("holds the student until the start time", async () => {
    linked();
    const starts = new Date(Date.now() + 10 * 60_000).toISOString(), ends = new Date(Date.now() + 5 * 3600_000).toISOString();
    render(<ExamLobby held={held(seat({ starts_at: starts, ends_at: ends }))} user={aziza} onStart={vi.fn()} onLogout={noop} />);
    expect(screen.getByRole("timer")).toHaveTextContent(/^(10:00|9:5\d)$/);
    expect(screen.getByRole("button", { name: "Starts soon" })).toBeDisabled();
    expect(await screen.findByText("Your results go to your Telegram")).toBeInTheDocument();
  });

  it("starts by spending one centre star, and stops when the centre has none", async () => {
    linked();
    const spend = vi.spyOn(starsAPI, "spendOnFullMock").mockRejectedValueOnce(new APIError(402, "no stars")).mockResolvedValue({ balance: 4 });
    const onStart = vi.fn();
    const open = seat({ starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 3600_000).toISOString() });
    const user = userEvent.setup();
    render(<ExamLobby held={held(open)} user={aziza} onStart={onStart} onLogout={noop} />);
    await user.click(screen.getByRole("button", { name: "Start the exam" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your centre has no stars left");
    expect(onStart).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start the exam" }));
    await vi.waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(spend).toHaveBeenLastCalledWith("ref-1");
  });

  it("offers a QR to an account with no Telegram, and closes after the exam window", async () => {
    vi.spyOn(telegramAPI, "status").mockResolvedValue({ linked: false, started: false, results_enabled: true });
    vi.spyOn(telegramAPI, "link").mockResolvedValue({ token: "abc", start: "l_abc", expires_at: "2026-11-14T10:30:00Z" });
    const over = seat({ starts_at: new Date(Date.now() - 7200_000).toISOString(), ends_at: new Date(Date.now() - 60_000).toISOString() });
    render(<ExamLobby held={held(over)} user={aziza} onStart={vi.fn()} onLogout={noop} />);
    expect(screen.getByRole("heading", { name: "This exam has ended" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /QR code/ })).toBeInTheDocument();
  });
});

describe("the admin's exam day tab", () => {
  const papers = [{ id: "l1", title: "Listening A", skill: "listening" as const }, { id: "r1", title: "Reading A", skill: "reading" as const }];

  it("adds a computer by its code, schedules a mock on the ticked computers and shows who joined", async () => {
    vi.spyOn(examSessionAPI, "list").mockResolvedValue({ sessions: [], papers, pcs: [{ id: "p1", number: 1, online: true }, { id: "p2", number: 2, online: false }] });
    const approve = vi.spyOn(examSessionAPI, "approvePC").mockResolvedValue({ id: "p3", number: 3, online: true });
    const create = vi.spyOn(examSessionAPI, "create").mockImplementation(async input => ({ ...input, id: "s1", code: "ABC234", joined: 1, pcs: [1, 3] }));
    vi.spyOn(examSessionAPI, "participants").mockResolvedValue([{ user_id: "u1", full_name: "Aziza Karimova", contact: "@aziza", joined_at: "2026-11-14T04:50:00Z", pc: 3 }]);
    const user = userEvent.setup();
    render(<ExamSessions />);

    await user.type(await screen.findByLabelText("Code on the computer's screen"), "k7m2qx");
    await user.click(screen.getByRole("button", { name: "Add this computer" }));
    expect(await screen.findByRole("status")).toHaveTextContent("PC 3 added");
    expect(approve).toHaveBeenCalledWith("K7M2QX");
    expect(screen.getByText(/^Offline/)).toBeInTheDocument();

    // Every computer is ticked by default, so there is no seat count to type.
    expect(screen.queryByLabelText("Seats")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "PC 2" }));
    await user.type(screen.getByLabelText("Name"), "Saturday mock");
    await user.type(screen.getByLabelText("Starts"), "2026-11-14T10:00");
    await user.type(screen.getByLabelText("Ends"), "2026-11-14T15:00");
    await user.selectOptions(screen.getByLabelText("Listening paper"), "l1");
    await user.selectOptions(screen.getByLabelText("Reading paper"), "r1");
    await user.click(screen.getByRole("button", { name: "Schedule the exam" }));

    expect(await screen.findByLabelText("Exam code, for students without Telegram")).toHaveValue("ABC234");
    expect(create).toHaveBeenCalledWith({
      title: "Saturday mock", seats: 2, pc_ids: ["p1", "p3"], listening_exam_id: "l1", reading_exam_id: "r1",
      starts_at: new Date("2026-11-14T10:00").toISOString(), ends_at: new Date("2026-11-14T15:00").toISOString(),
    });
    expect(screen.getByText("PC 1, 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show students" }));
    expect(await screen.findByText("PC 3: Aziza Karimova")).toBeInTheDocument();
  });

  it("asks for a seat count when the centre has no computers", async () => {
    vi.spyOn(examSessionAPI, "list").mockResolvedValue({ sessions: [], papers, pcs: [] });
    render(<ExamSessions />);
    expect(await screen.findByLabelText("Seats")).toHaveValue(20);
    expect(screen.getByText(/No computers yet/)).toBeInTheDocument();
  });
});

import { cleanup,render,screen } from "@testing-library/react";
import { afterEach,expect,it,vi } from "vitest";
import AdminDashboard from "./AdminDashboard";
import { managedContentAPI } from "./managedContent";
vi.mock("./managedContent",()=>({managedContentAPI:{dashboard:vi.fn()}}));
afterEach(()=>{cleanup();vi.resetAllMocks()});
it("renders operational metrics and activity trend",async()=>{vi.mocked(managedContentAPI.dashboard).mockResolvedValue({summary:{users:42,new_users_7d:5,active_users_7d:18,completed_mocks:12,average_band:6.5,writing_reports:9,speaking_reports:4,published_exams:3,exam_drafts:2,published_content:24,managed_drafts:3},trend:[{date:"2026-10-07",signups:2,active_students:7,attempts:4}],content:[{kind:"daily_challenge",status:"published",count:3}]});render(<AdminDashboard/>);expect(await screen.findByText("42")).toBeInTheDocument();expect(screen.getByText("18")).toBeInTheDocument();expect(screen.getByText("13")).toBeInTheDocument();expect(screen.getByLabelText("Fourteen day activity chart")).toBeInTheDocument();expect(screen.getByText("daily challenge")).toBeInTheDocument()});

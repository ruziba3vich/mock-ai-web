import {useState} from "react";
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
import FullMockWriting from "./FullMockWriting";
import {managedContentAPI,ManagedContent} from "./managedContent";
import {FullMockSession} from "./fullMock";
vi.mock("./managedContent",()=>({managedContentAPI:{studentList:vi.fn()}}));
vi.mock("./WritingPage",()=>({default:(p:any)=><div><span>{p.requiredTask}</span><span>{p.initialContentID}</span><span>{p.initialSubmissionID}</span><button onClick={()=>p.onSaved({id:"saved"})}>Save</button><button onClick={()=>p.onSubmitted({id:p.requiredTask+"-submission"})}>Submit</button></div>}));
const base:FullMockSession={id:"mock",started_at:"now",stage:"writing",listening_exam_id:"l",reading_exam_id:"r"};
const content=[{id:"one",data:{task:"task_1",prompt:"Describe the changes shown in the chart."}},{id:"two",data:{task:"task_2",prompt:"Discuss public transport investment in cities."}}].map(v=>({...v,kind:"writing_prompt" as const,slug:v.id,title:v.id,summary:"",status:"published" as const,sort_order:0,created_at:"",updated_at:""})) satisfies ManagedContent[];
beforeEach(()=>{vi.clearAllMocks();vi.mocked(managedContentAPI.studentList).mockResolvedValue(content)});
function Harness(){const[s,set]=useState(base);return <><FullMockWriting session={s} onChange={set} onDirtyChange={()=>{}}/><output>{s.stage}:{s.writing_task1_submission_id}:{s.writing_submission_id}</output></>}
it("assigns both tasks once and only opens the Speaking break after both submissions",async()=>{
 render(<Harness/>);await screen.findByText("task_1");
 fireEvent.click(screen.getByText("Save"));await screen.findByText("saved");
 fireEvent.click(screen.getByText("Submit"));await screen.findByText("task_2");
 expect(screen.getByRole("status")).toHaveTextContent("writing:task_1-submission:");
 fireEvent.click(screen.getByText("Submit"));await waitFor(()=>expect(screen.getByRole("status")).toHaveTextContent("break_speaking:task_1-submission:task_2-submission"));
 expect(managedContentAPI.studentList).toHaveBeenCalledTimes(1);
});
it("restores Task 2 with its saved draft without reassigning prompts",()=>{
 render(<FullMockWriting session={{...base,writing_task1_content_id:"one",writing_task2_content_id:"two",writing_task1_submission_id:"done",writing_task2_draft_id:"draft-two"}} onChange={vi.fn()} onDirtyChange={()=>{}}/>);
 expect(screen.getByText("task_2")).toBeVisible();expect(screen.getByText("draft-two")).toBeVisible();expect(managedContentAPI.studentList).not.toHaveBeenCalled();
});
it("blocks instead of silently skipping Task 1 when content is missing",async()=>{
 vi.mocked(managedContentAPI.studentList).mockResolvedValue(content.slice(1));
 const change=vi.fn();render(<FullMockWriting session={base} onChange={change} onDirtyChange={()=>{}}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("Both Writing Task 1 and Task 2");expect(change).not.toHaveBeenCalled();
});

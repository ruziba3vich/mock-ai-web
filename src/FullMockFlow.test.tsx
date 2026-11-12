import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,describe,expect,it,vi} from "vitest";
import FullMockFlow from "./FullMockFlow";
import {FullMockSession,newFullMock,readFullMock,writeFullMock} from "./fullMock";
import {examAPI} from "./exams";

vi.mock("./WritingPage",()=>({default:({onSubmitted}:{onSubmitted?:(v:{id:string})=>void})=> <button onClick={()=>onSubmitted?.({id:"essay-2"})}>Submit essay</button>}));
vi.mock("./ClaimResults",()=>({default:()=>null}));
vi.mock("./SpeakingPage",()=>({default:()=> <div>Speaking workspace</div>}));
vi.mock("./exams",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("./exams")>();
  return {...actual,examAPI:{...actual.examAPI,get:vi.fn()}};
});

const base:FullMockSession={id:"full-1",started_at:"2026-10-08T00:00:00Z",stage:"overview",listening_exam_id:"listen-1",reading_exam_id:"read-1"};
const props={onChange:vi.fn(),onStartExam:vi.fn(),onFinish:vi.fn(),onCancel:vi.fn(),onDirtyChange:vi.fn()};

describe("full mock flow",()=>{
  beforeEach(()=>{localStorage.clear();vi.clearAllMocks()});

  it("starts with Listening and opens the selected paper",async()=>{
    const {rerender}=render(<FullMockFlow session={base} {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:/Begin with Listening/i}));
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({stage:"listening"}));
    const listening={id:"listen-1",skill:"listening",sections:[]} as never;
    vi.mocked(examAPI.get).mockResolvedValue(listening);
    rerender(<FullMockFlow session={{...base,stage:"listening"}} {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:/Start listening section/i}));
    await waitFor(()=>expect(props.onStartExam).toHaveBeenCalledWith(listening,"listening"));
  });

  it("runs an exam-day mock by itself: the section opens unasked, and the break cannot be skipped or the mock ended",async()=>{
    const day={...base,exam_session_id:"s1"},listening={id:"listen-1",skill:"listening",sections:[]} as never;
    vi.mocked(examAPI.get).mockResolvedValue(listening);
    const {rerender}=render(<FullMockFlow session={{...day,stage:"listening"}} {...props}/>);
    await waitFor(()=>expect(props.onStartExam).toHaveBeenCalledWith(listening,"listening"));
    expect(screen.queryByRole("button",{name:"End mock"})).not.toBeInTheDocument();
    rerender(<FullMockFlow session={{...day,stage:"break_reading",break_until:new Date(Date.now()+60_000).toISOString()}} {...props}/>);
    expect(screen.queryByRole("button",{name:/continue/i})).not.toBeInTheDocument();
    expect(props.onChange).not.toHaveBeenCalled();
    rerender(<FullMockFlow session={{...day,stage:"break_reading",break_until:new Date(Date.now()-1000).toISOString()}} {...props}/>);
    await waitFor(()=>expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({stage:"reading"})));
  });

  it("ends an exam without Speaking after Writing Task 2, and says teachers mark the essays",()=>{
    const day:FullMockSession={...base,exam_session_id:"s1",no_speaking:true,hand_marked_writing:true,stage:"writing",writing_task1_content_id:"t1",writing_task2_content_id:"t2",writing_task1_submission_id:"essay-1"};
    const {rerender}=render(<FullMockFlow session={day} {...props}/>);
    expect(screen.queryByText("Speaking")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"Submit essay"}));
    const done=vi.mocked(props.onChange).mock.calls[0][0] as FullMockSession;
    expect(done).toMatchObject({stage:"complete",writing_submission_id:"essay-2"});
    rerender(<FullMockFlow session={done} {...props}/>);
    expect(screen.getByRole("heading",{name:"You completed all three sections."})).toBeInTheDocument();
    expect(screen.getByText(/Your teachers mark your Writing/)).toBeInTheDocument();
    expect(screen.queryByText("Speaking")).not.toBeInTheDocument();
  });

  it("sends a four-skill mock on to the Speaking break after Writing Task 2",()=>{
    render(<FullMockFlow session={{...base,stage:"writing",writing_task1_content_id:"t1",writing_task2_content_id:"t2",writing_task1_submission_id:"essay-1"}} {...props}/>);
    fireEvent.click(screen.getByRole("button",{name:"Submit essay"}));
    expect(props.onChange).toHaveBeenCalledWith(expect.objectContaining({stage:"break_speaking"}));
  });

  it("persists and restores a student's active mock",()=>{
    const session=newFullMock("listen-1","read-1");
    writeFullMock("student-1",session);
    expect(readFullMock("student-1")).toEqual(session);
    writeFullMock("student-1",null);
    expect(readFullMock("student-1")).toBeNull();
  });
});

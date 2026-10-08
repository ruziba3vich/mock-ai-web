import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,describe,expect,it,vi} from "vitest";
import FullMockFlow from "./FullMockFlow";
import {FullMockSession,newFullMock,readFullMock,writeFullMock} from "./fullMock";
import {examAPI} from "./exams";

vi.mock("./WritingPage",()=>({default:()=> <div>Writing workspace</div>}));
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

  it("persists and restores a student's active mock",()=>{
    const session=newFullMock("listen-1","read-1");
    writeFullMock("student-1",session);
    expect(readFullMock("student-1")).toEqual(session);
    writeFullMock("student-1",null);
    expect(readFullMock("student-1")).toBeNull();
  });
});

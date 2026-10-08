import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,expect,it,vi} from "vitest";
import ContentAdmin from "./ContentAdmin";
import {learningAPI} from "./learning";

beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(learningAPI,"drafts").mockResolvedValue([]);vi.spyOn(learningAPI,"imports").mockResolvedValue([]);vi.spyOn(learningAPI,"students").mockResolvedValue([{id:"student-1",display_name:"Dostonbek",telegram_username:"donik"}])});

it("requires usage rights and uploads a PDF as an asynchronous import",async()=>{
 const upload=vi.spyOn(learningAPI,"importPDF").mockResolvedValue({id:"import-1"});const user=userEvent.setup();render(<ContentAdmin/>);await screen.findByRole("heading",{name:"Exam library"});await user.click(screen.getByText("Import a PDF book"));await screen.findByRole("heading",{name:"Turn a test book into editable drafts"});
 const file=new File(["%PDF-test"],"book.pdf",{type:"application/pdf"});await user.upload(screen.getByLabelText("PDF book"),file);
 const button=screen.getByRole("button",{name:"Upload and create drafts"});expect(button).toBeDisabled();await user.click(screen.getByText(/I confirm that MockAI/));expect(button).toBeEnabled();await user.click(button);
 await waitFor(()=>expect(upload).toHaveBeenCalledWith(file,"all","public",""));expect(await screen.findByText(/Extraction is running/)).toBeInTheDocument();
});

it("edits an exam audience using a readable student selector",async()=>{
 const save=vi.spyOn(learningAPI,"saveDraft").mockResolvedValue({id:"draft-1"});const user=userEvent.setup();render(<ContentAdmin/>);await screen.findByRole("heading",{name:"Exam library"});
 await user.click(screen.getByRole("radio",{name:/Restricted/}));await user.selectOptions(screen.getByLabelText("Private student"),"student-1");await user.click(screen.getByRole("button",{name:"Save draft"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(undefined,expect.objectContaining({access_scope:"private",owner_user_id:"student-1"})));
});

it("makes any restricted exam public and publishes the permission",async()=>{
 const draft={id:"draft-1",exam_id:"exam-1",data:{title:"Reading test",description:"",skill:"reading",purpose:"practice",duration_seconds:600,instructions:"",access_scope:"private" as const,owner_user_id:"student-1",bands:[],sections:[{title:"Passage",passage:"Text",audio_url:"",source_image_urls:[],instructions:"",questions:[{type:"short_answer",prompt:"Answer?",options:[],answers:["yes"],explanation:"Because."}]}]}};
 vi.mocked(learningAPI.drafts).mockResolvedValue([draft]);const save=vi.spyOn(learningAPI,"saveDraft").mockResolvedValue({id:"draft-1"});const publish=vi.spyOn(learningAPI,"publish").mockResolvedValue({exam_id:"exam-1"});const user=userEvent.setup();render(<ContentAdmin/>);
 await user.click(await screen.findByRole("button",{name:"Edit Reading test"}));await user.click(screen.getByRole("radio",{name:/Public/}));expect(screen.queryByLabelText("Private student")).not.toBeInTheDocument();await user.click(screen.getByRole("button",{name:"Publish version"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith("draft-1",expect.objectContaining({access_scope:"public",owner_user_id:""})));expect(publish).toHaveBeenCalledWith("draft-1");
});

it("opens an exam by clicking its row and uploads a replacement recording",async()=>{
 const draft={id:"draft-1",exam_id:"exam-1",data:{title:"Listening test",description:"",skill:"listening",purpose:"practice",duration_seconds:600,instructions:"",access_scope:"private" as const,owner_user_id:"student-1",bands:[],sections:[{title:"Section 1",passage:"Transcript",audio_url:"/api/v1/private-media/old",source_image_urls:[],instructions:"",questions:[{type:"short_answer",prompt:"Answer?",options:[],answers:["yes"],explanation:"Because."}]}]}};
 vi.mocked(learningAPI.drafts).mockResolvedValue([draft]);const upload=vi.spyOn(learningAPI,"uploadMedia").mockResolvedValue({id:"new",url:"/api/v1/private-media/new"});const user=userEvent.setup();render(<ContentAdmin/>);
 expect(await screen.findByText("Restricted")).toBeInTheDocument();expect(screen.getByText("Dostonbek")).toBeInTheDocument();await user.click(screen.getByRole("button",{name:"Edit Listening test"}));expect(screen.getByDisplayValue("Listening test")).toBeInTheDocument();
 const file=new File([new Uint8Array(256)],"replacement.mp3",{type:"audio/mpeg"});await user.upload(screen.getByLabelText("Section 1 audio file"),file);
 await waitFor(()=>expect(upload).toHaveBeenCalledWith(file,"student-1"));expect(await screen.findByText(/replacement.mp3 uploaded/)).toBeInTheDocument();
});

it("paginates a large exam library and reports the visible range",async()=>{
 const makeDraft=(index:number)=>({id:`draft-${index}`,exam_id:`exam-${index}`,data:{title:`Reading test ${index}`,description:"",skill:"reading",purpose:"mock",duration_seconds:3600,instructions:"",access_scope:"public" as const,owner_user_id:"",bands:[],sections:[{title:"Passage",passage:"Text",audio_url:"",source_image_urls:[],instructions:"",questions:[]}]}});
 vi.mocked(learningAPI.drafts).mockResolvedValue(Array.from({length:12},(_,index)=>makeDraft(index+1)));const user=userEvent.setup();render(<ContentAdmin/>);
 expect(await screen.findByText("Showing 1–10 of 12 exams")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Edit Reading test 11"})).not.toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Next"}));expect(screen.getByText("Showing 11–12 of 12 exams")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Edit Reading test 11"})).toBeInTheDocument();
});

import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,expect,it,vi} from "vitest";
import ContentAdmin from "./ContentAdmin";
import {learningAPI} from "./learning";

beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(learningAPI,"drafts").mockResolvedValue([]);vi.spyOn(learningAPI,"imports").mockResolvedValue([]);vi.spyOn(learningAPI,"students").mockResolvedValue([{id:"student-1",display_name:"Dostonbek",telegram_username:"donik"}])});

it("opens on the library rather than on a new exam",async()=>{
 vi.mocked(learningAPI.drafts).mockResolvedValue([{id:"draft-1",exam_id:"",data:{title:"Reading test",description:"",skill:"reading",purpose:"practice",duration_seconds:600,instructions:"",access_scope:"public" as const,owner_user_id:"",bands:[],sections:[{title:"Passage",passage:"",audio_url:"",source_image_urls:[],instructions:"",questions:[]}]}}]);
 render(<ContentAdmin/>);
 expect(await screen.findByRole("button",{name:"Edit Reading test"})).toBeInTheDocument();
 // The editor used to be rendered under the list at all times, which made the
 // tab read as "add an exam" rather than "here are your exams".
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(screen.queryByRole("radio",{name:/Restricted/})).not.toBeInTheDocument();
});

it("requires usage rights and uploads a PDF as an asynchronous import",async()=>{
 const upload=vi.spyOn(learningAPI,"importPDF").mockResolvedValue({id:"import-1"});const user=userEvent.setup();render(<ContentAdmin/>);await screen.findByRole("heading",{name:"Exam library"});await user.click(screen.getByText("Import a PDF book"));await screen.findByRole("heading",{name:"Turn a test book into editable drafts"});
 const file=new File(["%PDF-test"],"book.pdf",{type:"application/pdf"});await user.upload(screen.getByLabelText("PDF book"),file);
 const button=screen.getByRole("button",{name:"Upload and create drafts"});expect(button).toBeDisabled();await user.click(screen.getByText(/I confirm that MockAI/));expect(button).toBeEnabled();await user.click(button);
 await waitFor(()=>expect(upload).toHaveBeenCalledWith(file,"all","public",""));expect(await screen.findByText(/Extraction is running/)).toBeInTheDocument();
});

it("edits an exam audience using a readable student selector",async()=>{
 const save=vi.spyOn(learningAPI,"saveDraft").mockResolvedValue({id:"draft-1"});const user=userEvent.setup();render(<ContentAdmin/>);await screen.findByRole("heading",{name:"Exam library"});
 // The tab opens on the library, so a new exam has to be asked for.
 await user.click(screen.getByRole("button",{name:"Create exam"}));await screen.findByRole("dialog",{name:"New exam"});
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
 await waitFor(()=>expect(upload).toHaveBeenCalledWith(file,"student-1",expect.any(Function)));expect(await screen.findByText(/replacement.mp3 uploaded/)).toBeInTheDocument();
});

it("paginates a large exam library and reports the visible range",async()=>{
 const makeDraft=(index:number)=>({id:`draft-${index}`,exam_id:`exam-${index}`,data:{title:`Reading test ${index}`,description:"",skill:"reading",purpose:"mock",duration_seconds:3600,instructions:"",access_scope:"public" as const,owner_user_id:"",bands:[],sections:[{title:"Passage",passage:"Text",audio_url:"",source_image_urls:[],instructions:"",questions:[]}]}});
 vi.mocked(learningAPI.drafts).mockResolvedValue(Array.from({length:12},(_,index)=>makeDraft(index+1)));const user=userEvent.setup();render(<ContentAdmin/>);
 expect(await screen.findByText("Showing 1–10 of 12 exams")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Edit Reading test 11"})).not.toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Next"}));expect(screen.getByText("Showing 11–12 of 12 exams")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Edit Reading test 11"})).toBeInTheDocument();
});

it("uploads source pages from the authoring screen and keeps the ones already there",async()=>{
 // The author had to paste a URL, which meant hosting the scan somewhere else
 // first. The picker uploads through the same private-media endpoint the
 // recording uses, and appends, so adding page 2 keeps page 1.
 const draft={id:"draft-1",exam_id:"exam-1",data:{title:"Map reading",description:"",skill:"reading",purpose:"practice",duration_seconds:600,instructions:"",access_scope:"private" as const,owner_user_id:"student-1",bands:[],sections:[{title:"Section 1",passage:"Passage",audio_url:"",source_image_urls:["/api/v1/private-media/page-1"],instructions:"",questions:[{type:"short_answer",prompt:"Answer?",options:[],answers:["yes"],explanation:"Because."}]}]}};
 vi.mocked(learningAPI.drafts).mockResolvedValue([draft]);
 const upload=vi.spyOn(learningAPI,"uploadMedia").mockResolvedValue({id:"page-2",url:"/api/v1/private-media/page-2"});
 const save=vi.spyOn(learningAPI,"saveDraft").mockResolvedValue({id:"draft-1"});
 const user=userEvent.setup();render(<ContentAdmin/>);
 await user.click(await screen.findByRole("button",{name:"Edit Map reading"}));
 const scan=new File([new Uint8Array([0xff,0xd8,0xff,0xe0])],"page-2.jpg",{type:"image/jpeg"});
 await user.upload(screen.getByLabelText("Section 1 source pages"),scan);
 await waitFor(()=>expect(upload).toHaveBeenCalledWith(scan,"student-1"));
 expect(await screen.findByText(/page-2.jpg uploaded/)).toBeInTheDocument();
 expect(screen.getByAltText("Section 1 page 2")).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Save draft"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith("draft-1",expect.objectContaining({
  sections:[expect.objectContaining({source_image_urls:["/api/v1/private-media/page-1","/api/v1/private-media/page-2"]})]})));
});

it("removes a source page without touching the rest",async()=>{
 const draft={id:"draft-1",exam_id:"exam-1",data:{title:"Map reading",description:"",skill:"reading",purpose:"practice",duration_seconds:600,instructions:"",access_scope:"public" as const,owner_user_id:"",bands:[],sections:[{title:"Section 1",passage:"Passage",audio_url:"",source_image_urls:["/api/v1/private-media/page-1","/api/v1/private-media/page-2"],instructions:"",questions:[{type:"short_answer",prompt:"Answer?",options:[],answers:["yes"],explanation:"Because."}]}]}};
 vi.mocked(learningAPI.drafts).mockResolvedValue([draft]);
 const save=vi.spyOn(learningAPI,"saveDraft").mockResolvedValue({id:"draft-1"});
 const user=userEvent.setup();render(<ContentAdmin/>);
 await user.click(await screen.findByRole("button",{name:"Edit Map reading"}));
 await user.click(screen.getByRole("button",{name:"Remove page 1 from section 1"}));
 expect(screen.queryByAltText("Section 1 page 2")).not.toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Save draft"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith("draft-1",expect.objectContaining({
  sections:[expect.objectContaining({source_image_urls:["/api/v1/private-media/page-2"]})]})));
});
it("warns about a listening exam whose recording is missing, too long or in a format that cannot be used",async()=>{
 const draft={id:"draft-1",exam_id:"",data:{title:"Saturday listening",description:"",skill:"listening",purpose:"mock",duration_seconds:600,instructions:"",access_scope:"public" as const,owner_user_id:"",bands:[],sections:[{title:"Part 1",passage:"",audio_url:"",source_image_urls:[],instructions:"",questions:[{type:"short_answer",prompt:"Answer?",options:[],answers:["yes"],explanation:""}]}]}};
 vi.mocked(learningAPI.drafts).mockResolvedValue([draft]);const save=vi.spyOn(learningAPI,"saveDraft").mockResolvedValue({id:"draft-1"});const upload=vi.spyOn(learningAPI,"uploadMedia").mockResolvedValue({id:"whole",url:"/api/v1/private-media/whole"});
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);const user=userEvent.setup({applyAccept:false});render(<ContentAdmin/>);await user.click(await screen.findByRole("button",{name:"Edit Saturday listening"}));
 expect(screen.getByText(/This listening exam has no recording/)).toBeInTheDocument();
 await user.click(screen.getByRole("button",{name:"Publish version"}));expect(confirm).toHaveBeenCalledWith(expect.stringContaining("no recording"));expect(save).not.toHaveBeenCalled();
 await user.upload(screen.getByLabelText("Section 1 audio file"),new File([new Uint8Array(256)],"whole-test.wav",{type:"audio/wav"}));
 expect(await screen.findByText(/whole-test.wav is not an MP3 or M4A file/)).toBeInTheDocument();expect(upload).not.toHaveBeenCalled();
 await user.upload(screen.getByLabelText("Section 1 audio file"),new File([new Uint8Array(256)],"whole-test.mp3",{type:"audio/mpeg"}));
 await waitFor(()=>expect(screen.queryByText(/This listening exam has no recording/)).not.toBeInTheDocument());
 const player=document.querySelector(".admin-audio-preview audio") as HTMLAudioElement;Object.defineProperty(player,"duration",{value:1870});fireEvent.loadedMetadata(player);
 expect(await screen.findByText(/The recording runs 31:10 but the exam time is 10 minutes/)).toHaveTextContent("at least 34 minutes");
 fireEvent.error(player);expect(await screen.findByText(/This recording does not play\. A link must point/)).toBeInTheDocument();
});


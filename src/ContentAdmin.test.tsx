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
 await user.selectOptions(screen.getByLabelText("Content audience"),"private");await user.selectOptions(screen.getByLabelText("Private student"),"student-1");await user.click(screen.getByRole("button",{name:"Save draft"}));
 await waitFor(()=>expect(save).toHaveBeenCalledWith(undefined,expect.objectContaining({access_scope:"private",owner_user_id:"student-1"})));
});

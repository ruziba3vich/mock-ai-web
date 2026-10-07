import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {beforeEach,expect,it,vi} from "vitest";
import ContentAdmin from "./ContentAdmin";
import {learningAPI} from "./learning";

beforeEach(()=>{vi.restoreAllMocks();vi.spyOn(learningAPI,"drafts").mockResolvedValue([]);vi.spyOn(learningAPI,"imports").mockResolvedValue([])});

it("requires usage rights and uploads a PDF as an asynchronous import",async()=>{
 const upload=vi.spyOn(learningAPI,"importPDF").mockResolvedValue({id:"import-1"});const user=userEvent.setup();render(<ContentAdmin/>);await screen.findByRole("heading",{name:"Turn a test book into editable drafts"});
 const file=new File(["%PDF-test"],"book.pdf",{type:"application/pdf"});await user.upload(screen.getByLabelText("PDF book"),file);
 const button=screen.getByRole("button",{name:"Upload and create drafts"});expect(button).toBeDisabled();await user.click(screen.getByText(/I confirm that MockAI/));expect(button).toBeEnabled();await user.click(button);
 await waitFor(()=>expect(upload).toHaveBeenCalledWith(file,"all"));expect(await screen.findByText(/Extraction is running/)).toBeInTheDocument();
});

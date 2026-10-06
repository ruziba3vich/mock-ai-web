import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import ExplorePage from "./ExplorePage";
import VocabularyGame, { vocabulary } from "./VocabularyGame";
import { apiRequest } from "./auth";
vi.mock("./auth",()=>({apiRequest:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const fixture={profile:{nickname:"",enabled:false},stats:{questions:5,mocks:0,days:1,today_questions:5,week_mocks:0,week_days:1,week_points:5},board:[]};
it("shows real challenges and saves explicit leaderboard opt-in",async()=>{
 vi.mocked(apiRequest).mockResolvedValue(fixture);
 const practice=vi.fn();const user=userEvent.setup();
 render(<ExplorePage onPractice={practice} onExams={vi.fn()}/>);
 expect(await screen.findByText("5 points this week")).toBeInTheDocument();
 expect(screen.getByText("Completed ✓")).toBeInTheDocument();
 expect(screen.getByText("A fresh starting line.")).toBeInTheDocument();
 const check=screen.getByRole("checkbox");expect(check).not.toBeChecked();
 await user.type(screen.getByLabelText("Public nickname"),"Reader 42");await user.click(check);
 await user.click(screen.getByRole("button",{name:"Save visibility"}));
 expect(apiRequest).toHaveBeenCalledWith("/api/v1/me/community",{method:"PUT",body:JSON.stringify({nickname:"Reader 42",enabled:true})});
 await user.click(screen.getByRole("button",{name:"Keep the momentum →"}));expect(practice).toHaveBeenCalledOnce();
});
it("can complete a vocabulary round without awarding leaderboard points",async()=>{
 const user=userEvent.setup();render(<VocabularyGame/>);
 await user.click(screen.getByRole("button",{name:"Play a round →"}));
 for(let i=0;i<5;i++){
   const word=screen.getAllByRole("heading",{level:3})[0].textContent;
   const card=vocabulary.find(v=>v.word===word)!;
   await user.click(screen.getByRole("button",{name:card.meaning}));
   expect(screen.getByText(card.example)).toBeInTheDocument();
   await user.click(screen.getByRole("button",{name:i===4?"See my result":"Next word →"}));
 }
 expect(screen.getByText("You matched 5 of 5 meanings.")).toBeInTheDocument();
 expect(apiRequest).not.toHaveBeenCalled();
 await user.click(screen.getByRole("button",{name:"Play another round"}));expect(screen.getByText("Word 1 of 5")).toBeInTheDocument();
});
it("shows an actionable load error",async()=>{
 vi.mocked(apiRequest).mockRejectedValue(new Error("offline"));render(<ExplorePage onPractice={()=>{}} onExams={()=>{}}/>);
 expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
 expect(screen.getByRole("button",{name:"Retry"})).toBeInTheDocument();
});

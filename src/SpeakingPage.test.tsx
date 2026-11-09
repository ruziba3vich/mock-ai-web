import { beforeEach,expect,it,vi } from "vitest";
import { render,screen,waitFor,fireEvent,act } from "@testing-library/react";
import SpeakingPage from "./SpeakingPage";
import { speakingAPI, microphone, SpeakingSession } from "./speaking";
vi.mock("./speaking",async()=>({...await vi.importActual("./speaking"),microphone:vi.fn(),speakingAPI:{settings:vi.fn(),list:vi.fn(),create:vi.fn(),createRead:vi.fn(),get:vi.fn(),audio:vi.fn(),remove:vi.fn()}}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(speakingAPI.settings).mockResolvedValue({enabled:true,countries:[{code:"GB",name:"United Kingdom"},{code:"AU",name:"Australia"}],daily_limit:3,audio_retention_days:30});vi.mocked(speakingAPI.list).mockResolvedValue([])});
it.each([1,3])("shows durable evaluation progress when %i parts are ready",async(completed)=>{
 const session:SpeakingSession={id:"progress",examiner:{country:"",code:"",gender:"",accent:"",voice:""},topic:"Learning",status:"processing",turns:[],error_code:"",created_at:"2026-10-08T00:00:00Z",audio_expires_at:"2026-11-08T00:00:00Z",evaluation:{completed,total:3}};
 vi.mocked(speakingAPI.list).mockResolvedValue([session]);vi.mocked(speakingAPI.get).mockResolvedValue(session);
 render(<SpeakingPage onDirtyChange={()=>{}}/>);fireEvent.click(await screen.findByRole("button",{name:/Learning/}));
 expect(await screen.findByText(`${completed} of 3 speaking parts evaluated.`)).toBeVisible();
 if(completed===3)expect(screen.getByText("Preparing your final report…")).toBeVisible();
});
it("requires consent and microphone access before creating an interview",async()=>{vi.mocked(microphone).mockRejectedValue(new Error("Microphone access is needed."));render(<SpeakingPage onDirtyChange={()=>{}}/>);const start=screen.getByRole("button",{name:"Start speaking interview"});await waitFor(()=>expect(speakingAPI.settings).toHaveBeenCalled());expect(screen.queryByText("Australia")).not.toBeInTheDocument();expect(start).toBeDisabled();fireEvent.click(screen.getByRole("checkbox"));expect(start).toBeEnabled();fireEvent.click(start);await screen.findByText("Microphone access is needed.");expect(speakingAPI.create).not.toHaveBeenCalled()});
it("shows service unavailability without requesting microphone access",async()=>{vi.mocked(speakingAPI.settings).mockResolvedValue({enabled:false,countries:[],daily_limit:3,audio_retention_days:30});render(<SpeakingPage onDirtyChange={()=>{}}/>);await screen.findByText(/Speaking is temporarily unavailable/);fireEvent.click(screen.getByRole("checkbox"));await waitFor(()=>expect(screen.getByRole("button",{name:"Start speaking interview"})).toBeDisabled());expect(microphone).not.toHaveBeenCalled()});
it("starts the selected published speaking plan and focused part",async()=>{const stop=vi.fn();vi.mocked(microphone).mockResolvedValue({getTracks:()=>[{stop}]} as unknown as MediaStream);vi.mocked(speakingAPI.create).mockResolvedValue({id:"s1",mode:"live",examiner:{country:"Ireland",code:"IE",gender:"female",accent:"Irish",voice:"voice"},topic:"Travel · Part 2",status:"queued",error_code:"",created_at:"2026-10-08T00:00:00Z",audio_expires_at:"2026-11-08T00:00:00Z",turns:[]});render(<SpeakingPage onDirtyChange={()=>{}} planID="plan-18-1" part={2}/>);await waitFor(()=>expect(speakingAPI.settings).toHaveBeenCalled());expect(screen.getByText(/Focused Part 2 practice/)).toBeVisible();fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Start speaking interview"}));await waitFor(()=>expect(speakingAPI.create).toHaveBeenCalledWith("plan-18-1",2,undefined));expect(stop).toHaveBeenCalled()});
it("shows computed Speaking band, criterion feedback and saved transcripts",async()=>{
 const session:SpeakingSession={id:"speaking-1",examiner:{country:"Ireland",code:"IE",gender:"female",accent:"Dublin English",voice:"en-ie-advisor-2"},topic:"Learning",status:"completed",error_code:"",created_at:"2026-10-07T00:00:00Z",audio_expires_at:"2026-11-07T00:00:00Z",turns:[{position:0,part:1,prompt:"What do you study?",seconds:40,prep_seconds:0,voice_status:"ready",voice_attempts:1,duration_ms:12000,answered:true,skipped:false,has_recording:false}],report:{overall:6.5,assessable:true,summary:"Clear ideas; develop examples.",criteria:["fluency_coherence","lexical_resource","grammar","pronunciation"].map(key=>({key,score:6.5,reason:"Clear speech.",how_to_improve:"Practise stress patterns."})),responses:[{position:0,transcript:"I study science.",feedback:"Give a specific example."}],issues:[{category:"grammar",position:0,second:1,quote:"I study",explanation:"Develop the answer.",suggestion:"Add a reason."}],strengths:["A clear opening."],next_steps:["Extend your answer."]}};
 vi.mocked(speakingAPI.list).mockResolvedValue([session]);vi.mocked(speakingAPI.get).mockResolvedValue(session);render(<SpeakingPage onDirtyChange={()=>{}}/>);fireEvent.click(await screen.findByRole("button",{name:/Learning/}));await screen.findByRole("heading",{name:"Your speaking report."});expect(screen.getByText("Speaking band estimate").parentElement).toHaveTextContent("6.5");expect(screen.getByText("I study science.")).toBeVisible();expect(screen.getByText("Pronunciation",{exact:true})).toBeVisible();expect(screen.getAllByText(/Practise stress patterns/)).toHaveLength(4);expect(screen.getByText("Extend your answer.")).toBeVisible();
});

it("starts the read-and-record interview when the centre has no AI examiner",async()=>{
 const stop=vi.fn();vi.mocked(microphone).mockResolvedValue({getTracks:()=>[{stop}]} as unknown as MediaStream);
 // live:false is a centre that marks its own work. Asking for the spoken
 // examiner would be refused by the API, so it must not be asked for at all.
 vi.mocked(speakingAPI.settings).mockResolvedValue({enabled:true,live:false,countries:[{code:"GB",name:"United Kingdom"}],daily_limit:3,audio_retention_days:30});
 vi.mocked(speakingAPI.createRead).mockResolvedValue({id:"s1",mode:"",examiner:{country:"",code:"",gender:"",accent:"",voice:""},topic:"t",status:"active",turns:[],error_code:"",created_at:"2026-10-08T00:00:00Z",audio_expires_at:"2026-11-08T00:00:00Z"} as SpeakingSession);
 render(<SpeakingPage onDirtyChange={()=>{}}/>);
 await waitFor(()=>expect(speakingAPI.settings).toHaveBeenCalled());
 fireEvent.click(screen.getByRole("checkbox"));
 fireEvent.click(screen.getByRole("button",{name:"Start speaking interview"}));
 await waitFor(()=>expect(speakingAPI.createRead).toHaveBeenCalled());
 expect(speakingAPI.create).not.toHaveBeenCalled();
});

it("counts the preparation time down without an examiner to wait for",async()=>{
 // With AI off there is no examiner audio, so nothing ever reports "heard".
 // Preparation has to run from the moment the question is on screen, or the
 // clock never moves and the recorder, which only appears at zero, never
 // arrives -- Part 2 becomes unanswerable.
 //
 // Timed on real timers with a two-second preparation rather than faked ones:
 // the countdown reads the wall clock, so a fake clock installed around an
 // already-running interval made this flaky.
 const session:SpeakingSession={id:"read-1",examiner:{country:"",code:"",gender:"",accent:"",voice:""},topic:"Places",status:"active",error_code:"",created_at:"2026-11-05T00:00:00Z",audio_expires_at:"2026-12-05T00:00:00Z",turns:[{position:0,part:2,prompt:"Describe an interesting historic place.",seconds:120,prep_seconds:2,voice_status:"text",voice_attempts:0,duration_ms:0,answered:false,skipped:false,has_recording:false}],report:undefined};
 vi.mocked(speakingAPI.list).mockResolvedValue([session]);vi.mocked(speakingAPI.get).mockResolvedValue(session);
 render(<SpeakingPage onDirtyChange={()=>{}}/>);
 fireEvent.click(await screen.findByRole("button",{name:/Places/}));
 expect(await screen.findByText("0:02")).toBeVisible();
 expect(await screen.findByRole("button",{name:"Record answer"},{timeout:5000})).toBeVisible();
 expect(screen.queryByText(/Preparation time/)).toBeNull();
});

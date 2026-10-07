import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor,act} from "@testing-library/react";
import LiveSpeaking from "./LiveSpeaking";
import {microphone,SpeakingSession} from "./speaking";
vi.mock("./speaking",async()=>({...await vi.importActual("./speaking"),microphone:vi.fn()}));
const stopTrack=vi.fn(),closeAudio=vi.fn(),disconnect=vi.fn();
class Socket {static OPEN=1;static latest:Socket;readyState=1;binaryType="";bufferedAmount=0;onmessage:any;onclose:any;send=vi.fn();close=vi.fn();constructor(){Socket.latest=this}}
class Capture {static latest:Capture;port={onmessage:null as any};connect=vi.fn();disconnect=disconnect;constructor(){Capture.latest=this}}
class Audio {state="running";currentTime=0;destination={};audioWorklet={addModule:vi.fn().mockResolvedValue(undefined)};resume=vi.fn().mockResolvedValue(undefined);close=closeAudio;createMediaStreamSource=()=>({connect:vi.fn(),disconnect})}
const session={id:"test-live",mode:"live",turns:[{position:0,part:1,prompt:"What do you enjoy studying?",answered:false}]} as SpeakingSession;
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("WebSocket",Socket);vi.stubGlobal("AudioContext",Audio);vi.stubGlobal("AudioWorkletNode",Capture);closeAudio.mockResolvedValue(undefined);vi.mocked(microphone).mockResolvedValue({getTracks:()=>[{stop:stopTrack}]} as unknown as MediaStream)});
afterEach(()=>vi.unstubAllGlobals());
it("only streams microphone frames during listening and releases it on pause",async()=>{
 const dirty=vi.fn();render(<LiveSpeaking session={session} onSaved={()=>{}} onDirtyChange={dirty}/>);
 expect(microphone).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:"Record answer"})).not.toBeInTheDocument();
 expect(screen.queryByText("What do you enjoy studying?")).not.toBeInTheDocument();expect(screen.queryByText(/Question 1/)).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Repeat question"})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Connect to examiner"}));await waitFor(()=>expect(Capture.latest).toBeDefined());
 const frame=new ArrayBuffer(3200);Capture.latest.port.onmessage({data:frame});expect(Socket.latest.send).not.toHaveBeenCalled();
 act(()=>Socket.latest.onmessage({data:JSON.stringify({type:"state",phase:"listening",position:0,part:1,question:"What do you enjoy studying?"})}));
 Capture.latest.port.onmessage({data:frame});expect(Socket.latest.send).toHaveBeenCalledWith(frame);
 expect(screen.queryByText("What do you enjoy studying?")).not.toBeInTheDocument();expect(screen.getByText(/Just ask aloud/)).toBeVisible();
 act(()=>Socket.latest.onmessage({data:JSON.stringify({type:"state",phase:"preparing",position:6,part:2,question:"Describe a skill",prepare_until:Date.now()+60000})}));Socket.latest.send.mockClear();Capture.latest.port.onmessage({data:frame});expect(Socket.latest.send).not.toHaveBeenCalled();
 expect(screen.getByRole("region",{name:"Part 2 cue card"})).toHaveTextContent("Describe a skill");
 fireEvent.click(screen.getByRole("button",{name:"Pause interview"}));expect(stopTrack).toHaveBeenCalled();expect(Socket.latest.close).toHaveBeenCalled();expect(closeAudio).toHaveBeenCalled();expect(dirty).toHaveBeenLastCalledWith(false);
});
it("releases audio resources when leaving the page",async()=>{
 const view=render(<LiveSpeaking session={session} onSaved={()=>{}} onDirtyChange={()=>{}}/>);fireEvent.click(screen.getByRole("button",{name:"Connect to examiner"}));await waitFor(()=>expect(microphone).toHaveBeenCalled());await screen.findByRole("button",{name:"Pause interview"});view.unmount();expect(stopTrack).toHaveBeenCalled();expect(Socket.latest.close).toHaveBeenCalled();
});

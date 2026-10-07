import { useEffect, useRef, useState } from "react";
import { microphone, speakingAPI, SpeakingSession } from "./speaking";
import { MicIcon } from "./icons";
type State = {phase:string;position:number;part:number;question:string;prepare_until?:number};
export default function LiveSpeaking({session,onSaved,onDirtyChange}:{session:SpeakingSession;onSaved:(v:SpeakingSession)=>void;onDirtyChange:(v:boolean)=>void}) {
 const first=session.turns.find(t=>!t.answered)||session.turns[10];
 const [state,setState]=useState<State>({phase:"paused",position:first.position,part:first.part,question:first.prompt});
 const [error,setError]=useState(""),[connecting,setConnecting]=useState(false),[seconds,setSeconds]=useState(0);
 const resources=useRef<{socket:WebSocket;context:AudioContext;stream:MediaStream;capture:AudioWorkletNode;source:MediaStreamAudioSourceNode;sources:Set<AudioBufferSourceNode>}|null>(null);
 const generation=useRef(0),phase=useRef("paused"),alive=useRef(true),callbacks=useRef({onSaved,onDirtyChange});callbacks.current={onSaved,onDirtyChange};
 function stop(){generation.current++;const r=resources.current;resources.current=null;if(r){r.socket.close();r.capture.disconnect();r.source.disconnect();r.sources.forEach(s=>s.stop());r.stream.getTracks().forEach(t=>t.stop());void r.context.close()}phase.current="paused";callbacks.current.onDirtyChange(false)}
 useEffect(()=>{alive.current=true;const hide=()=>{if(document.hidden){stop();setState(s=>({...s,phase:"paused"}));setError("Interview paused while the app was in the background. Completed answers are saved.")}};document.addEventListener("visibilitychange",hide);return()=>{alive.current=false;stop();document.removeEventListener("visibilitychange",hide)}},[]);
 useEffect(()=>{const update=()=>setSeconds(Math.max(0,Math.ceil(((state.prepare_until||0)-Date.now())/1000)));update();const id=setInterval(update,250);return()=>clearInterval(id)},[state.prepare_until]);
 async function connect(){
  stop();const run=generation.current;setConnecting(true);setError("");let stream:MediaStream|null=null,context:AudioContext|null=null;
  try{
   context=new AudioContext();await context.resume();stream=await microphone();await context.audioWorklet.addModule("/speaking-capture.js");
   if(!alive.current||run!==generation.current){stream.getTracks().forEach(t=>t.stop());await context.close();return}
   const socket=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}/api/v1/speaking/live/sessions/${session.id}/stream`);socket.binaryType="arraybuffer";
   const capture=new AudioWorkletNode(context,"speaking-capture"),source=context.createMediaStreamSource(stream),sources=new Set<AudioBufferSourceNode>();
   source.connect(capture);capture.connect(context.destination);resources.current={socket,context,stream,capture,source,sources};callbacks.current.onDirtyChange(true);
   phase.current="connecting";setState(s=>({...s,phase:"connecting"}));let next=context.currentTime,ended=false,complete=false;
   const current=()=>alive.current&&run===generation.current;
   const send=(type:string)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type}))};
   const drained=()=>{if(ended&&sources.size===0){ended=false;send("playback_done")}};
   capture.port.onmessage=(event:MessageEvent<ArrayBuffer>)=>{if(current()&&phase.current==="listening"&&socket.readyState===WebSocket.OPEN){if(socket.bufferedAmount>128000){setError("Your connection is too slow for live audio. Reconnect when it is stable.");stop();setState(s=>({...s,phase:"paused"}));return}socket.send(event.data)}};
   socket.onmessage=event=>{
    if(!current())return;
    if(event.data instanceof ArrayBuffer){const view=new DataView(event.data);const buffer=context!.createBuffer(1,view.byteLength/2,24000),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;const audio=context!.createBufferSource();audio.buffer=buffer;audio.connect(context!.destination);sources.add(audio);audio.onended=()=>{sources.delete(audio);drained()};next=Math.max(next,context!.currentTime+.02);audio.start(next);next+=buffer.duration;return}
    const message=JSON.parse(event.data);
    if(message.type==="state"){phase.current=message.phase;setState(message);setConnecting(false)}
    if(message.type==="audio_end"){ended=true;drained()}
    if(message.type==="interrupted"){ended=false;sources.forEach(s=>s.stop());sources.clear();next=context!.currentTime}
    if(message.type==="done"){complete=true;stop();void speakingAPI.get(session.id).then(v=>{if(alive.current)callbacks.current.onSaved(v)}).catch(()=>{if(alive.current)setError("Interview saved. Return to Speaking history to open your report.")})}
   };
   socket.onclose=()=>{if(!current()||complete)return;stop();setConnecting(false);setState(s=>({...s,phase:"paused"}));setError("Connection paused. Completed answers are saved. Reconnect to repeat the unfinished answer.")};
   socket.onerror=()=>{if(current())setError("The live connection could not start. Please reconnect in a moment.")};
  }catch(e){stream?.getTracks().forEach(t=>t.stop());if(context&&context.state!=="closed")await context.close();if(alive.current&&run===generation.current){stop();setError(e instanceof Error?e.message:"Could not start microphone");setState(s=>({...s,phase:"paused"}))}}finally{if(alive.current)setConnecting(false)}
 }
 const connected=state.phase!=="paused";
 return <section className="writing-panel speaking-interview">
  <div className="speaking-turn-heading"><p className="eyebrow">Live speaking · Part {state.part}</p><span>Question {state.position+1} / 11</span></div>
  <div className="speaking-track" aria-label={`${state.position} of 11 answers completed`}>{session.turns.map(t=><span key={t.position} className={t.position<state.position?"done":t.position===state.position?"current":""}/>)}</div>
  <div className={`speaking-orb ${state.phase==="listening"?"is-recording":""}`}><MicIcon/></div>
  <p role="status">{state.phase==="listening"?"Listening. Take your time to finish your thought.":state.phase==="examiner"?"Your examiner is speaking…":state.phase==="preparing"?`Preparation · ${seconds} seconds remaining`:state.phase==="connecting"?"Connecting to your examiner…":"Ready when you are."}</p>
  <h2>{state.question}</h2>
  {state.part===2&&<textarea aria-label="Part 2 preparation notes" placeholder="Optional notes — not evaluated" rows={3}/>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  {!connected?<button className="primary-action" disabled={connecting} onClick={()=>void connect()}>{connecting?"Connecting…":"Connect to examiner"}</button>:<button className="secondary-action" onClick={()=>{stop();setState(s=>({...s,phase:"paused"}))}}>Pause interview</button>}
  {state.phase==="listening"&&<button className="secondary-action" onClick={()=>resources.current?.socket.send(JSON.stringify({type:"repeat"}))}>Repeat question</button>}
  <p><small>Use headphones. Speak naturally; short thinking pauses are welcome. Completed answers are saved automatically. Pausing or losing connection means repeating the current answer.</small></p>
 </section>;
}

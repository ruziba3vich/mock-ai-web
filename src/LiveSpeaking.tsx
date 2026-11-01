import { useEffect, useRef, useState } from "react";
import Examiner from "./Examiner";
import { microphone, speakingAPI, SpeakingSession } from "./speaking";
import { MicIcon } from "./icons";
type State = {phase:string;position:number;part:number;question:string;prepare_until?:number};
/** Map the server's wire phases onto the face's states. The examiner talking
 *  arrives as "examiner", not "speaking". */
function examinerPhase(p:string):"paused"|"connecting"|"speaking"|"listening"|"thinking"{
 if(p==="examiner"||p==="speaking")return "speaking";
 if(p==="listening")return "listening";
 if(p==="thinking"||p==="preparing")return "thinking";
 if(p==="connecting")return "connecting";
 return "paused";
}

export default function LiveSpeaking({session,onSaved,onDirtyChange,onExit}:{session:SpeakingSession;onSaved:(v:SpeakingSession)=>void;onDirtyChange:(v:boolean)=>void;onExit?:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;if(el?.showModal)el.showModal();else el?.setAttribute("open","");return()=>el?.close?.()},[]);
 const first=session.turns.find(t=>!t.answered)||session.turns[10];
 const [state,setState]=useState<State>({phase:"paused",position:first.position,part:first.part,question:first.prompt});
 const [error,setError]=useState(""),[connecting,setConnecting]=useState(false),[seconds,setSeconds]=useState(0);
 const resources=useRef<{socket:WebSocket;context:AudioContext;stream:MediaStream;capture:AudioWorkletNode;source:MediaStreamAudioSourceNode;sources:Set<AudioBufferSourceNode>}|null>(null);
 const meter=useRef<{voice:AnalyserNode;ear:AnalyserNode}|null>(null),level=useRef(0),reportedAt=useRef(0);
 const generation=useRef(0),phase=useRef("paused"),alive=useRef(true),retryTimer=useRef<number|undefined>(undefined),retryAttempt=useRef(0),callbacks=useRef({onSaved,onDirtyChange});callbacks.current={onSaved,onDirtyChange};
 function stop(){meter.current=null;level.current=0;generation.current++;if(retryTimer.current!==undefined){window.clearTimeout(retryTimer.current);retryTimer.current=undefined}const r=resources.current;resources.current=null;if(r){r.socket.close();r.capture.disconnect();r.source.disconnect();r.sources.forEach(s=>s.stop());r.stream.getTracks().forEach(t=>t.stop());void r.context.close()}phase.current="paused";callbacks.current.onDirtyChange(false)}
 // Sample the active analyser each frame into a ref. The face reads this
 // ref directly and writes a CSS variable, so nothing here re-renders.
 useEffect(()=>{
  let raf=0;const bins=new Uint8Array(128);
  const read=()=>{
   const m=meter.current;
   if(!m){level.current=0}
   else{
    const node=phase.current==="listening"?m.ear:m.voice; // ear while the student speaks, voice otherwise
    node.getByteTimeDomainData(bins);
    let sum=0;for(let i=0;i<bins.length;i++){const v=(bins[i]-128)/128;sum+=v*v}
    const rms=Math.sqrt(sum/bins.length);
    // Speech RMS rarely passes ~0.3; map that range onto 0..1.
    level.current=Math.max(0,Math.min(1,rms*3.4));
    // Report what the browser itself hears, so a stalled interview can tell a
    // dead microphone apart from a capture bug.
    if(phase.current==="listening"&&Date.now()-reportedAt.current>1000){
     reportedAt.current=Date.now();
     const socket=resources.current?.socket;
     if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:"mic_level",rms:Number(rms.toFixed(4))}));
    }
   }
   raf=requestAnimationFrame(read);
  };
  raf=requestAnimationFrame(read);
  return()=>cancelAnimationFrame(raf);
 },[]);
 useEffect(()=>{alive.current=true;const hide=()=>{if(document.hidden){stop();setState(s=>({...s,phase:"paused"}));setError("Interview paused while the app was in the background. Completed answers are saved.")}};document.addEventListener("visibilitychange",hide);return()=>{alive.current=false;stop();document.removeEventListener("visibilitychange",hide)}},[]);
 useEffect(()=>{const update=()=>setSeconds(Math.max(0,Math.ceil(((state.prepare_until||0)-Date.now())/1000)));update();const id=setInterval(update,250);return()=>clearInterval(id)},[state.prepare_until]);
 async function connect(){
  stop();const run=generation.current;setConnecting(true);setError("");let stream:MediaStream|null=null,context:AudioContext|null=null;
  try{
   context=new AudioContext();await context.resume();stream=await microphone();await context.audioWorklet.addModule("/speaking-capture.js");
   if(!alive.current||run!==generation.current){stream.getTracks().forEach(t=>t.stop());await context.close();return}
   const socket=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}/api/v1/speaking/live/sessions/${session.id}/stream`);socket.binaryType="arraybuffer";
   const capture=new AudioWorkletNode(context,"speaking-capture"),source=context.createMediaStreamSource(stream),sources=new Set<AudioBufferSourceNode>();
   // Two analysers drive the examiner's face: one on the examiner's own
   // playback, one on the microphone. The face follows whichever is talking.
   // Metering drives the examiner's face. It is an enhancement: if the
   // platform has no analyser the interview runs exactly as before.
   let voice:AudioNode=context.destination,ear:AnalyserNode|null=null;
   if(typeof context.createAnalyser==="function"){
    const v=context.createAnalyser();v.fftSize=256;v.smoothingTimeConstant=.6;v.connect(context.destination);voice=v;
    ear=context.createAnalyser();ear.fftSize=256;ear.smoothingTimeConstant=.6;source.connect(ear);
    meter.current={voice:v,ear};
   }
   source.connect(capture);capture.connect(context.destination);resources.current={socket,context,stream,capture,source,sources};
   callbacks.current.onDirtyChange(true);
   phase.current="connecting";setState(s=>({...s,phase:"connecting"}));let next=context.currentTime,ended=false,complete=false;
   const current=()=>alive.current&&run===generation.current;
   const send=(type:string)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type}))};
   const drained=()=>{if(ended&&sources.size===0){ended=false;send("playback_done")}};
   capture.port.onmessage=(event:MessageEvent<ArrayBuffer>)=>{if(current()&&phase.current==="listening"&&socket.readyState===WebSocket.OPEN){if(socket.bufferedAmount>128000){setError("Your connection is too slow for live audio. Reconnect when it is stable.");stop();setState(s=>({...s,phase:"paused"}));return}socket.send(event.data)}};
   socket.onmessage=event=>{
    if(!current())return;
    if(event.data instanceof ArrayBuffer){const view=new DataView(event.data);const buffer=context!.createBuffer(1,view.byteLength/2,24000),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;const audio=context!.createBufferSource();audio.buffer=buffer;audio.connect(voice!);sources.add(audio);audio.onended=()=>{sources.delete(audio);drained()};next=Math.max(next,context!.currentTime+.02);audio.start(next);next+=buffer.duration;return}
    const message=JSON.parse(event.data);
    if(message.type==="error"&&message.retryable===false){complete=true;stop();setConnecting(false);setState(s=>({...s,phase:"paused"}));setError("Speaking is temporarily unavailable. Your completed answers are saved. Please try again later.");return}
    if(message.type==="state"){retryAttempt.current=0;setError("");phase.current=message.phase;setState(message);setConnecting(false)}
    if(message.type==="audio_end"){ended=true;drained()}
    if(message.type==="interrupted"){ended=false;sources.forEach(s=>s.stop());sources.clear();next=context!.currentTime}
    if(message.type==="done"){complete=true;stop();void speakingAPI.get(session.id).then(v=>{if(alive.current)callbacks.current.onSaved(v)}).catch(()=>{if(alive.current)setError("Interview saved. Return to Speaking history to open your report.")})}
   };
   socket.onclose=()=>{if(!current()||complete)return;const attempt=retryAttempt.current+1;retryAttempt.current=attempt;stop();if(attempt<=10&&alive.current&&!document.hidden){const delay=Math.min(8000,1000*2**(attempt-1));phase.current="connecting";setConnecting(true);setState(s=>({...s,phase:"connecting"}));setError("Connection interrupted. Reconnecting automatically…");retryTimer.current=window.setTimeout(()=>{retryTimer.current=undefined;void connect()},delay);return}setConnecting(false);setState(s=>({...s,phase:"paused"}));setError("Connection paused. Completed answers are saved. Tap the microphone to reconnect and repeat the unfinished answer.")};
   socket.onerror=()=>{};
  }catch(e){stream?.getTracks().forEach(t=>t.stop());if(context&&context.state!=="closed")await context.close();if(alive.current&&run===generation.current){stop();setError(e instanceof Error?e.message:"Could not start microphone");setState(s=>({...s,phase:"paused"}))}}finally{if(alive.current)setConnecting(false)}
 }
 const connected=state.phase!=="paused";
 return <dialog ref={dialog} className={`speaking-voice-stage voice-${state.phase}`} aria-label="Live speaking interview" onCancel={e=>{e.preventDefault();onExit?.()}} data-position={state.position}>
  <header className="voice-header"><span>Speaking <span aria-hidden="true">·</span> Part {state.part}</span>{onExit&&<button className="voice-close" aria-label="Leave interview" onClick={onExit}>×</button>}</header>
  <div className="voice-center">
  <Examiner phase={examinerPhase(state.phase)} levelRef={level} />
  <button className="voice-mic" aria-label={connected?"Pause interview":"Connect to examiner"} disabled={connecting} onClick={()=>{if(connected){stop();setState(s=>({...s,phase:"paused"}))}else void connect()}}><MicIcon/></button>
  <p role="status">{state.phase==="listening"?"Listening. Take your time to finish your thought.":state.phase==="examiner"?"Your examiner is speaking…":state.phase==="preparing"?`Preparation · ${seconds} seconds remaining`:state.phase==="connecting"?"Connecting to your examiner…":"Ready when you are."}</p>
  {state.part===2&&(state.phase==="preparing"||state.phase==="listening")&&<section className="voice-cue-card" aria-label="Part 2 cue card"><small>Your cue card</small><p>{state.question}</p><textarea aria-label="Part 2 preparation notes" placeholder="Optional notes — not evaluated" rows={3}/></section>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <p className="voice-hint">{connected?"Need something repeated or explained? Just ask aloud.":"Tap the microphone to begin. Use headphones."}</p>
  </div><footer className="voice-footer">AI speaking practice · Tap the microphone to {connected?"pause":"connect"}</footer>
 </dialog>;
}

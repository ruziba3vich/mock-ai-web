import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { microphone, normalizeRecording, speakingAPI, speakingLabels, SpeakingSession, SpeakingSettings, SpeakingTurn } from "./speaking";
import { CalendarIcon, CheckIcon, MicIcon } from "./icons";
import Poster from "./Poster";
import { stagger } from "./motion";
import { BandBox, Criteria, Marked, ReportStage, TitleCard, weakest } from "./ReportParts";
import type { Criterion } from "./ReportParts";
import LiveSpeaking from "./LiveSpeaking";
import { APIError } from "./auth";
import type { PracticeCredits } from "./WritingPage";

const message=(e:unknown)=>e instanceof Error?e.message:"Speaking could not be loaded. Please try again.";
type Props={onDirtyChange:(v:boolean)=>void;mode?:"practice"|"mock";onSessionStarted?:(v:SpeakingSession)=>void;onSubmitted?:(v:SpeakingSession)=>void;planID?:string;part?:number;fullMockId?:string;credits?:PracticeCredits};
export default function SpeakingPage({onDirtyChange,mode="practice",onSessionStarted,onSubmitted,planID,part,fullMockId,credits}:Props) {
 const [needCredits,setNeedCredits]=useState(false);
 const [settings,setSettings]=useState<SpeakingSettings|null>(null),[history,setHistory]=useState<SpeakingSession[]>([]),[selected,setSelected]=useState<SpeakingSession|null>(null);
 const [error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[consent,setConsent]=useState(false),[dirty,setDirty]=useState(false);
 const alive=useRef(true);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false}},[]);
 useEffect(()=>{onDirtyChange(dirty);const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=""}};window.addEventListener("beforeunload",warn);return()=>{onDirtyChange(false);window.removeEventListener("beforeunload",warn)}},[dirty,onDirtyChange]);
 function remember(v:SpeakingSession){setSelected(v);setHistory(old=>[v,...old.filter(x=>x.id!==v.id)].slice(0,30));if(mode==="mock"&&["queued","processing","completed"].includes(v.status))onSubmitted?.(v)}
 async function load(){setLoading(true);setError("");try{const [s,h]=await Promise.all([speakingAPI.settings(),speakingAPI.list()]);if(alive.current){setSettings(s);setHistory(h)}}catch(e){if(alive.current)setError(message(e))}finally{if(alive.current)setLoading(false)}}
 async function act(fn:()=>Promise<void>){setBusy(true);setError("");setNeedCredits(false);try{await fn()}catch(e){if(alive.current){setError(message(e));setNeedCredits(e instanceof APIError&&e.status===402)}}finally{if(alive.current)setBusy(false)}}
 const pending=selected?.status==="queued"||selected?.status==="processing";
 // Parked for a person, not for a worker: never tell this student a report is
 // being generated.
 const awaitingCentre=selected?.status==="awaiting_review";
 useEffect(()=>{if(!selected||(!pending&&selected.status!=="active")||(selected.mode==="live"&&dirty))return;let live=true,inFlight=false;const id=selected.id;const timer=window.setInterval(async()=>{if(inFlight)return;inFlight=true;try{const v=await speakingAPI.get(id);if(live)remember(v)}catch{if(live)setError("Connection interrupted. Saved answers are safe. Reconnecting…")}finally{inFlight=false}},2500);return()=>{live=false;window.clearInterval(timer)}},[selected?.id,selected?.status,pending,dirty]);
 function leave(){return !dirty||window.confirm("Leave this answer? Your unsaved recording will be lost; earlier answers are saved.")}
 function open(id:string|null){if(busy||!leave())return;if(!id){setSelected(null);setError("");return}void act(async()=>{const v=await speakingAPI.get(id);if(alive.current)remember(v)})}
 const active=history.find(v=>["active","queued","processing"].includes(v.status));
 const turn=selected?.turns?.find(v=>!v.answered);
 async function start(){await act(async()=>{const stream=await microphone();stream.getTracks().forEach(t=>t.stop());if(!alive.current)return;// A centre that marks its own work gets no spoken examiner, so it reads
  // the questions and records instead. settings.live says which this student
  // is entitled to; starting the wrong one is refused by the API.
  const v=settings?.live===false?await speakingAPI.createRead(planID,part,fullMockId):await speakingAPI.create(planID,part,fullMockId);if(mode!=="mock")credits?.onUsed();if(alive.current){remember(v);onSessionStarted?.(v)}})}
 async function remove(target=selected){if(!target||!window.confirm("Permanently delete this interview, recordings and report? This cannot be undone."))return;const id=target.id;await act(async()=>{await speakingAPI.remove(id);setHistory(old=>old.filter(v=>v.id!==id));setSelected(null)})}
 if(selected?.mode==="live"&&selected.status==="active"&&turn)return <LiveSpeaking key={selected.id} session={selected} onSaved={remember} onDirtyChange={setDirty} onExit={()=>open(null)}/>;
 const notice=error&&<div className="global-notice error" role="alert">{error}{needCredits&&credits&&!credits.centreName?<button onClick={credits.onBuy}>Get Speaking interviews</button>:<button onClick={()=>void load()}>Refresh</button>}</div>;
 const disclaimer=<p className="rp-disclaimer">AI practice feedback, not an official IELTS result. Pronunciation feedback focuses on intelligibility—not losing your accent.</p>;
 const showReport=selected?.status==="completed"&&!!selected.report;
 const historyList=mode!=="mock"&&<aside className={`writing-history rp-history${showReport?" is-strip":""}`} aria-label="Speaking history"><div className="rp-history-head"><h2>Your interviews</h2><small>Latest 30 sessions</small></div><div className="rp-history-list">{loading?<p>Loading…</p>:history.length?history.map(v=><button key={v.id} className={selected?.id===v.id?"active":""} disabled={busy} onClick={()=>open(v.id)}><strong>{v.topic}</strong><span>{v.status}{v.report?.overall!=null?` · ${v.report.overall.toFixed(1)}`:""}</span><small>{new Date(v.created_at).toLocaleDateString()}</small></button>):<p>Your first interview and report will appear here.</p>}</div></aside>;
 const expiry=selected&&<><p className="rp-small">Audio expires {new Date(selected.audio_expires_at).toLocaleDateString()}. Reports and transcripts remain until you delete the interview.</p><button className="rp-delete" disabled={busy||dirty} onClick={()=>void remove()}>Delete interview and recordings</button></>;
 if(showReport&&selected)return <ReportStage key={selected.id} className="content page-content rp rp-report">
  <TitleCard skill="speaking" kicker="Speaking" title="Interview report" back={mode!=="mock"?{label:"Speaking home",onClick:()=>open(null),disabled:busy}:undefined}/>
  <p className="rp-meta rise" style={stagger(0,1000)}><span><CalendarIcon/>{new Date(selected.created_at).toLocaleDateString()}</span><span><MicIcon/>{selected.topic}</span><span>{selected.turns.length} questions</span></p>
  {notice}
  <SpeakingResult session={selected} after={<>{disclaimer}{expiry}</>}/>
  {historyList}
 </ReportStage>;
 return <div className="content page-content rp rp-speak">
  <header className="rp-head"><Poster skill="speaking" size="sm" tag={part?`Part ${part}`:"Parts 1–3"} className="rp-head-art"/><div><p className="eyebrow">{mode==="mock"?"Full mock · Speaking":"Speaking"}</p><h1>{selected?"Your speaking interview.":mode==="mock"?"Complete your final section.":"Find your speaking confidence."}</h1>{!selected&&<p>{mode==="mock"?"Your live examiner will guide the conversation. Finish the interview to complete your mock.":part?`Focused Part ${part} practice with a live examiner and detailed feedback.`:"A different examiner. Your own voice. A clear next step."}</p>}</div>{selected&&mode!=="mock"&&<button className="btn btn-ghost" disabled={busy} onClick={()=>open(null)}>Speaking home</button>}</header>
  {disclaimer}
  {notice}
  <div className={`rp-work${mode==="mock"?" is-mock":""}`}>{historyList}
  <section className="rp-workspace">
   {!selected&&<div className="rp-panel rp-intro"><h2>Let’s have a conversation</h2><p>Listen, speak naturally, and take time to gather your thoughts. Your examiner guides you through {part?`Part ${part}`:"all three parts"}.</p>
   <ol className="rp-parts">{(!part||part===1)&&<li><b className="num">1</b><strong>Get comfortable</strong><span>Questions about everyday life</span></li>}{(!part||part===2)&&<li><b className="num">2</b><strong>Tell a story</strong><span>One-minute preparation · two-minute long turn</span></li>}{(!part||part===3)&&<li><b className="num">3</b><strong>Go deeper</strong><span>A discussion with reasons and examples</span></li>}</ol>
   <p className="rp-small">A real-time voice interview with an AI examiner. Allow about {part?"3–5":"12–15"} minutes, use headphones, and find a quiet space. Your report follows when the interview finishes.</p>
   {active?<button className="btn btn-primary" disabled={busy} onClick={()=>open(active.id)}>Continue your interview</button>:<><label className="rp-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>I agree to securely process my microphone audio for this live interview, transcription and feedback. Recordings are encrypted in mock-ai and kept for {settings?.audio_retention_days||30} days. I can delete my interview at any time. I won’t share private information.</span></label>{mode!=="mock"&&credits&&<p className="credit-cost">{credits.balance>0?<>Uses 1 {credits.centreName?<>of {credits.centreName}'s </>:""}Speaking interview · <strong>{credits.balance} left</strong></>:credits.centreName?<>{credits.centreName} has no Speaking interviews left. Ask your centre to add more.</>:<>You have no Speaking interviews left. <button type="button" className="link-button" onClick={credits.onBuy}>Get Speaking interviews</button></>}</p>}<button className="btn btn-primary" disabled={busy||loading||!consent||!settings?.enabled||(mode!=="mock"&&!!credits&&credits.balance<1)} onClick={()=>void start()}>{busy?"Checking microphone…":"Start speaking interview"}</button>{!loading&&!settings?.enabled&&<p role="status">Speaking is temporarily unavailable. Please try again later.</p>}<small>Up to {settings?.daily_limit||3} new interviews per UTC day. Your browser will ask for microphone permission.</small></>}
   {active?.status==="active"&&<button className="rp-delete" disabled={busy} onClick={()=>void remove(active)}>Delete active interview</button>}
   </div>}
   {selected&&<><div className="rp-examiner"><Poster skill="speaking" size="sm" className="rp-examiner-art"/><div><strong>Your speaking examiner</strong><span>{selected.status==="awaiting_review"||selected.turns.some(t=>t.voice_status==="text")?"Marked by your centre":"AI practice interview"}</span></div></div>
    {selected.status==="active"&&turn&&(selected.mode==="live"?<LiveSpeaking key={selected.id} session={selected} onSaved={remember} onDirtyChange={setDirty}/>:<InterviewTurn key={`${selected.id}-${turn.position}`} session={selected} turn={turn} onSaved={remember} onDirtyChange={setDirty}/>)}
    {selected.status==="active"&&!turn&&<section className="rp-panel rp-state"><h2>You’ve reached the finish.</h2><p>{selected.turns.filter(t=>!t.skipped).length} answers recorded · {selected.turns.filter(t=>t.skipped).length} skipped. Your report will cover {new Set(selected.turns.map(t=>t.part)).size===1?`Part ${selected.turns[0]?.part}`:"all three parts"}.</p><button className="btn btn-primary" disabled={busy} onClick={()=>void act(async()=>remember(await speakingAPI.submit(selected.id)))}>Get my speaking report</button></section>}
    {awaitingCentre&&<section className="rp-panel rp-state" role="status"><h2>Sent to your centre.</h2><p>Your teachers will listen to your answers and mark them. There is no automatic score for this interview.</p></section>}
    {pending&&<section className="rp-panel rp-state" role="status"><h2>{selected.evaluation&&selected.evaluation.total>0&&selected.evaluation.completed===selected.evaluation.total?"Preparing your final report…":selected.status==="queued"?"Your report is in the queue.":"Listening to your answers…"}</h2><span className="rp-wait" aria-hidden="true"/>{!!selected.evaluation?.total&&<p>{selected.evaluation.completed} of {selected.evaluation.total} speaking parts evaluated.</p>}<p>We’re checking fluency, vocabulary, grammar and pronunciation from your audio. This can take a few minutes. You can leave and return through Speaking history.</p></section>}
    {selected.status==="failed"&&<section className="rp-panel rp-state" role="alert"><h2>Your report didn’t finish</h2><p>No score was saved. Your recordings are safe until their expiry date. You can retry the evaluation.</p><button className="btn btn-primary" disabled={busy||Date.parse(selected.audio_expires_at)<Date.now()} onClick={()=>void act(async()=>remember(await speakingAPI.submit(selected.id)))}>Retry speaking report</button><small>Up to 5 report requests per UTC day, including retries.</small></section>}
    {selected.status==="expired"&&<section className="rp-panel rp-state"><h2>This interview has expired</h2><p>The 30-day recording window has ended. Start a new interview to continue practising.</p></section>}
    {expiry}
   </>}
  </section></div>
 </div>;
}
function InterviewTurn({session,turn,onSaved,onDirtyChange}:{session:SpeakingSession;turn:SpeakingTurn;onSaved:(v:SpeakingSession)=>void;onDirtyChange:(v:boolean)=>void}) {
 const [heard,setHeard]=useState(false),[prep,setPrep]=useState(turn.prep_seconds),[recording,setRecording]=useState(false),[elapsed,setElapsed]=useState(0),[blob,setBlob]=useState<Blob|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[url,setURL]=useState("");
 // A centre that marks its own work has no synthesised examiner: the question
 // is read from the screen, so there is nothing to wait for and nothing to
 // listen to. Treat it as heard the moment it is shown.
 const readOnly=turn.voice_status==="text";
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),alive=useRef(true),started=useRef(0),examiner=useRef<HTMLAudioElement|null>(null),run=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;run.current++;if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop())}},[]);
 useEffect(()=>{onDirtyChange(recording||!!blob||busy);return()=>onDirtyChange(false)},[recording,blob,busy,onDirtyChange]);
 useEffect(()=>{if(!blob){setURL("");return}const u=URL.createObjectURL(blob);setURL(u);return()=>URL.revokeObjectURL(u)},[blob]);
 // Preparation runs from the moment the question is delivered: the examiner
 // finishing speaking, or — with no examiner to wait for — the first paint.
 useEffect(()=>{if((!heard&&!readOnly)||prep<=0)return;const end=Date.now()+prep*1000;const t=window.setInterval(()=>setPrep(Math.max(0,Math.ceil((end-Date.now())/1000))),250);return()=>clearInterval(t)},[heard,readOnly]);
 useEffect(()=>{if(!recording)return;const t=window.setInterval(()=>{const e=Math.floor((Date.now()-started.current)/1000);setElapsed(Math.min(e,turn.seconds));if(e>=turn.seconds)stop()},200);return()=>clearInterval(t)},[recording,turn.seconds]);
 useEffect(()=>{const hide=()=>{if(document.hidden&&recorder.current?.state==="recording"){stop();setError("Recording stopped because you left the app. Review the captured answer or record it again.")}};document.addEventListener("visibilitychange",hide);return()=>document.removeEventListener("visibilitychange",hide)},[]);
 async function act(fn:()=>Promise<void>){setBusy(true);setError("");try{await fn()}catch(e){if(alive.current)setError(message(e))}finally{if(alive.current)setBusy(false)}}
 function stop(){if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());setRecording(false)}
 async function record(){setError("");setBusy(true);const generation=++run.current;try{const media=await microphone();if(!alive.current||run.current!==generation){media.getTracks().forEach(t=>t.stop());return}stream.current=media;examiner.current?.pause();const rec=new MediaRecorder(media);recorder.current=rec;const chunks:Blob[]=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onerror=()=>{stop();setError("Recording was interrupted. Please record this answer again.")};rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());if(!alive.current||run.current!==generation)return;setRecording(false);void act(async()=>{const wav=await normalizeRecording(new Blob(chunks,{type:rec.mimeType}),turn.seconds);if(alive.current&&run.current===generation)setBlob(wav)})};rec.start(500);setBlob(null);started.current=Date.now();setElapsed(0);setRecording(true)}catch(e){stream.current?.getTracks().forEach(t=>t.stop());if(alive.current)setError(message(e))}finally{if(alive.current)setBusy(false)}}
 const ready=turn.voice_status==="ready";
 return <section className="rp-panel rp-turn"><div className="rp-turn-head"><p className="eyebrow">Part {turn.part} · {turn.part===1?"Introduction":turn.part===2?"Long turn":"Discussion"}</p><span>Question {turn.position+1} / {session.turns.length}</span></div><div className="rp-track" aria-label={`${turn.position} of ${session.turns.length} answers saved`}>{session.turns.map(t=><span key={t.position} className={t.answered?(t.skipped?"skipped":"done"):t.position===turn.position?"current":""}/>)}</div><h2>{turn.prompt}</h2>
  {!ready&&!readOnly&&turn.voice_status!=="failed"&&<p role="status">Your examiner is preparing this question…</p>}
  {/* Parallel to the spoken examiner's line, and nothing more. Who marks the
      interview is said once when it is submitted; repeating it under all
      eleven questions is not something the student can act on here. */}
  {readOnly&&<p>Read the question, then record your answer.</p>}
  {turn.voice_status==="failed"&&<div role="alert"><p>The examiner audio could not be prepared.</p>{turn.voice_attempts<3?<button className="btn btn-ghost" disabled={busy} onClick={()=>void act(async()=>{await speakingAPI.retry(session.id,turn.position);onSaved(await speakingAPI.get(session.id))})}>Retry examiner audio</button>:<p>Please delete this interview and try again later. Your daily limit still applies.</p>}</div>}
  {ready&&<><p>Listen to your examiner, then record your answer.</p><audio ref={examiner} controls autoPlay preload="auto" src={speakingAPI.audio(session.id,turn.position,"examiner")} onPlay={()=>{if(recording)examiner.current?.pause()}} onEnded={()=>setHeard(true)} onError={()=>setError("The question audio could not load. Check your connection and reload this interview.")} aria-label="Examiner question"/><small>If playback doesn’t start automatically, press Play.</small></>}
  {(heard||readOnly)&&prep>0&&<div className="rp-prep" role="status"><strong>{clock(prep)}</strong><span>Preparation time · plan your main points</span><textarea aria-label="Part 2 preparation notes" placeholder="Optional notes—only on this screen, not evaluated" rows={3}/></div>}
  {(heard||readOnly)&&prep===0&&<div className="rp-recorder"><div className={`rp-orb${recording?" is-recording":""}`} aria-hidden="true"><MicIcon/></div><strong className="speaking-clock">{clock(recording?turn.seconds-elapsed:turn.seconds)}</strong><p role="status">{recording?"Recording your answer…":blob?"Listen back, then save your answer.":"Your turn. Speak naturally and give reasons or examples."}</p>
   {recording?<button className="btn btn-primary" onClick={stop}>Stop recording</button>:<button className={blob?"btn btn-ghost":"btn btn-primary"} disabled={busy} onClick={()=>void record()}>{blob?"Record again":"Record answer"}</button>}
   {url&&<audio controls src={url} aria-label="Your unsaved answer"/>}
   {blob&&!recording&&<button className="btn btn-primary" disabled={busy} onClick={()=>void act(async()=>{const v=await speakingAPI.answer(session.id,turn.position,blob);if(alive.current)onSaved(v)})}>{busy?"Saving answer…":"Save answer and continue"}</button>}
  </div>}
  {busy&&!recording&&<p role="status">Working… Keep this page open.</p>}{error&&<p className="form-error" role="alert">{error}</p>}
  {ready&&<button className="rp-delete" disabled={recording||busy} onClick={()=>{if(window.confirm("Skip this answer? Missing answers can make your band estimate less reliable."))void act(async()=>onSaved(await speakingAPI.skip(session.id,turn.position)))}}>Skip this answer</button>}
  <small>Answers are saved when you continue. An unfinished recording is lost if you leave. Each answer stops automatically at the time limit.</small>
 </section>;
}
function SpeakingResult({session,after}:{session:SpeakingSession;after:ReactNode}) {
 const r=session.report!,[position,setPosition]=useState(0),[playError,setPlayError]=useState(""),[picked,setPicked]=useState<number|null>(null);const audio=useRef<HTMLAudioElement|null>(null),seek=useRef<number|null>(null);
 const turn=session.turns[position],response=r.responses.find(v=>v.position===position),available=turn?.has_recording&&Date.parse(session.audio_expires_at)>Date.now();
 function play(pos:number,second:number){setPlayError("");seek.current=second;if(position===pos&&audio.current){audio.current.currentTime=second;void audio.current.play().catch(()=>setPlayError("Press Play to listen to this moment."));seek.current=null}else setPosition(pos)}
 const criteria:Criterion[]=r.criteria.map(c=>({key:c.key,name:speakingLabels[c.key],score:c.score,body:<><p>{c.reason}</p><p><b>How to improve:</b> {c.how_to_improve}</p></>}));
 const low=weakest(criteria);
 return <div className="rp-grid">
  <div className="rp-side"><div className="rp-zone"><div className="rp-stick">
   <section className="rp-band"><BandBox label="Speaking band estimate" value={r.overall}/><div className="rise" style={stagger(0,1700)}><p className="rp-lead">{r.assessable?"Across all four criteria":"Not enough evidence for a reliable score"}{low.length>0&&<>. {low.map(c=>c.name).join(" and ")} {low.length>1?"are":"is"} costing you most.</>}</p><p>{r.summary}</p></div></section>
   <section className="rp-crit-sec"><h2 className="rise" style={stagger(0,1950)}>Criteria</h2><Criteria items={criteria}/></section>
   </div></div>
   <section className="rp-next rise" style={stagger(0,3240)}><h2>Your next practice</h2><ol>{r.next_steps.map((v,i)=><li key={i}>{v}</li>)}</ol></section>
  </div>
  <div className="rp-main">
   <section className="rp-lost"><h2 className="rise" style={stagger(0,2700)}>Listen. Notice. Improve.</h2><label className="rise" style={stagger(0,2740)}>Review an answer<select value={position} onChange={e=>{seek.current=null;setPosition(Number(e.target.value));setPlayError("")}}>{session.turns.map(t=><option key={t.position} value={t.position}>Part {t.part} · Question {t.position+1}{t.skipped?" · skipped":""}</option>)}</select></label>
    <div className="rp-essay rise" style={stagger(0,2750)}><h3>{turn?.prompt}</h3>{available?<audio key={position} ref={audio} controls src={speakingAPI.audio(session.id,position,"recording")} aria-label="Recorded answer" onLoadedMetadata={()=>{if(seek.current!=null&&audio.current){audio.current.currentTime=seek.current;seek.current=null;void audio.current.play().catch(()=>setPlayError("Press Play to listen to this moment."))}}} onError={()=>setPlayError("Audio is unavailable. It may have expired; your transcript remains below.")}/>:<p>{turn?.skipped?"This question was skipped.":"Recording expired or unavailable. Your transcript is still saved."}</p>}{playError&&<p role="status">{playError}</p>}<blockquote className="read"><Marked text={response?.transcript||"No transcribed speech."} marks={r.issues.map((v,i)=>({quote:v.position===position?v.quote:"",n:i+1}))} active={picked==null?null:picked+1}/></blockquote><p>{response?.feedback}</p><small>Transcripts and timestamps are AI-generated and may contain errors.</small></div>
    <h3 className="rp-sub rise" style={stagger(0,2860)}>Your improvement points</h3>
    <ol className="rp-issues">{r.issues.length?r.issues.map((issue,i)=><li key={i} className={`rp-issue rise${picked===i?" selected":""}`} style={stagger(i,2900,90)}><span className="rp-no" aria-hidden="true">{i+1}</span><div><strong className="eyebrow">{speakingLabels[issue.category]}</strong><button className="rp-q" onClick={()=>{setPicked(i);play(issue.position,issue.second)}}>Question {issue.position+1} · {clock(Math.floor(issue.second))} · “{issue.quote}”</button><p>{issue.explanation}</p><p><b>Try this:</b> {issue.suggestion}</p></div></li>):<li><p>No specific timestamped issues were returned. Use the criterion feedback and next steps below.</p></li>}</ol>
   </section>
   <section className="rp-panel rise" style={stagger(0,3080)}><h2>What worked</h2><ul className="rp-checks">{r.strengths.map((v,i)=><li key={i}><CheckIcon/>{v}</li>)}</ul></section>
   {after}
  </div>
 </div>;
}
function clock(v:number){return `${Math.floor(v/60)}:${String(v%60).padStart(2,"0")}`}

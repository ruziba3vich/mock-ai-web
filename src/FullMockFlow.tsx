import {useEffect,useRef,useState} from "react";
import type {ReactNode} from "react";
import {Exam,examAPI} from "./exams";
import {FullMockSession,FullMockStage} from "./fullMock";
import FullMockWriting from "./FullMockWriting";
import FullMockWritingScore from "./FullMockWritingScore";
import SpeakingPage from "./SpeakingPage";
import type {PracticeCredits} from "./WritingPage";
import {DEFAULT_COSTS,starsAPI,type StarsOverview} from "./stars";
import Poster,{posterSkill} from "./Poster";
import {RevealText,stagger,useEntrance} from "./motion";
import {CheckIcon,ClockIcon} from "./icons";
import ClaimResults from "./ClaimResults";

type Props={session:FullMockSession;onChange:(v:FullMockSession)=>void;onStartExam:(exam:Exam,skill:"listening"|"reading")=>Promise<void>;onFinish:()=>void;onCancel:()=>void;onDirtyChange:(v:boolean)=>void;onAnalysis?:(skill:"listening"|"reading"|"writing"|"speaking")=>void};
const steps:[FullMockStage,string][]=[["listening","Listening"],["reading","Reading"],["writing","Writing"],["speaking","Speaking"]];
const agenda:[ "listening"|"reading"|"writing"|"speaking",string,string][]=[["listening","Listening","40 minutes"],["reading","Reading","60 minutes"],["writing","Writing","Task 1 + Task 2 · 60 minutes"],["speaking","Speaking","Live interview"]];
export default function FullMockFlow({session,onChange,onStartExam,onFinish,onCancel,onDirtyChange,onAnalysis}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function startExam(id:string,skill:"listening"|"reading"){setBusy(true);setError("");try{await onStartExam(await examAPI.get(id),skill)}catch(e){setError(e instanceof Error?e.message:"This section could not be opened.")}finally{setBusy(false)}}
 function begin(stage:FullMockStage){onChange({...session,stage,break_until:undefined})}
 // An exam-day mock runs itself, like the real test: each section opens without the student pressing anything.
 const strict=!!session.exam_session_id,opened=useRef("");
 useEffect(()=>{const s=session.stage;if(!strict||opened.current===s)return;opened.current=s;if(s==="overview")begin("listening");else if(s==="listening"||s==="reading")void startExam(s==="listening"?session.listening_exam_id:session.reading_exam_id,s)});
 // A mock covers two AI checks per skill for 48 hours. Past that a check spends the student's own stars, so the page says so first.
 // shortcut: centre students get no warning (the web cannot tell a centre that marks by hand, where nothing is charged); add it when the API reports that.
 const [stars,setStars]=useState<StarsOverview|null>(null),aiStage=session.stage==="writing"||session.stage==="speaking";
 useEffect(()=>{if(strict||!aiStage)return;let live=true;void starsAPI.overview().then(v=>{if(live)setStars(v)}).catch(()=>undefined);return()=>{live=false}},[strict,aiStage,session.stage,session.writing_task1_submission_id]);
 const charged=(kind:"writing"|"speaking"):PracticeCredits|undefined=>!stars?.mock_checks||stars.source!=="personal"||(stars.mock_checks[session.id]?.[kind]??0)>0?undefined:{balance:stars.balance,cost:stars.costs?.[kind]??DEFAULT_COSTS[kind],onUsed:()=>undefined};
 useEffect(()=>{if(session.stage==="writing"&&!session.writing_started_at)onChange({...session,writing_started_at:new Date().toISOString()})},[session.stage,session.writing_started_at]);
 const cancel=()=>{if(window.confirm("End this full mock? Completed section results will stay in your history, but this four-skill sequence will be removed."))onCancel()};
 // A mock finished before is a menu, not a sequence: any section, one at a time, and the way to each one's earlier results.
 if(session.stage==="overview"&&session.revisit){const bands={listening:session.listening_band,reading:session.reading_band,writing:undefined,speaking:undefined};return <Shell key="revisit" session={session} onCancel={cancel}><section className="fm-stage full-mock-hero">
  <div className="fm-art"><Poster skill="full" title="Full mock" tag="4 skills" size="hero" enter style={stagger(0,0)}/></div>
  <div className="fm-copy">
   <p className="fm-kicker rise" style={stagger(0,250)}>You finished this mock</p>
   <RevealText as="h1" text="Choose any section." base={400}/>
   <p className="fm-lead rise" style={stagger(0,1000)}>Sit any section again, in any order, one at a time. Analysis opens your earlier results for that skill, and this mock stays open to you from Mock exams.</p>
   <ol className="full-mock-agenda">{agenda.map(([skill,label,time],i)=><li key={skill} className="rise" style={stagger(i,1300,110)}><Poster skill={skill} size="sm"/><span><b>{label}</b><small>{bands[skill]!=null?`Band ${bands[skill]!.toFixed(1)} just now`:time}</small></span><div className="fm-pick"><button className="btn btn-primary" aria-label={`Start ${label}`} onClick={()=>begin(skill)}>Start</button><button className="btn btn-ghost" aria-label={`${label} analysis`} onClick={()=>onAnalysis?.(skill)}>Analysis</button></div></li>)}</ol>
  </div>
 </section></Shell>}
 if(session.stage==="overview")return <Shell key="overview" session={session} onCancel={cancel}><section className="fm-stage full-mock-hero">
  <div className="fm-art"><Poster skill="full" title="Full mock" tag="4 skills" size="hero" enter style={stagger(0,0)}/></div>
  <div className="fm-copy">
   <p className="fm-kicker rise" style={stagger(0,250)}>Listening → Reading → Writing → Speaking</p>
   <RevealText as="h1" text="One mock. All four skills." base={400}/>
   <p className="fm-lead rise" style={stagger(0,1200)}>Complete Listening, Reading, Writing and Speaking in order. Your work is saved after every section, and a short recovery break appears before the next skill.</p>
   <ol className="full-mock-agenda">{agenda.map(([skill,label,time],i)=><li key={skill} className="rise" style={stagger(i,1500,110)}><Poster skill={skill} size="sm"/><span><b>{label}</b><small>{time}</small></span></li>)}</ol>
   <div className="instruction-box rise" style={stagger(0,2200)}><strong>Before starting</strong><p>Allow about three hours, use headphones, keep your charger nearby, and choose a quiet place. AI Writing and Speaking reports may finish shortly after the mock.</p></div>
   <button className="btn btn-primary rise" style={stagger(0,2700,0,1000)} onClick={()=>begin("listening")}>Begin with Listening →</button>
  </div>
 </section></Shell>;
 if(session.stage.startsWith("break_")){const next=session.stage.replace("break_","") as FullMockStage;return <Shell key={session.stage} session={session} onCancel={cancel}><BreakScreen until={session.break_until} next={next} strict={strict} onStart={()=>begin(next)}/></Shell>}
 if(session.stage==="listening"||session.stage==="reading"){const skill=session.stage;return <Shell key={skill} session={session} onCancel={cancel}><section className="fm-stage full-mock-ready">
  <div className="fm-art"><Poster skill={skill} title={skill==="listening"?"Listening":"Reading"} tag={`Section ${skill==="listening"?1:2} of ${session.no_speaking?3:4}`} size="hero" enter style={stagger(0,0)}/></div>
  <div className="fm-copy">
   <p className="fm-kicker rise" style={stagger(0,300)}>{skill==="listening"?"40 minutes · headphones on":"60 minutes · timed"}</p>
   <RevealText as="h1" text={skill==="listening"?"Check your headphones.":"Clear your desk."} base={450}/>
   <p className="fm-lead rise" style={stagger(0,1300)}>{skill==="listening"?"The recording and timer begin inside the exam workspace. Complete and submit this section before moving to Reading.":"You have 60 minutes. Read carefully, flag uncertain answers, and submit before the timer ends."}</p>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="btn btn-primary rise" style={stagger(0,2200,0,1000)} disabled={busy} onClick={()=>void startExam(skill==="listening"?session.listening_exam_id:session.reading_exam_id,skill)}>{busy?"Opening section…":`Start ${skill} section →`}</button>
  </div>
 </section></Shell>}
 if(session.stage==="writing")return <div className="full-mock-embedded"><FullMockBar session={session} onCancel={cancel}/><FullMockWriting session={session} credits={charged("writing")} onChange={onChange} onDirtyChange={onDirtyChange}/></div>;
 if(session.stage==="speaking")return <div className="full-mock-embedded"><FullMockBar session={session} onCancel={cancel}/><SpeakingPage mode="mock" fullMockId={session.id} credits={charged("speaking")} onDirtyChange={onDirtyChange} onSessionStarted={v=>onChange({...session,speaking_session_id:v.id})} onSubmitted={v=>onChange({...session,speaking_session_id:v.id,stage:"complete"})}/></div>;
 const all:["listening"|"reading"|"writing"|"speaking",string,number|undefined][]=[["listening","Listening",session.listening_band],["reading","Reading",session.reading_band],["writing","Writing",undefined],["speaking","Speaking",undefined]];
 const results=session.no_speaking?all.slice(0,3):all;
 const pending=session.hand_marked_writing?(session.no_speaking?"Your teachers mark your Writing and return the result to you.":"Your teachers mark your Writing. The Speaking report may still be processing."):`${session.no_speaking?"The Writing report":"Writing and Speaking reports"} may still be processing and will remain available from Practice and Review.`;
 return <Shell key="complete" session={session} onCancel={cancel}><section className="full-mock-complete">
  <p className="fm-kicker rise" style={stagger(0,0)}>{session.no_speaking?"Mock exam complete":"Full mock complete"}</p>
  <RevealText as="h1" text={session.no_speaking?"You completed all three sections.":"You completed all four skills."} base={200}/>
  <p className="fm-lead rise" style={stagger(0,1000)}>Reading and Listening scores are ready below. {pending}</p>
  <div className="full-mock-scores">{results.map(([skill,label,band],i)=><span key={skill}><Poster skill={skill} title={label} band={band} tag={band==null?"Report":undefined} size="md" enter style={stagger(i,1300,140)}/><b className="rise" style={stagger(i,1800,140)}>{band!=null?band.toFixed(1):skill==="listening"||skill==="reading"?"Pending":"Report"}</b><small className="rise" style={stagger(i,1800,140)}>{label}</small></span>)}</div>
  {!session.hand_marked_writing&&<div className="rise" style={stagger(0,2500)}><FullMockWritingScore one={session.writing_task1_submission_id} two={session.writing_submission_id}/></div>}
  {session.exam_session_id&&<div className="rise" style={stagger(0,2700)}><ClaimResults/></div>}
  <button className="btn btn-primary rise" style={stagger(0,2900,0,1000)} onClick={onFinish}>{session.exam_session_id?"Finish and sign out":"Finish and return to mocks"}</button>
 </section></Shell>
}
function Shell({session,children,onCancel}:{session:FullMockSession;children:ReactNode;onCancel:()=>void}){const stage=useRef<HTMLDivElement>(null);useEntrance(stage);return <main className="full-mock-page"><FullMockBar session={session} onCancel={onCancel}/><div className="content page-content" ref={stage}>{children}</div></main>}
function FullMockBar({session,onCancel}:{session:FullMockSession;onCancel:()=>void}){const current=session.revisit&&session.stage==="overview"?-1:stageIndex(session.stage),done=(i:number)=>!session.revisit&&i<current;return <header className="full-mock-bar"><strong>Full IELTS mock</strong><ol>{(session.no_speaking?steps.slice(0,3):steps).map(([key,label],i)=><li key={key} aria-current={i===current?"step":undefined} className={done(i)?"done":i===current?"current":""}><i>{done(i)?<CheckIcon/>:i+1}</i>{label}</li>)}</ol><div className="full-mock-bar-end">{session.stage==="writing"&&session.writing_started_at&&<WritingClock start={session.writing_started_at}/>}{!session.exam_session_id&&<button className="btn btn-ghost" onClick={onCancel}>End mock</button>}</div></header>}
// The real test gives 60 minutes for both tasks. Here the clock only warns: at zero the student may still finish and submit.
function WritingClock({start}:{start:string}){const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);const remaining=Math.max(0,Math.ceil((Date.parse(start)+3_600_000-now)/1000)),clock=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;return <time className={`runner-clock ${remaining<300?"urgent":""}`} aria-label={remaining?`${clock} remaining for Writing`:"Writing time is up"}><ClockIcon/>{remaining?<span className="num">{clock}</span>:<span role="alert">Time is up</span>}</time>}
function BreakScreen({until,next,strict,onStart}:{until?:string;next:FullMockStage;strict:boolean;onStart:()=>void}){const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);const remaining=Math.max(0,Math.ceil(((until?Date.parse(until):now)-now)/1000));const over=strict&&!remaining;useEffect(()=>{if(over)onStart()},[over]);const label=steps.find(([key])=>key===next)?.[1]||next;return <section className="fm-stage full-mock-break">
 <div className="fm-art"><Poster skill={posterSkill(next)} title={label} tag="Up next" size="hero" enter style={stagger(0,0)}/></div>
 <div className="fm-copy">
  <RevealText as="h1" text="Take a short break." base={300}/>
  <strong className="fm-clock num rise" style={stagger(0,900,0,1100)}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</strong>
  <p className="fm-lead rise" style={stagger(0,1500)}>Stand up, drink water, and rest your eyes. Your next section is {next}. {strict?"It starts automatically when the break ends.":"You can continue early when you are ready."}</p>
  {!strict&&<button className="btn btn-primary rise" style={stagger(0,2200,0,1000)} onClick={onStart}>{remaining?"End break and continue":"Continue"} to {next} →</button>}
 </div>
</section>}
function stageIndex(stage:FullMockStage){if(stage==="overview"||stage==="listening")return 0;if(stage==="break_reading"||stage==="reading")return 1;if(stage==="break_writing"||stage==="writing")return 2;if(stage==="break_speaking"||stage==="speaking")return 3;return 4}
export function breakTime(){return new Date(Date.now()+5*60*1000).toISOString()}

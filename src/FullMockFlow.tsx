import {useEffect,useRef,useState} from "react";
import type {ReactNode} from "react";
import {Exam,examAPI} from "./exams";
import {FullMockSession,FullMockStage} from "./fullMock";
import FullMockWriting from "./FullMockWriting";
import FullMockWritingScore from "./FullMockWritingScore";
import SpeakingPage from "./SpeakingPage";
import Poster,{posterSkill} from "./Poster";
import {RevealText,stagger,useEntrance} from "./motion";
import {CheckIcon} from "./icons";
import ClaimResults from "./ClaimResults";

type Props={session:FullMockSession;onChange:(v:FullMockSession)=>void;onStartExam:(exam:Exam,skill:"listening"|"reading")=>Promise<void>;onFinish:()=>void;onCancel:()=>void;onDirtyChange:(v:boolean)=>void};
const steps:[FullMockStage,string][]=[["listening","Listening"],["reading","Reading"],["writing","Writing"],["speaking","Speaking"]];
const agenda:[ "listening"|"reading"|"writing"|"speaking",string,string][]=[["listening","Listening","40 minutes"],["reading","Reading","60 minutes"],["writing","Writing","Task 1 + Task 2 · 60 minutes"],["speaking","Speaking","Live interview"]];
export default function FullMockFlow({session,onChange,onStartExam,onFinish,onCancel,onDirtyChange}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function startExam(id:string,skill:"listening"|"reading"){setBusy(true);setError("");try{await onStartExam(await examAPI.get(id),skill)}catch(e){setError(e instanceof Error?e.message:"This section could not be opened.")}finally{setBusy(false)}}
 function begin(stage:FullMockStage){onChange({...session,stage,break_until:undefined})}
 const cancel=()=>{if(window.confirm("End this full mock? Completed section results will stay in your history, but this four-skill sequence will be removed."))onCancel()};
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
 if(session.stage.startsWith("break_")){const next=session.stage.replace("break_","") as FullMockStage;return <Shell key={session.stage} session={session} onCancel={cancel}><BreakScreen until={session.break_until} next={next} onStart={()=>begin(next)}/></Shell>}
 if(session.stage==="listening"||session.stage==="reading"){const skill=session.stage;return <Shell key={skill} session={session} onCancel={cancel}><section className="fm-stage full-mock-ready">
  <div className="fm-art"><Poster skill={skill} title={skill==="listening"?"Listening":"Reading"} tag={`Section ${skill==="listening"?1:2} of 4`} size="hero" enter style={stagger(0,0)}/></div>
  <div className="fm-copy">
   <p className="fm-kicker rise" style={stagger(0,300)}>{skill==="listening"?"40 minutes · headphones on":"60 minutes · timed"}</p>
   <RevealText as="h1" text={skill==="listening"?"Check your headphones.":"Clear your desk."} base={450}/>
   <p className="fm-lead rise" style={stagger(0,1300)}>{skill==="listening"?"The recording and timer begin inside the exam workspace. Complete and submit this section before moving to Reading.":"You have 60 minutes. Read carefully, flag uncertain answers, and submit before the timer ends."}</p>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="btn btn-primary rise" style={stagger(0,2200,0,1000)} disabled={busy} onClick={()=>void startExam(skill==="listening"?session.listening_exam_id:session.reading_exam_id,skill)}>{busy?"Opening section…":`Start ${skill} section →`}</button>
  </div>
 </section></Shell>}
 if(session.stage==="writing")return <div className="full-mock-embedded"><FullMockBar session={session} onCancel={cancel}/><FullMockWriting session={session} onChange={onChange} onDirtyChange={onDirtyChange}/></div>;
 if(session.stage==="speaking")return <div className="full-mock-embedded"><FullMockBar session={session} onCancel={cancel}/><SpeakingPage mode="mock" fullMockId={session.id} onDirtyChange={onDirtyChange} onSessionStarted={v=>onChange({...session,speaking_session_id:v.id})} onSubmitted={v=>onChange({...session,speaking_session_id:v.id,stage:"complete"})}/></div>;
 const results:["listening"|"reading"|"writing"|"speaking",string,number|undefined][]=[["listening","Listening",session.listening_band],["reading","Reading",session.reading_band],["writing","Writing",undefined],["speaking","Speaking",undefined]];
 return <Shell key="complete" session={session} onCancel={cancel}><section className="full-mock-complete">
  <p className="fm-kicker rise" style={stagger(0,0)}>Full mock complete</p>
  <RevealText as="h1" text="You completed all four skills." base={200}/>
  <p className="fm-lead rise" style={stagger(0,1000)}>Reading and Listening scores are ready below. Writing and Speaking reports may still be processing and will remain available from Practice and Review.</p>
  <div className="full-mock-scores">{results.map(([skill,label,band],i)=><span key={skill}><Poster skill={skill} title={label} band={band} tag={band==null?"Report":undefined} size="md" enter style={stagger(i,1300,140)}/><b className="rise" style={stagger(i,1800,140)}>{band!=null?band.toFixed(1):skill==="listening"||skill==="reading"?"Pending":"Report"}</b><small className="rise" style={stagger(i,1800,140)}>{label}</small></span>)}</div>
  <div className="rise" style={stagger(0,2500)}><FullMockWritingScore one={session.writing_task1_submission_id} two={session.writing_submission_id}/></div>
  {session.exam_session_id&&<div className="rise" style={stagger(0,2700)}><ClaimResults/></div>}
  <button className="btn btn-primary rise" style={stagger(0,2900,0,1000)} onClick={onFinish}>{session.exam_session_id?"Finish and sign out":"Finish and return to mocks"}</button>
 </section></Shell>
}
function Shell({session,children,onCancel}:{session:FullMockSession;children:ReactNode;onCancel:()=>void}){const stage=useRef<HTMLDivElement>(null);useEntrance(stage);return <main className="full-mock-page"><FullMockBar session={session} onCancel={onCancel}/><div className="content page-content" ref={stage}>{children}</div></main>}
function FullMockBar({session,onCancel}:{session:FullMockSession;onCancel:()=>void}){const current=stageIndex(session.stage);return <header className="full-mock-bar"><strong>Full IELTS mock</strong><ol>{steps.map(([key,label],i)=><li key={key} aria-current={i===current?"step":undefined} className={i<current?"done":i===current?"current":""}><i>{i<current?<CheckIcon/>:i+1}</i>{label}</li>)}</ol><button className="btn btn-ghost" onClick={onCancel}>End mock</button></header>}
function BreakScreen({until,next,onStart}:{until?:string;next:FullMockStage;onStart:()=>void}){const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);const remaining=Math.max(0,Math.ceil(((until?Date.parse(until):now)-now)/1000));const label=steps.find(([key])=>key===next)?.[1]||next;return <section className="fm-stage full-mock-break">
 <div className="fm-art"><Poster skill={posterSkill(next)} title={label} tag="Up next" size="hero" enter style={stagger(0,0)}/></div>
 <div className="fm-copy">
  <RevealText as="h1" text="Take a short break." base={300}/>
  <strong className="fm-clock num rise" style={stagger(0,900,0,1100)}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</strong>
  <p className="fm-lead rise" style={stagger(0,1500)}>Stand up, drink water, and rest your eyes. Your next section is {next}. You can continue early when you are ready.</p>
  <button className="btn btn-primary rise" style={stagger(0,2200,0,1000)} onClick={onStart}>{remaining?"End break and continue":"Continue"} to {next} →</button>
 </div>
</section>}
function stageIndex(stage:FullMockStage){if(stage==="overview"||stage==="listening")return 0;if(stage==="break_reading"||stage==="reading")return 1;if(stage==="break_writing"||stage==="writing")return 2;if(stage==="break_speaking"||stage==="speaking")return 3;return 4}
export function breakTime(){return new Date(Date.now()+5*60*1000).toISOString()}

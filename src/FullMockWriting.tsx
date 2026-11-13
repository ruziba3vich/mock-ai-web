import { useEffect, useState } from "react";
import { managedContentAPI } from "./managedContent";
import { examSetKey, type FullMockSession } from "./fullMock";
import WritingPage from "./WritingPage";

export default function FullMockWriting({session,onChange,onDirtyChange}: {
  session: FullMockSession; onChange:(v:FullMockSession)=>void; onDirtyChange:(v:boolean)=>void;
}) {
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const assigned=!!session.writing_task1_content_id && !!session.writing_task2_content_id;
  useEffect(()=>{
    if(assigned) return;
    let active=true;
    setError("");
    void managedContentAPI.studentList("writing_prompt").then(items=>{
      const pick=(task:string,existing?:string)=>{
        if(existing) return existing;
        const all=items.filter(v=>v.data.task===task && String(v.data.prompt||"").trim().length>=20);
        if(!all.length) throw new Error("Both Writing Task 1 and Task 2 must be available before you can continue. Your completed sections are saved.");
        // A named mock sits its own Writing tasks, so everyone invited to it writes the same paper.
        const own=all.filter(v=>!!session.set_key && examSetKey(v.title)===session.set_key),pool=own.length?own:all;
        return pool[Math.floor(Math.random()*pool.length)].id;
      };
      const one=pick("task_1",session.writing_task1_content_id);
      const two=pick("task_2",session.writing_task2_content_id);
      if(active) onChange({...session,writing_task1_content_id:one,writing_task2_content_id:two});
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load writing tasks.")});
    return ()=>{active=false};
  },[assigned,retry]);
  if(!assigned) return <section className="content page-content rp"><div className="rp-panel rp-state">{error?<><p role="alert">{error}</p><button className="btn btn-ghost" onClick={()=>setRetry(v=>v+1)}>Retry loading tasks</button></>:<p role="status">Preparing both Writing tasks…</p>}</div></section>;
  const first=!session.writing_task1_submission_id;
  return <WritingPage key={first?"task_1":"task_2"} mode="mock" fullMockId={session.id}
    requiredTask={first?"task_1":"task_2"}
    initialContentID={first?session.writing_task1_content_id:session.writing_task2_content_id}
    initialSubmissionID={first?session.writing_task1_draft_id:session.writing_task2_draft_id}
    onDirtyChange={onDirtyChange}
    onSaved={v=>onChange({...session,...(first?{writing_task1_draft_id:v.id}:{writing_task2_draft_id:v.id})})}
    onSubmitted={v=>onChange(first?{...session,writing_task1_submission_id:v.id,writing_task1_draft_id:v.id}:{...session,writing_submission_id:v.id,writing_task2_draft_id:v.id,...(session.no_speaking?{stage:"complete" as const}:{stage:"break_speaking" as const,break_until:new Date(Date.now()+300000).toISOString()})})}/>
}

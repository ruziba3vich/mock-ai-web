import {useEffect,useState} from "react";
import {writingAPI,WritingSubmission} from "./writing";

export function weightedWritingBand(one:number,two:number){return Math.round(((one+two*2)/3)*2)/2}
export default function FullMockWritingScore({one,two}:{one?:string;two?:string}){
 const [reports,setReports]=useState<WritingSubmission[]>([]);
 const [error,setError]=useState(false);
 useEffect(()=>{
  if(!one||!two)return;
  let active=true,running=false;
  const load=async()=>{if(running)return;running=true;try{const items=await Promise.all([writingAPI.get(one),writingAPI.get(two)]);if(active){setReports(items);setError(false)}}catch{if(active)setError(true)}finally{running=false}};
  void load();const timer=setInterval(()=>void load(),5000);
  return()=>{active=false;clearInterval(timer)};
 },[one,two]);
 const ready=reports.length===2&&reports.every(v=>v.status==="completed"&&v.report);
 return <section className="writing-panel"><h2>Writing result</h2>{ready?<><strong>{weightedWritingBand(reports[0].report!.overall,reports[1].report!.overall).toFixed(1)} / 9</strong><p>AI practice estimate · Task 1: {reports[0].report!.overall.toFixed(1)} · Task 2: {reports[1].report!.overall.toFixed(1)}. Task 2 has twice the weight.</p></>:<p>{!one||!two?"Both writing tasks are required for a combined estimate.":error?"Could not load the writing reports. Retrying…":reports.some(v=>v.status==="failed")?"A writing report needs attention. Open Writing history to retry it.":"Both writing reports are being prepared. This result updates automatically."}</p>}</section>
}

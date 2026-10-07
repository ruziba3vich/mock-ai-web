import { apiRequest } from "./auth";
export type SpeakingTurn = { position:number; part:number; prompt:string; seconds:number; prep_seconds:number; voice_status:string; voice_attempts:number; duration_ms:number; answered:boolean; skipped:boolean; has_recording:boolean };
export type SpeakingReport = { overall:number|null; assessable:boolean; summary:string; model_version:string; criteria:{key:string;score:number|null;reason:string;how_to_improve:string}[]; responses:{position:number;transcript:string;feedback:string}[]; issues:{category:string;position:number;second:number;quote:string;explanation:string;suggestion:string}[]; strengths:string[];next_steps:string[] };
export type SpeakingSession = { id:string; mode?:string; examiner:{country:string;code:string;gender:string;accent:string;voice:string}; topic:string;status:string;turns:SpeakingTurn[];report?:SpeakingReport;error_code:string;created_at:string;audio_expires_at:string };
export type SpeakingSettings = { enabled:boolean; countries:{name:string;code:string}[];daily_limit:number;audio_retention_days:number };
const base="/api/v1/speaking";
export const speakingAPI={
 settings:()=>apiRequest<SpeakingSettings>(`${base}/settings`),
 list:async()=>(await apiRequest<{sessions:SpeakingSession[]}>(`${base}/sessions`)).sessions,
 get:(id:string)=>apiRequest<SpeakingSession>(`${base}/sessions/${id}`),
 create:()=>apiRequest<SpeakingSession>(`${base}/live/sessions`,{method:"POST",body:JSON.stringify({consent:true})}),
 remove:(id:string)=>apiRequest<void>(`${base}/sessions/${id}`,{method:"DELETE"}),
 submit:(id:string)=>apiRequest<SpeakingSession>(`${base}/sessions/${id}/submit`,{method:"POST"}),
 answer:(id:string,pos:number,blob:Blob)=>apiRequest<SpeakingSession>(`${base}/sessions/${id}/turns/${pos}/answer`,{method:"PUT",headers:{"Content-Type":"audio/wav"},body:blob}),
 skip:(id:string,pos:number)=>apiRequest<SpeakingSession>(`${base}/sessions/${id}/turns/${pos}/skip`,{method:"POST"}),
 retry:(id:string,pos:number)=>apiRequest(`${base}/sessions/${id}/turns/${pos}/voice/retry`,{method:"POST"}),
 audio:(id:string,pos:number,kind:"examiner"|"recording")=>`${base}/sessions/${id}/turns/${pos}/${kind}`
};
export const speakingLabels:Record<string,string>={fluency_coherence:"Fluency & Coherence",lexical_resource:"Lexical Resource",grammar:"Grammatical Range & Accuracy",pronunciation:"Pronunciation"};

// Canonical 16 kHz mono PCM avoids browser-specific WebM/MP4 at the API boundary.
export function encodeSpeakingWav(samples:Float32Array, rate:number, maxSeconds:number):Blob {
 const count=Math.min(Math.floor(samples.length*16000/rate),maxSeconds*16000);
 if(count<16000)throw new Error("Speak for at least one second before saving your answer.");
 const bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
 const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i))};
 text(0,"RIFF");v.setUint32(4,36+count*2,true);text(8,"WAVEfmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,"data");v.setUint32(40,count*2,true);
 let energy=0;
 for(let i=0;i<count;i++){const from=Math.floor(i*rate/16000),to=Math.max(from+1,Math.floor((i+1)*rate/16000));let value=0;for(let j=from;j<to&&j<samples.length;j++)value+=samples[j];value=Math.max(-1,Math.min(1,value/(to-from)));energy+=value*value;v.setInt16(44+i*2,Math.round(value*(value<0?32768:32767)),true)}
 if(Math.sqrt(energy/count)<.001)throw new Error("No clear sound was detected. Check your microphone and try again.");
 return new Blob([bytes],{type:"audio/wav"});
}
export async function normalizeRecording(blob:Blob,maxSeconds:number):Promise<Blob> {
 const ctx=new AudioContext();try{const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());const mono=new Float32Array(decoded.length);for(let c=0;c<decoded.numberOfChannels;c++){const data=decoded.getChannelData(c);for(let i=0;i<data.length;i++)mono[i]+=data[i]/decoded.numberOfChannels}return encodeSpeakingWav(mono,decoded.sampleRate,maxSeconds)}finally{await ctx.close()}
}
export async function microphone():Promise<MediaStream>{
 if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==="undefined")throw new Error("Recording is not supported here. Open this app in an up-to-date Safari or Chrome browser over HTTPS.");
 try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}})}catch{throw new Error("Microphone access is needed. Allow it in your browser or Telegram settings, then try again.")}
}

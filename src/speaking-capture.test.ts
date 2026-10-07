import {expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
it.each([44100,48000])("streams canonical 16 kHz PCM from a %i Hz microphone",rate=>{
 const packets:ArrayBuffer[]=[];let Capture:any;
 class Processor {port={postMessage:(bytes:ArrayBuffer)=>packets.push(bytes)}}
 runInNewContext(readFileSync("public/speaking-capture.js","utf8"),{AudioWorkletProcessor:Processor,sampleRate:rate,registerProcessor:(_name:string,processor:any)=>{Capture=processor}});
 const capture=new Capture();const input=new Float32Array(rate).fill(.5);
 for(let i=0;i<input.length;i+=128)expect(capture.process([[input.subarray(i,i+128)]])).toBe(true);
 expect(packets).toHaveLength(10);expect(packets.every(p=>p.byteLength===3200)).toBe(true);
 expect(new DataView(packets[0]).getInt16(0,true)).toBe(16384);
});

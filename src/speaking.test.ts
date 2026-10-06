import { describe,it,expect } from "vitest";
import { encodeSpeakingWav } from "./speaking";
describe("speaking audio",()=>{
 it("rejects silence and short clips",()=>{expect(()=>encodeSpeakingWav(new Float32Array(32000),16000,40)).toThrow(/No clear sound/);expect(()=>encodeSpeakingWav(new Float32Array(100),16000,40)).toThrow(/at least one second/)});
 it("normalizes browser audio to bounded mono PCM",()=>{const a=new Float32Array(48000*3);for(let i=0;i<a.length;i++)a[i]=Math.sin(i*.1)*.25;const b=encodeSpeakingWav(a,48000,2);expect(b.size).toBe(44+32000*2);expect(b.type).toBe("audio/wav")});
});

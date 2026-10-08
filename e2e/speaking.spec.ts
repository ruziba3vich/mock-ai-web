import { expect,test } from "@playwright/test";
import { readFileSync } from "node:fs";
test("Speaking is discoverable on mobile and requires consent",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");await page.getByRole("button",{name:"New here? Create an account"}).click();
 await page.getByLabel("Full name").fill("Speaking QA");await page.getByLabel("Email").fill(`speaking-${Date.now()}@example.test`);await page.getByLabel("Password").fill("Speaking-qa-password-123!");await page.getByRole("button",{name:"Create account"}).click();
 await expect(page.getByRole("heading",{name:/Let’s practise/})).toBeVisible();await page.getByRole("navigation",{name:"Mobile navigation"}).getByRole("button",{name:"Practice",exact:true}).click();
 await page.getByRole("button",{name:/Speaking Three-part interviews/}).click();await page.getByRole("button",{name:"Start",exact:true}).click();
 await expect(page.getByRole("button",{name:"Start speaking interview"})).toBeDisabled();await expect(page.getByText("United Kingdom",{exact:true})).toHaveCount(0);await expect(page.getByText(/randomly choose/)).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
test("real-time audio, thinking pause, resume, all three parts and real report",async({page})=>{
 test.skip(!process.env.SPEAKING_LIVE_E2E,"Opt-in real Gemini and isolated database only");test.setTimeout(1_200_000);
 let streamedBytes=0,previousBytes=0;
 page.on("websocket",socket=>socket.on("framereceived",frame=>{if(Buffer.isBuffer(frame.payload))streamedBytes+=frame.payload.length}));
 // Synthetic speech enters the real browser AudioWorklet as a microphone stream.
 // No HTTP, WebSocket, provider response, or report is mocked.
 await page.addInitScript(()=>{
  let ctx:AudioContext;
  Object.defineProperty(navigator.mediaDevices,"getUserMedia",{value:async()=>{
   ctx=new AudioContext();const destination=ctx.createMediaStreamDestination();
   (window as any).playSpeakingFixture=async(bytes:number[])=>{await ctx.resume();const buffer=await ctx.decodeAudioData(new Uint8Array(bytes).buffer);const source=ctx.createBufferSource();source.buffer=buffer;source.connect(destination);await new Promise<void>(resolve=>{source.onended=()=>resolve();source.start()})};
   return destination.stream;
  }});
 });
 await page.goto("/");await page.getByRole("button",{name:"New here? Create an account"}).click();await page.getByLabel("Full name").fill("Realtime QA");await page.getByLabel("Email").fill(`realtime-${Date.now()}@example.test`);await page.getByLabel("Password").fill("Speaking-live-qa-123!");await page.getByRole("button",{name:"Create account"}).click();
 await expect(page.getByRole("heading",{name:/Let’s practise/})).toBeVisible();await page.getByRole("button",{name:"Speaking",exact:true}).first().click();await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Start speaking interview"}).click();await page.getByRole("button",{name:"Connect to examiner"}).click();
 const listen=()=>expect(page.getByText("Listening. Take your time to finish your thought.",{exact:true})).toBeVisible({timeout:110_000});
 const play=async(path:string)=>{const bytes=Array.from(readFileSync(path));await page.evaluate(async b=>{await (window as any).playSpeakingFixture(b)},bytes)};
 for(let i=0;i<11;i++){
  await expect(page.getByRole("dialog",{name:"Live speaking interview"})).toHaveAttribute("data-position",String(i),{timeout:80_000});await listen();
  expect(streamedBytes).toBeGreaterThan(previousBytes+10000);previousBytes=streamedBytes;
  if(i===0){await page.waitForTimeout(4500);await expect(page.getByRole("dialog")).toHaveAttribute("data-position","0");if(process.env.SPEAKING_THINKING_FIXTURE){await play(process.env.SPEAKING_THINKING_FIXTURE);await page.waitForTimeout(5500);await expect(page.getByRole("dialog")).toHaveAttribute("data-position","0");await listen()}}
  if(i===0){
   await expect(page.getByRole("dialog").getByText(/Do you work or study/)).toHaveCount(0);
   await page.screenshot({path:"test-results/speaking-voice-desktop.png"});
   if(process.env.SPEAKING_HELP_FIXTURES){for(const help of ["repeat","clarify"]){const before=streamedBytes;await play(`${process.env.SPEAKING_HELP_FIXTURES}/${help}.wav`);await expect(page.getByText("Your examiner is speaking…",{exact:true})).toBeVisible({timeout:30000});await listen();await expect(page.getByRole("dialog")).toHaveAttribute("data-position","0");expect(streamedBytes).toBeGreaterThan(before+10000)}}
  }
  await play(`${process.env.SPEAKING_LIVE_FIXTURES}/${i}.wav`);
  if(i===0){await expect(page.getByRole("dialog")).toHaveAttribute("data-position","1",{timeout:45_000});await page.getByRole("button",{name:"Pause interview"}).click();await page.getByRole("button",{name:"Connect to examiner"}).click()}
 }
 await expect(page.getByRole("heading",{name:"Listen. Notice. Improve."})).toBeVisible({timeout:240_000});await expect(page.locator(".writing-criteria article")).toHaveCount(4);await expect(page.getByText("Speaking band estimate",{exact:true})).toBeVisible();
 await page.getByLabel("Recorded answer").evaluate(async(el:HTMLAudioElement)=>{await el.play()});await page.screenshot({path:"test-results/speaking-realtime-report.png",fullPage:true});
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Delete interview and recordings"}).click();await expect(page.getByText("Your first interview and report will appear here.")).toBeVisible();
});

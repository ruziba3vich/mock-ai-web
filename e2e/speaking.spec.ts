import { expect,test } from "@playwright/test";
if(process.env.SPEAKING_LIVE_E2E)test.use({permissions:["microphone"],launchOptions:{args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream",`--use-file-for-fake-audio-capture=${process.env.SPEAKING_AUDIO_FIXTURE||"/tmp/mockai-speaking-student.wav"}`]}});

test("Speaking is discoverable on mobile and requires consent",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/");await page.getByRole("button",{name:"New here? Create an account"}).click();
 await page.getByLabel("Full name").fill("Speaking QA");await page.getByLabel("Email").fill(`speaking-${Date.now()}@example.test`);await page.getByLabel("Password").fill("Speaking-qa-password-123!");await page.getByRole("button",{name:"Create account"}).click();
 await expect(page.getByRole("heading",{name:/Let’s practise/})).toBeVisible();
 await page.getByRole("navigation",{name:"Mobile navigation"}).getByRole("button",{name:"Practice",exact:true}).click();
 await page.getByRole("button",{name:/Speaking Three-part interviews/}).click();await page.getByRole("button",{name:"Open Speaking interview"}).click();
 await expect(page.getByRole("heading",{name:"Find your speaking confidence."})).toBeVisible();
 await expect(page.getByRole("button",{name:"Start speaking interview"})).toBeDisabled();
 await expect(page.getByText("United Kingdom",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 await page.screenshot({path:"test-results/speaking-mobile.png",fullPage:true});
});

test.describe("live audio interview",()=>{
 test.skip(!process.env.SPEAKING_LIVE_E2E,"Opt-in: real Gemini calls and isolated test database required");
 test("records all three parts, receives a real AI report, plays saved audio and deletes it",async({page})=>{
  test.setTimeout(900_000);
  await page.goto("/");await page.getByRole("button",{name:"New here? Create an account"}).click();await page.getByLabel("Full name").fill("Live Speaking QA");await page.getByLabel("Email").fill(`live-speaking-${Date.now()}@example.test`);await page.getByLabel("Password").fill("Speaking-live-qa-123!");await page.getByRole("button",{name:"Create account"}).click();
  await expect(page.getByRole("heading",{name:/Let’s practise/})).toBeVisible();await page.getByRole("button",{name:"Speaking",exact:true}).first().click();
  await page.getByRole("checkbox").check();await expect(page.getByRole("button",{name:"Start speaking interview"})).toBeEnabled();await page.getByRole("button",{name:"Start speaking interview"}).click();
  await expect(page.getByText("Question 1 / 11",{exact:true})).toBeVisible({timeout:30_000});const examiner=await page.locator(".speaking-examiner").innerText();
  for(let i=0;i<11;i++){
   await expect(page.getByText(`Question ${i+1} / 11`,{exact:true})).toBeVisible({timeout:30_000});
   const audio=page.getByLabel("Examiner question");await expect(audio).toBeVisible({timeout:130_000});
   await audio.evaluate(async(el:HTMLAudioElement)=>{el.playbackRate=4;await el.play()});
   const record=page.getByRole("button",{name:"Record answer",exact:true});await expect(record).toBeVisible({timeout:100_000});await record.click();await expect(page.getByText("Recording your answer…",{exact:true})).toBeVisible();
   await page.waitForTimeout(7500);await page.getByRole("button",{name:"Stop recording",exact:true}).click();
   await expect(page.getByLabel("Your unsaved answer")).toBeVisible({timeout:15_000});await page.getByRole("button",{name:"Save answer and continue"}).click();
   if(i===0){await expect(page.getByText("Question 2 / 11",{exact:true})).toBeVisible();await page.reload();await page.locator(".writing-history button").first().click();await expect(page.getByText("Question 2 / 11",{exact:true})).toBeVisible();expect(await page.locator(".speaking-examiner").innerText()).toBe(examiner)}
  }
  await expect(page.getByRole("heading",{name:"You’ve reached the finish."})).toBeVisible();await page.getByRole("button",{name:"Get my speaking report"}).click();
  await expect(page.getByRole("heading",{name:"Listen. Notice. Improve."})).toBeVisible({timeout:240_000});
  await expect(page.locator(".writing-criteria article")).toHaveCount(4);await expect(page.getByText("Speaking band estimate",{exact:true})).toBeVisible();
  const saved=page.getByLabel("Recorded answer");await saved.evaluate(async(el:HTMLAudioElement)=>{await el.play()});
  await page.screenshot({path:"test-results/speaking-live-report.png",fullPage:true});
  await page.reload();await page.locator(".writing-history button").first().click();await expect(page.getByRole("heading",{name:"Listen. Notice. Improve."})).toBeVisible();
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Delete interview and recordings"}).click();await expect(page.getByText("Your first interview and report will appear here.")).toBeVisible();
 });
});

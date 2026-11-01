import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";

test("both real Writing submissions are saved before the Speaking break",async({page,baseURL})=>{
 test.skip(!process.env.FULL_WRITING_E2E,"Opt-in: isolated database with both writing tasks and a provider credential");
 expect(new URL(baseURL!).hostname).toBe("127.0.0.1");
 test.setTimeout(300000);page.setDefaultTimeout(15000);
 const registration=await page.request.post("/api/v1/auth/register",{headers:{Origin:baseURL!},data:{display_name:"Local two-task QA",email:`two-task-${randomUUID()}@example.test`,password:randomUUID()+"Aa1!"}});
 expect(registration.status()).toBe(201);const {user}=await registration.json();
 await page.goto("/");
 // Start at the Writing boundary; Listening/Reading transitions have their own E2E.
 await page.evaluate(id=>localStorage.setItem(`mockai.full-mock.${id}`,JSON.stringify({id:"local-writing-qa",started_at:new Date().toISOString(),stage:"writing",listening_exam_id:"local",reading_exam_id:"local"})),user.id);
 await page.reload();
 await expect(page.getByText("Full mock · Writing · Task 1",{exact:true})).toBeVisible();
 await expect(page.getByRole("textbox",{name:"Task prompt",exact:true})).toHaveAttribute("readonly","");
 await expect(page.getByRole("combobox",{name:"Choose a practice prompt"})).toHaveCount(0);
 await page.getByLabel("Your essay").fill("The table shows a consistent increase in bus journeys across the period. The total rose from twenty million in the first year to thirty million a decade later, and then reached fifty million by the end. Overall, bus use more than doubled. The second decade saw a larger absolute increase than the first, with twenty million additional journeys rather than ten million.");
 await page.getByRole("button",{name:"Save draft",exact:true}).click();
 await expect(page.getByText("Draft saved to your account.")).toBeVisible();
 await page.reload();
 await expect(page.getByLabel("Your essay")).toHaveValue(/The table shows/);
 await page.getByRole("checkbox").check();
 await page.getByRole("button",{name:"Submit Task 1 and continue",exact:true}).click();
 await expect(page.getByText("Full mock · Writing · Task 2",{exact:true})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Take a short break."})).toHaveCount(0);
 await page.getByLabel("Your essay").fill("Governments should consider both the costs and the benefits before making important decisions. Public transport is one example because reliable buses can help workers reach their jobs and reduce traffic. However, a policy that works in a large city may not be suitable for a small town. Local residents should be consulted before money is spent. I believe balanced planning is more useful than assuming that a single solution will benefit everyone equally.");
 await page.getByRole("checkbox").check();
 await page.getByRole("button",{name:"Submit Task 2 and finish Writing",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Take a short break."})).toBeVisible();
 await expect(page.getByRole("button",{name:/continue to speaking/i})).toBeVisible();
 const state=await page.evaluate(id=>JSON.parse(localStorage.getItem(`mockai.full-mock.${id}`)!),user.id);
 expect(state.writing_task1_submission_id).toBeTruthy();expect(state.writing_submission_id).toBeTruthy();
 expect(state.writing_task1_submission_id).not.toBe(state.writing_submission_id);
 for(const id of [state.writing_task1_submission_id,state.writing_submission_id]){
  await expect.poll(async()=>{
   const response=await page.request.get(`/api/v1/writing/submissions/${id}`);expect(response.ok()).toBeTruthy();
   const result=await response.json();expect(result.status,`Evaluation error: ${result.error_code}`).not.toBe("failed");return result.status;
  },{timeout:220000,intervals:[2000,5000]}).toBe("completed");
 }
});

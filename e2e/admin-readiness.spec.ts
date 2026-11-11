import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";

test("separate admin can browse libraries and create, edit and delete a private draft",async({page,baseURL})=>{
 test.skip(!process.env.ADMIN_E2E_EMAIL || !process.env.ADMIN_E2E_PASSWORD,"Requires a temporary separately provisioned admin");
 page.setDefaultTimeout(15000);
 const slug=`qa-${randomUUID()}`;
 let id="";
 await page.goto("/admin?staff");
 await page.getByLabel("Admin email",{exact:true}).fill(process.env.ADMIN_E2E_EMAIL!);
 await page.getByLabel("Password",{exact:true}).fill(process.env.ADMIN_E2E_PASSWORD!);
 await page.getByRole("button",{name:"Sign in to admin panel"}).click();
 await expect(page.getByRole("heading",{name:"Overview",exact:true})).toBeVisible();
 for(const tab of ["Exams","Challenges","Writing","Speaking","Vocabulary"]){
  await page.getByRole("navigation",{name:"Admin sections"}).getByRole("button",{name:tab,exact:true}).click();
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
 }
 try{
  await page.getByRole("button",{name:"Create vocabulary card",exact:true}).click();
  await page.getByLabel("Internal slug").fill(slug);
  await page.getByLabel("Student-facing title").fill("Temporary QA vocabulary");
  await page.getByLabel("Description",{exact:true}).fill("A temporary draft used only for an automated check.");
  await page.getByLabel("Meaning",{exact:true}).fill("A test meaning");
  await page.getByLabel("Wrong meaning 1").fill("First distractor");
  await page.getByLabel("Wrong meaning 2").fill("Second distractor");
  const created=page.waitForResponse(r=>r.url().endsWith("/admin/managed-content") && r.request().method()==="POST");
  await page.getByRole("button",{name:"Save content",exact:true}).click();
  const response=await created;expect(response.ok()).toBeTruthy();id=(await response.json()).id;
  await expect(page.getByRole("status")).toContainText("Content saved.");
  await page.getByLabel("Student-facing title").fill("Updated temporary QA vocabulary");
  const updated=page.waitForResponse(r=>r.url().endsWith(id)&&r.request().method()==="PUT");
  await page.getByRole("button",{name:"Save content",exact:true}).click();expect((await updated).ok()).toBeTruthy();
  await page.reload();
  await page.getByRole("navigation",{name:"Admin sections"}).getByRole("button",{name:"Vocabulary",exact:true}).click();
  await page.locator(".admin-table").getByRole("button").filter({hasText:slug}).click();
  await expect(page.getByLabel("Student-facing title")).toHaveValue("Updated temporary QA vocabulary");
  await expect(page.getByRole("combobox",{name:"Status",exact:true})).toHaveValue("draft");
  page.once("dialog",dialog=>dialog.accept());
  const removed=page.waitForResponse(r=>r.url().endsWith(id)&&r.request().method()==="DELETE");
  await page.getByRole("button",{name:"Delete",exact:true}).click();expect((await removed).status()).toBe(204);id="";
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page.getByRole("button",{name:"Sign in to admin panel"})).toBeVisible();
 }finally{
  if(id) await page.request.delete(`/api/v1/admin/managed-content/${id}`,{headers:{Origin:new URL(baseURL!).origin}});
 }
});

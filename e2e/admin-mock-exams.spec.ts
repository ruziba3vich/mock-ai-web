import {expect,test} from '@playwright/test';
import {openSection} from './adminNav';

// An administrator saves the four sections as one mock with no date. Deterministic API fixtures.
const shot=process.env.SHOT||'after';
const mock=(id:string,title:string,code:string,centre_id='',centre_name='')=>({id,title,code,listening_exam_id:'l1',reading_exam_id:'r1',writing_task1_content_id:'',writing_task2_content_id:'',joined:id==='m1'?7:0,centre_id,centre_name});
const papers=(owner:string)=>[{id:'l1',title:`${owner} Listening`,skill:'listening'},{id:'r1',title:`${owner} Reading`,skill:'reading'},{id:'w1',title:`${owner} chart`,skill:'writing_task_1'},{id:'w2',title:`${owner} essay`,skill:'writing_task_2'}];

for(const width of [390,1440])test(`platform staff create a public mock and a centre's at ${width}px`,async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.setViewportSize({width,height:width===390?844:900});
 const created:{query:string;body:Record<string,string>}[]=[],deleted:string[]=[];
 await page.route('**/api/v1/admin/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'admin',email:'admin@example.test',display_name:'Admin',role:'platform',permissions:['overview','exams','sessions','centres']}}});
  if(path==='/api/v1/admin/centres')return route.fulfill({json:{centres:[{id:'c1',slug:'alpha',name:'Alpha Centre',join_code:'A',include_global:true,ai_enabled:false,disabled:false,students:4,exams:2}]}});
  if(path==='/api/v1/admin/mock-exams'&&method==='POST'){
   const body=route.request().postDataJSON();created.push({query:url.search,body});
   return route.fulfill({status:201,json:{mock:mock('new'+created.length,body.title,'NEW23'+created.length,url.searchParams.get('centre_id')??'',url.search?'Alpha Centre':'')}});
  }
  if(path==='/api/v1/admin/mock-exams')return route.fulfill({json:{mocks:[mock('m1','Open Mock 1','PUB234'),mock('m2','Alpha Mock 2','ALP234','c1','Alpha Centre')],papers:papers(url.searchParams.get('centre_id')?'Alpha':'Global')}});
  if(path.startsWith('/api/v1/admin/mock-exams/')&&method==='DELETE'){deleted.push(path.split('/').pop()!);return route.fulfill({status:204});}
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');
 await openSection(page,'Mock exams');
 await expect(page.getByRole('region',{name:'Open Mock 1'})).toContainText("Public · in every student's list");
 await expect(page.getByRole('region',{name:'Alpha Mock 2'})).toContainText('Alpha Centre · By invite link only');

 // Public by default, from the global library, with one Writing task fixed.
 await page.getByLabel('Name').fill('Open Mock 2');
 await page.getByLabel('Listening paper').selectOption({label:'Global Listening'});
 await page.getByLabel('Reading paper').selectOption({label:'Global Reading'});
 await page.getByLabel('Writing Task 1').selectOption({label:'Global chart'});
 await page.screenshot({path:`test-results/${shot}-mock-exams-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Create the mock exam'}).click();
 await expect(page.getByRole('region',{name:'Open Mock 2'})).toBeVisible();
 expect(created[0]).toEqual({query:'',body:{title:'Open Mock 2',listening_exam_id:'l1',reading_exam_id:'r1',writing_task1_content_id:'w1',writing_task2_content_id:'',ai_writing:true,ai_speaking:true}});
 await expect(page.getByRole('group',{name:'AI in this mock'})).toHaveCount(0); // nobody could hand-mark a public mock

 // A centre's mock is built from that centre's papers and names the centre.
 await page.getByLabel('Who can sit it').selectOption({label:'Alpha Centre: by invite link'});
 await page.getByLabel('Name').fill('Alpha Mock 3');
 await page.getByLabel('Listening paper').selectOption({label:'Alpha Listening'});
 await page.getByLabel('Reading paper').selectOption({label:'Alpha Reading'});
 // Alpha marks its own work, so there is nothing to switch on.
 await expect(page.getByRole('group',{name:'AI in this mock'})).toContainText("its teachers mark this mock's Writing and Speaking");
 await page.getByRole('button',{name:'Create the mock exam'}).click();
 const alpha=page.getByRole('region',{name:'Alpha Mock 3'});
 await expect(alpha).toBeVisible();
 expect(created[1].query).toBe('?centre_id=c1');
 expect([created[1].body.ai_writing,created[1].body.ai_speaking]).toEqual([false,false]);

 // The link is on the student site and carries the mock's code.
 await alpha.getByRole('button',{name:'Copy invite link'}).click();
 await expect(alpha.getByRole('button',{name:'Link copied'})).toBeVisible();
 expect(new URL(await page.evaluate(()=>navigator.clipboard.readText())).searchParams.get('mock')).toBe('NEW232');

 await page.getByLabel('Owner').selectOption({label:'Public'});
 await expect(page.getByRole('region',{name:'Alpha Mock 2'})).toHaveCount(0);
 page.once('dialog',dialog=>void dialog.accept());
 await page.getByRole('button',{name:'Delete Open Mock 1'}).click();
 await expect(page.getByRole('region',{name:'Open Mock 1'})).toHaveCount(0);
 expect(deleted).toEqual(['m1']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("a centre's administrator switches the AI interview off for one mock",async({page})=>{
 let sent:Record<string,unknown>={};
 await page.route('**/api/v1/admin/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'a',email:'a@example.test',display_name:'A',centre_id:'c1',centre_name:'Alpha Centre',role:'centre',permissions:['overview','sessions']}}});
  if(path==='/api/v1/admin/my-centre')return route.fulfill({json:{centre:{id:'c1',slug:'alpha',name:'Alpha Centre',join_code:'A',include_global:true,ai_enabled:true,disabled:false,students:4,exams:2}}});
  if(path==='/api/v1/admin/mock-exams'&&route.request().method()==='POST'){sent=route.request().postDataJSON();return route.fulfill({status:201,json:{mock:{...mock('n1','Mock 1','NEW234','c1','Alpha Centre'),ai_writing:sent.ai_writing,ai_speaking:sent.ai_speaking}}});}
  if(path==='/api/v1/admin/mock-exams')return route.fulfill({json:{mocks:[],papers:papers('Alpha')}});
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');
 await openSection(page,'Mock exams');
 await page.getByLabel('Name').fill('Mock 1');
 await page.getByLabel('Listening paper').selectOption({label:'Alpha Listening'});
 await page.getByLabel('Reading paper').selectOption({label:'Alpha Reading'});
 await expect(page.getByText('uses 35 stars from your centre')).toBeVisible();
 await page.getByLabel(/AI Speaking interview/).uncheck();
 await expect(page.getByText('uses 20 stars from your centre')).toBeVisible();
 await expect(page.getByText('Students record their Speaking answers, which also go to your Marking queue.')).toBeVisible();
 await page.getByRole('button',{name:'Create the mock exam'}).click();
 const made=page.getByRole('region',{name:'Mock 1'});
 await expect(made).toContainText('Marked by your teachers');
 await expect(made).toContainText('Stars per student20');
 expect([sent.ai_writing,sent.ai_speaking]).toEqual([true,false]);
});

test("a centre's administrator makes invite-only mocks from its own papers",async({page})=>{
 let query='x';
 await page.route('**/api/v1/admin/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'a',email:'a@example.test',display_name:'A',centre_id:'c1',centre_name:'Alpha Centre',role:'centre',permissions:['overview','sessions']}}});
  if(path==='/api/v1/admin/mock-exams'){query=url.search;return route.fulfill({json:{mocks:[],papers:[]}});}
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');
 await openSection(page,'Mock exams');
 await expect(page.getByText('No mock exams yet. Create one above.')).toBeVisible();
 await expect(page.getByText(/Publish one Listening and one Reading exam of your own first/)).toBeVisible();
 await expect(page.getByLabel('Who can sit it')).toHaveCount(0);
 expect(query).toBe('');
});

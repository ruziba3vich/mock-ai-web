import {expect,test} from '@playwright/test';

// SHOT=before keeps the screenshots of the panel as it was apart from the new ones.
const shot=process.env.SHOT||'after';
const draft=(id:string,title:string,centre_id:string,centre_name:string,updated_at:string)=>({id,exam_id:'e-'+id,centre_id,centre_name,updated_at,
 data:{title,description:'',skill:'reading',purpose:'mock',duration_seconds:3600,instructions:'',access_scope:'public',owner_user_id:'',bands:[],sections:[{title:'Passage',passage:'Text',audio_url:'',source_image_urls:[],questions:[]}]}});
const day=(id:string,title:string,centre_id:string,centre_name:string,starts_at:string,ends_at:string)=>({id,title,code:id.toUpperCase()+'234',starts_at,ends_at,
 listening_exam_id:'l1',reading_exam_id:'r1',writing_task1_content_id:'',writing_task2_content_id:'',seats:20,joined:3,ai_writing:false,ai_speaking:false,pcs:[],centre_id,centre_name});

for(const width of [390,1440])test(`platform staff see and schedule every centre's exams at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});
 let scheduled:{query:string;body:{title:string}}|undefined;
 await page.route('**/api/v1/admin/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'admin',email:'admin@example.test',display_name:'Admin',role:'platform',permissions:['overview','exams','sessions','centres']}}});
  if(path==='/api/v1/admin/centres')return route.fulfill({json:{centres:[
   {id:'c1',slug:'alpha',name:'Alpha Centre',join_code:'A',include_global:true,ai_enabled:false,disabled:false,students:4,exams:2},
   {id:'c2',slug:'beta',name:'Beta School',join_code:'B',include_global:true,ai_enabled:true,disabled:false,students:9,exams:1}]}});
  if(path==='/api/v1/admin/content')return route.fulfill({json:{drafts:[
   draft('d1','Platform Mock 1','','','2026-11-01T08:00:00Z'),draft('d2','Alpha Sunday Mock','c1','Alpha Centre','2026-11-10T08:00:00Z'),draft('d3','Beta Reading','c2','Beta School','2026-11-12T08:00:00Z')]}});
  if(path==='/api/v1/admin/content-imports')return route.fulfill({json:{imports:[]}});
  if(path==='/api/v1/admin/students')return route.fulfill({json:{students:[]}});
  if(path==='/api/v1/admin/exam-sessions'&&route.request().method()==='POST'){
   scheduled={query:url.search,body:route.request().postDataJSON()};
   return route.fulfill({status:201,json:{session:day('new',scheduled.body.title,'c1','Alpha Centre','2030-01-05T09:00:00Z','2030-01-05T12:00:00Z')}});
  }
  if(path==='/api/v1/admin/exam-sessions')return route.fulfill({json:{
   sessions:[day('abc','Alpha Saturday mock','c1','Alpha Centre','2030-01-04T09:00:00Z','2030-01-04T12:00:00Z'),day('xyz','Beta autumn mock','c2','Beta School','2026-10-01T09:00:00Z','2026-10-01T12:00:00Z')],
   papers:url.searchParams.get('centre_id')==='c1'?[{id:'l1',title:'Alpha Listening',skill:'listening'},{id:'r1',title:'Alpha Reading',skill:'reading'}]:[],pcs:[]}});
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');

 await page.getByRole('button',{name:'Exams',exact:true}).click();
 await expect(page.getByRole('button',{name:/Alpha Sunday Mock/})).toBeVisible();
 await page.screenshot({path:`test-results/${shot}-platform-exams-${width}.png`,fullPage:true});
 await page.getByLabel('Owner').selectOption({label:'Alpha Centre'});
 await expect(page.getByRole('button',{name:/Alpha Sunday Mock/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Platform Mock 1/})).toHaveCount(0);
 await page.getByLabel('Owner').selectOption({label:'All owners'});
 await page.getByLabel('Updated from').fill('2026-11-11');
 await expect(page.getByRole('button',{name:/Beta Reading/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Alpha Sunday Mock/})).toHaveCount(0);

 await page.getByRole('button',{name:'Exam day',exact:true}).click();
 await expect(page.getByRole('region',{name:'Alpha Saturday mock'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Beta autumn mock'})).toBeVisible();
 await page.screenshot({path:`test-results/${shot}-platform-exam-day-${width}.png`,fullPage:true});
 await page.getByLabel('Status').selectOption('Ended');
 await expect(page.getByRole('region',{name:'Alpha Saturday mock'})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Beta autumn mock'})).toBeVisible();
 await page.getByLabel('Status').selectOption('all');
 await page.getByLabel('Centre',{exact:true}).selectOption({label:'Alpha Centre'});
 await expect(page.getByRole('region',{name:'Beta autumn mock'})).toHaveCount(0);
 await page.getByLabel('Centre',{exact:true}).selectOption('all');
 await page.getByLabel('From').fill('2029-12-01');
 await expect(page.getByRole('region',{name:'Alpha Saturday mock'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Beta autumn mock'})).toHaveCount(0);
 await page.getByLabel('From').fill('');

 // Scheduling for a centre: its own papers load, and the request names it.
 await page.getByLabel('Learning centre').selectOption({label:'Alpha Centre'});
 await page.getByLabel('Name').fill('Alpha winter mock');
 await page.getByLabel('Starts').fill('2030-01-05T09:00');
 await page.getByLabel('Ends').fill('2030-01-05T12:00');
 await page.getByLabel('Listening paper').selectOption({label:'Alpha Listening'});
 await page.getByLabel('Reading paper').selectOption({label:'Alpha Reading'});
 await expect(page.getByText(/stars from Alpha Centre/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/${shot}-platform-schedule-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Schedule the exam'}).click();
 await expect(page.getByRole('region',{name:'Alpha winter mock'})).toBeVisible();
 expect(scheduled?.query).toBe('?centre_id=c1');
 expect(scheduled?.body.title).toBe('Alpha winter mock');
});

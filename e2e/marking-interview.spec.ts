import {expect,test} from '@playwright/test';

for(const width of [390,1440])test(`a centre marks an interview part by part at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:900});
 let published:unknown;
 await page.route('**/api/v1/admin/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'admin',email:'admin@example.test',display_name:'Admin',centre_id:'c1',centre_name:'Alpha Centre',role:'centre',permissions:['overview','marking']}}});
  if(path==='/api/v1/admin/marking/speaking/sp1/turns')return route.fulfill({json:{turns:[1,2,3].map((part,position)=>({position,part,prompt:`Question for part ${part}`,duration_ms:20000,answered:true,skipped:false}))}});
  if(path==='/api/v1/admin/marking/speaking/sp1'){published=route.request().postDataJSON();return route.fulfill({status:204,body:''})}
  if(path==='/api/v1/admin/marking')return route.fulfill({json:{writing:[],speaking:published?[]:[{id:'sp1',student_id:'s2',student_name:'Sardor Tursunov',title:'Daily routine',answers:3,submitted_at:'2026-11-15T09:00:00Z'}]}});
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');
 await page.getByRole('button',{name:'Marking',exact:true}).click();
 await page.getByRole('button',{name:'Mark Sardor Tursunov'}).click();
 const sheet=page.getByRole('dialog',{name:'Sardor Tursunov'});
 await sheet.getByRole('group',{name:'Part 1'}).getByLabel('Band').selectOption('6.5');
 await sheet.getByRole('group',{name:'Part 2'}).getByLabel('Band').selectOption('7');
 await sheet.getByRole('group',{name:'Part 3'}).getByLabel('Band').selectOption('7');
 // (6.5 + 7 + 7) / 3 = 6.83, which is band 7.0 to the nearest half.
 await expect(sheet.getByRole('status',{name:'Overall band'})).toHaveText('7.0');
 await sheet.getByRole('group',{name:'Part 3'}).getByLabel('Feedback').fill('Develops ideas well.');
 await sheet.getByLabel('Summary').fill('Extend your Part 1 answers.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/marking-interview-${width}.png`,fullPage:true});
 await sheet.getByRole('button',{name:'Publish to the student'}).click();
 await expect(page.getByText(/The student can read it now/)).toBeVisible();
 expect(published).toEqual({summary:'Extend your Part 1 answers.',parts:[{part:1,score:6.5,feedback:''},{part:2,score:7,feedback:''},{part:3,score:7,feedback:'Develops ideas well.'}]});
});

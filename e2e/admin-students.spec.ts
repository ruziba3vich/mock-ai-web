import {expect,test} from '@playwright/test';

for(const width of [390,1440])test(`admin can inspect student progress at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 const student={id:'11111111-1111-1111-1111-111111111111',display_name:'Dilmurodbek',telegram_username:'dilmurod',joined_at:'2026-10-09T17:14:00Z',last_activity_at:'2026-10-10T11:00:00Z',attempts:2,completed_mocks:1,practice_answers:4,writing_reports:0,speaking_reports:0,average_band:6,best_band:6,latest_band:6};
 await page.route('**/api/v1/admin/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'admin',email:'admin@example.test',display_name:'Admin'}}});
  if(path==='/api/v1/admin/students')return route.fulfill({json:{students:[student,{...student,id:'22222222-2222-2222-2222-222222222222',display_name:'Unassessed Student',latest_band:null,average_band:null,best_band:null,attempts:0,completed_mocks:0}]}});
  if(path===`/api/v1/admin/students/${student.id}`)return route.fulfill({json:{student,skills:[{skill:'listening',completed:1,average_band:6,best_band:6,latest_band:6}],attempts:[{id:'attempt',title:'Cambridge IELTS Listening',skill:'listening',status:'scored',started_at:'2026-10-10T10:00:00Z',band_score:6,answered:40,correct:27,question_count:40}],reports:[]}});
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');
 await page.getByRole('button',{name:'Students',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Students'})).toBeVisible();
 // The tab opens on the roster, and the roster must fit before anything else.
 await expect(page.getByRole('button',{name:'View Dilmurodbek'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'View Dilmurodbek'}).click();
 const sheet=page.getByRole('dialog',{name:'Dilmurodbek'});
 await expect(sheet.getByText('Cambridge IELTS Listening')).toBeVisible();
 await expect(sheet.getByText(/40\/40 answered · 27 correct/)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await sheet.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByLabel('Search students').fill('unassessed');
 await expect(page.getByRole('button',{name:'View Unassessed Student'})).toBeVisible();
 await expect(page.getByRole('button',{name:'View Dilmurodbek'})).toHaveCount(0);
});

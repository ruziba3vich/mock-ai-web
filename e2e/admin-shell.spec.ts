import {expect,test,type Page} from '@playwright/test';

const shot=process.env.SHOT||'after';
const signIn=async(page:Page)=>{
 await page.route('**/api/v1/admin/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/v1/admin/me')return route.fulfill({json:{admin:{id:'admin',email:'owner@example.test',display_name:'Dilnoza Karimova',centre_id:'c1',centre_name:'Alpha Centre',role:'centre',permissions:['overview','students','exams','marking','centre']}}});
  if(path==='/api/v1/admin/auth/logout')return route.fulfill({status:204,body:''});
  if(path==='/api/v1/admin/students')return route.fulfill({json:{students:[]}});
  return route.fulfill({status:404,json:{error:'not found'}});
 });
 await page.goto('/admin');
};

test('on a phone the sections sit in a drawer that closes once one is chosen',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await signIn(page);
 const students=page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Students',exact:true});
 await expect(students).toBeHidden();
 await page.getByRole('button',{name:'Open menu'}).click();
 await expect(students).toBeVisible();
 await expect(students).toBeInViewport({ratio:1});
 await page.screenshot({path:`test-results/${shot}-shell-drawer-390.png`});
 await students.click();
 await expect(page.getByRole('heading',{name:'Students'})).toBeVisible();
 await expect(students).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/${shot}-shell-students-390.png`});
});

test('on a desktop the side menu collapses, stays collapsed, and the account menu signs out',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await signIn(page);
 const nav=page.getByRole('navigation',{name:'Admin sections'});
 await expect(nav.getByRole('group',{name:'Exam room'}).getByRole('button',{name:'Marking',exact:true})).toBeVisible();
 const wide=(await nav.boundingBox())!.width;
 await page.getByRole('button',{name:'Collapse menu'}).click();
 await expect.poll(async()=>(await nav.boundingBox())!.width).toBeLessThan(wide/2);
 await page.reload();
 await expect(page.getByRole('button',{name:'Expand menu'})).toBeVisible();
 // Collapsed, a section is still reachable by its name.
 await nav.getByRole('button',{name:'Students',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Students'})).toBeVisible();
 await page.getByRole('button',{name:'Account, Dilnoza Karimova'}).click();
 await expect(page.getByText('owner@example.test')).toBeVisible();
 await page.screenshot({path:`test-results/${shot}-shell-collapsed-1440.png`});
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Account, Dilnoza Karimova'}).click();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Centre sign in'})).toBeVisible();
});

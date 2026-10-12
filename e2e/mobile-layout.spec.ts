import {expect,test} from '@playwright/test';

// Layout/navigation coverage with deterministic API fixtures, not backend E2E.
for (const width of [320,390,430,768,1440]) {
 test(`student home layout at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:800});
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const bodies:Record<string,unknown>={
    '/api/v1/me':{user:{id:'layout-user',display_name:'Dostonbek Soliyev',roles:['student'],email_verified:true}},
    '/api/v1/exams':{exams:[{id:'reading-1',title:'Urban Gardens',slug:'urban-gardens',skill:'reading',duration_seconds:3600,question_count:40}]},
    '/api/v1/me/attempts':{attempts:[]},
    '/api/v1/me/progress':{skills:[]},
    '/api/v1/me/study-plan':{plan:null},
   };
   await route.fulfill({json:bodies[path]??{items:[],content:[]}});
  });
  await page.goto('/#dashboard');
  await expect(page.getByRole('heading',{name:'Let’s practise, Dostonbek'})).toBeVisible();
  await expect(page.getByText('Urban Gardens',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const nav=page.getByRole('navigation',{name:'Mobile navigation'});
  if(width<=800){
   await expect(nav).toBeVisible();
   expect(await nav.getByRole('button').count()).toBe(5);
   for(const button of await nav.getByRole('button').all()){
    const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
   }
   await expect(nav.getByRole('button',{name:'Home',exact:true})).toHaveCSS('color','rgb(227, 255, 101)');
   const library=(await page.getByRole('heading',{name:'Ready when you are'}).boundingBox())!;
   expect(library.y+library.height).toBeLessThan((await nav.boundingBox())!.y);
   await page.screenshot({path:info.outputPath(`home-${width}.png`),fullPage:true});
   await nav.getByRole('button',{name:'Practice',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Reading test library'})).toBeVisible();
   await nav.getByRole('button',{name:'Home',exact:true}).click();
   await page.getByRole('button',{name:'Open profile',exact:true}).click();
   await expect(page.getByRole('button',{name:'Sign out of this session'})).toBeVisible();
  }else{
   await expect(nav).toBeHidden();
   const hero=page.locator('.dashboard-hero');
   expect(await hero.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  }
 });
}

import {expect,test} from '@playwright/test';

// Layout/navigation coverage with deterministic API fixtures, not backend E2E.
for (const width of [320,390,430,768,1440]) {
 test(`student home layout at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:800});
  if(width===390){
   await page.route('https://telegram.org/js/telegram-web-app.js*',route=>route.fulfill({body:'',contentType:'application/javascript'}));
   await page.addInitScript(()=>{
    const events=new Map<string,()=>void>();
    window.Telegram={WebApp:{initData:'layout-fixture',ready(){},expand(){},close(){},isFullscreen:false,
     isVersionAtLeast:()=>true,
     safeAreaInset:{top:47,bottom:34,left:0,right:0},contentSafeAreaInset:{top:56,bottom:0,left:0,right:0},
     onEvent:(name,callback)=>{events.set(name,callback)},offEvent:(name)=>{events.delete(name)},
     requestFullscreen(){this.isFullscreen=true;events.get('fullscreenChanged')?.()}
    }};
   });
  }
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
  await expect(page.getByRole('heading',{name:'Keep building, Dostonbek'})).toBeVisible();
  // The home shelf shows each exam twice by design: a poster tile to open it
  // and a detail heading for the focused one. Both must be on screen.
  const shelf=page.getByRole('region',{name:/^Moves your/});
  await expect(shelf.getByRole('button',{name:/^Urban Gardens, 60 minutes, 40 questions$/})).toBeVisible();
  await expect(shelf.getByRole('heading',{name:'Urban Gardens',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const nav=page.getByRole('navigation',{name:'Mobile navigation'});
  if(width<=800){
   if(width===390){
    await expect(page.locator('html')).toHaveClass(/telegram-fullscreen/);
    expect((await page.locator('.mobile-header').boundingBox())!.y).toBeGreaterThanOrEqual(103);
    await expect(nav).toHaveCSS('padding-bottom','40px');
   }
   await expect(nav).toBeVisible();
   expect(await nav.getByRole('button').count()).toBe(5);
   for(const button of await nav.getByRole('button').all()){
    const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
   }
   // The active tab must be visually distinguished from the inactive ones.
   // Asserted as a difference rather than a literal colour: identity ships as
   // swappable tokens, so a centre's branch re-skins these values.
   const activeTab=nav.getByRole('button',{name:'Home',exact:true});
   const idleTab=nav.getByRole('button',{name:'Practice',exact:true});
   const activeInk=await activeTab.evaluate(e=>getComputedStyle(e).color);
   const idleInk=await idleTab.evaluate(e=>getComputedStyle(e).color);
   const activeBg=await activeTab.evaluate(e=>getComputedStyle(e).backgroundColor);
   expect(activeInk).not.toBe(idleInk);
   expect(activeBg).not.toBe('rgba(0, 0, 0, 0)');
   // The last thing on Home, scrolled fully down, must clear the fixed nav.
   await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
   await page.evaluate(()=>document.scrollingElement!.scrollTo({top:document.scrollingElement!.scrollHeight,behavior:'instant'}));
   const last=(await shelf.getByText('A timed IELTS-style mock with automatic scoring.').boundingBox())!;
   expect(last.y+last.height).toBeLessThanOrEqual((await nav.boundingBox())!.y);
   await page.screenshot({path:info.outputPath(`home-${width}.png`),fullPage:true});
   await nav.getByRole('button',{name:'Practice',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Reading test library'})).toBeVisible();
   // Pages slide in when a tab changes. Measuring mid-slide reads a 44px
   // control as 43.9999px on Linux, so let the entrance finish first.
   await page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
   // Every control a thumb has to hit, not only the nav items.
   for(const pill of await page.locator('.practice-pills button').all()){
    expect((await pill.boundingBox())!.height).toBeGreaterThanOrEqual(44);
   }
   await nav.getByRole('button',{name:'Home',exact:true}).click();
   await page.getByRole('button',{name:'Open profile',exact:true}).click();
   const signOut=page.getByRole('button',{name:'Sign out of this session'});
   await expect(signOut).toBeVisible();
   // toBeVisible() passes on an element the fixed nav is painted over, which
   // is exactly how the sheet shipped unreachable. Scroll to the end of the
   // sheet and hit-test the button: whatever is at its centre must be the
   // button itself, and the tap must land.
   await signOut.scrollIntoViewIfNeeded();
   await expect(signOut).toBeInViewport();
   const onTop=await signOut.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
   });
   expect(onTop).toBe(true);
   const box=(await signOut.boundingBox())!;
   expect(box.height).toBeGreaterThanOrEqual(44);
   // The sheet is allowed to cover the nav — it sits above it — but it may not
   // run off the bottom of the screen.
   expect(box.y+box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
   await signOut.click();
   await expect(page.getByRole('button',{name:'Sign out of this session'})).toBeHidden();
  }else{
   await expect(nav).toBeHidden();
   const hero=page.getByRole('region',{name:'Mixed practice'});
   expect(await hero.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  }
 });
}

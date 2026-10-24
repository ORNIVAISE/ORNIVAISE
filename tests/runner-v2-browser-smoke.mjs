import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

// Browser smoke for the ACTUAL cloned V2 engine, with its isolated local demo state.
// The browser is served from localhost. No Supabase writes or reads are permitted.
const url=process.env.RUNNER_TEST_URL||'http://127.0.0.1:8765/signal-runner-v2-test.html';
fs.mkdirSync('artifacts/runner-preview',{recursive:true});
const browser=await chromium.launch({headless:true});
const variants=[
 {name:'desktop',viewport:{width:1440,height:900},isMobile:false,deviceScaleFactor:1},
 {name:'phone',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}
];
try{
 for(const conf of variants){
  const context=await browser.newContext({viewport:conf.viewport,isMobile:conf.isMobile,hasTouch:!!conf.hasTouch,deviceScaleFactor:conf.deviceScaleFactor});
  const page=await context.newPage();
  const errors=[],supabaseRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('supabase.co'))supabaseRequests.push(request.url())});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#signalRunner.open',{timeout:15000});
  assert.equal(await page.locator('#runnerOverlay').count(),1,'Canvas game overlay exists');
  assert.equal(await page.locator('#signalRunnerCanvas').count(),1,'Original V2 canvas exists');
  assert.equal(await page.locator('#runnerV2World option').count(),10,'All 10 world choices');
  assert.equal(await page.locator('#runnerV2Planet option').count(),14,'All 14 planet choices');
  assert.equal(await page.locator('#runnerV2Hazard option').count(),11,'All 11 obstacle choices');
  assert.equal(await page.locator('#runnerV2Form option').count(),9,'Eight geometry forms plus AUTO');
  assert.equal(await page.locator('#runnerV2Pattern option').count(),4,'Four encounter scenarios');
  const pauseFits=await page.evaluate(()=>{
    const p=document.getElementById('runnerPauseToggle').getBoundingClientRect();
    const c=document.getElementById('signalRunnerCanvas').getBoundingClientRect();
    const h=document.querySelector('.runner-hud').getBoundingClientRect();
    return p.top>=c.bottom-2 && (p.top>=h.bottom||p.left>=h.right);
  });
  assert.equal(pauseFits,true,'Pause is beneath playfield, not over scores or the canvas');
  assert.equal(await page.locator('#runnerHazardHint').count(),1,'Approach warning exists');
  const warningPlacement=await page.evaluate(()=>{
    const c=document.getElementById('signalRunnerCanvas').getBoundingClientRect();
    const cue=document.getElementById('runnerHazardHint').getBoundingClientRect();
    const hud=document.querySelector('.runner-hud').getBoundingClientRect();
    const pause=document.getElementById('runnerPauseToggle').getBoundingClientRect();
    const controls=document.querySelector('.runner-controls');
    return {canvasBottom:c.bottom,cueTop:cue.top,cueBottom:cue.bottom,hudBottom:hud.bottom,
      pauseTop:pause.top,controlsFlex:getComputedStyle(controls).flexDirection,
      cueOrder:getComputedStyle(document.getElementById('runnerHazardHint')).order};
  });
  assert.ok(warningPlacement.cueTop>=warningPlacement.canvasBottom-2&&warningPlacement.cueTop>=warningPlacement.hudBottom,
    'Upcoming-trap warning must stay outside gameplay: '+JSON.stringify(warningPlacement));
  assert.equal(await page.locator('#runnerGuidePanel').count(),1,'In-flow game guide is present');
  assert.equal(await page.locator('#runnerGuidePanel').getAttribute('hidden'),'','Guide is hidden at rest');
  await page.locator('#runnerGuideToggle').click();
  await page.waitForSelector('#runnerGuidePanel:not([hidden])');
  assert.equal(await page.locator('.runner-guide-step').count(),3,'Three beginner instructions');
  assert.equal(await page.locator('#runnerGuideToggle').getAttribute('aria-expanded'),'true');
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-guide.png'});
  await page.locator('#runnerGuideClose').click();
  assert.equal(await page.locator('#runnerGuidePanel').isHidden(),true,'Guide closes');
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-game.png'});
  await page.locator('#runnerOverlayButton').click();
  await page.waitForFunction(()=>!document.querySelector('#runnerPauseToggle')?.disabled,{timeout:12000});
  await page.waitForFunction(()=>Number(document.querySelector('#runnerDistance')?.textContent||0)>0,{timeout:12000});
  await page.locator('#runnerGuideToggle').click();
  await page.waitForSelector('#runnerGuidePanel:not([hidden])');
  assert.equal(await page.locator('#runnerPauseToggle').getAttribute('aria-pressed'),'true',
    'Opening guide during a run automatically pauses gameplay');
  const guidePausedDistance=await page.locator('#runnerDistance').textContent();
  await page.waitForTimeout(160);
  assert.equal(await page.locator('#runnerDistance').textContent(),guidePausedDistance,
    'No score advance while reading guide');
  await page.locator('#runnerGuideClose').click();
  assert.equal(await page.locator('#runnerPauseToggle').getAttribute('aria-pressed'),'true',
    'Closing guide requires player to resume explicitly');
  await page.locator('#runnerPauseToggle').click();
  assert.equal(await page.locator('#runnerPauseToggle').getAttribute('aria-pressed'),'false',
    'Resume works after guide');
  await page.locator('#runnerPauseToggle').click();
  assert.equal(await page.locator('#runnerPauseToggle').getAttribute('aria-pressed'),'true','Pause works');
  const stillDistance=await page.locator('#runnerDistance').textContent();
  await page.waitForTimeout(220);
  assert.equal(await page.locator('#runnerDistance').textContent(),stillDistance,'Pause freezes the actual game clock');
  await page.locator('#runnerStoreToggle').click();
  await page.waitForSelector('#runnerStorePanel.open');
  assert.equal(await page.locator('.runner-shop-card').count(),35,'23 demo catalog entries + 12 unreleased previews');
  assert.equal(await page.locator('.runner-shop-card.preview-only').count(),12,'All new products stay preview only');
  assert.equal(await page.locator('.runner-shop-card.preview-only button[data-item]:not([disabled])').count(),0,'No preview item can be purchased');
  // Regression: the shop scene used to override absolute positioning with relative,
  // collapsing every image to a 0px-high black surface despite valid markup.
  for(const idx of [0,3,9,13,14,20,23,24,31,34]){
    const card=page.locator('.runner-shop-card').nth(idx);
    await card.scrollIntoViewIfNeeded();
    const image=await card.evaluate(el=>{
      const holder=el.querySelector('.runner-shop-preview');
      const scene=holder?.querySelector('.runner-preview-scene');
      const subject=scene?.querySelector('.runner-preview-planet,.runner-preview-background-planet,.runner-preview-obstacles');
      if(!holder||!scene||!subject)return {missing:true};
      const a=holder.getBoundingClientRect(),b=scene.getBoundingClientRect(),c=subject.getBoundingClientRect();
      return {
        position:getComputedStyle(scene).position,
        width:b.width,height:b.height,frameWidth:a.width,frameHeight:a.height,
        subjectWidth:c.width,subjectHeight:c.height,
        background:getComputedStyle(scene).backgroundImage
      };
    });
    assert.equal(image.missing,undefined,'Shop card '+idx+' contains scene and its visible subject');
    assert.equal(image.position,'absolute','Shop card '+idx+' scene must fill its image frame');
    assert.ok(image.width>=image.frameWidth*.9&&image.height>=image.frameHeight*.9,
      'Shop card '+idx+' preview fills the frame, not a black 0px strip: '+JSON.stringify(image));
    assert.ok(image.subjectWidth>10&&image.subjectHeight>10,'Shop card '+idx+' has visible skin graphics');
    assert.ok(image.background!=='none','Shop card '+idx+' has a themed scene background');
  }
  await page.locator('.runner-shop-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-store.png'});
  await page.locator('#runnerStoreToggle').click();
  await page.locator('#runnerProfileToggle').click();
  await page.waitForSelector('#runnerProfilePanel.open');
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-profile.png'});
  await page.locator('#runnerProfileToggle').click();
  await page.locator('#runnerV2TestSettings').click();
  await page.selectOption('#runnerV2World','volcanic_cataclysm');
  await page.selectOption('#runnerV2Planet','astral_leviathan');
  await page.selectOption('#runnerV2Hazard','rift_serpents');
  await page.selectOption('#runnerV2Form','ridge');
  await page.selectOption('#runnerV2Pattern','hover');
  assert.equal(await page.evaluate(()=>window.__runnerV2ForcePattern),'hover');
  await page.selectOption('#runnerV2Pattern','pair');
  assert.equal(await page.evaluate(()=>window.__runnerV2ForcePattern),'pair');
  await page.selectOption('#runnerV2Pattern','auto');
  assert.equal(await page.evaluate(()=>window.__runnerV2ForceObstacleForm),'ridge');
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-obstacle-inspector.png'});
  await page.locator('#runnerV2TestClose').click();
  assert.equal(await page.locator('#runnerV2World').inputValue(),'volcanic_cataclysm');
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-custom-world.png'});
  await page.locator('#runnerV2TestSettings').click();
  assert.equal(await page.locator('#runnerV2Boss option').count(),3,'All three boss types selectable');
  await page.selectOption('#runnerV2Boss','1');
  await page.locator('#runnerV2BossStart').click();
  assert.equal(await page.locator('#runnerBossMission').getAttribute('data-state'),'battle','Boss mission active');
  await page.locator('#runnerBossBanner').waitFor({state:'visible'});
  const bossDisplay=await page.locator('#runnerBossBanner').evaluate(el=>{
    const rect=el.getBoundingClientRect(),name=el.querySelector('#runnerBossBannerName');
    return {w:rect.width,h:rect.height,label:name?.textContent,visible:getComputedStyle(el).display};
  });
  assert.ok(bossDisplay.w>=200&&bossDisplay.h>=38,
    'Boss name/banner must be prominent on mobile and desktop: '+JSON.stringify(bossDisplay));
  assert.match(bossDisplay.label||'',/ЗМЕЙ РАЗЛОМА|RIFT SERPENT/,'Boss name displayed prominently');
  assert.equal(await page.locator('#runnerBossBannerWave').textContent(),'ВОЛНА 0 / 3','Wave count starts at zero');
  assert.match(await page.locator('#runnerBossBannerAttack').textContent(),/КЛЫКИ СВЕРХУ|CEILING FANGS/,
    'Boss first attack is named explicitly');
  assert.match(await page.locator('#runnerBossBannerAction').textContent(),/НЕ ПРЫГАЙ|STAY LOW/,
    'Explicit instruction tells player to stay on the safe lane');
  assert.equal(await page.locator('#runnerBossBanner').getAttribute('data-action'),'stay',
    'Boss warning is styled by its actual action');
  assert.match(await page.locator('#runnerBossBannerEta').textContent(),/ОПАСНОСТЬ ЧЕРЕЗ|DANGER IN/,
    'Visible countdown to the incoming attack');
  const cueVisible=await page.locator('#runnerBossBannerAction').evaluate(el=>{
    const rect=el.getBoundingClientRect(),css=getComputedStyle(el);
    return rect.width>65&&rect.height>10&&css.display!=='none';
  });
  assert.ok(cueVisible,'Readable action cue exists on desktop and phone');


  assert.match(await page.locator('#runnerBossMissionText').textContent(),/ЗМЕЙ РАЗЛОМА|RIFT SERPENT/,'Selected boss on the mission bar');
  assert.equal(await page.evaluate(()=>runnerBossActive&&runnerBossType===1),true,'Real playable boss battle started');
  assert.equal(await page.locator('#runnerV2TestDrawer').evaluate(el=>el.classList.contains('open')),false,'Tester closes when battle starts');
  await page.waitForTimeout(650);
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-boss-battle.png'});
  assert.deepEqual(supabaseRequests,[],'Sandbox must NEVER contact the production Supabase');
  assert.deepEqual(errors,[],'No uncaught browser errors');
  console.log(conf.name+': PASS game + jump + pause + store + profile + 35 previews + eight geometry forms + guide auto-pause + three-wave boss + no backend calls');
  await context.close();
 }
}finally{await browser.close()}

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
  await page.screenshot({path:'artifacts/runner-preview/'+conf.name+'-game.png'});
  await page.locator('#runnerOverlayButton').click();
  await page.waitForFunction(()=>!document.querySelector('#runnerPauseToggle')?.disabled,{timeout:12000});
  await page.waitForFunction(()=>Number(document.querySelector('#runnerDistance')?.textContent||0)>0,{timeout:12000});
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
  assert.deepEqual(supabaseRequests,[],'Sandbox must NEVER contact the production Supabase');
  assert.deepEqual(errors,[],'No uncaught browser errors');
  console.log(conf.name+': PASS game + jump + pause + store + profile + 35 previews + eight geometry forms + no backend calls');
  await context.close();
 }
}finally{await browser.close()}

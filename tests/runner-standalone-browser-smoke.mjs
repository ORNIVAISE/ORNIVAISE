import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

// Exercise the real separate page, using an intercepted API and an existing guest identity.
// These checks never read or mutate production Supabase data.
const origin=process.env.RUNNER_SITE_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
fs.mkdirSync('artifacts/runner-preview',{recursive:true});
const variants=[{name:'desktop',width:1440,height:900},{name:'phone',width:390,height:844},{name:'narrow-phone',width:360,height:800},{name:'landscape',width:844,height:390}];
try{
 for(const conf of variants){
  const context=await browser.newContext({viewport:{width:conf.width,height:conf.height},hasTouch:conf.width<800});
  const requests=[],errors=[];
  const state={ok:true,player:{credits:321,display_name:'TEST PLAYER',runs_count:4,total_signals:18,total_distance:900,best_distance:600,selected_avatar:'orbit_o',selected_background:'deep_space',selected_obstacle:'signal_spires'},inventory:['orbit_o','deep_space','signal_spires'],items:[],achievements:[],linked_devices:1};
  await context.route('https://*.supabase.co/**',async route=>{
   const request=route.request();
   if(request.method()==='GET'){await route.fulfill({json:[]});return}
   const body=request.postDataJSON();requests.push(body);
   await route.fulfill({json:body.action==='start_run'?{ok:true,run_id:'123e4567-e89b-42d3-a456-426614174000'}:state});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#signalRunnerCanvas').count(),0,'home has no embedded engine');
  assert.equal(requests.length,0,'visiting home must not create a game profile');
  const token='d'.repeat(64);
  await page.evaluate(value=>localStorage.setItem('ornivaise-runner-player-token',value),token);
  if(await page.locator('#menuToggle').isVisible())await page.locator('#menuToggle').click();
  await page.locator('#mainNav a[href="signal-runner.html"]').click();
  await page.waitForSelector('#signalRunner.open');
  await page.waitForFunction(()=>Number(document.getElementById('runnerCredits').textContent)===321);
  assert.ok(requests.length>0&&requests.every(r=>r.token===token),'existing same-origin identity is used');
  const bounds=await page.evaluate(()=>{
   const canvas=document.getElementById('signalRunnerCanvas').getBoundingClientRect();
   const wrap=document.querySelector('.runner-canvas-wrap').getBoundingClientRect();
   const pause=document.getElementById('runnerPauseToggle').getBoundingClientRect();
   return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,canvas:{x:canvas.x,width:canvas.width,height:canvas.height,right:canvas.right,bottom:canvas.bottom},wrap:{x:wrap.x,width:wrap.width,right:wrap.right},pauseTop:pause.top};
  });
  assert.ok(bounds.pageWidth<=bounds.viewport+1,'no horizontal page overflow: '+JSON.stringify(bounds));
  assert.ok(Math.abs(bounds.canvas.x-bounds.wrap.x)<2&&Math.abs(bounds.canvas.width-bounds.wrap.width)<2,'complete playfield is visible');
  assert.ok(Math.abs(bounds.canvas.width/bounds.canvas.height-8/3)<.02,'canvas is neither stretched nor cropped');
  assert.ok(bounds.pauseTop>=bounds.canvas.bottom-1,'pause remains below playfield');
  await page.locator('#runnerProfileToggle').click();
  await page.waitForSelector('#runnerProfilePanel.open');
  assert.match(await page.locator('#runnerProfilePanel').innerText(),/TEST PLAYER/);
  await page.locator('#runnerStoreToggle').click();
  await page.waitForSelector('#runnerStorePanel.open');
  await page.locator('#runnerStoreToggle').click();
  await page.locator('#runnerOverlayButton').click();
  await page.waitForFunction(()=>runnerRunning);
  await page.locator('#runnerJump').dblclick({delay:50});
  await page.locator('#runnerPauseToggle').click();
  assert.equal(await page.locator('#runnerAbilityCount').textContent(),'0/2','two jumps are available');
  assert.equal(await page.locator('#runnerPauseToggle').getAttribute('aria-pressed'),'true');
  const distance=await page.locator('#runnerDistance').textContent();
  await page.waitForTimeout(180);
  assert.equal(await page.locator('#runnerDistance').textContent(),distance,'pause freezes gameplay');
  await page.locator('#runnerFullscreen').click();
  await page.waitForFunction(()=>document.getElementById('runnerFullscreen').getAttribute('aria-pressed')==='true');
  await page.locator('#runnerFullscreen').click();
  await page.waitForFunction(()=>document.getElementById('runnerFullscreen').getAttribute('aria-pressed')==='false');
  await page.screenshot({path:'artifacts/runner-preview/standalone-'+conf.name+'.png',fullPage:true});
  await page.locator('[data-runner-lang="en"]').click();
  await page.locator('.runner-page-brand').click();
  await page.waitForURL('**/index.html');
  assert.equal(await page.locator('#mainNav a[href="signal-runner.html"]').textContent(),'GAME');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ornivaise-runner-player-token')),token);
  assert.deepEqual(errors,[],conf.name+' page errors');
  console.log('PASS standalone '+conf.name+': route, identity, complete canvas, profile, store, double jump, pause, fullscreen, return and language');
  await context.close();
 }
}finally{await browser.close()}

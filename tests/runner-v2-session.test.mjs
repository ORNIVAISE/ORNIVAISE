// Run: node tests/runner-v2-session.test.mjs
// Prevent regressions in async starts, abandoned game sessions and score submissions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/\bsrc\s*=/.test(m[1]));
assert.equal(scripts.length,4);
scripts.forEach((m,i)=>new Script(m[2],{filename:'inline-'+i+'.js'}));
function take(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Cannot find source: '+start);
 return html.slice(a,b);
}
const startCode=take('async function startRunner(){','function spawnRunnerObstacle(){');
const scoreCode=take('async function saveRunnerScore(){','/* SIGNAL RUNNER — lightweight canvas endless runner */');
assert.match(startCode,/runnerStartPending\|\|runnerScorePending/);
assert.match(startCode,/session!==runnerSessionGeneration/);
assert.match(startCode,/runnerCurrentRunId=runId/);
assert.match(startCode,/startConnectionError/);
assert.match(html,/runnerProfilePanel\?\.classList\.remove\('open'\)/);
assert.match(html,/if\(runnerRunning&&!runnerPaused\)runnerRaf=requestAnimationFrame\(runnerLoop\)/);
const VALID_ID='123e4567-e89b-42d3-a456-426614174000';
function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
}
function setupStart(){
 const pending=[],events=[],overlayButton={disabled:false,textContent:''};
 let currentOpen=true;
 const shop={open:false},profile={open:false},doc={hidden:false};
 const runtime=new Function('requests','events','button','isOpen','shop','profile','doc',
  "let runnerStartPending=false,runnerScorePending=false,runnerSessionGeneration=0;"+
  "let runnerCurrentRunId='',runnerLastSavedRunId='',runnerRunning=false,runnerGameOver=false,runnerPaused=false;"+
  "let runnerModifier='none',runnerLast=0,runnerRaf=0;"+
  "const signalRunner={classList:{contains:isOpen}};"+
  "const runnerOverlayButton=button,runnerStorePanel={classList:{contains:()=>shop.open}},"+
  "runnerProfilePanel={classList:{contains:()=>profile.open}},document=doc;"+
  "const runnerApi=async action=>{requests.push(action);return await events.shift().promise};"+
  "const resetRunner=()=>{runnerSessionGeneration++;runnerStartPending=false;runnerCurrentRunId='';runnerRunning=false;runnerGameOver=false;runnerPaused=false};"+
  "const hideRunnerScoreForm=()=>{},updateRunnerPauseButton=()=>{},setRunnerGuideVisibility=()=>{};"+
  "const gameText=k=>k,showRunnerOverlay=(a,b,c)=>{button.textContent=c;button.message=b};"+
  "const pauseRunner=()=>{runnerPaused=true;return true};"+
  "const startRunnerMusic=()=>{},hideRunnerOverlay=()=>{};"+
  "const announceRunnerEvent=()=>{},runnerCanvas={focus(){}},runnerLoop=()=>{};"+
  "const requestAnimationFrame=()=>{runnerRaf++;return runnerRaf},performance={now:()=>10000};"+
  "const close=()=>{runnerSessionGeneration++;runnerStartPending=false;runnerCurrentRunId='';runnerRunning=false;currentClose();button.disabled=false};"+
  "const currentClose=()=>{doc.wasClosed=true};"+
  startCode+
  ";return {startRunner,close,get:()=>({runnerStartPending,runnerCurrentRunId,runnerRunning,runnerPaused,runnerRaf,runnerSessionGeneration}),setOpen:v=>{doc.open=v}};"
 )(pending,events,overlayButton,()=>currentOpen,shop,profile,doc);
 return {runtime,pending,events,overlayButton,shop,profile,doc,setOpen(v){currentOpen=v}};
}
{
 const x=setupStart(),first=deferred();x.events.push(first);
 const a=x.runtime.startRunner(),b=x.runtime.startRunner();
 assert.equal(x.pending.length,1,'one start_run request, not two');
 first.resolve({run_id:VALID_ID});await Promise.all([a,b]);
 assert.equal(x.runtime.get().runnerRunning,true);
 assert.equal(x.runtime.get().runnerCurrentRunId,VALID_ID);
 assert.equal(x.runtime.get().runnerRaf,1);
 assert.equal(x.runtime.get().runnerStartPending,false);
}
{
 const x=setupStart(),first=deferred();x.events.push(first);
 const a=x.runtime.startRunner();
 x.setOpen(false);x.runtime.close();
 first.resolve({run_id:VALID_ID});await a;
 assert.equal(x.runtime.get().runnerRunning,false,'late response must not restart closed game');
 assert.equal(x.runtime.get().runnerCurrentRunId,'');
 assert.equal(x.runtime.get().runnerRaf,0);
}
{
 const x=setupStart(),first=deferred();x.events.push(first);
 const a=x.runtime.startRunner();first.reject(new Error('offline'));
 await a;
 assert.equal(x.runtime.get().runnerRunning,false,'no offline scored run');
 assert.equal(x.overlayButton.textContent,'retryStart');
 assert.equal(x.overlayButton.message,'startConnectionError');
 assert.equal(x.overlayButton.disabled,false);
}
{
 const x=setupStart(),first=deferred();x.events.push(first);
 const a=x.runtime.startRunner();x.shop.open=true;
 first.resolve({run_id:VALID_ID});await a;
 assert.equal(x.runtime.get().runnerPaused,true,'store opened during server request pauses run');
 assert.equal(x.runtime.get().runnerRaf,0);
}
{
 const x=setupStart(),first=deferred();x.events.push(first);
 const a=x.runtime.startRunner();x.doc.hidden=true;
 first.resolve({run_id:VALID_ID});await a;
 assert.equal(x.runtime.get().runnerPaused,true,'hidden tab cannot start playback');
}
{
 let count=0;
 const state={token:VALID_ID,saved:'',pending:false};
 const scoreStatus={textContent:''},button={disabled:false},overlay={disabled:false};
 const runnerState=new Function('state','scoreStatus','button','overlay','makeRequest',
  "const runnerNameInput={value:'TestPlayer',focus(){}};"+
  "const runnerScoreStatus=scoreStatus,runnerScoreSave=button,runnerOverlayButton=overlay;"+
  "const runnerLeaderboardRows=[],runnerStoreState={};"+
  "const runnerNameKey=v=>String(v).toLowerCase(),runnerServerError=e=>e.message;"+
  "const localStorage={getItem:()=>'',setItem(){}};"+
  "const document={documentElement:{lang:'en'}};"+
  "const gameText=v=>v;"+
  "let runnerCurrentRunId=state.token,runnerLastSavedRunId=state.saved,runnerScorePending=false,runnerStartPending=false,runnerSessionGeneration=1;"+
  "const runnerDistanceValue=1200,runnerSignalCount=4;"+
  "const runnerApi=async()=>{state.requests++;return await makeRequest()};"+
  "const applyRunnerStoreState=()=>{},loadRunnerLeaderboard=async()=>{};"+
  scoreCode+
  ";return {saveRunnerScore,get:()=>({runnerScorePending,runnerLastSavedRunId})};"
 )(state,scoreStatus,button,overlay,()=>{count++;return wait.promise});
 const wait=deferred();state.requests=0;
 const a=runnerState.saveRunnerScore(),b=runnerState.saveRunnerScore();
 assert.equal(count,1,'duplicate submit cannot send two finish_run requests');
 assert.equal(overlay.disabled,true,'cannot restart while score is saving');
 wait.resolve({earned:4,rank:1});await Promise.all([a,b]);
 assert.equal(runnerState.get().runnerScorePending,false);
 assert.equal(overlay.disabled,false);
 assert.equal(runnerState.get().runnerLastSavedRunId,VALID_ID);
}
console.log('PASS: launch races, close while loading, offline retry, overlay pauses, single score submission');

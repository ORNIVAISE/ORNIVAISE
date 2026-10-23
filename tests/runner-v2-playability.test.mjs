// Run: node tests/runner-v2-playability.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(b=>!/\bsrc\s*=/.test(b[1]));
assert.equal(scripts.length,4);
scripts.forEach((s,i)=>new Script(s[2],{filename:'runner-inline-'+i+'.js'}));
for(const id of ['runnerAbilityHud','runnerAbilityCount','runnerAbilityLabel','runnerJump','signalRunnerCanvas']){
  assert.ok(html.includes('id="'+id+'"'),'missing HUD/control '+id);
}
assert.match(html,/kind==='double_jump'/);
assert.match(html,/runnerCoinChain/);
assert.match(html,/drawRunnerFlowFx\(ctx\)/);
assert.doesNotMatch(html,/runnerCanvas\?\.addEventListener\('keydown'/,'double keyboard listener');
assert.match(html,/if\(e\.repeat\|\|e\.target\?\.closest\?\./,'repeat-guard');
function take(a,b){
  const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
  assert.ok(start>0&&end>start,a+' missing');
  return html.slice(start,end);
}
const jumpFns=take('function updateRunnerJumpHud(){','async function startRunner(){');
const spawnFns=take('function spawnRunnerObstacle(){','function gameOverRunner(){');
const update=take('function updateRunner(dt){','/* Cinematic V2 backgrounds.');
const forecast=take('function getRunnerLandingForecast(){','function drawRunnerLandingHint(ctx){');
const fixture=[
 'const RUNNER_W=960,RUNNER_H=360,RUNNER_GROUND=292,RUNNER_CEILING=58;',
 'const RUNNER_MAX_JUMPS=2,RUNNER_JUMP_BUFFER=.12;',
 'const runnerPlayer={x:104,y:250,w:42,h:42,vy:0,onGround:true};',
 'let runnerJumpsUsed=0,runnerJumpBuffer=0,runnerJumpPulse=0,runnerLandingPulse=0;',
 'let runnerCoinChain=0,runnerCoinChainTimer=0,runnerCoinFlash=0;',
 'const runnerCoinEffects=[];',
 'let runnerRunning=true,runnerGameOver=false;',
 'let runnerDistanceValue=0,runnerSignalCount=0,runnerSpeed=300,runnerSpawn=999,runnerOrbSpawn=999;',
 'let runnerObstacles=[],runnerOrbs=[],runnerDust=[],runnerSecret=false,runnerStage=0,runnerStageTimer=0,runnerEventTimer=0;',
 'let runnerGravity=1,runnerGravityEvent=false,runnerGravityEnd=Infinity,runnerNextGravity=Infinity,runnerPortalFx=0;',
 'let runnerPortalTransition={active:false},runnerBossActive=false,runnerBossType=0,runnerBossEnd=Infinity,runnerNextBoss=Infinity;',
 'let runnerModifier="none",runnerRecordCelebrated=false,runnerGhostCurrent=[];',
 'const signalRunner={classList:{contains:()=>true}};',
 'const document={documentElement:{lang:"ru"},getElementById:()=>null};',
 'const signalZoneBadge={classList:{add(){},remove(){}},textContent:""};',
 'const runnerSfx=()=>{},updateRunnerHud=()=>{},getRunnerBest=()=>0;',
 'const gameText=s=>s,announceRunnerStage=()=>{},announceRunnerEvent=()=>{};',
 'const getRunnerStage=()=>0,getRunnerStageLabel=()=>"",startRunnerGravityTransition=()=>{};',
 'const updateRunnerGravityTransition=()=>false;',
 'const gameOverRunner=()=>{runnerRunning=false;runnerGameOver=true};',
 'const startRunner=()=>{};',
 jumpFns,spawnFns,update,forecast,
 'return {',
 ' jump:runnerJumpAction,tick:updateRunner,spawn:spawnRunnerOrb,forecast:getRunnerLandingForecast,',
 ' setSpeed:v=>{runnerSpeed=v;runnerDistanceValue=(v-300)/.072},',
 ' setGravity:g=>{runnerGravity=g;runnerPlayer.y=g===1?RUNNER_GROUND-runnerPlayer.h:RUNNER_CEILING;runnerPlayer.vy=0;runnerPlayer.onGround=true;runnerJumpsUsed=0},',
 ' addObstacle:x=>{runnerObstacles.push({x,y:RUNNER_GROUND-40,w:30,h:40,type:"spire",variant:0})},',
 ' clearObstacles:()=>{runnerObstacles=[]},',
 ' setObstacles:v=>{runnerObstacles=v},',
 ' setAirborne:(y,vy)=>{runnerPlayer.y=y;runnerPlayer.vy=vy;runnerPlayer.onGround=false;runnerJumpsUsed=1},',
 ' setOrb:o=>{runnerOrbs=[o]},',
 ' get:()=>({y:runnerPlayer.y,vy:runnerPlayer.vy,onGround:runnerPlayer.onGround,used:runnerJumpsUsed,',
 ' buffer:runnerJumpBuffer,orbs:runnerOrbs.map(o=>({...o})),obstacles:runnerObstacles.map(o=>({...o})),',
 ' spawnGap:runnerSpawn,signals:runnerSignalCount,chain:runnerCoinChain,gameOver:runnerGameOver,',
 ' speed:runnerSpeed,landingPulse:runnerLandingPulse})',
 '};'
].join('\n');
const simulate=new Function(fixture);
const frame=1/60;
function until(game,predicate,max=220){
 for(let i=0;i<max;i++){
   game.tick(frame);
   const st=game.get();
   assert.equal(st.gameOver,false,'unexpected hit in physics test');
   if(predicate(st))return st;
 }
 throw new Error('timed out waiting for physics state');
}
{
 const game=simulate();
 game.jump();assert.equal(game.get().used,1);assert.ok(game.get().vy<0);
 const first=game.get().vy;game.tick(frame);game.jump();
 assert.equal(game.get().used,2);assert.ok(game.get().vy>first);
 const second=game.get().vy;game.jump();
 assert.equal(game.get().used,2);assert.equal(game.get().vy,second);
 assert.ok(game.get().buffer>0,'third tap buffered instead of extra flight');
 const landed=until(game,s=>s.onGround&&s.used===0);
 assert.ok(landed.landingPulse>0);
 game.jump();assert.equal(game.get().used,1,'charges reset');
}
{
 const game=simulate();game.jump();game.tick(frame);game.jump();
 until(game,s=>s.vy>120&&s.y>235);
 game.jump();assert.ok(game.get().buffer>0);
 const buffered=until(game,s=>s.used===1&&!s.onGround);
 assert.ok(buffered.vy<0,'late tap launches next jump');
}
{
 const game=simulate();game.setGravity(-1);game.jump();game.tick(frame);game.jump();
 assert.ok(game.get().vy>0,'reverse gravity launches down');
 const landed=until(game,s=>s.onGround&&s.used===0);
 assert.equal(landed.y,58,'reverse gravity returns to ceiling');
}
{
 const game=simulate();game.addObstacle(984);
 assert.equal(game.spawn(),false,'no coins on hazard');
 assert.equal(game.get().orbs.length,0);
 game.clearObstacles();game.addObstacle(720);
 assert.equal(game.spawn(),true);
 const st=game.get();
 assert.equal(st.orbs.length,2,'paired safe orbs');
 assert.ok(st.spawnGap>=1.18,'double-jump landing time after coin protected');
 assert.ok(st.orbs[0].y<250,'base coin still requires jump');
 assert.ok(st.orbs[1].y<st.orbs[0].y,'second coin higher');
}
{
 const game=simulate();game.setSpeed(680);game.addObstacle(880);
 assert.equal(game.spawn(),false,'high-speed gap also checked');
 game.clearObstacles();game.addObstacle(530);
 assert.equal(game.spawn(),true);assert.ok(game.get().spawnGap>=1.18);
}
{
 const game=simulate();
 game.setOrb({x:122,y:235,r:11,value:3,kind:'violet',pulse:0});
 game.tick(frame);
 assert.equal(game.get().signals,3,'pickup grace');
 assert.equal(game.get().orbs.length,0);
 assert.equal(game.get().chain,1);
}

{
 const game=simulate();assert.equal(game.forecast(),null,'no warning when grounded');
 game.setAirborne(200,200);
 const first=game.forecast();assert.ok(first&&first.time>0);
 const obstacleX=game.get().speed*first.time+105;
 game.setObstacles([{x:obstacleX,y:252,w:40,h:40,ceiling:false}]);
 assert.equal(game.forecast().unsafe,true,'warn when an obstacle will cross the landing');
 game.setObstacles([{x:800,y:252,w:40,h:40,ceiling:false}]);
 assert.equal(game.forecast().unsafe,false,'do not warn about distant hazard');
}
{
 const game=simulate();game.setGravity(-1);game.setAirborne(100,-250);
 const first=game.forecast();assert.ok(first&&first.time>0);
 const obstacleX=game.get().speed*first.time+105;
 game.setObstacles([{x:obstacleX,y:58,w:40,h:40,ceiling:true}]);
 assert.equal(game.forecast().unsafe,true,'landing forecast works with gravity reversed');
 game.setObstacles([{x:obstacleX,y:252,w:40,h:40,ceiling:false}]);
 assert.equal(game.forecast().unsafe,false,'opposite-wall hazards cannot trigger landing warning');
}

{
 // Pause must preserve game progress and never resume behind an open shop.
 const pauseSrc=take('function updateRunnerPauseButton(){','function updateRunnerJumpHud(){');
 const game={count:0,focused:0},shop={opened:false},profile={opened:false};
 const events=[];
 const pauseButton={textContent:'',disabled:true,attrs:{},
    setAttribute(k,v){this.attrs[k]=v}};
 const mockDocument={hidden:false,getElementById:id=>id==='runnerPauseToggle'?pauseButton:null};
 const pauseApi=new Function('document','runnerMusic','runnerCanvas','runnerStorePanel',
    'runnerProfilePanel','gameText','showRunnerOverlay','hideRunnerOverlay',
    'getRunnerMusicMuted','requestAnimationFrame','cancelAnimationFrame',
    'performance','runnerLoop',
    'let runnerRunning=true,runnerPaused=false,runnerGameOver=false,runnerRaf=12,runnerLast=0;'+
    pauseSrc+
    ';return {pauseRunner,resumeRunner,toggleRunnerPause,updateRunnerPauseButton,get(){return {runnerPaused,runnerRaf,runnerLast}}};'
 )(
   mockDocument,
   {pause(){events.push('music pause')},play(){events.push('music play');return Promise.resolve()}},
   {focus(){game.focused++}},
   {classList:{contains:()=>shop.opened}},
   {classList:{contains:()=>profile.opened}},
   key=>key,
   (...args)=>events.push('overlay:'+args[0]),
   ()=>events.push('overlay hidden'),
   ()=>false,
   ()=>{game.count++;return 90+game.count},
   id=>events.push('cancel '+id),
   {now:()=>123456},
   ()=>{}
 );
 assert.equal(pauseApi.pauseRunner(),true);
 assert.equal(pauseApi.get().runnerPaused,true);
 assert.ok(events.includes('cancel 12'));
 assert.equal(pauseButton.textContent,'▶');
 shop.opened=true;
 assert.equal(pauseApi.resumeRunner(),false,'cannot resume behind shop');
 assert.equal(pauseApi.get().runnerPaused,true);
 shop.opened=false;
 mockDocument.hidden=true;
 assert.equal(pauseApi.resumeRunner(),false,'hidden tab must remain paused');
 mockDocument.hidden=false;
 assert.equal(pauseApi.resumeRunner(),true);
 assert.equal(pauseApi.get().runnerPaused,false);
 assert.equal(pauseApi.get().runnerLast,123456,'clock reset avoids time jump');
 assert.equal(pauseButton.textContent,'Ⅱ');
 assert.ok(events.includes('overlay hidden'));
 assert.ok(events.includes('music play'));
 assert.equal(game.focused,1);
 assert.equal(pauseApi.toggleRunnerPause(),true);
 assert.equal(pauseApi.get().runnerPaused,true);
}
console.log('PASS double-jump, safe coins, landing prediction, paused shop and resumable run');

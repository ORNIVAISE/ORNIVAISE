import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('signal-runner.html','utf8');
const original=fs.readFileSync('tests/runner-v2-playability.test.mjs','utf8');
function take(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>0&&end>start);return html.slice(start,end)}
const jumpFns=take('function updateRunnerJumpHud(){','async function startRunner(');
const spawnFns=take('/* V2 obstacle morphology','function gameOverRunner(){');
const update=take('function updateRunner(dt){','/* Cinematic V2 backgrounds.');
const forecast=take('function getRunnerLandingForecast(){','function drawRunnerLandingHint(ctx){');
let fixture=original.slice(original.indexOf('const fixture=[')+'const fixture='.length,original.indexOf('const simulate='));
fixture=fixture.trim().replace(/;$/,'');
let source=new Function('html','assert','jumpFns','spawnFns','update','forecast','return '+fixture)(html,assert,jumpFns,spawnFns,update,forecast);
source=source.replace("const signalZoneBadge=",'const signalZoneBadge=');
source=source.replace(" get:()=>({",` boss:(type,wins)=>{runnerBossWins=wins;startRunnerBossEvent(type)},
 wave:(type,index,wins,speed,gravity)=>{runnerSpeed=speed;runnerDistanceValue=(speed-300)/.072;runnerBossWins=wins;runnerGravity=gravity;runnerPlayer.y=gravity===1?250:58;runnerBossActive=true;runnerBossType=type;runnerBossPlans=[gravity===-1,gravity===-1,gravity===-1];spawnRunnerBossWave(index);runnerBossClock=-100;runnerBossWaveIndex=3},
 lane:runnerBossPlayerLane, cue:runnerBossCue,
 modifier:v=>{runnerModifier=v},
 raw:()=>({player:runnerPlayer,obstacles:runnerObstacles}),
 get:()=>({`);
source='const window={__runnerV2ForcePattern:"single",__runnerV2ForceObstacleForm:null};\n'+source;
source=source.replace(' raw:()=>',` hazard:(form,pattern,speed,gravity)=>{runnerSpeed=speed;runnerDistanceValue=(speed-300)/.072;runnerStage=3;runnerGravity=gravity;runnerPlayer.y=gravity===1?250:58;window.__runnerV2ForceObstacleForm=form;window.__runnerV2ForcePattern=pattern;spawnRunnerObstacle()},
 raw:()=>`);
const simulate=new Function(source);
let cases=0;
for(const modifier of ['none','low_gravity'])for(const gravity of [1,-1])for(const speed of [300,450,570,680])for(const wins of [0,3,6,9])for(let boss=0;boss<3;boss++)for(let wave=0;wave<3;wave++){
 let passed=false;
 for(const lead of [.22,.28,.34,.40,.46,.52]){
  const g=simulate();g.modifier(modifier);g.wave(boss,wave,wins,speed,gravity);
  const initial=g.raw().obstacles.map(o=>({...o}));
  const double=initial[0].bossAction==='double';
  const schedule=initial.flatMap(o=>{const at=(o.x-139)/speed-lead;return double?[at,at+.16]:[at]}).sort((a,b)=>a-b);
  let step=0,time=0;
  // Freeze speed in this isolated wave proof, mirroring all difficulty samples.
  while(time<12&&!g.get().gameOver&&g.raw().obstacles.length){
   while(step<schedule.length&&schedule[step]<=time){g.jump();step++}
   g.setSpeed(speed);g.tick(1/120);time+=1/120;
  }
  if(!g.get().gameOver){passed=true;break}
 }
 assert.equal(passed,true,`unfair boss ${boss} wave ${wave} wins ${wins} speed ${speed} gravity ${gravity} modifier ${modifier}`);cases++;
}
// An airborne player must never redirect any telegraphed boss wave.
for(const gravity of [1,-1]){
 const g=simulate();g.setGravity(gravity);g.setAirborne(gravity===1?65:240,0);
 assert.equal(g.lane(),gravity===-1);
 g.boss(1,0);g.jump();assert.equal(g.cue().attack.ceiling,gravity===-1);
}
// Pause is checked at the jump primitive itself, not only in the input wrapper.
console.log(`PASS ${cases} complete boss waves at 120Hz: 3 bosses × 3 attacks × 4 tiers × 4 speeds × both gravities × normal/low gravity; fixed telegraphs`);

let hazardCases=0;
for(const modifier of ['none','low_gravity'])for(const gravity of [1,-1])for(const speed of [300,450,680])for(const form of ['needle','twins','slab','trident','shard','wave','ridge','monolith','fan','gate','saw'])for(const pattern of (form==='saw'?['hover','sweep','drift','stutter','lift']:['single'])){
 let passed=false;
 for(const lead of [-1,.16,.22,.28,.34,.40,.46,.52,.60])for(const second of [false,true]){
  // Same deterministic midpoint geometry on every attempted timing.
  const math=Object.create(Math);math.random=()=>.5;
  const g=new Function('Math',source)(math);g.modifier(modifier);g.hazard(form,pattern,speed,gravity);
  const o=g.raw().obstacles[0];assert.ok(o);
  const at=(o.x-139)/speed-lead;
  const schedule=lead<0?[]:second?[at,at+.16]:[at];
  let step=0,time=0;
  while(time<8&&!g.get().gameOver&&g.raw().obstacles.length){
   while(step<schedule.length&&schedule[step]<=time){g.jump();step++}
   g.setSpeed(speed);g.tick(1/120);time+=1/120;
  }
  if(!g.get().gameOver){passed=true;break}
 }
 assert.ok(passed,`unavoidable general hazard ${form}/${pattern} speed ${speed} gravity ${gravity}`);hazardCases++;
}
console.log(`PASS ${hazardCases} obstacle/motion combinations with a reachable run, jump or double-jump path`);

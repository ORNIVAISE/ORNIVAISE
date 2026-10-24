// Boss combat regression: unique 3-wave encounters, non-overlapping hazards, and no currency mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function take(from,to){
 const a=html.indexOf(from),b=html.indexOf(to,a+from.length);
 assert.ok(a>=0&&b>a,'missing code '+from);return html.slice(a,b);
}
const code= [
 'const RUNNER_W=960,RUNNER_H=360,RUNNER_GROUND=292,RUNNER_CEILING=58;',
 "const document={documentElement:{lang:'ru'},getElementById:id=>elements[id]||null};",
 "const elements={runnerBossMission:{dataset:{}},runnerBossMissionText:{textContent:''},runnerBossMissionProgress:{textContent:''}};",
 "let runnerSpeed=450,runnerStage=2,runnerGravity=1,runnerObstacles=[],runnerOrbs=[],runnerSpawn=0,runnerOrbSpawn=0;",
 "let runnerDistanceValue=2000,runnerRunning=true,runnerGameOver=false,runnerGravityEvent=false;",
 "let runnerPortalTransition={active:false},runnerBossActive=false,runnerBossType=0,runnerBossEnd=0,runnerNextBoss=2200,runnerBossClock=0,runnerBossWaveIndex=0,runnerBossWins=0;",
 "let runnerPlayer={x:104,y:250,w:42,h:42};",
 "const window={__runnerV2ForceObstacleForm:null,__runnerV2ForcePattern:'auto'};",
 "const events=[],announceRunnerEvent=(msg,t)=>events.push({msg,t});",
 "const gameText=x=>x,rectHit=(a,b,p=4)=>a.x+p<b.x+b.w-p&&a.x+a.w-p>b.x+p&&a.y+p<b.y+b.h-p&&a.y+a.h-p>b.y+p;",
 take('/* V2 obstacle morphology','function spawnRunnerOrb(){'),
 "return {start:startRunnerBossEvent,tick:updateRunnerBossEvent,spawn:spawnRunnerBossWave,mission:updateRunnerBossMission,cue:runnerBossCue,",
 "setGravity:v=>{runnerGravity=v},setDistance:v=>{runnerDistanceValue=v},setPortal:v=>{runnerPortalTransition.active=v},",
 "move:dt=>{for(const o of runnerObstacles)o.x-=runnerSpeed*dt;runnerObstacles=runnerObstacles.filter(o=>o.x+o.w>-30)},",
 "get:()=>({active:runnerBossActive,type:runnerBossType,clock:runnerBossClock,index:runnerBossWaveIndex,wins:runnerBossWins,",
 "next:runnerNextBoss,obstacles:runnerObstacles.map(o=>({...o})),orbs:runnerOrbs,events,mission:elements.runnerBossMission.dataset.state,",
 "missionText:elements.runnerBossMissionText.textContent,missionProgress:elements.runnerBossMissionProgress.textContent})};"
].join('\n');
const simulation=new Function(code);
for(let boss=0;boss<3;boss++){
 const g=simulation();
 assert.equal(g.start(boss),true,'start boss '+boss);
 assert.equal(g.start(boss),false,'cannot double-start');
 assert.equal(g.get().type,boss);
 assert.equal(g.get().mission,'battle');
 assert.equal(g.get().missionProgress,'0/3 ВОЛНЫ');
 assert.equal(g.get().obstacles.length,0,'no instantaneous strike on entry');
 g.tick(1.24);assert.equal(g.get().index,0,'minimum 1.25 second telegraph');
 g.tick(.02);assert.equal(g.get().index,1,'first attack enters far right');
 let o=g.get().obstacles.at(-1);
 assert.equal(o.bossAttack,true);
 assert.ok(o.x>=960,'attack must travel visibly from right edge');
 const attackMap=[
  [{form:'ridge',action:'jump',h:31,ceiling:false},{form:'twins',action:'stay',h:48,ceiling:true},{form:'saw',action:'jump',h:46,ceiling:false}],
  [{form:'twins',action:'stay',h:48,ceiling:true},{form:'trident',action:'jump',h:46,ceiling:false},{form:'ridge',action:'stay',h:34,ceiling:true}],
  [{form:'slab',action:'jump',h:34,ceiling:false},{form:'monolith',action:'double',h:128,ceiling:false},{form:'twins',action:'jump',h:46,ceiling:false}]
 ];
 const verify=(o,i)=>{
  assert.equal(o.form,attackMap[boss][i].form,'wave form corresponds to advertised attack');
  assert.equal(o.bossAction,attackMap[boss][i].action,'wave has unambiguous player action');
  assert.equal(o.ceiling,attackMap[boss][i].ceiling,'wave spawns on correct surface');
  assert.equal(o.h,attackMap[boss][i].h,'wave height matches jump requirement');
 };
 verify(o,0);
 assert.equal(g.cue().attack.action,attackMap[boss][0].action,'boss cue matches first live attack');
 g.move(1.6);
 g.tick(3.17);assert.equal(g.get().index,2);
 verify(g.get().obstacles.at(-1),1);
 g.move(3.17);
 g.tick(3.14);assert.equal(g.get().index,3);
 verify(g.get().obstacles.at(-1),2);
 assert.equal(g.get().missionProgress,'3/3 ВОЛНЫ');
 g.move(3.4);
 g.tick(3.81);
 assert.equal(g.get().active,false,'all 3 attacks finish');
 assert.equal(g.get().wins,1,'survived one boss');
 assert.equal(g.get().mission,'complete');
 assert.equal(g.get().missionProgress,'ПРОЙДЕНО ✓');
 assert.ok(g.get().next>2000+2300,'bosses are spaced, never immediately chained');
 assert.equal(g.get().events.length,2,'only start/finish announcements');
 assert.equal(g.get().events[1].msg,'БОСС ПРОЙДЕН // ØN');
}
const paused=simulation();paused.start(0);const before=paused.get().clock;
assert.equal(before,0,'new boss begins at 0');
assert.equal(paused.get().index,0,'no attacks before simulation time advances');
const upside=simulation();upside.setGravity(-1);upside.start(1);upside.tick(1.3);
assert.equal(upside.get().obstacles[0].ceiling,false,'opposite-wall wave under reverse gravity');
const portal=simulation();portal.setPortal(true);assert.equal(portal.start(0),false,'boss cannot stack with gravity portal');
const codeNoCredits=take('/* SIGNAL RUNNER V2 — boss encounters','function spawnRunnerOrb(){');
assert.doesNotMatch(codeNoCredits,/credits\s*[\+\-]?=|earned\s*[\+\-]?=|runnerApi\s*\(/,'no counterfeit server currency bonus');
assert.match(html,/if\(!runnerBossActive\)\{\s*runnerSpawn-=dt;/,'random obstacles suspended for boss');
assert.match(html,/runnerObstacles\.forEach\(o=>\{o\.x-=runnerSpeed\*dt;runnerMovingHazard\(o,dt\)\}\)/);
assert.match(html,/drawRunnerBossAttackFx\(ctx,o,phase\)/);
assert.match(html,/id="runnerBossMission"/);
assert.match(html,/id="runnerBossBannerAction"/);
assert.match(html,/id="runnerBossBannerAttack"/);
assert.match(html,/id="runnerBossBannerEta"/);
assert.match(html,/RUNNER_BOSS_ACTIONS/);
assert.match(html,/drawRunnerBossPresence\(ctx\)/);

const sandbox=fs.readFileSync(new URL('../signal-runner-v2-test.html',import.meta.url),'utf8');
assert.match(sandbox,/id="runnerV2BossStart"/);
assert.match(sandbox,/startRunnerBossEvent\(type\)/);
console.log('PASS 9 explicitly labeled boss attacks, correct jump/stay/double hazards, arrival countdowns, gravity, rewards isolation');

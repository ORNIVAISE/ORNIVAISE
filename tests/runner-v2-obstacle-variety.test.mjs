// Shape variety regression tests: geometry, inverted gravity, collision and draw contracts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../signal-runner.html',import.meta.url),'utf8');
const slice=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'missing '+start);return html.slice(a,b);
};
const geometry=slice('/* V2 obstacle morphology','function gameOverRunner(){');
const drawing=slice('/* V2 obstacle silhouettes','/* Landing forecast uses');
const source=[
 'const RUNNER_W=960,RUNNER_GROUND=292,RUNNER_CEILING=58;',
 "let runnerStage=3,runnerSpeed=300,runnerGravity=1,runnerModifier='none';",
 'let runnerObstacles=[],runnerOrbs=[],runnerSpawn=0;',
 "const window={__runnerV2ForceObstacleForm:''};",
 geometry,drawing,
 'return {forms:RUNNER_OBSTACLE_FORMS,spawn:spawnRunnerObstacle,collide:runnerObstacleHit,',
 'polygons:runnerObstacleShapes,draw:drawRunnerObstacleGeometry,',
 'setStage(v){runnerStage=v},setSpeed(v){runnerSpeed=v},setGravity(v){runnerGravity=v},',
 'force(v){window.__runnerV2ForceObstacleForm=v},orbs(v){runnerOrbs=v},clear(){runnerObstacles=[]},',
 'last(){return runnerObstacles.at(-1)},all(){return runnerObstacles}};'
].join('\n');
const game=new Function(source)();
assert.equal(game.forms.length,11);
assert.equal(new Set(game.forms.map(x=>x.id)).size,11);
for(const form of game.forms){
 assert.ok(form.width[0]>0&&form.width[1]>=form.width[0]);
 assert.ok(form.height[0]>0&&form.height[1]>=form.height[0]);
 game.force(form.id);game.clear();game.orbs([]);
 assert.equal(game.spawn(),true,form.id+' should spawn');
 const o=game.last();
 assert.equal(o.form,form.id);
 assert.ok(o.w>=form.width[0]&&o.w<=form.width[1],form.id+' width');
 assert.ok(o.h>=form.height[0]&&o.h<=form.height[1],form.id+' height');
 if(form.id==='saw')assert.ok(o.y>=58&&o.y+o.h<=292,'moving saw stays inside arena');
 else assert.equal(o.y+o.h,292,'ground aligned');
 game.setGravity(-1);game.clear();
 assert.equal(game.spawn(),true);
 if(form.id==='saw')assert.ok(game.last().y>=58,'moving saw stays below ceiling');
 else assert.equal(game.last().y,58,'ceiling aligned');
 game.setGravity(1);
}
game.force('');
game.setStage(0);
for(let i=0;i<200;i++){game.clear();game.spawn();assert.ok(['needle','twins','slab'].includes(game.last().form),'stage zero must be readable')}
game.setStage(3);
const kinds=new Set();
for(let i=0;i<300;i++){game.clear();game.spawn();kinds.add(game.last().form)}
assert.equal(kinds.size,11,'endgame offers all silhouettes');
game.force('ridge');game.clear();game.orbs([{x:970,y:160}]);
assert.equal(game.spawn(),false,'guard newly spawned obstacles near the Ø arc');
game.orbs([]);game.clear();game.spawn();
assert.equal(game.spawn(),false,'guard space after preceding wide obstacle');
game.force('saw');game.clear();game.spawn();
const saw=game.last(),cx=saw.x+saw.w*.5,cy=saw.y+saw.h*.5;
assert.equal(game.collide({x:cx-9,y:cy-9,w:18,h:18},saw,2),true);
assert.equal(game.collide({x:saw.x-7,y:saw.y-7,w:12,h:12},saw,2),false);
game.force('needle');game.clear();game.spawn();
const needle=game.last();
assert.equal(game.collide({x:needle.x+needle.w*.5-6,y:needle.y+needle.h*.57,w:12,h:12},needle,2),true);
assert.equal(game.collide({x:needle.x-2,y:needle.y+3,w:12,h:12},needle,2),false);
game.setGravity(-1);game.clear();game.spawn();
const inverse=game.last();
assert.ok(game.polygons(inverse)[0][1][1]>inverse.y,'inverted spike faces toward floor');
assert.equal(game.collide({x:inverse.x+inverse.w*.5-6,y:inverse.y+inverse.h*.57,w:12,h:12},inverse,2),true);
assert.match(html,/runnerObstacleHit\(p,o,7\)/);
assert.match(html,/return runnerObstacleHit\(projected,future,7\)/);
assert.match(html,/const spawned=spawnRunnerObstacle\(\)/);
let calls=0;
const gradient=()=>({addColorStop(){}});
const ctx=new Proxy({createLinearGradient:gradient,createRadialGradient:gradient},{
 get(obj,key){if(key in obj)return obj[key];return (...args)=>{
  for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),key);
  calls++;
 }},set(obj,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value),key);obj[key]=value;return true;}
});
for(const form of game.forms){
 game.setGravity(1);game.force(form.id);game.clear();game.spawn();
 for(const skin of ['signal_spires','frost_spines','inferno_obelisks','thunder_sentinels','rift_serpents']){
  assert.equal(game.draw(ctx,game.last(),skin,2),true);
 }
}
assert.ok(calls>400,'geometry needs real drawing');
const sandbox=fs.readFileSync(new URL('../signal-runner-v2-test.html',import.meta.url),'utf8');
assert.match(sandbox,/RUNNER_OBSTACLE_FORMS/);
assert.match(sandbox,/runnerV2Form/);
new vm.Script(sandbox.match(/<script id="runner-v2-sandbox">([\s\S]*?)<\/script>/)?.[1]||'');
console.log('PASS eleven obstacle silhouettes, stage weights, coin clearance, reverse gravity, polygon/circle collisions and canvas rendering');


// SIGNAL RUNNER V2 encounter simulation and pause placement.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../signal-runner.html',import.meta.url),'utf8');
const take=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return html.slice(x,y)};
const code=[
 'const RUNNER_W=960,RUNNER_H=360,RUNNER_GROUND=292,RUNNER_CEILING=58;',
 'let runnerSpeed=460,runnerStage=2,runnerGravity=1,runnerObstacles=[],runnerOrbs=[];',
 'const window={__runnerV2ForceObstacleForm:"",__runnerV2ForcePattern:"auto"};',
 'const rectHit=(a,b,pad=4)=>a.x+pad<b.x+b.w-pad&&a.x+a.w-pad>b.x+pad&&a.y+pad<b.y+b.h-pad&&a.y+a.h-pad>b.y+pad;',
 take('/* V2 obstacle morphology','function spawnRunnerOrb(){'),
 'return {spawnRunnerObstacle,runnerMovingHazard,runnerObstacleProjected,runnerObstacleHit,',
 'setPattern:v=>{window.__runnerV2ForcePattern=v},setStage:v=>{runnerStage=v},',
 'setGravity:v=>{runnerGravity=v},setSpeed:v=>{runnerSpeed=v},',
 'setOrbs:v=>{runnerOrbs=v},clear:()=>{runnerObstacles=[]},get:()=>runnerObstacles};'
].join('\n');
const game=new Function(code)();
function clear(){game.clear();game.setOrbs([])}
game.setPattern('pair');clear();
assert.equal(game.spawnRunnerObstacle(),true);
assert.equal(game.get().length,2,'paired spikes created');
const [a,b]=game.get();
assert.equal(a.ceiling,false);assert.equal(b.ceiling,false);
assert.ok(b.x-a.x-a.w>=58,'readable gap in pair');
assert.ok(b.x+b.w-a.x<=230,'pair can be cleared within a jump at 460 px/sec');
assert.equal(game.spawnRunnerObstacle(),false,'no overlapping encounter');
game.setPattern('overhead');clear();
assert.equal(game.spawnRunnerObstacle(),true);
assert.equal(game.get()[0].ceiling,true);
assert.equal(game.get()[0].y,58);
assert.equal(game.runnerObstacleHit({x:game.get()[0].x,y:250,w:42,h:42},game.get()[0]),false,'ordinary ground route remains clear');
game.setGravity(-1);clear();
game.spawnRunnerObstacle();
assert.equal(game.get()[0].ceiling,false,'opposite-wall trap respects reverse gravity');
game.setGravity(1);game.setPattern('hover');clear();
assert.equal(game.spawnRunnerObstacle(),true);
const saw=game.get()[0];
assert.equal(saw.form,'saw');assert.equal(saw.motion,'hover');
const y0=saw.y;game.runnerMovingHazard(saw,.15);
assert.notEqual(saw.y,y0,'saw moves each live frame');
const projected=game.runnerObstacleProjected(saw,.4);
const oldTime=saw.motionT,oldY=saw.y;
assert.notEqual(projected.y,saw.y,'forecast includes future motion');
assert.equal(saw.motionT,oldTime,'forecast does not advance real position');
assert.equal(saw.y,oldY);
game.setPattern('auto');game.setStage(0);clear();
for(let i=0;i<100;i++){
 game.clear();game.spawnRunnerObstacle();
 assert.equal(game.get().length,1,'first stage must have no combinations');
 assert.ok(!game.get()[0].motion,'moving hazards locked to advanced stages');
}
const pause='<button id="runnerPauseToggle" class="runner-pause-toggle"';
const start=html.indexOf(pause);
assert.ok(start>html.indexOf('<div class="runner-control-buttons">'),'pause in lower controls');
assert.ok(start<html.indexOf('id="runnerStoreToggle"'),'pause before store');
assert.equal(html.slice(html.indexOf('<div class="runner-canvas-wrap"'),html.indexOf('<div class="runner-controls">')).includes('id="runnerPauseToggle"'),false,'no overlay pause on playfield');
assert.match(html,/\.runner-control-buttons \.runner-pause-toggle\{[\s\S]*?position:static!important/);
console.log('PASS hazards: pairs, reverse-gravity overhead, moving saw prediction, safe intro and lower pause');


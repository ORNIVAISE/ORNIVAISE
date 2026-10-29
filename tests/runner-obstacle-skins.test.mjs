import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const html=fs.readFileSync('signal-runner.html','utf8');
function take(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>0&&j>i);return html.slice(i,j)}
const source='const RUNNER_W=960,RUNNER_GROUND=292,RUNNER_CEILING=58;const runnerCinematicMotion=false;'+
 take('/* V2 obstacle morphology','function gameOverRunner(){')+
 take('function drawRunnerPremiumHazard(','/* V2 obstacle silhouettes.')+
 take('/* V2 obstacle silhouettes.','/* Landing forecast uses')+
 'return {base:drawRunnerObstacleGeometry,material:drawRunnerObstacleSkin,forms:RUNNER_OBSTACLE_FORMS,hit:runnerObstacleHit};';
const engine=new Function(source)();
const skins=['signal_spires','crystal_shards','orbital_debris','spirit_masks','glitch_slimes','mecha_drones','moon_familiars','frost_spines','inferno_obelisks','thunder_sentinels','rift_serpents'];
function recording(){const ops=[];const grad=()=>({addColorStop(...v){ops.push(['stop',...v])}});return {ops,ctx:new Proxy({createLinearGradient:grad,createRadialGradient:grad},{get(o,k){return k in o?o[k]:(...v)=>{v.forEach(x=>{if(typeof x==='number')assert.ok(Number.isFinite(x),k)});ops.push([k,...v])}},set(o,k,v){if(typeof v==='number')assert.ok(Number.isFinite(v),k);ops.push(['set',k,v]);o[k]=v;return true}})}}
let count=0;
for(const form of engine.forms)for(const ceiling of [false,true])for(const variant of [0,1,2]){
 const traces=new Set();
 for(const skin of skins){
  const o={x:100,y:ceiling?58:220,w:60,h:60,type:form.type,form:form.id,variant,ceiling};
  const before=JSON.stringify(o),boxes=[{x:115,y:o.y+20,w:20,h:20},{x:90,y:o.y-10,w:8,h:8}];
  const collisions=boxes.map(p=>engine.hit(p,o,7));
  const r=recording();engine.base(r.ctx,o,skin,1.7);engine.material(r.ctx,skin,o,1.7,2);
  assert.equal(JSON.stringify(o),before,'cosmetic renderer must not mutate obstacle geometry');
  assert.deepEqual(boxes.map(p=>engine.hit(p,o,7)),collisions);
  if(skin!=='signal_spires')assert.ok(r.ops.some(x=>x[0]==='clip'),'material stays inside shared collision silhouette');
  traces.add(createHash('sha256').update(JSON.stringify(r.ops)).digest('hex'));count++;
 }
 assert.equal(traces.size,skins.length,'all selected skins have distinct paint operations: '+form.id);
}
const frame=html.slice(html.indexOf('runnerObstacles.forEach(o=>{',html.indexOf('function drawRunner(){')),html.indexOf('runnerOrbs.forEach(o=>{',html.indexOf('function drawRunner(){')));
assert.ok(frame.includes('runnerStoreState.selected_obstacle'));
assert.ok(frame.includes('drawRunnerObstacleSkin(ctx,skin,o,phase,stage)'));
assert.ok(!frame.includes('if(drawRunnerObstacleGeometry'),'shape pass must not swallow equipped skin pass');
console.log(`PASS ${count} skin/form/variant/gravity render combinations: 11 distinct materials, selected-item dispatch, clipping and unchanged collisions`);

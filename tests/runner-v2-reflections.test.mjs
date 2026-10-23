// SIGNAL RUNNER V2: assets, reflection, and premium hazard contracts.
// Run with: node tests/runner-v2-reflections.test.mjs
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/\bsrc\s*=/.test(m[1]));
assert.equal(inline.length,4);
inline.forEach((m,i)=>new Script(m[2],{filename:'script-'+i+'.js'}));

for(const name of ['lava','frost','storm','rift']){
  const svg=readFileSync(new URL('../assets/runner-worlds/'+name+'.svg',import.meta.url),'utf8');
  assert.match(svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<mask id="fadeMask">/);
  assert.match(svg,/<radialGradient id="planet"/);
  assert.match(svg,/<\/svg>$/);
  assert.doesNotMatch(svg,/<script|https?:\/\/[^"]+\.js/i);
  assert.ok(svg.length>4000);
}
const first=html.indexOf('/* Signal Runner V2: illustrated panorama assets');
const last=html.indexOf('function drawRunner(){',first);
assert.ok(first>0&&last>first);
const src=html.slice(first,last);
const map=new Map();
let operationCount=0;
let mirrors=0;
function gradient(){return {addColorStop(pos,color){assert.ok(Number.isFinite(pos));assert.equal(typeof color,'string')}}}
function context(){
  const target={createLinearGradient:gradient,createRadialGradient:gradient,
    drawImage(...args){mirrors++;for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg))}};
  return new Proxy(target,{get(o,name){
    if(name in o)return o[name];
    return (...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),name);
      operationCount++};
  },set(o,name,value){if(typeof value==='number')assert.ok(Number.isFinite(value),name);
    o[name]=value;return true}});
}
const painting=[];
class ImageFake{constructor(){this.complete=true;this.naturalWidth=960;painting.push(this)}
 set src(v){this.path=v}}
const mirrorContext=context();
const doc={baseURI:'https://ornivaise.ru/',createElement(name){
  assert.equal(name,'canvas');
  return {width:0,height:0,getContext(){return mirrorContext}};
}};
const runnerCanvas={width:960,height:360};
const api=new Function('document','Image','window','runnerCanvas','RUNNER_W','RUNNER_GROUND','RUNNER_H',
  src+';return {drawRunnerCinematicBackdrop,runnerFloorTint,drawRunnerMirrorGround,drawRunnerLiveReflection,drawRunnerPremiumHazard};'
)(doc,ImageFake,{innerWidth:1280},runnerCanvas,960,292,360);
assert.equal(painting.length,4);
for(const img of painting)assert.match(img.path,/https:\/\/ornivaise\.ru\/assets\/runner-worlds\/(lava|frost|storm|rift)\.svg/);
const mainContext=context();
for(const world of ['deep_space','violet_nebula','frozen_horizon','black_sun','signal_storm',
  'crimson_rift','volcanic_cataclysm','aurora_sanctum','celestial_temple','abyssal_ocean']){
  for(const stage of [0,1,2,3]){
    api.drawRunnerCinematicBackdrop(mainContext,world,stage);
    api.drawRunnerMirrorGround(mainContext,world,1500+stage*3000);
    api.drawRunnerLiveReflection(mainContext,world,1500+stage*3000);
    assert.match(api.runnerFloorTint(world).rgb,/^\d+,\d+,\d+$/);
  }
}
const palettes=['orbital_debris','frost_spines','thunder_sentinels','rift_serpents'];
for(const skin of palettes)for(const type of ['spire','block'])for(const variant of [0,1,2]){
  assert.equal(api.drawRunnerPremiumHazard(mainContext,skin,
    {x:520,y:220,w:type==='spire'?30:55,h:type==='spire'?69:35,type},variant,variant*2),true);
}
assert.equal(api.drawRunnerPremiumHazard(mainContext,'signal_spires',
  {x:520,y:220,w:30,h:60,type:'spire'},0,0),false);
assert.ok(operationCount>1000);
assert.ok(mirrors>40,'scene reflection is not being drawn');
assert.match(html,/drawRunnerLiveReflection\(ctx,runnerStoreState\.selected_background,runnerDistanceValue\)/);
assert.match(html,/if\(drawRunnerPremiumHazard\(ctx,skin,o,variant,phase\)\)/);
assert.match(html,/drawRunnerCinematicBackdrop\(ctx,runnerStoreState\.selected_background,stage\)/);
console.log('PASS four panorama assets, 10 world surface themes, 4 hazard families and 40 live-reflection frames');

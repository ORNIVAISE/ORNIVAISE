// Run: node tests/runner-v2-cosmetics.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../signal-runner.html',import.meta.url),'utf8');
const seed=readFileSync(new URL('../docs/sql/runner-v2-cosmetics-stage.sql',import.meta.url),'utf8');
const activation=readFileSync(new URL('../docs/sql/runner-v2-cosmetics-activate.sql',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/[\s]src\s*=/.test(m[1]));
assert.equal(scripts.length,3,'language, game runtime and page controls');
scripts.forEach((m,i)=>new Script(m[2],{filename:'inline-'+i+'.js'}));
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'duplicate DOM IDs');
const catalog=JSON.parse(html.match(/const RUNNER_V2_UPCOMING_ITEMS=(\[[^\n]*\]);/)[1]);
assert.equal(catalog.length,12);
assert.equal(new Set(catalog.map(x=>x.item_id)).size,12);
for(const item of catalog){
 assert.ok(html.includes(item.item_id+':{ru:['),'missing RU/EN item metadata: '+item.item_id);
 assert.ok(html.includes(item.item_id+":'"),'missing rarity: '+item.item_id);
 assert.ok(seed.includes("'"+item.item_id+"'"),'missing inactive seed: '+item.item_id);
 assert.ok(activation.includes("'"+item.item_id+"'"),'missing release gate: '+item.item_id);
 assert.equal(item.previewOnly,true,'new item previews must not allow premature payment');
}
for(const k of ['runnerProfileScene','runnerProfileShopShortcut','runnerStoreFilters','runner-shop-profile-action','function drawRunnerSpectacle','function drawRunnerAvatarCinematic','inferno_obelisks','volcanic_cataclysm','aurora_sanctum','celestial_temple','abyssal_ocean']){
 assert.ok(html.includes(k),'missing '+k);
}
assert.match(seed,/false\)\s*(?:,|\nON CONFLICT)/,'new items staged inactive');
assert.match(html,/runnerProfileBgPending/,'profile purchase guard');
assert.match(html,/prefers-reduced-motion:reduce/,'accessibility');
const worldStart=html.indexOf('function drawRunnerSpectacle(');
const worldEnd=html.indexOf('/* Signal Runner V2: illustrated panorama assets',worldStart);
const helpers=new Function('ctx','RUNNER_W','RUNNER_GROUND','RUNNER_H',html.slice(worldStart,worldEnd)+';return {drawRunnerSpectacle,drawRunnerAvatarCinematic,drawRunnerWorldAtmosphere,drawRunnerObstacleSignature,drawRunnerPlanetSurface};');
let calls=0;
const gradient=()=>({addColorStop(){}});
const ctx=new Proxy({createRadialGradient:gradient,createLinearGradient:gradient},{get(obj,name){return name in obj?obj[name]:(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(name));calls++}},set(obj,name,value){if(typeof value==='number')assert.ok(Number.isFinite(value),String(name));obj[name]=value;return true}});
const {drawRunnerSpectacle,drawRunnerAvatarCinematic,drawRunnerWorldAtmosphere,drawRunnerObstacleSignature,drawRunnerPlanetSurface}=helpers(ctx,960,330,430);
for(const world of ['volcanic_cataclysm','aurora_sanctum','celestial_temple','abyssal_ocean','crimson_rift','deep_space'])for(const distance of [0,1000,5000,12000])drawRunnerSpectacle(ctx,world,distance,2);
for(const avatar of ['magma_sovereign','astral_leviathan','storm_seraph','glacier_revenant','solar_flare','ash_titan','neon_reef','toxic_bloom','orbit_o'])for(const distance of [0,500,5000])drawRunnerAvatarCinematic(ctx,avatar,110,285,distance);

for(const world of ['deep_space','violet_nebula','frozen_horizon','black_sun','signal_storm','crimson_rift','volcanic_cataclysm','aurora_sanctum','celestial_temple','abyssal_ocean']){
  for(const distance of [0,350,2200,10000])drawRunnerWorldAtmosphere(ctx,world,distance,3);
}
for(const skin of ['signal_spires','crystal_shards','orbital_debris','spirit_masks','glitch_slimes','mecha_drones','moon_familiars','frost_spines','inferno_obelisks','thunder_sentinels','rift_serpents']){
  for(const phase of [0,3,10])drawRunnerObstacleSignature(ctx,skin,{x:540,y:260,w:36,h:55},phase,3);
}
for(const skin of ['orbit_o','frost_moon','glacier_revenant','void_core','signal_bloom','crimson_pulse','ash_titan','magma_sovereign','eclipse_halo','solar_flare','toxic_bloom','neon_reef','storm_seraph','astral_leviathan']){
  for(const phase of [0,4,16])drawRunnerPlanetSurface(ctx,skin,phase);
}
assert.ok(html.includes('id="runnerShowroomScene"'),'showroom missing from shop');
assert.ok(html.includes('renderRunnerShowroom();'),'showroom not synced with store');
assert.ok(html.includes('runner-preview-glyph'),'planet previews lack visible glyph');

assert.ok(calls>1500);
console.log('PASS: 3 scripts, unique IDs, 12 staged SKUs, 10 worlds / 14 planets / 11 obstacles, showroom and profile ('+calls+' canvas calls)');


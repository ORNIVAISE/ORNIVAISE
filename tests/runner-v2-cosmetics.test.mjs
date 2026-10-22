// Run: node tests/runner-v2-cosmetics.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const seed=readFileSync(new URL('../docs/sql/runner-v2-cosmetics-stage.sql',import.meta.url),'utf8');
const activation=readFileSync(new URL('../docs/sql/runner-v2-cosmetics-activate.sql',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/[\s]src\s*=/.test(m[1]));
assert.ok(scripts.length>=4,'four inline script blocks expected');
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
const worldEnd=html.indexOf('function drawRunner(){',worldStart);
const helpers=new Function('ctx','RUNNER_W','RUNNER_GROUND',html.slice(worldStart,worldEnd)+';return {drawRunnerSpectacle,drawRunnerAvatarCinematic};');
let calls=0;
const gradient=()=>({addColorStop(){}});
const ctx=new Proxy({createRadialGradient:gradient,createLinearGradient:gradient},{get(obj,name){return name in obj?obj[name]:(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(name));calls++}},set(obj,name,value){if(typeof value==='number')assert.ok(Number.isFinite(value),String(name));obj[name]=value;return true}});
const {drawRunnerSpectacle,drawRunnerAvatarCinematic}=helpers(ctx,960,330);
for(const world of ['volcanic_cataclysm','aurora_sanctum','celestial_temple','abyssal_ocean','crimson_rift','deep_space'])for(const distance of [0,1000,5000,12000])drawRunnerSpectacle(ctx,world,distance,2);
for(const avatar of ['magma_sovereign','astral_leviathan','storm_seraph','glacier_revenant','solar_flare','ash_titan','neon_reef','toxic_bloom','orbit_o'])for(const distance of [0,500,5000])drawRunnerAvatarCinematic(ctx,avatar,110,285,distance);
assert.ok(calls>1500);
console.log('PASS: 4 scripts, unique IDs, 12 staged SKUs, background/profile flows, canvas effects ('+calls+' calls)');

/* ISOLATED ØRNIVAISE SIGNAL RUNNER V2 DEMO BACKEND.
 * Never calls Supabase; shop currency, progress, achievements and scores are LOCAL. */
"use strict";
const RUNNER_DEMO_CATALOG=[{"item_id":"orbit_o","category":"avatar","price":0,"sort_order":10},{"item_id":"frost_moon","category":"avatar","price":70,"sort_order":20},{"item_id":"void_core","category":"avatar","price":120,"sort_order":30},{"item_id":"signal_bloom","category":"avatar","price":180,"sort_order":40},{"item_id":"crimson_pulse","category":"avatar","price":260,"sort_order":50},{"item_id":"eclipse_halo","category":"avatar","price":340,"sort_order":60},{"item_id":"neon_reef","category":"avatar","price":450,"sort_order":70},{"item_id":"solar_flare","category":"avatar","price":520,"sort_order":75},{"item_id":"toxic_bloom","category":"avatar","price":580,"sort_order":77},{"item_id":"ash_titan","category":"avatar","price":600,"sort_order":80},{"item_id":"glacier_revenant","category":"avatar","price":220,"sort_order":90},{"item_id":"storm_seraph","category":"avatar","price":520,"sort_order":100},{"item_id":"magma_sovereign","category":"avatar","price":1150,"sort_order":110},{"item_id":"astral_leviathan","category":"avatar","price":1350,"sort_order":120},{"item_id":"deep_space","category":"background","price":0,"sort_order":10},{"item_id":"violet_nebula","category":"background","price":90,"sort_order":20},{"item_id":"frozen_horizon","category":"background","price":160,"sort_order":30},{"item_id":"black_sun","category":"background","price":220,"sort_order":40},{"item_id":"signal_storm","category":"background","price":280,"sort_order":50},{"item_id":"crimson_rift","category":"background","price":420,"sort_order":60},{"item_id":"abyssal_ocean","category":"background","price":240,"sort_order":70},{"item_id":"aurora_sanctum","category":"background","price":620,"sort_order":80},{"item_id":"volcanic_cataclysm","category":"background","price":1250,"sort_order":90},{"item_id":"celestial_temple","category":"background","price":1450,"sort_order":100},{"item_id":"signal_spires","category":"obstacle","price":0,"sort_order":10},{"item_id":"crystal_shards","category":"obstacle","price":65,"sort_order":20},{"item_id":"orbital_debris","category":"obstacle","price":140,"sort_order":30},{"item_id":"spirit_masks","category":"obstacle","price":190,"sort_order":40},{"item_id":"glitch_slimes","category":"obstacle","price":260,"sort_order":50},{"item_id":"mecha_drones","category":"obstacle","price":360,"sort_order":60},{"item_id":"moon_familiars","category":"obstacle","price":480,"sort_order":70},{"item_id":"frost_spines","category":"obstacle","price":190,"sort_order":80},{"item_id":"inferno_obelisks","category":"obstacle","price":480,"sort_order":90},{"item_id":"thunder_sentinels","category":"obstacle","price":590,"sort_order":100},{"item_id":"rift_serpents","category":"obstacle","price":1180,"sort_order":110}];
const RUNNER_DEMO_KEY='ornivaise-signal-runner-v2-demo-v3';
function runnerDemoInitial(){
 return {credits:16000,
 inventory:['orbit_o','deep_space','signal_spires','magma_sovereign','volcanic_cataclysm','inferno_obelisks'],
 selected_avatar:'magma_sovereign',selected_background:'volcanic_cataclysm',
 selected_obstacle:'inferno_obelisks',selected_profile_background:'volcanic_cataclysm',
 display_name:'',runs_count:0,total_signals:0,total_distance:0,best_distance:0,
 achievements:[],scores:[],active_run:null};
}
function runnerDemoLoad(){
 const x=runnerDemoInitial();
 try{
   const v=JSON.parse(localStorage.getItem(RUNNER_DEMO_KEY)||'null');
   if(!v||typeof v!=='object')return x;
   for(const k of ['credits','runs_count','total_signals','total_distance','best_distance'])
     if(Number.isFinite(v[k])&&v[k]>=0)x[k]=Math.min(1000000,Math.floor(v[k]));
   const ids=new Set(RUNNER_DEMO_CATALOG.map(z=>z.item_id));
   if(Array.isArray(v.inventory))x.inventory=[...new Set([...x.inventory,...v.inventory.filter(id=>ids.has(id))])];
   for(const k of ['selected_avatar','selected_background','selected_obstacle','selected_profile_background'])
     if(ids.has(v[k])&&x.inventory.includes(v[k]))x[k]=v[k];
   if(typeof v.display_name==='string')x.display_name=v.display_name.slice(0,20);
   if(Array.isArray(v.scores))x.scores=v.scores.filter(z=>z&&typeof z.player_name==='string').slice(0,20);
   if(Array.isArray(v.achievements))x.achievements=v.achievements.filter(z=>z&&typeof z.achievement_id==='string').slice(0,5);
 }catch(_){}
 return x;
}
let runnerDemoState=runnerDemoLoad();
function runnerDemoSave(){
 try{localStorage.setItem(RUNNER_DEMO_KEY,JSON.stringify({...runnerDemoState,active_run:null}))}catch(_){}
}
function runnerDemoSnapshot(extra={}){
 const {credits,selected_avatar,selected_background,selected_obstacle,selected_profile_background,
 display_name,runs_count,total_signals,total_distance,best_distance}=runnerDemoState;
 return {ok:true,player:{credits,selected_avatar,selected_background,selected_obstacle,
 selected_profile_background,display_name,runs_count,total_signals,total_distance,best_distance},
 inventory:[...runnerDemoState.inventory],items:RUNNER_DEMO_CATALOG.map(x=>({...x})),
 achievements:runnerDemoState.achievements.map(x=>({...x})),linked_devices:1,...extra};
}
async function runnerDemoApi(action,payload={}){
 await Promise.resolve();
 const item=RUNNER_DEMO_CATALOG.find(x=>x.item_id===payload.item_id);
 if(action==='state')return runnerDemoSnapshot();
 if(action==='start_run'){
   const uuid=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():
    '123e4567-e89b-42d3-a456-'+String(Date.now()%1000000000000).padStart(12,'0');
   runnerDemoState.active_run=uuid;
   return {ok:true,run_id:uuid,started_at:new Date().toISOString()};
 }
 if(action==='finish_run'){
   if(!runnerDemoState.active_run||runnerDemoState.active_run!==payload.run_id)throw Error('run_not_active');
   const d=Math.max(0,Math.min(100000,Math.floor(Number(payload.distance)||0)));
   const signals=Math.max(0,Math.min(10000,Math.floor(Number(payload.signals)||0)));
   const earned=signals+Math.floor(d/140);
   runnerDemoState.credits+=earned;
   runnerDemoState.total_distance+=d;
   runnerDemoState.total_signals+=signals;
   runnerDemoState.runs_count++;
   runnerDemoState.best_distance=Math.max(runnerDemoState.best_distance,d);
   runnerDemoState.display_name=String(payload.player_name||'PILOT Ø').slice(0,20)||'PILOT Ø';
   for(const [id,reached,reward] of [
     ['first_contact',runnerDemoState.runs_count>=1,10],
     ['signal_hunter',runnerDemoState.total_signals>=50,25],
     ['void_walker',runnerDemoState.best_distance>=3000,40],
     ['deep_runner',runnerDemoState.best_distance>=5000,75],
     ['transmission_legend',runnerDemoState.best_distance>=10000,150]]){
     if(reached&&!runnerDemoState.achievements.some(a=>a.achievement_id===id)){
       runnerDemoState.achievements.push({achievement_id:id,reward,unlocked_at:new Date().toISOString()});
       runnerDemoState.credits+=reward;
     }
   }
   const score={run_id:payload.run_id,player_name:runnerDemoState.display_name,distance:d,
    signals,created_at:new Date().toISOString()};
   runnerDemoState.scores.push(score);
   runnerDemoState.scores.sort((a,b)=>b.distance-a.distance||b.signals-a.signals);
   runnerDemoState.scores=runnerDemoState.scores.slice(0,20);
   runnerDemoState.active_run=null;
   runnerDemoSave();
   return runnerDemoSnapshot({earned,rank:runnerDemoState.scores.findIndex(x=>x.run_id===score.run_id)+1});
 }
 if(action==='buy'){
   if(!item)throw Error('item_not_found');
   if(runnerDemoState.inventory.includes(item.item_id))return runnerDemoSnapshot({already_owned:true});
   if(runnerDemoState.credits<item.price)throw Error('not_enough_credits');
   runnerDemoState.credits-=item.price;
   runnerDemoState.inventory.push(item.item_id);
   runnerDemoSave();
   return runnerDemoSnapshot({already_owned:false,purchased:true});
 }
 if(action==='equip'){
   if(!item)throw Error('item_not_found');
   if(item.price>0&&!runnerDemoState.inventory.includes(item.item_id))throw Error('item_not_owned');
   const key={avatar:'selected_avatar',background:'selected_background',obstacle:'selected_obstacle'}[item.category];
   if(!key)throw Error('item_not_found');
   runnerDemoState[key]=item.item_id;
   runnerDemoSave();
   return runnerDemoSnapshot();
 }
 if(action==='profile_background'){
   if(!item||item.category!=='background')throw Error('invalid_profile_background');
   if(item.price>0&&!runnerDemoState.inventory.includes(item.item_id))throw Error('item_not_owned');
   runnerDemoState.selected_profile_background=item.item_id;
   runnerDemoSave();
   return runnerDemoSnapshot();
 }
 if(action==='create_link'||action==='redeem_link')throw Error('demo_link_unavailable');
 throw Error('unknown_action');
}
function runnerDemoScores(){return runnerDemoState.scores.map(x=>({...x}))}
function runnerDemoReset(){runnerDemoState=runnerDemoInitial();runnerDemoSave()}

// Run: node tests/runner-v2-portal.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(x=>!/\bsrc\s*=/.test(x[1]));
assert.equal(js.length,4);
js.forEach((block,i)=>new Script(block[2],{filename:'inline-'+i+'.js'}));
const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length);
for(const theme of ['lava','frost','storm','rift']){
 const image=readFileSync(new URL('../assets/runner-worlds/'+theme+'.svg',import.meta.url),'utf8');
 assert.match(image,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(html,new RegExp('assets/runner-worlds/'+theme+'\\.svg'));
}
for(const name of ['runner-gateway','runnerGatewayLaunch','runnerGatewayEquip','runnerGatewayWorlds','runnerGatewayShell','runnerHeroPortal']){
 assert.ok(html.includes('id="'+name+'"'),name+' missing');
}
const start=html.indexOf('/* PORTAL Ø: public-world gallery.');
const end=html.indexOf('/* The same skins power the shop previews',start);
assert.ok(start>0&&end>start);
const code=html.slice(start,end);
assert.doesNotMatch(code,/runnerApi\(['"]buy['"]/,'gallery cannot buy cosmetics');
assert.doesNotMatch(code,/unlockSignal\(/,'secret puzzle should not be marked solved');
const keys={gatewayPreview:'PREVIEW',gatewaySoon:'COMING SOON',gatewayEquipped:'EQUIPPED',
 gatewayOwned:'OWNED',gatewayAvailable:'IN SHOP',gatewayEquip:'EQUIP WORLD',
 gatewayStore:'OPEN SHOP',gatewayHeading:'PORTAL Ø',gatewayWorld:'WORLD',gatewayLoading:'CONNECTING'};
const names={
 volcanic_cataclysm:{ru:['ВУЛКАН','Лава'],en:['VOLCANIC','Lava']},
 frozen_horizon:{ru:['ЛЕДЯНОЙ','Лёд'],en:['FROZEN','Ice']},
 signal_storm:{ru:['ГРОЗОВОЙ','Молнии'],en:['STORM','Lightning']},
 crimson_rift:{ru:['РАЗЛОМ','Пустота'],en:['RIFT','Void']},
 orbit_o:{ru:['ОРБИТА',''],en:['ORBIT','']}
};
function createNode(){
 const node={textContent:'',className:'',dataset:{},attributes:{},disabled:false,
  firstElementChild:{textContent:''},style:{setProperty(){}},listeners:{},
  setAttribute(k,v){this.attributes[k]=v},
  addEventListener(k,f){this.listeners[k]=f},
  scrollIntoView(){this.scrolled=true},
  classList:{values:new Set(),toggle(k,on){if(on)this.values.add(k);else this.values.delete(k)},
    add(k){this.values.add(k)},remove(k){this.values.delete(k)},
    contains(k){return this.values.has(k)}}
 };
 return node;
}
const els=Object.create(null),get=id=>els[id]||(els[id]=createNode());
const buttons=['volcanic_cataclysm','frozen_horizon','signal_storm','crimson_rift'].map(id=>{
 const el=createNode(),strong=createNode(),flag=createNode();
 el.dataset.gatewayWorld=id;
 el.querySelector=k=>k==='strong'?strong:k==='em'?flag:null;
 el.nameNode=strong;el.flagNode=flag;return el;
});
get('runnerGatewayWorlds').querySelectorAll=()=>buttons;
const document={documentElement:{lang:'ru'},getElementById:get};
const state={
 credits:800,selected_avatar:'orbit_o',selected_background:'crimson_rift',
 items:[{item_id:'frozen_horizon',price:250,category:'background'},
        {item_id:'signal_storm',price:500,category:'background'},
        {item_id:'crimson_rift',price:850,category:'background'}],
 inventory:['frozen_horizon'],profile:{best_distance:2400}
};
let opens=0,enters=0,shops=0,apiCalls=0;const timers=[];
const ctor=new Function('document','runnerStoreState','RUNNER_ITEM_META','gameText','window',
'easterOverlay','signalRunner','runnerStorePanel','runnerApi','applyRunnerStoreState',
'loadRunnerStoreState','openEaster','openRunner','toggleRunnerStore','setTimeout',
'runnerServerError','runnerStoreRarityFilter',
code+';return {renderRunnerGateway,chooseRunnerGatewayWorld,equipRunnerGatewayWorld,launchRunnerFromGateway,setSynced(value){runnerGatewaySyncedAt=value}};');
const gate=ctor(document,state,names,key=>keys[key]||key,
 {matchMedia:()=>({matches:false})},createNode(),createNode(),get('runnerStorePanel'),
 async(action,payload)=>{assert.equal(action,'equip');assert.equal(payload.item_id,'frozen_horizon');apiCalls++;return {player:{selected_background:'frozen_horizon'}}},
 result=>{state.selected_background=result.player.selected_background},
 async()=>{},()=>{opens++},()=>{enters++},
 ()=>{shops++;get('runnerStorePanel').classList.add('open')},
 f=>{timers.push(f)},e=>e.message,'all');
gate.renderRunnerGateway();
assert.equal(get('runnerGatewayEquip').disabled,true,'not loaded');
gate.setSynced(Date.now());gate.renderRunnerGateway();
assert.equal(get('runnerGatewayEquip').textContent,'OPEN SHOP');
gate.chooseRunnerGatewayWorld('volcanic_cataclysm');
assert.equal(get('runnerGatewayEquip').disabled,true,'unreleased world not purchasable');
gate.chooseRunnerGatewayWorld('frozen_horizon');
assert.equal(get('runnerGatewayEquip').disabled,false,'owned world equips');
await gate.equipRunnerGatewayWorld();
assert.equal(apiCalls,1);assert.equal(state.selected_background,'frozen_horizon');
assert.equal(get('runnerGatewayEquip').disabled,true,'already equipped');
document.documentElement.lang='en';gate.renderRunnerGateway();
assert.equal(get('runnerGatewayWorldName').textContent,'FROZEN');
assert.equal(get('runnerGatewayWorldStatus').textContent,'EQUIPPED');
gate.chooseRunnerGatewayWorld('signal_storm');
assert.equal(get('runnerGatewayEquip').textContent,'OPEN SHOP');
await gate.equipRunnerGatewayWorld();
assert.equal(apiCalls,1,'unowned world cannot be equipped');
while(timers.length)timers.shift()();
assert.equal(opens,1);assert.equal(enters,1);assert.equal(shops,1);
gate.launchRunnerFromGateway();
while(timers.length)timers.shift()();
assert.equal(opens,2);assert.equal(enters,2);
assert.equal(apiCalls,1,'no purchases in gateway');
console.log('PASS Portal Ø: RU/EN, 4 worlds, preview-only, owned equip, shop redirect, direct entry');

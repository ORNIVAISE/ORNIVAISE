// Run: node tests/runner-v2-state-order.test.mjs
// Latest server purchases and equipped profile backgrounds must win over stale reads.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../signal-runner.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m=>!/\bsrc\s*=/.test(m[1]));
assert.equal(scripts.length,3);
scripts.forEach((m,i)=>new Script(m[2],{filename:'inline-'+i+'.js'}));
function extract(from,to){
 const start=html.indexOf(from),end=html.indexOf(to,start+from.length);
 assert.ok(start>=0&&end>start,'Unable to extract '+from);
 return html.slice(start,end);
}
const mutationHelper=extract('let runnerStoreMutationVersion=0,runnerStoreFetchVersion=0;','function applyRunnerStoreState(data){');
const stateLoad=extract('async function loadRunnerStoreState(){','let runnerStoreTransactionPending=false;');
for(const [call,name] of [
 ['buy','bought'],['equip','equipped'],['profile_background','data'],
 ['redeem_link','data']]){
 assert.ok(html.includes("runnerApi('"+call+"'"),call+' mutation missing');
}
assert.match(stateLoad,/requestId!==runnerStoreFetchVersion/,'ignore older fetches');
assert.match(stateLoad,/observedMutation!==runnerStoreMutationVersion/,'ignore pre-mutation reads');
assert.match(html,/applyRunnerStoreMutation\(bought\)/);
assert.match(html,/applyRunnerStoreMutation\(equipped\)/);
assert.match(html,/applyRunnerStoreMutation\(result\)/);
function delay(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
 return {promise,resolve,reject};
}
function setup(){
 const pending=[],result={world:'deep_space',credits:0,items:[]},status={textContent:'unchanged'};
 const create=new Function('result','pending','status',
  "let requests=0;const runnerStoreStatus=status,gameText=k=>k;"+
  "const runnerApi=()=>{requests++;const d=pending.shift();return d.promise};"+
  "function applyRunnerStoreState(data){result.world=data.player.selected_background;result.credits=data.player.credits;result.items=data.items||[];}"+
  mutationHelper+stateLoad+
  ";return {applyRunnerStoreMutation,loadRunnerStoreState,stats:()=>({runnerStoreMutationVersion,runnerStoreFetchVersion,requests})};"
 );
 const instance=create(result,pending,status);
 return {pending,result,status,...instance};
}
{
 const setupState=setup(),old=delay();setupState.pending.push(old);
 const loading=setupState.loadRunnerStoreState();
 setupState.applyRunnerStoreMutation({player:{selected_background:'volcanic_cataclysm',credits:1300}});
 old.resolve({player:{selected_background:'deep_space',credits:0}});
 await loading;
 assert.equal(setupState.result.world,'volcanic_cataclysm');
 assert.equal(setupState.result.credits,1300);
}
{
 const s=setup(),older=delay(),latest=delay();s.pending.push(older,latest);
 const first=s.loadRunnerStoreState(),second=s.loadRunnerStoreState();
 latest.resolve({player:{selected_background:'aurora_sanctum',credits:280}});
 await second;
 older.resolve({player:{selected_background:'deep_space',credits:0}});
 await first;
 assert.equal(s.result.world,'aurora_sanctum','older response ignored');
 assert.equal(s.result.credits,280);
}
{
 const s=setup(),stale=delay();s.pending.push(stale);
 const first=s.loadRunnerStoreState();
 s.applyRunnerStoreMutation({player:{selected_background:'signal_storm',credits:640}});
 stale.reject(new Error('old request failed'));
 await first;
 assert.equal(s.status.textContent,'unchanged','stale error should not erase success');
}
{
 const s=setup(),recent=delay();s.pending.push(recent);
 const request=s.loadRunnerStoreState();
 recent.reject(new Error('offline'));await request;
 assert.equal(s.status.textContent,'storeError','current failures must be visible');
}
console.log('PASS: store read ordering, purchases override old responses, stale errors ignored');


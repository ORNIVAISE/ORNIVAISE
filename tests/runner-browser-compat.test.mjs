import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('signal-runner.html','utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
assert.ok(!html.includes(':has('),'critical visibility must not depend on :has');
assert.ok(!html.includes('AbortSignal.timeout('),'no unguarded modern timeout API');
assert.ok(html.includes('min-height:100vh;min-height:100svh'));
assert.ok(html.includes('@supports not (aspect-ratio:8/3)'));
assert.ok(html.includes("classList.toggle('boss-active',current)"));
const round=extract('function runnerRoundRect(','function drawRunnerObstacleGeometry(');
const getRound=new Function(round+';return runnerRoundRect')();
const path=[];const fallback=new Proxy({},{get:(_,key)=>key==='roundRect'?undefined:(...args)=>path.push([key,...args])});
getRound(fallback,1,2,20,10,8);
assert.equal(path.filter(x=>x[0]==='quadraticCurveTo').length,4);
assert.equal(path.at(-1)[0],'closePath');
assert.ok(path.flatMap(x=>x.slice(1)).every(Number.isFinite));
let native=0;getRound({roundRect(){native++}},1,2,20,10,3);assert.equal(native,1);
const fetchCode=extract('async function runnerFetchWithTimeout(','async function runnerApi(');
function timeoutFixture(Controller,network){
 const timers=new Map();let next=1;
 const api=new Function('fetch','AbortController','setTimeout','clearTimeout',fetchCode+';return runnerFetchWithTimeout')(network,Controller,(fn)=>{const id=next++;timers.set(id,fn);return id},id=>timers.delete(id));
 return {api,timers};
}
for(const controller of [AbortController,undefined]){
 const t=timeoutFixture(controller,async(url,opts)=>({status:200,hasSignal:!!opts.signal}));
 assert.equal((await t.api('/api/runner',{})).status,200);assert.equal(t.timers.size,0,'success clears timeout');
 const failed=timeoutFixture(controller,async()=>{throw Error('offline')});
 await assert.rejects(failed.api('/api/runner',{}),/offline/);assert.equal(failed.timers.size,0);
}
let captured;
const t=timeoutFixture(AbortController,async(url,opts)=>{captured=opts.signal;return new Promise(()=>{})});
const request=t.api('/api/runner',{});const rejected=assert.rejects(request,/network_timeout/);
[...t.timers.values()][0]();await rejected;assert.equal(captured.aborted,true);assert.equal(t.timers.size,0);
console.log('PASS compatibility: Canvas fallback/native, timeout without AbortSignal.timeout/AbortController, abort cleanup, visibility and CSS sizing fallbacks');

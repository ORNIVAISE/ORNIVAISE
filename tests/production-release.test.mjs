import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const home=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('signal-runner.html','utf8');
for(const [name,html]of [['index.html',home],['signal-runner.html',game]]){
 for(const [,src]of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(src);
 assert(!html.includes('noindex'));assert(!html.includes('/api/runner'));assert(!html.includes('ChatGPT'));assert(!html.includes('ПРИВАТНАЯ ВЕРСИЯ'));assert(!html.includes('ТЕСТОВЫЙ ПРОГРЕСС'));assert(!html.includes('beyond.html'));assert(!html.includes('/home.html'));
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^(?:https?:|mailto:|data:|\/|#)/.test(url))continue;assert(fs.existsSync(url),name+' missing '+url)}
}
assert(game.includes("connect-src https://fnomjabadilhfatharve.supabase.co;"));assert(game.includes("localStorage.getItem('ornivaise-runner-player-token')"));assert(game.includes('id="runnerCreateLink"'));assert(game.includes('id="runnerRedeemLink"'));assert(game.includes('runnerPractice?{run_id:newRunnerRunId()}'));assert(!game.includes("runnerApi('start_run',{training:"));assert(!game.includes("runnerApi('leaderboard')"));assert(!/sb_secret_|service_role|sk-[A-Za-z0-9]{20}/.test(game));
const src=game.slice(game.indexOf('async function runnerApi('),game.indexOf('// Obsolete state reads'));
let calls=[];const context={RUNNER_STORE_URL:'https://example.invalid/functions/v1/runner-store',RUNNER_SUPABASE_KEY:'publishable-test',runnerPlayerToken:()=> 'a'.repeat(64),runnerSyncStatus(){},document:{documentElement:{lang:'ru'}},runnerFetchWithTimeout:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({credits:10})}}};vm.createContext(context);vm.runInContext(src+';this.api=runnerApi',context);
await context.api('buy',{item_id:'frost_moon'});assert.equal(calls.length,1);let req=JSON.parse(calls[0].options.body);assert.equal(req.token,'a'.repeat(64));assert.equal(req.action,'buy');assert.equal(req.item_id,'frost_moon');assert.equal(req.request_id,undefined);assert.equal(calls[0].options.headers.apikey,'publishable-test');
context.runnerFetchWithTimeout=async()=>{calls.push({});return {ok:false,status:429,json:async()=>({error:'rate_limited'})}};await assert.rejects(()=>context.api('start_run'),/rate_limited/);assert.equal(calls.length,2,'failed mutation must not replay');
console.log('PASS production: public entry/assets/canonicals, no new game or private API, preserved device identity/linking, local-only training, live API contract and no mutation retries');

// Public entry and standalone-page contract.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../signal-runner.html',import.meta.url),'utf8');
for(const page of [home,game]){
 const ids=[...page.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'unique DOM IDs');
 for(const [,script]of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new Script(script);
}
assert.match(home,/<a href="signal-runner.html">ИГРА<\/a>/);
assert.match(home,/id="runnerTeaserPlay" href="signal-runner.html"/);
assert.doesNotMatch(home,/id="signalRunnerCanvas"|runnerApi|supabase\.co/);
for(const name of ['signalRunnerCanvas','runnerStorePanel','runnerProfilePanel','runnerPauseToggle','runnerFullscreen'])assert.ok(game.includes('id="'+name+'"'));
assert.doesNotMatch(game,/role="dialog"|aria-modal="true"/);
assert.match(game,/ornivaise-runner-player-token/);
assert.match(game,/<link rel="canonical" href="https:\/\/ornivaise.ru\/signal-runner.html">/);
console.log('PASS: separate game route, lightweight home, normal page semantics, profile identity and accessible controls');

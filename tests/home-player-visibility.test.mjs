import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/<div[^>]+id="globalPlayer"[^>]+hidden inert aria-hidden="true"/);
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const script of scripts)new vm.Script(script);
const main=scripts.find(s=>s.includes('const menuToggle=')).split('// v11 —')[0];
const preview=scripts.find(s=>s.includes("const audio=document.getElementById('audioShigurePreview')"));
function boot(demo=false){
 class Element{
  constructor(id){this.id=id;this.attrs={};this.handlers={};this.dataset={};this.value=0;this.textContent='';this.currentTime=0;this.duration=id==='audioShigurePreview'?25:163;this.paused=true;this.volume=.78;this.muted=false;this.hidden=false;this.inert=false;this.children=[];this.style={setProperty(){}};const c=new Set();this.classList={add:x=>c.add(x),remove:x=>c.delete(x),contains:x=>c.has(x),toggle:(x,force)=>{const on=force??!c.has(x);if(on)c.add(x);else c.delete(x);return on}}}
  setAttribute(k,v){this.attrs[k]=String(v)}removeAttribute(k){delete this.attrs[k]}
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn)}fire(k,e={}){for(const fn of this.handlers[k]||[])fn(e)}
  removeEventListener(k,fn){this.handlers[k]=(this.handlers[k]||[]).filter(x=>x!==fn)}
  load(){this.paused=true;queueMicrotask(()=>this.fire('loadedmetadata'))}
  querySelector(){return this.label??=new Element('label')}querySelectorAll(){return []}appendChild(n){this.children.push(n)}replaceChildren(...n){this.children=n}focus(){}
  pause(){const was=!this.paused;this.paused=true;if(was)this.fire('pause')}
  play(){if(this.fail)return Promise.reject(new Error('network'));this.paused=false;this.fire('play');return Promise.resolve()}
 }
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
 const button=new Element('full-track-button');button.dataset.track='signal001';
 const document=new Element('document');document.body=new Element('body');if(demo)document.body.classList.add('player-demo');document.documentElement={lang:'ru'};document.getElementById=get;document.querySelectorAll=s=>s==='[data-track]'?[button]:[];document.querySelector=()=>new Element('decoration');document.createElement=tag=>new Element(tag);document.createTextNode=x=>x;
 const player=get('globalPlayer');player.hidden=true;player.inert=true;player.setAttribute('aria-hidden','true');get('volumeRange').value=78;
 const context=vm.createContext({document,window:{matchMedia:()=>({matches:false,addEventListener(){}})},MutationObserver:class{observe(){}},fetch:async()=>({ok:true,blob:async()=>({size:1024})}),URL:{createObjectURL:()=> 'blob:test-audio'},console,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync('audio-transport.js','utf8'),context);
 vm.runInContext(fs.readFileSync('player-scrubbers.js','utf8'),context);
 vm.runInContext(main,context);vm.runInContext(preview,context);
 return {get,player,body:document.body,button};
}
const app=boot(),{get,player,body,button}=app;
assert.equal(player.hidden,true);assert.equal(player.inert,true);assert.equal(body.classList.contains('player-has-started'),false);
get('audioSignal').fail=true;button.fire('click');await new Promise(r=>setTimeout(r,0));assert.equal(player.hidden,true,'failed playback must not reveal player');assert.match(get('playerStatus').textContent,/Не удалось/);
get('audioSignal').fail=false;button.fire('click');assert.equal(player.hidden,true,'play may only mean buffering');get('audioSignal').fire('playing');assert.equal(player.hidden,false);assert.equal(player.inert,false);assert.equal(player.attrs['aria-hidden'],undefined);assert.equal(body.classList.contains('player-has-started'),true);
get('mainPlay').fire('click');assert.equal(get('audioSignal').paused,true);assert.equal(player.hidden,false,'pause must keep player');
get('gpSeek').fire('pointerdown');get('gpSeek').value=70;get('audioSignal').currentTime=2;get('audioSignal').fire('timeupdate');assert.equal(get('gpSeek').value,70,'playback updates must not move a thumb held by the user');get('gpSeek').fire('pointercancel');get('audioSignal').currentTime=0;
get('shigurePlay').fire('click');assert.equal(get('audioShigurePreview').paused,false,'preview must not pause itself');get('audioShigurePreview').fire('playing');assert.equal(get('playerTitle').textContent,'BEYOND THE HUSH');assert.equal(player.dataset.preview,'true');assert.equal(get('playerCover').src,'cover-beyond-the-hush.jpg');assert.equal(get('gpDuration').textContent,'00:25');
get('mainPlay').fire('click');assert.equal(get('audioShigurePreview').paused,true,'bottom control pauses selected preview');assert.equal(player.hidden,false);get('mainPlay').fire('click');assert.equal(get('audioShigurePreview').paused,false);
get('gpSeek').value=50;get('gpSeek').fire('input');await new Promise(r=>setTimeout(r,0));assert.equal(get('audioShigurePreview').currentTime,12.5);assert.equal(get('audioSignal').currentTime,0);
get('volumeRange').value=33;get('volumeRange').fire('input');assert.equal(get('audioShigurePreview').volume,.33);assert.equal(get('audioSignal').volume,.33);
button.fire('click');assert.equal(get('audioShigurePreview').paused,true);assert.equal(get('audioSignal').paused,false);assert.equal(get('playerTitle').textContent,'SIGNAL 001');assert.equal(player.dataset.preview,'false');
get('shigurePlay').fire('click');get('audioShigurePreview').paused=true;get('audioShigurePreview').fire('ended');assert.equal(get('audioShigurePreview').currentTime,0);assert.equal(get('audioSignal').paused,true,'preview ending must not auto-start full track');assert.equal(player.hidden,false);
get('nextBtn').fire('click');assert.equal(get('audioSignal').paused,false);assert.equal(get('playerTitle').textContent,'SIGNAL 001');
assert.equal(boot().player.hidden,true,'new page visit starts hidden');assert.equal(boot(true).player.hidden,false,'design review deliberately shows the player');
console.log('PASS home player: hidden entry, buffering/failure, first playing, persistent pause, preview identity/controls/seek/volume, end behavior and fresh entry');

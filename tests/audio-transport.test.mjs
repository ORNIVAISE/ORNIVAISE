import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../audio-transport.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(){
 const download=deferred(),status=[];let requests=0,allowed=true;
 class Media {
  constructor(){this.src='signal001.mp3';this.duration=163.56;this.paused=true;this.time=0;this.seeking=false;this.listeners={};this.plays=0;this.loads=0}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(x=>x!==fn)}
  emit(type){for(const fn of [...this.listeners[type]||[]])fn()}
  get currentTime(){return this.time}
  set currentTime(value){this.seeking=true;this.time=this.src.startsWith('blob:')?value:0;queueMicrotask(()=>{this.seeking=false;this.emit('seeked');this.emit('timeupdate')})}
  play(){this.plays++;this.paused=false;this.emit('play');return Promise.resolve()}
  pause(){if(!this.paused){this.paused=true;this.emit('pause')}}
  load(){this.loads++;this.time=0;this.paused=true;this.onLoad?.();queueMicrotask(()=>{this.emit('pause');this.emit('loadedmetadata')})}
 }
 const context=vm.createContext({fetch:()=>{requests++;return download.promise},URL:{createObjectURL:()=> 'blob:local-signal'},setTimeout,clearTimeout});
 vm.runInContext(source,context);
 const audio=new Media(),transport=context.createAudioTransport(audio,'signal001.mp3',{onStatus:m=>status.push(m),canPlay:()=>allowed});
 return{audio,transport,status,download,requests:()=>requests,allow:v=>{allowed=v},finish:()=>download.resolve({ok:true,blob:async()=>({size:6544469})})};
}
{
 const f=fixture();assert.equal(f.requests(),0,'entry must not download whole audio');
 await f.transport.play();assert.equal(f.requests(),1);assert.equal(f.audio.src,'signal001.mp3','normal playback starts immediately');
 f.audio.currentTime=81;await tick();assert.equal(f.audio.currentTime,0,'fixture reproduces a server without byte range support');
 const earlier=f.transport.seek(81),latest=f.transport.seek(122);
 f.audio.time=4;f.audio.emit('timeupdate');assert.equal(f.transport.position(),122,'old timeupdate must not overwrite requested position');
 f.finish();await Promise.all([earlier,latest]);await tick();
 assert.equal(f.audio.src,'blob:local-signal');assert.equal(f.audio.currentTime,122);assert.equal(f.audio.paused,false);assert.equal(f.audio.loads,1);assert.equal(f.requests(),1);
 assert.equal(f.transport.pending(),false);f.audio.time=123;f.audio.emit('timeupdate');assert.equal(f.transport.position(),123,'timeline advances after seek');
 f.transport.pause();await f.transport.seek(40);await tick();assert.equal(f.audio.currentTime,40);assert.equal(f.audio.paused,true,'seeking on pause must preserve pause');assert.equal(f.requests(),1);
 await f.transport.play();await f.transport.seek(75);await tick();assert.equal(f.audio.currentTime,75);assert.equal(f.audio.paused,false);assert.equal(f.audio.loads,1);
}
{
 const f=fixture();await f.transport.play();const seek=f.transport.seek(90);f.transport.pause();f.finish();await seek;await tick();assert.equal(f.audio.paused,true);assert.equal(f.audio.plays,1,'late download must not undo pause');assert.equal(f.audio.currentTime,90,'pause preserves requested position');
}
{
 const f=fixture();await f.transport.play();f.audio.onLoad=()=>f.transport.pause();const seek=f.transport.seek(72);f.finish();await seek;await tick();assert.equal(f.audio.paused,true);assert.equal(f.audio.currentTime,72,'pause during source installation must not reset position');assert.equal(f.audio.plays,1);
}
{
 const f=fixture();await f.transport.play();const seek=f.transport.seek(80);f.allow(false);f.transport.pause();f.finish();await seek;await tick();assert.equal(f.audio.paused,true);assert.equal(f.audio.plays,1,'switching track must prevent delayed restart');
}
{
 const f=fixture();const seek=f.transport.seek(50);f.finish();await seek;await tick();assert.equal(f.audio.currentTime,50);assert.equal(f.audio.paused,true,'preview can seek before its first play');assert.equal(f.audio.plays,0);
}
{
 const f=fixture();await f.transport.play();const seek=f.transport.seek(60);f.download.reject(new Error('offline'));await seek;assert.match(f.status.at(-1),/Не удалось перемотать/);assert.equal(f.audio.src,'signal001.mp3');assert.equal(f.audio.paused,false,'failed download must preserve streaming playback');assert.equal(f.transport.pending(),false);
}
console.log('PASS audio transport: range failure reproduction, no entry preload, immediate play, latest seek, stale updates, pause during load, track switches, cached paused seeks and download failure');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script);
for(const file of ['index.html','privacy.html','terms.html','rights.html']){
  const text=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.equal((text.match(/rel="canonical"/g)||[]).length,1,file+' canonical');
  assert.equal((text.match(/name="theme-color"/g)||[]).length,1,file+' theme color');
  assert.ok(text.includes('favicon-48x48.png'),file+' icon');
  for(const [,url] of text.matchAll(/(?:src|href)="([^"#]+)"/g)){
    if(/^(https?:|mailto:|\/)$/.test(url)||/^(https?:|mailto:)/.test(url))continue;
    assert.ok(fs.existsSync(new URL('../'+url.replace(/^\//,''),import.meta.url)),file+' missing '+url);
  }
}
class Element {
  constructor(id){this.id=id;this.attrs={};this.handlers={};this.style={setProperty(){}};this.dataset={};this.textContent='';this.value=0;this.paused=true;this.currentTime=0;this.duration=180;this.volume=.78;this.muted=false;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,force)=>{const on=force??!classes.has(x);if(on)classes.add(x);else classes.delete(x);return on;}};}
  setAttribute(k,v){this.attrs[k]=String(v)}
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn)}
  fire(k,e={}){for(const fn of this.handlers[k]||[])fn(e)}
  focus(){document.activeElement=this}
  querySelector(){return this.label??=new Element('label')}
  querySelectorAll(){return []}
  pause(){const wasPlaying=!this.paused;this.paused=true;if(wasPlaying)this.fire('pause')}
  play(){if(this.fail)return Promise.reject(new Error('network'));this.paused=false;this.fire('play');return Promise.resolve()}
}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
const buttons=['signal001','echo','fractured','afterimage'].map(id=>{const b=new Element(id);b.dataset.track=id;return b});
const navLink=new Element('nav-link');get('mainNav').querySelectorAll=()=>[navLink];get('volumeRange').value=78;
const document=new Element('document');document.getElementById=get;document.querySelectorAll=s=>s==='[data-track]'?buttons:[];document.querySelector=()=>new Element('decoration');document.body=new Element('body');
const window={matchMedia:()=>({matches:false,addEventListener(){}})};
const context=vm.createContext({document,window,console,setTimeout,clearTimeout});
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
vm.runInContext(script.slice(0,script.indexOf('// v11 —')),context);
get('menuToggle').fire('click');assert.equal(get('menuToggle').attrs['aria-expanded'],'true');
navLink.fire('click');assert.equal(get('menuToggle').attrs['aria-expanded'],'false');
get('menuToggle').fire('click');document.fire('keydown',{key:'Escape'});assert.equal(get('menuToggle').attrs['aria-expanded'],'false');assert.equal(document.activeElement,get('menuToggle'));
buttons[0].fire('click');assert.equal(get('audioSignal').paused,false);assert.equal(get('mainPlay').attrs['aria-label'],'Пауза');
get('audioEcho').duration=213;get('audioEcho').currentTime=30;
get('nextBtn').fire('click');assert.equal(get('audioSignal').paused,true);assert.equal(get('audioEcho').paused,false);assert.equal(get('gpDuration').textContent,'03:33');assert.equal(get('gpCurrent').textContent,'00:30');assert.ok(Number(get('gpSeek').value)>14);
get('mainPlay').fire('click');assert.equal(get('audioEcho').paused,true);assert.equal(get('mainPlay').attrs['aria-label'],'Включить');
get('volumeBtn').fire('click');assert.equal(get('volumeBtn').attrs['aria-label'],'Включить звук');get('volumeBtn').fire('click');assert.equal(get('volumeBtn').attrs['aria-label'],'Выключить звук');
get('audioEcho').fail=true;get('mainPlay').fire('click');await new Promise(resolve=>setTimeout(resolve,0));assert.match(get('playerStatus').textContent,/Не удалось/);
vm.runInContext(script.slice(script.indexOf('const easterHotspot='),script.indexOf('/* =========================================================')),context);
get('easterHotspot').fire('click');assert.equal(get('easterOverlay').classList.contains('open'),false);get('easterHotspot').fire('click');assert.equal(get('easterOverlay').attrs['aria-hidden'],'false');assert.equal(document.activeElement,get('easterClose'));
let trapped=false;get('easterOverlay').onkeydown({key:'Tab',preventDefault(){trapped=true}});assert.ok(trapped);
document.fire('keydown',{key:'Escape'});assert.equal(get('easterOverlay').attrs['aria-hidden'],'true');assert.equal(document.activeElement,get('easterHotspot'));
assert.equal((html.match(/id="easterHotspot"/g)||[]).length,1);assert.ok(html.includes('class="hero-copy-accessible"'));assert.ok(html.includes('if(reduced || document.hidden || activeAudio().paused)'));
console.log('PASS: metadata, local links, script syntax, menu, exclusive playback, seeking state, mute, errors, double-click Easter egg and focus return.');

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
class Element {
 constructor(){this.handlers={};this.dataset={};this.value=0;this.textContent='';this.hidden=false;this.properties={};this.style={setProperty:(k,v)=>this.properties[k]=v};const names=new Set();this.classList={add:k=>names.add(k),remove:k=>names.delete(k),contains:k=>names.has(k),toggle:(k,on)=>on?names.add(k):names.delete(k)}}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
 fire(type,event={}){for(const fn of this.handlers[type]||[])fn(event)}
 getBoundingClientRect(){return{left:100,width:228}}
}
const input=new Element(),readout=new Element(),root=new Element(),doc=new Element();
input.dataset={audioId:'full',duration:'163.56'};
const full=new Element(),preview=new Element();full.dataset.audioId='full';preview.dataset.audioId='preview';
const fullBars=Array.from({length:10},()=>new Element()),previewBars=Array.from({length:10},()=>new Element());
full.querySelectorAll=()=>fullBars;preview.querySelectorAll=()=>previewBars;
root.querySelector=s=>s.startsWith('input')?input:readout;root.querySelectorAll=()=>[full,preview];
doc.querySelectorAll=()=>[root];doc.getElementById=id=>({duration:id==='full'?163.56:25});
const context=vm.createContext({document:doc});
vm.runInContext(fs.readFileSync(new URL('../player-scrubbers.js',import.meta.url),'utf8'),context);
assert.equal(root.classList.contains('is-ready'),true);assert.equal(full.hidden,false);assert.equal(preview.hidden,true);
assert.equal(context.scrubberRatio(114,100,228),0);assert.equal(context.scrubberRatio(214,100,228),.5);assert.equal(context.scrubberRatio(314,100,228),1);assert.equal(context.scrubberRatio(-20,100,228),0);assert.equal(context.scrubberRatio(600,100,228),1);
input.fire('pointermove',{pointerType:'mouse',clientX:214});assert.equal(readout.textContent,'01:21');assert.equal(input.value,0,'hover must not seek');
input.value=75;input.fire('focus');assert.equal(readout.textContent,'02:02','keyboard focus shows the selected time');assert.equal(root.classList.contains('is-focused'),true);
input.fire('pointerdown');input.value=50;input.fire('input');assert.equal(readout.textContent,'01:21');assert.equal(root.properties['--progress'],'50%');assert.equal(fullBars.filter(x=>x.classList.contains('active')).length,5);
doc.fire('pointercancel');assert.equal(root.classList.contains('is-dragging'),false);assert.equal(root.classList.contains('is-focused'),false);assert.equal(root.classList.contains('is-hovered'),false);input.fire('keydown',{key:'ArrowRight'});assert.equal(root.classList.contains('is-focused'),true);input.fire('keyup');assert.equal(root.classList.contains('is-focused'),false);input.fire('blur');assert.equal(root.classList.contains('is-focused'),false);
input.dataset.audioId='preview';input.value=40;context.paintMediaScrubber(input);assert.equal(readout.textContent,'00:10');assert.equal(full.hidden,true);assert.equal(preview.hidden,false,'waveform follows selected audio');
input.fire('pointerleave');input.fire('pointermove',{pointerType:'touch',clientX:314});assert.equal(root.classList.contains('is-hovered'),false,'touch must not latch a hover hint');
console.log('PASS scrubber: native thumb geometry, hover without seeking, keyboard time, dragging/cancel, selected waveform and touch hints');

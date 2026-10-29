function scrubberRatio(clientX,left,width){
  return Math.max(0,Math.min(1,(clientX-left-14)/Math.max(1,width-28)));
}
const signalScrubbers=new WeakMap();
function paintMediaScrubber(input){signalScrubbers.get(input)?.paint()}
document.querySelectorAll('.signal-scrubber').forEach(root=>{
  const input=root.querySelector('input[type=range]'),readout=root.querySelector('.scrubber-readout');
  if(!input||!readout)return;
  const waves=[...root.querySelectorAll('.scrubber-wave')].map(wave=>({wave,bars:[...wave.querySelectorAll('span')]}));
  let hovered=false,dragging=false,hint=0;
  const progress=()=>Math.max(0,Math.min(100,Number(input.value)||0));
  function duration(){const audio=document.getElementById(input.dataset.audioId);return Number.isFinite(audio?.duration)&&audio.duration>0?audio.duration:Number(input.dataset.duration)||0}
  function paint(){
    const value=progress(),position=(hovered&&!dragging)?hint:value;
    root.style.setProperty('--progress',value+'%');root.style.setProperty('--hint-position',position+'%');
    const seconds=Math.floor(duration()*position/100);
    readout.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    waves.forEach(({wave,bars})=>{
      wave.hidden=!!wave.dataset.audioId&&wave.dataset.audioId!==input.dataset.audioId;
      const active=Math.round(value/100*bars.length);bars.forEach((bar,i)=>bar.classList.toggle('active',i<active));
    });
  }
  function pointer(event){if(event.pointerType==='touch')return;const r=input.getBoundingClientRect();hint=scrubberRatio(event.clientX,r.left,r.width)*100;hovered=true;root.classList.add('is-hovered');paint()}
  function finish(){dragging=false;hovered=false;root.classList.remove('is-dragging');root.classList.remove('is-hovered');root.classList.remove('is-focused');paint()}
  input.addEventListener('pointermove',pointer);
  input.addEventListener('pointerenter',pointer);
  input.addEventListener('pointerleave',()=>{hovered=false;root.classList.remove('is-hovered');paint()});
  input.addEventListener('pointerdown',()=>{dragging=true;root.classList.add('is-dragging');paint()});
  input.addEventListener('input',paint);
  input.addEventListener('focus',()=>{hovered=false;root.classList.add('is-focused');paint()});
  input.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){hovered=false;root.classList.add('is-focused');paint()}});
  input.addEventListener('keyup',()=>{root.classList.remove('is-focused');paint()});
  input.addEventListener('blur',()=>{root.classList.remove('is-focused');finish()});
  input.addEventListener('change',finish);
  document.addEventListener('pointerup',finish);
  document.addEventListener('pointercancel',finish);
  signalScrubbers.set(input,{paint});paint();root.classList.add('is-ready');
});

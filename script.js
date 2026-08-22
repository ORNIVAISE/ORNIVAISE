const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const heroPlay = document.getElementById('heroPlay');
const seek = document.getElementById('seek');
const timeLabel = document.getElementById('timeLabel');
const muteToggle = document.getElementById('muteToggle');

const fmt = s => {
  if (!Number.isFinite(s)) return '00:00';
  const m = Math.floor(s/60); const sec = Math.floor(s%60);
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};
function syncPlay(){
  const playing = !audio.paused;
  playBtn.textContent = playing ? 'Ⅱ' : '▶';
  heroPlay.textContent = playing ? 'Ⅱ ПАУЗА SIGNAL 001' : '▶ СЛУШАТЬ SIGNAL 001';
}
function togglePlay(){ audio.paused ? audio.play() : audio.pause(); }
playBtn.addEventListener('click', togglePlay);
heroPlay.addEventListener('click', togglePlay);
audio.addEventListener('play', syncPlay); audio.addEventListener('pause', syncPlay);
audio.addEventListener('loadedmetadata',()=>{timeLabel.textContent=`00:00 / ${fmt(audio.duration)}`});
audio.addEventListener('timeupdate',()=>{
  if(audio.duration){seek.value=(audio.currentTime/audio.duration)*100; timeLabel.textContent=`${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;}
});
seek.addEventListener('input',()=>{if(audio.duration) audio.currentTime=(seek.value/100)*audio.duration});
muteToggle.addEventListener('click',()=>{audio.muted=!audio.muted; muteToggle.textContent=audio.muted?'×':'◼'});

document.querySelectorAll('[data-platform]').forEach(btn=>btn.addEventListener('click',e=>{if(btn.getAttribute('href')==='#'){e.preventDefault();alert('После публикации релиза сюда вставляется прямая ссылка на площадку.')}}));

const io = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

window.addEventListener('load',()=>{
  setTimeout(()=>document.getElementById('boot').classList.add('hide'),1050);
  const title=document.querySelector('.hero-title');
  setInterval(()=>{title.classList.add('is-glitching');setTimeout(()=>title.classList.remove('is-glitching'),180)},5500);
});

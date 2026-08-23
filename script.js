
const audio = document.getElementById('audio');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const heroListen = document.getElementById('heroListen');
const seek = document.getElementById('seek');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const muteBtn = document.getElementById('muteBtn');

function fmt(sec){
  if(!isFinite(sec)) return '00:00';
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function setPlayState(playing){
  playIcon.textContent = playing ? '❚❚' : '▶';
}

playBtn.addEventListener('click', async () => {
  if(audio.paused){
    try{ await audio.play(); setPlayState(true);}catch(e){}
  } else {
    audio.pause(); setPlayState(false);
  }
});

heroListen.addEventListener('click', async () => {
  document.getElementById('music').scrollIntoView({behavior:'smooth'});
  setTimeout(async () => {
    try{ await audio.play(); setPlayState(true);}catch(e){}
  }, 450);
});

audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = fmt(audio.duration);
});

audio.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = fmt(audio.currentTime);
  if(audio.duration){
    seek.value = (audio.currentTime / audio.duration) * 100;
  }
});

audio.addEventListener('ended', () => setPlayState(false));
seek.addEventListener('input', () => {
  if(audio.duration){
    audio.currentTime = (seek.value / 100) * audio.duration;
  }
});
muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  muteBtn.textContent = audio.muted ? '🔇' : '🔊';
});

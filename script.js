const boot=document.getElementById('boot');window.addEventListener('load',()=>setTimeout(()=>boot.classList.add('hide'),650));
const audio=document.getElementById('audio');const status=document.getElementById('audioStatus');
audio.addEventListener('loadedmetadata',()=>{status.textContent=`SIGNAL 001 · ${Math.floor(audio.duration/60)}:${String(Math.floor(audio.duration%60)).padStart(2,'0')} · AUDIO READY`});
audio.addEventListener('error',()=>{status.textContent='AUDIO ERROR — проверьте, что signal001.mp3 загружен в корень репозитория';status.style.color='#ffb0b0'});
document.getElementById('jumpPlay').addEventListener('click',async()=>{document.getElementById('music').scrollIntoView({behavior:'smooth'});try{await audio.play()}catch(e){status.textContent='Нажмите ▶ в плеере — браузер заблокировал автозапуск';}});
document.querySelectorAll('.soon').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));

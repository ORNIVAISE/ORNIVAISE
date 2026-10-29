// Keep a local media source for reliable seeking when hosting ignores byte ranges.
// Files are fetched only after playback or an explicit seek, never on page entry.
function createAudioTransport(audio, source, {onChange=()=>{}, onStatus=()=>{}, canPlay=()=>true}={}) {
  let blobPromise, localURL, installed=false, installing, pending=null, request=0;
  let wantsPlayback=false;
  const duration=()=>Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0;
  const clamp=seconds=>Math.max(0,Math.min(duration()||seconds,Number(seconds)||0));
  function localSource(){
    if(localURL)return Promise.resolve(localURL);
    if(!blobPromise)blobPromise=fetch(source,{credentials:'same-origin',cache:'force-cache'})
      .then(response=>{if(!response.ok)throw new Error('media download');return response.blob()})
      .then(blob=>{if(!blob.size)throw new Error('empty media');localURL=URL.createObjectURL(blob);return localURL})
      .catch(error=>{blobPromise=null;throw error});
    return blobPromise;
  }
  function warm(){localSource().catch(()=>{});}
  function install(url){
    if(installed)return Promise.resolve();
    if(installing)return installing;
    installing=new Promise((resolve,reject)=>{
      const clean=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',failed)};
      const ready=()=>{clean();installed=true;resolve()};
      const failed=()=>{clean();reject(new Error('media metadata'))};
      const timer=setTimeout(failed,15000);
      audio.addEventListener('loadedmetadata',ready);
      audio.addEventListener('error',failed);
      audio.src=url;audio.load();
    }).finally(()=>{installing=null});
    return installing;
  }
  audio.addEventListener('play',()=>{wantsPlayback=true;warm()});
  audio.addEventListener('pause',()=>{if(!installing){wantsPlayback=false;if(pending===null)onStatus('');onChange()}});
  audio.addEventListener('ended',()=>{wantsPlayback=false;pending=null;onChange()});
  audio.addEventListener('seeked',()=>{if(!installing&&pending!==null&&Math.abs(audio.currentTime-pending)<.2){pending=null;onStatus('');onChange()}});
  audio.addEventListener('timeupdate',()=>{if(installed&&!installing&&!audio.seeking&&pending!==null&&Math.abs(audio.currentTime-pending)<.3){pending=null;onStatus('');onChange()}});
  return {
    position:()=>pending===null?audio.currentTime:pending,
    pending:()=>pending!==null,
    isPlaying:()=>wantsPlayback||!audio.paused,
    play(){
      wantsPlayback=true;warm();
      const start=()=>{if(wantsPlayback&&canPlay())return audio.play()};
      return Promise.resolve(installing?installing.then(start):start()).catch(error=>{wantsPlayback=false;onChange();throw error});
    },
    pause(){wantsPlayback=false;if(pending===null)onStatus('');audio.pause();onChange()},
    async seek(seconds){
      const ticket=++request;pending=clamp(seconds);onChange();
      if(!installed)onStatus('Подготавливаем перемотку…');
      try {
        const url=await localSource();
        if(ticket!==request)return;
        await install(url);
        if(ticket!==request)return;
        pending=clamp(seconds);audio.currentTime=pending;
        onStatus('');onChange();
        if(wantsPlayback&&canPlay())await audio.play();
      } catch(error){
        if(ticket!==request)return;
        pending=null;if(audio.paused)wantsPlayback=false;onStatus('Не удалось перемотать. Проверьте соединение и повторите попытку.');onChange();
      }
    }
  };
}

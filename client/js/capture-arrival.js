import { audioManager } from './audio.js';
import { captureApproach } from './capture-approach.js';
export function createCaptureArrival(host){
  const card=document.createElement('section');card.className='capture-arrival';card.setAttribute('aria-label','Capture approach indicator');
  card.innerHTML='<span class="capture-arrival-dot" aria-hidden="true"></span><div><strong></strong><p></p><progress max="100" value="0" aria-label="Approach to predicted capture window"></progress><span class="capture-arrival-announcement" role="status" aria-live="polite"></span></div>';
  host.append(card);
  let previous='',timer=null,last=null,disposed=false;
  const stop=()=>{clearTimeout(timer);timer=null;};
  function pulse(){
    timer=null;
    if(disposed||document.hidden||!last?.playing||!last.cue.beat)return;
    audioManager.playCaptureBeat(last.cue.phase==='ready');
    timer=setTimeout(pulse,last.cue.beat);
  }
  const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);
  return {pause(){stop();if(last)last.playing=false;},update(input){
    if(disposed)return;
    const cue=captureApproach(input);last={cue,playing:input.playing};
    card.dataset.phase=cue.phase;card.style.setProperty('--capture-beat',`${cue.beat||1400}ms`);
    card.querySelector('strong').textContent=cue.title;card.querySelector('p').textContent=cue.detail;card.querySelector('progress').value=cue.progress;
    card.classList.toggle('is-beating',Boolean(cue.beat)&&(input.playing||['align','ready'].includes(cue.phase)));
    if(previous!==cue.phase){
      stop();card.querySelector('[role=status]').textContent=cue.title;
      if(['align','ready'].includes(cue.phase))audioManager.playCaptureBeat(cue.phase==='ready');
      previous=cue.phase;
    }
    if(!input.playing||!cue.beat||document.hidden)stop();else if(!timer)timer=setTimeout(pulse,cue.beat);
  },dispose(){disposed=true;stop();document.removeEventListener('visibilitychange',hide);card.remove();}};
}

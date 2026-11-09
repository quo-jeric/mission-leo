import { read, write, SAVE_KEY } from './storage.js';
import { evaluateMission, missionInputKey } from './engineering.js';
import { urbanMission } from './data/mission-config.js';
import { createFlight } from './orbit-engine.js';
import { createTargetCamera } from './target-camera.js';
import { createCaptureArrival } from './capture-arrival.js';
import { completeMission, nextMission } from './progression.js';

let panel, flight, view, instrument, arrival, timer, plan, catalog, lastSave=0, busy=false, practice=false, lastResult='', mapSelection='target';
let lastStage=null;
const $=id=>panel.querySelector(`#orbit-${id}`);
const utc=t=>new Date(t*1000).toISOString().replace('T',' ').slice(0,19)+' UTC';
const completionPrompts=new Set();
function build() {
  panel=document.createElement('section');panel.id='orbital-operations';panel.className='mission-control';panel.hidden=true;panel.setAttribute('aria-labelledby','orbit-title');
  panel.innerHTML=`<header><div><p class="eyebrow">MISSION CONTROL / URBAN MAPPING</p><h1 id="orbit-title" tabindex="-1">Your satellite is in orbit.</h1></div><button id="orbit-back">Save & return to workshop</button></header>
  <div class="orbit-layout"><section class="orbit-world"><div class="orbit-world-heading"><span>EARTH / LIVE ORBIT</span><span id="orbit-light"></span></div><div id="orbit-canvas"><p id="orbit-graphics">Preparing 3D Earth…</p></div><div class="orbit-world-tools"><span>Drag to rotate · scroll to zoom · satellite enlarged</span><button id="orbit-reset">Reset view</button></div></section>
  <aside><p class="eyebrow">FLIGHT TELEMETRY</p><p id="orbit-clock"></p><div id="orbit-metrics"></div><h2>Mission objectives</h2><ol><li id="orbit-objective-image">Capture the sunlit Singapore target at ≤3 m GSD.</li><li id="orbit-objective-data">Deliver the complete image via Singapore S-band.</li></ol><p id="orbit-access"></p><button id="orbit-capture">Capture target image</button><button id="orbit-downlink">Enable downlink</button><p id="orbit-contact"></p><p id="orbit-status" role="status"></p></aside></div>
  <footer><div class="orbit-time"><button id="orbit-pause">Play</button><label>Speed <select id="orbit-speed"><option value="1">1×</option><option value="10">10×</option><option value="100" selected>100×</option><option value="1000">1000×</option></select></label><button id="orbit-next">Advance to next opportunity →</button></div><p id="orbit-next-label"></p></footer>
  <details class="orbit-model"><summary>Simulation model & limits</summary><p>Seven-day J2 trajectory sampled every 10 s; battery and downlink integrated in steps of at most 1 s. Ideal radio throughput within sampled station windows. Optical capture is a 2 s exposure-energy approximation: sun elevation ≥10°, off-nadir ≤30°, conservative GSD penalty and instantaneous ADCS pointing. No clouds, slew duration or temperature integration. Workshop thermal checks remain capacity screens. Timeline jumps integrate resources; they do not skip battery usage. Pausing or leaving stops simulated time.</p></details>`;
  document.body.append(panel);
  const progress=document.createElement('div');progress.id='orbit-mission-flow';progress.className='mission-flow';
  progress.innerHTML='<ol aria-label="Mission steps"><li>Travel</li><li>Aim</li><li>Capture</li><li>Downlink</li><li>Complete</li></ol><p id="orbit-step-hint" role="status"></p>';
  panel.querySelector('header > div').append(progress);
  const delivery=document.createElement('section');delivery.id='orbit-delivery';
  delivery.innerHTML='<h2>Send image to Earth</h2><p id="orbit-delivery-state" role="status"></p><label id="orbit-delivery-progress-label" for="orbit-delivery-progress">Image delivery</label><progress id="orbit-delivery-progress" max="100" value="0"></progress><p id="orbit-delivery-detail"></p>';
  $('downlink').before(delivery);delivery.append($('downlink'),$('contact'));
  const stationJump=document.createElement('button');stationJump.id='orbit-delivery-jump';stationJump.textContent='Go to next station pass →';delivery.append(stationJump);
  stationJump.onclick=()=>{pause();const next=flight.opportunity('station');if(flight.state.status!=='IN_ORBIT'||!flight.state.captured||!next)return;flight.advance(next.time-flight.state.time);checkpoint();if(flight.state.status==='IN_ORBIT'&&flight.state.downlink)startPlayback();render();};
  const planner=document.createElement('section');planner.id='orbit-map-planner';planner.hidden=true;
  planner.innerHTML='<p class="eyebrow">EARTH / PASS PLANNER</p><div role="group" aria-label="Map destination"><button id="orbit-map-target">◇ Target</button><button id="orbit-map-station">◎ Station</button></div><h2 id="orbit-map-title" tabindex="-1"></h2><p id="orbit-map-countdown" role="status"></p><p id="orbit-map-detail"></p><button id="orbit-map-advance">Advance to pass →</button><p class="map-note">Target and station share Singapore coordinates. Gold center = target; cyan ring = station. You can also select them using these buttons.</p>';
  panel.querySelector('aside').prepend(planner);
  for(const kind of ['target','station'])$(`map-${kind}`).onclick=()=>selectMapDestination(kind);
  $('map-advance').onclick=()=>{
    pause();if(flight.state.status!=='IN_ORBIT')return;
    const next=flight.opportunity(mapSelection);if(!next)return;
    flight.advance(next.time-flight.state.time);checkpoint();render();
    if(mapSelection==='target'&&flight.state.status==='IN_ORBIT'&&flight.access().available)$('camera-target').click();
  };
  const waiting=document.createElement('div');waiting.id='orbit-camera-waiting';waiting.hidden=true;
  waiting.innerHTML='<section class="orbit-arrival-card" aria-labelledby="orbit-camera-wait-title"><h2 id="orbit-camera-wait-title"></h2><p id="orbit-camera-wait-countdown"></p><p id="orbit-camera-wait-distance"></p><p id="orbit-camera-wait-help"></p><p id="orbit-camera-wait-playback" role="status"></p><button id="orbit-camera-wait-action">Go to imaging window →</button></section>';
  $('canvas').append(waiting);
  $('camera-wait-action').onclick=()=>{
    if(flight.state.status!=='IN_ORBIT'||(!flight.access().available&&!flight.opportunity('target'))){$('replay').click();$('camera-target').click();return;}
    if(!flight.access().available)$('next').click();
    if(flight.access().available&&!flight.state.captured){const a=flight.aiming();flight.setAim(a.aimXDeg+.3,a.aimYDeg+.2);checkpoint();}
    $('camera-target').click();render();
  };
  const cameraControls=document.createElement('div');cameraControls.id='orbit-camera-controls';cameraControls.hidden=true;
  cameraControls.innerHTML='<label><input id="orbit-aim-auto" type="checkbox"> Auto-point assist</label>';
  cameraControls.prepend($('capture'));
  panel.querySelector('.orbit-world-tools').before(cameraControls);
  // Keep one authoritative readiness message beside the camera's shutter action.
  $('access').remove();
  $('aim-auto').onchange=()=>{if($('aim-auto').checked)flight.state.aimMode='auto';else{const a=flight.aiming();flight.setAim(a.xDeg,a.yDeg);}checkpoint();render();};
  const playbackStatus=document.createElement('p');playbackStatus.id='orbit-playback-status';playbackStatus.setAttribute('role','status');
  const replay=document.createElement('button');replay.id='orbit-replay';replay.textContent='Mission replay · free';replay.hidden=true;
  panel.querySelector('.orbit-time').append(replay);
  panel.querySelector('footer').append(playbackStatus);
  const result=document.createElement('section');result.id='orbit-result';result.hidden=true;result.setAttribute('aria-labelledby','orbit-result-title');
  result.innerHTML='<p class="eyebrow" id="orbit-result-mode"></p><h2 id="orbit-result-title" tabindex="-1"></h2><p id="orbit-result-reason"></p><dl id="orbit-result-stats"></dl><div class="orbit-result-actions"><button id="orbit-result-replay">Replay for free</button><button id="orbit-result-workshop">Workshop</button><button id="orbit-result-next">Next mission →</button></div><p id="orbit-result-hint"></p>';
  panel.querySelector('aside').prepend(result);
  $('result-replay').onclick=()=>replay.click();
  const completeDialog=document.createElement('dialog');completeDialog.id='orbit-complete-dialog';completeDialog.setAttribute('aria-labelledby','orbit-complete-title');
  completeDialog.innerHTML='<h2 id="orbit-complete-title">Mission complete!</h2><p>The full image has been delivered. Continue to the next mission or try again for free.</p><div class="orbit-result-actions"><button id="orbit-complete-next">Next mission →</button><button id="orbit-complete-yes">Yes, try again for free</button><button id="orbit-complete-no">View results</button></div>';
  panel.append(completeDialog);
  $('complete-yes').onclick=()=>{completeDialog.close();replay.click();};
  $('complete-no').onclick=()=>{completeDialog.close();$('result-title').focus({preventScroll:true});};
  $('complete-next').onclick=()=>{completeDialog.close();$('result-next').click();};
  $('result-workshop').onclick=()=>$('back').click();
  $('result-next').onclick=async()=>{
    const next=nextMission(read(SAVE_KEY),plan.missionId||'urban');
    if(!next)return;
    $('back').click();
    if(!panel.hidden)return;
    document.querySelector('#hangar-back').click();
    const {openMissionBrief}=await import('./missions.js');
    openMissionBrief(next.id);
  };
  replay.onclick=()=>{
    pause();
    const candidate=createFlight(plan,catalog,{points:flight.points},flight.passes);
    candidate.state.id=`practice-${Date.now()}`;
    const save=read(SAVE_KEY)||{};
    save.orbitalPractice={id:candidate.state.id,plan,state:{...candidate.state}};
    if(!write(SAVE_KEY,save)){$('status').textContent='Could not save mission replay. Please retry.';return;}
    practice=true;flight=candidate;
    $('status').textContent='Free mission replay started. Agency funds and campaign progress are unchanged.';
    render();
    $('pause').focus();
  };
  const modes=document.createElement('div');modes.className='orbit-camera-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Orbit camera view');
  for(const [mode,label] of [['follow','Follow satellite'],['overview','Earth overview'],['target','Target camera']]){
    const button=document.createElement('button');button.id=`orbit-camera-${mode}`;button.textContent=label;button.setAttribute('aria-pressed',String(mode==='follow'));
    button.onclick=()=>{instrument?.active(mode==='target');panel.querySelector('.orbit-world-tools > span').textContent=mode==='target'?'Drag terrain, click or use arrow keys to aim · white square = sensor footprint':mode==='overview'?'Click the gold target or cyan station ring · drag to rotate':'Drag to rotate · scroll to zoom · satellite enlarged';if(mode!=='target')view?.setMode(mode);for(const option of modes.children)option.setAttribute('aria-pressed',String(option===button));panel.querySelector('.orbit-world-heading > span').textContent=mode==='target'?'INSTRUMENT / TARGET CAMERA':mode==='follow'?'FOLLOW / LAUNCHED BUILD':'EARTH / LIVE ORBIT';render();};
    modes.append(button);
  }
  panel.querySelector('.orbit-world-heading').insertBefore(modes,$('light'));
  // Same visual hierarchy and action placement as the multi-region missions.
  for(const [selector,className] of [['.orbit-layout','mission-layout'],['.orbit-world','mission-world'],['.orbit-world-heading','mission-world-heading'],['#orbit-canvas','mission-canvas'],['#orbit-camera-controls','mission-target-controls'],['.orbit-time','mission-time-controls'],['aside','mission-sidebar']])panel.querySelector(selector).classList.add(className);
  cameraControls.hidden=false;
  const targetLabel=document.createElement('label');targetLabel.className='mission-target-picker';targetLabel.innerHTML='Observation target<select aria-label="Observation target" disabled><option>Singapore test area</option></select>';cameraControls.prepend(targetLabel);
  cameraControls.append($('downlink'),stationJump);
  const guidance=document.createElement('div');guidance.className='mission-guidance';guidance.innerHTML='<strong id="orbit-stage-label">Travel</strong>';guidance.append($('step-hint'));cameraControls.before(guidance);
  const footer=panel.querySelector('footer');footer.classList.add('mission-dock');
  footer.querySelector('.orbit-time').append($('reset'),$('clock'));panel.querySelector('.orbit-world').append(footer);
  const notes=document.createElement('div');notes.className='mission-flight-note';notes.append($('next-label'),$('playback-status'));footer.after(notes);
  panel.querySelector('.orbit-world-tools').classList.add('mission-view-help');
  const installed=document.createElement('details');installed.className='orbit-installed';installed.innerHTML='<summary>Launched components</summary><ul id="orbit-installed"></ul>';
  panel.querySelector('aside').append(installed);
  $('back').onclick=()=>{pause();if(!checkpoint())return;panel.hidden=true;document.body.classList.remove('orbiting');document.querySelector('.space').inert=false;document.querySelector('#hangar').inert=false;view?.dispose();view=null;instrument?.dispose();instrument=null;arrival?.dispose();arrival=null;document.querySelector('#hangar-review').focus();};
  $('pause').onclick=()=>{if(timer)pause();else startPlayback();render();};
  $('capture').onclick=()=>{if($('camera-target').getAttribute('aria-pressed')!=='true'){$('camera-target').click();render();return;}const captured=flight.capture();if(captured&&instrument?.captureSource()){flight.state.captureFrame.version=3;flight.state.captureFrame.imageryId=instrument.captureSource();}if(captured)$('status').textContent=`Image captured · quality ${flight.state.captureScore}/100${flight.state.captureAimMode==='auto'?' (assisted)':''}. Select Send image to Earth for the next station pass.`;checkpoint();render();if(captured)instrument?.flash();};
  $('downlink').onclick=()=>{if(flight.state.status!=='IN_ORBIT'||!flight.state.captured)return;if(flight.state.downlink&&timer){flight.state.downlink=false;pause();}else{flight.state.downlink=true;flight.state.deliveryStarted=true;startPlayback();}checkpoint();render();};
  $('next').onclick=()=>{pause();const next=flight.nextEvent();if(next!==null){flight.advance(next-flight.state.time);checkpoint();render();}};
  $('reset').onclick=()=>{if($('camera-target').getAttribute('aria-pressed')==='true')instrument?.resetZoom();else view?.reset();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!panel.hidden){pause();checkpoint();render();}});
  window.addEventListener('pagehide',()=>{if(!panel.hidden){pause();checkpoint();view?.dispose();view=null;instrument?.dispose();instrument=null;arrival?.dispose();arrival=null;}});
}
function pause(){clearInterval(timer);timer=null;arrival?.pause();if(panel)$('pause').textContent='Play';}
function startPlayback(){
  if(timer||flight.state.status!=='IN_ORBIT')return;
  let previous=performance.now();
  timer=setInterval(()=>{const now=performance.now();const seconds=Math.min((now-previous)/1000,.5)*Number($('speed').value);previous=now;if(document.hidden)return;advancePlayback(seconds);if(flight.state.status!=='IN_ORBIT'||now-lastSave>5000){checkpoint();lastSave=now;}render();},100);
  $('pause').textContent='Pause';
}
function advancePlayback(seconds){
  const before=flight.access().available;
  const next=!before&&!flight.state.captured?flight.nextEvent():null;
  const reachesTarget=next!==null&&next<=flight.state.time+seconds;
  flight.advance(reachesTarget?next-flight.state.time:seconds);
  if(reachesTarget&&flight.state.status==='IN_ORBIT'&&flight.access().available){pause();$('speed').value='1';$('status').textContent='Imaging window reached. Time paused: align the crosshair, then capture. Play at 1× to track the moving target.';}
}
function checkpoint(){
  let save=read(SAVE_KEY)||{};
  const key=practice?'orbitalPractice':'orbitalFlight';
  const existing=save[key];
  if(!existing||existing.id!==flight.state.id){pause();$('status').textContent='Saved flight changed in another tab. Return and reload before continuing.';return false;}
  save[key]={...existing,state:{...flight.state}};
  save=completeMission(save,{missionId:plan.missionId||'urban',...flight.state,totalMB:plan.metrics.imageMB,completedAt:utc(flight.state.time),replay:practice});
  const ok=write(SAVE_KEY,save);
  if(!ok){pause();$('status').textContent='Device save failed. Keep this page open and retry Save & return.';}
  if(ok)window.dispatchEvent(new Event('mission-saved'));
  return ok;
}
function render(){
  const s=flight.state,p=flight.current(),access=flight.access(),contact=flight.contact();
  panel.dataset.flightStatus=s.status;
  $('title').textContent=s.status==='COMPLETE'?(practice?'Mission Replay complete':'Urban Mapping complete'):practice?'Mission Replay · your launched build':'Your satellite is in orbit.';
  $('camera-target').textContent=s.captured?'Captured image':'Target camera';
  if($('camera-target').getAttribute('aria-pressed')==='true'&&s.captured)panel.querySelector('.orbit-world-heading > span').textContent='CAPTURE / SAVED IMAGE';
  $('clock').textContent=utc(s.time);
  $('light').textContent=p.isEclipse?'ECLIPSE':'SUNLIGHT';
  const rows=[['Altitude',`${(p.geodetic.altM/1000).toFixed(1)} km`],['Speed',`${(p.speedMPerSec/1000).toFixed(2)} km/s`],['Battery',`${s.batteryWh.toFixed(1)} / ${flight.capacity} Wh`],['Image delivered',`${s.deliveredMB.toFixed(1)} / ${s.captured?plan.metrics.imageMB:0} MB`]];
  $('metrics').replaceChildren(...rows.map(([label,value])=>{const row=document.createElement('div');const name=document.createElement('span');name.textContent=label;const val=document.createElement('strong');val.textContent=value;row.append(name,val);return row;}));
  $('contact').textContent=contact?'● Singapore contact active': 'Singapore station out of range';
  const aiming=flight.aiming(),aimLocked=s.status!=='IN_ORBIT'||s.captured;
  $('aim-auto').checked=s.aimMode==='auto';$('aim-auto').disabled=aimLocked;
  const captureReadiness=flight.captureReadiness();
  arrival?.update({active:s.status==='IN_ORBIT',captured:s.captured,ready:captureReadiness.ready,available:access.available,reason:captureReadiness.reason,
    nextTime:flight.opportunity('target')?.time??null,now:s.time,remainingSec:aiming.remainingSec,distanceKm:access.distanceKm,playing:Boolean(timer)});
  const inTargetCamera=$('camera-target').getAttribute('aria-pressed')==='true';
  $('capture').disabled=s.status!=='IN_ORBIT'||s.captured||(inTargetCamera&&!captureReadiness.ready);
  $('capture').textContent=s.captured?'Image captured':!inTargetCamera?'Open target camera':captureReadiness.ready?'Capture image · ready':'Capture target image';
  $('downlink').disabled=s.status!=='IN_ORBIT'||!s.captured;
  $('downlink').textContent=s.status==='COMPLETE'?'Image delivered':s.downlink&&timer?'Pause transfer':s.downlink||s.deliveryStarted||s.deliveredMB>0?'Resume transfer':'Send image to Earth';
  $('objective-image').dataset.done=String(s.captured);$('objective-data').dataset.done=String(s.status==='COMPLETE');
  const next=flight.nextEvent();
  $('next-label').textContent=s.status!=='IN_ORBIT'?'':next===null?'No further opportunities in this seven-day timeline.':`Next ${s.captured?'station opportunity':'imaging opportunity'}: ${utc(next)}`;
  $('next').disabled=next===null;
  $('pause').disabled=s.status!=='IN_ORBIT';
  $('speed').disabled=s.status!=='IN_ORBIT';
  $('replay').hidden=s.status==='IN_ORBIT';
  const reason=s.status==='COMPLETE'?'Mission complete. Start a mission replay to fly this build again.':s.status==='POWER_LOSS'?'Flight stopped: battery reserve exhausted. Retry with a free mission replay.':s.status==='WINDOW_ENDED'?'Seven-day timeline ended. Start a free mission replay.':'Saved flight stopped. Start a free mission replay.';
  if(s.status==='IN_ORBIT'&&s.captured)$('status').textContent=s.downlink?(timer?'Transfer running; data sends only during station contact.':'Transfer paused. Resume transfer to continue.'):'Image captured, delivery pending. Select Send image to Earth to begin.';
  $('playback-status').textContent=s.status==='IN_ORBIT'?(practice?'Mission Replay · no charges or additional campaign rewards.':'Play advances simulated time. Capture and downlink are separate commands.'):reason;
  if(s.status!=='IN_ORBIT'){
    pause();
    $('pause').textContent=s.status==='COMPLETE'?'Finished':'Flight stopped';
    $('status').textContent=s.status==='COMPLETE'?(practice?'✓ Mission replay complete. Full image delivered. Campaign progress is unchanged.':'✓ Urban Mapping complete. Full image delivered; Agricultural Monitoring unlocked.'):reason;
  }
  view?.update(p,{contact:Boolean(contact),transmitting:Boolean(contact&&s.downlink&&s.captured&&s.status==='IN_ORBIT')});
  instrument?.update(aiming,p,plan,s,captureReadiness);
  renderTargetHint();
  renderResult();
  renderPlanner();
  renderDelivery();
  renderMissionFlow();
}
function guideToDownlink(){
  if(view)$('camera-overview').click();
  mapSelection='station';renderPlanner();
  const aside=panel.querySelector('aside');
  aside.scrollTop += $('delivery').getBoundingClientRect().top-aside.getBoundingClientRect().top-16;
}
function renderMissionFlow(){
  const s=flight.state,a=flight.aiming();
  const stage=s.status==='COMPLETE'?4:s.captured?3:!a.available?0:a.aligned?2:1;
  $('stage-label').textContent=['Travel','Aim','Capture','Downlink','Complete'][stage];
  const stopped=s.status!=='IN_ORBIT'&&s.status!=='COMPLETE';
  const hints=['Advance to a sunlit imaging window.','Center the gold target in the sensor frame.','Ready — capture your image.','Send the image to Earth during station contact.','Image delivered — choose Next Mission or Replay.'];
  const hint=stopped?'Flight stopped — retry for free from the results panel.':hints[stage];
  if($('step-hint').textContent!==hint)$('step-hint').textContent=hint;
  for(const [index,item] of [...$('mission-flow').querySelectorAll('li')].entries()){
    if(index===stage&&!stopped)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
    item.dataset.done=String(index<stage);
  }
  panel.dataset.missionStage=String(stage);
  const previous=lastStage;lastStage=stage;
  if(!stopped&&previous===0&&(stage===1||stage===2))$('camera-target').click();
  if(!stopped&&previous!==null&&previous<3&&stage===3){guideToDownlink();$('downlink').focus({preventScroll:true});}
}
function renderDelivery(){
  const s=flight.state,d=flight.deliveryStatus();
  $('delivery-progress').value=d.percent;
  $('delivery-progress-label').textContent=`${d.deliveredMB.toFixed(1)} / ${s.captured?d.totalMB:0} MB · ${d.percent.toFixed(0)}% delivered`;
  const seconds=value=>{const n=Math.max(0,Math.ceil(value));return n>=3600?`${Math.floor(n/3600)} h ${Math.floor(n/60)%60} min`:n>=60?`${Math.floor(n/60)} min ${n%60} s`:`${n} s`;};
  $('delivery-state').textContent=s.status==='COMPLETE'?'✓ Full image received by Singapore':!s.captured?'Capture an image first.':s.status!=='IN_ORBIT'?'Transfer stopped with the flight.':s.downlink&&timer?(d.contact?'Transmitting to Singapore…':'Waiting for Singapore station contact…'):s.downlink||s.deliveryStarted||s.deliveredMB>0?'Transfer paused — your progress is saved.':d.contact?'Station in range — ready to send.':'Image ready — waiting for the next station pass.';
  $('delivery-detail').textContent=!s.captured?'Your captured image will appear here.':d.contact?`${d.rateMbps} Mbps · ${seconds(d.contactEnd-s.time)} contact remaining · ${seconds(d.contactSecondsNeeded)} of contact needed to finish.`:d.nextContactTime!==null?`Next station pass in ${seconds(d.nextContactTime-s.time)} of simulated time. No data is sent out of range.`:'No more station passes in this timeline. Replay to try again.';
  $('delivery-jump').hidden=false;
  $('delivery-jump').disabled=!s.captured||d.contact||s.status!=='IN_ORBIT'||d.nextContactTime===null;
}
function selectMapDestination(kind){
  mapSelection=kind;
  $('camera-overview').click();renderPlanner();
  view?.focusDestination(kind);
  $('map-title').focus({preventScroll:true});
}
function renderPlanner(){
  $('map-planner').hidden=$('camera-overview').getAttribute('aria-pressed')!=='true';
  for(const kind of ['target','station'])$(`map-${kind}`).setAttribute('aria-pressed',String(kind===mapSelection));
  const next=flight.opportunity(mapSelection),s=flight.state;
  $('map-title').textContent=mapSelection==='target'?(plan.target?.name||urbanMission.target.name):urbanMission.station.name;
  const countdown=seconds=>{const n=Math.max(0,Math.ceil(seconds));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');};
  $('map-countdown').textContent=s.status!=='IN_ORBIT'?'Flight stopped — replay to plan another pass.':!next?'No further pass in this timeline.':next.active?`Window active · ${countdown(next.endTime-s.time)} remaining`:`Next pass in ${countdown(next.time-s.time)} · simulated time`;
  $('map-detail').textContent=mapSelection==='target'?(s.captured?'Image already captured. Select the station to plan delivery.':'Predicted sunlit imaging access with ≤3 m GSD. Open Target camera to align and capture; advancing does not capture automatically.'):next?`S-band · ${next.capacityMB.toFixed(1)} MB remaining pass capacity. ${s.captured?`${Math.max(0,plan.metrics.imageMB-s.deliveredMB).toFixed(1)} MB left to deliver. Select Send image to Earth to transmit.`:'Capture an image first. Advancing does not enable the radio.'}`:'No predicted Singapore contact remains.';
  $('map-advance').disabled=s.status!=='IN_ORBIT'||!next||(mapSelection==='target'&&s.captured)||(mapSelection==='station'&&next.active);
  $('map-advance').textContent=mapSelection==='target'?(s.captured?'Image captured':next?.active?'Open target camera →':'Advance to imaging pass →'):next?.active?'Station contact active':'Advance to station pass →';
}
function renderTargetHint(){
  $('camera-controls').hidden=false;
  $('aim-auto').parentElement.hidden=flight.state.captured;
  const a=flight.aiming(),s=flight.state;
  const offFrame=a.errorDeg>Math.atan(plan.metrics.swathKm/(2*(flight.current().geodetic.altM/1000)))*180/Math.PI;
  const show=$('camera-target').getAttribute('aria-pressed')==='true'&&!s.captured&&(!a.available||offFrame);
  $('camera-waiting').hidden=!show;
  if(!show)return;
  const next=flight.opportunity('target'),stopped=s.status!=='IN_ORBIT',missing=!a.available&&!next;
  $('camera-waiting').dataset.recovery=String(stopped||missing);
  const seconds=value=>{const n=Math.max(0,Math.ceil(value));return n>=3600?`${Math.floor(n/3600)} h ${Math.floor(n/60)%60} min`:n>=60?`${Math.floor(n/60)} min ${n%60} s`:`${n} s`;};
  const remaining=next?Math.max(0,next.time-s.time):null;
  $('camera-wait-title').textContent=stopped?(s.status==='POWER_LOSS'?'Flight stopped — battery reserve':'Flight timeline ended'):missing?'No imaging windows remaining':a.available?'Ready to aim':remaining<=300?'Approaching target':'Traveling to the target';
  $('camera-wait-countdown').textContent=stopped||missing?'':a.available?`Imaging window open · ${seconds(a.remainingSec)} remaining`:`Imaging window in ${seconds(remaining)} · simulated time`;
  $('camera-wait-countdown').hidden=stopped||missing;
  $('camera-wait-distance').textContent=`Ground distance to target: ${Math.round(a.distanceKm).toLocaleString()} km`;
  $('camera-wait-help').textContent=stopped?'This flight cannot advance. Retry the same launched build for free.':missing?'There are no valid sunlit imaging windows left in this seven-day prediction. Retry to start a fresh timeline.':a.available?'Bring the city into view, then fine-tune the crosshair to capture.':'A valid window requires sunlight, target access and acceptable image resolution. Use Play or advance to the predicted window.';
  $('camera-wait-playback').textContent=stopped||missing?'':timer?`Running at ${$('speed').value}× · countdown follows simulated time`:'Paused — press Play to continue';
  $('camera-wait-action').textContent=stopped||missing?'Retry mission for free':a.available?'Bring target into view':'Skip to imaging window →';
  $('camera-wait-action').disabled=false;
}
function renderResult(){
  const s=flight.state,terminal=s.status!=='IN_ORBIT';
  $('result').hidden=!terminal;
  if(!terminal){lastResult='';return;}
  const complete=s.status==='COMPLETE',expired=s.status==='WINDOW_ENDED';
  $('result').dataset.outcome=complete?'complete':'failed';
  $('result-mode').textContent=practice?'MISSION REPLAY RESULTS · NO CHARGES OR REWARDS':'MISSION RESULTS';
  $('result-title').textContent=complete?'Mission Complete':expired?'Time Expired':'Mission Failed';
  $('result-reason').textContent=complete?'Your full image reached Singapore station.':expired?(s.captured?'The seven-day timeline ended before the full image was downlinked. Select Send image to Earth before the next station pass on your retry.':'The seven-day timeline ended without an image. Advance to an imaging opportunity and capture the sunlit target.'):'The flight stopped at the battery safety reserve. Review solar generation, battery capacity and radio usage before trying again.';
  const stats=[['Image resolution',Number.isFinite(s.captureGsdM)?`${s.captureGsdM.toFixed(2)} m GSD`:'Not captured'],['Data delivered',`${s.deliveredMB.toFixed(1)} / ${plan.metrics.imageMB} MB`],['Battery remaining',`${s.batteryWh.toFixed(1)} / ${flight.capacity} Wh`],['Flight time',`${((s.time-flight.points[0].time)/3600).toFixed(1)} hours`]];
  if(Number.isFinite(s.captureScore))stats.push(['Capture quality',`${s.captureScore}/100${s.captureAimMode==='auto'?' · assisted':' · manual'}`]);
  $('result-stats').replaceChildren(...stats.flatMap(([label,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;return[dt,dd];}));
  $('result-replay').textContent=complete?'Replay for free':'Retry for free';
  $('result-workshop').textContent=complete?'Workshop':'Improve build';
  const next=nextMission(read(SAVE_KEY),plan.missionId||'urban');
  $('result-next').hidden=!complete||!next;
  $('result-next').textContent=next?`Next: ${next.title} →`:'All available missions completed';
  $('complete-next').hidden=!complete||!next;
  $('complete-next').textContent=next?`Next: ${next.title} →`:'All available missions completed';
  $('complete-dialog').querySelector('p').textContent=next?`Full image delivered. ${next.title} is unlocked. Continue to the next level or try again for free.`:'Full image delivered. Try this mission again for free or view your results.';
  $('result-hint').textContent=complete&&next?`Next mission opens the ${next.title} briefing. Replay is free; completion is counted once.`:'Free retry uses the same launched build. Workshop edits are saved separately and do not change this flight.';
  const key=`${s.id}:${s.status}`;
  if(lastResult!==key){lastResult=key;panel.querySelector('aside').scrollTop=0;$('result-title').focus({preventScroll:true});}
  if(complete&&!completionPrompts.has(key)){
    completionPrompts.add(key);
    $('complete-title').textContent=practice?'Mission replay complete!':'Mission complete!';
    $('complete-dialog').showModal();
    (next?$('complete-next'):$('complete-no')).focus();
  }
}
export async function openOrbitalMission(selectedPlan, partsCatalog){
  if(busy)return;busy=true;
  try {
    if(!panel)build();
    const initial=read(SAVE_KEY)||{};
    practice=Boolean(initial.orbitalPractice);
    const existing=initial.orbitalPractice||initial.orbitalFlight;
    plan=existing?.plan||selectedPlan;catalog=partsCatalog;
    if(!plan)throw Error('Save a validated Urban mission plan first.');
    if(!existing){
      const design={missionId:'urban',components:plan.components,settings:plan.settings,credits:initial.player?.credits??250000,planningSupportUSD:initial.missionSupportUsed?.urban?0:urbanMission.planningSupportUSD};
      if(!evaluateMission(design,catalog).ready||plan.inputKey!==missionInputKey(design)||!plan.physics?.passed)throw Error('Mission plan changed. Run preflight and save again.');
    }
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
    const post=async(route,body)=>{const r=await fetch(`/api/physics/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});if(!r.ok)throw Error('Physics service unavailable. Retry launch.');return r.json();};
    let trajectory,link;
    try{[trajectory,link]=await Promise.all([post('propagate',{elements:plan.physics.elements,duration:604800,step:10,includeSun:true,enableJ2:true}),post('link-budget',{orbit:plan.physics.elements,duration:604800,step:10,stationIds:[urbanMission.station.id],comms:{frequencyBand:'S_Band',downlinkMbps:catalog.find(p=>p.id===plan.components.comms).downlinkSpeedMbps,minElevationDeg:Math.max(urbanMission.station.minElevationDeg,catalog.find(p=>p.id===plan.components.comms).minStationElevationDeg||0)}})]);}finally{clearTimeout(timeout);}
    if(!Array.isArray(trajectory.points)||trajectory.points.length<2||!Array.isArray(link.passes))throw Error('Incomplete orbital prediction. Retry launch.');
    lastStage=null;
    flight=createFlight(plan,catalog,trajectory,link.passes,existing?.state);
    if(!existing){
      const save=read(SAVE_KEY)||{};
      const credits=save.player?.credits??250000;
      const support=save.missionSupportUsed?.urban?0:urbanMission.planningSupportUSD;
      const ownCost=Math.max(0,plan.metrics.totalUSD-support);
      if(save.orbitalFlight||credits<ownCost||plan.inputKey!==missionInputKey({missionId:'urban',components:plan.components,settings:plan.settings,credits,planningSupportUSD:support}))throw Error('Funds or saved flight changed. Reopen mission planning.');
      flight.state.id=`urban-${Date.now()}`;
      save.player={...save.player,credits:credits-ownCost,stats:{...save.player?.stats,launches:(save.player?.stats?.launches||0)+1}};
      save.missionSupportUsed={...save.missionSupportUsed,urban:true};
      save.orbitalFlight={id:flight.state.id,plan,state:{...flight.state},chargedUSD:ownCost,supportUSD:Math.min(support,plan.metrics.totalUSD)};
      if(!write(SAVE_KEY,save))throw Error('Could not save launch. No mission started.');
      window.dispatchEvent(new Event('mission-saved'));
    }
    pause();panel.hidden=false;document.body.classList.add('orbiting');document.querySelector('.space').inert=true;document.querySelector('#hangar').inert=true;
    $('status').textContent='Orbit established. Advance to the next imaging opportunity to begin.';
    $('installed').replaceChildren(...Object.values(plan.components).map(id=>{const row=document.createElement('li');row.textContent=catalog.find(part=>part.id===id)?.name||id;return row;}));
    panel.querySelector('.orbit-world-heading > span').textContent='FOLLOW / LAUNCHED BUILD';
    for(const mode of ['follow','overview']){$(`camera-${mode}`).disabled=true;$(`camera-${mode}`).setAttribute('aria-pressed',String(mode==='follow'));}
    $('title').focus();
    view?.dispose();view=null;
    instrument?.dispose();
    instrument=createTargetCamera($('canvas'),(x,y)=>{flight.setAim(x,y);checkpoint();render();});
    arrival?.dispose();arrival=createCaptureArrival($('canvas'));
    panel.querySelector('aside').insertBefore(instrument.reveal,$('delivery'));
    $('graphics').hidden=false;
    try {const {createOrbitScene}=await import('./three/orbitScene.js');view=createOrbitScene($('canvas'),plan,catalog,trajectory.points,{onPick:selectMapDestination});$('graphics').hidden=true;for(const mode of ['follow','overview'])$(`camera-${mode}`).disabled=false;}catch{$('graphics').textContent='3D graphics unavailable. Telemetry and mission controls remain usable.';}
    if(flight.state.status==='COMPLETE')checkpoint();
    render();
    if(flight.access().available||!view)$('camera-target').click();else $('camera-follow').click();
    if(flight.state.captured&&flight.state.status==='IN_ORBIT')guideToDownlink();
  }finally{busy=false;}
}

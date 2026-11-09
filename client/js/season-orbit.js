import { createSeasonOrbit } from './season-orbit-engine.js';
import { createTargetCamera } from './target-camera.js';
import { storedMB } from './agriculture-engine.js';
import { createCaptureArrival } from './capture-arrival.js';

const stationLocations={gs_singapore:{latDeg:1.3,lonDeg:103.77},gs_svalbard:{latDeg:78.23,lonDeg:15.41},gs_goldstone:{latDeg:35.43,lonDeg:-116.89},gs_canberra:{latDeg:-35.4,lonDeg:148.98}};
const duration=n=>{n=Math.max(0,Math.ceil(n));return n>=3600?`${Math.floor(n/3600)} h ${Math.floor(n/60)%60} min`:`${Math.floor(n/60)} min ${n%60} s`;};
export function mountSeasonOrbit(host,{mission,regions,catalog,getRecord,onState,revealHost=host}) {
  host.innerHTML=`<div class="season-orbit-heading"><span class="eyebrow">LIVE ORBIT / YOUR LAUNCHED BUILD</span><div role="group" aria-label="Camera view"><button data-view="follow" aria-pressed="true">Follow satellite</button><button data-view="overview" aria-pressed="false">Earth overview</button><button data-view="target" aria-pressed="false">Target camera</button></div><span data-id="light"></span></div>
    <div class="season-orbit-canvas"><p data-id="graphics" role="status">Preparing Earth and orbital prediction…</p></div>
    <div class="season-orbit-guidance"><strong data-id="stage"></strong><span data-id="hint" role="status"></span></div>
    <div class="season-orbit-target"><label>Observation target<select data-id="target" aria-label="Observation target"></select></label><button data-id="capture">Capture target image</button><label><input type="checkbox" data-id="auto"> Auto-point assist</label><button data-id="transfer">Send images to Earth</button><button data-id="station">Next station pass →</button></div>
    <div class="season-orbit-dock"><button data-id="play">Play</button><label>Speed <select data-id="speed"><option value="1">1×</option><option value="10">10×</option><option value="100" selected>100×</option><option value="1000">1000×</option><option value="10000">10000×</option></select></label><button data-id="next">Advance to imaging window →</button><button data-id="reset">Reset view</button><span data-id="clock"></span></div>
    <p class="season-orbit-note" data-id="note">Travel → Aim → Capture → Downlink → Next request. Advancing time never captures an image automatically.</p>`;
  const $=id=>host.querySelector(`[data-id="${id}"]`),canvasHost=host.querySelector('.season-orbit-canvas');
  for(const [selector,className] of [['.season-orbit-heading','mission-world-heading'],['.season-orbit-canvas','mission-canvas'],['.season-orbit-guidance','mission-guidance'],['.season-orbit-target','mission-target-controls'],['.season-orbit-dock','mission-dock']])host.querySelector(selector).classList.add(className);
  const arrival=createCaptureArrival(canvasHost);
  let engine,view,instrument,playing=false,loading=false,jumping=false,disposed=false,mode='follow',timer=null,lastStage=null,requestKey='',controller=new AbortController();
  const active=()=>engine?.state.status==='ACTIVE';
  function pause(){playing=false;clearInterval(timer);timer=null;arrival.pause();$('play').textContent='Play';}
  function commit(){if(!onState(structuredClone(engine.state))){pause();return false;}return true;}
  function setMode(next){mode=next;instrument?.active(next==='target');view?.setMode(next==='target'?'overview':next);for(const button of host.querySelectorAll('[data-view]'))button.setAttribute('aria-pressed',String(button.dataset.view===next));render();}
  function select(id){
    pause();
    if(engine?.select(id)&&commit()){
      // Give immediate geographic feedback; the live satellite does not teleport.
      view?.setTarget(engine.selectedPlan().target);setMode('overview');view?.focusDestination('target');render();
    }
  }
  for(const button of host.querySelectorAll('[data-view]'))button.onclick=()=>setMode(button.dataset.view);
  $('target').onchange=()=>select($('target').value);
  $('auto').onchange=()=>{if(!engine)return;engine.state.aimMode=$('auto').checked?'auto':'manual';commit();render();};
  $('reset').onclick=()=>{if(mode==='target'){instrument?.resetZoom();canvasHost.querySelector('.target-camera-canvas')?.focus();}else view?.reset();};
  $('capture').onclick=()=>{
    if(mode!=='target'){setMode('target');return;}
    pause();if(!engine?.capture())return;
    const r=engine.request(),source=instrument.captureSource();
    if(source)r.captureFrame={...r.captureFrame,version:3,datasetId:source};
    if(commit()){instrument.flash();setMode('overview');view?.focusDestination('station');}
  };
  $('transfer').onclick=()=>{if(!active())return;engine.state.downlink=!engine.state.downlink;const ok=commit();render();if(ok&&engine.state.downlink&&!playing)$('play').click();};
  $('play').onclick=async()=>{
    if(playing){pause();render();return;}
    if(!engine||!active()||jumping||loading)return;
    if(engine.time()>=engine.end-1e-6)await load();
    if(disposed||!active()||loading)return;
    playing=true;let previous=performance.now();$('play').textContent='Pause';
    timer=setInterval(async()=>{
      if(loading||jumping||disposed)return;
      const now=performance.now(),seconds=Math.min(1000,(now-previous)/1000*Number($('speed').value));previous=now;
      const before=engine.readiness().ready,delivered=engine.state.requests.filter(r=>r.completed).length;
      const opportunity=engine.next('target');
      // Even at high speed, stop exactly at the next sampled imaging window.
      engine.advance(opportunity!==null&&opportunity>engine.time()?Math.min(seconds,opportunity-engine.time()):seconds);
      if(!commit())return;
      const ready=engine.readiness().ready;
      if(!active()||(!before&&ready)){pause();if(ready)setMode('target');}
      if(engine.state.requests.filter(r=>r.completed).length>delivered){pause();setMode('overview');}
      render();
      if(playing&&engine.time()>=engine.end-1e-6){pause();await load();}
    },200);
  };
  async function jump(kind){
    if(!active()||loading||jumping)return;
    pause();jumping=true;render();
    try{
      const next=engine.next(kind),until=next===null?engine.end:next;
      // Yield between resource-integrated chunks so Pause/return remain responsive.
      while(!disposed&&jumping&&active()&&engine.time()<until-1e-6){
        engine.advance(Math.min(21600,until-engine.time()));
        if(!commit())break;
        render();await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(disposed)return;
      if(kind==='target'&&engine.camera().access().available)setMode('target');
      else if(kind==='station'){setMode('overview');view?.focusDestination('station');}
      if(active()&&engine.time()>=engine.end-1e-6)await load();
    }catch(error){$('note').textContent=error.message;}
    finally{jumping=false;if(!disposed)render();}
  }
  $('next').onclick=()=>jump('target');$('station').onclick=()=>jump('station');
  function onVisibility(){if(document.hidden){pause();jumping=false;}}
  document.addEventListener('visibilitychange',onVisibility);
  async function load(){
    if(disposed||loading)return;
    loading=true;pause();render();
    $('graphics').hidden=false;$('graphics').textContent='Loading orbit and station contacts…';
    try{
      const record=getRecord(),plan=record.plan,epoch=Date.parse(mission.epoch)/1000;
      // Terminal states use the final orbit for inspection, without advancing time.
      const startTime=epoch+Math.min(record.state.day,mission.days-1/24)*86400;
      const seconds=Math.min(7*86400,epoch+mission.days*86400-startTime);
      const radio=catalog.find(p=>p.id===plan.components.comms);
      const post=async(route,body)=>{const response=await fetch(`/api/physics/${route}`,{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'Physics unavailable');return data;};
      const [trajectory,link]=await Promise.all([
        post('propagate',{elements:plan.elements,startTime,duration:seconds,step:30,includeSun:true,enableJ2:true}),
        post('link-budget',{orbit:plan.elements,startTime,duration:seconds,step:30,stationIds:[plan.settings.stationId],comms:{frequencyBand:radio.frequencyBand,downlinkMbps:radio.downlinkSpeedMbps,minElevationDeg:Math.max(10,radio.minStationElevationDeg||0)}}),
      ]);
      if(disposed)return;
      if(!Array.isArray(trajectory.points)||trajectory.points.length<2||!Array.isArray(link.passes))throw Error('Incomplete orbital prediction. Saved progress is unchanged.');
      engine=createSeasonOrbit(plan,catalog,mission,regions,trajectory,link.passes,getRecord().state);
      if(!commit())return;
      instrument?.dispose();view?.dispose();view=null;
      instrument=createTargetCamera(canvasHost,(x,y)=>{if(engine.setAim(x,y)){commit();render();}});
      revealHost.append(instrument.reveal);
      try{
        const {createOrbitScene}=await import('./three/orbitScene.js');
        if(disposed)return;
        view=createOrbitScene(canvasHost,{...engine.selectedPlan(),targets:regions,station:stationLocations[plan.settings.stationId]},catalog,trajectory.points,{onPick:kind=>{
          if(kind==='station'){setMode('overview');view.focusDestination('station');return;}
          const r=engine.openRequests().find(r=>r.regionId===kind&&!r.completed)||engine.request();if(r)select(r.id);
        }});
        $('graphics').hidden=true;
      }catch{$('graphics').textContent='3D unavailable. Target camera and mission controls still work.';mode='target';}
      setMode(mode);
    }catch(error){if(!disposed&&error.name!=='AbortError'){$('graphics').textContent=`${error.message} Return and resume to retry loading.`;}}
    finally{loading=false;if(!disposed)render();}
  }
  function render(){
    if(disposed)return;
    const disabled=loading||jumping||!engine||!active();
    for(const id of ['play','target','auto','transfer','next','station'])$(id).disabled=disabled;
    $('capture').disabled=true;
    if(!engine)return;
    const s=engine.state,r=engine.request(),point=engine.current(),p=engine.selectedPlan(),f=engine.camera(),ready=engine.readiness(),now=engine.time();
    const requests=engine.openRequests(),key=JSON.stringify(requests.map(r=>[r.id,r.captured,r.completed]));
    if(key!==requestKey){requestKey=key;$('target').replaceChildren(...requests.map(r=>new Option(`${regions.find(region=>region.id===r.regionId).name}${r.title?' · '+r.title:''}${r.completed?' · delivered':r.captured?' · captured':''}`,r.id)));if(!requests.length)$('target').add(new Option('No open requests — advance to next alert',''));}
    $('target').value=r?.id||'';
    $('light').textContent=point.isEclipse?'ECLIPSE':'SUNLIGHT';
    $('clock').textContent=new Date(now*1000).toISOString().replace('T',' ').slice(0,19)+' UTC';
    $('auto').checked=s.aimMode==='auto';$('auto').disabled=disabled||Boolean(r?.captured);
    $('capture').disabled=disabled||Boolean(r?.captured)||(mode==='target'?!ready.ready:!r);
    $('capture').textContent=r?.captured?'Image captured':mode==='target'?'Capture target image':'Open target camera';
    $('transfer').disabled=disabled||storedMB(s)<=0;$('transfer').textContent=s.downlink?'Pause downlink':'Send images to Earth';
    const event=engine.next('target'),contact=engine.contact(),c=engine.conditions();
    const window=f.opportunity('target');
    arrival.update({active:active()&&!loading&&!jumping,captured:Boolean(r?.captured),ready:ready.ready,available:f.access().available,
      reason:ready.reason,nextTime:r&&!r.expired&&window&&window.time<r.deadlineAt?window.time:null,now,remainingSec:f.aiming().remainingSec,distanceKm:f.access().distanceKm,playing});
    $('next').textContent=event===null?'Advance prediction / next requests →':event<=now?'Open target camera →':`Imaging in ${duration(event-now)} →`;
    if(!jumping)$('next').onclick=()=>event!==null&&event<=engine.time()?setMode('target'):jump('target');
    const stage=!active()?'Results':!r?'Select target':r.completed?'Next request':r.captured?'Downlink':ready.ready?'Capture':f.access().available?'Aim':'Travel';
    $('stage').textContent=stage;
    const step=r?.completed||!active()?4:r?.captured?3:ready.ready?2:f.access().available?1:0;
    for(const [i,item]of [...(host.closest('#agriculture-operations')?.querySelectorAll('.mission-flow li')||[])].entries()){
      if(i===step)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');item.dataset.done=String(i<step);
    }
    $('hint').textContent=!active()?`${s.status} · results and free retry in mission panel`:r?.captured?`${r.deliveredMB.toFixed(1)} / ${r.totalMB.toFixed(1)} MB · ${c.stationOutage?'station outage':contact?'station in range':'waiting for station contact'}${s.downlink?' · radio enabled':' · select Send images to Earth'}`:!r?'Choose an open region request; advance time to receive new requests.':`${p.target.name} · ${Math.round(f.access().distanceKm).toLocaleString()} km away · ${ready.reason} · deadline in ${duration(r.deadlineAt-now)}`;
    // Pause on arrival so a fast simulation cannot silently pass the aiming window.
    if(playing&&lastStage==='Travel'&&(stage==='Aim'||stage==='Capture')){pause();lastStage=stage;setMode('target');}
    lastStage=stage;
    view?.setTarget(p.target);view?.update(point,{contact,transmitting:contact&&s.downlink&&storedMB(s)>0&&active()});
    const captureState={...f.state,status:r?.completed?'COMPLETE':f.state.status};
    instrument?.update(f.aiming(),point,p,captureState,ready);
    $('play').textContent=playing?'Pause':'Play';
    host.dataset.stage=stage;
  }
  void load();
  return {refresh(){if(engine){engine.update(getRecord().state);render();}},pause(){pause();jumping=false;},dispose(){disposed=true;pause();arrival.dispose();jumping=false;controller.abort();document.removeEventListener('visibilitychange',onVisibility);instrument?.dispose();view?.dispose();host.replaceChildren();}};
}

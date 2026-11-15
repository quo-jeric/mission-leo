import { createFlight, pointAt, contactAt } from './orbit-engine.js';
import { runSeasonDay, storedMB } from './agriculture-engine.js';
import { applyDisasterEvents, disasterConditions } from './disaster-engine.js';

// Shared seasonal accounting with explicit, Mission-1-style camera commands.
// Old seasonal saves retain all requests, money, bytes and completed deliveries.
export function orbitalSeasonState(previous, mission) {
  const state=structuredClone(previous),epoch=Date.parse(mission.epoch)/1000;
  state.controlMode='orbital';state.downlink=previous.controlMode==='orbital'?Boolean(previous.downlink):false;
  state.requests=state.requests.map(r=>({...r,opensAt:r.opensAt??epoch+(r.opensDay-1)*86400,deadlineAt:r.deadlineAt??epoch+r.closesDay*86400}));
  if(mission.id==='disaster'&&state.status==='ACTIVE')applyDisasterEvents(state);
  return state;
}
export function createSeasonOrbit(plan,catalog,mission,regions,trajectory,passes,initial) {
  const epoch=Date.parse(mission.epoch)/1000,points=trajectory.points;
  const end=Math.min(points.at(-1).time,epoch+mission.days*86400);
  const part=category=>catalog.find(p=>p.id===plan.components[category]);
  let state=orbitalSeasonState(initial,mission),cameraFlight=null,cameraKey='';
  const time=()=>epoch+state.day*86400;
  const conditions=()=>mission.id==='disaster'?disasterConditions(state):{cloudRegions:[],batteryFactor:1};
  const request=()=>state.requests.find(r=>r.id===state.selectedRequestId);
  const openRequests=()=>state.requests.filter(r=>r.opensAt<=time()&&time()<r.deadlineAt&&!r.expired);
  function select(id){if(!openRequests().some(r=>r.id===id))return false;state={...state,selectedRequestId:id,aimMode:'manual',aimXDeg:0,aimYDeg:0};cameraKey='';return true;}
  function selectedPlan(){
    const c=conditions(),r=request(),target=regions.find(region=>region.id===r?.regionId)||regions[0];
    return {...plan,target:{...target,widthKm:10,heightKm:10},maxGsdM:mission.maxGsdM,
      maxLookDeg:c.wheelFault?8:Math.min(mission.id==='disaster'?45:30,part('payload').maxOffNadirDeg||30)};
  }
  function camera(){
    const p=selectedPlan(),c=conditions(),r=request(),key=`${r?.id}:${p.maxLookDeg}:${c.batteryFactor}`;
    if(key!==cameraKey){
      const adjusted=catalog.map(item=>item.id===plan.components.eps_battery?{...item,capacityWh:item.capacityWh*c.batteryFactor}:item);
      cameraFlight=createFlight(p,adjusted,trajectory,passes);cameraKey=key;
    }
    Object.assign(cameraFlight.state,{time:time(),batteryWh:state.batteryWh,status:state.status==='ACTIVE'?'IN_ORBIT':state.status,
      aimMode:state.aimMode||'manual',aimXDeg:state.aimXDeg||0,aimYDeg:state.aimYDeg||0,captured:Boolean(r?.captured),deliveredMB:r?.deliveredMB||0,
      captureTime:r?.captureTime,captureGsdM:r?.captureGsdM,captureFrame:r?.captureFrame,captureScore:r?.captureScore,captureAimMode:r?.captureAimMode});
    return cameraFlight;
  }
  function readiness(){
    const r=request(),c=conditions();
    if(!r||r.opensAt>time()||r.deadlineAt<=time()||r.expired)return {ready:false,reason:'Select an open request'};
    if(c.payloadOffline)return {ready:false,reason:'Reset the payload to restore imaging'};
    if(c.cloudRegions.includes(r.regionId))return {ready:false,reason:'Cloud cover blocks this target'};
    if(!r.captured&&storedMB(state)+r.totalMB>part('cdh').storageCapacityMB)return {ready:false,reason:'Storage full — downlink queued images first'};
    return camera().captureReadiness();
  }
  function capture(){
    if(!readiness().ready)return false;
    const f=camera();if(!f.capture())return false;
    const r=request(),s=f.state;
    Object.assign(r,{captured:true,captureTime:s.captureTime,captureGsdM:s.captureGsdM,captureAimMode:s.captureAimMode,
      captureAimErrorDeg:s.captureAimErrorDeg,captureScore:s.captureScore,captureFrame:s.captureFrame});
    state.batteryWh=s.batteryWh;state.minimumBatteryWh=Math.min(state.minimumBatteryWh,s.batteryWh);
    state.log=[`Captured ${selectedPlan().target.name} manually. Send the image to Earth during station contact.`,...state.log].slice(0,20);
    return true;
  }
  function advance(seconds){
    const until=Math.min(end,time()+Math.max(0,seconds));
    while(time()<until-1e-7&&state.status==='ACTIVE'){
      // Split clouds, outages and faults at six-hour boundaries; no auto-capture.
      const now=time(),boundary=epoch+(Math.floor((now-epoch)/21600+1e-8)+1)*21600;
      const to=Math.min(until,boundary),duration=to-now;
      if(duration<1e-7)break;
      const c=conditions(),segment=[{...pointAt(points,now),time:now},...points.filter(p=>p.time>now&&p.time<to),{...pointAt(points,to),time:to}];
      if(mission.id==='disaster')state.requests.sort((a,b)=>state.queueOrder==='priority'?b.weight-a.weight||a.deadlineAt-b.deadlineAt:a.deadlineAt-b.deadlineAt||b.weight-a.weight);
      state=runSeasonDay(plan,catalog,state,segment,c.stationOutage?[]:passes,{mission,regions,durationSec:duration,cameraUnavailable:true,batteryFactor:c.batteryFactor,quiet:true});
      if(mission.id==='disaster'&&state.status==='ACTIVE')applyDisasterEvents(state);
    }
    return state;
  }
  function next(kind){
    if(state.status!=='ACTIVE')return null;
    if(kind==='station'){
      // Outages last through the current seeded six-hour interval.
      const p=passes.find(p=>p.losTime>time()&&(!conditions().stationOutage||p.aosTime>=epoch+(Math.floor(state.day*4)+1)/4*86400));
      return p?Math.max(time(),p.aosTime):null;
    }
    const r=request();
    const opening=state.requests.filter(r=>!r.completed&&!r.expired&&r.opensAt>time()+1e-6).reduce((n,r)=>Math.min(n,r.opensAt),Infinity);
    if(!r||r.captured||r.expired||r.deadlineAt<=time())return Number.isFinite(opening)?Math.min(opening,end):null;
    const window=camera().opportunity('target');
    if(window&&window.time<r.deadlineAt)return window.time;
    return Math.min(r.deadlineAt,opening,end);
  }
  if(!request())state.selectedRequestId=openRequests().find(r=>!r.captured&&!r.completed)?.id||openRequests()[0]?.id;
  return {get state(){return state;},get end(){return end;},time,select,request,openRequests,selectedPlan,camera,readiness,capture,advance,next,conditions,
    current:()=>pointAt(points,time()),contact:()=>!conditions().stationOutage&&Boolean(contactAt(passes,time())),
    setAim(x,y){if(!camera().setAim(x,y))return false;Object.assign(state,{aimMode:'manual',aimXDeg:cameraFlight.state.aimXDeg,aimYDeg:cameraFlight.state.aimYDeg});return true;},
    update(nextState){state=orbitalSeasonState(nextState,mission);},
  };
}

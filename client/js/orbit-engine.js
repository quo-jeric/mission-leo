import { urbanMission } from './data/mission-config.js';
import { cameraFrame } from './target-camera.js';
const R = 6378.137, rad = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function gmst(time) { return ((280.46061837 + 360.98564736629 * (time / 86400 + 2440587.5 - 2451545)) % 360) * rad; }
// Same low-precision solar ephemeris as server/physics/shadow.js.
export function sunVector(time) {
  const t = (time / 86400 + 2440587.5 - 2451545) / 36525;
  const m = (357.52911 + 35999.05029 * t) * rad;
  const c = (1.914602 - .004817 * t) * Math.sin(m) + (.019993 - .000101 * t) * Math.sin(2*m) + .000289 * Math.sin(3*m);
  const l = (280.46646 + 36000.76983 * t + c) * rad;
  return [Math.cos(l), Math.sin(l) * Math.cos(23.4392911 * rad), Math.sin(l) * Math.sin(23.4392911 * rad)];
}
export function targetAccess(point, plan) {
  const target = plan.target || urbanMission.target;
  const lat = point.geodetic.latDeg * rad, lon = point.geodetic.lonDeg * rad;
  const tlat = target.latDeg * rad, tlon = target.lonDeg * rad;
  const cos = clamp(Math.sin(lat)*Math.sin(tlat)+Math.cos(lat)*Math.cos(tlat)*Math.cos(lon-tlon), -1, 1);
  const a = R + point.geodetic.altM / 1000;
  const angle = Math.acos(cos), range = Math.sqrt(a*a + R*R - 2*a*R*cos);
  const look = Math.atan2(R*Math.sin(angle), a - R*cos);
  const incidenceCos = (a*cos-R) / Math.max(range, .001);
  // Conservative flat-ground obliquity penalty; 30-degree tutorial slew cap.
  const gsd = plan.metrics.gsdM / Math.max(incidenceCos**2, .001);
  const s = sunVector(point.time), theta = tlon + gmst(point.time);
  const sunElevation = Math.asin(clamp(s[0]*Math.cos(tlat)*Math.cos(theta)+s[1]*Math.cos(tlat)*Math.sin(theta)+s[2]*Math.sin(tlat),-1,1)) / rad;
  const depth=a-R*cos;
  const aimXDeg=Math.atan2(R*Math.cos(tlat)*Math.sin(tlon-lon),depth)/rad;
  const aimYDeg=Math.atan2(R*(Math.sin(tlat)*Math.cos(lat)-Math.cos(tlat)*Math.sin(lat)*Math.cos(tlon-lon)),depth)/rad;
  return { aimXDeg, aimYDeg, distanceKm: R*angle, lookDeg: look/rad, gsdM: gsd, sunElevationDeg: sunElevation,
    available: !point.isEclipse && incidenceCos > 0 && look/rad <= 30 && gsd <= (plan.maxGsdM ?? 3) && sunElevation >= 10 };
}
export function pointAt(points, time) {
  const step = points[1].time - points[0].time;
  return points[clamp(Math.floor((time-points[0].time)/step),0,points.length-1)];
}
export function contactAt(passes, time) { return passes.find(pass => time >= pass.aosTime && time < pass.losTime); }
export function createFlight(plan, catalog, trajectory, passes, saved) {
  const items = Object.values(plan.components).map(id => catalog.find(p=>p.id===id)).filter(Boolean);
  const battery = items.find(p=>p.category==='eps_battery');
  const camera = items.find(p=>p.category==='payload');
  const radio = items.find(p=>p.category==='comms');
  const solar = items.find(p=>p.category==='eps_solar');
  const capacity = battery.capacityWh;
  const floor = capacity*(1-battery.maxDoD);
  const supportW = items.filter(p=>!['payload','comms'].includes(p.category)).reduce((s,p)=>s+(p.operationalPowerW||0),0);
  const idleW = supportW + (camera.standbyPowerW||0) + (radio.standbyPowerW||0);
  const state = { time:trajectory.points[0].time, batteryWh:capacity, captured:false, deliveredMB:0, downlink:false, status:'IN_ORBIT', aimMode:'manual',aimXDeg:0,aimYDeg:0, ...saved };
  state.downlink = false; // Resuming always requires an explicit transmit command.
  const points=trajectory.points;
  const imagingTimes=points.filter(point=>targetAccess(point,plan).available).map(point=>point.time);
  const windows=[];const sampleStep=points[1].time-points[0].time;
  for(const time of imagingTimes){const last=windows[windows.length-1];if(last&&time<=last.end)last.end=time+sampleStep;else windows.push({start:time,end:time+sampleStep});}
  const end=points[points.length-1].time;
  function aiming(){
    const access=targetAccess(pointAt(points,state.time),plan);
    const x=state.aimMode==='auto'?access.aimXDeg:state.aimXDeg;
    const y=state.aimMode==='auto'?access.aimYDeg:state.aimYDeg;
    const errorDeg=Math.hypot(x-access.aimXDeg,y-access.aimYDeg);
    const toleranceDeg=Math.max(.05,Math.atan(Math.max(0,plan.metrics.swathKm-urbanMission.target.widthKm)/2/(pointAt(points,state.time).geodetic.altM/1000))/rad);
    const window=windows.find(window=>state.time>=window.start&&state.time<window.end);
    return {...access,xDeg:x,yDeg:y,errorDeg,toleranceDeg,remainingSec:window?Math.max(0,Math.min(end,window.end)-state.time):0,aligned:access.available&&errorDeg<=toleranceDeg};
  }
  function setAim(x,y){
    if(state.status!=='IN_ORBIT'||state.captured||!Number.isFinite(x)||!Number.isFinite(y))return false;
    x=clamp(x,-30,30);y=clamp(y,-30,30);
    if(Math.hypot(x,y)>30){const scale=30/Math.hypot(x,y);x*=scale;y*=scale;}
    state.aimMode='manual';state.aimXDeg=x;state.aimYDeg=y;return true;
  }
  function advance(seconds) {
    const until=Math.min(end,state.time+Math.max(0,seconds));
    while(state.time<until && state.status==='IN_ORBIT') {
      let dt=Math.min(1,until-state.time);
      const boundary=passes.find(pass=>pass.losTime>state.time);
      if(boundary)dt=Math.min(dt,(boundary.aosTime>state.time?boundary.aosTime:boundary.losTime)-state.time);
      if(state.downlink&&state.captured&&contactAt(passes,state.time))dt=Math.min(dt,Math.max(0,plan.metrics.imageMB-state.deliveredMB)*8/radio.downlinkSpeedMbps);
      const p=pointAt(points,state.time+dt/2);
      const contact=contactAt(passes,state.time+dt/2);
      const transmitting=state.downlink&&state.captured&&contact&&state.deliveredMB<plan.metrics.imageMB;
      const demand=idleW+(transmitting ? (radio.operationalPowerW||0)-(radio.standbyPowerW||0):0);
      const generation=solar.powerSunW*.85*(p.sunFraction ?? (p.isEclipse?0:1));
      const delta=(generation-demand)*dt/3600;
      if(demand-generation>battery.maxDischargeRateW || state.batteryWh+delta < floor-1e-8) { state.status='POWER_LOSS'; state.downlink=false; break; }
      state.batteryWh=clamp(state.batteryWh+delta,floor,capacity);
      if(transmitting) state.deliveredMB=Math.min(plan.metrics.imageMB,state.deliveredMB+radio.downlinkSpeedMbps*dt/8);
      state.time+=dt;
      if(state.captured&&state.deliveredMB>=plan.metrics.imageMB-1e-8){state.status='COMPLETE';state.downlink=false;}
    }
    if(state.time>=end&&state.status==='IN_ORBIT') state.status='WINDOW_ENDED';
    return state;
  }
  function captureReadiness() {
    const access=aiming();
    if(state.captured)return {ready:false,reason:'Image captured'};
    if(state.status!=='IN_ORBIT')return {ready:false,reason:'Flight stopped'};
    if(!access.available)return {ready:false,reason:'Outside capture window'};
    if(!access.aligned)return {ready:false,reason:'Center the gold target inside the sensor frame'};
    const extraW=(camera.operationalPowerW||0)-(camera.standbyPowerW||0)+(camera.focalLengthOptions?.find(o=>o.focalLengthM===plan.settings.focalLengthM)?.powerDeltaW||0);
    const energy=extraW*2/3600;
    if(state.batteryWh-energy<=floor)return {ready:false,reason:'Battery reserve too low'};
    return {ready:true,reason:'Ready to capture',energy,access};
  }
  function capture() {
    const readiness=captureReadiness();
    if(!readiness.ready)return false;
    const {energy,access}=readiness;
    state.batteryWh-=energy;
    state.captured=true; state.captureTime=state.time; state.captureGsdM=access.gsdM;
    state.captureAimMode=state.aimMode;state.captureAimErrorDeg=access.errorDeg;
    state.captureScore=Math.round(100*clamp(.6*(1-access.errorDeg/access.toleranceDeg)+.4*Math.min(1,plan.metrics.gsdM/access.gsdM),0,1));
    state.captureFrame=cameraFrame(access,pointAt(points,state.time).geodetic.altM/1000,plan.metrics.swathKm);
    return true;
  }
  function nextEvent() {
    if(state.status!=='IN_ORBIT')return null;
    if(!state.captured) return imagingTimes.find(time=>time>state.time) ?? null;
    const pass=passes.find(p=>p.losTime>state.time+1);
    if(!pass)return null;
    return state.time>=pass.aosTime ? Math.min(pass.losTime,state.time+Math.ceil((plan.metrics.imageMB-state.deliveredMB)*8/radio.downlinkSpeedMbps)+1) : pass.aosTime;
  }
  function opportunity(kind){
    if(kind==='target'){
      const window=windows.find(window=>window.end>state.time);
      return window?{time:Math.max(state.time,window.start),endTime:Math.min(end,window.end),active:window.start<=state.time}:null;
    }
    const pass=passes.find(pass=>pass.losTime>state.time);
    return pass?{time:Math.max(state.time,pass.aosTime),endTime:pass.losTime,active:pass.aosTime<=state.time,capacityMB:Math.max(0,pass.losTime-Math.max(state.time,pass.aosTime))*radio.downlinkSpeedMbps/8}:null;
  }
  function deliveryStatus(){
    const pass=opportunity('station'),remainingMB=Math.max(0,plan.metrics.imageMB-state.deliveredMB);
    return {remainingMB,deliveredMB:state.deliveredMB,totalMB:plan.metrics.imageMB,percent:Math.min(100,state.deliveredMB/plan.metrics.imageMB*100),rateMbps:radio.downlinkSpeedMbps,contact:pass?.active||false,nextContactTime:pass?.time??null,contactEnd:pass?.active?pass.endTime:null,contactSecondsNeeded:remainingMB*8/radio.downlinkSpeedMbps};
  }
  return { state, capacity, floor, points, passes, end, advance, capture, captureReadiness, nextEvent, aiming, setAim, opportunity, deliveryStatus,
    current:()=>pointAt(points,state.time), access:()=>targetAccess(pointAt(points,state.time),plan), contact:()=>contactAt(passes,state.time) };
}

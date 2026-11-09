import { disasterMission as mission, disasterRegions as regions } from './data/mission-config.js';
import { runSeasonDay, seasonScore } from './agriculture-engine.js';
import { missionUnlocked } from './progression.js';
const epoch=Date.parse(mission.epoch)/1000;
function hash(seed,value){let x=(seed^Math.imul(value+1,2654435761))>>>0;x^=x>>>16;x=Math.imul(x,2246822507);x^=x>>>13;return x>>>0;}
export function createDisaster(plan,catalog){
  const seed=plan.settings.seed,battery=catalog.find(p=>p.id===plan.components.eps_battery);
  const types=['Flood assessment','Wildfire mapping','Storm damage','Landslide survey'];
  const requests=Array.from({length:60},(_,i)=>{
    const n=hash(seed,i),region=regions[n%regions.length],day=Math.floor(i/2)*3+(i%2)*.25;
    const urgent=n%3===0,deadline=Math.min(90,day+(urgent?2:4));
    return {id:`alert-${i}`,regionId:region.id,title:types[n%types.length],weight:urgent?3:1,
      opensAt:epoch+day*86400,deadlineAt:epoch+deadline*86400,opensDay:day,closesDay:deadline,
      captured:false,completed:false,deliveredMB:0,totalMB:plan.metrics.imageMB};
  });
  return {day:0,status:'ACTIVE',seed,runId:`${seed}-${Date.now()}`,batteryWh:battery.capacityWh,minimumBatteryWh:battery.capacityWh,
    deliveredMB:0,priorities:requests.filter(r=>r.opensAt<=epoch).map(r=>r.id).slice(0,3),downlink:true,
    queueOrder:'deadline',payloadOffline:false,wheelFault:false,batteryFactor:1,appliedEvents:[],requests,
    log:['Operations ready. Select urgent requests; run one six-hour command at a time.']};
}
export function disasterConditions(state){
  const turn=Math.floor(state.day*4+1e-8),seed=state.seed;
  const outageStart=9+hash(seed,900)%4;
  const stationOutage=state.day>=outageStart&&(state.day-outageStart)%13<.5;
  const cloudRegions=regions.filter((r,i)=>hash(seed,turn*10+i+1000)%4===0).map(r=>r.id);
  return {stationOutage,cloudRegions,payloadOffline:state.payloadOffline,wheelFault:state.wheelFault,batteryFactor:state.batteryFactor};
}
export function applyDisasterEvents(state){
  const day=state.day,events=state.appliedEvents;
  const emit=(id,message,apply)=>{if(events.includes(id))return;events.push(id);apply();state.log.unshift(`Day ${day}: ${message}`);};
  for(const d of [20,45,70])if(day>=d)emit(`battery-${d}`,'Battery capacity degraded by 4%.',()=>{state.batteryFactor*=.96;});
  for(let d=5+hash(state.seed,901)%4;d<90;d+=17)if(day>=d)emit(`payload-${d}`,'Payload reset fault — reset the camera to restore imaging.',()=>{state.payloadOffline=true;});
  for(let d=7+hash(state.seed,902)%4;d<90;d+=23)if(day>=d)emit(`wheel-${d}`,'Wheel fault — off-nadir pointing limited to 8° until recalibrated.',()=>{state.wheelFault=true;});
}
export function runDisasterTurn(plan,catalog,previous,points,passes){
  if(previous.status!=='ACTIVE'||previous.day>=90)return previous;
  const prepared=structuredClone(previous);applyDisasterEvents(prepared);
  const conditions=disasterConditions(prepared);
  prepared.requests.sort((a,b)=>prepared.queueOrder==='priority'?b.weight-a.weight||a.deadlineAt-b.deadlineAt:a.deadlineAt-b.deadlineAt||b.weight-a.weight);
  const camera=catalog.find(p=>p.id===plan.components.payload);
  const result=runSeasonDay(plan,catalog,prepared,points,conditions.stationOutage?[]:passes,{
    mission,regions,durationSec:mission.turnSec,requestPriorities:true,
    maxLookDeg:conditions.wheelFault?8:Math.min(45,camera.maxOffNadirDeg||30),
    batteryFactor:prepared.batteryFactor,cameraUnavailable:prepared.payloadOffline,cloudRegions:conditions.cloudRegions,
  });
  result.priorities=result.priorities.filter(id=>result.requests.some(r=>r.id===id&&!r.captured&&!r.completed&&!r.expired));
  return result;
}
export function recoverDisaster(previous,plan,catalog,kind){
  if(previous.status!=='ACTIVE'||!['payload','wheels'].includes(kind))return previous;
  const flag=kind==='payload'?'payloadOffline':'wheelFault';if(!previous[flag])return previous;
  const battery=catalog.find(p=>p.id===plan.components.eps_battery),cost=kind==='payload'?.05:.1;
  if(previous.batteryWh-cost<=battery.capacityWh*previous.batteryFactor*(1-battery.maxDoD))return previous;
  return {...previous,[flag]:false,batteryWh:previous.batteryWh-cost,
    minimumBatteryWh:Math.min(previous.minimumBatteryWh,previous.batteryWh-cost),
    log:[`${kind==='payload'?'Payload reset':'Wheels recalibrated'} · ${cost} Wh recovery cost.`,...previous.log].slice(0,20)};
}
export function discardDisasterImage(previous,id){
  if(previous.status!=='ACTIVE')return previous;
  const r=previous.requests.find(r=>r.id===id&&r.captured&&!r.completed&&!r.expired);if(!r)return previous;
  const state=structuredClone(previous);state.requests.find(r=>r.id===id).expired=true;
  state.log.unshift(`Discarded ${r.title}; remaining image buffer released. Request earns no credit.`);state.log=state.log.slice(0,20);return state;
}
export function completeDisaster(save,state,plan){
  if(!['COMPLETE','POWER_LOSS','TARGET_MISSED'].includes(state.status)||!missionUnlocked(save,'disaster'))return save;
  if((state.status==='COMPLETE'||state.status==='TARGET_MISSED')&&state.day!==90)return save;
  const share=seasonScore(state),history=save.disasterRuns||[];
  let result=history.some(r=>r.runId===state.runId)?save:{...save,disasterRuns:[...history,{runId:state.runId,seed:state.seed,status:state.status,day:state.day,weightedShare:share}].slice(-5)};
  if(state.status!=='COMPLETE'||state.day!==90||!Number.isFinite(plan.settings.requiredShare)||plan.settings.requiredShare<.5||plan.settings.requiredShare>1||share+1e-8<plan.settings.requiredShare||save.missionProgress?.disaster?.completed)return result;
  return {...result,player:{...save.player,stats:{...save.player?.stats,contractsCompleted:(save.player?.stats?.contractsCompleted||0)+1}},
    missionProgress:{...save.missionProgress,disaster:{completed:true,completedAt:new Date().toISOString(),weightedShare:share,seed:state.seed,deliveredMB:state.deliveredMB}}};
}

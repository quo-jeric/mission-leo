import {describe,it,expect} from 'vitest';
import data from '../../server/data/components.json';
import {disasterMission as mission,disasterRegions} from '../../client/js/data/mission-config.js';
import {evaluateMission} from '../../client/js/engineering.js';
import {createDisaster,runDisasterTurn,disasterConditions,recoverDisaster,discardDisasterImage,completeDisaster} from '../../client/js/disaster-engine.js';
import {runSeasonDay,seasonScore,storedMB} from '../../client/js/agriculture-engine.js';
const catalog=data.components;
const design={missionId:'disaster',components:mission.starter,settings:mission.defaults,credits:84250};
const report=evaluateMission(design,catalog);
const plan={components:mission.starter,settings:mission.defaults,metrics:report.metrics};
const epoch=Date.parse(mission.epoch)/1000;
const points=day=>Array.from({length:721},(_,i)=>({time:epoch+day*86400+i*30,geodetic:{latDeg:1.3,lonDeg:103.77,altM:500000},sunFraction:1,isEclipse:false}));
const save={player:{credits:84250,stats:{launches:3,contractsCompleted:2}},missionProgress:{urban:{completed:true},agriculture:{completed:true}}};
describe('disaster response operations',()=>{
  it('validates the starter and rejects unknown seeds or unreachable designs',()=>{
    expect(report.ready).toBe(true);
    expect(report.metrics.totalUSD).toBe(565750);
    for(const seed of [0,1.5,1000000,NaN])expect(evaluateMission({...design,settings:{...design.settings,seed}},catalog).ready).toBe(false);
  });
  it('generates reproducible requests and forecast conditions for a seed',()=>{
    const a=createDisaster(plan,catalog),b=createDisaster(plan,catalog);
    expect(a.requests).toEqual(b.requests);expect(a.requests).toHaveLength(60);
    expect(disasterConditions(a)).toEqual(disasterConditions(b));
    expect(createDisaster({...plan,settings:{...plan.settings,seed:13}},catalog).requests).not.toEqual(a.requests);
    expect(a.requests.every(r=>r.deadlineAt>r.opensAt&&r.deadlineAt<=epoch+90*86400)).toBe(true);
  });
  it('integrates partial transmission only until the exact request deadline',()=>{
    const state=createDisaster(plan,catalog);state.day=89.75;state.priorities=[];
    state.requests=[{...state.requests[0],id:'deadline',captured:true,totalMB:1,deliveredMB:0,opensAt:epoch,deadlineAt:epoch+state.day*86400+.5}];
    const start=epoch+state.day*86400;
    const result=runSeasonDay(plan,catalog,state,points(state.day),[{aosTime:start,losTime:start+21600}],{mission,regions:disasterRegions,durationSec:21600,requestPriorities:true,cameraUnavailable:true});
    expect(result.requests[0].deliveredMB).toBeCloseTo(.3125,8);
    expect(result.requests[0].expired).toBe(true);expect(result.requests[0].completed).toBe(false);
    expect(seasonScore(result)).toBe(0);expect(result.status).toBe('TARGET_MISSED');
    expect(state.requests[0].deliveredMB).toBe(0);
  });
  it('blocks station transmission during a reproducible outage',()=>{
    const state=createDisaster(plan,catalog);state.priorities=[];
    for(let day=0;day<90;day+=.25){state.day=day;if(disasterConditions(state).stationOutage)break;}
    expect(disasterConditions(state).stationOutage).toBe(true);
    const start=epoch+state.day*86400;
    state.requests=[{...state.requests[0],captured:true,completed:false,totalMB:1,deliveredMB:0,opensAt:epoch,deadlineAt:start+86400}];
    const result=runDisasterTurn(plan,catalog,state,points(state.day),[{aosTime:start,losTime:start+21600}]);
    expect(result.deliveredMB).toBe(0);expect(result.requests[0].completed).toBe(false);
  });
  it('charges recovery energy, respects reserve and releases discarded image storage',()=>{
    const state=createDisaster(plan,catalog);state.payloadOffline=state.wheelFault=true;
    const reset=recoverDisaster(state,plan,catalog,'payload');
    expect(reset.payloadOffline).toBe(false);expect(reset.batteryWh).toBeCloseTo(49.95,8);
    expect(state.payloadOffline).toBe(true);
    const low={...state,batteryWh:10.01};expect(recoverDisaster(low,plan,catalog,'payload')).toBe(low);
    state.requests[0].captured=true;state.requests[0].deliveredMB=10;
    const before=storedMB(state),dropped=discardDisasterImage(state,state.requests[0].id);
    expect(storedMB(dropped)).toBeLessThan(before);expect(dropped.requests[0].expired).toBe(true);
    expect(seasonScore(dropped)).toBe(0);
  });
  it('does not repeat a degradation event on the next six-hour turn',()=>{
    const state=createDisaster(plan,catalog);state.day=20;state.priorities=[];
    const first=runDisasterTurn(plan,catalog,state,points(20),[]);
    const next=runDisasterTurn(plan,catalog,first,points(20.25),[]);
    expect(first.batteryFactor).toBeCloseTo(.96,10);expect(next.batteryFactor).toBe(first.batteryFactor);
  });
  it('records day-90 success once, preserves funds, and compares seeded attempts',()=>{
    const state=createDisaster(plan,catalog);state.day=90;state.status='COMPLETE';
    state.requests.forEach(r=>{r.completed=true;r.captured=true;r.deliveredMB=r.totalMB;});
    const early={...state,day:89.75};expect(completeDisaster(save,early,plan).missionProgress.disaster).toBeUndefined();
    const result=completeDisaster(save,state,plan);
    expect(result.player.stats.contractsCompleted).toBe(3);expect(result.player.credits).toBe(84250);
    expect(result.missionProgress.disaster.completed).toBe(true);
    expect(completeDisaster(result,state,plan)).toBe(result);
    expect(completeDisaster({},state,plan).missionProgress).toBeUndefined();
    const failed={...state,runId:'failed-seed',status:'TARGET_MISSED'};
    const compared=completeDisaster(result,failed,plan);
    expect(compared.disasterRuns).toHaveLength(2);expect(compared.player.stats.contractsCompleted).toBe(3);
  });
});

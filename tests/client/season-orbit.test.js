import { describe, it, expect } from 'vitest';
import data from '../../server/data/components.json';
import { agricultureMission, farmingRegions, disasterMission, disasterRegions } from '../../client/js/data/mission-config.js';
import { evaluateMission } from '../../client/js/engineering.js';
import { createSeason, seasonScore, completeSeason } from '../../client/js/agriculture-engine.js';
import { createDisaster, disasterConditions } from '../../client/js/disaster-engine.js';
import { createSeasonOrbit, orbitalSeasonState } from '../../client/js/season-orbit-engine.js';
import { sunVector, gmst } from '../../client/js/orbit-engine.js';

function fixture(mission=agricultureMission,previous) {
  const catalog=data.components,epoch=Date.parse(mission.epoch)/1000;
  const plan={components:mission.starter,settings:mission.defaults,metrics:evaluateMission({missionId:mission.id,components:mission.starter,settings:mission.defaults,credits:250000},catalog).metrics};
  const state=previous|| (mission.id==='disaster'?createDisaster(plan,catalog):createSeason(plan,catalog));
  const time=epoch+state.day*86400,sun=sunVector(time),rad=Math.PI/180;
  // Synthetic subsolar ground position isolates commands/resources from propagation.
  const latDeg=Math.asin(sun[2])/rad,lonDeg=((Math.atan2(sun[1],sun[0])-gmst(time))/rad%360+540)%360-180;
  const regions=(mission.id==='disaster'?disasterRegions:farmingRegions).map(r=>({...r,latDeg,lonDeg}));
  const points=Array.from({length:21},(_,i)=>({time:time+i*30,geodetic:{latDeg,lonDeg,altM:500000},isEclipse:false,sunFraction:1}));
  const passes=[{aosTime:time,losTime:time+600}];
  return {plan,catalog,epoch,state,regions,points,passes,engine:createSeasonOrbit(plan,catalog,mission,regions,{points},passes,state)};
}
describe('manual orbital gameplay for seasonal missions',()=>{
  it('never auto-captures or auto-transmits, and credits only full station delivery',()=>{
    const {engine:e,state}=fixture();
    e.advance(30);
    expect(e.state.requests.some(r=>r.captured)).toBe(false);
    e.state.aimMode='auto';expect(e.capture()).toBe(true);
    e.advance(30);expect(e.request().deliveredMB).toBe(0);
    expect(seasonScore(e.state)).toBe(0);
    e.state.downlink=true;e.advance(60);
    expect(e.request().completed).toBe(true);
    expect(e.state.status).toBe('ACTIVE');
    expect(state.day).toBe(0);expect(state.requests.some(r=>r.captured)).toBe(false);
  });
  it('preserves old deliveries while migrating saves to explicit camera commands',()=>{
    const {state,plan,catalog,regions,points,passes}=fixture();
    state.requests[0].captured=true;state.requests[0].completed=true;state.requests[0].deliveredMB=state.requests[0].totalMB;
    const migrated=orbitalSeasonState(state,agricultureMission);
    expect(migrated.downlink).toBe(false);expect(migrated.requests[0].completed).toBe(true);
    const e=createSeasonOrbit(plan,catalog,agricultureMission,regions,{points},passes,migrated);
    e.state.downlink=true;e.advance(30);
    const resumed=createSeasonOrbit(plan,catalog,agricultureMission,regions,{points},passes,e.state);
    expect(resumed.state.day).toBe(e.state.day);expect(resumed.state.downlink).toBe(true);
    expect(resumed.state.batteryWh).toBe(e.state.batteryWh);
  });
  it('splits partial downlink at the exact deadline and never awards late credit',()=>{
    const f=fixture(),r=f.state.requests[0];
    r.captured=true;r.totalMB=48;r.deadlineAt=f.epoch+.5;
    f.state.controlMode='orbital';f.state.downlink=true;
    const e=createSeasonOrbit(f.plan,f.catalog,agricultureMission,f.regions,{points:f.points},f.passes,f.state);
    e.advance(30);
    expect(e.state.requests[0].deliveredMB).toBeCloseTo(.3125);
    expect(e.state.requests[0].expired).toBe(true);expect(seasonScore(e.state)).toBe(0);
  });
  it('enforces disaster cloud/fault gates and a reduced wheel-fault aiming limit',()=>{
    const f=fixture(disasterMission),e=f.engine;
    e.state.payloadOffline=true;e.state.aimMode='auto';
    expect(e.readiness().reason).toContain('Reset');expect(e.capture()).toBe(false);
    e.state.payloadOffline=false;e.state.wheelFault=true;e.setAim(30,30);
    expect(Math.hypot(e.state.aimXDeg,e.state.aimYDeg)).toBeCloseTo(8);
    const r=e.request();e.state.payloadOffline=false;e.state.wheelFault=false;e.state.aimMode='auto';
    // Choose a reproducible cloud-covered region while keeping the same target geometry.
    r.regionId=disasterConditions(e.state).cloudRegions[0]||r.regionId;
    if(disasterConditions(e.state).cloudRegions.includes(r.regionId))expect(e.capture()).toBe(false);
    expect(e.state.requests.some(r=>r.captured)).toBe(false);
  });
  it('ends at the exact final day and records completion once without changing funds',()=>{
    const original=fixture(),s=original.state;s.day=120-60/86400;
    s.requests.forEach(r=>Object.assign(r,{captured:true,completed:true,deliveredMB:r.totalMB}));
    const {engine:e,plan}=fixture(agricultureMission,s);e.advance(60);
    expect(e.state.day).toBe(120);expect(e.state.status).toBe('COMPLETE');
    const save={player:{credits:12345,stats:{launches:2,contractsCompleted:1}},missionProgress:{urban:{completed:true}}};
    const completed=completeSeason(save,e.state,plan);
    expect(completed.player.credits).toBe(12345);expect(completed.player.stats.contractsCompleted).toBe(2);
    expect(completeSeason(completed,e.state,plan)).toBe(completed);
  });
});

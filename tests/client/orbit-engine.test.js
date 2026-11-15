import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFlight, targetAccess } from '../../client/js/orbit-engine.js';
import { evaluateMission } from '../../client/js/engineering.js';
import { urbanMission } from '../../client/js/data/mission-config.js';
const { components }=JSON.parse(readFileSync(new URL('../../server/data/components.json',import.meta.url),'utf8'));
const design={missionId:'urban',components:urbanMission.starter,settings:urbanMission.defaults,credits:250000};
const plan={...evaluateMission(design,components),components:design.components,target:urbanMission.target};
const epoch=Date.parse('2026-11-07T02:00:00Z')/1000;
const point=(time,overrides={})=>({time,geodetic:{latDeg:1.3,lonDeg:103.77,altM:500000},isEclipse:false,sunFraction:1,...overrides});
const path=(duration=600,eclipse=false)=>({points:Array.from({length:duration/10+1},(_,i)=>point(epoch+i*10,{isEclipse:eclipse,sunFraction:eclipse?0:1}))});

describe('orbital operations',()=>{
  it('requires a sunlit target, acceptable look angle and delivered resolution',()=>{
    expect(targetAccess(point(epoch),plan).available).toBe(true);
    expect(targetAccess(point(epoch,{isEclipse:true}),plan).available).toBe(false);
    expect(targetAccess(point(epoch,{geodetic:{latDeg:50,lonDeg:0,altM:500000}}),plan).available).toBe(false);
    const night=point(Date.parse('2026-11-07T14:00:00Z')/1000);
    expect(targetAccess(night,plan).available).toBe(false);
    expect(targetAccess(point(epoch),{...plan,metrics:{...plan.metrics,gsdM:4}}).available).toBe(false);
  });
  it('captures once and transmits only within contact, including jumps across boundaries',()=>{
    const flight=createFlight(plan,components,path(),[{aosTime:epoch+100,losTime:epoch+110}]);
    expect(flight.capture()).toBe(true);
    expect(flight.capture()).toBe(false);
    flight.state.downlink=true;
    flight.advance(120);
    expect(flight.state.deliveredMB).toBeCloseTo(6.25);
    flight.advance(100);
    expect(flight.state.deliveredMB).toBeCloseTo(6.25);
  });
  it('does not transmit empty storage or mark partial delivery complete',()=>{
    const flight=createFlight(plan,components,path(),[{aosTime:epoch,losTime:epoch+30}]);
    flight.state.downlink=true;flight.advance(10);
    expect(flight.state.deliveredMB).toBe(0);
    flight.capture();flight.advance(30);
    expect(flight.state.deliveredMB).toBeCloseTo(12.5);
    expect(flight.state.status).toBe('IN_ORBIT');
  });
  it('finishes exactly at complete-image delivery and stops the clock',()=>{
    const flight=createFlight(plan,components,path(),[{aosTime:epoch,losTime:epoch+200}]);
    flight.capture();flight.state.downlink=true;flight.advance(200);
    expect(flight.state.status).toBe('COMPLETE');
    expect(flight.state.deliveredMB).toBe(48);
    const time=flight.state.time;flight.advance(100);
    expect(flight.state.time).toBe(time);
  });
  it('integrates battery over jumps, stops at reserve and never resumes transmission automatically',()=>{
    const flight=createFlight(plan,components,path(36000,true),[]);
    flight.advance(36000);
    expect(flight.state.status).toBe('POWER_LOSS');
    expect(flight.state.batteryWh).toBeGreaterThanOrEqual(flight.floor);
    const resumed=createFlight(plan,components,path(),[],{time:epoch+30,batteryWh:30,captured:true,deliveredMB:10,downlink:true,status:'IN_ORBIT'});
    expect(resumed.state.downlink).toBe(false);
    expect(resumed.state.deliveredMB).toBe(10);
  });
});

describe('manual camera aiming',()=>{
  const offAxisPath={points:[0,10,20,30].map(dt=>point(epoch+dt,{geodetic:{latDeg:1.3,lonDeg:103.9,altM:500000}}))};
  it('requires alignment and preserves energy when a misaligned capture is rejected',()=>{
    const flight=createFlight(plan,components,offAxisPath,[]);
    expect(flight.access().available).toBe(true);
    expect(flight.aiming().aligned).toBe(false);
    const energy=flight.state.batteryWh;
    expect(flight.capture()).toBe(false);
    expect(flight.state.batteryWh).toBe(energy);
    const target=flight.aiming();flight.setAim(target.aimXDeg,target.aimYDeg);
    expect(flight.capture()).toBe(true);
    expect(flight.state.captureAimMode).toBe('manual');
    expect(flight.state.captureScore).toBeGreaterThan(90);
  });
  it('supports assisted alignment without bypassing eclipse or target limits',()=>{
    const flight=createFlight(plan,components,offAxisPath,[]);
    flight.state.aimMode='auto';
    expect(flight.aiming().aligned).toBe(true);
    expect(flight.capture()).toBe(true);
    const dark=createFlight(plan,components,path(600,true),[]);
    dark.state.aimMode='auto';expect(dark.capture()).toBe(false);
  });
  it('clamps manual controls, rejects invalid values and persists aiming on resume',()=>{
    const flight=createFlight(plan,components,offAxisPath,[]);
    flight.setAim(30,30);
    expect(Math.hypot(flight.state.aimXDeg,flight.state.aimYDeg)).toBeCloseTo(30);
    expect(flight.setAim(NaN,0)).toBe(false);
    const resumed=createFlight(plan,components,offAxisPath,[],{...flight.state});
    expect(resumed.state.aimXDeg).toBe(flight.state.aimXDeg);
  });
});

describe('Earth map pass planning',()=>{
  it('reports active imaging access and remaining station capacity without changing the flight',()=>{
    const flight=createFlight(plan,components,path(),[{aosTime:epoch+100,losTime:epoch+110}]);
    const before=JSON.stringify(flight.state);
    expect(flight.opportunity('target').active).toBe(true);
    expect(flight.opportunity('station')).toMatchObject({time:epoch+100,active:false,capacityMB:6.25});
    expect(JSON.stringify(flight.state)).toBe(before);
    flight.advance(105);
    expect(flight.opportunity('station')).toMatchObject({time:epoch+105,active:true,capacityMB:3.125});
    flight.advance(5);
    expect(flight.opportunity('station')).toBeNull();
    expect(flight.state.captured).toBe(false);
    expect(flight.state.deliveredMB).toBe(0);
  });
});

describe('capture readiness feedback',()=>{
  it('uses the same battery and flight gates as capture without consuming resources',()=>{
    const flight=createFlight(plan,components,path(),[]);
    flight.state.aimMode='auto';
    const energy=flight.state.batteryWh;
    expect(flight.captureReadiness().ready).toBe(true);
    expect(flight.state.batteryWh).toBe(energy);
    flight.state.batteryWh=flight.floor+.00001;
    expect(flight.captureReadiness()).toMatchObject({ready:false,reason:'Battery reserve too low'});
    expect(flight.capture()).toBe(false);
    flight.state.batteryWh=energy;
    expect(flight.capture()).toBe(true);
    expect(flight.captureReadiness()).toMatchObject({ready:false,reason:'Image captured'});
  });
});

describe('downlink delivery accuracy',()=>{
  it('splits fractional contact boundaries instead of granting data outside the pass',()=>{
    const flight=createFlight(plan,components,path(),[{aosTime:epoch+.25,losTime:epoch+1.25}]);
    flight.capture();flight.state.downlink=true;flight.advance(2);
    expect(flight.state.deliveredMB).toBeCloseTo(.625,8);
    expect(flight.deliveryStatus().remainingMB).toBeCloseTo(47.375,8);
    flight.advance(20);
    expect(flight.state.deliveredMB).toBeCloseTo(.625,8);
  });
  it('stops at the exact remaining transmission duration and reports full delivery',()=>{
    const flight=createFlight(plan,components,path(),[{aosTime:epoch,losTime:epoch+200}]);
    flight.capture();flight.state.downlink=true;flight.advance(200);
    expect(flight.state.time-epoch).toBeCloseTo(76.8,5);
    expect(flight.deliveryStatus()).toMatchObject({deliveredMB:48,remainingMB:0,percent:100});
    expect(flight.state.status).toBe('COMPLETE');
  });
});

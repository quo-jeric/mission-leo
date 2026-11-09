import { describe, it, expect } from 'vitest';
import { captureApproach } from '../../client/js/capture-approach.js';
const input={active:true,captured:false,ready:false,available:false,now:1000,nextTime:2000,distanceKm:3000};
describe('capture approach cues',()=>{
  it('stays quiet when far away and counts simulated seconds to the window',()=>{
    const c=captureApproach(input);expect(c.phase).toBe('travel');expect(c.beat).toBe(0);expect(c.title).toBe('Capture window in 16 min 40 s');
  });
  it('accelerates only during the last five simulated minutes',()=>{
    const near=captureApproach({...input,nextTime:1300}),close=captureApproach({...input,nextTime:1060});
    expect(near.phase).toBe('near');expect(near.beat).toBe(1400);expect(close.beat).toBe(650);expect(close.progress).toBe(80);
  });
  it('distinguishes aim-in-range from readiness and exposes remaining window time',()=>{
    expect(captureApproach({...input,available:true,reason:'Center the gold target inside the sensor frame'}).phase).toBe('align');
    const c=captureApproach({...input,available:true,ready:true,remainingSec:45});expect(c.phase).toBe('ready');expect(c.detail).toBe('0 min 45 s left in this imaging window');
  });
  it('never signals ready through clouds, faults or storage restrictions',()=>{
    for(const reason of ['Cloud cover blocks this target','Reset the payload to restore imaging','Storage full — downlink queued images first']){
      const c=captureApproach({...input,available:true,reason});expect(c.phase).toBe('blocked');expect(c.beat).toBe(0);expect(c.title).toBe(reason);
    }
  });
  it('does not invent an arrival time when predictions are missing or past',()=>{
    for(const nextTime of [null,undefined,NaN,999]){const c=captureApproach({...input,nextTime});expect(c.title).toBe('No imaging window predicted');expect(c.beat).toBe(0);}
  });
  it('stops cues after capture or a terminal flight state',()=>{
    expect(captureApproach({...input,captured:true,ready:true}).phase).toBe('idle');
    expect(captureApproach({...input,active:false,ready:true}).beat).toBe(0);
  });
});

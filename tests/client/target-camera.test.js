import { describe, it, expect } from 'vitest';
import { cameraFrame } from '../../client/js/target-camera.js';

describe('instrument capture framing',()=>{
  it('centers the target when instrument and target bearings match',()=>{
    expect(cameraFrame({xDeg:10,yDeg:-3,aimXDeg:10,aimYDeg:-3},500,15)).toEqual({eastKm:0,northKm:0,swathKm:15,version:1});
  });
  it('moves the field east/north with manual aim and scales with altitude',()=>{
    const aim={xDeg:1,yDeg:-1,aimXDeg:0,aimYDeg:0};
    const low=cameraFrame(aim,400,12),high=cameraFrame(aim,600,18);
    expect(low.eastKm).toBeGreaterThan(0);
    expect(low.northKm).toBeLessThan(0);
    expect(high.eastKm/low.eastKm).toBeCloseTo(1.5);
    expect(high.swathKm).toBe(18);
  });
});

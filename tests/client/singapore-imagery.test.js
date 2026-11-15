import { describe, it, expect } from 'vitest';
import { imageryFootprint, singaporeImagery } from '../../client/js/singapore-imagery.js';
describe('Singapore imagery georeferencing',()=>{
  it('centres a square sensor crop at the supplied geographic position',()=>{
    const center={latDeg:1.3,lonDeg:103.77};
    const b=imageryFootprint(center,15,320,320);
    expect((b.west+b.east)/2).toBeCloseTo(center.lonDeg,9);
    expect((b.south+b.north)/2).toBeCloseTo(center.latDeg,9);
    expect((b.north-b.south)*111.195).toBeCloseTo(15,8);
    expect(b.west).toBeGreaterThan(singaporeImagery.west);
    expect(b.east).toBeLessThan(singaporeImagery.east);
  });
  it('keeps the same sensor height when showing wider surrounding context',()=>{
    const center={latDeg:1.3,lonDeg:103.77};
    const square=imageryFootprint(center,15,320,320),wide=imageryFootprint(center,15,900,500);
    expect(wide.north).toBe(square.north);
    expect(wide.south).toBe(square.south);
    expect(wide.east-wide.west).toBeCloseTo((square.east-square.west)*1.8,8);
  });
});

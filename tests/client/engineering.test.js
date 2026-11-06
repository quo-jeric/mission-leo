import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateMission, missionInputKey } from '../../client/js/engineering.js';
import { urbanMission } from '../../client/js/data/mission-config.js';

const { components } = JSON.parse(readFileSync(new URL('../../server/data/components.json', import.meta.url), 'utf8'));
const design = () => ({ missionId: 'urban', credits: 250000, components: { ...urbanMission.starter }, settings: { ...urbanMission.defaults } });
const passes = (report, id) => report.checks.find(check => check.id === id).passed;

describe('Urban mission preflight', () => {
  it('provides a feasible beginner design including launch and configured optics', () => {
    const input = design(), original = JSON.stringify(input);
    const report = evaluateMission(input, components);
    expect(report.ready).toBe(true);
    expect(report.metrics).toMatchObject({ totalUSD: 565750, availableUSD: 650000, wetMassKg: 8.85, gsdM: 2.5, imageMB: 48 });
    expect(JSON.stringify(input)).toBe(original);
  });
  it('rejects insufficient optics, fixed-orbit changes, and unaffordable dedicated launches', () => {
    const input = design();
    input.settings.focalLengthM = .5;
    expect(passes(evaluateMission(input, components), 'optics')).toBe(false);
    input.settings.altitudeKm = 450;
    expect(passes(evaluateMission(input, components), 'launch')).toBe(false);
    input.settings.launchServiceId = 'micro';
    expect(passes(evaluateMission(input, components), 'budget')).toBe(false);
  });
  it('requires pointing control, a flight computer, cooling and sufficient solar energy', () => {
    for (const [category, id, check] of [
      ['propulsion', 'adcs_mtq_detumble_0_25u', 'pointing'],
      ['cdh', 'cdh_ssr_16gb_0_5u', 'required-cdh'],
      ['eps_solar', 'eps_solar_si_deploy_20w', 'power'],
      ['tcs', undefined, 'thermal'],
    ]) {
      const input = design();
      if (id) input.components[category] = id; else delete input.components[category];
      expect(passes(evaluateMission(input, components), check)).toBe(false);
    }
  });
  it('counts secondary slots and rejects overflow, unknown parts and invalid orbit numbers', () => {
    const input = design();
    const constrained = components.map(part => part.id === 'bus_6u' ? { ...part, internalSlotsU: 5 } : part);
    expect(passes(evaluateMission(input, constrained), 'slots')).toBe(false);
    input.components.bus = 'missing'; input.settings.altitudeKm = NaN;
    const report = evaluateMission(input, components);
    expect(report.ready).toBe(false);
    expect(passes(report, 'catalog')).toBe(false);
    expect(passes(report, 'orbit')).toBe(false);
  });
  it('binds verification to inputs and funds regardless of property order', () => {
    const input = design();
    const reordered = { ...input, settings: Object.fromEntries(Object.entries(input.settings).reverse()), components: Object.fromEntries(Object.entries(input.components).reverse()) };
    expect(missionInputKey(reordered)).toBe(missionInputKey(input));
    expect(missionInputKey({ ...input, credits: 1 })).not.toBe(missionInputKey(input));
    expect(missionInputKey({ ...input, planningSupportUSD: 0 })).not.toBe(missionInputKey(input));
    expect(passes(evaluateMission({ ...input, planningSupportUSD: 0 }, components), 'budget')).toBe(false);
  });
});

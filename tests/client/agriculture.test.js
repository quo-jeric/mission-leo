import { describe, it, expect } from 'vitest';
import { agricultureMission as mission, farmingRegions } from '../../client/js/data/mission-config.js';
import { evaluateMission } from '../../client/js/engineering.js';
import { createSeason, runSeasonDay, seasonScore, completeSeason, storedMB } from '../../client/js/agriculture-engine.js';
import { completeMission, missionUnlocked } from '../../client/js/progression.js';
import data from '../../server/data/components.json';

const catalog = data.components;
const design = { missionId: mission.id, components: mission.starter, settings: mission.defaults, credits: 84250 };
const plan = { components: mission.starter, settings: mission.defaults, metrics: evaluateMission(design, catalog).metrics };
const epoch = Date.parse(mission.epoch) / 1000;
// Synthetic trajectory isolates resource/deadline rules from backend geometry.
function points(day, eclipse = false) {
  return Array.from({ length: 2881 }, (_, i) => ({ time: epoch + day * 86400 + i * 30,
    geodetic: { latDeg: farmingRegions[0].latDeg, lonDeg: farmingRegions[0].lonDeg, altM: 500000 },
    isEclipse: eclipse, sunFraction: eclipse ? 0 : 1 }));
}
const save = { player: { credits: 84250, stats: { launches: 2, contractsCompleted: 1 } }, missionProgress: { urban: { completed: true } } };
describe('agricultural season', () => {
  it('validates the affordable starter and rejects invalid season choices', () => {
    expect(evaluateMission(design, catalog).ready).toBe(true);
    for (const settings of [{ requiredShare: NaN }, { requiredShare: .1 }, { stationId: 'missing' }, { altitudeKm: 499 }]) {
      expect(evaluateMission({ ...design, settings: { ...design.settings, ...settings } }, catalog).ready).toBe(false);
    }
  });
  it('buffers captures, requires actual station throughput and never mutates the previous day', () => {
    const state = createSeason(plan, catalog);
    const next = runSeasonDay(plan, catalog, state, points(0), []);
    expect(next.requests.some(r => r.captured)).toBe(true);
    expect(storedMB(next)).toBeGreaterThan(0);
    expect(seasonScore(next)).toBe(0);
    expect(next.status).toBe('ACTIVE');
    expect(state.day).toBe(0);
    expect(state.requests.some(r => r.captured)).toBe(false);
    const delivered = runSeasonDay(plan, catalog, next, points(1), [{ aosTime: epoch + 86400, losTime: epoch + 172800 }]);
    expect(delivered.requests.some(r => r.completed)).toBe(true);
    expect(seasonScore(delivered)).toBeGreaterThan(0);
    expect(delivered.status).toBe('ACTIVE');
  });
  it('expires undelivered requests at the deadline and cannot earn late credit', () => {
    const state = createSeason(plan, catalog); state.day = 19;
    const next = runSeasonDay(plan, catalog, state, points(19), []);
    expect(next.requests.filter(r => r.closesDay === 20).every(r => r.expired)).toBe(true);
    expect(seasonScore(next)).toBe(0);
    expect(storedMB(next)).toBe(0);
  });
  it('stops at battery reserve and rejects incomplete daily predictions', () => {
    const state = createSeason(plan, catalog);
    expect(runSeasonDay(plan, catalog, state, points(0, true), []).status).toBe('POWER_LOSS');
    expect(() => runSeasonDay(plan, catalog, state, points(0).slice(0, 20), [])).toThrow('Incomplete');
  });
  it('completes only at day 120 with enough on-time deliveries and records the unlock once', () => {
    const state = createSeason(plan, catalog);
    state.requests.forEach(r => { r.completed = true; r.captured = true; r.deliveredMB = r.totalMB; });
    state.day = 119;
    expect(completeSeason(save, state, plan)).toBe(save);
    const final = runSeasonDay(plan, catalog, state, points(119), []);
    expect(final.status).toBe('COMPLETE');
    const result = completeSeason(save, final, plan);
    expect(missionUnlocked(result, 'disaster')).toBe(true);
    expect(result.player.credits).toBe(84250);
    expect(result.player.stats).toEqual({ launches: 2, contractsCompleted: 2 });
    expect(completeSeason(result, final, plan)).toBe(result);
    expect(completeMission(save, { missionId: 'agriculture', status: 'COMPLETE', captured: true, totalMB: 1, deliveredMB: 1 })).toBe(save);
    expect(completeSeason({}, final, plan)).toEqual({});
  });
  it('ends an empty season without granting an unlock', () => {
    const state = createSeason(plan, catalog); state.day = 119; state.priorities = [];
    const final = runSeasonDay(plan, catalog, state, points(119), []);
    expect(final.status).toBe('TARGET_MISSED');
    expect(completeSeason(save, final, plan)).toBe(save);
  });
});

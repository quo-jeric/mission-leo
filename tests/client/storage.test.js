import { describe, it, expect } from 'vitest';
import { createGameSave, normalizeGameSave } from '../../client/js/storage.js';

describe('agency save initialization and recovery', () => {
  it('creates a complete fresh agency with the starting allowance', () => {
    expect(createGameSave().player).toMatchObject({ agencyName: 'AstroDynamics Labs', credits: 250000,
      stats: { launches: 0, contractsCompleted: 0, satellitesDeorbited: 0 } });
  });
  it('repairs a mission-only save without losing its completion or inventing flight history', () => {
    const original = { selectedMission: 'agriculture', missionProgress: { urban: { completed: true, completionSource: 'user-confirmed' } } };
    const result = normalizeGameSave(original);
    expect(result.missionProgress).toEqual(original.missionProgress);
    expect(result.selectedMission).toBe('agriculture');
    expect(result.player.stats).toMatchObject({ contractsCompleted: 1, launches: 0 });
    expect(result.player.credits).toBe(250000);
    expect(result.profileRecovery.creditHistoryMissing).toBe(true);
    expect(original.player).toBeUndefined();
    expect(normalizeGameSave(result)).toEqual(result);
  });
  it('preserves real balances including zero, historical counters, builds and flight ledgers', () => {
    const original = { player: { agencyName: 'Test', credits: 0, reputation: 5,
      stats: { launches: 4, contractsCompleted: 3, satellitesDeorbited: 1 } },
      blueprints: [{ id: 'saved' }], orbitalFlight: { plan: {}, agencyChargeUSD: 165750 },
      agricultureFlight: { plan: {} }, orbitalPractice: { plan: {} }, missionSupportUsed: { urban: true } };
    const result = normalizeGameSave(original);
    expect(result.player).toMatchObject(original.player);
    expect(result.blueprints).toEqual(original.blueprints);
    expect(result.orbitalFlight).toEqual(original.orbitalFlight);
    expect(result.missionSupportUsed).toEqual(original.missionSupportUsed);
    expect(result.profileRecovery).toBeUndefined();
  });
  it('repairs counters from saved flights and completions while excluding practice', () => {
    const result = normalizeGameSave({ player: { credits: 84250 }, orbitalFlight: { plan: {} },
      agricultureFlight: { plan: {} }, orbitalPractice: { plan: {} }, missionProgress: { urban: { completed: true } } });
    expect(result.player.stats).toMatchObject({ launches: 2, contractsCompleted: 1 });
    expect(result.player.credits).toBe(84250);
  });
});

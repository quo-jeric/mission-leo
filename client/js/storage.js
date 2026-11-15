// Shared browser persistence. Failed writes leave the current session usable.
export const SAVE_KEY = 'leo_game_save_v1';
export const PREFERENCE_KEY = 'leo_menu_settings_v1';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const nonnegative = (value, fallback = 0) => Number.isFinite(value) && value >= 0 ? value : fallback;
export function createGameSave() {
  return { player: { agencyName: 'AstroDynamics Labs', credits: 250000, reputation: 0,
    unlockedTech: [], stats: { launches: 0, contractsCompleted: 0, satellitesDeorbited: 0 } },
    blueprints: [], activeMissions: [], settings: { musicVolume: .7, sfxVolume: .9,
      graphicsQuality: 'high', showOrbits: true, showGroundTracks: true } };
}
// Older navigation could save a mission selection/completion without a player.
// Fill missing fields, retaining existing balances, counters and flight records.
export function normalizeGameSave(value) {
  const save = object(value), defaults = createGameSave(), player = object(save.player), stats = object(player.stats);
  const completed = ['urban', 'agriculture', 'disaster'].filter(id => save.missionProgress?.[id]?.completed === true).length;
  const launches = ['orbitalFlight', 'agricultureFlight', 'disasterFlight'].filter(key => Boolean(save[key]?.plan)).length;
  const missingCredits = !Number.isFinite(player.credits) || player.credits < 0;
  return { ...defaults, ...save,
    ...(missingCredits && (completed || launches || save.blueprints?.length) ? { profileRecovery: { ...object(save.profileRecovery), creditHistoryMissing: true } } : {}),
    player: { ...defaults.player, ...player,
      agencyName: typeof player.agencyName === 'string' && player.agencyName.trim() ? player.agencyName.trim() : defaults.player.agencyName,
      credits: nonnegative(player.credits, defaults.player.credits), reputation: nonnegative(player.reputation),
      stats: { ...stats, launches: Math.max(nonnegative(stats.launches), launches),
        contractsCompleted: Math.max(nonnegative(stats.contractsCompleted), completed),
        satellitesDeorbited: nonnegative(stats.satellitesDeorbited) } },
    blueprints: Array.isArray(save.blueprints) ? save.blueprints : [],
    activeMissions: Array.isArray(save.activeMissions) ? save.activeMissions : [],
    settings: { ...defaults.settings, ...object(save.settings) } };
}

export function ensureGameSave({ create = false } = {}) {
  const current = read(SAVE_KEY);
  if (!current && !create) return null;
  const save = current || createGameSave();
  write(SAVE_KEY, save);
  return save;
}

export function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return key === SAVE_KEY && value && typeof value === 'object' && !Array.isArray(value) ? normalizeGameSave(value) : value;
  } catch {
    return null;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(key === SAVE_KEY ? normalizeGameSave(value) : value));
    return true;
  } catch {
    return false;
  }
}

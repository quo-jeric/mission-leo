import { openMissionSelection } from './missions.js';
import { scenarios } from './data/scenarios.js';
import { read, write, SAVE_KEY as saveKey, PREFERENCE_KEY as preferenceKey } from './storage.js';

const motion = document.querySelector('#motion');
motion.checked = read(preferenceKey)?.motion ?? !matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateMotion() { document.body.classList.toggle('still', !motion.checked); }
updateMotion();
motion.addEventListener('change', () => {
  updateMotion();
  const saved = write(preferenceKey, { ...read(preferenceKey), motion: motion.checked });
  document.querySelector('#settings-dialog .hint').textContent = saved ? 'Your preference is saved on this device.' : 'Preference applied for this session. Device storage is unavailable.';
});
// Optional audio must never interrupt menu navigation or graphics startup.
import('./audio.js').then(({ setupMenuAudio }) => setupMenuAudio()).catch(error => {
  console.warn('Menu audio unavailable; continuing without sound.', error);
});
for (const name of ['settings', 'how-to-play', 'credits', 'new-game']) {
  document.querySelector(`#${name}`).addEventListener('click', () => document.querySelector(`#${name}-dialog`).showModal());
}
const agency = document.querySelector('#agency');
document.querySelector('#agency-profile').addEventListener('click', () => {
  const save = read(saveKey);
  const player = save?.player;
  document.querySelector('#profile-name').textContent = player?.agencyName || 'No agency created yet';
  const metrics = [
    ['Credits', new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(player?.credits ?? 0)],
    ['Reputation', player?.reputation ?? 0],
    ['Launches', player?.stats?.launches ?? 0],
    ['Completed contracts', player?.stats?.contractsCompleted ?? 0],
    ['Satellites deorbited', player?.stats?.satellitesDeorbited ?? 0],
    ['Saved blueprints', Array.isArray(save?.blueprints) ? save.blueprints.length : 0],
  ];
  document.querySelector('#profile-stats').replaceChildren(...metrics.map(([label, value]) => {
    const card = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = String(value);
    card.append(term, description);
    return card;
  }));
  document.querySelector('#profile-hint').textContent = player?.agencyName
    ? 'Progress saved on this device.'
    : 'Play to explore missions. Your agency statistics will appear here once an agency is saved.';
  document.querySelector('#agency-profile-dialog').showModal();
});
let startingNew = false;
function refreshSaveMenu() {
  const save = read(saveKey);
  const hasAgency = Boolean(save?.player?.agencyName);
  document.querySelector('#play-label').textContent = hasAgency ? 'CONTINUE' : 'PLAY';
  document.querySelector('#new-game').hidden = !hasAgency;
  const summary = document.querySelector('#continue-summary');
  summary.hidden = !hasAgency;
  const mission = scenarios.find(item => item.id === save?.selectedMission);
  const complete = scenarios.filter(item => save?.missionProgress?.[item.id]?.completed === true).length;
  summary.textContent = hasAgency ? `${save.player.agencyName} · ${mission?.title || 'Choose your first mission'} · ${complete}/${scenarios.length} complete` : '';
}
refreshSaveMenu();
window.addEventListener('mission-saved', refreshSaveMenu);
window.addEventListener('storage', refreshSaveMenu);
agency.value = read(saveKey)?.player?.agencyName || '';
document.querySelector('#play').addEventListener('click', () => {
  startingNew = false;
  agency.value = read(saveKey)?.player?.agencyName || '';
  document.querySelector('#save-status').textContent = '';
  openMissionSelection();
});
document.querySelector('#confirm-new').addEventListener('click', () => {
  startingNew = true;
  document.querySelector('#new-game-dialog').close();
  agency.value = '';
  document.querySelector('#save-status').textContent = '';
  document.querySelector('#play-dialog').showModal();
});
document.querySelector('#save-agency').addEventListener('click', event => {
  event.preventDefault();
  const save = (!startingNew && read(saveKey)) || { player: { credits: 250000, reputation: 0, unlockedTech: [], stats: { launches: 0, contractsCompleted: 0, satellitesDeorbited: 0 } }, blueprints: [], activeMissions: [], settings: { musicVolume: .7, sfxVolume: .9, graphicsQuality: 'high', showOrbits: true, showGroundTracks: true } };
  save.player = { ...save.player, agencyName: agency.value.trim() || 'AstroDynamics Labs' };
  agency.value = save.player.agencyName;
  const saved = write(saveKey, save);
  if (saved) { startingNew = false; refreshSaveMenu(); }
  document.querySelector('#save-status').textContent = saved ? 'Agency saved. Ready for future missions.' : 'Unable to save: device storage is unavailable.';
});
const canvas = document.querySelector('#stars');
const context = canvas.getContext('2d');
function drawStars() {
  if (!context) return;
  const width = innerWidth, height = innerHeight;
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * scale; canvas.height = height * scale;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  let seed = 74319;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < Math.min(width * height / 340, 6000); i++) {
    const x = random() * width, y = random() * height, size = random();
    context.beginPath(); context.arc(x, y, .3 + size * 1.1, 0, Math.PI * 2);
    context.fillStyle = `rgba(${185 + Math.floor(random() * 70)},${195 + Math.floor(random() * 60)},255,${.15 + size * .65})`;
    context.fill();
  }
}
drawStars();
addEventListener('resize', drawStars);

const quality = document.querySelector('#graphics-quality');
const savedQuality = read(preferenceKey)?.graphicsQuality ?? read(saveKey)?.settings?.graphicsQuality;
quality.value = ['low', 'medium', 'high'].includes(savedQuality) ? savedQuality : 'high';
quality.addEventListener('change', () => {
  const saved = write(preferenceKey, { ...read(preferenceKey), graphicsQuality: quality.value });
  window.dispatchEvent(new CustomEvent('graphics-quality', { detail: quality.value }));
  document.querySelector('#settings-dialog .hint').textContent = saved ? 'Graphics quality updated and saved.' : 'Graphics quality applied for this session.';
});
const fullscreen = document.querySelector('#fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; });
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { document.querySelector('#settings-dialog .hint').textContent = 'Fullscreen is unavailable in this browser window.'; }
});
document.querySelector('#replay-guide').addEventListener('click', () => {
  document.querySelector('#settings-dialog').close();
  document.querySelector('#guide-dialog').showModal();
});

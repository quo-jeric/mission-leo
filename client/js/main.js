import { openMissionSelection } from './missions.js';
import { scenarios } from './data/scenarios.js';
import { read, write, ensureGameSave, createGameSave, SAVE_KEY as saveKey, PREFERENCE_KEY as preferenceKey } from './storage.js';

ensureGameSave();

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
import('./audio.js').then(({ audioManager, mountAudioUi }) => {
  mountAudioUi();
  if (document.querySelector('#mission-select').hidden) audioManager.playMusic('landing');
}).catch(error => {
  console.warn('Menu audio unavailable; continuing without sound.', error);
});
for (const name of ['settings', 'how-to-play', 'credits', 'new-game']) {
  document.querySelector(`#${name}`).addEventListener('click', () => document.querySelector(`#${name}-dialog`).showModal());
}
const agency = document.querySelector('#agency');
function renderAgencyProfile() {
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
  document.querySelector('#profile-hint').textContent = save?.profileRecovery?.creditHistoryMissing
    ? 'Recovered your saved mission progress. Credit history was missing, so the $250,000 starting allowance is shown; past charges cannot be recovered. Launches count only saved flight records.'
    : player?.agencyName ? 'Progress saved on this device. Reputation and deorbit counts change only when those features record an event.'
    : 'Play to explore missions. Your agency statistics will appear here once an agency is saved.';
}
document.querySelector('#agency-profile').addEventListener('click', () => {
  renderAgencyProfile();
  document.querySelector('#agency-profile-dialog').showModal();
});
for (const event of ['mission-saved', 'storage']) window.addEventListener(event, () => {
  if (document.querySelector('#agency-profile-dialog').open) renderAgencyProfile();
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
const fullscreenPrompt = document.querySelector('#fullscreen-prompt');
let fullscreenPromptSeen = Boolean(read(preferenceKey)?.fullscreenPromptSeen);
let enteringFullscreen = false;
async function continueFromFullscreenPrompt(enter) {
  if (enteringFullscreen) return;
  enteringFullscreen = true;
  fullscreenPromptSeen = true;
  write(preferenceKey, { ...read(preferenceKey), fullscreenPromptSeen: true });
  fullscreenPrompt.close();
  try {
    if (enter && !document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch { /* Fullscreen is optional; a rejected request must not block play. */ }
  finally { enteringFullscreen = false; openMissionSelection(); }
}
document.querySelector('#fullscreen-prompt-enter').onclick = () => continueFromFullscreenPrompt(true);
document.querySelector('#fullscreen-prompt-skip').onclick = () => continueFromFullscreenPrompt(false);
fullscreenPrompt.addEventListener('cancel', event => { event.preventDefault(); continueFromFullscreenPrompt(false); });
fullscreenPrompt.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); continueFromFullscreenPrompt(false); }
});
document.querySelector('#play').addEventListener('click', () => {
  if (enteringFullscreen) return;
  ensureGameSave({ create: true });
  refreshSaveMenu();
  startingNew = false;
  agency.value = read(saveKey)?.player?.agencyName || '';
  document.querySelector('#save-status').textContent = '';
  if (!fullscreenPromptSeen && !read(preferenceKey)?.fullscreenPromptSeen && document.fullscreenEnabled && !document.fullscreenElement) fullscreenPrompt.showModal();
  else openMissionSelection();
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
  const save = (!startingNew && read(saveKey)) || createGameSave();
  save.player = { ...save.player, agencyName: agency.value.trim() || 'AstroDynamics Labs' };
  agency.value = save.player.agencyName;
  const saved = write(saveKey, save);
  if (saved) { startingNew = false; refreshSaveMenu(); }
  document.querySelector('#save-status').textContent = saved ? 'Agency saved on this device.' : 'Unable to save: device storage is unavailable.';
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
const menuFullscreen = document.querySelector('#menu-fullscreen');
fullscreen.hidden = !document.fullscreenEnabled;
document.querySelector('.menu-fullscreen').hidden = !document.fullscreenEnabled;
function syncFullscreen() {
  const active = Boolean(document.fullscreenElement);
  const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
  fullscreen.textContent = label;
  menuFullscreen.setAttribute('aria-label', label);
  menuFullscreen.title = label;
  document.querySelector('.menu-fullscreen').removeAttribute('data-error');
  for (const button of [fullscreen, menuFullscreen]) button.setAttribute('aria-pressed', String(active));
  document.querySelector('#menu-fullscreen-note').textContent = active ? 'Exit fullscreen · or press Esc' : 'Enter fullscreen for a better experience';
}
document.addEventListener('fullscreenchange', syncFullscreen);
syncFullscreen();
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
    syncFullscreen();
  } catch {
    document.querySelector('#settings-dialog .hint').textContent = 'Fullscreen is unavailable in this browser window.';
    document.querySelector('#menu-fullscreen-note').textContent = 'Fullscreen unavailable in this window. You can keep playing.';
    document.querySelector('.menu-fullscreen').setAttribute('data-error', '');
  }
}
fullscreen.addEventListener('click', toggleFullscreen);
menuFullscreen.addEventListener('click', toggleFullscreen);
document.querySelector('#replay-guide').addEventListener('click', () => {
  document.querySelector('#settings-dialog').close();
  document.querySelector('#guide-dialog').showModal();
});

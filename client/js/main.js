import { openMissionSelection } from './missions.js';
import { read, write, SAVE_KEY as saveKey, PREFERENCE_KEY as preferenceKey } from './storage.js';

const motion = document.querySelector('#motion');
motion.checked = read(preferenceKey)?.motion ?? !matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateMotion() { document.body.classList.toggle('still', !motion.checked); }
updateMotion();
motion.addEventListener('change', () => {
  updateMotion();
  const saved = write(preferenceKey, { motion: motion.checked });
  document.querySelector('#settings-dialog .hint').textContent = saved ? 'Your preference is saved on this device.' : 'Preference applied for this session. Device storage is unavailable.';
});
for (const name of ['settings', 'how-to-play', 'credits', 'new-game']) {
  document.querySelector(`#${name}`).addEventListener('click', () => document.querySelector(`#${name}-dialog`).showModal());
}
const agency = document.querySelector('#agency');
let startingNew = false;
function refreshSaveMenu() {
  const hasAgency = Boolean(read(saveKey)?.player?.agencyName);
  document.querySelector('#play-label').textContent = hasAgency ? 'CONTINUE' : 'PLAY';
  document.querySelector('#new-game').hidden = !hasAgency;
}
refreshSaveMenu();
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

// Keep the illustrated background when WebGL is unavailable.
import('./three/menuScene.js').then(({ createMenuScene }) => createMenuScene()).catch(error => {
  console.warn('3D menu unavailable; using illustrated background.', error);
});

import { scenarios } from './data/scenarios.js';
import { read, write, SAVE_KEY, PREFERENCE_KEY } from './storage.js';
import { audioManager } from './audio.js';
import { openHangar } from './hangar.js';
import { missionUnlocked } from './progression.js';

const screen = document.querySelector('#mission-select');
const cards = document.querySelector('#scenario-cards');
const requirementsDialog = document.querySelector('#requirements-dialog');
const menu = document.querySelector('#menu');
let selected = 0;

function readSave() {
  return read(SAVE_KEY) || {};
}

function completed() {
  const progress = readSave().missionProgress;
  return scenarios.map(scenario => progress?.[scenario.id]?.completed === true);
}

function available(index) {
  return missionUnlocked(readSave(),scenarios[index]?.id);
}

// Keep the desktop composition consistent with the 1920 × 1080 design.
function fitMissionScreen() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  screen.style.setProperty('--mission-scale', String(scale));
}

function renderTextItems(selector, tagName, values) {
  const elements = values.map(value => {
    const element = document.createElement(tagName);
    element.textContent = value;
    return element;
  });
  document.querySelector(selector).replaceChildren(...elements);
}

function renderCardStates(index, done) {
  [...cards.children].forEach((card, cardIndex) => {
    const locked = !available(cardIndex);
    card.setAttribute('aria-pressed', String(cardIndex === index));
    card.dataset.locked = String(locked);
    card.querySelector('.scenario-lock').hidden = !locked;
    card.querySelector('.scenario-state-label').textContent = done[cardIndex]
      ? '✓ COMPLETED'
      : locked ? 'LOCKED' : 'AVAILABLE';
  });
}

function select(index) {
  selected = index;
  const scenario = scenarios[index];
  const unlocked = available(index);
  const done = completed();

  screen.dataset.scenario = String(index);
  screen.style.setProperty('--mission-accent', scenario.theme);
  document.querySelector('#mission-tier').textContent = `SCENARIO 0${index + 1} / ${scenario.tier}`;
  document.querySelector('#mission-title').textContent = scenario.title;
  document.querySelector('#mission-summary').textContent = scenario.summary;
  document.querySelector('#preview-caption').textContent = scenario.caption;
  renderTextItems('#mission-metrics', 'span', scenario.metrics);
  renderTextItems('#mission-objectives', 'li', scenario.objectives);

  const begin = document.querySelector('#begin-mission');
  begin.disabled = !unlocked;
  begin.textContent = unlocked
    ? done[index] ? 'Replay Mission →' : 'Begin Mission →'
    : 'Mission locked';
  document.querySelector('#unlock-requirement').textContent = unlocked
    ? 'Requirements and limits are reviewed before design.'
    : `Complete ${scenarios[index - 1].title} to unlock this mission.`;
  document.querySelector('#mission-progress').textContent = `${done.filter(Boolean).length} / 3 COMPLETE`;

  renderCardStates(index, done);
  window.dispatchEvent(new CustomEvent('mission-preview', { detail: { index } }));
}

function createLockIcon() {
  const lock = document.createElement('span');
  lock.className = 'scenario-lock';
  lock.hidden = true;
  // Static local SVG, independent of platform emoji rendering.
  lock.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3"/>
      <rect x="5" y="10" width="14" height="11" rx="2.5"/>
      <path d="M12 14.5v2"/>
    </svg>`;
  return lock;
}

function handleCardNavigation(event, index) {
  const last = scenarios.length - 1;
  const destinations = {
    ArrowLeft: (index + last) % scenarios.length,
    ArrowRight: (index + 1) % scenarios.length,
    Home: 0,
    End: last,
  };
  if (!(event.key in destinations)) return;

  event.preventDefault();
  const next = destinations[event.key];
  select(next);
  cards.children[next].focus();
}

function createScenarioCard(scenario, index) {
  const button = document.createElement('button');
  button.className = 'scenario-card';
  button.type = 'button';

  const selectedMark = document.createElement('span');
  selectedMark.className = 'scenario-selected';
  selectedMark.setAttribute('aria-hidden', 'true');
  selectedMark.textContent = '✓';

  const number = document.createElement('span');
  number.className = 'scenario-number';
  number.textContent = `0${index + 1}`;

  const title = document.createElement('strong');
  title.textContent = scenario.title;

  const tier = document.createElement('span');
  tier.className = 'scenario-tier';
  tier.textContent = scenario.tier;

  const state = document.createElement('span');
  state.className = 'scenario-state';
  const stateLabel = document.createElement('span');
  stateLabel.className = 'scenario-state-label';
  state.append(createLockIcon(), stateLabel);

  button.append(selectedMark, number, title, tier, state);
  button.addEventListener('click', () => select(index));
  button.addEventListener('keydown', event => handleCardNavigation(event, index));
  return button;
}

export function openMissionSelection(missionId) {
  fitMissionScreen();
  screen.hidden = false;
  menu.inert = true;
  document.body.classList.add('selecting-mission');

  const saved = scenarios.findIndex(scenario => scenario.id === (missionId||readSave().selectedMission));
  select(saved >= 0 ? saved : 0);
  document.querySelector('#mission-back').focus();
  audioManager.playMusic('missionSelect');
  if (!missionId && !read(PREFERENCE_KEY)?.guideSeen) {
    document.querySelector('#guide-dialog').showModal();
  }
}
export function openMissionBrief(missionId){
  if(!missionUnlocked(readSave(),missionId))return false;
  openMissionSelection(missionId);
  beginMission();
  return true;
}

function closeSelection() {
  screen.hidden = true;
  document.body.classList.remove('selecting-mission');
  menu.inert = false;
  audioManager.playMusic('landing');
  window.dispatchEvent(new CustomEvent('mission-preview', { detail: { index: -1 } }));
  document.querySelector('#play').focus();
}

function beginMission() {
  if (!available(selected)) return;

  const scenario = scenarios[selected];
  const save = readSave();
  save.selectedMission = scenario.id;
  const saved = write(SAVE_KEY, save);
  window.dispatchEvent(new Event('mission-saved'));

  document.querySelector('#requirements-title').textContent = scenario.title;
  const paragraphs = [scenario.detail, ...scenario.objectives];
  const operational=['urban','agriculture'].includes(scenario.id);
  document.querySelector('#requirements-dialog .hint').textContent=scenario.id==='agriculture'?'Build your satellite, then Review design to launch or resume a 120-day season. Schedule regions and downlink before deadlines; reach the weighted delivery goal to unlock the next level.':operational?'Build your satellite, validate its mission plan, then launch. Complete the image downlink to unlock the next level.':'Mission planning and the workshop preview are available. Operational gameplay for this level is not implemented yet.';
  document.querySelector('#requirements-done').textContent=operational?'Design satellite →':'Open workshop preview →';
  if (!saved) {
    paragraphs.push('Device storage is unavailable. Mission selection is available for this session.');
  }
  renderTextItems('#requirements-body', 'p', paragraphs);
  requirementsDialog.showModal();
}

// Initialize cards and wire screen-level interactions once.
cards.replaceChildren(...scenarios.map(createScenarioCard));
document.querySelector('#guide-dialog').addEventListener('close', () => {
  write(PREFERENCE_KEY, { ...read(PREFERENCE_KEY), guideSeen: true });
  if (!screen.hidden) document.querySelector('#mission-back').focus();
});
fitMissionScreen();
window.addEventListener('resize', fitMissionScreen);
document.querySelector('#mission-back').addEventListener('click', closeSelection);
document.querySelector('#begin-mission').addEventListener('click', beginMission);
screen.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSelection();
});
for (const id of ['requirements-close', 'requirements-done']) {
  document.querySelector(`#${id}`).addEventListener('click', () => {
    requirementsDialog.close();
    if (id === 'requirements-done') openHangar(scenarios[selected]);
  });
}
window.addEventListener('storage', event => {
  if (event.key === SAVE_KEY && !screen.hidden) select(selected);
});
window.addEventListener('mission-saved', () => {
  if (!screen.hidden) select(selected);
});

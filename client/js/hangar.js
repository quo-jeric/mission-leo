import { read, write, SAVE_KEY } from './storage.js';
import { evaluateMission, missionInputKey } from './engineering.js';
import { urbanMission, agricultureMission, disasterMission } from './data/mission-config.js';
import { openPreflight } from './preflight.js';
import { openAgriculture, openDisaster } from './agriculture.js';

const groups = [
  ['bus', 'Chassis', 'Choose the structure that holds your satellite.'],
  ['payload', 'Camera & payload', 'Choose an instrument for your mission.'],
  ['eps_solar', 'Solar arrays', 'Generate power while your satellite is in sunlight.'],
  ['eps_battery', 'Battery', 'Store energy for the dark side of each orbit.'],
  ['comms', 'Communications', 'Choose how your images get back to Earth.'],
  ['cdh', 'Onboard computer', 'Manage commands and observation data.'],
  ['tcs', 'Thermal control', 'Help keep your equipment within operating temperatures.'],
  ['propulsion', 'Propulsion', 'Plan how your satellite changes orbit.'],
];
const steps = [
  { name: 'Chassis', categories: ['bus'], required: ['bus'] },
  { name: 'Payload', categories: ['payload'], required: ['payload'] },
  { name: 'Power', categories: ['eps_solar', 'eps_battery'], required: ['eps_solar', 'eps_battery'] },
  { name: 'Systems', categories: ['comms', 'cdh', 'tcs', 'propulsion'], required: ['comms', 'cdh'] },
];
const stepFor = category => steps.findIndex(step => step.categories.includes(category));
const screen = document.createElement('section');
screen.id = 'hangar';
screen.hidden = true;
screen.setAttribute('aria-labelledby', 'hangar-title');
screen.innerHTML = `
  <header class="hangar-header"><div class="hangar-header-left"><button id="hangar-back" class="text-button">← Missions</button><span class="hangar-header-divider" aria-hidden="true"></span><div><p class="eyebrow">MISSION / <span id="hangar-mission"></span></p><h1 id="hangar-title" tabindex="-1">Satellite workshop</h1></div></div><div class="hangar-header-actions"><span id="hangar-agency"></span><button id="hangar-review" class="text-button">Review design</button><button id="hangar-save">Save blueprint</button></div></header>
  <nav id="hangar-steps" aria-label="Assembly stages"></nav>
  <div class="hangar-step-intro"><p><span id="hangar-step"></span> <span id="hangar-next" role="status"></span></p><span id="hangar-progress-label"></span></div>
  <div class="hangar-workspace">
    <aside class="hangar-parts" aria-label="Component library"><div class="hangar-panel-label"><p class="eyebrow">COMPONENT LIBRARY</p><span>BEGINNER / TIER 01</span></div><div id="hangar-categories" role="group" aria-label="Subsystems in this stage"></div><div class="hangar-options"><div class="hangar-option-heading"><h2 id="hangar-part-title" tabindex="-1"></h2><span id="hangar-option-count"></span></div><p id="hangar-part-help"></p><div id="hangar-part-list"></div></div><details class="hangar-installed-summary"><summary>Installed components <span id="hangar-summary-count"></span></summary><div id="hangar-installed-list"></div></details></aside>
    <section class="hangar-stage" aria-label="3D satellite assembly"><div class="hangar-stage-heading"><span class="eyebrow"><i class="hangar-live-dot" aria-hidden="true"></i> 3D WORKBENCH</span><span id="hangar-installed"></span></div><div class="hangar-preview-banner" id="hangar-preview-banner" hidden><span id="hangar-preview-status" role="status"></span><button id="hangar-preview-close">← Assembly</button></div><div class="hangar-orbit-rings" aria-hidden="true"></div><div id="hangar-illustration"><p id="hangar-3d-status" role="status">Preparing 3D workbench…</p></div><div class="hangar-camera-tools" role="group" aria-label="3D camera controls"><span>Drag to rotate · scroll or pinch to zoom</span><button id="hangar-zoom-in" aria-label="Zoom in">+</button><button id="hangar-zoom-out" aria-label="Zoom out">−</button><button id="hangar-camera-reset">Reset view</button></div><div class="hangar-stage-caption"><span class="eyebrow" id="hangar-preview-kicker">YOUR ORBIT STARTS HERE</span><h2 id="hangar-assembly-name">An idea taking shape.</h2><p id="hangar-assembly-description">Choose a chassis to begin your build.</p></div><div id="hangar-mounts" role="group" aria-label="Assembly shortcuts"></div><div class="hangar-stage-dock"><div id="hangar-metrics" aria-label="Design estimates"></div><div class="hangar-stage-dock-actions"><span id="hangar-save-status" role="status">Save to keep this blueprint.</span><button id="hangar-next-button" class="action">Continue →</button></div></div><div class="hangar-stage-bottom"><div class="hangar-footnote-inline"><span id="hangar-target"></span><details class="hangar-disclaimer"><summary>About these estimates</summary><p>Urban Mapping review screens slots, orbital energy, battery reserve, optics and thermal capacity, with backend station checks. Timed observation and temperature simulation remain in development. This does not certify flight readiness.</p></details></div><details class="hangar-view-options"><summary>View options</summary><div class="hangar-view-popover"><label><input id="hangar-cutaway" type="checkbox"> See internal components</label><label><input id="hangar-explode" type="checkbox"> Exploded assembly</label><label><input id="hangar-ghost" type="checkbox"> Wireframe view</label><button id="hangar-reset">Reset blueprint…</button></div></details></div></section>
  </div>
  <dialog id="hangar-review-dialog" aria-labelledby="hangar-review-title"><form method="dialog"><button class="close" aria-label="Close review">×</button><p class="eyebrow">DESIGN REVIEW</p><h2 id="hangar-review-title">Before you launch.</h2><div id="hangar-review-body"></div><p class="hint">Launch and orbital simulation are in development. This review does not certify flight readiness.</p><button class="action">Continue designing</button></form></dialog>
  <dialog id="hangar-reset-dialog" aria-labelledby="hangar-reset-title"><form method="dialog"><h2 id="hangar-reset-title">Clear this assembly?</h2><p>Your saved blueprint is kept until you save again.</p><button value="cancel" class="text-button">Keep designing</button><button value="reset" class="action">Clear assembly</button></form></dialog>`;
document.querySelector('.space').append(screen);
const $ = id => screen.querySelector(`#hangar-${id}`);
const modeLabel = document.createElement('span');
modeLabel.id = 'hangar-mode'; modeLabel.className = 'hangar-mode'; modeLabel.textContent = 'Assembly';
screen.querySelector('.hangar-stage-heading').insertBefore(modeLabel, $('installed'));
const feedback = document.createElement('p');
feedback.id = 'hangar-feedback'; feedback.className = 'hangar-feedback';
feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-atomic', 'true');
screen.querySelector('.hangar-stage').append(feedback);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let feedbackTimer = null, feedbackAnimation = null, panelAnimation = null;

function showFeedback(message) {
  clearTimeout(feedbackTimer); feedbackAnimation?.cancel();
  feedback.textContent = message;
  if (!reducedMotion.matches) feedbackAnimation = feedback.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  feedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 3500);
}
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
let catalog = [], parts = {}, active = 'bus', mission, loading = false, loadFailed = false;
let dirty = false;
let viewer = null, viewerLoading = false, previewPart = null;
let missionSettings = {};
const drafts = new Map();
const chosen = () => Object.values(parts).map(id => catalog.find(part => part.id === id)).filter(Boolean);
const agencyCredits = () => read(SAVE_KEY)?.player?.credits ?? 250000;
const missionConfig = () => mission?.id === 'disaster' ? disasterMission : mission?.id === 'agriculture' ? agricultureMission : urbanMission;
const remainingSupport = () => read(SAVE_KEY)?.missionSupportUsed?.[missionConfig().id] ? 0 : missionConfig().planningSupportUSD;
const budget = () => agencyCredits() + (['urban', 'agriculture', 'disaster'].includes(mission?.id) ? remainingSupport() : 0);
function getDesign() {
  const camera = catalog.find(part => part.id === parts.payload);
  return { missionId: mission?.id, components: { ...parts }, credits: agencyCredits(), planningSupportUSD: remainingSupport(), settings: { ...missionConfig().defaults, focalLengthM: camera?.defaultFocalLengthM || 1, ...missionSettings } };
}
const opticsFor = part => part.focalLengthOptions?.find(option => option.focalLengthM === (part.id === parts.payload ? getDesign().settings.focalLengthM : part.defaultFocalLengthM));
const configuredMass = part => part.massKg + (part.fuelMassKg || 0) + (opticsFor(part)?.massDeltaKg || 0);
const configuredPower = part => (part.operationalPowerW || 0) + (opticsFor(part)?.powerDeltaW || 0);

function snapshot() {
  if (['urban', 'agriculture', 'disaster'].includes(mission?.id)) {
    const report = evaluateMission(getDesign(), catalog), m = report.metrics;
    const passed = id => report.checks.find(item => item.id === id)?.passed;
    return [
      ['Mass', `${m.wetMassKg} kg`, passed('mass') ? 'Within limits' : 'Needs review', `Dry ${m.dryMassKg} kg; wet ${m.wetMassKg} kg. Includes configured optics and propellant. Review mission setup for chassis/launch limits.`],
      ['Power', m.generatedWh === null || m.usedWh === null ? '—' : `${(m.generatedWh - m.usedWh).toFixed(1)} Wh/orbit`, passed('power') ? 'Energy screen passed' : 'Needs attention', `${m.generatedWh} Wh generated / ${m.usedWh} Wh used per orbit. Peak ${m.peakW} W. Assumes 20% imaging, 10% radio duty and worst-case eclipse; open mission setup for all checks.`],
      ['Mission performance', m.gsdM === null ? 'Choose a camera' : `${m.gsdM} m GSD`, passed('optics') ? 'Optics screen passed' : 'Needs review', `${m.swathKm ?? '—'} km swath at ${report.settings.altitudeKm} km. Pointing, station and budget checks are separate.`],
      ['Cost', money(m.totalUSD ?? 0), passed('budget') ? 'Within planning budget' : 'Over budget', `Hardware ${money(m.hardwareUSD)} + launch ${money(m.launchUSD ?? 0)}. Available ${money(m.availableUSD ?? 0)} includes ${money(remainingSupport())} remaining mission support. No credits spent by planning.`],
    ];
  }
  const items = chosen();
  const mass = items.reduce((sum, part) => sum + configuredMass(part), 0);
  const cost = items.reduce((sum, part) => sum + part.costUSD, 0);
  const demand = items.reduce((sum, part) => sum + configuredPower(part), 0);
  const solar = items.reduce((sum, part) => sum + (part.powerSunW || 0), 0);
  const camera = items.find(part => part.category === 'payload');
  const budget = read(SAVE_KEY)?.player?.credits ?? 250000;
  const limit = mission.id === 'urban' ? 50 : mission.id === 'agriculture' ? 80 : null;
  return [
    ['Mass', `${mass.toFixed(2)} kg`, limit !== null && mass > limit ? 'Over limit' : 'Estimate', `${limit === null ? 'Mission mass limit has not been configured.' : `Mission limit: ${limit} kg.`} Chassis capacity and mounting fit require further checks.`],
    ['Power', `${solar - demand >= 0 ? '+' : ''}${(solar - demand).toFixed(1)} W`, !parts.eps_solar ? 'Add solar' : solar < demand ? 'Needs attention' : 'Sunlight estimate', `Ideal sunlight: ${solar} W generation; ${demand.toFixed(1)} W simultaneous operating demand. Excludes orientation, duty cycles and eclipse. ${parts.eps_battery ? 'Battery selected; eclipse endurance is unverified.' : 'Add a battery for eclipse planning.'}`],
    ['Mission performance', camera?.gsdAtNominalM ? `${camera.gsdAtNominalM} m GSD` : 'Select a camera', 'Needs review', camera?.gsdAtNominalM ? `Catalog resolution at ${camera.nominalAltitudeKm} km using the default focal length. ${mission.id === 'urban' ? 'Urban Mapping requires 3 m GSD or better and a 10 × 10 km image.' : 'Review all mission observation requirements.'} Pointing and downlink are unverified.` : 'Choose a payload to see its nominal imaging performance.'],
    ['Cost', money(cost), cost > budget ? 'Over budget' : 'Within budget', `${money(budget)} available. Hardware estimate only; launch service is excluded. Saving does not spend credits.`],
  ];
}

function select(category) {
  const changed = active !== category;
  active = category;
  previewPart = null;
  renderOptions(); renderCategories(); renderNextAction(); updateViewer();
  panelAnimation?.cancel();
  if (changed && !reducedMotion.matches) panelAnimation = $('part-list').animate([{ opacity: .4 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
}

function updateViewer() {
  const candidate = catalog.find(part => part.id === previewPart);
  screen.dataset.previewing = String(Boolean(candidate));
  const exploded = $('explode').checked;
  $('mode').textContent = candidate ? 'Part preview' : exploded ? 'Exploded view' : 'Assembly';
  $('mode').dataset.mode = candidate ? 'preview' : exploded ? 'exploded' : 'assembly';
  $('preview-banner').hidden = !candidate && !exploded;
  $('preview-status').textContent = candidate ? `Inspecting ${candidate.name}` : exploded ? 'Exploded inspection · parts intentionally separated' : '';
  $('preview-close').textContent = !candidate && exploded ? 'Reattach parts' : '← Assembly';
  $('preview-install').hidden = !candidate;
  $('preview-install').disabled = !candidate || candidate.id === parts[candidate.category] || (candidate.category !== 'bus' && !parts.bus);
  $('preview-install').textContent = candidate?.id === parts[candidate?.category] ? 'Installed' : candidate?.category !== 'bus' && !parts.bus ? 'Choose a chassis first' : 'Install this part';
  $('preview-kicker').textContent = candidate ? 'COMPONENT PREVIEW · NOT AN INSTALLATION' : 'YOUR ORBIT STARTS HERE';
  const bus = catalog.find(part => part.id === parts.bus);
  $('assembly-name').textContent = candidate?.name || bus?.name || 'An idea taking shape.';
  $('assembly-description').textContent = candidate ? `${configuredMass(candidate)} kg · ${money(candidate.costUSD)}. Rotate to inspect; install from the component card.` : bus ? `${mission.title} / ${parts.payload ? 'Payload selected. Keep building your support systems.' : 'Your chassis is ready for a payload.'}` : 'Choose a chassis to begin your build.';
  if (viewer) viewer.update(chosen(), candidate);
}

async function ensureViewer() {
  if (viewer || viewerLoading) return;
  viewerLoading = true;
  try {
    const { createHangarScene } = await import('./three/hangarScene.js');
    viewer = createHangarScene($('illustration'), {
      onPick: part => { select(part.category); $('part-title').focus({ preventScroll: true }); },
      onUnavailable: () => { $('illustration').classList.remove('has-3d'); $('3d-status').hidden = false; $('3d-status').textContent = '3D graphics paused. Restore graphics or reload to retry. Component selection remains available.'; },
      onAvailable: () => { $('3d-status').hidden = true; },
    });
    $('illustration').classList.add('has-3d'); $('3d-status').hidden = true;
    viewer.options({ exploded: $('explode').checked, wireframe: $('ghost').checked, cutaway: $('cutaway').checked });
    for (const id of ['zoom-in', 'zoom-out', 'camera-reset', 'cutaway', 'explode', 'ghost']) $(id).disabled = false;
    viewer.setActive(!screen.hidden);
    updateViewer();
  } catch {
    $('3d-status').textContent = '3D graphics are unavailable. You can still choose and save components.';
  } finally { viewerLoading = false; }
}
function renderCategories() {
  const currentStep = stepFor(active);
  $('steps').replaceChildren(...steps.map((step, index) => {
    const button = document.createElement('button');
    const done = step.required.every(category => parts[category]);
    button.dataset.step = String(index);
    button.dataset.complete = String(done);
    button.setAttribute('aria-current', index === currentStep ? 'step' : 'false');
    const number = document.createElement('span'); number.textContent = done ? '✓' : String(index + 1).padStart(2, '0');
    const name = document.createElement('strong'); name.textContent = step.name;
    const state = document.createElement('small'); state.textContent = done ? 'Selected' : index === currentStep ? 'In progress' : 'To select';
    button.append(number, name, state);
    button.onclick = () => {
      select(step.required.find(category => !parts[category]) || step.categories[0]);
      $('steps').querySelector(`[data-step="${index}"]`).focus({ preventScroll: true });
    };
    return button;
  }));
  $('categories').hidden = steps[currentStep].categories.length === 1;
  $('categories').replaceChildren(...groups.filter(([category]) => steps[currentStep].categories.includes(category)).map(([category, label]) => {
    const button = document.createElement('button');
    button.textContent = `${parts[category] ? '✓ ' : ''}${label}${['tcs', 'propulsion'].includes(category) ? ' · Mission checks' : ''}`;
    button.dataset.category = category;
    button.dataset.installed = String(Boolean(parts[category]));
    button.setAttribute('aria-pressed', String(category === active));
    button.addEventListener('click', () => { select(category); screen.querySelector(`[data-category="${category}"]`).focus(); });
    return button;
  }));
}

function togglePart(part) {
  const category = part.category;
  const installing = parts[category] !== part.id;
  previewPart = null;
  const before = chosen().filter(item => item.category !== category);
  if (parts[category] === part.id) delete parts[category]; else parts[category] = part.id;
  if (category === 'payload' && installing) missionSettings.focalLengthM = part.defaultFocalLengthM || 1;
  const chassis = catalog.find(item => item.id === parts.bus)?.chassisCompatibility?.[0];
  for (const item of chosen()) if (item.category !== 'bus' && (!chassis || !item.chassisCompatibility?.includes(chassis))) delete parts[item.category];
  dirty = true;
  const removed = before.filter(item => !Object.values(parts).includes(item.id));
  $('save-status').textContent = removed.length ? `Unsaved. Removed incompatible parts: ${removed.map(item => item.name).join(', ')}.` : 'Unsaved changes';
  render();
  showFeedback(`${part.name} ${installing ? 'installed' : 'removed'}.`);
  if (installing) {
    $('part-list').scrollTop = 0;
    viewer?.highlight(part.id);
    const card = $('part-list').querySelector(`[data-part="${part.id}"]`);
    if (card && !reducedMotion.matches) card.animate([{ opacity: .45 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
  }
}

function renderNextAction() {
  const index = stepFor(active), step = steps[index];
  const missing = step.required.find(category => !parts[category]);
  $('step').textContent = `STEP ${String(index + 1).padStart(2, '0')} /`;
  $('next').textContent = groups.find(([category]) => category === active)[2];
  const button = $('next-button');
  button.disabled = loading || loadFailed || missing === active;
  let destination;
  if (missing) {
    destination = missing;
    const label = groups.find(([category]) => category === missing)[1].toLowerCase();
    button.textContent = missing === active ? `Select ${label} to continue` : `Choose ${label} →`;
  } else if (index < steps.length - 1) {
    const next = steps[index + 1];
    destination = next.required.find(category => !parts[category]) || next.categories[0];
    button.textContent = `Continue to ${next.name} →`;
  } else button.textContent = 'Review design →';
  button.onclick = () => {
    if (destination) { select(destination); $('part-title').scrollIntoView({ block: 'nearest' }); $('part-title').focus({ preventScroll: true }); }
    else $('review').click();
  };
}

function renderInstalled() {
  const items = chosen();
  $('summary-count').textContent = String(items.length);
  $('installed-list').replaceChildren(...items.map(part => {
    const row = document.createElement('div'); row.className = 'hangar-installed-row';
    const edit = document.createElement('button'); edit.className = 'text-button';
    edit.textContent = part.name; edit.setAttribute('aria-label', `Change ${part.name}`);
    edit.onclick = () => { select(part.category); $('part-title').focus({ preventScroll: true }); };
    const remove = document.createElement('button'); remove.className = 'text-button';
    remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${part.name}`);
    remove.onclick = () => { togglePart(part); screen.querySelector('.hangar-installed-summary > summary').focus({ preventScroll: true }); };
    row.append(edit, remove); return row;
  }));
  if (!items.length) $('installed-list').textContent = 'Your installed parts will appear here.';
}
function renderOptions() {
  const group = groups.find(([category]) => category === active);
  $('part-title').textContent = group[1];
  $('part-help').textContent = group[2];
  const list = $('part-list');
  const scrollTop = list.scrollTop;
  list.replaceChildren();
  $('option-count').textContent = '';
  list.setAttribute('aria-busy', String(loading));
  if (loading || loadFailed) {
    list.textContent = loading ? 'Loading component catalog…' : 'Could not load the catalog.';
    if (loadFailed) { const retry = document.createElement('button'); retry.textContent = 'Retry'; retry.onclick = loadCatalog; list.append(retry); }
    return;
  }
  const bus = catalog.find(part => part.id === parts.bus);
  const chassis = bus?.chassisCompatibility?.[0];
  const options = catalog.filter(part => part.category === active && part.tier <= (mission.id !== 'urban' ? 2 : 1) && (active === 'bus' || !chassis || part.chassisCompatibility?.includes(chassis)) && (active !== 'payload' || !['urban', 'agriculture', 'disaster'].includes(mission.id) || part.payloadType === 'optical'));
  options.sort((a, b) => Number(b.id === parts[active]) - Number(a.id === parts[active]));
  $('option-count').textContent = `${options.length} options`;
  if (!options.length) list.textContent = 'No beginner components available for this chassis. Try a different chassis.';
  for (const part of options) {
    const card = document.createElement('article');
    card.className = 'hangar-part';
    card.dataset.part = part.id;
    card.dataset.selected = String(parts[active] === part.id);
    if (parts[active] === part.id) { const badge = document.createElement('span'); badge.className = 'hangar-part-badge'; badge.textContent = '✓ INSTALLED'; card.append(badge); }
    const title = document.createElement('h3'); title.textContent = part.name;
    const stats = document.createElement('p'); stats.className = 'hangar-part-stats'; stats.textContent = `${money(part.costUSD)} · ${configuredMass(part)} kg`;
    const benefit = document.createElement('p'); benefit.className = 'hangar-part-benefit';
    benefit.textContent = part.category === 'bus' ? `${part.internalSlotsU}U internal capacity · ${part.maxDryMassKg} kg chassis limit` : part.powerSunW ? `${part.powerSunW} W in ideal sunlight` : part.capacityWh ? `${part.capacityWh} Wh stored energy` : part.gsdAtNominalM ? `${part.gsdAtNominalM} m resolution at ${part.nominalAltitudeKm} km` : `${configuredPower(part)} W operating demand`;
    const detail = document.createElement('details');
    const summary = document.createElement('summary'); summary.textContent = 'Specifications';
    const description = document.createElement('p'); description.textContent = part.description;
    if (part.category === 'bus') description.textContent += ' Changing chassis removes incompatible components.';
    detail.append(summary, description);
    const button = document.createElement('button');
    button.textContent = parts[active] === part.id ? 'Remove component' : 'Install component';
    button.onclick = () => {
      togglePart(part);
      $('part-list').querySelector(`[data-part="${part.id}"] .hangar-install-part`)?.focus({ preventScroll: true });
    };
    button.disabled = active !== 'bus' && !bus;
    if (button.disabled) button.textContent = 'Choose a chassis first';
    card.append(title, benefit, stats);
    const replacementChassis = part.category === 'bus' ? part.chassisCompatibility?.[0] : null;
    const retained = chosen().filter(item => item.category !== active && (!replacementChassis || item.chassisCompatibility?.includes(replacementChassis)));
    const projected = retained.reduce((sum, item) => sum + item.costUSD, part.costUSD);
    if (projected > budget()) { const warning = document.createElement('p'); warning.className = 'hangar-part-warning'; warning.textContent = `${money(projected - budget())} over budget with this part`; card.append(warning); }
    button.className = 'hangar-install-part';
    const preview = document.createElement('button');
    preview.className = 'hangar-preview-part';
    preview.textContent = '◇ Preview in 3D';
    preview.setAttribute('aria-label', `Preview ${part.name} in 3D`);
    preview.setAttribute('aria-pressed', String(previewPart === part.id));
    preview.onclick = () => {
      previewPart = part.id; updateViewer();
      for (const control of list.querySelectorAll('.hangar-preview-part')) control.setAttribute('aria-pressed', String(control === preview));
      $('illustration').scrollIntoView({ block: 'center', behavior: 'instant' });
      $('illustration').querySelector('canvas')?.focus({ preventScroll: true });
    };
    const actions = document.createElement('div'); actions.className = 'hangar-part-actions'; actions.append(preview, button);
    card.append(actions, detail); list.append(card);
  }
  list.scrollTop = scrollTop;
}
function render() {
  renderCategories(); renderOptions(); renderInstalled(); renderNextAction();
  const count = groups.slice(0, 6).filter(([category]) => parts[category]).length;
  $('progress-label').textContent = `${count} / 6 core selections`;
  $('installed').textContent = `${chosen().length} ${chosen().length === 1 ? 'component' : 'components'}`;
  const bus = catalog.find(part => part.id === parts.bus);
  $('assembly-name').textContent = bus?.name || 'An idea taking shape.';
  $('assembly-description').textContent = bus ? `${mission.title} / ${parts.payload ? 'Payload selected. Keep building your support systems.' : 'Your chassis is ready for a payload.'}` : 'Choose a chassis to begin your build.';
  screen.dataset.solar = String(Boolean(parts.eps_solar));
  screen.dataset.camera = String(Boolean(parts.payload));
  screen.dataset.bus = String(Boolean(parts.bus));
  for (const button of $('mounts').children) {
    const installed = Boolean(parts[button.dataset.mount]);
    button.textContent = `${installed ? '✓' : '+'} ${button.dataset.label}`;
    button.setAttribute('aria-label', `${installed ? 'Edit' : 'Choose'} ${button.dataset.label.toLowerCase()}`);
  }
  $('review').disabled = loading || loadFailed;
  $('save').disabled = loading || loadFailed;
  updateViewer();
  const expanded = new Set([...$('metrics').querySelectorAll('details[open]')].map(item => item.dataset.metric));
  $('metrics').replaceChildren(...snapshot().filter(([label]) => label !== 'Mission performance').map(([label, value, status, detail]) => {
    const card = document.createElement('details'); card.className = 'hangar-metric';
    card.dataset.metric = label;
    card.open = expanded.has(label);
    card.dataset.status = /Over|Needs attention/.test(status) ? 'warning' : 'neutral';
    const summary = document.createElement('summary');
    const name = document.createElement('span'); name.textContent = label === 'Cost' ? 'Budget' : label;
    const number = document.createElement('strong'); number.textContent = value;
    const state = document.createElement('small'); state.textContent = status;
    summary.append(name, number, state);
    const description = document.createElement('p'); description.textContent = detail;
    card.append(summary, description); return card;
  }));
}
async function loadCatalog() {
  loading = true; loadFailed = false; render();
  try {
    const response = await fetch('/api/catalog/components');
    if (!response.ok) throw new Error('Catalog unavailable');
    const data = await response.json();
    if (!Array.isArray(data.components)) throw new Error('Invalid catalog');
    catalog = data.components;
    for (const [category, id] of Object.entries(parts)) if (!catalog.some(part => part.id === id && part.category === category)) delete parts[category];
  } catch { loadFailed = true; }
  finally { loading = false; render(); }
}
export function openHangar(scenario) {
  clearTimeout(feedbackTimer); feedbackAnimation?.cancel(); feedback.textContent = '';
  mission = scenario;
  const save = read(SAVE_KEY);
  const saved = Array.isArray(save?.blueprints) ? save.blueprints.find(item => item.id === `guided-${scenario.id}`) : null;
  const draft = drafts.get(scenario.id);
  parts = { ...(draft?.parts || saved?.components) };
  missionSettings = { ...(draft?.settings || saved?.missionSettings) };
  active = groups.slice(0, 6).find(([category]) => !parts[category])?.[0] || 'bus';
  dirty = draft?.dirty || false;
  previewPart = null;
  $('save-status').textContent = dirty ? 'Unsaved session assembly restored.' : saved ? 'Saved blueprint loaded.' : 'Changes stay in this session until saved.';
  $('mission').textContent = scenario.title;
  screen.querySelector('.hangar-panel-label > span').textContent = scenario.id !== 'urban' ? 'MISSION PARTS / TIERS 01–02' : 'BEGINNER / TIER 01';
  $('target').textContent = scenario.objectives[0];
  $('agency').textContent = save?.player?.agencyName || 'Independent agency';
  document.querySelector('#mission-select').inert = true;
  screen.hidden = false; document.body.classList.add('assembling');
  $('title').focus();
  ensureViewer(); viewer?.setActive(true);
  if (!catalog.length) loadCatalog(); else render();
}
$('back').onclick = () => {
  // Preserve session edits when returning from mission selection.
  drafts.set(mission.id, { parts: { ...parts }, settings: { ...missionSettings }, dirty });
  screen.hidden = true; document.body.classList.remove('assembling');
  viewer?.setActive(false);
  document.querySelector('#mission-select').inert = false;
  document.querySelector('#begin-mission').focus();
};
function persistBlueprint(plan) {
  const save = read(SAVE_KEY) || {};
  const blueprints = Array.isArray(save.blueprints) ? save.blueprints : [];
  const blueprint = { id: `guided-${mission.id}`, missionId: mission.id, name: `${mission.title} preview`, components: { ...parts }, missionSettings: { ...getDesign().settings }, preview: true };
  save.blueprints = [...blueprints.filter(item => item.id !== blueprint.id), blueprint];
  const plans = Array.isArray(save.missionPlans) ? save.missionPlans : [];
  save.missionPlans = plans.filter(item => item.missionId !== mission.id || (!plan && item.inputKey === missionInputKey(getDesign())));
  if (plan) save.missionPlans.push(plan);
  const saved = write(SAVE_KEY, save);
  if (saved) { dirty = false; drafts.set(mission.id, { parts: { ...parts }, settings: { ...missionSettings }, dirty: false }); }
  $('save-status').textContent = saved ? 'Blueprint saved on this device.' : 'Unable to save. Your assembly is still available in this session.';
  window.dispatchEvent(new Event('mission-saved'));
  return saved;
}
$('save').onclick = () => persistBlueprint();
$('review').onclick = () => {
  if (['agriculture','disaster'].includes(mission.id)) {
    const open = mission.id === 'disaster' ? openDisaster : openAgriculture;
    open({ catalog, getDesign,
      onSettingsChange: settings => { missionSettings = { ...settings }; dirty = true; render(); },
      onStarter: () => { parts = { ...missionConfig().starter }; missionSettings = { ...missionConfig().defaults }; previewPart = null; dirty = true; render(); },
    });
    return;
  }
  if (mission.id === 'urban') {
    openPreflight({ catalog, getDesign,
      onSettingsChange: settings => { missionSettings = { ...settings }; dirty = true; $('save-status').textContent = 'Unsaved mission settings'; render(); },
      onStarter: () => { parts = { ...urbanMission.starter }; missionSettings = { ...urbanMission.defaults }; previewPart = null; dirty = true; $('save-status').textContent = 'Unsaved starter build'; render(); showFeedback('Urban starter build applied.'); },
      onEditCategory: category => { select(category); $('part-title').focus({ preventScroll: true }); },
      onSavePlan: (report, proof) => {
        const design = getDesign();
        if (!evaluateMission(design, catalog).ready || report.inputKey !== missionInputKey(design) || !proof.passed || proof.inputKey !== report.inputKey) return { saved: false, message: 'Design changed. Run the checks again.' };
        return { saved: persistBlueprint({ id: 'plan-urban', missionId: mission.id, status: 'PREFLIGHT_PASSED', version: urbanMission.version, inputKey: report.inputKey, components: { ...parts }, settings: { ...report.settings }, target: urbanMission.target, station: urbanMission.station, metrics: report.metrics, checks: report.checks, assumptions: report.assumptions, physics: proof, createdAt: new Date().toISOString() }) };
      },
    });
    return;
  }
  const body = $('review-body'); body.replaceChildren();
  for (const [label, value, status] of snapshot()) { const p = document.createElement('p'); p.textContent = `${label}: ${value} — ${status}`; body.append(p); }
  const missing = groups.slice(0, 6).filter(([category]) => !parts[category]).map(([, label]) => label);
  const p = document.createElement('p'); p.textContent = missing.length ? `Still to select: ${missing.join(', ')}.` : 'Core selections are present. Complete slot, thermal, eclipse, pointing and downlink validation before flight.'; body.append(p);
  $('review-dialog').showModal();
};
$('reset').onclick = () => $('reset-dialog').showModal();
const viewOptions = screen.querySelector('.hangar-view-options');
screen.addEventListener('pointerdown', event => {
  if (viewOptions.open && !viewOptions.contains(event.target)) viewOptions.open = false;
});
screen.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !viewOptions.open || screen.querySelector('dialog[open]')) return;
  event.preventDefault();
  viewOptions.open = false;
  viewOptions.querySelector('summary').focus({ preventScroll: true });
});
$('reset-dialog').addEventListener('close', () => { if ($('reset-dialog').returnValue === 'reset') { parts = {}; previewPart = null; dirty = true; $('save-status').textContent = 'Unsaved changes.'; render(); } });
for (const id of ['zoom-in', 'zoom-out', 'camera-reset', 'cutaway', 'explode', 'ghost']) $(id).disabled = true;
$('ghost').onchange = event => viewer?.options({ wireframe: event.target.checked });
$('cutaway').onchange = event => viewer?.options({ cutaway: event.target.checked });
$('explode').onchange = event => { viewer?.options({ exploded: event.target.checked }); updateViewer(); };
$('camera-reset').onclick = () => viewer?.reset();
$('zoom-in').onclick = () => viewer?.zoom(.85);
$('zoom-out').onclick = () => viewer?.zoom(1.15);
$('preview-close').onclick = () => {
  previewPart = null;
  $('explode').checked = false;
  viewer?.options({ exploded: false });
  renderOptions(); updateViewer();
};
const previewInstall = document.createElement('button');
previewInstall.id = 'hangar-preview-install';
previewInstall.onclick = () => $('part-list').querySelector(`[data-part="${previewPart}"] .hangar-install-part`)?.click();
$('preview-banner').insertBefore(previewInstall, $('preview-close'));
window.addEventListener('pagehide', () => { clearTimeout(feedbackTimer); feedback.textContent = ''; feedbackAnimation?.cancel(); panelAnimation?.cancel(); viewer?.dispose(); viewer = null; });
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) for (const animation of screen.getAnimations({ subtree: true })) animation.cancel();
});
window.addEventListener('pageshow', () => { if (!screen.hidden) ensureViewer(); });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
$('mounts').replaceChildren(...[['bus', 'Chassis'], ['payload', 'Camera mount'], ['eps_solar', 'Solar wings']].map(([category, label]) => {
  const button = document.createElement('button');
  button.dataset.mount = category; button.dataset.label = label;
  button.onclick = () => { select(category); $('part-title').scrollIntoView({ block: 'nearest' }); $('part-title').focus({ preventScroll: true }); };
  return button;
}));

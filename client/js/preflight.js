import { evaluateMission, missionInputKey } from './engineering.js';
import { urbanMission, launchServices, launchSites } from './data/mission-config.js';
import { read, SAVE_KEY } from './storage.js';

let dialog, context, proof = null, controller = null;
const money = value => value === null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const $ = id => dialog.querySelector(`#plan-${id}`);

function createDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'preflight-dialog';
  dialog.setAttribute('aria-labelledby', 'plan-title');
  dialog.innerHTML = `<form>
    <header><div><p class="eyebrow">MISSION CONFIGURATION / PREFLIGHT</p><h2 id="plan-title">Prepare Urban Mapping.</h2></div><button id="plan-close" type="button" class="text-button" aria-label="Close mission planning">×</button></header>
    <p class="plan-context">Singapore test area · 10 × 10 km · Singapore CRISP S-band station<br>Scenario start: 6 Nov 2026, 00:00 UTC</p>
    <p class="plan-support">Mission support adds $400,000 of planning allowance to your agency funds. Planning does not spend or grant credits.</p>
    <div class="plan-settings"><label>Launch service<select id="plan-service"></select></label><label>Launch site<select id="plan-site"></select></label><label>Altitude (km)<input id="plan-altitude" type="number" min="400" max="600" step="1"></label><label>Inclination (°)<input id="plan-inclination" type="number" min="0" max="180" step="0.1"></label><label>Camera focal length (m)<select id="plan-focal"></select></label><div class="plan-orbit-hint" id="plan-orbit-hint"></div></div>
    <div id="plan-costs" class="plan-costs"></div>
    <div class="plan-starter"><p>Need a working first design?<small>Replaces the current component selection with an editable starter build.</small></p><button id="plan-starter" type="button">Use Urban starter build</button></div>
    <h3 id="plan-result" role="status"></h3><ul id="plan-problems" class="plan-checks"></ul><details class="plan-passed"><summary id="plan-passed-title"></summary><ul id="plan-passed" class="plan-checks"></ul></details>
    <section class="plan-orbit-check"><h3>Verify orbit & station access</h3><p>Use the existing physics backend to predict one orbit and 24 hours of station contact. This checks downlink capacity, not an actual completed observation.</p><button id="plan-check" type="button">Check orbit & station</button><p id="plan-orbit-status" role="status">Not checked for this design.</p></section>
    <details class="plan-assumptions"><summary>Model assumptions & remaining limits</summary><ul id="plan-assumptions"></ul></details>
    <footer><p id="plan-save-status" role="status">Save a plan after engineering and station checks pass. Save first, then launch into orbital operations.</p><button id="plan-save" class="action" type="button" disabled>Save validated mission plan</button></footer>
  </form>`;
  document.body.append(dialog);
  const station=document.createElement('section');station.className='plan-station-preview';station.setAttribute('aria-label','Singapore ground station preview');
  station.innerHTML=`<div class="plan-station-art"><svg viewBox="0 0 240 150" role="img" aria-label="Illustrative ground station antenna"><defs><linearGradient id="station-sky" x2="0" y2="1"><stop stop-color="#1d4252"/><stop offset="1" stop-color="#0d202b"/></linearGradient></defs><rect width="240" height="150" rx="10" fill="url(#station-sky)"/><g fill="#abc6d1"><circle cx="28" cy="28" r="1"/><circle cx="190" cy="22" r="1"/><circle cx="215" cy="58" r="1"/></g><path d="M18 123H222" stroke="#4c6a70"/><path d="M75 122L106 85L138 122M106 86V121" stroke="#92acb7" stroke-width="6" fill="none"/><g transform="translate(105 73) rotate(-32)"><path d="M-49-22Q0 62 49-22Z" fill="#829aa6" stroke="#ccdee4" stroke-width="2"/><path d="M-49-22Q0-4 49-22" stroke="#d6e6eb" fill="none"/><path d="M0 18V-42M-39-19L0-42L39-19" stroke="#c8d8df" stroke-width="2" fill="none"/><circle cy="-42" r="4" fill="#e4c68a"/></g><path d="M155 29Q180 44 182 69M170 18Q203 40 206 72" fill="none" stroke="#76c3ce" opacity=".65" stroke-width="2"/><rect x="167" y="104" width="38" height="18" rx="2" fill="#3b5864"/><path d="M175 110H196M175 116H190" stroke="#a4c7b3"/></svg><span>Illustrative station · not an actual site image</span></div><div class="plan-station-info"><p class="eyebrow">GROUND STATION / SINGAPORE</p><h4>Singapore CRISP</h4><p>1.30° N · 103.77° E<br>S-band · 10° minimum elevation</p><p id="plan-station-compatible"></p><dl id="plan-station-stats"></dl></div><div class="plan-station-passes"><p id="plan-station-pass-heading">Check the orbit to preview contact windows.</p><ul id="plan-station-passes"></ul></div>`;
  dialog.querySelector('.plan-orbit-check > p').before(station);
  dialog.querySelector('.plan-orbit-check > p').textContent='Preview one orbit and the first 24 hours of Singapore station contact. Check whether those passes can deliver your planned image.';
  const launch = document.createElement('button');
  launch.id = 'plan-launch'; launch.type = 'button';
  dialog.querySelector('form').append(launch);
  launch.onclick = async () => {
    const save = read(SAVE_KEY) || {};
    const selected = save.missionPlans?.find(item => item.missionId === 'urban' && item.inputKey === missionInputKey(context.getDesign()));
    launch.disabled = true; launch.textContent = 'Preparing orbital prediction…';
    try {
      const { openOrbitalMission } = await import('./orbit.js');
      dialog.close();
      await openOrbitalMission(selected, context.catalog);
    } catch (error) {
      if (!dialog.open) dialog.showModal();
      $('save-status').textContent = error.name === 'AbortError' ? 'Physics prediction timed out. Please retry.' : error.message;
    } finally { render(); }
  };
  for (const service of launchServices) $('service').add(new Option(service.name, service.id));
  for (const site of launchSites) $('site').add(new Option(site.name, site.id));
  $('close').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = event => event.preventDefault();
  dialog.addEventListener('close', () => { controller?.abort(); controller = null; });
  for (const id of ['service', 'site', 'altitude', 'inclination', 'focal']) $(id).addEventListener('change', () => {
    const settings = { launchServiceId: $('service').value, siteId: $('site').value, altitudeKm: Number($('altitude').value), inclinationDeg: Number($('inclination').value), focalLengthM: Number($('focal').value) };
    const service = launchServices.find(item => item.id === settings.launchServiceId);
    if (service?.fixedOrbit) Object.assign(settings, service.fixedOrbit);
    context.onSettingsChange(settings);
    invalidate(); fillSettings(); render();
  });
  $('starter').onclick = () => { context.onStarter(); invalidate(); fillSettings(); render(); $('save-status').textContent = 'Starter design applied. Check the orbit and station before saving the plan.'; };
  $('check').onclick = checkOrbit;
  $('save').onclick = () => {
    const design = context.getDesign();
    const report = evaluateMission(design, context.catalog);
    if (!report.ready || !proof?.passed || proof.inputKey !== missionInputKey(design)) { invalidate(); render(); return; }
    const result = context.onSavePlan(report, proof);
    $('save-status').textContent = result.saved ? 'Mission plan saved. Launch below to begin orbital operations.' : result.message || 'Could not save. Your design remains in this session.';
    render();
  };
}
function invalidate() {
  controller?.abort(); controller = null; proof = null;
  $('orbit-status').textContent = 'Not checked for this design.';
  $('save-status').textContent = 'Save a plan after engineering and station checks pass. Save first, then launch into orbital operations.';
}
function fillSettings() {
  const design = context.getDesign();
  const settings = { ...urbanMission.defaults, ...design.settings };
  for (const [id, key] of [['service', 'launchServiceId'], ['site', 'siteId'], ['altitude', 'altitudeKm'], ['inclination', 'inclinationDeg']]) $(id).value = settings[key];
  const camera = context.catalog.find(part => part.id === design.components.payload);
  const focals = camera?.focalLengthOptions || [{ focalLengthM: camera?.defaultFocalLengthM || 1 }];
  $('focal').replaceChildren(...focals.map(option => new Option(`${option.focalLengthM} m`, String(option.focalLengthM))));
  $('focal').value = settings.focalLengthM;
  $('focal').disabled = !camera;
  const fixed = Boolean(launchServices.find(service => service.id === settings.launchServiceId)?.fixedOrbit);
  $('site').disabled = fixed; $('altitude').readOnly = fixed; $('inclination').readOnly = fixed;
  $('orbit-hint').textContent = fixed ? 'Fixed rideshare insertion: 500 km, 97.4°, Vandenberg. Dedicated services allow custom orbits at their full catalog launch price.' : 'Choose a mission-compatible orbit and a reachable launch inclination. Dedicated services are substantially more expensive.';
}
function checkItem(item) {
  const li = document.createElement('li');
  li.dataset.passed = String(item.passed);
  const title = document.createElement('strong'); title.textContent = `${item.passed ? '✓' : '!'} ${item.label}`;
  const description = document.createElement('p'); description.textContent = item.detail;
  li.append(title, description);
  if (!item.passed && item.category) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = 'Edit components →';
    button.onclick = () => { dialog.close(); context.onEditCategory(item.category); };
    li.append(button);
  }
  return li;
}
function render() {
  const report = evaluateMission(context.getDesign(), context.catalog);
  const failed = report.checks.filter(item => !item.passed);
  $('result').textContent = failed.length ? `${failed.length} ${failed.length === 1 ? 'check needs' : 'checks need'} attention` : 'Engineering screening passed';
  $('problems').replaceChildren(...failed.map(checkItem));
  const passed = report.checks.filter(item => item.passed);
  $('passed-title').textContent = `${passed.length} checks passed — details`;
  $('passed').replaceChildren(...passed.map(checkItem));
  $('costs').replaceChildren(...[['Hardware', report.metrics.hardwareUSD], ['Launch', report.metrics.launchUSD], ['Total', report.metrics.totalUSD], ['Available', report.metrics.availableUSD]].map(([label, amount]) => {
    const box = document.createElement('div'); const name = document.createElement('span'); name.textContent = label;
    const value = document.createElement('strong'); value.textContent = money(amount); box.append(name, value); return box;
  }));
  $('assumptions').replaceChildren(...report.assumptions.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('check').disabled = Boolean(controller) || !report.checks.find(item => item.id === 'orbit')?.passed || !report.checks.find(item => item.id === 'launch')?.passed || !report.checks.find(item => item.id === 'radio')?.passed;
  $('check').textContent = controller ? 'Checking physics…' : 'Check orbit & station';
  $('save').disabled = !report.ready || !proof?.passed || proof.inputKey !== report.inputKey;
  const save = read(SAVE_KEY) || {};
  const resumable = Boolean(save.orbitalPractice || save.orbitalFlight);
  const savedPlan = save.missionPlans?.some(item => item.missionId === 'urban' && item.inputKey === report.inputKey);
  $('launch').disabled = !resumable && (!savedPlan || !report.ready);
  const support = save.missionSupportUsed?.urban ? 0 : urbanMission.planningSupportUSD;
  dialog.querySelector('.plan-support').textContent = support ? 'Mission support provides $400,000 of planning allowance alongside agency funds. Saving a plan is free; launch applies this support once and charges the remaining cost shown below.' : 'Urban mission support was already applied to the saved flight. Resume does not charge agency funds again.';
  $('launch').textContent = resumable ? (save.orbitalPractice ? 'Resume Mission Replay →' : 'Resume saved orbital mission →') : `Launch · ${money(Math.max(0, (report.metrics.totalUSD || 0) - support))} agency funds + mission support →`;
  renderStation(report);
}
function renderStation(report){
  const valid=proof&&proof.inputKey===report.inputKey;
  const compatible=report.checks.find(check=>check.id==='radio')?.passed;
  $('station-compatible').textContent=compatible?'✓ Selected radio supports this station':'Select a compatible S-band radio';
  $('station-compatible').dataset.compatible=String(Boolean(compatible));
  const values=[['Passes / 24 h',valid?String(proof.totalPasses):'—'],['Contact time',valid?`${(proof.totalContactTimeSec/60).toFixed(1)} min`:'—'],['Data capacity',valid?`${proof.totalDataCapacityMB.toFixed(1)} MB`:'—']];
  $('station-stats').replaceChildren(...values.flatMap(([name,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=value;return [dt,dd];}));
  $('station-pass-heading').textContent=controller?'Predicting contact windows…':valid?(proof.passes?.length?'Predicted contact windows · UTC':'No contact windows in the first 24 hours.'):'Check the orbit to preview contact windows.';
  $('station-passes').replaceChildren(...(valid?proof.passes||[]:[]).slice(0,4).map(pass=>{const li=document.createElement('li');const time=document.createElement('time');time.dateTime=new Date(pass.aosTime*1000).toISOString();time.textContent=time.dateTime.replace('T',' ').slice(5,16)+' UTC';const detail=document.createElement('span');detail.textContent=`${(pass.durationSeconds/60).toFixed(1)} min · ${pass.dataDownlinkedMB.toFixed(1)} MB`;li.append(time,detail);return li;}));
}
async function checkOrbit() {
  const design = context.getDesign(), report = evaluateMission(design, context.catalog);
  controller?.abort();
  const run = new AbortController(); controller = run; proof = null;
  $('orbit-status').textContent = 'Computing trajectory and contact passes…'; render();
  const settings = report.settings;
  const elements = { altitudeKm: settings.altitudeKm, inclinationDeg: settings.inclinationDeg, eccentricity: 0, raanDeg: 0, argPDeg: 0, maDeg: 0, epoch: Date.parse(urbanMission.epoch) / 1000 };
  const radio = context.catalog.find(part => part.id === design.components.comms);
  const post = async (route, body) => {
    const response = await fetch(`/api/physics/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: run.signal });
    if (!response.ok) throw new Error('Physics service unavailable. Please retry with the server running.');
    return response.json();
  };
  try {
    const [trajectory, link] = await Promise.all([
      post('propagate', { elements, duration: Math.ceil(report.metrics.periodSec), step: 30, includeSun: true, enableJ2: true }),
      post('link-budget', { orbit: elements, duration: 86400, step: 30, stationIds: [urbanMission.station.id], comms: { frequencyBand: radio.frequencyBand, downlinkMbps: radio.downlinkSpeedMbps, minElevationDeg: Math.max(radio.minStationElevationDeg || 0, urbanMission.station.minElevationDeg) } }),
    ]);
    if (run.signal.aborted || report.inputKey !== missionInputKey(context.getDesign())) return;
    if (!Number.isFinite(trajectory.periodSec) || trajectory.periodSec <= 0 || !trajectory.points?.length || !Number.isFinite(link.totalPasses) || !Number.isFinite(link.totalContactTimeSec) || !Number.isFinite(link.totalDataCapacityMB)) throw new Error('Physics service returned incomplete results. Retry the check.');
    const passed = link.totalPasses > 0 && report.metrics.imageMB !== null && link.totalDataCapacityMB >= report.metrics.imageMB;
    const passes=Array.isArray(link.passes)?link.passes.filter(pass=>[pass.aosTime,pass.durationSeconds,pass.dataDownlinkedMB].every(Number.isFinite)).map(({aosTime,durationSeconds,dataDownlinkedMB})=>({aosTime,durationSeconds,dataDownlinkedMB})):[];
    proof = { inputKey: report.inputKey, passed, periodSec: trajectory.periodSec, totalPasses: link.totalPasses, totalContactTimeSec: link.totalContactTimeSec, totalDataCapacityMB: link.totalDataCapacityMB, passes, checkedAt: new Date().toISOString(), elements };
    $('orbit-status').textContent = `${passed ? '✓' : '!'} ${(trajectory.periodSec / 60).toFixed(1)} min orbit; ${link.totalPasses} station passes in 24 h; ${link.totalDataCapacityMB.toFixed(1)} MB downlink capacity. ${passed ? 'Capacity is sufficient for one planned image.' : 'Contact capacity is insufficient for this image.'}`;
  } catch (error) {
    if (!run.signal.aborted) $('orbit-status').textContent = error.message;
  } finally {
    if (controller === run) { controller = null; render(); }
  }
}
export function openPreflight(options) {
  if (!dialog) createDialog();
  context = options; invalidate(); fillSettings(); render(); dialog.showModal();
  $('close').focus({ preventScroll: true });
  dialog.scrollTop = 0;
}

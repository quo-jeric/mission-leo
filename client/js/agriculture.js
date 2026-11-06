import { read, write, SAVE_KEY } from './storage.js';
import { agricultureMission as mission, farmingRegions, launchServices, launchSites } from './data/mission-config.js';
import { evaluateMission } from './engineering.js';
import { missionUnlocked, nextMission } from './progression.js';
import { createSeason, runSeasonDay, seasonScore, storedMB, completeSeason } from './agriculture-engine.js';

let panel, options, record, busy = false, stop = false, controller, focusedResult = '';
const $ = id => panel.querySelector(`#season-${id}`);
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const stations = [ ['gs_singapore', 'Singapore CRISP'], ['gs_svalbard', 'Svalbard'], ['gs_goldstone', 'Goldstone'], ['gs_canberra', 'Canberra'] ];
function build() {
  panel = document.createElement('section'); panel.id = 'agriculture-operations'; panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'season-title');
  panel.innerHTML = `<header><div><p class="eyebrow">MISSION 02 / AGRICULTURAL MONITORING</p><h1 id="season-title" tabindex="-1">Plan your growing season.</h1></div><button id="season-back">Save & return to workshop</button></header>
    <nav aria-label="Mission stages"><span id="season-step-build">01 Build</span><span id="season-step-fly">02 Schedule & deliver</span><span id="season-step-result">03 Season results</span></nav>
    <p id="season-message" role="status" aria-live="polite"></p>
    <section id="season-preflight" class="season-card"><p class="eyebrow">BEFORE LAUNCH</p><h2>A satellite, six regions, 120 days.</h2><p>Choose up to three regions per daily schedule. Each region requests one 10 × 10 km image per 20-day window. Only imagery fully delivered before its deadline earns priority weight.</p>
      <div class="season-fields"><label>Altitude (km)<input id="season-altitude" type="number" min="500" max="700" step="1"></label><label>Inclination (°)<input id="season-inclination" type="number" min="0" max="180" step="0.1"></label>
      <label>Camera focal length<select id="season-focal"></select></label><label>Ground station<select id="season-station"></select></label><label>Launch service<select id="season-service"></select></label><label>Launch site<select id="season-site"></select></label><label>Required weighted delivery (%)<input id="season-share" type="number" min="50" max="100" step="5"></label></div>
      <p id="season-cost"></p><div class="season-actions"><button id="season-starter">Use RGB starter build</button><button id="season-launch" class="season-primary">Validate & launch →</button><button id="season-resume" class="season-primary" hidden>Resume saved season →</button></div><ul id="season-checks"></ul>
    </section>
    <div id="season-flight" hidden><div id="season-telemetry" class="season-telemetry"></div>
      <div class="season-layout"><section class="season-card"><p class="eyebrow">YOUR OBSERVATION SCHEDULE</p><h2 id="season-day"></h2><p id="season-guidance"></p><div id="season-regions"></div><div class="season-actions"><label><input type="checkbox" id="season-radio"> Downlink during station passes</label><button id="season-day-run" class="season-primary">Run next day →</button><button id="season-week-run">Run 7 days</button><button id="season-stop" hidden>Stop after current day</button></div></section>
      <aside class="season-card"><p class="eyebrow">SEASON PROGRESS</p><h2 id="season-coverage"></h2><label for="season-progress">Priority-weighted imagery delivered</label><progress id="season-progress" max="100" value="0"></progress><p id="season-goal"></p><div id="season-result" hidden><h2 id="season-result-title" tabindex="-1"></h2><p id="season-result-detail"></p><div class="season-actions"><button id="season-next" class="season-primary" hidden>Next mission →</button><button id="season-retry">Try again for free</button></div></div><h3>Flight log</h3><ol id="season-log"></ol><details><summary>Launched build</summary><ul id="season-parts"></ul></details></aside></div>
    </div>
    <details class="season-limits"><summary>Model & limits</summary><p>Day-by-day scheduling using J2 propagation, illumination and station contacts from the physics backend, sampled every 30 seconds. Battery and throughput integrate at ≤1 second, split at station boundaries. Captures use a two-second exposure approximation, instantaneous pointing, sun elevation ≥10°, off-nadir ≤30°, and ≤30 m GSD. No clouds, slew dynamics, temperature evolution, drag or instrument degradation. Daily commands advance simulated time; leaving and offline time do not. Region coordinates, 20-day requests, 50–100% configurable target and $800,000 launch support are game scenario choices. RGB and multispectral catalog options are supported; this level evaluates delivery rather than a vegetation-index science product.</p></details>
    <dialog id="season-retry-dialog"><h2>Try this season again?</h2><p>Restart the same launched build on day 1 for free. This replaces the saved seasonal attempt; previous campaign unlocks and funds are preserved.</p><form method="dialog"><button value="cancel">Keep this attempt</button><button value="retry">Restart season</button></form></dialog>`;
  document.body.append(panel);
  for (const [id, entries] of [['station', stations], ['service', launchServices.map(s => [s.id, s.name])], ['site', launchSites.map(s => [s.id, s.name])]]) {
    for (const [value, name] of entries) $(id).add(new Option(name, value));
  }
  for (const id of ['altitude', 'inclination', 'focal', 'station', 'service', 'site', 'share']) $(id).onchange = () => {
    options.onSettingsChange(settings()); refreshChecks();
  };
  $('starter').onclick = () => { options.onStarter(); configure(); };
  $('launch').onclick = launch;
  $('resume').onclick = () => { record = read(SAVE_KEY).agricultureFlight; renderFlight(); };
  $('back').onclick = () => {
    if (busy) { stop = true; $('message').textContent = 'Finishing the current command before returning. Use Save & return once it finishes.'; return; }
    panel.hidden = true; document.querySelector('.space').inert = false;
    document.querySelector('#hangar-review').focus();
  };
  $('day-run').onclick = () => runDays(1); $('week-run').onclick = () => runDays(7);
  $('stop').onclick = () => { stop = true; $('message').textContent = 'Stopping after this day.'; };
  $('radio').onchange = () => changeCommand({ downlink: $('radio').checked });
  $('retry').onclick = () => $('retry-dialog').showModal();
  $('retry-dialog').onclose = () => {
    if ($('retry-dialog').returnValue !== 'retry') return;
    const retry = { ...record, state: createSeason(record.plan, options.catalog), replay: true };
    if (saveRecord(retry)) { record = retry; $('message').textContent = 'Free retry ready. No additional charge.'; renderFlight(); }
  };
  $('next').onclick = async () => {
    const next = nextMission(read(SAVE_KEY), 'agriculture'); if (!next) return;
    $('back').click(); document.querySelector('#hangar-back').click();
    const { openMissionBrief } = await import('./missions.js'); openMissionBrief(next.id);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && busy) { stop = true; controller?.abort(); } });
}
function settings() {
  return { altitudeKm: Number($('altitude').value), inclinationDeg: Number($('inclination').value), focalLengthM: Number($('focal').value),
    stationId: $('station').value, launchServiceId: $('service').value, siteId: $('site').value, requiredShare: Number($('share').value) / 100 };
}
function configure() {
  const design = options.getDesign(), config = { ...mission.defaults, ...design.settings };
  const camera = options.catalog.find(p => p.id === design.components.payload);
  $('focal').replaceChildren(...(camera?.focalLengthOptions || []).map(o => new Option(`${o.focalLengthM} m`, o.focalLengthM)));
  for (const [id, value] of Object.entries({ altitude: config.altitudeKm, inclination: config.inclinationDeg, focal: config.focalLengthM, station: config.stationId, service: config.launchServiceId, site: config.siteId, share: config.requiredShare * 100 })) $(id).value = value;
  $('preflight').hidden = false; $('flight').hidden = true;
  const existing = read(SAVE_KEY)?.agricultureFlight;
  $('resume').hidden = !existing;
  $('launch').hidden = !$('resume').hidden;
  panel.querySelector('.season-fields').hidden = Boolean(existing);
  $('checks').hidden = $('starter').hidden = Boolean(existing);
  $('title').textContent = 'Plan your growing season.';
  refreshChecks();
}
function refreshChecks() {
  const existing = read(SAVE_KEY)?.agricultureFlight;
  if (existing) {
    $('cost').textContent = `Saved season: day ${existing.state.day} / 120. Launch already paid: ${money(existing.agencyChargeUSD)} agency funds and ${money(existing.supportUSD)} mission support. Resume uses the original launched build; workshop edits are saved separately.`;
    return;
  }
  const report = evaluateMission({ ...options.getDesign(), settings: settings() }, options.catalog);
  $('cost').textContent = `${money(report.metrics.hardwareUSD)} hardware + ${money(report.metrics.launchUSD)} launch · ${money(report.metrics.availableUSD)} available with remaining mission support. Existing saved seasons resume without another charge.`;
  $('checks').replaceChildren(...report.checks.filter(c => !c.passed).map(c => { const li = document.createElement('li'); li.textContent = `${c.label}: ${c.detail}`; return li; }));
  if (report.ready) $('checks').textContent = 'Engineering checks passed. Launch checks daily station access before spending funds.';
  $('launch').disabled = !report.ready || busy;
  return report;
}
async function prediction(plan, day) {
  const startTime = Date.parse(mission.epoch) / 1000 + day * 86400;
  const radio = options.catalog.find(p => p.id === plan.components.comms);
  const post = async (route, body) => {
    const response = await fetch(`/api/physics/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Physics unavailable'); return result;
  };
  const [trajectory, link] = await Promise.all([
    post('propagate', { elements: plan.elements, startTime, duration: 86400, step: 30 }),
    post('link-budget', { orbit: plan.elements, startTime, duration: 86400, step: 30, stationIds: [plan.settings.stationId], comms: { frequencyBand: radio.frequencyBand, downlinkMbps: radio.downlinkSpeedMbps, minElevationDeg: Math.max(10, radio.minStationElevationDeg || 0) } }),
  ]);
  if (!Array.isArray(trajectory.points) || !Array.isArray(link.passes)) throw new Error('Incomplete physics response');
  return { trajectory, link };
}
async function launch() {
  if (busy || !missionUnlocked(read(SAVE_KEY), 'agriculture')) return;
  const design = { ...options.getDesign(), settings: settings() }, report = evaluateMission(design, options.catalog);
  if (!report.ready) return;
  busy = true; controller = new AbortController(); refreshChecks(); $('message').textContent = 'Checking launch orbit and station…';
  try {
    const plan = { components: { ...design.components }, settings: report.settings, metrics: report.metrics,
      elements: { altitudeKm: report.settings.altitudeKm, inclinationDeg: report.settings.inclinationDeg, epoch: Date.parse(mission.epoch) / 1000, eccentricity: 0, raanDeg: 0, argPDeg: 0, maDeg: 0 } };
    const proof = await prediction(plan, 0);
    if (!proof.link.totalPasses) throw new Error('No station pass in the first day. Choose another station or orbit.');
    const save = read(SAVE_KEY) || {};
    if (save.agricultureFlight) throw new Error('A season already exists. Resume it without another charge.');
    if (evaluateMission({ ...options.getDesign(), settings: settings() }, options.catalog).inputKey !== report.inputKey) throw new Error('Design changed. Validate again.');
    const supportUSD = save.missionSupportUsed?.agriculture ? 0 : Math.min(mission.planningSupportUSD, report.metrics.totalUSD);
    const agencyChargeUSD = report.metrics.totalUSD - supportUSD;
    if ((save.player?.credits ?? 250000) < agencyChargeUSD) throw new Error('Insufficient agency funds.');
    const next = { plan, state: createSeason(plan, options.catalog), supportUSD, agencyChargeUSD, launchedAt: new Date().toISOString() };
    const updated = { ...save, agricultureFlight: next, missionSupportUsed: { ...save.missionSupportUsed, agriculture: true }, player: { ...save.player,
      credits: (save.player?.credits ?? 250000) - agencyChargeUSD, stats: { ...save.player?.stats, launches: (save.player?.stats?.launches || 0) + 1 } } };
    if (!write(SAVE_KEY, updated)) throw new Error('Unable to save. Launch cancelled; no funds charged.');
    record = next; window.dispatchEvent(new Event('mission-saved'));
    $('message').textContent = `Launched. Agency charge: ${money(agencyChargeUSD)}; support applied: ${money(supportUSD)}. Choose your daily schedule.`;
    renderFlight();
  } catch (error) { $('message').textContent = error.name === 'AbortError' ? 'Check cancelled. No funds charged.' : error.message; }
  finally { busy = false; if (record) renderFlight(); else refreshChecks(); }
}
function saveRecord(next) {
  const save = read(SAVE_KEY) || {};
  const updated = completeSeason({ ...save, agricultureFlight: next }, next.state, next.plan);
  if (!write(SAVE_KEY, updated)) { $('message').textContent = 'Storage unavailable. This change was not committed; retry when storage is available.'; return false; }
  window.dispatchEvent(new Event('mission-saved')); return true;
}
function changeCommand(change) {
  if (busy || record.state.status !== 'ACTIVE') return;
  const next = { ...record, state: { ...record.state, ...change } };
  if (saveRecord(next)) record = next;
  renderFlight();
}
async function runDays(count) {
  if (busy || record.state.status !== 'ACTIVE') return;
  busy = true; stop = false; controller = new AbortController(); renderFlight();
  try {
    for (let i = 0; i < count && !stop && record.state.status === 'ACTIVE'; i++) {
      $('message').textContent = `Running day ${record.state.day + 1} / 120…`;
      const { trajectory, link } = await prediction(record.plan, record.state.day);
      if (controller.signal.aborted) break;
      const next = { ...record, state: runSeasonDay(record.plan, options.catalog, record.state, trajectory.points, link.passes) };
      if (!saveRecord(next)) { stop = true; break; }
      record = next; renderFlight();
    }
    if (!stop) $('message').textContent = `Saved through day ${record.state.day}. Review deliveries and adjust priorities for the next schedule.`;
  } catch (error) { $('message').textContent = error.name === 'AbortError' ? 'Paused. Last completed day is saved.' : `${error.message}. Last completed day is saved; retry to continue.`; }
  finally { busy = false; renderFlight(); }
}
function renderFlight() {
  const { state, plan } = record, active = state.status === 'ACTIVE', score = seasonScore(state);
  $('preflight').hidden = true; $('flight').hidden = false;
  $('title').textContent = active ? 'Command your growing season.' : 'Your season results.';
  $('step-fly').setAttribute('aria-current', active ? 'step' : 'false'); $('step-result').setAttribute('aria-current', active ? 'false' : 'step');
  $('day').textContent = active ? `Plan day ${state.day + 1} of 120` : `Season stopped after ${state.day} days`;
  $('guidance').textContent = 'Select up to 3 regions. Rotate priorities after delivery; leaving only the first three selected earns at most 67% of the season’s weight. Requests renew every 20 days.';
  const metrics = [['Battery', `${state.batteryWh.toFixed(1)} Wh`], ['Lowest battery', `${state.minimumBatteryWh.toFixed(1)} Wh`], ['Onboard images', `${storedMB(state).toFixed(2)} MB`], ['Ground station', stations.find(s => s[0] === plan.settings.stationId)?.[1] || plan.settings.stationId]];
  $('telemetry').replaceChildren(...metrics.map(([label, value]) => { const item = document.createElement('div'); const span = document.createElement('span'); span.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; item.append(span, strong); return item; }));
  const day = Math.min(state.day + 1, 120);
  $('regions').replaceChildren(...farmingRegions.map(region => {
    const request = state.requests.find(r => r.regionId === region.id && r.opensDay <= day && r.closesDay >= day);
    const row = document.createElement('label'); row.className = 'season-region';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.priorities.includes(region.id);
    input.disabled = busy || !active || (!input.checked && state.priorities.length >= 3);
    input.onchange = () => changeCommand({ priorities: input.checked ? [...state.priorities, region.id] : state.priorities.filter(id => id !== region.id) });
    const name = document.createElement('strong'); name.textContent = region.name;
    const status = document.createElement('span'); status.textContent = `Weight ${region.weight} · ${request.completed ? '✓ Delivered' : request.expired ? 'Deadline missed' : request.captured ? `Queued · ${request.deliveredMB.toFixed(2)} / ${request.totalMB.toFixed(2)} MB` : 'Awaiting observation'} · deadline day ${request.closesDay}`;
    row.append(input, name, status); return row;
  }));
  $('radio').checked = state.downlink; $('radio').disabled = busy || !active;
  $('day-run').disabled = $('week-run').disabled = busy || !active;
  $('stop').hidden = !busy;
  $('coverage').textContent = `${(score * 100).toFixed(1)}% delivered`;
  $('progress').value = score * 100; $('goal').textContent = `Goal: ${Math.round(plan.settings.requiredShare * 100)}% across all 36 requests by day 120. Captures and partial deliveries do not count.`;
  $('log').replaceChildren(...state.log.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('parts').replaceChildren(...Object.values(plan.components).map(id => { const li = document.createElement('li'); li.textContent = options.catalog.find(p => p.id === id)?.name || id; return li; }));
  $('result').hidden = active;
  $('result-title').textContent = state.status === 'COMPLETE' ? 'Mission complete!' : state.status === 'POWER_LOSS' ? 'Mission failed: battery reserve' : 'Season ended: delivery goal missed';
  $('result-detail').textContent = state.status === 'COMPLETE' ? 'The required priority-weighted imagery reached Earth before its deadlines. Disaster Monitoring is unlocked; its workshop is a preview.' : 'Try again for free with this launched build and adjust regional priorities and downlink commands. Workshop edits do not change this flight.';
  const next = nextMission(read(SAVE_KEY), 'agriculture'); $('next').hidden = !next; if (next) $('next').textContent = `Next: ${next.title} →`;
  if (active) focusedResult = '';
  else if (!busy && focusedResult !== state.status) { focusedResult = state.status; $('result-title').focus(); }
}
export function openAgriculture(config) {
  if (!missionUnlocked(read(SAVE_KEY), 'agriculture')) return false;
  if (!panel) build(); options = config; record = null;
  panel.hidden = false; document.querySelector('.space').inert = true;
  $('message').textContent = ''; configure(); $('title').focus(); return true;
}

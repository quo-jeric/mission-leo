import { read, write, SAVE_KEY } from './storage.js';
import { agricultureMission, farmingRegions, disasterMission, disasterRegions, launchServices, launchSites } from './data/mission-config.js';
import { evaluateMission } from './engineering.js';
import { missionUnlocked, nextMission } from './progression.js';
import { createSeason as createAgricultureSeason, seasonScore, storedMB, completeSeason as completeAgriculture } from './agriculture-engine.js';
import { createDisaster, completeDisaster, recoverDisaster, discardDisasterImage, disasterConditions } from './disaster-engine.js';
import { mountSeasonOrbit } from './season-orbit.js';

let mission=agricultureMission,flightKey='agricultureFlight',createSeason=createAgricultureSeason,completeSeason=completeAgriculture;
const isDisaster=()=>mission.id==='disaster';

let panel, options, record, busy = false, stop = false, controller, focusedResult = '';
let orbital, orbitalKey='';
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
  const flow=document.createElement('div');flow.className='mission-flow';flow.id='season-flight-flow';flow.hidden=true;
  flow.innerHTML='<ol aria-label="Mission steps"><li>Travel</li><li>Aim</li><li>Capture</li><li>Downlink</li><li>Complete</li></ol>';panel.querySelector('header>div').append(flow);
  const layout=panel.querySelector('.season-layout'),schedule=layout.querySelector('section'),sidebar=layout.querySelector('aside');
  const world=document.createElement('section');world.id='season-orbital-world';world.className='season-orbit-world';
  layout.prepend(world);sidebar.prepend(schedule);schedule.classList.add('season-schedule');
  const capturePreview=document.createElement('div');capturePreview.id='season-capture-preview';schedule.after(capturePreview);
  layout.classList.add('mission-layout');world.classList.add('mission-world');sidebar.classList.add('mission-sidebar');
  sidebar.prepend($('telemetry'));
  // Observation priorities remain context; all flight actions use explicit orbital controls.
  $('day-run').hidden=$('week-run').hidden=$('stop').hidden=true;
  $('radio').parentElement.hidden=true;
  $('step-fly').textContent='02 Fly · capture · deliver';
  schedule.querySelector('.eyebrow').textContent='REGION REQUESTS / DEADLINES';
  for (const [id, entries] of [['station', stations], ['service', launchServices.map(s => [s.id, s.name])], ['site', launchSites.map(s => [s.id, s.name])]]) {
    for (const [value, name] of entries) $(id).add(new Option(name, value));
  }
  for (const id of ['altitude', 'inclination', 'focal', 'station', 'service', 'site', 'share']) $(id).onchange = () => {
    options.onSettingsChange(settings()); refreshChecks();
  };
  $('starter').onclick = () => { options.onStarter(); configure(); };
  $('launch').onclick = launch;
  $('resume').onclick = () => { record = read(SAVE_KEY)[flightKey];if(record.state.status!=='ACTIVE')saveRecord(record);renderFlight(); };
  $('back').onclick = () => {
    orbital?.dispose();orbital=null;orbitalKey='';
    if (busy) { stop = true; $('message').textContent = 'Finishing the current command before returning. Use Save & return once it finishes.'; return; }
    panel.hidden = true; document.querySelector('.space').inert = false;
    document.querySelector('#hangar-review').focus();
  };
  $('stop').onclick = () => { stop = true; $('message').textContent = 'Stopping after this day.'; };
  $('radio').onchange = () => changeCommand({ downlink: $('radio').checked });
  const advanced=document.createElement('section');advanced.id='season-disaster-tools';advanced.hidden=true;
  advanced.innerHTML='<p id="season-alerts" role="status"></p><label>Image queue<select id="season-queue"><option value="deadline">Earliest deadline first</option><option value="priority">Highest priority first</option></select></label><div class="season-actions"><button id="season-reset-payload">Reset payload · 0.05 Wh</button><button id="season-reset-wheels">Recalibrate wheels · 0.1 Wh</button></div>';
  $('regions').before(advanced);
  const seedLabel=document.createElement('label');seedLabel.id='season-seed-label';seedLabel.innerHTML='Scenario seed<input id="season-seed" type="number" min="1" max="999999" step="1">';panel.querySelector('.season-fields').append(seedLabel);
  $('seed').onchange=()=>{options.onSettingsChange(settings());refreshChecks();};
  $('queue').onchange=()=>changeCommand({queueOrder:$('queue').value});
  for(const [id,kind]of [['reset-payload','payload'],['reset-wheels','wheels']])$(id).onclick=()=>{
    const state=recoverDisaster(record.state,record.plan,options.catalog,kind);
    if(state===record.state){$('message').textContent='Recovery unavailable: no matching fault or insufficient battery reserve.';return;}
    const next={...record,state};if(saveRecord(next)){record=next;renderFlight();}
  };
  const anotherSeed=document.createElement('button');anotherSeed.id='season-new-seed';anotherSeed.textContent='Retry with next seed';
  $('retry').after(anotherSeed);anotherSeed.onclick=()=>{$('retry-dialog').dataset.nextSeed='true';$('retry-dialog').showModal();};
  const history=document.createElement('p');history.id='season-run-history';$('result').append(history);
  panel.querySelector('.season-limits p').dataset.agricultureText=panel.querySelector('.season-limits p').textContent;
  $('retry').onclick=()=>{delete $('retry-dialog').dataset.nextSeed;$('retry-dialog').showModal();};
  $('retry-dialog').onclose = () => {
    if ($('retry-dialog').returnValue !== 'retry') return;
    const plan=isDisaster()&&$('retry-dialog').dataset.nextSeed?{...record.plan,settings:{...record.plan.settings,seed:record.plan.settings.seed%999999+1}}:record.plan;
    const retry = { ...record,plan, state: createSeason(plan, options.catalog), replay: true };
    if (saveRecord(retry)) { orbital?.dispose();orbital=null;orbitalKey='';record = retry; $('message').textContent = 'Free retry ready. No additional charge.'; renderFlight(); }
  };
  $('next').onclick = async () => {
    const next = nextMission(read(SAVE_KEY), mission.id); if (!next) return;
    $('back').click(); document.querySelector('#hangar-back').click();
    const { openMissionBrief } = await import('./missions.js'); openMissionBrief(next.id);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && busy) { stop = true; controller?.abort(); } });
}
function settings() {
  return { altitudeKm: Number($('altitude').value), inclinationDeg: Number($('inclination').value), focalLengthM: Number($('focal').value),
    stationId: $('station').value, launchServiceId: $('service').value, siteId: $('site').value, requiredShare: Number($('share').value) / 100,
    ...(isDisaster()?{seed:Number($('seed').value)}:{}) };
}
function configure() {
  const design = options.getDesign(), config = { ...mission.defaults, ...design.settings };
  const camera = options.catalog.find(p => p.id === design.components.payload);
  panel.dataset.mission=mission.id;
  panel.querySelector('header .eyebrow').textContent=isDisaster()?'MISSION 03 / DISASTER MONITORING':'MISSION 02 / AGRICULTURAL MONITORING';
  $('step-result').textContent=isDisaster()?'03 Operations results':'03 Season results';
  $('coverage').previousElementSibling.textContent=isDisaster()?'RESPONSE PROGRESS':'SEASON PROGRESS';
  $('preflight').querySelector('h2').textContent=isDisaster()?'Urgent requests. Ninety days. One spacecraft.':'A satellite, six regions, 120 days.';
  $('preflight').querySelector('h2 + p').textContent=isDisaster()?'Fly your built satellite, select urgent targets, aim and capture, then send images to Earth before their 48–96 hour deadlines. Watch clouds, station outages and recoverable spacecraft faults.':'Fly your built satellite over six farming regions. Select a region, aim and capture, then downlink during station contact. Each region requests one 10 × 10 km image per 20-day window; only full on-time delivery earns credit.';
  $('seed-label').hidden=!isDisaster();$('seed').value=config.seed||11;
  const limits=panel.querySelector('.season-limits p');
  limits.textContent=`Manual orbital gameplay over ${mission.days} simulated days. Seven-day rolling J2, eclipse and station predictions use 30 s samples; battery and radio throughput integrate at ≤1 s and split at contact/deadline boundaries. Advancing time never captures automatically. Aim in Target camera and explicitly capture a 10 × 10 km region, then enable downlink. Imaging requires sunlight, sun elevation ≥10°, storage, battery reserve and ≤30 m conservative oblique GSD; instantaneous pointing and a 2 s exposure-energy approximation are retained. Off-nadir limit: ${isDisaster()?'camera-supported up to 45°, reduced to 8° during wheel faults':'30°'}. Geographic coastline maps are not photographic imagery; historical Singapore imagery is labeled where available. ${isDisaster()?'Seeded clouds change on six-hour boundaries; station outages, battery degradation and recoverable faults are simplified game scenarios. Payload/wheel recovery costs 0.05/0.1 Wh.':'No cloud, drag, detailed thermal or attitude dynamics are simulated.'} Full on-time delivery alone earns credit. Pausing, hiding or leaving stops simulated time. Mission support applies once; resume and retry do not charge again.`;
  $('resume').textContent=isDisaster()?'Resume disaster operations →':'Resume saved season →';
  $('day-run').textContent=isDisaster()?'Run next 6 hours →':'Run next day →';
  $('week-run').textContent=isDisaster()?'Run 24 hours':'Run 7 days';
  $('stop').textContent=isDisaster()?'Stop after this command':'Stop after current day';
  $('retry-dialog').querySelector('h2').textContent=isDisaster()?'Retry disaster operations?':'Try this season again?';
  $('retry-dialog').querySelector('p').textContent='Restart the same launched build for free. The current attempt is replaced; funds, previous results and campaign completion are preserved.';
  $('focal').replaceChildren(...(camera?.focalLengthOptions || []).map(o => new Option(`${o.focalLengthM} m`, o.focalLengthM)));
  for (const [id, value] of Object.entries({ altitude: config.altitudeKm, inclination: config.inclinationDeg, focal: config.focalLengthM, station: config.stationId, service: config.launchServiceId, site: config.siteId, share: config.requiredShare * 100 })) $(id).value = value;
  $('preflight').hidden = false; $('flight').hidden = true;
  panel.dataset.phase='preflight';
  $('flight-flow').hidden=true;
  panel.classList.remove('mission-control');
  const existing = read(SAVE_KEY)?.[flightKey];
  $('resume').hidden = !existing;
  $('launch').hidden = !$('resume').hidden;
  panel.querySelector('.season-fields').hidden = Boolean(existing);
  $('checks').hidden = $('starter').hidden = Boolean(existing);
  $('title').textContent = isDisaster()?'Prepare disaster response.':'Plan your growing season.';
  refreshChecks();
}
function refreshChecks() {
  const existing = read(SAVE_KEY)?.[flightKey];
  if (existing) {
    $('cost').textContent = `Saved operations: day ${existing.state.day} / ${mission.days}. Launch already paid: ${money(existing.agencyChargeUSD)} agency funds and ${money(existing.supportUSD)} mission support. Resume uses the original launched build; workshop edits are saved separately.`;
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
    post('propagate', { elements: plan.elements, startTime, duration: mission.turnSec || 86400, step: 30 }),
    post('link-budget', { orbit: plan.elements, startTime, duration: mission.turnSec || 86400, step: 30, stationIds: [plan.settings.stationId], comms: { frequencyBand: radio.frequencyBand, downlinkMbps: radio.downlinkSpeedMbps, minElevationDeg: Math.max(10, radio.minStationElevationDeg || 0) } }),
  ]);
  if (!Array.isArray(trajectory.points) || !Array.isArray(link.passes)) throw new Error('Incomplete physics response');
  return { trajectory, link };
}
async function launch() {
  if (busy || !missionUnlocked(read(SAVE_KEY), mission.id)) return;
  const design = { ...options.getDesign(), settings: settings() }, report = evaluateMission(design, options.catalog);
  if (!report.ready) return;
  busy = true; controller = new AbortController(); refreshChecks(); $('message').textContent = 'Checking launch orbit and station…';
  try {
    const plan = { components: { ...design.components }, settings: report.settings, metrics: report.metrics,
      elements: { altitudeKm: report.settings.altitudeKm, inclinationDeg: report.settings.inclinationDeg, epoch: Date.parse(mission.epoch) / 1000, eccentricity: 0, raanDeg: 0, argPDeg: 0, maDeg: 0 } };
    const proof = await prediction(plan, 0);
    if (!proof.link.totalPasses) throw new Error('No station pass in the first day. Choose another station or orbit.');
    const save = read(SAVE_KEY) || {};
    if (save[flightKey]) throw new Error('A season already exists. Resume it without another charge.');
    if (evaluateMission({ ...options.getDesign(), settings: settings() }, options.catalog).inputKey !== report.inputKey) throw new Error('Design changed. Validate again.');
    const supportUSD = save.missionSupportUsed?.[mission.id] ? 0 : Math.min(mission.planningSupportUSD, report.metrics.totalUSD);
    const agencyChargeUSD = report.metrics.totalUSD - supportUSD;
    if ((save.player?.credits ?? 250000) < agencyChargeUSD) throw new Error('Insufficient agency funds.');
    const next = { plan, state: createSeason(plan, options.catalog), supportUSD, agencyChargeUSD, launchedAt: new Date().toISOString() };
    const updated = { ...save, [flightKey]: next, missionSupportUsed: { ...save.missionSupportUsed, [mission.id]: true }, player: { ...save.player,
      credits: (save.player?.credits ?? 250000) - agencyChargeUSD, stats: { ...save.player?.stats, launches: (save.player?.stats?.launches || 0) + 1 } } };
    if (!write(SAVE_KEY, updated)) throw new Error('Unable to save. Launch cancelled; no funds charged.');
    record = next; window.dispatchEvent(new Event('mission-saved'));
  $('message').textContent = `Launched. Agency charge: ${money(agencyChargeUSD)}; support applied: ${money(supportUSD)}. Select a target and advance to its imaging window.`;
    renderFlight();
  } catch (error) { $('message').textContent = error.name === 'AbortError' ? 'Check cancelled. No funds charged.' : error.message; }
  finally { busy = false; if (record) renderFlight(); else refreshChecks(); }
}
function saveRecord(next) {
  const save = read(SAVE_KEY) || {};
  if(record&&save[flightKey]&&(save[flightKey].state.day!==record.state.day||save[flightKey].state.runId!==record.state.runId||(save[flightKey].revision||0)!==(record.revision||0))){
    $('message').textContent='This attempt changed in another tab. Return and resume the saved operations before continuing.';return false;
  }
  next.revision=(record?.revision||0)+1;
  const updated = completeSeason({ ...save, [flightKey]: next }, next.state, next.plan);
  if (!write(SAVE_KEY, updated)) { $('message').textContent = 'Storage unavailable. This change was not committed; retry when storage is available.'; return false; }
  window.dispatchEvent(new Event('mission-saved')); return true;
}
function changeCommand(change) {
  if (busy || record.state.status !== 'ACTIVE') return;
  orbital?.pause();
  const next = { ...record, state: { ...record.state, ...change } };
  if (saveRecord(next)) record = next;
  renderFlight();
}
function renderFlight() {
  const { state, plan } = record, active = state.status === 'ACTIVE', score = seasonScore(state);
  $('preflight').hidden = true; $('flight').hidden = false;
  panel.dataset.phase='flight';
  $('flight-flow').hidden=false;
  panel.classList.add('mission-control');
  $('title').textContent = isDisaster()?(active?'Disaster response · your launched build':'Disaster response results.'):(active?'Agricultural monitoring · your launched build':'Your season results.');
  $('step-fly').setAttribute('aria-current', active ? 'step' : 'false'); $('step-result').setAttribute('aria-current', active ? 'false' : 'step');
  $('day').textContent = `Day ${Math.min(mission.days,Math.floor(state.day)+1)} / ${mission.days} · ${(state.day%1*24).toFixed(1)} h`;
  $('guidance').textContent = 'Choose an observation target beside the Earth view. Capture images in Target camera, then select Send images to Earth. Requests below show deliveries and deadlines; selecting a priority never captures automatically.';
  $('disaster-tools').hidden=!isDisaster();$('new-seed').hidden=!isDisaster();
  if(isDisaster()){
    const c=disasterConditions(state);
    $('alerts').textContent=`Seed ${state.seed} · Battery capacity ${(state.batteryFactor*100).toFixed(1)}% · ${c.stationOutage?'Station outage this command':'Station available'} · ${state.payloadOffline?'PAYLOAD OFFLINE':'Payload online'} · ${state.wheelFault?'WHEEL FAULT — 8° pointing limit':'Pointing available'} · Clouds: ${c.cloudRegions.map(id=>disasterRegions.find(r=>r.id===id).name).join(', ')||'clear'}`;
    $('queue').value=state.queueOrder;$('queue').disabled=busy||!active;
    $('reset-payload').disabled=busy||!active||!state.payloadOffline;
    $('reset-wheels').disabled=busy||!active||!state.wheelFault;
  }
  const metrics = [['Battery', `${state.batteryWh.toFixed(1)} Wh`], ['Lowest battery', `${state.minimumBatteryWh.toFixed(1)} Wh`], ['Onboard images', `${storedMB(state).toFixed(2)} MB`], ['Ground station', stations.find(s => s[0] === plan.settings.stationId)?.[1] || plan.settings.stationId]];
  $('telemetry').replaceChildren(...metrics.map(([label, value]) => { const item = document.createElement('div'); const span = document.createElement('span'); span.textContent = label; const strong = document.createElement('strong'); strong.textContent = value; item.append(span, strong); return item; }));
  // Request labels use calendar days; orbital playback stores fractional elapsed days.
  // E.g. elapsed 39.47 is still day 40, not a nonexistent request day 40.47.
  const day = Math.min(Math.floor(state.day) + 1, mission.days);
  if(!isDisaster())$('regions').replaceChildren(...farmingRegions.map(region => {
    const request = state.requests.find(r => r.regionId === region.id && r.opensDay <= day && r.closesDay >= day);
    const row = document.createElement('label'); row.className = 'season-region';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.priorities.includes(region.id);
    input.disabled = true;input.hidden=true;
    input.onchange = () => changeCommand({ priorities: input.checked ? [...state.priorities, region.id] : state.priorities.filter(id => id !== region.id) });
    const name = document.createElement('strong'); name.textContent = region.name;
    const status = document.createElement('span'); status.textContent = request ? `Weight ${region.weight} · ${request.completed ? '✓ Delivered' : request.expired ? 'Deadline missed' : request.captured ? `Queued · ${request.deliveredMB.toFixed(2)} / ${request.totalMB.toFixed(2)} MB` : 'Awaiting observation'} · deadline day ${request.closesDay}` : 'No request in this window. Choose another open target.';
    row.append(input, name, status); return row;
  }));
  if(isDisaster())renderDisasterRequests(state,active);
  $('radio').checked = state.downlink; $('radio').disabled = busy || !active;
  $('day-run').disabled = $('week-run').disabled = busy || !active;
  $('stop').hidden = true;
  $('coverage').textContent = `${(score * 100).toFixed(1)}% delivered`;
  $('progress').value = score * 100; $('goal').textContent = `Goal: ${Math.round(plan.settings.requiredShare * 100)}% across all ${isDisaster()?60:36} requests by day ${mission.days}. Captures and partial deliveries do not count.`;
  $('log').replaceChildren(...state.log.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('parts').replaceChildren(...Object.values(plan.components).map(id => { const li = document.createElement('li'); li.textContent = options.catalog.find(p => p.id === id)?.name || id; return li; }));
  $('result').hidden = active;
  $('result-title').textContent = state.status === 'COMPLETE' ? 'Mission complete!' : state.status === 'POWER_LOSS' ? 'Mission failed: battery reserve' : isDisaster()?'Operations ended: delivery goal missed':'Season ended: delivery goal missed';
  $('result-detail').textContent = state.status === 'COMPLETE' ? isDisaster()?'Campaign complete! The disaster delivery goal was achieved. Retry the same seed or compare another seed for free.':'The required priority-weighted imagery reached Earth before its deadlines. Disaster Monitoring is unlocked.':'Try again for free with this launched build and adjust priorities and downlink commands. Workshop edits do not change this flight.';
  const next = nextMission(read(SAVE_KEY), mission.id); $('next').hidden = !next; if (next) $('next').textContent = `Next: ${next.title} →`;
  $('run-history').hidden=!isDisaster();
  if(isDisaster()){
    const runs=read(SAVE_KEY)?.disasterRuns||[];
    $('run-history').textContent=runs.length?`Recent attempts · average ${(runs.reduce((n,r)=>n+r.weightedShare,0)/runs.length*100).toFixed(1)}%: ${runs.map(r=>`seed ${r.seed}: ${(r.weightedShare*100).toFixed(1)}% (${r.status})`).join(' · ')}`:'No completed attempts recorded yet.';
  }
  if (active) focusedResult = '';
  else if (!busy && focusedResult !== state.status) { focusedResult = state.status; $('result-title').focus(); }
  const key=`${mission.id}:${record.launchedAt}:${state.runId||''}`;
  if(!orbital||orbitalKey!==key){
    orbital?.dispose();orbitalKey=key;
    orbital=mountSeasonOrbit($('orbital-world'),{mission,regions:isDisaster()?disasterRegions:farmingRegions,catalog:options.catalog,getRecord:()=>record,revealHost:$('capture-preview'),
      onState:nextState=>{const next={...record,state:nextState};if(!saveRecord(next))return false;record=next;renderFlight();return true;}});
  }else orbital.refresh();
}
function openOperations(config,selectedMission) {
  if(busy||!missionUnlocked(read(SAVE_KEY),selectedMission.id))return false;
  orbital?.dispose();orbital=null;orbitalKey='';
  mission=selectedMission;flightKey=isDisaster()?'disasterFlight':'agricultureFlight';
  createSeason=isDisaster()?createDisaster:createAgricultureSeason;
  completeSeason=isDisaster()?completeDisaster:completeAgriculture;
  if (!panel) build(); options = config; record = null;
  panel.hidden = false; document.querySelector('.space').inert = true;
  $('message').textContent = ''; configure(); $('title').focus(); return true;
}
export const openAgriculture=config=>openOperations(config,agricultureMission);
export const openDisaster=config=>openOperations(config,disasterMission);
function renderDisasterRequests(state,active){
  const now=Date.parse(mission.epoch)/1000+state.day*86400;
  const requests=state.requests.filter(r=>r.opensAt<=now&&!r.expired&&!r.completed&&r.deadlineAt>now).sort((a,b)=>a.deadlineAt-b.deadlineAt||b.weight-a.weight);
  $('regions').replaceChildren(...requests.map(r=>{
    const row=document.createElement('div');row.className='season-region';
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=state.priorities.includes(r.id);
    input.disabled=true;input.hidden=true;
    input.onchange=()=>changeCommand({priorities:input.checked?[...state.priorities,r.id]:state.priorities.filter(id=>id!==r.id)});
    label.append(input,document.createTextNode(`${disasterRegions.find(region=>region.id===r.regionId).name} · ${r.title}`));
    const detail=document.createElement('span');detail.textContent=`Priority ${r.weight} · deadline in ${((r.deadlineAt-now)/3600).toFixed(1)} h · ${r.captured?`Queued ${r.deliveredMB.toFixed(2)} / ${r.totalMB.toFixed(2)} MB`:'Awaiting observation'}`;
    row.append(label,detail);
    if(r.captured){const drop=document.createElement('button');drop.textContent='Discard queued image';drop.disabled=busy||!active;drop.onclick=()=>{const next={...record,state:discardDisasterImage(state,r.id)};if(saveRecord(next)){record=next;renderFlight();}};row.append(drop);}
    return row;
  }));
  if(!requests.length){const next=state.requests.find(r=>r.opensAt>now);$('regions').textContent=!active?'Operations ended. Review your results.':next?`No open requests. Next alert in ${((next.opensAt-now)/3600).toFixed(1)} simulated hours.`:'No open requests remain. Finish the operations period for your result.';}
}

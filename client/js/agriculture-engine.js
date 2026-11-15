import { agricultureMission, farmingRegions } from './data/mission-config.js';
import { targetAccess } from './orbit-engine.js';
import { missionUnlocked } from './progression.js';

export function createSeason(plan, catalog) {
  const battery = catalog.find(p => p.id === plan.components.eps_battery);
  return { day: 0, status: 'ACTIVE', batteryWh: battery.capacityWh,
    minimumBatteryWh: battery.capacityWh, deliveredMB: 0,
    priorities: farmingRegions.slice(0, 3).map(r => r.id), downlink: true,
    requests: Array.from({ length: 6 }, (_, cycle) => farmingRegions.map(region => ({
      id: `${cycle}-${region.id}`, regionId: region.id, weight: region.weight,
      opensDay: cycle * 20 + 1, closesDay: (cycle + 1) * 20,
      captured: false, deliveredMB: 0, totalMB: plan.metrics.imageMB,
    }))).flat(), log: ['Season ready. Choose up to three regions, then run a day.'] };
}

export function seasonScore(state) {
  const total = state.requests.reduce((n, r) => n + r.weight, 0);
  const delivered = state.requests.filter(r => r.completed).reduce((n, r) => n + r.weight, 0);
  return total ? delivered / total : 0;
}
export function storedMB(state) {
  return state.requests.filter(r => r.captured && !r.completed && !r.expired)
    .reduce((n, r) => n + Math.max(0, r.totalMB - r.deliveredMB), 0);
}

// One deterministic turn. The caller commits only after a successful save.
// Orbit/eclipse are 30 s backend samples; resources split at contact boundaries.
export function runSeasonDay(plan, catalog, previous, points, passes, options={}) {
  const mission=options.mission||agricultureMission,regions=options.regions||farmingRegions,duration=options.durationSec||86400;
  if (previous.status !== 'ACTIVE' || previous.day >= mission.days) return previous;
  const start = Date.parse(mission.epoch) / 1000 + previous.day * 86400;
  if (points.length < 2 || Math.abs(points[0].time - start) > .01 || points.at(-1).time < start + duration)
    throw new Error('Incomplete daily trajectory. No time advanced.');
  const state = structuredClone(previous), day = state.day + duration/86400, events = [];
  const items = Object.values(plan.components).map(id => catalog.find(p => p.id === id));
  const part = category => items.find(p => p.category === category);
  const battery = part('eps_battery'), solar = part('eps_solar'), camera = part('payload');
  const radio = part('comms'), computer = part('cdh');
  const capacity=battery.capacityWh*(options.batteryFactor??1);
  state.batteryWh=Math.min(state.batteryWh,capacity);
  const floor = capacity * (1 - battery.maxDoD);
  const idle = items.reduce((n, p) => n + (['payload', 'comms'].includes(p.category) ? p.standbyPowerW || 0 : p.operationalPowerW || 0), 0);
  const opticPower = camera.focalLengthOptions?.find(o => o.focalLengthM === plan.settings.focalLengthM)?.powerDeltaW || 0;
  const order=new Map(state.requests.map((r,index)=>[r.id,index]));
  const queue=state.requests.filter(r=>r.captured&&!r.completed&&!r.expired);
  function nextQueued(time){
    while(queue.length){const r=queue[0];if(r.deadlineAt!==undefined&&time>=r.deadlineAt)r.expired=true;if(r.completed||r.expired){queue.shift();continue;}return r;}
    return null;
  }
  function useEnergy(demand, generation, seconds) {
    const next = state.batteryWh + (generation - demand) * seconds / 3600;
    if (demand - generation > battery.maxDischargeRateW || next < floor - 1e-8) {
      state.status = 'POWER_LOSS'; events.push('Battery reserve reached. Retry and review your observation/downlink commands.'); return false;
    }
    state.batteryWh = Math.min(capacity, next);
    state.minimumBatteryWh = Math.min(state.minimumBatteryWh, state.batteryWh);
    return true;
  }
  for (let index = 0; index < points.length - 1 && state.status === 'ACTIVE'; index++) {
    const point = points[index], nextTime = points[index + 1].time;
    for(const r of state.requests)if(r.deadlineAt!==undefined&&!r.completed&&point.time>=r.deadlineAt)r.expired=true;
    const generation = solar.powerSunW * .85 * (point.sunFraction ?? (point.isEclipse ? 0 : 1));
    const request = !options.cameraUnavailable&&state.requests.find(r => state.priorities.includes(options.requestPriorities?r.id:r.regionId) && !r.captured && !r.expired && (r.opensAt===undefined?r.opensDay<=day:point.time>=r.opensAt) && (r.deadlineAt===undefined?r.closesDay>=day:point.time<r.deadlineAt) && !options.cloudRegions?.includes(r.regionId) &&
      targetAccess(point, { ...plan, maxGsdM: mission.maxGsdM,maxLookDeg:options.maxLookDeg??30, target: regions.find(region => region.id === r.regionId) }).available);
    if (request && storedMB(state) + request.totalMB <= computer.storageCapacityMB) {
      // Two-second instantaneous-pointing exposure, separate from idle integration.
      const extra = Math.max(0, camera.operationalPowerW + opticPower - (camera.standbyPowerW || 0));
      if (state.batteryWh - extra * 2 / 3600 > floor && idle + extra - generation <= battery.maxDischargeRateW) {
        state.batteryWh -= extra * 2 / 3600;
        state.minimumBatteryWh = Math.min(state.minimumBatteryWh, state.batteryWh);
        request.captured = true; request.captureTime = point.time;
        queue.push(request);queue.sort((a,b)=>order.get(a.id)-order.get(b.id));
        events.push(`Captured ${regions.find(r => r.id === request.regionId).name}.`);
      }
    }
    let time = point.time;
    while (time < nextTime - 1e-8 && state.status === 'ACTIVE') {
      const boundary = passes.find(p => p.losTime > time);
      const contact = boundary && boundary.aosTime <= time;
      const queued = nextQueued(time);
      const transmitting = state.downlink && contact && queued;
      let dt = Math.min(1, nextTime - time);
      if (boundary) dt = Math.min(dt, (contact ? boundary.losTime : boundary.aosTime) - time);
      if (transmitting) dt = Math.min(dt, (queued.totalMB - queued.deliveredMB) * 8 / radio.downlinkSpeedMbps);
      if(transmitting&&queued.deadlineAt!==undefined)dt=Math.min(dt,queued.deadlineAt-time);
      if (dt <= 1e-9) break;
      const demand = idle + (transmitting ? radio.operationalPowerW - (radio.standbyPowerW || 0) : 0);
      if (!useEnergy(demand, generation, dt)) break;
      if (transmitting) {
        const sent = Math.min(queued.totalMB - queued.deliveredMB, radio.downlinkSpeedMbps * dt / 8);
        queued.deliveredMB += sent; state.deliveredMB += sent;
        if (queued.deliveredMB >= queued.totalMB - 1e-8) {
          queued.completed = true; queued.deliveryTime = time + dt;
          events.push(`Delivered ${regions.find(r => r.id === queued.regionId).name}.`);
        }
      }
      time += dt;
    }
  }
  if (state.status === 'ACTIVE') {
    state.day = day;
    for (const request of state.requests) if (!request.completed && (request.deadlineAt===undefined?request.closesDay<=day:request.deadlineAt<=start+duration)) request.expired = true;
    if (day >= mission.days-1e-9) { state.day=mission.days; state.status = seasonScore(state) + 1e-8 >= plan.settings.requiredShare ? 'COMPLETE' : 'TARGET_MISSED'; }
  }
  if(!options.quiet || events.length) state.log = [`Day ${Number(day.toFixed(4))}: ${events.join(' ') || 'No captures or deliveries. Review priorities and station access.'}`, ...state.log].slice(0, 20);
  return state;
}

export function completeSeason(save, state, plan) {
  if (!missionUnlocked(save, 'agriculture') || state.status !== 'COMPLETE' || state.day !== agricultureMission.days ||
    !Number.isFinite(plan.settings.requiredShare) || plan.settings.requiredShare < .5 || plan.settings.requiredShare > 1 ||
    seasonScore(state) + 1e-8 < plan.settings.requiredShare || save.missionProgress?.agriculture?.completed) return save;
  return { ...save, player: { ...save.player, stats: { ...save.player?.stats,
    contractsCompleted: (save.player?.stats?.contractsCompleted || 0) + 1 } },
    missionProgress: { ...save.missionProgress, agriculture: { completed: true,
      completedAt: new Date().toISOString(), weightedShare: seasonScore(state), deliveredMB: state.deliveredMB } } };
}

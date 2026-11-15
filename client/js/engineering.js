import { launchServices, launchSites, urbanMission, agricultureMission, farmingRegions, disasterMission, disasterRegions } from './data/mission-config.js';

// Same WGS-84 radius and mu as the backend. This is conservative preflight
// screening; time-resolved thermal/attitude/observation simulation comes later.
const EARTH_RADIUS_M = 6378137;
const MU = 3.986004418e14;
const categories = ['bus', 'payload', 'eps_solar', 'eps_battery', 'comms', 'cdh', 'propulsion', 'tcs'];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const round = (value, digits = 2) => finite(value) ? Number(value.toFixed(digits)) : null;

export function missionInputKey(design) {
  const mission = design.missionId === "disaster" ? disasterMission : design.missionId === "agriculture" ? agricultureMission : urbanMission;
  return JSON.stringify({ missionId: design.missionId, version: mission.version, credits: design.credits, planningSupportUSD: design.planningSupportUSD ?? mission.planningSupportUSD,
    components: Object.fromEntries(Object.entries(design.components || {}).sort(([a], [b]) => a.localeCompare(b))),
    settings: Object.fromEntries(Object.entries({ ...mission.defaults, ...design.settings }).sort(([a], [b]) => a.localeCompare(b))) });
}

export function evaluateMission(design, catalog) {
  const mission = design.missionId === "disaster" ? disasterMission : design.missionId === "agriculture" ? agricultureMission : urbanMission;
  const settings = { ...mission.defaults, ...design.settings };
  const selected = design.components || {};
  const checks = [];
  const check = (id, label, passed, detail, category) => checks.push({ id, label, passed: Boolean(passed), detail, category });
  const parts = Object.fromEntries(categories.map(category => [category, catalog.find(part => part.id === selected[category] && part.category === category)]));
  const items = Object.values(parts).filter(Boolean);
  const { bus, payload, eps_solar: solar, eps_battery: battery, comms, cdh, propulsion: adcs, tcs } = parts;
  const validIds = Object.entries(selected).every(([category, id]) => categories.includes(category) && typeof id === 'string' && parts[category]?.id === id);
  check('mission', 'Mission configuration', design.missionId === mission.id, 'Supported missions: Urban Mapping, Agricultural Monitoring and Disaster Monitoring.');
  check('catalog', 'Catalog selections', validIds && items.every(part => part.tier <= (mission.id !== "urban" ? 2 : 1)), 'Select known mission-tier components; unknown IDs and category mismatches are rejected.');
  for (const [category, label] of [['bus', 'Chassis'], ['payload', 'Optical payload'], ['eps_solar', 'Solar array'], ['eps_battery', 'Battery'], ['comms', 'Radio'], ['cdh', 'Flight computer']]) {
    check(`required-${category}`, label, parts[category] && (category !== 'payload' || payload.payloadType === 'optical') && (category !== 'cdh' || cdh.cdhType === 'obc'), category === 'cdh' ? 'An OBC is required; a standalone recorder does not replace the flight computer.' : `Install ${label.toLowerCase()}.`, category);
  }
  const chassis = bus?.chassisCompatibility?.[0];
  const incompatible = items.filter(part => part.category !== 'bus' && !part.chassisCompatibility?.includes(chassis));
  check('compatibility', 'Chassis compatibility', bus && !incompatible.length, incompatible.length ? incompatible.map(part => part.name).join(', ') : 'All selected components must support the selected chassis family.', 'bus');

  let internalU = 0, externalU = 0;
  const zones = { face_top: 0, face_bottom: 0, face_side: 0 };
  let validSlots = true;
  for (const part of items) for (const slot of [part.slotRequirement, part.secondarySlot].filter(Boolean)) {
    if (!finite(slot.sizeUnits) || slot.sizeUnits < 0) { validSlots = false; continue; }
    if (slot.type === 'internal') internalU += slot.sizeUnits;
    else if (slot.type === 'external' && Object.hasOwn(zones, slot.mountZone)) { externalU += slot.sizeUnits; zones[slot.mountZone] += slot.sizeUnits; }
    else validSlots = false;
  }
  check('slots', 'Internal volume', bus && validSlots && internalU <= bus.internalSlotsU, `${round(internalU)} / ${bus?.internalSlotsU ?? '—'} U including secondary internal slots.`, 'bus');
  check('faces', 'External mount capacity', bus && validSlots && externalU <= bus.externalFaces && zones.face_top <= 1 && zones.face_bottom <= 1 && zones.face_side <= bus.externalFaces - 2,
    `Top ${round(zones.face_top)}/1; bottom ${round(zones.face_bottom)}/1; side ${round(zones.face_side)}/${bus ? bus.externalFaces - 2 : '—'} face units. This is aggregate capacity, not collision validation.`, 'bus');

  const service = launchServices.find(item => item.id === settings.launchServiceId);
  const site = launchSites.find(item => item.id === settings.siteId);
  const orbitValid = finite(settings.altitudeKm) && settings.altitudeKm >= mission.altitudeRangeKm[0] && settings.altitudeKm <= mission.altitudeRangeKm[1] && finite(settings.inclinationDeg) && settings.inclinationDeg >= 0 && settings.inclinationDeg <= 180;
  const injectionValid = service && (!service.fixedOrbit || ['altitudeKm', 'inclinationDeg', 'siteId'].every(key => settings[key] === service.fixedOrbit[key]));
  const siteValid = site && finite(settings.inclinationDeg) && settings.inclinationDeg >= Math.abs(site.latitudeDeg) && settings.inclinationDeg <= 180 - Math.abs(site.latitudeDeg);
  check('orbit', 'Mission orbit', orbitValid, 'Mission orbit must be within the stated altitude range and 0°–180° inclination.');
  check('launch', 'Launch insertion', injectionValid && siteValid, service?.fixedOrbit ? 'Tutorial rideshare: fixed 500 km, 97.4°, Vandenberg. Custom orbits require a dedicated service.' : 'Direct insertion requires |site latitude| ≤ inclination ≤ 180° − |site latitude|.');
  const groundLatitude = finite(settings.inclinationDeg) ? Math.min(settings.inclinationDeg, 180 - settings.inclinationDeg) : -1;
  check('coverage', 'Target latitude access', orbitValid && groundLatitude >= Math.abs(mission.target.latDeg), 'Ground-track latitude must reach the target. Exact target access and imaging times are evaluated in the orbital phase.');
  if (mission.id !== 'urban') {
    if(mission.id==='disaster')check('disaster-seed','Scenario seed',Number.isInteger(settings.seed)&&settings.seed>=1&&settings.seed<=999999,'Choose a seed from 1 to 999999 for reproducible requests and faults.');
    check('regions', 'Farming-region latitude access', (mission.id === "disaster" ? disasterRegions : farmingRegions).every(r => groundLatitude >= Math.abs(r.latDeg)), 'The orbit must reach all six region latitudes.');
    check('season-goal', 'Season delivery goal', finite(settings.requiredShare) && settings.requiredShare >= .5 && settings.requiredShare <= 1, 'Choose a finite weighted delivery target from 50% to 100%.');
    check('season-station', 'Season station', ['gs_singapore', 'gs_svalbard', 'gs_goldstone', 'gs_canberra'].includes(settings.stationId), 'Choose one of the listed S/X-band stations.');
    check('season-payload', 'RGB / multispectral camera', ['red', 'green', 'blue'].every(band => payload?.spectralBands?.includes(band)), 'This mission requires RGB bands, with optional additional multispectral bands.', 'payload');
  }

  const optics = payload?.focalLengthOptions?.find(option => option.focalLengthM === settings.focalLengthM);
  const focalValid = finite(settings.focalLengthM) && settings.focalLengthM > 0 && (payload?.focalLengthOptions?.length ? Boolean(optics) : payload?.defaultFocalLengthM === settings.focalLengthM);
  const dryMassKg = items.reduce((sum, part) => sum + part.massKg, 0) + (optics?.massDeltaKg || 0);
  const wetMassKg = dryMassKg + items.reduce((sum, part) => sum + (part.fuelMassKg || 0), 0);
  const hardwareUSD = items.reduce((sum, part) => sum + part.costUSD, 0);
  const launchUSD = service ? (service.flatCostUSD ?? service.perKgUSD * wetMassKg) : null;
  const totalUSD = launchUSD === null ? null : hardwareUSD + launchUSD;
  const supportUSD = design.planningSupportUSD ?? mission.planningSupportUSD;
  const availableUSD = finite(design.credits) && design.credits >= 0 && finite(supportUSD) && supportUSD >= 0 ? design.credits + supportUSD : null;
  check('mass', 'Mass limits', bus && dryMassKg <= bus.maxDryMassKg && wetMassKg <= mission.maxMassKg && service && wetMassKg <= service.maxMassKg,
    `Dry ${round(dryMassKg)} kg / chassis ${bus?.maxDryMassKg ?? '—'} kg; wet ${round(wetMassKg)} kg / mission ${mission.maxMassKg} kg.`, 'bus');
  check('budget', 'Hardware + launch budget', availableUSD !== null && totalUSD !== null && totalUSD <= availableUSD,
    `Hardware $${round(hardwareUSD)} + launch $${round(launchUSD)}; available $${round(availableUSD)} including $${supportUSD} remaining mission support. No credits are deducted by planning.`);
  const gsdM = orbitValid && focalValid && finite(payload?.pixelPitchUm) ? settings.altitudeKm * 1000 * payload.pixelPitchUm * 1e-6 / settings.focalLengthM : null;
  const swathKm = gsdM !== null && finite(payload?.detectorPixelsAcross) ? gsdM * payload.detectorPixelsAcross / 1000 : null;
  check('optics', 'Resolution & image width', gsdM !== null && gsdM <= mission.maxGsdM && swathKm !== null && swathKm >= mission.target.widthKm,
    `${round(gsdM)} m GSD (≤${mission.maxGsdM} m); ${round(swathKm)} km swath (≥10 km). Select a catalog-supported focal length.`, 'payload');
  check('pointing', 'Camera pointing', finite(adcs?.pointingAccuracyDeg) && payload && adcs.pointingAccuracyDeg <= payload.pointingAccuracyReqDeg,
    `ADCS accuracy ${adcs?.pointingAccuracyDeg ?? '—'}°; camera requires ${payload?.pointingAccuracyReqDeg ?? '—'}° or better. A thruster or detumble-only set is not sufficient.`, 'propulsion');
  const imageMB = gsdM !== null && gsdM > 0 ? Math.ceil(10000 / gsdM) ** 2 * Math.max(payload?.spectralBands?.length || 3, 3) / 1e6 / Math.max(cdh?.compressionRatio || 1, 1) : null;
  check('storage', 'Image storage', imageMB !== null && cdh?.cdhType === 'obc' && cdh.storageCapacityMB >= imageMB,
    `One 10 × 10 km RGB image: ${round(imageMB)} MB; onboard capacity ${cdh?.storageCapacityMB ?? 0} MB.`, 'cdh');
  check('radio', 'Ground-station radio', (mission.id !== "urban" ? ["S_Band", "X_Band"].includes(comms?.frequencyBand) : comms?.frequencyBand === mission.station.band) && comms.downlinkSpeedMbps > 0,
    'Use a compatible mission radio. Actual contact windows are checked against the backend separately.', 'comms');

  const operating = part => (part.operationalPowerW || 0) + (part.category === 'payload' ? optics?.powerDeltaW || 0 : 0);
  const standby = part => part.standbyPowerW || 0;
  const peakW = items.reduce((sum, part) => sum + operating(part), 0);
  const averageW = items.reduce((sum, part) => sum + (part.category === 'payload' ? standby(part) + (operating(part) - standby(part)) * mission.payloadDuty : part.category === 'comms' ? standby(part) + (operating(part) - standby(part)) * mission.radioDuty : operating(part)), 0);
  const eclipseW = items.reduce((sum, part) => sum + (part.category === 'payload' ? standby(part) : part.category === 'comms' ? standby(part) + (operating(part) - standby(part)) * mission.radioDuty : operating(part)), 0);
  const a = EARTH_RADIUS_M + settings.altitudeKm * 1000;
  const periodSec = orbitValid ? 2 * Math.PI * Math.sqrt(a ** 3 / MU) : null;
  // Beta=0 circular-orbit eclipse is a conservative maximum duration.
  const eclipseSec = periodSec !== null ? periodSec / Math.PI * Math.asin(EARTH_RADIUS_M / a) : null;
  const solarW = (solar?.powerSunW || 0) * mission.solarDerating;
  const generatedWh = periodSec !== null ? solarW * (periodSec - eclipseSec) / 3600 : null;
  const usedWh = periodSec !== null ? averageW * periodSec / 3600 : null;
  const eclipseWh = eclipseSec !== null ? eclipseW * eclipseSec / 3600 : null;
  const usableBatteryWh = battery ? battery.capacityWh * battery.maxDoD : 0;
  check('duty', 'Payload duty cycle', payload && mission.payloadDuty <= payload.dutyCycleLimit, 'The beginner schedule assumes payload active for 20% of each orbit.', 'payload');
  check('power', 'Orbital energy balance', solar && generatedWh !== null && generatedWh >= usedWh && peakW <= mission.maxPowerW && averageW <= (mission.maxAverageW ?? Infinity),
    `Generated ${round(generatedWh)} Wh/orbit; used ${round(usedWh)} Wh/orbit. Peak ${round(peakW)} W / ${mission.maxPowerW} W peak limit; average ${round(averageW)} W / ${mission.maxAverageW ?? mission.maxPowerW} W.`, 'eps_solar');
  const eclipsePeakW = peakW - (payload ? operating(payload) - standby(payload) : 0);
  check('battery', 'Eclipse battery reserve', battery && eclipseWh !== null && usableBatteryWh >= eclipseWh && battery.maxDischargeRateW >= Math.max(peakW - solarW, eclipsePeakW, 0),
    `Worst-case eclipse ${round(eclipseSec === null ? null : eclipseSec / 60)} min needs ${round(eclipseWh)} Wh; usable reserve ${round(usableBatteryWh)} Wh.`, 'eps_battery');
  const heatW = items.reduce((sum, part) => sum + (part.heatDissipationW || 0), 0) + (optics?.powerDeltaW || 0);
  const coolingW = (bus?.hullCoolingCapacityW || 0) + (tcs?.coolingCapacityW || 0);
  check('thermal', 'Thermal capacity screen', bus && coolingW >= heatW, `Peak internal heat ${round(heatW)} W; cooling rating ${round(coolingW)} W. This does not predict the −40°C to +65°C temperature envelope.`, 'tcs');

  return { ready: checks.every(item => item.passed), checks, inputKey: missionInputKey(design), settings,
    metrics: Object.fromEntries(Object.entries({ dryMassKg, wetMassKg, hardwareUSD, launchUSD, totalUSD, availableUSD, gsdM, swathKm, imageMB, peakW, averageW, generatedWh, usedWh, eclipseWh, usableBatteryWh, periodSec, eclipseSec, heatW, coolingW }).map(([key, value]) => [key, round(value)])),
    assumptions: ['Circular orbit; worst-case beta=0 eclipse; 85% of rated sunlight generation.', 'Payload active 20% of an orbit, radio 10%, support systems continuously active; optical payload idle during eclipse.', 'Three bytes per image pixel; catalog compression ratio; one complete image buffered.', 'Thermal rating screen only. Temperature evolution, actual target illumination/pointing and timed imaging/downlink operations remain for the orbital phase.', 'Slot checks cover aggregate U/face capacity, not physical collision or cable routing.'],
  };
}

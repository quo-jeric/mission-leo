/**
 * Ground Station Line-of-Sight & Contact Pass Engine
 * Standards: Topocentric SEZ Elevation/Azimuth tracking, AOS/LOS Pass Detection, and Data Downlink Calculation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEG_TO_RAD, RAD_TO_DEG } from './constants.js';
import { computeGMST, eciToEcef, topocentricSEZ } from './coordinates.js';
import { propagateOrbit, normalizeOrbitalElements } from './kepler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STATIONS_PATH = path.resolve(__dirname, '../data/groundStations.json');

/**
 * Loads ground stations from the data store.
 * @param {string} [customPath]
 * @returns {Array<object>}
 */
export function loadGroundStations(customPath) {
  try {
    const filePath = customPath || DEFAULT_STATIONS_PATH;
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    return data.stations || [];
  } catch (err) {
    console.warn('Could not load ground stations file, using fallback stations:', err.message);
    return [
      { id: 'gs_svalbard', name: 'Svalbard', latDeg: 78.23, lonDeg: 15.41, altM: 450, minElevationDeg: 5.0 },
      { id: 'gs_goldstone', name: 'Goldstone', latDeg: 35.43, lonDeg: -116.89, altM: 1030, minElevationDeg: 10.0 },
      { id: 'gs_kourou', name: 'Kourou', latDeg: 5.25, lonDeg: -52.81, altM: 15, minElevationDeg: 8.0 }
    ];
  }
}

/**
 * Computes ground station passes and downlink volume over an orbital duration.
 * @param {object} params
 * @param {object} params.orbit Orbital elements
 * @param {number} [params.startTime] Start timestamp in Unix seconds
 * @param {number} params.duration Duration in seconds (e.g., 86400 for 1 day)
 * @param {number} [params.step=30] Sample interval in seconds (default 30s)
 * @param {object} [params.comms] Spacecraft comms specs { downlinkMbps, minElevationDeg, frequencyBand }
 * @param {Array<string>} [params.stationIds] Optional subset of station IDs to filter by
 * @returns {{
 *   totalPasses: number,
 *   totalContactTimeSec: number,
 *   totalDataCapacityMB: number,
 *   passes: Array<{
 *     stationId: string,
 *     stationName: string,
 *     aosTime: number,
 *     losTime: number,
 *     durationSeconds: number,
 *     maxElevationDeg: number,
 *     dataDownlinkedMB: number
 *   }>
 * }}
 */
export function computePassesAndDownlink(params) {
  const normElements = normalizeOrbitalElements(params.orbit);
  const startTime = params.startTime !== undefined ? params.startTime : normElements.epoch;
  const duration = params.duration !== undefined ? params.duration : 86400; // default 1 day
  const step = Math.max(5, params.step !== undefined ? params.step : 30);

  const comms = params.comms || {};
  const downlinkMbps = comms.downlinkMbps || 10.0;
  const commsMinElevationDeg = comms.minElevationDeg;
  const frequencyBand = comms.frequencyBand;

  const allStations = loadGroundStations();
  const targetStations = params.stationIds
    ? allStations.filter(s => params.stationIds.includes(s.id))
    : allStations;

  // Filter by supported frequency band if requested
  const compatibleStations = frequencyBand
    ? targetStations.filter(s => !s.supportedBands || s.supportedBands.includes(frequencyBand))
    : targetStations;

  // Pre-convert station coordinates to radians
  const stations = compatibleStations.map(s => ({
    id: s.id,
    name: s.name,
    latRad: s.latDeg * DEG_TO_RAD,
    lonRad: s.lonDeg * DEG_TO_RAD,
    altM: s.altM || 0,
    minElevationDeg: commsMinElevationDeg !== undefined ? commsMinElevationDeg : (s.minElevationDeg || 10.0)
  }));

  // Propagate orbit points
  const propResult = propagateOrbit({
    elements: normElements,
    startTime,
    duration,
    step,
    includeSun: false,
    enableJ2: true
  });

  const passes = [];

  // Track active passes for each station
  // { stationId, inPass: boolean, aosTime: number, maxElev: number }
  const stationTrackers = new Map();
  for (const st of stations) {
    stationTrackers.set(st.id, { inPass: false, aosTime: 0, maxElev: 0 });
  }

  for (let i = 0; i < propResult.points.length; i++) {
    const pt = propResult.points[i];
    const t = pt.time;
    const gmst = computeGMST(t);
    const ecef = eciToEcef(pt.rECI, pt.vECI, gmst);

    for (const st of stations) {
      const topo = topocentricSEZ(ecef.rEcef, st.latRad, st.lonRad, st.altM);
      const tracker = stationTrackers.get(st.id);

      const isElevVisible = topo.elevationDeg >= st.minElevationDeg;

      if (isElevVisible) {
        if (!tracker.inPass) {
          // AOS (Acquisition of Signal)
          tracker.inPass = true;
          tracker.aosTime = t;
          tracker.maxElev = topo.elevationDeg;
        } else {
          // Continued pass, track max elevation
          if (topo.elevationDeg > tracker.maxElev) {
            tracker.maxElev = topo.elevationDeg;
          }
        }
      } else {
        if (tracker.inPass) {
          // LOS (Loss of Signal)
          tracker.inPass = false;
          const losTime = t;
          const durationSeconds = losTime - tracker.aosTime;

          if (durationSeconds > 0) {
            // Data downloaded: (Mbps * durationSec) / 8
            const dataDownlinkedMB = (downlinkMbps * durationSeconds) / 8.0;

            passes.push({
              stationId: st.id,
              stationName: st.name,
              aosTime: tracker.aosTime,
              losTime,
              durationSeconds,
              maxElevationDeg: Number(tracker.maxElev.toFixed(2)),
              dataDownlinkedMB: Number(dataDownlinkedMB.toFixed(2))
            });
          }
        }
      }
    }
  }

  // Close any pass still open at the end of duration
  const endTime = startTime + duration;
  for (const st of stations) {
    const tracker = stationTrackers.get(st.id);
    if (tracker.inPass) {
      const durationSeconds = endTime - tracker.aosTime;
      if (durationSeconds > 0) {
        const dataDownlinkedMB = (downlinkMbps * durationSeconds) / 8.0;
        passes.push({
          stationId: st.id,
          stationName: st.name,
          aosTime: tracker.aosTime,
          losTime: endTime,
          durationSeconds,
          maxElevationDeg: Number(tracker.maxElev.toFixed(2)),
          dataDownlinkedMB: Number(dataDownlinkedMB.toFixed(2))
        });
      }
    }
  }

  // Sort passes chronologically by AOS time
  passes.sort((a, b) => a.aosTime - b.aosTime);

  let totalContactTimeSec = 0;
  let totalDataCapacityMB = 0;
  for (const p of passes) {
    totalContactTimeSec += p.durationSeconds;
    totalDataCapacityMB += p.dataDownlinkedMB;
  }

  return {
    totalPasses: passes.length,
    totalContactTimeSec,
    totalDataCapacityMB: Number(totalDataCapacityMB.toFixed(2)),
    passes
  };
}

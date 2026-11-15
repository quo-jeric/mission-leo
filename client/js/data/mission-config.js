// Game scenario parameters, not real launch-service availability or pricing.
export const launchServices = [
  { id: 'rideshare', name: 'Tutorial rideshare', maxMassKg: 50, perKgUSD: 15000, fixedOrbit: { altitudeKm: 500, inclinationDeg: 97.4, siteId: 'vandenberg' } },
  { id: 'micro', name: 'Dedicated micro-launcher', maxMassKg: 300, flatCostUSD: 5000000 },
  { id: 'medium', name: 'Medium-lift launcher', maxMassKg: 15000, flatCostUSD: 25000000 },
];
export const launchSites = [
  { id: 'vandenberg', name: 'Vandenberg', latitudeDeg: 34.7 },
  { id: 'kourou', name: 'Kourou', latitudeDeg: 5.2 },
  { id: 'cape', name: 'Cape Canaveral', latitudeDeg: 28.5 },
  { id: 'mahia', name: 'Mahia', latitudeDeg: -39.2 },
];
export const urbanMission = {
  id: 'urban', version: 1,
  // Illustrative target center; station coordinates match the server catalog.
  target: { name: 'Singapore test area', latDeg: 1.3, lonDeg: 103.77, widthKm: 10, heightKm: 10 },
  station: { id: 'gs_singapore', name: 'Singapore CRISP', latDeg: 1.3, lonDeg: 103.77, band: 'S_Band', minElevationDeg: 10 },
  epoch: '2026-11-06T00:00:00Z',
  altitudeRangeKm: [400, 600], maxMassKg: 50, maxPowerW: 60, maxGsdM: 3,
  planningSupportUSD: 400000,
  payloadDuty: .2, radioDuty: .1, solarDerating: .85,
  defaults: { altitudeKm: 500, inclinationDeg: 97.4, focalLengthM: 1, launchServiceId: 'rideshare', siteId: 'vandenberg' },
  starter: {
    bus: 'bus_6u', payload: 'payload_urban_imager_3u', eps_solar: 'eps_solar_si_deploy_30w',
    eps_battery: 'eps_battery_li_50wh', comms: 'comms_s_patch', cdh: 'cdh_obc_basic_0_25u',
    propulsion: 'adcs_rw_mtq_cube_0_5u', tcs: 'tcs_radiator_6u',
  },
};

// Explicit game-scenario choices for the seasonal scheduling level.
export const agricultureMission = {
  ...urbanMission, id: 'agriculture', version: 1,
  altitudeRangeKm: [500, 700], maxMassKg: 80, maxPowerW: 100,
  maxAverageW: 40, maxGsdM: 30, planningSupportUSD: 800000,
  days: 120, requiredShare: .7,
  defaults: { ...urbanMission.defaults, focalLengthM: .2, stationId: 'gs_singapore', requiredShare: .7 },
  starter: { ...urbanMission.starter, payload: 'payload_wide_swath_rgb_2u' },
};
export const farmingRegions = [
  { id: 'luzon', name: 'Central Luzon', latDeg: 15.5, lonDeg: 120.8, weight: 3 },
  { id: 'mekong', name: 'Mekong Delta', latDeg: 10.1, lonDeg: 105.7, weight: 3 },
  { id: 'java', name: 'East Java', latDeg: -7.7, lonDeg: 112.2, weight: 2 },
  { id: 'thailand', name: 'Central Thailand', latDeg: 15, lonDeg: 100.2, weight: 2 },
  { id: 'punjab', name: 'Punjab', latDeg: 30.9, lonDeg: 75.8, weight: 1 },
  { id: 'murray', name: 'Murray–Darling', latDeg: -34.2, lonDeg: 142.2, weight: 1 },
];
export const disasterMission = {
  ...agricultureMission, id:'disaster',days:90,turnSec:21600,planningSupportUSD:1000000,
  defaults:{...agricultureMission.defaults,focalLengthM:1,requiredShare:.6,seed:12},
  starter:{...urbanMission.starter},
};
export const disasterRegions = [
  {id:'singapore',name:'Singapore',latDeg:1.3,lonDeg:103.77},
  {id:'manila',name:'Manila',latDeg:14.6,lonDeg:121},
  {id:'bangkok',name:'Bangkok',latDeg:13.75,lonDeg:100.5},
  {id:'jakarta',name:'Jakarta',latDeg:-6.2,lonDeg:106.8},
  {id:'hanoi',name:'Hanoi',latDeg:21,lonDeg:105.8},
  {id:'surabaya',name:'Surabaya',latDeg:-7.25,lonDeg:112.75},
];

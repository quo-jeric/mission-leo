// Mission briefs and illustrative constraints from the scenario document.
export const scenarios = [
  {
    id: 'urban',
    title: 'Urban Mapping',
    tier: 'BEGINNER',
    theme: '#9fddff',
    caption: 'ONE CITY · ONE CLEAR IMAGE',
    summary: 'Your first view from orbit. Configure an optical satellite, observe a city, and bring the image home.',
    metrics: ['400–600 km','50 kg max','60 W max'],
    objectives: ['Image a 10 × 10 km city at 3 m GSD or better.','Downlink the image through the given S-band station.','Keep mass and power within limits.'],
    detail: 'A guided mission with a generous budget, a predefined camera, and no random events. Choose focal length, solar panels, battery, altitude, and inclination.'
  },
  {
    id: 'agriculture',
    title: 'Agricultural Monitoring',
    tier: 'INTERMEDIATE',
    theme: '#a9e8b7',
    caption: 'MULTIPLE REGIONS · COMPETING WINDOWS',
    summary: 'Help a growing season thrive. Design your mission and balance competing requests from farming regions.',
    metrics: ['500–700 km','80 kg max','40 W average'],
    objectives: ['Schedule observations across 5–8 farming regions.','Serve the required share of priority-weighted targets within their windows.','Deliver imagery within budget and power limits.'],
    detail: 'Plan a 120-day growing season. Choose RGB or multispectral imaging, S-band or X-band communications, a ground station, and your orbit. The target share is configurable; the scenario proposes 70% as an example.'
  },
  {
    id: 'disaster',
    title: 'Disaster Monitoring',
    tier: 'ADVANCED',
    theme: '#ffbc91',
    caption: 'URGENT REQUESTS · LIMITED CONTACT',
    summary: 'Every pass matters. Respond to disasters while protecting your spacecraft and delivering urgent imagery.',
    metrics: ['90 simulated days','Urgent deadlines','Live resource limits'],
    objectives: ['Deliver urgent imagery before request deadlines.','Manage battery, storage, and short downlink windows.','Recover from unexpected events and keep the spacecraft alive.'],
    detail: 'Prioritize overlapping requests, point off-nadir, and manage the image queue. Seeded events include station outages, battery degradation, wheel faults, cloud cover, and payload resets. Performance is evaluated across seeded runs.'
  }
];

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
    detail: 'Plan with agency funds plus $400,000 of mission support allowance. Use a fixed 500 km, 97.4° tutorial rideshare, or budget for a dedicated launch and custom orbit. Choose your camera optics and support systems, then review engineering and station access. Planning does not spend or grant credits.'
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
    detail: 'Fly your built satellite over a 120-day growing season across six farming regions. Use Follow satellite, Earth overview and Target camera to select, aim and capture each region, then send imagery during ground-station contact. Choose RGB/multispectral imaging, S/X-band radio and a 500–700 km orbit. Fully deliver requests within their 20-day windows. Default goal: 70% of priority weight. Up to $800,000 support applies once at launch; planning spends no funds.'
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
    detail: 'Fly your built satellite through 90 days of urgent disaster response. Select requests on the Earth view, aim and capture in Target camera, then downlink before overlapping 48–96 hour deadlines. Manage the image queue and recover from seeded station outages, battery degradation, wheel faults, cloud cover and payload resets. Clouds change every six simulated hours; compare the last five seeded attempts. Default goal: 60% priority-weighted on-time delivery. Up to $1,000,000 support applies once at launch; free retries reuse the launched hardware.'
  }
];

# 🛰️ 3D Low Earth Orbit Satellite Design & Simulation Game
## Global Specification & Architecture Document (`SPEC.md`)

---

## 1. Executive Summary & Project Vision

### 1.1 Overview
The **3D Low Earth Orbit (LEO) Satellite Design & Simulation Game** is an interactive, browser-based space mission engineering game. Players step into the role of a space mission systems engineer and mission director. The objective is to design modular satellites within real-world engineering constraints (mass, volume, power budget, thermal limits, and financial capital), launch them into custom or target Low Earth Orbits (200 km to 2,000 km altitude), execute orbital maneuvers, and operate them to fulfill commercial, scientific, and governmental space mission contracts.

### 1.2 Core Philosophy
- **Realistic Yet Accessible Aerospace Engineering**: Subsystems behave according to first-principle physics approximations (Keplerian orbits, power generation vs. eclipse cycles, thermal dissipation, link budget, and delta-v burn equations) while remaining intuitive and engaging.
- **Dual-View Immersion**: High-fidelity 3D Assembly Hangar for modular satellite building, paired with a 3D Orbital Map featuring a rotating Earth, atmospheric glow, day/night terminator, and real-time ground tracks.
- **Client-Persistent, Server-Assisted**: Express serves as an authoritative scientific engine (catalogs, mission scenarios, complex orbital propagation, and maneuver vectors), while the client maintains all state, unlocks, and designs inside `localStorage`.

---

## 2. Technology Stack & System Architecture

```mermaid
graph TD
    subgraph Client ["Client-Side (Browser)"]
        UI["Vanilla JS UI & Mission Control HUD"]
        LocalStorage[("localStorage (Save Game & Designs)")]
        ThreeHangar["Three.js: 3D Assembly Hangar"]
        ThreeOrbit["Three.js: 3D Orbital World & Earth Globe"]
        SimLoop["Client Telemetry & Time Engine (1x - 1000x)"]
    end

    subgraph Backend ["Server-Side (Express Engine)"]
        Router["Express REST API"]
        CatalogService["Parts Catalog & Tech Tree Service"]
        MissionService["Contract & Scenario Generator"]
        PropagatorService["Orbital Propagation & Physics Engine (Kepler/Delta-V)"]
    end

    UI <--> LocalStorage
    UI --> ThreeHangar
    UI --> ThreeOrbit
    SimLoop <--> UI
    UI <--> Router
    Router --> CatalogService
    Router --> MissionService
    Router --> PropagatorService
```

### 2.1 Technology Matrix
| Layer | Technology | Role & Purpose |
| :--- | :--- | :--- |
| **Frontend Core** | **HTML5 & Vanilla JavaScript (ES Modules)** | State management, modular DOM UI components, mission control dashboard, HUD overlays, and contract management without framework overhead. |
| **3D Graphics Engine** | **Three.js** | WebGL rendering for both the 3D Satellite Assembly Hangar (procedural parts, socket snapping, lighting) and the 3D Earth Orbital Environment (textured Earth, atmospheric shader, orbital trajectories, ground stations). |
| **Styling & Theme** | **Vanilla CSS3** | High-performance dark aerospace HUD aesthetics, glassmorphic panels, telemetry dials, neon status indicators, and responsive grid layouts. |
| **Backend Server** | **Express.js (Node.js)** | REST endpoints serving static components catalog, procedural mission generator, delta-v burn calculation, and orbital propagation algorithms. |
| **Persistence** | **Browser `localStorage`** | Zero-database design. Stores player company profile, funds, unlocked technology tree nodes, custom satellite blueprints, active missions, and flight telemetry records. |

---

## 3. Core Gameplay Loops & Progression

### 3.1 Primary Game Loop
```mermaid
sequenceDiagram
    autonumber
    actor Player
    participant Hangar as Assembly Hangar (3D)
    participant Backend as Express API
    participant Orbit as Orbital Simulation (3D)
    participant Storage as localStorage

    Player->>Backend: Fetch available mission contracts & parts catalog
    Player->>Hangar: Select chassis and mount modular components
    Hangar->>Hangar: Real-time validation (Mass, Power, Thermal, Link, Budget)
    Player->>Storage: Save satellite blueprint
    Player->>Orbit: Launch satellite into target LEO orbit
    Orbit->>Backend: Request trajectory verification & propagation points
    Orbit->>Orbit: Simulate day/night cycles, ground station contact & data downlink
    Player->>Orbit: Execute Delta-V burns (Hohmann transfer, de-orbiting)
    Orbit->>Player: Mission milestones achieved!
    Player->>Storage: Update credits, XP, and reputation
```

### 3.2 Mission Aspects & Core Engineering Constraints

Missions in Orbiterra are governed by eight interrelated engineering constraints and mission parameters that determine mission viability and contract success:

| Aspect / Constraint | Engineering Parameter | Impact & Design Boundary |
| :--- | :--- | :--- |
| **1. Instruments (Payload)** | Sensor type, resolution, duty cycle, field-of-view | Direct driver of mission requirements. Determines data generation rate, operational power draw, and minimum pointing accuracy. |
| **2. Target Orbit** | Altitude ($h$), Inclination ($i$), Eccentricity ($e$), RAAN ($\Omega$) | Dictates thermal profile, eclipse duration, ground station contact windows, coverage swath, and required launch/maneuver $\Delta v$. |
| **3. Financial Budget ($)** | Capital balance, contract advance, milestone payouts | Total satellite hardware cost + launch vehicle procurement must stay within agency funds and contract limits. |
| **4. Mass Budget ($kg$)** | Dry mass, payload mass, propellant mass, wet mass | Limits launch vehicle selection, dictates launch costs, and reduces achievable $\Delta v$ under the Tsiolkovsky equation. |
| **5. Power Budget ($W$, $Wh$)** | Solar generation ($P_{sun}$), battery capacity ($E_{bat}$), eclipse drain | Satellite must maintain positive energy balance over complete orbital day/night cycles to prevent mission-ending blackouts. |
| **6. Data Budget ($MB$, $Gbps$)** | Generation rate, onboard solid-state storage (SSR), downlink quota | Satellites store instrument data in memory until a ground station pass allows downlink. Buffer overflows cause permanent data loss. |
| **7. Communications** | Frequency band (UHF, S, X, Laser), antenna gain, elevation angle ($\epsilon \ge 10^\circ$) | Link budget and ground station visibility cone determine real-time contact duration and maximum achievable downlink volume. |
| **8. Mission Lifetime** | Orbital drag decay, propellant budget, battery cycle life ($DoD$), component MTBF | Defines the operational operational lifespan: ranging from short-duration technology demonstrators (30–90 days) to multi-year constellation satellites (1–5 years). |

### 3.3 Progression System & Tech Tree
- **Mission Tiers**:
  1. **Tier 1 (CubeSat Pioneer)**: 1U/3U CubeSats, simple beacon transmitters, fixed silicon solar panels, basic Earth photography.
  2. **Tier 2 (Commercial Constellations)**: SmallSats (100–300 kg), deployable solar arrays, reaction wheels, magnetorquers, IoT relays, multi-spectral imaging.
  3. **Tier 3 (Advanced LEO Infrastructure)**: Radar (SAR), optical laser communications, Hall-effect ion electric propulsion, active deorbiting tethers, space weather monitoring.

---

## 4. Satellite Subsystems & Modular Components

Every satellite consists of a **Bus (Core Chassis)** with attachment sockets for 6 distinct subsystems:

```
                  +-----------------------------------+
                  |         Thermal Radiator          |
                  +-----------------+-----------------+
                                    |
+---------------+       +-----------+-----------+       +-------------------+
| Solar Arrays  |<======|   SATELLITE BUS / CDH |======>| Payload (Camera / |
| & EPS Battery |       |  (Core Chassis + OBC) |       | SAR / Comms Dish) |
+---------------+       +-----------+-----------+       +-------------------+
                                    |
                  +-----------------+-----------------+
                  | Propulsion & ADCS (Cold Gas / Ion)|
                  +-----------------------------------+
```

### 4.1 Subsystem Specifications

| Subsystem | Components | Key Engineering Metrics |
| :--- | :--- | :--- |
| **1. Bus / Chassis (CDH)** | • 1U CubeSat (10×10×10 cm)<br>• 3U CubeSat (10×10×30 cm)<br>• 6U CubeSat (10×20×30 cm)<br>• SmallSat Bus (50-250 kg)<br>• Heavy LEO Bus (250-1000 kg) | Dry mass, internal component capacity (slots), structural durability, On-Board Computer (OBC) compute power. |
| **2. Electrical Power (EPS)** | • Body-mounted silicon cells<br>• Deployable GaAs solar panels<br>• Li-ion & Solid-state battery packs<br>• Power Distribution Unit (PDU) | Generation wattage ($W_{sun}$), battery capacity ($Wh$), depth of discharge limit, dark eclipse survival duration. |
| **3. Propulsion & ADCS** | • Cold Gas Thruster<br>• Hydrazine Monopropellant<br>• Hall-Effect Ion Thruster<br>• Reaction Wheels & Magnetorquers | Specific Impulse ($I_{sp}$), thrust ($N$), fuel mass ($kg$), delta-v ($\Delta v$), slew rate ($^\circ/s$), attitude pointing accuracy. |
| **4. Communications (COMMS)** | • UHF/VHF Omni Antenna<br>• S-Band Patch Antenna<br>• X-Band High-Gain Dish<br>• Optical Laser Transceiver | Frequency band, data rate (kbps to Gbps), transmission power ($W$), beamwidth, required ground station line-of-sight. |
| **5. Payload (Mission Gear)** | • High-Resolution Optical Imager<br>• Synthetic Aperture Radar (SAR)<br>• Climate & Atmospheric Spectrometer<br>• AIS/IoT Maritime Relay Receiver | Duty cycle power consumption ($W$), data generation rate (MB/orbit), mass, thermal output ($W_{heat}$). |
| **6. Thermal Control (TCS)** | • Multi-Layer Insulation (MLI)<br>• Passive Heat Pipes & Radiator Plates<br>• Active Electric Heaters | Heat dissipation rate ($W$), minimum survival temperature ($-40^\circ\text{C}$), maximum operating temperature ($+65^\circ\text{C}$). |

### 4.2 Engineering Balance Equations
1. **Power Balance**:
   $$\Delta E_{battery} = (P_{generation} - P_{consumption}) \times \Delta t$$
   *During eclipse ($P_{generation} = 0$), battery drains. If $E_{battery} \le 0$, the satellite enters an unrecoverable blackout.*
2. **Delta-V (Tsiolkovsky Rocket Equation)**:
   $$\Delta v = I_{sp} \cdot g_0 \cdot \ln\left(\frac{m_{wet}}{m_{dry}}\right)$$
3. **Thermal Equilibrium**:
   $$Q_{in} (\text{Sun} + \text{Albedo} + \text{Internal}) - Q_{out} (\text{Radiation}) = m \cdot c_p \cdot \frac{dT}{dt}$$
4. **Orbital Lifetime & Drag Decay**:
   $$\frac{da}{dt} \approx - \frac{\rho \cdot v \cdot A \cdot C_d}{m_{wet}} \cdot a$$
   *Below $300\text{ km}$, ballistic decay accelerates rapidly without periodic reboost burns.*

### 4.3 Launch Vehicle Systems & Orbital Insertion

Satellite designs must be paired with an appropriate launch service to reach target LEO deployment orbits:

| Launch Class | Example Providers | Max Payload to LEO | Cost ($) | Orbit Flexibility | Suitable Satellite Form Factors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rideshare / Piggyback** | Transporter rideshares | Up to 50 kg allocation | \$15,000 / kg | Fixed orbit & epoch (usually SSO ~500 km). Fixed schedule. | 1U, 3U, 6U CubeSats |
| **Dedicated Micro-Launcher** | Electron, Firefly Alpha class | Up to 300 kg | \$5,000,000 flat | High flexibility: custom altitude, inclination, and launch window. | 6U CubeSats, SmallSat Buses |
| **Medium-Lift Launcher** | Falcon 9, Ariane 6 class | Up to 15,000 kg | \$25,000,000 flat | Constellation multi-deployment or heavy specialized radar/optical satellites. | Heavy LEO Buses, Multi-Satellite Dispersers |

#### Launch Site Latitude & Inclination Constraints
- **Physics Rule**: Direct launch from a spaceport at latitude $\phi_{site}$ cannot directly inject into an orbital inclination $i < |\phi_{site}|$ without an orbital plane-change maneuver.
- **Supported Spaceports**:
  - **Guiana Space Centre (Kourou)** ($\phi = 5.2^\circ\text{ N}$): Ideal for low-inclination and Equatorial missions with maximum Earth rotation assist ($\sim 460\text{ m/s}$).
  - **Cape Canaveral (USA)** ($\phi = 28.5^\circ\text{ N}$): Standard for mid-inclination missions ($28.5^\circ$ to $51.6^\circ$).
  - **Vandenberg Space Force Base (USA)** ($\phi = 34.7^\circ\text{ N}$) & **Mahia (New Zealand)** ($\phi = 39.2^\circ\text{ S}$): Clear southern trajectories for Polar and Sun-Synchronous (SSO) insertion.

---

## 5. Orbital Mechanics & Physics Engine

The orbital engine focuses on the **Low Earth Orbit (LEO)** domain:
- **Altitude range**: $200\text{ km} \le h \le 2,000\text{ km}$
- **Standard Earth Constants**:
  - Gravitational parameter $\mu = 3.986004418 \times 10^{14}\text{ m}^3/\text{s}^2$
  - Earth mean radius $R_E = 6,371\text{ km}$
  - Standard gravity $g_0 = 9.80665\text{ m/s}^2$

### 5.1 Keplerian Orbital Elements
Each orbit is defined by the standard 6 orbital parameters:
1. **Semi-major axis ($a$)**: $a = R_E + h_{avg}$
2. **Eccentricity ($e$)**: $0 \le e < 0.2$ (typical near-circular LEO)
3. **Inclination ($i$)**: $0^\circ \le i \le 180^\circ$ (Equatorial, ISS-like $51.6^\circ$, Sun-Synchronous $98^\circ$, Polar $90^\circ$)
4. **Longitude of the Ascending Node ($\Omega$)**: $0^\circ \le \Omega < 360^\circ$
5. **Argument of Periapsis ($\omega$)**: $0^\circ \le \omega < 360^\circ$
6. **True Anomaly ($\nu$) or Mean Anomaly ($M$)**: Position along the ellipse at time $t$.

### 5.2 Key Orbital Calculations
- **Orbital Period ($T$)**:
  $$T = 2\pi \sqrt{\frac{a^3}{\mu}}$$
  *(For 400 km ISS orbit, $T \approx 92.6\text{ minutes}$.)*
- **Orbital Speed ($v$)**:
  $$v = \sqrt{\mu \left(\frac{2}{r} - \frac{1}{a}\right)}$$
- **Eclipse / Shadow Function**:
  Computes geometric cylindrical Earth shadow based on Sun position vector $\hat{S}$ and satellite position vector $\vec{r}$.
- **Ground Coverage & Visibility Cone**:
  Half-angle $\theta_{cov}$ determined by altitude and minimum elevation angle ($\epsilon_{min} \approx 10^\circ$).
  Ground stations scattered across realistic global locations (e.g., Svalbard, Goldstone, Madrid, Canberra, Singapore, Kourou).

### 5.3 Orbital Maneuvers
- **Hohmann Transfer**: Two-impulse burn to raise or lower orbital altitude.
- **Plane Change ($\Delta i$)**: High delta-v inclination correction burn.
- **Atmospheric Drag & De-orbiting**: Perigee lowering below 120 km triggers terminal reentry burn-up.

### 5.4 LEO Orbital Regimes & Mission Profiles

The game supports four fundamental Low Earth Orbit regimes, each offering distinct geometric coverage, eclipse behavior, and delta-v requirements:

| Orbit Regime | Typical Inclination ($i$) | Altitude Range ($h$) | Key Characteristics | Optimal Mission Profiles |
| :--- | :--- | :--- | :--- | :--- |
| **1. Sun-Synchronous Orbit (SSO)** | $96^\circ \le i \le 99^\circ$ (Retrograde) | $500\text{ km} - 800\text{ km}$ | Nodal precession equals Earth's orbital period around the Sun ($\approx 0.9856^\circ/\text{day}$). Passes over any given point on Earth at the same local solar mean time. | Optical Earth observation, multispectral imaging, agricultural monitoring, and SAR. |
| **2. Polar Orbit** | $85^\circ \le i \le 95^\circ$ | $400\text{ km} - 1,000\text{ km}$ | Crosses near both poles on every revolution. With Earth rotating beneath, the satellite sweeps across 100% of global surface over time. | Global weather forecasting, climate science, polar ice tracking, and reconnaissance. |
| **3. Equatorial Orbit** | $0^\circ \le i \le 15^\circ$ | $300\text{ km} - 1,200\text{ km}$ | Maximizes Earth rotation launch assist (~460 m/s at Kourou). Extremely frequent revisit rates over tropical and equatorial regions. | Tropical storm monitoring, equatorial broadband communication, and regional IoT/AIS tracking. |
| **4. Mid-Inclination Orbit** | $28^\circ \le i \le 55^\circ$ | $350\text{ km} - 600\text{ km}$ | Covers the most densely populated global latitudes (e.g. ISS orbit at $51.6^\circ$, Cape Canaveral direct injection at $28.5^\circ$). Moderate launch energy. | Commercial communications constellations, Earth resources, scientific research, and crewed station support. |

---

## 6. Client-Server Architecture & API Design

The Express backend serves data and validates orbital math, keeping the client lightweight and reactive.

### 6.1 API Endpoints Specification

| Method | Endpoint | Description | Request Body / Query | Response Payload |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/catalog/components` | Retrieve complete component catalog, stats, costs, and slot types. | None | `{ categories: [...], parts: [...] }` |
| `GET` | `/api/catalog/chassis` | Retrieve available bus frames and socket layouts. | None | `{ chassis: [...] }` |
| `GET` | `/api/missions/contracts` | List active, available, and completed contract templates. | `?tier=1&reputation=100` | `{ contracts: [...] }` |
| `POST` | `/api/physics/propagate` | Generate discrete orbital state vectors $(x, y, z, v_x, v_y, v_z)$ for $N$ time-steps. | `{ elements: { a, e, i, raan, argP, ma }, duration, step }` | `{ trajectory: [[x,y,z], ...], periods, groundTrack: [...] }` |
| `POST` | `/api/physics/maneuver` | Calculate required $\Delta v$ vector and fuel mass for target orbital transfer. | `{ currentOrbit, targetOrbit, satelliteMass, isp }` | `{ deltaV, burnTime, fuelUsed, intermediateOrbit }` |
| `POST` | `/api/physics/link-budget` | Compute ground station pass windows, contact duration, and transmitted data volume. | `{ orbit, stationId, commsPayload, duration }` | `{ passes: [{ stationId, start, end, dataCapacityMB }] }` |

---

## 7. LocalStorage Persistence Schema

Landing composition targets a 1920 × 1080 desktop viewport, with height-responsive wordmark, 48–66 px menu controls (compact controls for short heights), bounded menu/satellite widths and aligned menu copy/actions. The continued-game summary is limited to two lines so agency names cannot push the footer outside the viewport. Desktop 1536 × 730 and 1366 × 768 layouts must fit without page scrolling; mobile retains its existing responsive composition. Provide a user-initiated Enter fullscreen action with For a better experience guidance; synchronize it with Settings and browser exit, with graceful unavailable/rejection handling. Do not globally scale or clip operational screens to enforce the landing dimensions.

Agency initialization/recovery: Play initializes a complete default agency before mission navigation. Existing partial mission saves are normalized and persisted on startup without clearing unlocks, builds, flight snapshots, support ledgers or valid balances (including zero). Profile counters retain historical values and are at least the number of persisted campaign flight plans/completed known missions; practice is excluded. Missing funds use the existing $250,000 starting allowance and explicitly disclose missing credit history in the profile, rather than claiming to reconstruct past charges. No unsaved launch history or reputation/deorbit rewards are invented. Open profiles refresh on saved-progress and cross-tab storage events.

First Play/Continue may offer fullscreen once per device via a menu preference, with explicit Enter fullscreen and Continue normally actions. Fullscreen is never required: Escape continues normally, unsupported/already-fullscreen environments bypass the prompt, and denied requests still enter mission selection. The first-flight guide opens after the fullscreen prompt closes. Device-storage failure retains the choice for the current session. Campaign progress is independent of this preference.

All player progress is serialized into standard JSON keys within browser `localStorage`:

### Key: `leo_game_save_v1`
```json
{
  "player": {
    "agencyName": "AstroDynamics Labs",
    "credits": 250000,
    "reputation": 45,
    "unlockedTech": ["cubesat_3u", "deployable_gaas", "s_band_antenna", "cold_gas_thruster"],
    "stats": {
      "launches": 3,
      "contractsCompleted": 2,
      "satellitesDeorbited": 1
    }
  },
  "blueprints": [
    {
      "id": "bp_earth_obs_01",
      "name": "EagleEye-1",
      "chassisId": "bus_cubesat_3u",
      "slots": {
        "socket_payload": "cam_rgb_hires",
        "socket_power": "solar_deployable_20w",
        "socket_battery": "bat_liion_50wh",
        "socket_propulsion": "prop_coldgas_100ms",
        "socket_comms": "comms_sband_patch",
        "socket_thermal": "tcs_radiator_passive_10w"
      },
      "computedStats": {
        "totalMassKg": 4.2,
        "dryMassKg": 3.6,
        "fuelMassKg": 0.6,
        "cost": 85000,
        "powerBalance": 8.5,
        "deltaV": 92.4
      }
    }
  ],
  "activeMissions": [
    {
      "missionId": "mis_noaa_weather_04",
      "contractId": "contract_earth_obs_polar",
      "satelliteId": "sat_orbiting_eagleeye_1",
      "orbit": {
        "a": 6971,
        "e": 0.0012,
        "i": 97.4,
        "raan": 45.0,
        "argP": 12.0,
        "epoch": 1730592000
      },
      "progress": {
        "dataCollectedMB": 420.5,
        "dataTargetMB": 1000.0,
        "status": "IN_ORBIT"
      }
    }
  ],
  "settings": {
    "musicVolume": 0.7,
    "sfxVolume": 0.9,
    "graphicsQuality": "high",
    "showOrbits": true,
    "showGroundTracks": true
  }
}
```

---

## 8. User Interface & 3D Visualization Specification

### 8.1 Dual-View Experience
The game provides two dedicated 3D canvas viewports with seamless switching:

```
+-----------------------------------------------------------------------------+
| [TOP BAR] Agency: AstroDynamics | Funds: $250,000 | UTC: 2026-11-02 12:00  |
+-----------------------------------------------------------------------------+
| [NAV]  [ 🛠️ Assembly Hangar ]   |   [ 🌍 Orbital Operations ]   |  [ 📋 Missions ]|
+-----------------------------------------------------------------------------+
|                                  |                                          |
|         LEFT CONTROL PANEL       |            THREE.JS 3D VIEWPORT          |
|  - Component Palette (Hangar)    |   • Hangar: 3D Satellite on turntable   |
|  - Orbital Maneuvers (Orbit)     |   • Orbit: 3D Earth, Orbit Path, Sun    |
|  - Live Subsystem Health         |   • Day/Night Terminator, Ground Track   |
|                                  |                                          |
+----------------------------------+------------------------------------------+
| [BOTTOM DOCK] Telemetry Graph / Time Warp (Pause, 1x, 5x, 25x, 100x, 1000x) |
+-----------------------------------------------------------------------------+
```

#### View 1: 3D Satellite Assembly Hangar
- **Turntable Camera**: Orbit controls with smooth damping, zoom bounds, and focus centering.
- **Visual Style**: Clean sci-fi cleanroom / vibration test facility with reflective epoxy floor grid and soft directional studio lighting.
- **Interactive Socket Snapping**: Ghosted 3D wireframe bounding boxes indicate available sockets when dragging or clicking parts.
- **HUD Live Telemetry**: Dynamic gauge meters showing Mass vs. Launch Capacity, Sun Power vs. Eclipse Drain, Thermal Equilibrium, and Total Cost.

#### View 2: 3D Orbital Operations Map
- **Earth Rendering**:
  - High-resolution Earth diffuse texture + specular oceans map + nighttime city lights texture.
  - Atmospheric Rayleigh/Mie scattering glow shader.
  - Directional Sun light source accurately casting real-time day/night terminator.
- **Orbital Visualizations**:
  - Glowing Keplerian ellipse line showing active trajectory.
  - Sub-satellite nadir ground track projected onto Earth surface.
  - Conical footprint indicating instantaneous sensor and communications coverage area.
  - Ground station antennas with pulsing signal arcs during downlink passes.
- **Time Warp Engine**:
  - Speeds: `PAUSE (0x)`, `REALTIME (1x)`, `ORBITAL (10x)`, `FAST (60x)`, `WARP (300x)`.
  - Step-based numerical integration preventing physics tunnel effects at high warp.

### 8.2 Aerospace HUD Aesthetics & Design System
- **Color Palette**:
  - Deep Space Canvas: `#050811` to `#0B132B`
  - Panel Glassmorphism: `rgba(13, 22, 45, 0.75)` with `backdrop-filter: blur(12px)`
  - Cyber Cyan (Primary Accent): `#00F0FF`
  - Neon Amber (Warning/Power): `#FFB703`
  - Solar Gold (EPS Generation): `#FFD166`
  - Matrix Green (Nominal/Success): `#06D6A0`
  - Hazard Red (Eclipse/Blackout/Deorbit): `#EF476F`
- **Typography**: Modern geometric sans-serif (e.g., `Orbitron` / `Space Grotesk` for headers, `Inter` / `JetBrains Mono` for telemetry and numbers).

---

## 9. Error Handling, Safety Limits & Performance

### 9.1 Physics & Space Hazards Safety Boundaries
1. **Perigee Decay**: If satellite altitude dips below $120\text{ km}$, trigger atmospheric drag decay sequence leading to fiery destruction.
2. **Thermal Shock**: If satellite spends $>60\text{ minutes}$ in full shadow without active battery heaters, payload sensors freeze and take permanent efficiency damage.
3. **Power Blackout**: If battery reaches $0\%$ in eclipse, all orientation control is lost until the next orbital sunrise; reaction wheels require manual spin-up recovery.

### 9.2 Rendering & WebGL Optimization
- **Texture Sharing & Memory Disposals**: Explicitly invoke `.dispose()` on geometries, materials, and textures when switching between Hangar and Orbit modes.
- **LOD (Level of Detail)**: Scale down Earth sphere segment count from 64x64 on desktop to 32x32 if framerate drops below 45 FPS.
- **Instanced Meshes**: Used for stars skybox and debris fields.

---

## 10. File & Directory Structure

```
space-mission-design-game/
├── package.json
├── SPEC.md                           # This global specification
├── server/
│   ├── server.js                     # Express entry point & middleware
│   ├── routes/
│   │   ├── catalog.js                # Parts and chassis endpoints
│   │   ├── missions.js               # Contract generation & rewards
│   │   └── physics.js                # Propagation & delta-v endpoints
│   ├── data/
│   │   ├── components.json           # Catalog of bus, solar, thrusters, payloads
│   │   └── groundStations.json       # Real-world ground station lat/lon coordinates
│   └── physics/
│       ├── kepler.js                 # Keplerian equations, anomalies & state vectors
│       ├── maneuvers.js              # Hohmann transfer & delta-v calculators
│       └── thermal.js                # Solar flux, eclipse & heat dissipation
├── client/
│   ├── index.html                    # Main entry point & HUD view layouts
│   ├── assets/                       # Earth textures, normal maps, decals, icons
│   ├── css/                          # Aerospace HUD styling & glassmorphism
│   │   ├── main.css                  # Layout, typography, global palette
│   │   ├── hangar.css                # 3D turntable overlay & parts tray
│   │   └── orbit.css                 # Telemetry HUD, burn planner, warp dock
│   └── js/                           # Vanilla JavaScript (ES Modules)
│       ├── main.js                   # Application bootstrap, navigation & routing
│       ├── state.js                  # Centralized state & localStorage sync
│       ├── api.js                    # Fetch client for Express REST API
│       ├── simulation.js             # Real-time tick engine & time-warp runner
│       ├── views/                    # DOM UI View Controllers
│       │   ├── hangarView.js         # Assembly hangar UI & socket-snapping
│       │   ├── orbitView.js          # Orbital operations HUD & telemetry dials
│       │   └── contractsView.js      # Contracts management & reward dialogs
│       ├── three/                    # Three.js 3D Viewports
│       │   ├── hangarScene.js        # Assembly cleanroom & turntable controls
│       │   └── orbitScene.js         # Earth globe, trajectory line, atmosphere shader
│       └── utils/                    # Shared utilities
│           ├── math.js               # Coordinate conversions & vector arithmetic
│           └── constants.js          # Astrodynamic constants (R_EARTH, MU, etc.)
```

---

## 11. Phased Development Roadmap

### Phase 1: Core Foundation & Systems (M1)
- [x] Global Specification Document (`SPEC.md`).
- [ ] Express backend with `/api/catalog` and `/api/physics/propagate`.
- [ ] Vanilla JS application scaffold with aerospace UI design system.
- [ ] `localStorage` save system schema implementation.

### Phase 2: 3D Assembly Hangar (M2)
- [ ] Three.js assembly hangar scene with procedural or composite 3D satellite components.
- [ ] Component drag/click slot-snapping system.
- [ ] Real-time mass, power, thermal, and cost recalculation engine.

### Phase 3: 3D Orbital World & Flight Dynamics (M3)
- [ ] Three.js textured Earth globe with atmospheric glow and rotating directional Sun.
- [ ] Real-time orbit line rendering and satellite position updating via Kepler equations.
- [ ] Day/Night eclipse detection and battery charging/discharging loop.
- [ ] Time warp controls (Pause, 1x, 10x, 100x, 1000x).

### Phase 4: Contracts, Maneuvers & Downlink (M4)
- [ ] Ground stations line-of-sight cone and telemetry data downlink.
- [ ] Hohmann transfer burn execution and delta-v expenditure.
- [ ] Contract fulfillment, financial payouts, and tech tree unlocks.

### Phase 5: Audio, Polish & Performance (M5)
- [ ] Sound effects (thruster hisses, telemetry beeps, UI clicks).
- [ ] Deorbit burn fire VFX and satellite destruction animations.
- [ ] Performance benchmarking and final UX polish.

### 8.3 Guided Assembly Preview (2026-11-06)

The mission brief opens a guided assembly preview before the full 3D hangar milestone.
- Keep a large 3D satellite viewer on the left and one active subsystem's component choices on the right. Place expandable mass, power and budget estimates in a compact bottom bar; retain mission performance in design review and payload descriptions.
- Provide contextual Continue actions through Chassis, Payload, Power and Systems; the final action opens design review. Keep saving secondary in the header and reset inside View options with confirmation.
- Read beginner components from the existing catalog API. Allow one component per subsystem, filter by chassis family, and remove incompatible selections when changing chassis.
- Save preview blueprints in the existing blueprints array, preserving other save fields. Hardware cost is an estimate and does not deduct player credits.
- Show nominal catalog imaging performance and ideal sunlight power estimates. Clearly label unimplemented slot, thermal, eclipse, pointing and downlink checks. The review must not unlock launch or imply complete flight validation.
- Use a responsive layout with stacked panels on small screens. A Three.js workbench renders installed components and isolated part previews. Physical socket placement remains Phase 2 work.

#### Assembly studio refinements
- Group six core selections into four stages: Chassis, Payload, Power (solar/battery), and Systems (communications/computer plus optional thermal/propulsion). Show current stage and selection completion without implying flight readiness.
- Component cards compare configured mass, key catalog performance, and projected hardware cost. Chassis replacement projections exclude incompatible parts that will be removed; explain that removal before selection and report it afterward.
- Resume the first missing core selection, preserve keyboard focus and metric disclosures through updates, and reflect installed parts in preview shortcuts. Restrict Urban Mapping's payload picker to optical instruments.
- Use muted charcoal surfaces with gold primary guidance, sage selection indicators, and warm warning text. Mobile layouts show a compact 3D preview above the component panel and avoid nested component scrolling.

#### Interactive 3D workbench
- Use the existing vendored Three.js modules and local procedural geometry, without network model dependencies. Build component-specific PBR models from catalog dimensions: chassis rails, solar cells, optical lenses, battery cells, antennas, circuit boards, thermal panels, attitude actuators and thrusters.
- Render installed selections together. Each component card offers an isolated “Preview in 3D”; previewing must not change the blueprint, cost or selection progress. Install from the card or the preview toolbar and return to the assembly.
- Support pointer/touch rotation, pinch/wheel/button zoom, arrow-key rotation, keyboard zoom, camera reset, internal-component transparency, wireframe and exploded assembly views. Clicking installed geometry selects its subsystem.
- Render on demand, suspend the hidden menu scene during assembly, share one workbench renderer across part previews, and dispose replaced geometry/materials and the renderer on page exit. Resize for desktop/mobile and retain non-3D component selection if WebGL is unavailable.
- Mounting locations are illustrative and do not implement collision, slot occupancy or physical fit validation. The catalog's progression/compatibility filters still determine which parts the player can select.

#### Satellite silhouette and inspection defaults
- Default to a closed, opaque spacecraft; cutaway and exploded views are deliberate inspection options. Keep structural rails opaque during cutaway.
- Align the chassis upright and visually contain internal modules. Camera apertures may protrude through the front face; antennas and nozzles attach to their relevant faces.
- Depict a deployed catalog solar array as a connected, symmetric pair of half-width wings, preserving its total represented panel area and all catalog engineering totals. Keep body-mounted arrays attached to the hull.
- Fit the camera to projected model bounds so the assembly fills the workbench without cropping. These visual accommodations do not claim validated physical slot fit.

#### Attachment continuity
- Align each deployable wing's hinge with its inner edge and show visible support arms that overlap the hull and panel geometry.
- Position exterior mounts against actual rendered geometry where nominal dimensions do not describe the base. Body solar, communications, thermal and propulsion components require continuous support brackets.
- Label exploded inspection explicitly and provide a direct “Reattach parts” action. Exploded separation must not be mistaken for the default installed arrangement.

#### Stable workbench viewport
- Allocate explicit grid areas for the viewer and its controls. Decorative rings must stay within panel bounds and must not create scrollable content.
- The 3D stage itself must not scroll, including when component preview or inspection tools are used. Keep the canvas fitted to its allocated viewer area and desktop scrolling inside the component library.
- Show inspection settings in a bounded popover that preserves viewer height and supports outside-click/Escape dismissal without intercepting modal-dialog dismissal.

#### Camera continuity and interaction feedback
- Preserve assembly rotation and normalized zoom across category changes, component updates and viewport resizing. Remember isolated previews separately and restore the assembly view when returning. Reset View is the explicit reset action; newly sized models may refit without discarding the user's rotation/zoom preference.
- Avoid rebuilding unchanged model geometry for navigation-only updates. Keep animation demand-driven and restore material state when an effect completes or is interrupted.
- Installation/removal must produce a short accessible confirmation. Installed parts receive a brief fade/highlight; selected cards stay first and have clear badges with quieter removal controls.
- Show an Assembly / Part preview / Exploded view mode indicator. Use short 150–200 ms UI transitions without layout shifts. Reduced-motion mode must retain textual feedback while suppressing animation and canceling effects already running.

### Urban Mapping mission configuration and preflight (implemented 2026-11-06)
- Review design opens mission configuration with launch service/site, altitude, inclination and catalog-supported camera focal length. Tutorial rideshare fixes insertion at 500 km / 97.4° from Vandenberg; dedicated launch services permit custom parameters subject to mission and launch-latitude constraints.
- Beginner planning includes a $400,000 mission-specific allowance alongside existing agency funds. This is an explicit tutorial balance adjustment: it does not grant or deduct credits. A valid eight-component starter costs $433,000 hardware plus $132,750 rideshare, within $650,000 available at default agency funds. Launch accounting is implemented in the orbital operations milestone below.
- Pure engineering screening includes catalog/category/tier validity, required OBC and optical payload, compatibility, primary/secondary internal and external slot capacities, dry/wet mass, full hardware/launch budget, altitude and target-latitude access, focal-length-dependent GSD/swath/mass/power, ADCS pointing, single-image storage, S-band, orbital energy, battery reserve/rate and cooling capacity.
- Conservative energy assumptions: circular orbit, beta=0 maximum eclipse, 85% rated solar generation, 20% imaging duty, 10% radio duty and continuous support loads. Optical payload is idle during eclipse. RGB images use 3 bytes/pixel and catalog compression. Thermal capacity is a rating screen, not a temperature integration or operating-temperature certification. Mount checks are aggregate capacity, not physical collision checks.
- Physics verification uses the existing propagation and link-budget APIs at a fixed scenario epoch (2026-11-06 00:00 UTC), with one-orbit propagation and 24-hour Singapore S-band contact prediction. Contact capacity must accommodate one image. Timed observation, illumination and basic operations are implemented in the orbital milestone below; temperature evolution remains unimplemented.
- Blueprints retain missionSettings. Validated plans are saved separately in missionPlans with PREFLIGHT_PASSED status, component/configuration snapshots, scenario target/station, checks, assumptions and backend verification. Saving does not create an active mission, complete a contract, unlock later missions or spend credits. Input signatures include funds, configuration and parts; changed inputs require new verification. Saving a changed blueprint removes its stale validated plan.

### Urban orbital operations (implemented 2026-11-06)
- A saved validated Urban plan can launch into a dedicated 3D Earth view. It shows a locally generated Earth atlas with solar lighting, an inertial orbit path, rotating Earth, Singapore marker and the assembled satellite enlarged for visibility. Drag/scroll/keyboard camera controls and telemetry remain separate from the physics model. Graphics failure leaves operations usable.
- Launch applies up to $400,000 of Urban support once, charges the remaining full hardware-plus-launch cost from agency funds and records both amounts with the flight. Default starter: $165,750 agency charge and $84,250 remaining. Prediction or storage failure before launch does not charge funds. Resume uses the immutable launched plan and never charges again; only one Urban flight is supported in this milestone. No retry/refund or mission rewards are implemented.
- Fetch seven days of J2 propagation and Singapore S-band contacts, at 10-second sampling. Simulated time is paused on entry/resume/return/document hide; speed choices are 1×, 10×, 100× and 1000×. Advance-to-opportunity runs the same resource integration as ordinary playback. It cannot skip battery loss or grant imagery/contact.
- Capture requires target solar elevation ≥10°, satellite out of eclipse, target above the horizon, off-nadir angle ≤30° and a conservative oblique GSD approximation ≤3 m. Ground separation and look angle use spherical geometry; sun direction/GMST follow the backend formulas. The tutorial assumes instantaneous pointing and one two-second exposure-energy cost. No cloud, slew-time, rolling image scan or temperature integration is claimed. Store a conservative image size computed during preflight.
- One-second-or-smaller battery/throughput integration uses continuous support loads, camera/radio standby, active radio load during actual contact, 85% solar output scaled by backend sun fraction, finite battery capacity, depth-of-discharge reserve and discharge-rate limit. A reserve violation stops the mission. Downlink commands can be armed ahead of a pass, but data moves only within contact and after capture. Complete delivery stops time and marks Urban complete, refreshing mission cards and unlocking Agricultural Monitoring. Partial delivery cannot complete the mission.
- Persist orbitalFlight (plan snapshot, state, charge/support ledger) and missionSupportUsed; checkpoint explicit actions, return and playback periodically. No time passes offline. Successful completion updates missionProgress only after the full image is delivered. Agricultural operations are implemented separately as the seasonal scheduling level below.

#### Follow satellite and Earth overview
- Default orbital camera follows the exact assembled model from the immutable launched component snapshot. Position tracks the propagated satellite; viewing direction is relative to its attitude so the model remains centered as the orbit advances. Later workshop edits do not alter an already launched spacecraft.
- Follow satellite and Earth overview are keyboard-accessible, pressed-state buttons above the globe. Each mode retains independent drag rotation and zoom. Reset View resets only the active mode. Follow framing adapts to viewport aspect ratio and clamps the camera outside Earth; overview keeps its orbit marker while follow hides the marker to expose the hardware.
- A visual inspection fill makes component geometry readable in eclipse, without changing illumination, battery or capture calculations. Launched components are listed in an expandable telemetry section. Camera mode changes do not change time, funds, mission state or hardware.

#### Stopped-flight recovery and free practice
- Completed, power-loss and expired flights show their stop reason beside playback controls, with a free Replay in practice action. Replay starts the same launched build from the scenario epoch with fresh battery/image state and explicitly requires Play to advance time.
- Practice checkpoints persist separately as orbitalPractice. Campaign flight, credits, support allocation, completion and counters remain unchanged. Practice resumes paused through mission review and grants no campaign rewards.

#### Mission result panel
- Terminal flights show Mission Complete, Mission Failed (battery reserve) or Time Expired in a prominent telemetry result panel while retaining the launched satellite view. Display image resolution or Not captured, delivered/required MB, remaining battery and elapsed simulated hours, with a reason and actionable guidance.
- Replay/Retry for free starts the existing isolated practice flow. Workshop/Improve build returns to editable assembly; edits remain separate from the launched snapshot. Next mission is shown only after completion with a persisted Urban campaign unlock and opens the Agricultural Monitoring briefing directly. The first successful full delivery, including a replay after a failed original flight, unlocks the next mission; repeated successes do not duplicate completion counts.
- Announce/focus a new result once, hide it when a replay begins, and preserve campaign accounting and progress. Persist terminal playback state before rendering its result so unlock availability is current.

#### Manual instrument aiming and capture challenge
- New/resumed uncaptured flights default to manual instrument aim (east/north off-nadir axes), separate from the 3D viewing camera. The tactical aiming map displays a target diamond, boresight crosshair, angular alignment error/tolerance and remaining sampled imaging-window time. Click/tap, arrow keys (0.2°), or 0.1° range controls aim the instrument; controls are constrained to a 30° radial envelope.
- Derive target bearing from spherical target/subsatellite geometry. Capture additionally requires boresight error within the conservative half-swath margin after reserving the 10 km target width. Misaligned capture consumes no energy. Existing illumination, horizon, resolution, storage and battery requirements still apply. The map is an angular targeting aid, not a rendered camera image or exact ray-traced footprint.
- Optional Auto-point assist follows the target instantly within valid capture geometry and records assisted captures. Save aim mode/axes and capture error/mode/quality in flight state. Quality score combines alignment (60%) and resolution relative to nadir performance (40%); it grants no additional funds/unlocks. Results display manual/assisted score.
- Fast playback stops at the first sampled valid imaging opportunity and resets speed to 1× so the player can aim. Playback may continue at 1× to track the moving target. Instrument slew dynamics and temperature integration remain outside this approximation.

#### Target-camera terrain view and captured image reveal
- Orbital operations defaults to Target camera alongside Follow satellite and Earth overview. The instrument view renders deterministic procedural terrain centered on the mission target, a gold 10 × 10 km target outline, white sensor footprint and boresight. It is explicitly illustrative, not satellite photography, a geographic basemap or a ray-traced Earth camera.
- Live framing follows actual east/north aim relative to target bearing using altitude and tangent-angle offsets. The square sensor field spans the configured preflight swath. Aspect-ratio margins provide surrounding context outside the sensor square. Click/tap or arrow keys adjust instrument aim; existing aim/capture gates remain authoritative. This canvas remains usable if WebGL fails.
- Capture persists compact framing metadata (east/north offsets, swath, terrain version) with existing quality, resolution and aim mode. A separate image reveal reconstructs the same deterministic terrain crop without target/HUD overlays. Image framing stays frozen as the orbit advances and on save/resume. Older captures without framing show metadata and an unavailable-preview explanation rather than inventing a picture. Replay clears the reveal. No base64 image is written to localStorage.

#### Camera waiting and off-frame guidance
- Outside a valid capture window, start in Follow satellite when WebGL is available. Selecting Target camera shows a clear travel/waiting explanation and an action to advance using the regular resource-integrating opportunity control.
- If the instrument points away from the terrain, show Bring target into view rather than a blank field. This stages a nearby manual aim with a small deliberate offset; fine alignment remains required. Stop states and absent opportunities disable the advance action. Captured image reveal is unchanged.

#### Earth overview destination and pass planner
- Select the gold target center or cyan ground-station ring on the globe, or use keyboard-accessible destination buttons. Both Singapore symbols remain at their actual shared scenario coordinates. Ray picking ignores drag gestures and objects behind Earth. Destination selection centers the overview camera without advancing time.
- The overview sidebar shows the next valid sunlit imaging window or Singapore station pass, simulated-time countdown, active-window remaining duration and remaining S-band capacity. Predictions use the same sampled target windows and backend contact intervals as capture/downlink gameplay. Countdown changes only with simulated time.
- Advance to pass pauses playback, integrates resources to that event and saves the resulting state. Target advance opens the instrument view but never captures automatically; station advance never enables the radio. Current contact, absent opportunities and stopped flights disable invalid advances. A contact arc is visible during predicted Singapore contact and its opacity varies with simulated time while transmitting.
- This milestone implements selection/pass planning and contact indication from the orbital-map specification. Ground-track projection, a 3D coverage cone and higher-resolution Earth/night-light rendering remain future visualization work.

#### Capture readiness and shutter feedback
- Target-camera sensor frame and boresight turn green only when the shared engine readiness check passes: active flight, no existing image, valid capture window, acceptable alignment and sufficient battery reserve for exposure. Display a readable readiness reason plus the framing instruction; color is supplemental.
- Successful explicit capture triggers a single low-opacity 180 ms shutter fade. Rejected attempts, resume and preview reconstruction do not flash. Reduced-motion mode disables/cancels the effect while preserving textual confirmation. Switching views or disposing the instrument cancels the animation. Frozen image previews do not include the green frame, targeting HUD or shutter effect.

#### Completion retry prompt
- After the full image is delivered and flight status becomes COMPLETE, show a labelled modal asking whether to try again. Yes starts the existing free practice replay with the launched build; No or Escape keeps the results. Show once per completed flight ID per page session, including completed saves opened in a new page session.
- Capturing alone does not complete the mission or show the prompt. Captured-but-undelivered flights display a delivery-pending instruction explaining downlink and playback. Campaign progress, credits and counters remain preserved by the practice replay flow.

#### Replay naming
- Player-facing UI calls free repeat flights Mission Replay, including resume, status, results and completion prompts. The existing orbitalPractice persistence key and campaign accounting behavior remain unchanged for save compatibility. Replays do not charge funds or grant additional campaign rewards.

#### Downlink transfer controls
- Send image to Earth explicitly arms downlink and starts simulated playback. Pause transfer disarms the radio and pauses time; Resume transfer keeps delivered bytes and restarts playback. Resuming a saved flight never silently starts transmission. Show transfer progress in MB/percent, waiting/transmitting/paused/received states, radio rate, remaining contact and required contact duration.
- A separate Go to next station pass action integrates resources to the next AOS. It resumes playback only when transmission was explicitly armed; it never captures imagery or enables a previously unarmed radio. No data moves outside actual contact intervals. Completion remains full-image delivery and opens the existing retry prompt.
- Resource integration splits at exact AOS/LOS and remaining-image transmission duration, including fractional-second boundaries, preventing data from leaking outside contact or overcharging a full extra second after delivery.

#### Preflight and completed-flight visual polish
- Preflight uses an explicitly scoped 860 px desktop dialog, compact responsive field grid, full-width inputs, clear cost summary and a sticky heading/close control. Shared generic dialog/label styles must not shrink the mission form or introduce large field margins. Mobile uses one field column and two cost columns without horizontal overflow.
- After capture, the main instrument view displays the saved image framing without live targeting overlays. Completion displays Image delivered and a completion heading instead of outside-capture-window messaging. Legacy captures without image metadata explicitly report unavailable preview. Capture status and actual mission completion remain separate.
- Results reset the telemetry scroll position to the top when newly shown. Completed flights hide disabled playback controls while keeping result replay/workshop/next actions. Starting replay restores ordinary playback controls. Existing physics, accounting and gameplay interactions are unchanged.

#### Preflight ground-station preview
- Orbit/station verification includes a local SVG antenna illustration labelled illustrative, Singapore CRISP location (1.30° N, 103.77° E), S-band and 10° minimum elevation, plus selected-radio compatibility.
- Before verification, contact statistics remain unavailable. After checking, show actual backend 24-hour pass count, total contact minutes, data capacity and up to four predicted UTC acquisition times with duration/data volume. Bind the preview to the same current-design verification signature; changing design/settings clears stale statistics and schedule. This does not imply a completed observation or real site photography.

#### Completion and next-level progression
- Centralized sequential unlocks and completion recording. Only a valid COMPLETE flight with a captured image and full delivered MB can finish a contract. The first successful mission replay may complete an unfinished contract; further successes preserve its existing completion and never duplicate counts or funds. The original failed flight remains intact.
- A completion modal and results expose the next unlocked mission by name. Next closes operations, checkpoints the flight, returns through the workshop and opens the next mission's actual requirements briefing. Persist its selection so reopening the game stays on that mission. Repair a valid completed saved flight's missing progression record on resume before rendering Next.
- The initial progression milestone ended at the Agricultural Monitoring brief. The seasonal scheduling implementation below supersedes its former workshop-preview limitation. Disaster Monitoring still has briefing/workshop preview only.

### Agricultural seasonal operations (implemented 2026-11-06)
- Mission 2 is a turn-based, 120-day growing-season mission reached from Urban completion. Its workshop supports tier 1–2 components. Review design opens seasonal configuration, engineering checks and launch/resume. Choose RGB/multispectral camera, S/X-band radio, one of four catalog stations, orbit, catalog focal length and a 50–100% weighted delivery goal (70% default). Engineering screens preserve Urban checks and apply Agriculture's 500–700 km, 80 kg and 40 W average limits. A separate 100 W peak ceiling is an explicit game setting.
- Scenario choices: six illustrative farming-region centers (Central Luzon, Mekong Delta, East Java, Central Thailand, Punjab, Murray–Darling), priority weights 3/3/2/2/1/1, one 10 × 10 km request per region per 20-day window (36 requests), 30 m maximum GSD, and up to $800,000 support applied once at launch. These parameters make the broadly specified seasonal mission concrete; they are not external operational data or real pricing.
- Select up to three regions per daily command and arm/disarm downlink. Run one or seven days explicitly; switch priorities after deliveries. Station contact and priority choices affect what can be delivered before deadlines. Queued/captured/partial imagery earns no weight. Expired incomplete requests free their remaining buffer and cannot earn late credit. No time advances offline or without a command. Stop ends a multi-day command after the current committed day; hiding the document aborts in-flight predictions and preserves prior committed days.
- Fetch daily J2 propagation, eclipse/illumination and selected-station contacts through existing backend APIs at 30-second sampling. Integrate idle loads, finite battery/DoD/discharge limits and actual radio throughput in steps ≤1 second split at contact/data boundaries. Two-second captures require sampled target illumination ≥10°, satellite sunlight, horizon access, off-nadir ≤30°, conservative oblique GSD ≤30 m, free OBC storage and exposure reserve. Pointing is instantaneous and schedule-driven. Image bytes use configured resolution and catalog spectral-band count. Temperature evolution, cloud/slew models, drag, degradation and vegetation-index products are outside this implementation.
- Validate engineering and first-day station availability before a single atomic saved launch/charge. Support covers at most full hardware-plus-launch cost; only the remainder is debited from agency credits. RGB starter costs $404,750 including rideshare and fits within support. Persist agricultureFlight with immutable launched plan, resource/request state and charge ledger; resume never pays again. Workshop edits remain separate. Failed writes do not commit a day or a launch. Prediction failures allow retry from the last saved day.
- Keep the season active through day 120 even if its delivery share is reached early. At the end, sufficient priority-weighted, on-time deliveries mark Agriculture complete and unlock Disaster briefing once; reserve failure or a missed share cannot unlock. Generic single-image completion cannot complete the seasonal level. Results offer free retry of the same launched build and Next mission when unlocked. Retry replaces the seasonal attempt but preserves campaign progress and finances; replacement launches with changed builds are not implemented.
- Accessible stage navigation, regional request labels, progress/telemetry, persistent command feedback, bounded flight log and responsive one-column mobile layout expose the next action. No WebGL is required for this scheduling screen; existing Urban views remain available.

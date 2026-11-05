# 📜 PROJECT RECORDS & LIVING SOURCE OF TRUTH
## Project: Orbiterra — 3D Low Earth Orbit Satellite Design & Simulation Game
**Document:** `RECORDS.md`  
**Location:** Repository Root (`/RECORDS.md`)  
**Status:** Active Living Document (Updated with every feature, refactor, and debug)  
**Current Branch:** `implement-orbital-physics`  
**Last Synchronized:** 2026-11-05  

---

## 1. Project Overview & Core Philosophy

**Orbiterra** is an interactive, browser-based space mission design and orbital simulation game. Players engineer modular satellites within real-world engineering constraints (mass, volume, electrical power, thermal boundaries, financial budgets, and data downlink quotas), launch them into Low Earth Orbit (200 km – 2,000 km), execute orbital maneuvers, and operate them to fulfill commercial, scientific, and defense contracts.

### Core Architectural Pillars
1. **Client-Server Separation**:
   - **Backend (Node.js / Express)**: Authoritative scientific astrodynamics engine (Keplerian orbits, WGS-84 geodesy, $J_2$ perturbations, maneuvers, ground station passes, atmospheric drag) and static parts catalog.
   - **Frontend (Vanilla JS ES Modules & Three.js)**: High-performance aerospace HUD interface and dual 3D viewports (Assembly Cleanroom Hangar & Orbital Earth Globe).
   - **Persistence (Zero-Database)**: Full player progress, unlocked technologies, blueprints, and active satellite constellations serialize directly to browser `localStorage` (`leo_game_save_v1`).
2. **Deterministic Physics & Engineering**:
   - Subsystem viability is 100% deterministic (no probabilistic RNG breakdowns). Survival and performance depend strictly on physical boundaries (power balance, depth of discharge, temperature bounds $[-40^\circ\text{C}, +65^\circ\text{C}]$, buffer capacity, and propellant).
3. **Modular Slot-Unit / Grid Architecture**:
   - Satellites utilize internal slots ($1\text{U}$ increments) and external mounting faces rather than rigid single-purpose sockets.
4. **Three.js "Ghost Primitive" Wrapper Architecture**:
   - Mathematical bounding boxes and raycasting use lightweight Three.js primitives (`BoxGeometry`, `CylinderGeometry`) with PBR procedural materials as fallbacks, while high-fidelity visual `.glb`/`.gltf` models attach as children.

---

## 2. Codebase Directory & File Manifest

```
space-mission-design-game/
├── package.json                    # Project manifest, dependencies, test & start scripts
├── package-lock.json               # Lockfile for reproducible npm installs
├── SPEC.md                         # Global engineering specification & architecture doc
├── README.md                       # High-level overview, quickstart & roadmap
├── COMPONENTS_SPEC.md              # Detailed component catalog schema & engineering rules
├── RECORDS.md                      # This file — living truth of project features & changes
├── AGENTS.md                       # Agent system prompt & workspace instructions
├── server/
│   ├── server.js                   # Express server entry point, static asset host, API router
│   ├── data/
│   │   ├── components.json         # Master satellite components database (buses, solar, payload, etc.)
│   │   └── groundStations.json     # Real-world ground station network (SvalSat, Goldstone, Kourou, etc.)
│   ├── physics/
│   │   ├── constants.js            # WGS-84, gravitational parameter, solar, and unit conversions
│   │   ├── coordinates.js          # ECI, ECEF, Bowring's geodetic lat/lon/alt, and topocentric SEZ
│   │   ├── kepler.js               # Newton-Raphson Kepler solver, J2 secular drift, orbit propagation
│   │   ├── shadow.js               # Solar ephemeris vector, cylindrical shadow, conical umbra/penumbra
│   │   ├── maneuvers.js            # Hohmann transfers, inclination changes, deorbit burns, Tsiolkovsky
│   │   ├── atmosphere.js           # US Standard Atmosphere exponential density, secular drag decay
│   │   └── groundStation.js        # Line-of-sight elevation tracking, AOS/LOS passes, downlink data volume
│   └── routes/
│       ├── catalog.js              # GET /api/catalog/components, GET /api/catalog/chassis
│       └── physics.js              # POST endpoints for propagate, maneuver, link-budget, drag-decay
└── tests/
    ├── physics/
    │   ├── constants.test.js       # (Integrated in physics suites)
    │   ├── coordinates.test.js     # ECI/ECEF, Bowring's algorithm, topocentric elevation/azimuth tests
    │   ├── kepler.test.js          # Newton-Raphson, ISS orbit period/speed, SSO J2 drift, propagation tests
    │   ├── shadow.test.js          # Sun vector normalization, day/night umbra/penumbra tests
    │   ├── maneuvers.test.js       # Hohmann transfer, plane change, deorbit, and Tsiolkovsky tests
    │   ├── atmosphere.test.js      # Atmospheric density brackets, CubeSat secular decay, reentry trigger
    │   └── groundStation.test.js   # Station loading, polar pass accumulation, data volume downlink tests
    └── routes/
        └── api.test.js             # End-to-end HTTP integration tests for all Express API routes
```

---

## 3. Implemented API Endpoints Reference

| Method | Route | Description | Input Parameters | Key Outputs |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health & engine status | None | `{ status: "ok", game, timestamp }` |
| `GET` | `/api/catalog/components` | Complete parts catalog with filtering | `?category=...&tier=...&chassis=...` | `{ total, components: [...] }` |
| `GET` | `/api/catalog/chassis` | Structural bus chassis only | None | `{ total, chassis: [...] }` |
| `POST` | `/api/physics/propagate` | Propagates 3D trajectory & ground tracks | `{ elements: { a, e, i, raan, argP, ma }, duration, step, includeSun, enableJ2 }` | `{ periodSec, semiMajorAxisM, driftRates, points: [{ time, rECI, vECI, geodetic, isEclipse, sunFraction, solarFluxWPerM2 }] }` |
| `POST` | `/api/physics/maneuver` | Plans orbital transfers & propellant usage | `{ maneuverType, currentOrbit, targetOrbit, satellite: { wetMassKg, ispSeconds, thrustN } }` | `{ deltaV1MPerSec, deltaV2MPerSec, totalDeltaVMPerSec, transferTimeSeconds, fuelUsedKg, finalMassKg, burnDurationSeconds }` |
| `POST` | `/api/physics/link-budget` | Ground station line-of-sight passes | `{ orbit, duration, step, comms: { downlinkMbps, minElevationDeg }, stationIds }` | `{ totalPasses, totalContactTimeSec, totalDataCapacityMB, passes: [{ stationId, aosTime, losTime, durationSeconds, maxElevationDeg, dataDownlinkedMB }] }` |
| `POST` | `/api/physics/drag-decay` | Secular atmospheric decay & lifetime | `{ altitudeKm, massKg, dragAreaM2, cd }` | `{ densityKgPerM3, daDtMPerSec, altitudeLossMPerDay, perigeeAltM, isTerminalReentry, estimatedLifetimeDays }` |

*Note on Unit Normalization*: All `/api/physics/*` endpoints automatically accept either human-friendly units (`altitudeKm`, angles in degrees like `inclinationDeg`, `raanDeg`) or standard SI (`meters`, `radians`).

---

## 4. Astrodynamic & Mathematical Models in Production

### 4.1 Keplerian Mechanics & Perturbations
- **Transcendental Kepler Solver**: Solves $M = E - e \sin E$ using Newton-Raphson iteration with initial guess $E_0 = M + e\sin M + \frac{1}{2}e^2\sin(2M)$ to $< 10^{-11}\text{ rad}$ tolerance.
- **$J_2$ Secular Precession**:
  $$\dot{\Omega}_{J2} = -\frac{3}{2} n_0 J_2 \left(\frac{R_E}{p}\right)^2 \cos i$$
  $$\dot{\omega}_{J2} = \frac{3}{4} n_0 J_2 \left(\frac{R_E}{p}\right)^2 (5\cos^2 i - 1)$$
  $$\dot{M}_{J2} = \frac{3}{4} n_0 J_2 \left(\frac{R_E}{p}\right)^2 \sqrt{1 - e^2} (3\cos^2 i - 1)$$
  *(Validates Sun-Synchronous Orbit nodal precession $\dot{\Omega} \approx 0.9856^\circ/\text{day}$ at $600\text{ km}, i = 97.79^\circ$.)*

### 4.2 WGS-84 Geodesy & Frame Transformations
- **Ellipsoid Parameters**: Equatorial radius $a = 6,378,137.0\text{ m}$, polar radius $b = 6,356,752.314\text{ m}$, flattening $f = 1/298.257223563$.
- **Bowring's Closed-Form Algorithm**: Exact closed-form transform from ECEF Cartesian coordinates to geodetic latitude $\phi$, longitude $\lambda$, and altitude $h$ above the reference ellipsoid with sub-millimeter precision.
- **Greenwich Mean Sidereal Time (GMST)**: Astronomical Almanac formula computing sidereal Earth rotation $\theta_{GST}(t)$ relative to J2000.0 epoch.
- **Topocentric SEZ (South-East-Zenith)**: Calculates instantaneous slant range, azimuth, and elevation angle $\epsilon = \arcsin(\frac{\vec{\rho} \cdot \hat{u}_z}{\rho})$ relative to ground station horizon.

### 4.3 Solar Ephemeris & Shadow Eclipse Geometry
- **Analytical Sun Vector**: ECI unit vector $\hat{S}_{ECI}(t)$ derived from ecliptic coordinates and Earth obliquity ($\epsilon_{obliq} = 23.439^\circ$).
- **Cylindrical & Conical Shadow**: Computes projected distance $s_\parallel = \vec{r} \cdot \hat{S}$ and perpendicular offset $r_\perp = \|\vec{r} - s_\parallel \hat{S}\|$, resolving total umbra shadow ($\eta = 0.0$), penumbra transition, and full solar flux ($S_0 = 1361\text{ W/m}^2$).

### 4.4 Maneuvers & Tsiolkovsky Rocket Equation
- **Impulsive Transfers**: Hohmann transfers ($r_1 \to r_2$), pure plane changes ($\Delta v = 2 v \sin(\Delta i / 2)$), and combined apoapsis transfers:
  $$\Delta v_2 = \sqrt{v_{tx,2}^2 + v_2^2 - 2 v_{tx,2} v_2 \cos(\Delta i)}$$
- **Tsiolkovsky Propellant Depletion**:
  $$\Delta m_{fuel} = m_{wet} \left(1 - \exp\left(-\frac{\Delta v}{I_{sp} g_0}\right)\right)$$
  $$\Delta t_{burn} = \frac{\Delta m_{fuel}}{\dot{m}} = \frac{\Delta m_{fuel} I_{sp} g_0}{F}$$

### 4.5 US Standard Atmosphere & Secular Drag Decay
- Piecewise exponential density model ($150\text{ km} - 1000\text{ km}$).
- Secular rate of semi-major axis decay:
  $$\frac{da}{dt} = - \frac{\rho(h) \sqrt{\mu a} \, C_D A}{m}$$
- Terminal destruction flagged when perigee drops below $120\text{ km}$.

---

## 5. Verification & Testing Log

**Test Runner:** `vitest run`  
**Execution Status:** ✅ **All 7 Test Suites Passing (31/31 Tests)**  

```
 ✓ tests/physics/atmosphere.test.js (3 tests)
 ✓ tests/physics/coordinates.test.js (4 tests)
 ✓ tests/physics/maneuvers.test.js (5 tests)
 ✓ tests/physics/shadow.test.js (5 tests)
 ✓ tests/physics/kepler.test.js (5 tests)
 ✓ tests/physics/groundStation.test.js (2 tests)
 ✓ tests/routes/api.test.js (7 tests)

Test Files  7 passed (7)
     Tests  31 passed (31)
```

### Verified Astrodynamic Benchmarks
- **ISS Orbit Benchmark**: Altitude 400 km yields period $T \approx 92.68\text{ min}$ and velocity $v \approx 7.67\text{ km/s}$.
- **Sun-Synchronous Precession**: 600 km retrograde orbit at $i = 97.79^\circ$ precesses at $\approx 0.9856^\circ/\text{day}$ ($360^\circ/\text{year}$).
- **Hohmann Transfer Benchmark**: 400 km $\to$ 800 km transfer matches analytical delta-v ($\Delta v_1 \approx 109.8\text{ m/s}, \Delta v_2 \approx 107.5\text{ m/s}$, total $\Delta v \approx 217.3\text{ m/s}$, duration $\approx 47\text{ min}$).
- **Bowring Geodesy Benchmark**: Full roundtrip closure over poles and equator with error $< 0.1\text{ m}$.
- **Svalbard Polar Pass Benchmark**: SSO/Polar orbits reliably achieve $\ge 10$ tracking passes per day with elevation up to $48^\circ+$.

---

## 6. Chronological Engineering & Debugging Log

### [2026-11-05] — Milestone 2: Core Orbital Physics Engine & REST Endpoints
- **Feature (Physics Modules)**:
  - Created `server/physics/constants.js` with WGS-84, gravitational, solar, and astronomical constants.
  - Created `server/physics/coordinates.js` implementing GMST rotation, ECI $\leftrightarrow$ ECEF, Bowring's geodetic algorithm, and topocentric SEZ frame.
  - Created `server/physics/kepler.js` with Newton-Raphson solver, $J_2$ secular drift, perifocal $\to$ ECI conversion, and orbit propagator.
  - Created `server/physics/shadow.js` with low-precision solar ephemeris, cylindrical shadow, and conical umbra/penumbra.
  - Created `server/physics/atmosphere.js` with piecewise US Standard Atmosphere density and orbital drag decay.
  - Created `server/physics/maneuvers.js` with Hohmann, plane change, combined, and deorbit burns with Tsiolkovsky propellant calculation.
  - Created `server/physics/groundStation.js` with line-of-sight elevation tracking, AOS/LOS windows, and data volume computation.
  - Created `server/data/groundStations.json` with 8 global tracking stations (SvalSat, Goldstone, Madrid, Canberra, Kourou, Singapore, TrollSat, Fairbanks).
- **Feature (REST API)**:
  - Created `server/routes/physics.js` exposing `/propagate`, `/maneuver`, `/link-budget`, and `/drag-decay`.
  - Created `server/routes/catalog.js` exposing `/components` and `/chassis`.
  - Created `server/server.js` configuring Express 5, mounting routes, and serving static files.
- **Feature (Testing)**:
  - Installed `vitest` as development dependency.
  - Configured `npm test` script in `package.json`.
  - Implemented 6 unit test suites and 1 full HTTP integration test suite (`tests/routes/api.test.js`).
- **Debugging & Bugfixes**:
  - *Express 5 Wildcard Routing Error*: In Express 5, `app.get('*', ...)` caused a `path-to-regexp` error (`Missing parameter name at index 1: *`). Fixed by replacing with `app.use((req, res, next) => { ... })` fallback middleware.
  - *Input Normalization*: Added flexible parameter parsing so endpoints transparently accept either human-friendly inputs (`altitudeKm`, `inclinationDeg`) or raw SI (`meters`, `radians`).
- **Git Commits**:
  - `a233985`: `feat(physics): implement core Keplerian mechanics, WGS-84 geodesy, maneuvers, and REST endpoints`
  - `c5d2a1a`: `feat: implement core orbital physics`

### [2026-11-03] — Milestone 1: Specifications & Components Schema
- **Feature (Specification)**:
  - Drafted comprehensive `SPEC.md` covering 8 core mission engineering constraints, 4 LEO orbital regimes (SSO, Polar, Equatorial, Mid-inclination), and 3 launch vehicle tiers.
  - Drafted `COMPONENTS_SPEC.md` defining the modular slot-unit/grid system, deterministic hardware rules, and Three.js Ghost Primitive wrapper architecture.
  - Implemented `server/data/components.json` with master catalog of Tier 1–3 satellite components.
- **Git Commits**:
  - `1d7be55`: `feat: add satellite components catalog and game specifications`
  - `4b71878`: `docs: define mission constraints, LEO regimes, and launch vehicle specifications`
  - `e29ed38`: `docs(spec): migrate frontend architecture from React.js to Vanilla JS with ES modules`
  - `3ad64ec`: `docs: add comprehensive project documentation to README`
  - `0305098`: `First commit`

---

## 7. Protocol for Future Updates

Whenever any developer or AI assistant makes changes to this repository, **`RECORDS.md` must be updated**:
1. **New Features**: Document the new file(s), function signatures, API endpoints, and design rationale.
2. **Refactors**: Document why a refactor occurred, what files were affected, and how backward compatibility is preserved.
3. **Bugfixes & Debugging**: Add an entry under *Chronological Engineering & Debugging Log* detailing the error symptom, root cause, and resolution.
4. **Verification**: Run `npm test` and update the test metrics in Section 5.

# 📜 PROJECT RECORDS & LIVING SOURCE OF TRUTH
## Project: Orbiterra — 3D Low Earth Orbit Satellite Design & Simulation Game
**Document:** `RECORDS.md`  
**Location:** Repository Root (`/RECORDS.md`)  
**Status:** Active Living Document (Updated with every feature, refactor, and debug)  
**Current Branch:** `implement-orbital-physics`  
**Last Synchronized:** 2026-11-06

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


### [2026-11-06] — Guided Assembly Preview & Reduced Interface Density
- **Feature / UX**: Added `client/js/hangar.js` and `client/css/hangar.css`. Mission requirements now lead to a guided assembly screen with a central local satellite illustration, contextual component choices, one next-step prompt, and four expandable design summaries. Technical descriptions remain inside Specifications disclosures.
- **Interaction**: Catalog-backed beginner component selection, chassis-family filtering, removal of incompatible components on chassis change, view options, confirmed reset, preliminary design review, and explicit blueprint saving. Session drafts survive returning to mission selection. Saved previews preserve agency, progress, credits, and existing blueprints; hardware purchases and flight readiness are not simulated.
- **Integration**: Updated `client/js/missions.js`, `client/index.html`, and `client/css/main.css`; documented the preview scope in `SPEC.md`. Full 3D mounting, physical slot occupancy, eclipse, thermal, pointing, downlink and launch remain unimplemented and are labeled in the UI.
- **Verification**: Browser checked mission → brief → assembly navigation, 6U chassis + Urban Imager selection, nominal 2.5 m GSD, 6.0 kg mass including default optics adjustment, -16 W sunlight deficit without solar, $310,000 hardware over-budget status, save/reload, design review, and removal of the incompatible camera on switching to 1U. Checked 986 px and 390 px viewports without horizontal overflow. Editor diagnostics and `git diff --check` passed.
- **Test limitation**: Attempted `npm test`; this environment has neither npm nor Node.js on PATH. Automated suite was not run; the prior 31-test result in Section 5 remains historical, not a validation of this change.

### [2026-11-06] — Assembly Studio Visual & Interaction Refinement
- **Design**: Refined `client/css/hangar.css` with a restrained charcoal, warm gold and sage palette, stronger typography, a gridded satellite stage with orbit rings, selected chassis caption, and quieter estimate cards. Added a mission target and a six-component selection progress indicator; flight validation remains separate.
- **Progressive disclosure**: Moved thermal/propulsion into “More subsystems” and engineering caveats into an estimate disclosure. On mobile, put component decisions before the satellite preview, remove the nested component-list scrollbar, and stack the review/save controls.
- **Component comparisons**: Show configured mass, capacity/generation/imaging benefits, installed badges, selected components first, and projected over-budget amounts before installation. Urban Mapping payload options now show optical instruments. Cost projections account for components removed by a chassis replacement; chassis changes explicitly report removed equipment.
- **Interaction fixes**: Preserve keyboard focus and open metric disclosures on updates; label assembly shortcuts as Edit/Choose according to selection; restore the first missing core subsystem on reopening; refresh session drafts after saving; disable saving/review when catalog loading fails.
- **Debug**: Browser navigation reproduced an existing negative HTMLMediaElement volume exception in `client/js/audio.js`: requestAnimationFrame's frame timestamp can precede a fade's mid-frame start. Clamp interpolation progress and assigned volume to [0, 1]. Repeated navigation after the fix produced no page errors.
- **Verification**: Browser checked component installation, selection progress, retained focus/open disclosures, saving and reopening without stale unsaved status, contextual resume, optical-only Urban payload choices, additional subsystems, review, reset cancellation and responsive widths at 1440 and 390 px without horizontal overflow. Editor diagnostics and `git diff --check` passed. `npm test` was attempted but npm/Node.js remain unavailable; no new automated suite result is claimed.

### [2026-11-06] — Interactive 3D Satellite & Component Previews
- **Feature**: Replaced the reused SVG assembly illustration with a local Three.js workbench in `client/js/three/hangarScene.js`. Installed parts render together; component cards and a preview toolbar support inspecting a single part before installing it. Preview does not mutate saved/installed selections or calculated cost.
- **Models**: Added `client/js/three/hangarModels.js` with catalog-dimension procedural models for all 91 parts across eight categories. Models distinguish chassis rails, cell-covered solar panels, optical payloads, batteries, antenna types, onboard boards, thermal surfaces, ADCS wheels/magnetorquers and thruster nozzles. Mesh metadata resolves raycast picks to catalog parts. Positions are illustrative, with physical slot validation still pending.
- **Controls / lifecycle**: Pointer rotation, pinch/wheel/button zoom, keyboard rotation/zoom/reset, transparent internal-component view, exploded assembly, wireframe and camera reset. One demand-rendered viewer serves all previews; old geometry/materials are disposed on replacement, the viewer pauses when hidden, and page exit disposes the renderer. WebGL initialization/context-loss messaging preserves non-3D component selection. `client/js/three/menuScene.js` pauses background rendering while the workbench is open.
- **Integration**: Updated `client/js/hangar.js`, `client/css/hangar.css`, `client/index.html` and `SPEC.md`. Existing blueprint persistence and engineering estimates remain in place; no model downloads or additional dependencies were added.
- **Verification**: Browser checked WebGL initialization without page errors; preview leaves selection count unchanged; installing from preview changes 4 to 5 selected components and returns to assembly; keyboard rotation produces different rendered pixels; zoom/reset, cutaway, explosion and wireframe controls execute; the 390 px layout has no horizontal overflow and a usable canvas. Catalog-wide browser validation checked 91 nonempty models, 2,085 pickable meshes, finite coordinates and exactly-once disposal of 2,377 used geometry/material resources.
- **Automated coverage**: Added `tests/client/hangarModels.test.js` for catalog-wide finite/pickable geometry and resource disposal. `npm test` was attempted but this environment still has no Node.js/npm executable; these new Vitest tests have not been run. Equivalent model/disposal assertions passed in the browser. Editor diagnostics and `git diff --check` passed.

### [2026-11-06] — Recognizable Satellite Silhouette & Connected Assembly
- **Visual correction**: The initial 3D workbench defaulted to a transparent chassis and arranged full-size catalog primitives around it, leaving the satellite looking like loose equipment. The default is now an opaque spacecraft with metallic rails, separate gold insulation panels, a front-facing camera aperture and internal hardware contained within its body.
- **Assembly**: Added `createAssemblyModel(parts, { exploded })` in `client/js/three/hangarModels.js`. Orient the chassis upright, visually fit internal battery/computer/ADCS and payload hardware, and attach deployable solar wings symmetrically with arms/hinges. Split the existing array's visual width across two halves; catalog power, area, mass, cost and selected component count are unchanged. Body-mounted panels stay body-mounted. Exploded inspection remains optional.
- **Presentation**: `client/js/three/hangarScene.js` defaults cutaway off, keeps structural rails solid during cutaway, reduces washed-out lighting, and fits projected bounding-box corners for a larger model with a clearer front view. `client/js/hangar.js` leaves the internal-component checkbox unchecked by default.
- **Verification**: Visually inspected rendered canvas images before/after framing, with opaque body, connected blue wings and camera lens. Browser checks passed for default opaque view, symmetric paired wings, contained battery geometry, exploded separation, no catalog mutation, exactly-once assembly resource disposal, and finite bounds for all 91 isolated component models. Expanded `tests/client/hangarModels.test.js` with wing symmetry/area and internal-versus-exploded placement regressions. `npm test` was attempted but npm is unavailable; browser equivalents passed. Editor diagnostics and `git diff --check` passed.

### [2026-11-06] — Attachment Continuity Audit & Mount Fixes
- **Bug / root cause**: The left deployable wing reused the right wing's hinge edge, thin central support arms were hard to see, and nominal offsets left visible gaps beneath some surface-mounted equipment. Repositioned each wing's hinge to its inner edge and added thicker, overlapping support arms and hinge barrels.
- **Other component fixes**: Seat communications equipment using its actual rendered base bounds on a visible pedestal. Add continuous brackets for body-mounted solar, side-mounted thermal panels and propulsion. Move thermal panels to a side face to avoid sharing the rear face with body-mounted solar. Keep payload hardware overlapping the hull and avionics contained internally.
- **Inspection clarity**: Exploded assembly now displays an explicit separation notice and a “Reattach parts” control, which clears exploded mode and restores the connected assembly. Isolated part preview remains separate from installation.
- **Verification**: Browser-side geometry audit generated all 287 chassis-compatible component pair layouts; exterior components have a support bracket whose bounds intersect both the rendered hull and the component. Additional checks covered 149 compatible payload/internal hardware layouts: payload bounds overlap the hull and internal hardware bounds remain contained. Added a catalog-wide exterior attachment regression to `tests/client/hangarModels.test.js`.
- **Validation limits**: Editor diagnostics and `git diff --check` passed. `npm test` could not run because npm/Node.js are unavailable. The final rendered UI check was blocked by the browser reporting “Web page caused context loss and was blocked,” including after reload; geometry checks completed successfully before this renderer failure. No fresh visual render or exploded-button interaction pass is claimed for this change.

### [2026-11-06] — Four-Stage Workshop Layout
- **Layout**: Reworked `client/js/hangar.js` and `client/css/hangar.css` into a large left 3D workbench and a right component library. Replaced the large introductory title, eight-category grid and separate telemetry column with a compact header, four-stage navigation, contextual subsystem buttons and a bottom Mass/Power/Budget bar. Specifications, estimate details, view options and installed components remain expandable.
- **Navigation**: Stages are Chassis, Payload, Power (solar/battery) and Systems (communications/computer plus optional thermal/propulsion). Header steps allow direct navigation; the primary bottom action advances within/to the next stage after its core selections or opens design review at the end. Selection completion is not flight certification. Saving and early review remain secondary header actions.
- **Installed parts**: Added an installed-components disclosure with per-part Change and Remove controls. Centralized installation/removal so chassis compatibility cleanup and calculations remain consistent across component cards and the installed list. Preview and installation remain distinct.
- **Responsive / accessibility**: Desktop uses a viewport-fitting workbench with independent component scrolling and a non-overlapping footer. Mobile stacks a compact 3D preview above the choices with a sticky Continue area. Stage controls expose the current step; rerenders preserve focus and expandable estimates. Scoped navigation sizing/styles to prevent inherited menu width and margins from shrinking the stage bar.
- **Verification**: Browser checked Chassis → Payload → Power → Systems, Solar/Battery subnavigation, installing the two remaining core systems, final review, installed list Change/Remove behavior, required-part removal returning Continue to the missing subsystem, and save/reload with original four-part blueprint restored. Part preview, return to assembly, exploded/Reattach and budget disclosure passed. At 390 px there is no horizontal overflow; at 1280 × 800 the 3D stage ends above the footer. Browser reported no page errors and rendered the 3D assembly; visual screenshots were inspected. Updated `SPEC.md`; editor diagnostics and `git diff --check` passed. `npm test` was attempted but npm/Node.js are still unavailable.

### [2026-11-06] — Workbench Clipping & Internal Scroll Fix
- **Reproduced**: At 1280 × 800, the workbench had 560 px of scrollable content inside a 424 px panel; scrolling moved the viewer 136 px upward. The absolute decorative orbit ring extended beyond the panel and created scroll overflow, allowing the satellite and heading to disappear above the controls while empty decoration remained visible.
- **Fix**: `client/css/hangar.css` now uses named grid rows for heading, preview, canvas, camera controls, caption and bottom tools. The canvas is absolutely contained inside its allocated viewer row, the stage uses non-scrollable clipping, and the orbit decoration stays within the stage bounds. Only the component library scrolls independently on desktop.
- **View options**: Wrapped inspection controls in a positioned popover in `client/js/hangar.js`. Opening it no longer consumes viewer height or pushes the model away. Added outside-click and Escape dismissal, while leaving modal-dialog Escape behavior intact.
- **Verification**: Browser checks passed at 1920 × 1080, 1440 × 900, 1366 × 768, 1280 × 600 and 390 × 844. Forced stage scrolling remains at zero; canvas and camera controls stay within stage bounds; no horizontal overflow. At 1440 × 900, opening View options leaves the 345 px viewer height unchanged; its popover remains within the panel. Escape/outside dismissal, isolated preview/return, wheel zoom and rendered pixels passed without page errors. Inspected a fresh browser screenshot. Editor diagnostics and `git diff --check` passed; `npm test` was attempted but npm/Node.js remain unavailable.

### [2026-11-06] — Camera Continuity & Workshop Feedback
- **Camera stability**: `client/js/three/hangarScene.js` now retains rotation and normalized zoom, with independent view memories for assembly and each isolated component preview. Resizing refits to the viewport while preserving zoom preference; geometry changes keep the assembly centered on its chassis. Unchanged component selections no longer dispose/rebuild geometry just because the user switches categories. Cutaway/wireframe restyle the existing model; Reset View explicitly restores the default view.
- **Installation feedback**: Added a brief 200 ms part fade/highlight rendered only during the effect, with material properties restored afterward. Effects cancel safely on replacement, inspection changes, hiding, reduced-motion changes and disposal. `client/js/hangar.js` adds an accessible temporary install/remove confirmation and returns newly installed cards to the top of the list.
- **Layout polish**: Added a persistent Assembly / Part preview / Exploded view badge. Selected cards have a clearer installed badge and accent, while Remove is visually quieter. Increased small descriptive text and used 160–180 ms opacity/color transitions without moving the workbench. Motion preference changes cancel UI effects; reduced-motion installations keep textual confirmation without animation.
- **Verification**: Browser checked category switching without changing rendered assembly pixels, independent preview rotation/zoom and restoration of the assembly image, and resize-away/back preserving the rendered view. External solar installation visibly changes rendered pixels during highlight, then settles; confirmation names the installed part. Installed card moves first. Normal UI animations report 160–180 ms durations; reduced-motion installation reports zero active UI animations and still shows confirmation. The 390 px layout has no horizontal overflow or internal workbench scrolling. Test replacements were restored to the original four-part blueprint. No page errors were reported. Editor diagnostics and `git diff --check` passed. `npm test` was attempted but npm/Node.js remain unavailable; automated suites were not run.

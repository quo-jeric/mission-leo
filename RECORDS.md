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

### [2026-11-06] — Urban Mission Configuration & Physics Preflight
- Added mission parameters, a pure engineering evaluator, responsive mission planning dialog and workshop integration. Review design now explains failures with direct component-edit navigation, provides an explicit optional starter-build action, and separates hardware, launch and available budget. Orbit/camera settings persist with blueprints and session drafts.
- Added a $400,000 Urban planning allowance because the original $250,000 agency funds could not fund the required camera, chassis, support systems and launch. Credits are neither granted nor spent. Tutorial rideshare is fixed at 500 km/97.4°; dedicated services support custom orbits at full specified prices.
- Screening covers 24 checks including primary/secondary slots, mass, supported optics, pointing control, OBC/storage, S-band, orbital energy, worst-case eclipse reserve/discharge and thermal capacity. Assumptions and incomplete timed physics are disclosed. Workshop estimates now include configured optics, orbital energy and launch cost.
- Connected existing physics APIs for one orbit and 24-hour Singapore station prediction at a reproducible epoch. Validated plans save only after engineering and backend contact capacity pass; changing settings invalidates the verification. Saved plans bind to parts/settings/funds and are removed when a changed blueprint is saved. Existing credits/progress are preserved; no mission is launched or completed.
- Verification: starter passed all 24 checks with 8.85 kg wet mass, 2.5 m GSD, 48 MB image, $565,750 total against $650,000 available. Backend returned 94.6 min orbit, 2 passes and 525 MB daily capacity. Browser verified validated-plan save, unchanged player/progress, settings reload, and focal-length changes disabling Save and clearing proof. Original saved data restored after persistence tests. Browser assertions passed for inadequate pointing/OBC/solar/cooling/optics, fixed-orbit constraints, dedicated-launch budget, secondary-slot overflow, invalid inputs, canonical input signatures and input immutability. Added corresponding Vitest regressions.
- Validation limitation: npm test was attempted but npm/Node.js are unavailable in this environment; Vitest suite could not run. Browser module assertions and backend/UI checks provide the executed validation. Editor diagnostics and git diff --check passed.

### [2026-11-06] — Urban 3D Orbital Gameplay
- Added a dedicated responsive orbital operations screen, pure flight/resource engine and Three.js Earth/orbit scene using the existing local atlas and assembled hardware. Added time controls, pause, next-opportunity advancement, telemetry, target capture, armed downlink and save/resume. Desktop keeps time controls outside the scrolling telemetry; mobile stacks the globe and controls. Review is now accessible in the mobile workshop header.
- Connected seven-day 10-second J2 trajectories and sampled Singapore station passes to geometric target access and solar illumination. Capture requires daylight, horizon/30-degree slew limits and ≤3 m oblique GSD. Exposure energy is a disclosed two-second approximation. Resources integrate in ≤1-second steps through ordinary playback and timeline jumps; transmission only occurs during contact. Temperature integration, clouds and slew dynamics remain explicitly unsupported.
- Launch charges hardware plus service less a one-time Urban allowance, saves a ledger atomically with the flight and binds launch to current funds and saved-plan inputs. Resume never charges again and uses the launched plan snapshot. Only one Urban flight is supported. Full delivery completes Urban and unlocks the next mission; mission cards now refresh on save events. No reward or automatic contract completion on launch/capture alone.
- Executed full UI flow in isolated browser contexts, preserving the user's active save: starter → preflight → saved plan → launch → advance → capture → enable downlink → advance → full delivery → save/return → resume. Verified $165,750 charged, $84,250 remaining, 48 MB delivered, Urban completion and no second resume charge. The backend trajectory provides a daylight imaging opportunity at 2.85 m GSD. Mobile 390 px has no horizontal overflow. Inspected a rendered globe screenshot and checked viewport geometry.
- Browser engine assertions passed for daylight/night/eclipse/GSD gates, one-time capture, exact contact-boundary throughput, no out-of-contact data, battery reserve exhaustion during large jumps, complete delivery stopping time and transmission disabled on resume. Added Vitest regressions for these cases. Editor diagnostics and git diff --check passed; npm test was attempted but cannot run because npm/Node.js are unavailable.
- Final checks: the isolated browser run also confirmed Agricultural Monitoring displays AVAILABLE immediately after completion, the mobile Review entry remains visible, desktop time controls fit within 900 px height, and no page errors occur. Remaining support is included in input signatures and removed from planning availability after use; launch/completion counters increment once. Latest browser checks preserved the user's active tab and storage.

### [2026-11-06] — Follow the Launched Satellite
- Added default Follow satellite close-up and Earth overview toggle to orbital operations. Camera follows propagated position using the satellite attitude frame, with independent rotation/zoom memories, aspect-aware framing, per-mode reset and an Earth-surface camera guard. Hide the overview marker in close-up so it no longer covers the assembled satellite.
- Kept the procedural satellite built from the immutable launched plan, including its selected chassis, payload, solar wings and supporting parts. Added an expandable Launched components list. Inspection fill improves hardware visibility in eclipse without changing simulated sunlight or power.
- Placed camera modes above the globe for desktop/mobile access, exposed pressed states, and disabled controls if graphics cannot initialize. Reduced the globe grid's minimum row constraint to keep the viewer and controls inside short desktop layouts.
- Verification in an isolated browser context: default follow, overview switch, return to follow, advance to an imaging window while following, all eight launched part names, and capture/downlink/full mission completion passed. At 390 px there is no horizontal overflow and mode controls are visible. No page errors; inspected a close-up screenshot. Editor diagnostics and git diff --check passed. npm test was attempted but npm remains unavailable. The user's shared tab/save were not modified by these tests.

### [2026-11-06] — Disabled Play Explanation & Free Practice Replay
- The playback renderer disables Play whenever the saved flight is complete, power-lost or outside its timeline. Added a visible explanation beside controls, terminal button labels and a free practice replay action instead of leaving an unexplained disabled Play button.
- Replay initializes the same launched build at the original epoch in a separate orbitalPractice save. Practice checkpoint/completion cannot overwrite campaign flight, funds, support usage, progress or counters. Mission review explicitly labels practice resume. Active playback guards terminal state and speed is disabled for stopped flights.
- Editor diagnostics and git diff --check passed. Isolated browser verification was started but interrupted before its result was collected. Final browser retry could not reach localhost:3000 (browser error page), so end-to-end replay verification remains unconfirmed. Node/npm are unavailable in the execution environment. Existing user save data was not reset.

### [2026-11-06] — Mission Results & Recovery Actions
- Added a prominent in-scene result panel for Mission Complete, Mission Failed and Time Expired, with resolution, delivered image volume, remaining battery, elapsed time and outcome-specific guidance. The launched satellite stays visible. New results focus their heading once; replay hides the panel and returns focus to enabled Play.
- Added free Replay/Retry, Workshop/Improve build and campaign-gated Next mission controls. Next mission opens Agricultural Monitoring's briefing selection. Free practice remains separate from campaign funds, support, counters and progress. Terminal playback checkpoints now happen before result rendering so completion unlocks are immediately available.
- Executed all three terminal states in isolated browser contexts. Verified correct titles and Next mission gating; free retry enables Play, advances the clock and completes capture/downlink; credits stay $84,250, launch/completion counters and original campaign status stay unchanged. Successful campaign/practice replay navigated to Agricultural Monitoring. Practice completion after a failed campaign did not unlock progression. All three 390 px layouts had no horizontal overflow. This also completes the previously interrupted replay browser verification.
- Editor diagnostics and git diff --check passed. npm test was attempted; npm is unavailable, so the automated suite was not run. User save data was not modified by verification.

### [2026-11-06] — Manual Aiming & Capture Challenge
- Added tactical instrument aiming map, target/crosshair, east/north sliders, keyboard/tap controls and optional Auto-point assist, separate from the 3D camera. Show alignment error, tolerance, sampled window countdown and capture quality. Fast playback pauses at an incoming imaging window and returns to 1×.
- Engine now computes target angular bearing and rejects captures unless manually/automatically aligned within the available swath margin. Rejected attempts leave battery unchanged. Persist aim settings and captured error/mode/quality; clamp manual commands to a radial 30° envelope. Assisted aiming cannot bypass daylight, eclipse or resolution constraints. Result panel shows scored manual/assisted captures.
- Verification: local server was unavailable, so tested the actual source modules and UI in an isolated browser context with deterministic stubbed trajectory/contact responses and graphics fallback. Verified misalignment blocking without battery cost, manual alignment/capture, assist alignment, eclipse rejection, slider-based UI capture and full 48 MB downlink completion. Manual UI capture scored 91/100. Mobile 390 px had no horizontal overflow. Added Vitest cases for alignment, assist gates, invalid controls, clamping and resume.
- Editor diagnostics and git diff --check passed. npm test was attempted but npm is unavailable. No live-backend or fresh 3D-render validation is claimed for this change; user save data was not modified.

### [2026-11-06] — Target Camera & Frozen Image Reveal
- Added a default Target camera mode with code-generated illustrative terrain, target outline, sensor square and boresight. Its framing follows instrument aim independently from the existing 3D viewing camera. Pointer and keyboard input adjust the instrument; mode-specific instructions explain the controls. Follow/overview remain available, and the 2D instrument view works without WebGL.
- Added image reveal with captured resolution, quality and manual/assisted label. Capture saves small versioned framing metadata; the preview regenerates the exact same terrain crop after save/resume and does not move with live telemetry. Legacy images disclose missing preview metadata. Replay resets the reveal. No photographs, external map assets or generated image service are used; live and captured terrain are labelled simulated.
- Executed actual source modules/UI in an isolated browser context with stubbed deterministic trajectory/contact data because localhost was unavailable. Confirmed Target camera selected by default, arrow aiming changes live canvas pixels, capture stores a centered 15 km field, the preview stays identical through downlink, and the same preview is restored on resume. Metadata showed 2.50 m GSD, 100/100 assisted capture. The 390 px layout had no horizontal overflow. Added framing formula tests. No live-backend or fresh WebGL validation is claimed.
- Editor diagnostics and git diff --check passed. User save data was not modified. Automated suite remains unavailable because npm/Node.js are absent in this environment.

### [2026-11-06] — Blank Target Camera Guidance
- The screenshot showed a nearly empty target-camera field before target access. The finite terrain patch could also be outside the sensor frame even during a valid pass because manual aim was far from the target. Replaced the unexplained field with contextual waiting/off-frame guidance and Go to imaging window / Bring target into view actions.
- Default to Follow satellite while traveling when graphics are available. Opportunity advancement retains battery/time integration; bringing the target into view stages a nearby manual aim with a deliberate offset, leaving fine alignment to the player. Terminal states and absent opportunities disable the waiting action. Existing capture/reveal gates remain unchanged.
- Editor diagnostics and git diff --check passed. The prior isolated browser fixture was unavailable in this turn, so the new waiting/off-frame actions have not yet received end-to-end browser verification. User saves were not modified.

### [2026-11-06] — Simplified Three-Action Mission Flow
- Consolidated default flight UI into Find target, Capture image and Send image using one contextual primary button. Keep only stage progress, battery and one instruction prominent, with image reveal/results when applicable. Move existing telemetry, aiming sliders, camera modes, time/speed, installed parts and model notes into a collapsed Advanced disclosure. Retained manual controls and existing save IDs.
- New/replayed flights default to Auto-point; saved manual settings persist. Find target uses existing opportunity prediction; Send image walks contact windows through the engine until complete/stopped/no further contact, preserving all battery and contact gates. No credits or launch accounting changes. Missing future opportunities surface a review message.
- Executed the actual modules/UI in an isolated browser with deterministic stubbed trajectory/contact data: primary labels progressed Find target → Capture image → Send image → Mission Complete; 48 MB delivered and credits stayed $84,250. Advanced/speed were hidden initially, capture reveal appeared, free replay restored Find target, and manual controls remained available in Advanced. At 390 px there was no horizontal overflow. Adjusted manual-aim regression setup to explicitly select manual mode.
- Editor diagnostics and git diff --check passed. This validation used graphics fallback and fixed test data, not a live backend/WebGL run. Automated suite remains unavailable because npm/Node.js are absent. User saves were not modified by tests.

### [2026-11-06] — Restore Previous Orbital Layout
- At user request, reverted the latest three-action simplification. Telemetry, aiming, camera modes and time controls are visible again in their earlier locations; removed the contextual primary action and Advanced wrapper. Restored manual aiming as the default for new flights and adjusted its test fixture accordingly. Existing saved aim preferences, spacecraft, campaign progress, image reveal, result panel and earlier camera guidance remain intact.
- Updated the current specification to remove the simplified flow. Editor diagnostics and git diff --check used for validation; no browser interaction or user save changes were needed for this restoration.

### [2026-11-06] — Earth Overview Pass Planner
- Added clickable gold target and cyan station ring, accessible destination buttons and a contextual overview planner with next-pass countdown, active-window duration and remaining S-band capacity. Singapore markers use the actual co-located target/station coordinates; selection centers the view. Dragging does not select markers and Earth occludes back-side picks.
- Exposed pure opportunity queries from the engine using its existing imaging windows and station intervals. Explicit advance integrates battery/contact operations, checkpoints the result and opens target camera for imaging access. It never captures automatically or enables transmission. Disabled invalid/terminal advances. Added a contact arc and simulated-time transmission pulse consistent with the specification's station-pass visualization.
- Live backend/WebGL verification in an isolated browser profile passed: target countdown 26:02:30, advance opened Target camera with no image auto-captured; station showed 156.3 MB remaining capacity and 4:10 remaining active contact; radio stayed disabled. Globe center pick selected the target, mobile 390 px had no horizontal overflow, and no page errors occurred. User save data was unchanged. Added opportunity-query boundary/immutability regression tests.
- Editor diagnostics and git diff --check passed. Full automated suite remains unavailable because npm/Node.js are absent. Documented remaining ground-track/coverage-cone/high-resolution Earth work instead of claiming the entire orbital visualization specification is complete.

### [2026-11-06] — Target Capture Readiness & Shutter Feedback
- Added green sensor frame/boresight, a persistent framing instruction and accessible Ready to capture/status label. Centralized readiness in the flight engine so visual state and capture-button availability include existing window/alignment/terminal/exposure-energy checks. Queries do not consume power or change flight state.
- Added a single low-opacity 180 ms shutter fade after successful explicit capture only. It is canceled on view changes, disposal and reduced-motion changes; reduced-motion capture retains text without animation. Captured-image reconstruction remains HUD/effect-free.
- Executed live-backend browser checks in an isolated profile using the 2D instrument fallback because WebGL was disabled: rejected capture had no flash, aligned assist showed Ready to capture, success created one 180 ms animation, reduced-motion capture created zero animations and announced Image captured. Mobile 390 px had no horizontal overflow. Added battery/readiness regression tests. User save data was not changed.
- Editor diagnostics and git diff --check passed. Automated Vitest execution remains unavailable because npm/Node.js are absent in the command environment.

### [2026-11-06] — Completion “Try Again?” Prompt
- Added Mission complete / Practice mission complete modal asking Do you want to try again? Yes starts the existing free practice replay; No keeps results. The prompt shows only once per completed flight ID in the current page session. Escape dismisses without restarting; default focus is on viewing results.
- Clarified captured-but-undelivered status: image capture alone is not mission completion. Show Enable downlink / press Play guidance instead of stale orbit-established messaging on resumed captured flights.
- Live-backend browser verification in an isolated profile passed: completed save shows prompt, No preserves results, capture alone does not prompt, full delivery prompts, and Yes restarts a fresh practice flight. Credits remained $84,250 and campaign/counters stayed unchanged. Editor diagnostics and git diff --check passed. User save data was not changed.

### [2026-11-06] — Rename Practice to Mission Replay
- Replaced player-facing Practice labels in orbital operations and preflight resume with Mission Replay, including completion dialog, result headings, status and retry messages. Preserved storage keys, flight IDs, saved progress and existing free-replay behavior; no save migration or accounting changes.
- Verified remaining practice references are internal variables/save keys/IDs. Editor diagnostics and git diff --check passed. This wording-only change did not require new tests or user save interaction.

### [2026-11-06] — Downlink Controls & Delivery Accuracy
- Replaced the ambiguous Enable downlink toggle with Send image to Earth that starts playback as well as arming the radio. Added transfer card with MB/percent progress, waiting/transmitting/paused/received states, rate/contact duration and a Go to next station pass action. Pause/Resume preserve partial delivery; resume labels remain clear after disarming or reopening a partially delivered flight.
- Kept the existing explicit-contact and power constraints: station jumps integrate resources, never enable a disarmed radio and transmit only when armed. Centralized playback startup for footer and transfer buttons. Updated captured-image guidance to the new label and refresh transfer status when the document pauses on hide.
- Corrected integration to split fractional AOS/LOS boundaries and stop exactly when all remaining bytes are delivered. Added boundary/remaining-data regression tests. Executed browser engine assertions: 1 s contact at 5 Mbps delivered exactly 0.625 MB, no out-of-contact data, and 48 MB completed in 76.8 s.
- Live-backend isolated UI test verified waiting → station jump → transmitting → positive progress → pause/resume → 48 MB COMPLETE and completion prompt, with no horizontal overflow at 390 px. A second deterministic UI check verified Resume transfer and saved-progress wording on a partial image. Editor diagnostics and git diff --check passed. User save data was not modified. Automated Vitest remains unavailable because npm/Node.js are absent in the command environment.

### [2026-11-06] — Final Preflight & Mission Results Design Polish
- Fixed shared-CSS specificity that constrained preflight to 560 px and inherited label margins/alignment that stretched the form. Added a scoped 860 px dialog, sticky heading/close, compact three-column desktop/two-column tablet/one-column mobile fields, full-width controls and clearer cost/section treatment. Kept existing field values, engineering checks and actions.
- Refined orbital header, view toggles, results hierarchy, sidebar spacing/scrollbar and playback dock. New results reset the sidebar to the top; completed flights hide disabled playback controls. Replays restore controls. Main target view now shows its saved captured frame after capture, with delivered/completion messaging instead of blank live terrain and obsolete aiming instructions. Legacy captures disclose unavailable preview. Frozen image data and physics remain unchanged.
- Browser verification in an isolated profile using live backend and 2D fallback: preflight width 860 px, controls exactly matched label widths, label margins zero, label height 68 px; no dialog overflow at desktop or 390 px (362 px dialog). Completed result was visible at sidebar scroll zero, disabled playback dock hidden, image feedback said Image delivered / saved framing, and replay restored Play. No page errors or mobile horizontal overflow. Inspected a fresh preflight screenshot.
- Editor diagnostics and git diff --check passed. Automated suite was not run because npm/Node.js are unavailable. User save data was not modified by these checks.

### [2026-11-06] — Preflight Station Preview
- Added an illustrative SVG ground antenna preview within Verify orbit & station access, with Singapore CRISP identity, coordinates, S-band/elevation requirements and selected-radio compatibility. Updated technical backend wording to a user-facing explanation of orbit/contact prediction.
- Preview starts with unchecked statistics. Existing verification fills pass count, total contact duration, capacity and up to four UTC pass windows from backend results. Saved proof retains compact pass summaries; changed settings invalidate statistics and schedule using the existing input signature. No new physics service, image assets or launch behavior.
- Browser validation in an isolated profile checked unchecked/verified preview, live predicted passes and stale-data clearing after focal-length changes. Mobile dialog overflow and editor diagnostics were checked. User save data was not modified. Automated suite remains unavailable because npm/Node.js are absent.

### [2026-11-06] — Completion to Next-Level Flow
- Centralized unlock checks and validated completion bookkeeping in progression.js. Capture/partial delivery cannot unlock a mission. A first successful replay after a failed campaign flight now records the contract completion and unlocks the next level; repeated completions never duplicate counts or funds and preserve the original flight record. Valid completed saves repair missing progression on resume.
- Added a named Next mission action to the completion popup, alongside retry/results. Both popup and result actions open the actual next requirements briefing instead of just selecting a card; selection persists. Mission 2 briefing now clearly identifies its planning/workshop-only status and uses Open workshop preview, avoiding an implied playable 120-day simulator.
- Asked whether full Mission 2 gameplay was in scope; no reply arrived during implementation, so this change follows the proposed progression-to-briefing scope. Full Mission 2 orbital operations remain unimplemented and are explicitly disclosed.
- Executed live-backend UI test in an isolated mobile profile: capture alone kept completion false; full delivery in a replay unlocked Agricultural Monitoring, counted one completion, preserved $84,250 credits and the failed original campaign flight. Popup Next opened the Agricultural Monitoring brief and its workshop with no page errors. Browser module checks verified ordered unlocks, unknown mission rejection, partial delivery rejection, idempotency and preserved finances. Added corresponding Vitest tests.
- Editor diagnostics and git diff --check passed. Automated suite cannot run because npm/Node.js are absent. User profile/save was not modified by the tests.

### [2026-11-06] — Playable Agricultural Season
- Followed the accepted recommendation to make Mission 2 playable after Urban progression. Added a separate 120-day scheduling screen, six farming regions and 36 deadline-bound requests. Players choose up to three daily observation priorities, arm station downlink, run one/seven days, review captured/queued/delivered requests, pause, resume and retry for free. Delivered priority weight, rather than captures, determines the end-of-season result and next-level unlock.
- Generalized engineering screening to Agriculture while preserving Urban starter validation: 500–700 km, 80 kg, 40 W average; RGB/multispectral tier 1–2 options, S/X-band station choices, catalog optics, thermal/slot/pointing/storage/battery screens and configurable delivery share. Explicitly documented concrete game choices (six centers, 20-day windows, 30 m imagery, 100 W peak, $800,000 one-time support).
- Uses existing live J2, sunlight/eclipse and ground-contact APIs, daily 30 s samples and ≤1 s resource/downlink integration with contact boundaries. Daily commands are transactional and persisted, with reserve failure, request expiry, buffer release, finite throughput, abort-on-hide and recoverable prediction/save failure. Launch validates before atomically charging and saving; immutable agricultureFlight resumes without another charge. Retry preserves prior completion and funds. Disaster remains a briefing/workshop preview.
- Executed the complete 120-day season against the live backend in an isolated browser profile: all 36 requests delivered, weighted share 100%, minimum starter battery 45.80 Wh, final status COMPLETE on day 120; completion counter increased once, credits preserved at $84,250, Disaster unlocked. This run rotated priorities after each observation and used actual predicted geometry/contact, with no invented capture windows.
- Executed a 390 px UI flow in an isolated profile: Agriculture brief → workshop → review → RGB starter → launch → run day → save/return → resume. Day 1 persisted, launches counted once (total 2), credits stayed $84,250, no early completion, no horizontal overflow or page errors. Saved-season review now explains original charge/build rather than showing irrelevant replacement-build budget failures.
- Added focused seasonal engine/validation/progression tests for capture versus delivery, expiry, reserve stop, bad predictions, day-120 completion, failed goals and idempotent unlocks. npm test cannot run because npm/Node.js are absent in the tool shell; browser checks provide executed validation. Editor diagnostics and diff whitespace checks are also run. Active user save data was not modified.
- Additional browser checks exercised buffered captures without contact, contact throughput, immutability, deadline expiry, reserve failure, missed goals, rejection of early/single-image seasonal completion, and the terminal UI. Day-120 result focused its heading and counted completion once; the Disaster brief retained its explicit preview notice. Free retry reset to day 0/ACTIVE, hid the result, retained the existing completion and preserved $84,250 credits and both counters. Final editor diagnostics and git diff --check passed.

### [2026-11-06] — Agency Profile Initialization and Partial-Save Recovery
- Investigated the user's zero profile: their saved record contained selectedMission=agriculture and a user-confirmed Urban completion, but no player, balance, flight history or blueprints. The Play route bypassed agency creation while the profile defaulted every missing statistic to zero.
- Added shared default agency creation and non-destructive save normalization. Play now persists an agency before entering mission selection; existing partial saves are repaired at startup and future writes retain a complete schema. Existing balances (including zero), historical counters, unlocks, builds and financial/flight ledgers are preserved. Completed-contract counts include persisted mission completions; launches derive only from actual saved campaign plans, excluding practice.
- Missing credit history uses the existing $250,000 starting allowance, with an explicit recovery notice explaining that past charges cannot be reconstructed. No missing flights, builds, reputation or deorbits are fabricated. Profile refreshes while open after progress writes or cross-tab updates. Added focused tests for defaults, the exact partial-save shape, idempotency, preserved zero balances/history, and practice exclusion.
- Executed seven browser assertions plus an isolated 390 px UI test: the exact partial save recovered its default agency, one completed contract and disclosed starting allowance while retaining the original Urban completion and Agriculture selection. A live profile update preserved a real zero balance and launch counter; fresh Play persisted a complete default agency. No page errors or profile horizontal overflow. Updated stale quick-guide/setup copy to describe the implemented missions and automatic agency creation.

### [2026-11-06] — Compact 1920 × 1080 Landing Layout
- Reduced desktop wordmark/menu sizing and tied it to viewport height with bounded sizes. Aligned description, navigation, continued-game summary and caption to the same left edge; capped summary at two lines. Reduced satellite footprint through its existing DOM anchor, which also drives the Three.js landing model. Mobile styling and operational screens retain their layouts; scrolling is not globally disabled.
- Measured an isolated continued-game profile at 1920 × 1080, 1920 × 950, 1536 × 730, 1366 × 768, 956 × 686 and 390 × 844. Every document matched its viewport without horizontal/vertical overflow; all landing actions/captions and Credits remained in view. At the primary size, the menu is 340 px wide and the wordmark is approximately 463 px wide. Browser GPU was unavailable, so model framing is verified through its shared DOM anchor rather than claiming a WebGL render check.

### [2026-11-06] — Larger Landing Menu and Fullscreen Entry
- Increased desktop logo sizing by roughly 14% and menu width to 300–360 px with larger 48–66 px controls (short-height layouts retain compact controls). Added a visible Enter fullscreen action below the menu with For a better experience guidance, sharing the existing Settings fullscreen handler. Both controls synchronize entry/exit text and pressed state, including Escape/browser exit. Unsupported environments hide the landing action; rejected requests show readable feedback without blocking play.
- Browser checks at 1920 × 1080, 1536 × 730, 1366 × 768, 956 × 686 and 390 × 844 found no document overflow. Added extra footer clearance for 701–780 px desktop heights. Verified actual fullscreen entry and exit in an isolated browser context, synchronized button labels and Esc guidance. Editor diagnostics and diff whitespace checks passed; player progress is unchanged.

### [2026-11-06] — Fullscreen Icon Beside Audio
- Moved the landing fullscreen action out of the menu stack to the upper-right, 10 px beside the existing audio control. Both use 44 × 44 px targets. Fullscreen is an icon button with synchronized accessible name/native tooltip and hover/focus guidance; rejection feedback remains visible. It hides during mission selection to avoid overlapping mission navigation. Existing Settings fullscreen behavior is retained.
- Checked desktop/mobile alignment, overflow and actual fullscreen entry/exit in an isolated browser profile. No player save changes; editor diagnostics and diff whitespace checks were run.

### [2026-11-06] — Optional First-Play Fullscreen Prompt
- Added a once-per-device first Play/Continue prompt offering Enter fullscreen and Continue normally. Continue normally receives initial focus; Escape also continues. Choice is stored in menu preferences, independent of campaign data, with session fallback if storage is unavailable. Already-fullscreen and unsupported browsers go directly to mission selection. Fullscreen requires the explicit Enter action; rejection still proceeds normally. Existing mission guide opens only after this prompt closes, avoiding stacked dialogs. The upper-right icon and Settings toggle remain available.
- Browser-tested normal continuation, actual fullscreen entry, rejected requests, unsupported browsers and mobile Escape continuation. Mission selection remained reachable, only the quick guide remained open after the prompt, and normal continuation was remembered after reload. No page errors were observed. Added explicit Escape key handling alongside native dialog cancellation. Editor diagnostics and git diff --check passed; campaign saves were not altered by tests.

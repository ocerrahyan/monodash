# Engine Monitor Dashboard

## Overview
A minimalist, text-only dashboard that simulates a 2000 Honda Civic Si (B16A2) engine in real-time. Pure black screen with white monospace numbers. Designed for iPhone viewing. Includes quarter-mile drag simulation with ~68 live parameters and a fully programmable ECU tuning page.

## Architecture
- Frontend engine simulation runs client-side via `requestAnimationFrame`
- Backend (Express) handles live player presence via heartbeat API + PostgreSQL
- ~68 parameters update in real-time based on physics model
- Scrollable gauge area with fixed bottom controls (throttle + launch button)
- Shared singleton simulation instance between Dashboard and ECU pages
- ECU config changes apply in real-time to the simulation
- ECU presets stored in localStorage (per-device)
- Live player count tracked via session heartbeats in PostgreSQL

## Key Files
- `client/src/pages/dashboard.tsx` - Scrollable dashboard UI with sectioned gauge grid, sound toggle, live player count, and fixed bottom controls
- `client/src/lib/engineSound.ts` - Web Audio API engine sound synthesis (multi-oscillator, VTEC crossover, rev limiter, decel pops, anti-lag bangs)
- `client/src/pages/ecu.tsx` - Full ECU tuning page with ~96 configurable parameters organized into 14 sections, preset save/load
- `client/src/lib/engineSim.ts` - Engine physics simulation with EcuConfig interface, configurable constants
- `client/src/lib/sharedSim.ts` - Shared singleton simulation instance for cross-page state
- `client/src/lib/presets.ts` - ECU preset system (built-in + custom presets via localStorage)
- `client/src/App.tsx` - App entry point, routes to dashboard (/) and ECU (/ecu)
- `server/routes.ts` - API routes for heartbeat and active player count
- `server/storage.ts` - Database storage for active sessions
- `server/db.ts` - PostgreSQL connection via drizzle-orm
- `shared/schema.ts` - Database schema (active_sessions table)

## Engine: Honda B16A2
- 1.6L DOHC VTEC inline-4
- 160 hp @ 7,600 RPM, 111 lb-ft @ 7,000 RPM
- VTEC engagement at ~5,500 RPM (configurable via ECU)
- Redline: 8,200 RPM (configurable), idle: 750 RPM (configurable)
- Compression ratio: 10.2:1 (configurable)
- Valve lift: 10.6mm intake, 9.4mm exhaust (VTEC high cam)
- Torque curve modeled via lookup table with interpolation
- Optional turbo kit with boost control, wastegate, and anti-lag

## ECU Tuning System (~96 parameters)
Full programmable ECU accessible from /ecu page. All changes apply in real-time.

### Rev Limits
Redline RPM, Fuel Cut RPM, Rev Limit Type (fuel/ignition/both), Soft Cut RPM, Soft Cut Retard, Speed Limiter

### VTEC Control
Engage RPM, Disengage RPM (hysteresis), Min Oil Pressure

### Cam Profile
Low Cam: Intake Lift (mm), Exhaust Lift (mm), Intake Duration (deg), Exhaust Duration (deg)
VTEC Cam: Intake Lift (mm), Exhaust Lift (mm), Intake Duration (deg), Exhaust Duration (deg)
- Cam lift/duration directly affects torque multiplier via ratio to stock values
- Bigger cams add top-end power but lose low-end torque
- Both intake and exhaust values factored into power calculation

### Fuel Tuning
Injector Size, Fuel Pressure, AFR Targets (idle/cruise/WOT/VTEC), Cranking Fuel PW, Warmup Enrich, Accel Enrich, Decel Fuel Cut, Closed Loop toggle, CL AFR Target

### Ignition Tuning
Base Timing, Max Advance, Idle Timing, Knock Retard, Knock Sensitivity, Knock Recovery Rate

### Boost / Wastegate
Turbo Enable toggle, Wastegate Duty, Boost Target, Boost Cut, Anti-Lag toggle, Anti-Lag Retard, Boost by Gear (per-gear targets)

### Supercharger
Supercharger Enable toggle, Type (centrifugal/roots/twinscrew), Max Boost PSI, Efficiency %
- Centrifugal: boost scales with RPM squared (more top-end)
- Roots/Twinscrew: boost available from low RPM (more linear)
- Parasitic power loss modeled (engine-driven)
- Turbo and supercharger don't stack (turbo takes precedence)

### Nitrous
Nitrous Enable toggle, Shot Size (HP), Activation RPM, Full Throttle Only toggle
- Adds direct torque based on configured HP shot size
- Active during quarter-mile runs
- Full throttle only option for safety

### Idle Control
Target Idle RPM, IACV Position, Idle Ignition Timing

### Launch Control
Launch Control toggle, Launch RPM, Two-Step toggle, Two-Step RPM, Launch Retard, Launch Fuel Cut %, Flat Foot Shift toggle, FFS Cut Time

### Traction Control
TC toggle, Slip Threshold, TC Retard, TC Fuel Cut %, TC Mode (mild/moderate/aggressive)

### Gear Ratios
Per-gear ratios (5-speed), Final Drive Ratio, Per-gear Rev Limits

### Vehicle
Mass, Tire Diameter, Tire Mass, Drag Coefficient, Frontal Area, Rolling Resistance, Drivetrain Loss %

### Traction Physics
Tire Grip Coefficient, Wheelbase, CG Height, Front Weight Bias, Optimal Slip Ratio, Shift Time

### Cooling
Fan On/Off Temps, Overtemp Warning, Overtemp Enrichment

### Sensor Calibration
MAP Sensor Range, O2 Sensor Type (narrowband/wideband), Coolant Sensor Offset

### Engine
Compression Ratio

## Dashboard Sections (~68 gauges)

### Engine (8 gauges)
RPM, Throttle %, Torque, Horsepower, VTEC Status, Engine Load, Crank Angle, Stroke Phase

### Combustion (8 gauges)
Cylinder Pressure, AFR, Ignition Timing, Spark Advance, Injection Pulse, Volumetric Efficiency, Fuel Rate, Fuel Pressure

### Intake / Exhaust (8 gauges)
MAP, Intake Vacuum, Intake Valve Lift, Exhaust Valve Lift, EGT, Intake Air Temp, Catalyst Temp, O2 Sensor

### Fluids / Electrical (4 gauges)
Coolant Temp, Oil Temp, Oil Pressure, Battery Voltage

### Drivetrain (6 gauges)
Current Gear, Driveshaft RPM, Clutch Status, Wheel Torque, Wheel Force, Knock Count

### Traction (6 gauges)
Front Axle Load, Rear Axle Load, Weight Transfer, Tire Slip %, Traction Limit, Tire Temp

### Forces (4 gauges)
Drag Force, Rolling Resistance, Net Force, Acceleration G

### Quarter Mile (8 gauges)
Speed MPH, Speed KM/H, Distance ft, Distance m, Tire RPM, Elapsed Time, 1/4 ET, Trap Speed

### Split Times (4 gauges)
60ft Time, 330ft Time, 1/8 Mile Time, 1000ft Time

### ECU Status (10 gauges)
Boost PSI, Fan Status, Fuel Map (closed/open loop), Launch Control Active, Traction Control Active, Knock Retard Active, Fuel Cut Active, Rev Limit Active, S/C Active, Nitrous Active

### Peak Performance (2 gauges)
Peak G, Peak Wheel HP

## Drivetrain Model (2000 Civic Si)
- S4C 5-speed manual: 3.230, 2.105, 1.458, 1.107, 0.848 (configurable)
- Final drive ratio: 4.400 (configurable)
- Tires: 185/65R14 (23.5" diameter, 16 lbs each) (configurable)
- Vehicle curb weight: 2,612 lbs (configurable)
- Tire rotational inertia factored into effective mass
- Drag coefficient: 0.34, frontal area: 1.94 m² (configurable)
- Clutch slip model for realistic launch behavior
- Semi-implicit integration for accurate ET calculation

## Traction Physics
- Tire grip coefficient: 0.85 (street tires, configurable)
- Weight transfer model: FWD loses front grip under acceleration
- Wheelbase: 2.620m, CG height: 0.48m, 61% front weight bias (all configurable)
- Tire slip ratio tracking with grip degradation beyond 10% slip
- 0.25s shift delay between gears (configurable)

## User Interaction
- Dashboard: Scrollable gauge area shows all ~68 parameters organized into 11 sections
- Throttle slider and launch button fixed at bottom of screen
- ECU page: Full tuning interface with organized sections, +/- buttons and direct input
- Navigation: "ECU TUNE" link on dashboard, "GAUGES" link on ECU page
- "DEFAULTS" button on ECU page resets all parameters to stock B16A2 values

## Recent Changes
- 2026-02-07: Added live player count (shows how many tuners are using the app worldwide via heartbeat API)
- 2026-02-07: Added ECU preset system — 6 built-in presets (Stock, Street Turbo, Drag Build, All-Motor, Supercharged, NOS Street, Max Attack) + save/load custom presets
- 2026-02-07: Fixed sound hanging after QM finish — fading flag prevents update() from overriding fade ramp
- 2026-02-07: Fixed traction model — more power now produces faster ETs (gentler grip degradation, reduced weight transfer severity)
- 2026-02-07: Added quarter-mile results overlay with all key stats (ET, trap, splits, peak RPM/WHP/G/boost/speed/slip) and NEW RUN button
- 2026-02-07: Engine sound fades out smoothly when quarter-mile finishes (no more hanging sound)
- 2026-02-07: Fixed tire slip to persist through 2nd+ gears during quarter-mile runs (force-based calculation replaces circular speed-based method)
- 2026-02-07: Added peak tracking during QM runs (peakRpm, peakBoostPsi, peakSpeedMph, peakSlipPercent)
- 2026-02-07: Added turbo sound synthesis (spool, whistle, blow-off valve) and tire chirp/squeal sounds to engine audio
- 2026-02-07: Tire slip now calculated in all modes (not just quarter-mile) — high-power builds produce wheelspin in 1st gear
- 2026-02-07: Non-QM mode now computes wheel force vs traction with traction control intervention
- 2026-02-07: Added real-time engine sound synthesis via Web Audio API (multi-oscillator, VTEC crossover, rev limiter bounce, decel pops, anti-lag bangs)
- 2026-02-07: Added cam profile tuning (intake/exhaust lift & duration for both low cam and VTEC cam) affecting torque curve
- 2026-02-07: Added supercharger simulation (centrifugal/roots/twinscrew) with parasitic drag modeling
- 2026-02-07: Added nitrous oxide system with configurable shot size and activation RPM
- 2026-02-07: Added fully programmable ECU tuning page (/ecu) with ~96 configurable parameters
- 2026-02-07: Added turbo/boost simulation with wastegate, anti-lag, per-gear boost targets
- 2026-02-07: Added launch control, traction control, and flat foot shift systems
- 2026-02-07: Added ECU Status section to dashboard (boost, fan, fuel map, launch/TC active, knock retard, fuel/rev cut)
- 2026-02-07: Created shared simulation singleton for cross-page state
- 2026-02-07: Expanded to ~60 gauges with scrollable sections
- 2026-02-07: Added split times, trap speed, peak G, peak WHP
- 2026-02-07: Added drivetrain, traction, forces gauges
- 2026-02-07: Added tire grip physics, weight transfer, traction limiting, shift delay
- 2026-02-07: Switched engine model to Honda B16A2 with real torque curve, VTEC, 8200 RPM redline
- 2026-02-07: Initial build - engine simulation dashboard

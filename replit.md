# Engine Monitor Dashboard

## Overview
A minimalist, text-only dashboard that simulates a 2000 Honda Civic Si (B16A2) engine in real-time. Pure black screen with white monospace numbers. Designed for iPhone viewing. Includes quarter-mile drag simulation with ~60 live parameters.

## Architecture
- **Frontend only** - no backend data persistence needed
- Engine simulation runs client-side via `requestAnimationFrame`
- ~60 parameters update in real-time based on physics model
- Scrollable gauge area with fixed bottom controls (throttle + launch button)

## Key Files
- `client/src/pages/dashboard.tsx` - Scrollable dashboard UI with sectioned gauge grid and fixed bottom controls
- `client/src/lib/engineSim.ts` - Engine physics simulation (B16A2 torque map, VTEC, 720° crank cycle, valve lift, pressure, drivetrain, quarter-mile, traction, split times)
- `client/src/App.tsx` - App entry point, routes to dashboard

## Engine: Honda B16A2
- 1.6L DOHC VTEC inline-4
- 160 hp @ 7,600 RPM, 111 lb-ft @ 7,000 RPM
- VTEC engagement at ~5,500 RPM
- Redline: 8,200 RPM, idle: 750 RPM
- Compression ratio: 10.2:1
- Valve lift: 10.6mm intake, 9.4mm exhaust (VTEC high cam)
- Torque curve modeled via lookup table with interpolation

## Dashboard Sections (~60 gauges)

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

### Peak Performance (2 gauges)
Peak G, Peak Wheel HP

## Drivetrain Model (2000 Civic Si)
- S4C 5-speed manual: 3.230, 2.105, 1.458, 1.107, 0.848
- Final drive ratio: 4.400
- Tires: 185/65R14 (23.5" diameter, 16 lbs each)
- Vehicle curb weight: 2,612 lbs
- Tire rotational inertia factored into effective mass
- Drag coefficient: 0.34, frontal area: 1.94 m²
- Clutch slip model for realistic launch behavior
- Semi-implicit integration for accurate ET calculation

## Traction Physics
- Tire grip coefficient: 0.85 (street tires)
- Weight transfer model: FWD loses front grip under acceleration
- Wheelbase: 2.620m, CG height: 0.48m, 61% front weight bias
- Tire slip ratio tracking with grip degradation beyond 10% slip
- 0.25s shift delay between gears

## User Interaction
- Scrollable gauge area shows all ~60 parameters organized into sections
- Throttle slider and launch button fixed at bottom of screen
- Throttle stays active during QM run
- Tap launch to start, tap again to reset

## Recent Changes
- 2026-02-07: Expanded to ~60 gauges with scrollable sections (engine, combustion, intake/exhaust, fluids, drivetrain, traction, forces, quarter mile, splits, peak performance)
- 2026-02-07: Added split times (60ft, 330ft, 1/8 mile, 1000ft), trap speed, peak G, peak WHP
- 2026-02-07: Added drivetrain gauges (gear, clutch status, wheel torque/force, driveshaft RPM)
- 2026-02-07: Added traction gauges (axle loads, weight transfer, tire slip, tire temp, traction limit)
- 2026-02-07: Added ECU sensors (VTEC status, engine load, intake air temp, vacuum, fuel pressure, battery, O2 sensor, knock, catalyst temp)
- 2026-02-07: Added resistance forces (drag, rolling, net force)
- 2026-02-07: Redesigned dashboard with scrollable gauge area and fixed bottom controls
- 2026-02-07: Added tire grip physics, weight transfer, traction limiting, shift delay
- 2026-02-07: Switched engine model to Honda B16A2 with real torque curve, VTEC, 8200 RPM redline
- 2026-02-07: Initial build - engine simulation dashboard

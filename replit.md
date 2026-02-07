# Engine Monitor Dashboard

## Overview
A minimalist, text-only dashboard that simulates a 2000 Honda Civic Si (B16A2) engine in real-time. Pure black screen with white monospace numbers. Designed for iPhone viewing. Includes quarter-mile drag simulation.

## Architecture
- **Frontend only** - no backend data persistence needed
- Engine simulation runs client-side via `requestAnimationFrame`
- All 26 parameters update in real-time based on physics model

## Key Files
- `client/src/pages/dashboard.tsx` - Main dashboard UI with gauge grid
- `client/src/lib/engineSim.ts` - Engine physics simulation (B16A2 torque map, VTEC, 720° crank cycle, valve lift, pressure, drivetrain, quarter-mile)
- `client/src/App.tsx` - App entry point, routes to dashboard

## Engine: Honda B16A2
- 1.6L DOHC VTEC inline-4
- 160 hp @ 7,600 RPM, 111 lb-ft @ 7,000 RPM
- VTEC engagement at ~5,500 RPM
- Redline: 8,200 RPM, idle: 750 RPM
- Compression ratio: 10.2:1
- Valve lift: 10.6mm intake, 9.4mm exhaust (VTEC high cam)
- Torque curve modeled via lookup table with interpolation

## Engine Parameters (20 gauges)
RPM, Throttle %, Crank Angle, Stroke Phase, Cylinder Pressure, MAP, EGT, AFR, Coolant Temp, Oil Temp, Oil Pressure, Ignition Timing, Intake Valve Lift, Exhaust Valve Lift, Spark Advance, Injection Pulse, Volumetric Efficiency, Torque, Horsepower, Fuel Consumption Rate

## Quarter-Mile Parameters (6 gauges)
Tire RPM, Speed (MPH), Distance (ft), Elapsed Time (sec), Acceleration (g), Quarter-Mile ET (sec)

## Drivetrain Model (2000 Civic Si)
- S4C 5-speed manual: 3.230, 2.105, 1.458, 1.107, 0.848
- Final drive ratio: 4.400
- Tires: 185/65R14 (23.5" diameter, 16 lbs each)
- Vehicle curb weight: 2,612 lbs
- Tire rotational inertia factored into effective mass
- Drag coefficient: 0.34, frontal area: 1.94 m²
- Clutch slip model for realistic launch behavior
- Semi-implicit integration for accurate ET calculation

## User Interaction
- Throttle slider at bottom controls RPM and all derived parameters (stays active during QM run)
- "Launch 1/4 Mile" button starts drag run at current throttle setting
- Tap again to reset after completion

## Recent Changes
- 2026-02-07: Switched engine model to Honda B16A2 with real torque curve, VTEC, 8200 RPM redline
- 2026-02-07: Updated drivetrain to S4C transmission ratios (4.400 final drive)
- 2026-02-07: Set tire to 185/65R14 (23.5" diameter, 16 lbs) matching 2000 Civic Si
- 2026-02-07: Set vehicle weight to 2,612 lbs (2000 Civic Si curb weight)
- 2026-02-07: Throttle slider stays active during QM run, no forced 100% on launch
- 2026-02-07: Tire RPM shows 0 when not in quarter-mile mode
- 2026-02-07: Initial build - engine simulation dashboard

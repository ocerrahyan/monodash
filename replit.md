# Engine Monitor Dashboard

## Overview
A minimalist, text-only dashboard that simulates a 4-stroke single cylinder engine in real-time. Pure black screen with white monospace numbers. Designed for iPhone viewing. Includes quarter-mile drag simulation.

## Architecture
- **Frontend only** - no backend data persistence needed
- Engine simulation runs client-side via `requestAnimationFrame`
- All 26 parameters update in real-time based on physics model

## Key Files
- `client/src/pages/dashboard.tsx` - Main dashboard UI with gauge grid
- `client/src/lib/engineSim.ts` - Engine physics simulation (720° crank cycle, valve lift, pressure, torque/HP, drivetrain, quarter-mile)
- `client/src/App.tsx` - App entry point, routes to dashboard

## Engine Parameters (20 gauges)
RPM, Throttle %, Crank Angle, Stroke Phase, Cylinder Pressure, MAP, EGT, AFR, Coolant Temp, Oil Temp, Oil Pressure, Ignition Timing, Intake Valve Lift, Exhaust Valve Lift, Spark Advance, Injection Pulse, Volumetric Efficiency, Torque, Horsepower, Fuel Consumption Rate

## Quarter-Mile Parameters (6 gauges)
Tire RPM, Speed (MPH), Distance (ft), Elapsed Time (sec), Acceleration (g), Quarter-Mile ET (sec)

## Drivetrain Model
- 5-speed transmission with gear ratios: 3.42, 2.14, 1.45, 1.0, 0.78
- Final drive ratio: 3.73, tire diameter: 26"
- Vehicle mass: 3200 lb, drag coefficient: 0.35
- Clutch slip model for realistic launch behavior
- Semi-implicit integration for accurate ET calculation

## User Interaction
- Throttle slider at bottom controls RPM and all derived parameters
- "Launch 1/4 Mile" button starts full-throttle standing-start drag run
- Tap again to reset after completion

## Recent Changes
- 2026-02-07: Added quarter-mile drag simulation with tire RPM, vehicle speed, distance, elapsed time, acceleration, and ET
- 2026-02-07: Initial build - single cylinder 4-stroke engine simulation dashboard

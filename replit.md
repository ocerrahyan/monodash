# Engine Monitor Dashboard

## Overview
A minimalist, text-only dashboard that simulates a 4-stroke single cylinder engine in real-time. Pure black screen with white monospace numbers. Designed for iPhone viewing.

## Architecture
- **Frontend only** - no backend data persistence needed
- Engine simulation runs client-side via `requestAnimationFrame`
- All 20 parameters update in real-time based on physics model

## Key Files
- `client/src/pages/dashboard.tsx` - Main dashboard UI with 4x5 grid of gauges
- `client/src/lib/engineSim.ts` - Engine physics simulation (720° crank cycle, valve lift, pressure, torque/HP calculations)
- `client/src/App.tsx` - App entry point, routes to dashboard

## Engine Parameters (20 gauges)
RPM, Throttle %, Crank Angle, Stroke Phase, Cylinder Pressure, MAP, EGT, AFR, Coolant Temp, Oil Temp, Oil Pressure, Ignition Timing, Intake Valve Lift, Exhaust Valve Lift, Spark Advance, Injection Pulse, Volumetric Efficiency, Torque, Horsepower, Fuel Consumption Rate

## User Interaction
- Throttle slider at bottom controls RPM and all derived parameters

## Recent Changes
- 2026-02-07: Initial build - single cylinder 4-stroke engine simulation dashboard

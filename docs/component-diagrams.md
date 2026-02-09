# 2000 Honda Civic Si (EM1) Component Relationship Diagrams

## Front Drivetrain Power Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        ENGINE B16A2                               │
│  1.6L DOHC VTEC I-4 • 160hp @ 7,600 RPM • 111 lb-ft @ 7,000 RPM │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Crankshaft
                             ↓
                    ┌────────────────┐
                    │  CLUTCH DISC   │
                    │   10.2" dia    │
                    └────────┬───────┘
                             │ Input Shaft
                             ↓
┌────────────────────────────────────────────────────────────────────┐
│               TRANSMISSION S4C (5-SPEED MANUAL)                     │
│  88-92 lbs • 26-spline output • Hydraulic clutch                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Gear Ratios:                                                │  │
│  │   1st: 3.230  2nd: 2.105  3rd: 1.458  4th: 1.107  5th: 0.848 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              DIFFERENTIAL (Open, 4.400:1)                     │ │
│  └───┬──────────────────────────────────────────────────────┬───┘ │
└──────┼──────────────────────────────────────────────────────┼─────┘
       │ Left Output (26-spline)     Right Output (26-spline) │
       ↓                                                       ↓
┌──────────────────┐                              ┌──────────────────┐
│ INTERMEDIATE     │                              │  RIGHT CV AXLE   │
│ SHAFT (SK7)      │                              │  44305-S04-A01   │
│                  │                              │  ~580mm length   │
└────────┬─────────┘                              └────────┬─────────┘
         │                                                 │
         ↓                                                 ↓
┌──────────────────┐                              ┌──────────────────┐
│  LEFT CV AXLE    │                              │  RIGHT HUB       │
│  44306-S04-A01   │                              │  44600-S04-A00   │
│  ~620mm length   │                              │  4x100 pattern   │
│  Tripod/Ball     │                              │  56.1mm bore     │
└────────┬─────────┘                              └────────┬─────────┘
         │                                                 │
         ↓                                                 ↓
┌──────────────────┐                              ┌──────────────────┐
│  LEFT HUB        │                              │  RIGHT WHEEL     │
│  44600-S04-A00   │                              │  15x6.0          │
│  4x100 pattern   │                              │  +45mm offset    │
│  56.1mm bore     │                              └────────┬─────────┘
└────────┬─────────┘                                       │
         │                                                 ↓
         ↓                                          ┌──────────────────┐
┌──────────────────┐                               │  RIGHT TIRE      │
│  LEFT WHEEL      │                               │  195/55R15       │
│  15x6.0          │                               │  ~8.6 kg         │
│  +45mm offset    │                               └──────────────────┘
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  LEFT TIRE       │
│  195/55R15       │
│  ~8.6 kg         │
└──────────────────┘
```

**Total Drivetrain Weight:** ~400-480 lbs (includes transmission, axles, hubs, wheels, tires)

---

## Front Suspension Assembly (Left Side - Right is Mirror)

```
                        CHASSIS/BODY
                             │
                    ┌────────┴────────┐
                    │  STRUT TOWER    │
                    │  (3x bolt mount)│
                    └────────┬────────┘
                             │
                         ┌───┴────┐
                         │  TOP   │
                         │  MOUNT │
                         └───┬────┘
                             │
┌─────────────┐             │              ┌─────────────┐
│  SUBFRAME   │             │              │  SUBFRAME   │
│  MOUNT      │◄────────────┼──────────────►│  MOUNT      │
└──────┬──────┘             │              └──────┬──────┘
       │                    │                     │
   ┌───┴───────────┐        │          ┌──────────┴────┐
   │ UPPER CONTROL │        │          │  COIL SPRING  │
   │ ARM (Left)    │        │          │  28 N/mm rate │
   │ 51460-S04-003 │        │          └──────┬────────┘
   │ ~1.6 kg       │        │                 │
   └───┬───────────┘        │          ┌──────┴────────┐
       │                    │          │  STRUT DAMPER │
       │ Front Bushing      │          │  512mm extend │
       │ Rear Bushing       │          │  378mm comp   │
       ↓                    │          └──────┬────────┘
   ┌───────────┐            │                 │
   │  UPPER    │            └─────────────────┤
   │  BALL     │                              │
   │  JOINT    │                              │
   └─────┬─────┘                              │
         │                                    │
         │                            ┌───────┴───────┐
         │                            │   STEERING    │
         └────────────────────────────►   KNUCKLE     │◄────────┐
                                      │   Cast Iron   │         │
┌─────────────┐                       │               │         │
│  SUBFRAME   │                       └───────┬───────┘         │
│  MOUNT      │◄──────────────────────────────┼─────────────────┤
└──────┬──────┘                               │                 │
       │                                      │                 │
   ┌───┴──────────────┐                       │                 │
   │  LOWER CONTROL   │                       │                 │
   │  ARM (Left)      │                       │                 │
   │  51360-S04-000   │                       │                 │
   │  ~2.5 kg         │                       │                 │
   └───┬──────────────┘                       │                 │
       │                                      │                 │
       │ Front Bushing                        │                 │
       │ Rear Bushing                         │                 │
       │ Sway Bar Link                        │                 │
       ↓                                      │                 │
   ┌───────────┐                              │                 │
   │  LOWER    │                              │                 │
   │  BALL     │                              │                 │
   │  JOINT    │                              │                 │
   │ 51220-S04 │                              │                 │
   └─────┬─────┘                              │                 │
         │                                    │                 │
         └────────────────────────────────────┘                 │
                                                                │
                                      ┌─────────────────────────┘
                                      │
                               ┌──────┴───────┐
                               │  WHEEL HUB   │
                               │ 44600-S04-A00│
                               │  4 lbs       │
                               └──────┬───────┘
                                      │
                               ┌──────┴───────┐
                               │   BEARING    │
                               │ 44300-S04-008│
                               │  Press-fit   │
                               │  2 lbs       │
                               └──────┬───────┘
                                      │
                               ┌──────┴──────────┐
                               │  BRAKE ROTOR    │
                               │  262mm diameter │
                               │  45251-SR0-A10  │
                               │  ~14 lbs        │
                               └──────┬──────────┘
                                      │
         ┌────────────────────────────┴────────────────────────────┐
         │                                                          │
    ┌────┴─────┐                                              ┌────┴─────┐
    │  CALIPER │                                              │  WHEEL   │
    │  BRACKET │                                              │  15x6.0  │
    │  2 bolts │                                              │  4x100   │
    └────┬─────┘                                              │  ~15 lbs │
         │                                                    └────┬─────┘
    ┌────┴─────────┐                                              │
    │  CALIPER     │                                         ┌────┴─────┐
    │  Single      │                                         │   TIRE   │
    │  Piston      │                                         │ 195/55R15│
    │  Floating    │                                         │  ~19 lbs │
    │  ~7.5 lbs    │                                         └──────────┘
    └──────────────┘
```

---

## Steering System

```
┌──────────────┐
│   STEERING   │
│     WHEEL    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│   STEERING   │
│    COLUMN    │
└──────┬───────┘
       │
       ↓
┌──────────────────┐
│  INTERMEDIATE    │
│     SHAFT        │
│   (U-joints)     │
└──────┬───────────┘
       │
       ↓
┌──────────────────────────────────────────────────────────────┐
│              STEERING RACK (53427-S04-A01)                    │
│  Hydraulic Power Steering • 16.5:1 ratio • 2.9 turns lock    │
│  800mm length • 6 lbs                                         │
│                                                               │
│     ┌─────────────────────┐                                  │
│     │   PINION (Input)    │                                  │
│     └──────────┬──────────┘                                  │
│                │                                              │
│     ┌──────────▼──────────┐                                  │
│     │   RACK (140mm       │                                  │
│     │   travel)           │                                  │
│     └──┬──────────────┬───┘                                  │
└────────┼──────────────┼──────────────────────────────────────┘
         │              │
         │ Left         │ Right
         ↓              ↓
┌────────────────┐  ┌────────────────┐
│  LEFT INNER    │  │  RIGHT INNER   │
│  TIE ROD       │  │  TIE ROD       │
│  53521-S04-003 │  │  53521-S04-003 │
│  185mm         │  │  185mm         │
└────────┬───────┘  └────────┬───────┘
         │                   │
         ↓                   ↓
┌────────────────┐  ┌────────────────┐
│  LEFT OUTER    │  │  RIGHT OUTER   │
│  TIE ROD END   │  │  TIE ROD END   │
│  53540-S04-A01 │  │  53540-S04-A01 │
│  210mm         │  │  210mm         │
└────────┬───────┘  └────────┬───────┘
         │                   │
         ↓                   ↓
┌────────────────┐  ┌────────────────┐
│  LEFT          │  │  RIGHT         │
│  STEERING      │  │  STEERING      │
│  KNUCKLE       │  │  KNUCKLE       │
└────────────────┘  └────────────────┘
```

**Steering Geometry:**
- Caster: 5° 22'
- Camber: -0° 04'
- Toe-in: +2.1mm total
- Kingpin angle: ~12.5°

---

## Sway Bar System

```
                    ┌──────────────┐
                    │   CHASSIS    │
                    └───┬──────┬───┘
                        │      │
           Left Mount   │      │   Right Mount
          (Bushing)     │      │   (Bushing)
                    ┌───┴──────┴───┐
                    │  FRONT SWAY  │
                    │     BAR      │
                    │  51300-S04   │
                    │   26mm dia   │
                    │   1100mm L   │
                    └───┬──────┬───┘
                        │      │
                        │      │
            ┌───────────┘      └───────────┐
            │                              │
            ↓                              ↓
    ┌───────────────┐              ┌───────────────┐
    │  LEFT END     │              │  RIGHT END    │
    │  LINK         │              │  LINK         │
    │  (Adjustable) │              │  (Adjustable) │
    └───────┬───────┘              └───────┬───────┘
            │                              │
            ↓                              ↓
    ┌───────────────┐              ┌───────────────┐
    │  LEFT LOWER   │              │  RIGHT LOWER  │
    │  CONTROL ARM  │              │  CONTROL ARM  │
    └───────────────┘              └───────────────┘
```

**Sway Bar Specifications:**
- Front: 26mm diameter, 85 Nm/deg stiffness
- Rear: 13mm diameter, 28 Nm/deg stiffness

---

## Brake System (Front)

```
┌──────────────┐
│    MASTER    │
│   CYLINDER   │
└──────┬───────┘
       │ Brake Lines
       ├────────────────────┬────────────────────┐
       ↓                    ↓                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ PROPORTIONING│    │  LEFT FRONT  │    │  RIGHT FRONT │
│    VALVE     │    │   CALIPER    │    │   CALIPER    │
└──────────────┘    │ Single Piston│    │ Single Piston│
                    │  ~7.5 lbs    │    │  ~7.5 lbs    │
                    └──────┬───────┘    └──────┬───────┘
                           │                   │
                   ┌───────┴───────┐   ┌───────┴───────┐
                   │  BRAKE PADS   │   │  BRAKE PADS   │
                   │  (Inner/Outer)│   │  (Inner/Outer)│
                   └───────┬───────┘   └───────┬───────┘
                           │                   │
                   ┌───────▼───────┐   ┌───────▼───────┐
                   │  LEFT ROTOR   │   │  RIGHT ROTOR  │
                   │  262mm dia    │   │  262mm dia    │
                   │  23mm thick   │   │  23mm thick   │
                   │  Vented       │   │  Vented       │
                   │  ~14 lbs      │   │  ~14 lbs      │
                   └───────┬───────┘   └───────┬───────┘
                           │                   │
                   ┌───────▼───────┐   ┌───────▼───────┐
                   │   LEFT HUB    │   │   RIGHT HUB   │
                   │  (Rotating)   │   │  (Rotating)   │
                   └───────────────┘   └───────────────┘
```

---

## Weight Distribution

```
                    FRONT (61%)
        ┌─────────────────────────────┐
        │                             │
    ┌───┴───┐    ENGINE    ┌───┴───┐
    │ LEFT  │   B16A2      │ RIGHT │
    │ FRONT │   ~310 lbs   │ FRONT │
    │ WHEEL │              │ WHEEL │
    │ ~45lb │   TRANS      │ ~45lb │
    │ total │   ~90 lbs    │ total │
    └───┬───┘              └───┬───┘
        │                      │
        │    PASSENGER         │
        │    COMPARTMENT       │
        │    ~600 lbs          │
        │                      │
        │                      │
    ┌───┴───┐              ┌───┴───┐
    │ LEFT  │              │ RIGHT │
    │ REAR  │              │ REAR  │
    │ WHEEL │              │ WHEEL │
    │ ~40lb │              │ ~40lb │
    │ total │              │ total │
    └───────┘              └───────┘
                └───────────────────┘
                    REAR (39%)

TOTAL CURB WEIGHT: 2,612 lbs (1,184 kg)
CENTER OF GRAVITY: 480mm height (18.9 inches from ground)
WHEELBASE: 2,620mm (103.2 inches)
TRACK WIDTH: 1,475mm front (58.1 inches)
```

---

## Connection Point Reference

All dimensions in millimeters from vehicle centerline and ground:

### Hub Center Points (Loaded Vehicle)
- **Height from ground:** ~330mm (hub center)
- **Front track:** ±737.5mm from centerline (1,475mm total)
- **Wheelbase:** 2,620mm (front to rear axle)

### Control Arm Pivot Points
- **Upper arm rear pivot:** ~150mm behind lower arm front pivot
- **Lower arm pivots:** ~250mm horizontal spacing
- **Vertical separation:** ~150mm (upper above lower)

### Steering Rack
- **Height from ground:** ~220mm (center of rack)
- **Width:** ±350mm from centerline (inner tie rod connection)

### Strut Mounts
- **Upper mount height:** ~850mm from ground (loaded)
- **Lower mount height:** ~330mm from ground (at knuckle)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-09  
**For:** CAD modeling and simulation reference

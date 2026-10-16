import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 780;
const HEIGHT = 520;

const PLATE = { x: -168, y: -88, w: 336, d: 178, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;

// Time scale: t in [0, 30] seconds maps linearly to x in [-102, 78] (180 units = 6 units/sec)
const T_MIN = 0;
const T_MAX = 30;
const X_ZERO = -102;
const X_SPAN = 180;
const timeToX = (t) => X_ZERO + (t / T_MAX) * X_SPAN;

// 6 Clinical Biomarker Domains (32 total biomarkers, 0% hallucination)
const DOMAINS = [
  {
    id: "cell",
    code: "① CELL / BIA",
    sub: "8종 · φ 6.4°",
    count: 8,
    pos: [-98, -62],
    z: 78,
    r: 19,
    h: 9,
    lockAt: 12.0,
    targetTurn: 0.68,
    follower: 0,
  },
  {
    id: "cardio",
    code: "② CARDIO / PTT",
    sub: "7종 · 118/76",
    count: 7,
    pos: [-2, -62],
    z: 78,
    r: 19,
    h: 9,
    lockAt: 14.0,
    targetTurn: 0.62,
    follower: 0,
  },
  {
    id: "ans",
    code: "③ ANS / HRV",
    sub: "5종 · 36ms",
    count: 5,
    pos: [94, -62],
    z: 78,
    r: 19,
    h: 9,
    lockAt: 15.0,
    targetTurn: 0.56,
    follower: 0,
  },
  {
    id: "grip",
    code: "④ GRIP / RFD",
    sub: "4종 · 38.4kg",
    count: 4,
    pos: [-98, -26],
    z: 48,
    r: 18,
    h: 8.5,
    lockAt: 20.0,
    targetTurn: 0.74,
    follower: 1,
  },
  {
    id: "rom",
    code: "⑤ 3D ROM / FALL",
    sub: "5종 · 168°",
    count: 5,
    pos: [-2, -26],
    z: 48,
    r: 18,
    h: 8.5,
    lockAt: 28.5,
    targetTurn: 0.71,
    follower: 2,
  },
  {
    id: "iris",
    code: "⑥ NEURO / IRIS",
    sub: "3종 · 225ms",
    count: 3,
    pos: [94, -26],
    z: 48,
    r: 18,
    h: 8.5,
    lockAt: 13.5,
    targetTurn: 0.59,
    follower: 0,
  },
];

// 3 Mechanical Cam Followers corresponding to the 30-second 3-Step Protocol
const FOLLOWERS = [
  {
    step: 1,
    name: "STEP 1 (0–15s)",
    chip: "AD5940+MAX86150+OV2710",
    desc: "Stand on 4-Plate & Hold Sticks + Look at Cam",
    x: -57,
    y: 12,
    t0: 0.0,
    t1: 15.0,
    lobeFrom: X_ZERO,
    lobeTo: timeToX(15),
    biomarkers: 23,
  },
  {
    step: 2,
    name: "STEP 2 (15–20s)",
    chip: "HX711 80Hz Load Cell",
    desc: "3-Sec Max Right-Hand Grip Squeeze",
    x: 3,
    y: 12,
    t0: 15.0,
    t1: 20.0,
    lobeFrom: timeToX(15),
    lobeTo: timeToX(20),
    biomarkers: 4,
  },
  {
    step: 3,
    name: "STEP 3 (20–30s)",
    chip: "MediaPipe 3D + 80mm Cut",
    desc: "1m Step-Back Arms-Up / Turn / 1-Leg & Print",
    x: 48,
    y: 12,
    t0: 20.0,
    t1: 30.0,
    lobeFrom: timeToX(20),
    lobeTo: timeToX(30),
    biomarkers: 5,
  },
];

const CAM_Y = 42;
const CAM_Z = 18;
const RULER_Y = 66;
const LIFT_H = 7.5;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-160, -84, 108],
    [160, -84, 108],
    [162, 86, 65],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 39, elevation: 29 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// 1. Base Surface Plate & Corner Feet (14 solid parts)
function basePlate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 8.5, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 6.4, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));

  const bolts = k.corners(PLATE, 11);
  for (const [bx, by] of byDepth(bolts)) {
    out.push(S(k.cylinder(bx, by, 2.8, 0, 1.2, P, 18), { tone: "lo" }));
    out.push(D([at([bx, by, 1.2])], { size: 0.45, tone: "hi" }));
  }

  // Sub-base ground busbar strip
  const bus = { x: -148, y: -8, w: 250, d: 6, r: 1.5 };
  out.push(S(k.slabOf(bus, 0, 1.5, P, 4, 0.3), { tone: "lo" }));
  out.push(D([-136, -90, -44, 2, 48, 92].map((x) => at([x, -5, 1.5])), { size: 0.4, tone: "mid" }));
  return out.join("");
}

// 2. Back Stepped 6-Domain Instrument Console & 6 Analog Dial Gauges (38 solid parts)
function instrumentBank() {
  const out = [];
  // Rear console main housing
  const rearTier = { x: -146, y: -80, w: 288, d: 34, r: 5 };
  const frontTier = { x: -146, y: -46, w: 288, d: 34, r: 5 };
  out.push(S(k.slabOf(rearTier, 0, 68, P, 6, 1.2), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(rearTier, 3), 68, 6, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(rearTier, 5), 74, P), { tone: "faint" }));

  out.push(S(k.slabOf(frontTier, 0, 38, P, 6, 1.2), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(frontTier, 3), 38, 6, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(frontTier, 5), 44, P), { tone: "faint" }));

  // Console side anchor blocks
  for (const sx of [-154, 142]) {
    out.push(S(k.slabOf({ x: sx, y: -76, w: 8, d: 58, r: 2 }, 0, 32, P, 4, 0.6), { tone: "lo" }));
    out.push(S(k.cylinder(sx + 4, -64, 2.4, 32, 3, P, 16), { tone: "mid" }));
    out.push(S(k.cylinder(sx + 4, -30, 2.4, 32, 3, P, 16), { tone: "mid" }));
  }

  // Render the 6 Domain Dials in strict back-to-front, left-to-right order
  const orderedDomains = [...DOMAINS].sort(
    (a, b) => k.depthOf([a.pos[0], a.pos[1], a.z], P) - k.depthOf([b.pos[0], b.pos[1], b.z], P),
  );

  for (const d of orderedDomains) {
    const [x, y] = d.pos;
    const baseZ = d.z - 6;
    const topZ = d.z + d.h;
    const idx = DOMAINS.indexOf(d);

    // Pedestal & flange collar
    out.push(S(k.cylinder(x, y, 7.5, baseZ - 4, 4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.8, baseZ, 6, P, 24), { tone: "mid" }));

    // Main dial drum
    out.push(S(k.cylinder(x, y, d.r, d.z, d.h, P, 56, 0.7), { tone: "hi", crease: "lo" }));
    out.push(L(k.knurl(x, y, d.r, topZ - 3.2, topZ, 64, P, 0.3), { tone: "lo" }));
    out.push(L(k.ring(x, y, d.r - 2.0, topZ, P, 48), { tone: "lo" }));

    // Graduated radial ticks
    const ticks = k.radialTicks(x, y, d.r - 2.6, 36, 3, topZ, [1.2, 2.5], P);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));

    // Side lock solenoid boss & indicator pin
    out.push(S(k.slabOf({ x: x + d.r - 1.2, y: y - 2.5, w: 4.5, d: 5, r: 1 }, d.z + 2, 4.5, P, 3), { tone: "mid" }));
    out.push(S(k.cylinder(x + d.r + 3.2, y, 1.8, d.z + 3, 3.2, P, 16), { tone: "hi", lit: true }));

    // Dial face labels
    out.push(k.faceTextSvg(k.topMatrix([x, y - 6.5], topZ, P, "x"), d.code, { size: 2.35, tone: "hi", anchor: "middle" }));
    out.push(k.faceTextSvg(k.topMatrix([x, y + 8.5], topZ, P, "x"), d.sub, { size: 2.2, tone: "mid", anchor: "middle" }));

    // Center pivot ring & live needle
    out.push(S(k.cylinder(x, y, 1.8, topZ, 1.2, P, 18), { tone: "mid" }));
    out.push(
      `<path data-dial="${idx}" class="iso-line" data-tone="lit" data-free="start" d="${dialNeedleAt(idx, d.targetTurn)}" style="stroke-width:1.15"/>`,
    );
  }
  return out.join("");
}

function dialNeedleAt(idx, turn) {
  const d = DOMAINS[idx];
  const [x, y] = d.pos;
  const topZ = d.z + d.h + 0.3;
  const angle = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return k.lineOnTop(
    [x - Math.sin(angle) * 2.8, y + Math.cos(angle) * 2.8],
    [x + Math.sin(angle) * (d.r - 3.6), y - Math.cos(angle) * (d.r - 3.6)],
    topZ,
    P,
  );
}

// 3. Coaxial Signal Capillary Tubes connecting Followers to Domain Dials (12 solid parts)
function signalTubes() {
  const out = [];
  const routes = [
    // From Step 1 Follower (-57, 12) to Cell (-98, -62), Cardio (-2, -62), ANS (94, -62), Iris (94, -26)
    [
      [-57, 8, 26],
      [-57, -6, 26],
      [-98, -6, 38],
      [-98, -46, 38],
    ],
    [
      [-53, 8, 26],
      [-53, -8, 26],
      [-2, -8, 42],
      [-2, -46, 42],
    ],
    [
      [-49, 8, 24],
      [-49, -10, 24],
      [94, -10, 38],
      [94, -22, 38],
    ],
    // From Step 2 Follower (3, 12) to Grip (-98, -26)
    [
      [3, 8, 24],
      [3, -4, 24],
      [-82, -4, 30],
      [-82, -26, 30],
    ],
    // From Step 3 Follower (48, 12) to ROM (-2, -26) and Printer (124, 38)
    [
      [48, 8, 24],
      [48, -2, 24],
      [14, -2, 30],
      [14, -26, 30],
    ],
    [
      [52, 12, 22],
      [92, 12, 22],
      [92, 34, 18],
      [114, 34, 18],
    ],
  ];

  for (const raw of routes) {
    const curve = G.fillet(raw, 4.5, 8, { P, tube: 1.5 });
    for (const part of tubePieces(curve, 1.45, P, { maxLength: 36, caps: true })) {
      out.push(tubeSvg(part, { tone: "mid" }));
    }
    // Flange collar at start
    const F0 = G.frameAlong(raw[0], G.sub3(raw[1], raw[0]));
    out.push(S(G.disc(-1.2, 1.2, 2.8, F0, P), { tone: "mid" }));
  }
  return out.join("");
}

// 4. Three Spring-Loaded Cam-Follower Plungers & Guide Bridge (24 solid parts)
function camFollowers() {
  const out = [];
  // Support pillars for the follower guide rail
  for (const px of [-92, -26, 26, 82]) {
    out.push(S(k.slabOf({ x: px - 4, y: 6, w: 8, d: 12, r: 1.5 }, 0, 26, P, 4, 0.5), { tone: "lo" }));
    out.push(S(k.cylinder(px, 12, 2.2, 26, 2, P, 16), { tone: "mid" }));
  }

  // Guide bridge bar across y = 12
  const bridge = { x: -96, y: 5, w: 184, d: 14, r: 2.5 };
  out.push(S(k.slabOf(bridge, 26, 7, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(bridge, 2), 33, P), { tone: "faint" }));

  // Render each of the 3 followers
  FOLLOWERS.forEach((f, idx) => {
    // Fixed guide bushing on bridge
    out.push(S(k.cylinder(f.x, f.y, 6.2, 33, 3.5, P, 28, 0.4), { tone: "mid" }));
    out.push(L(k.knurl(f.x, f.y, 6.2, 33.4, 36.2, 28, P, 0.2), { tone: "lo" }));

    // Return coil spring around plunger stem
    const spring = k.coil(16, 25.5, [f.x, f.y], 3.8, 6, "z", P);
    out.push(L(spring.back, { tone: "lo" }), L(spring.front, { tone: "mid" }));

    // Sensor IC manifold block behind each follower
    const chipBox = { x: f.x - 16, y: -3, w: 32, d: 8, r: 1.5 };
    out.push(S(k.slabOf(chipBox, 26, 5.5, P, 4, 0.4), { tone: "lo" }));
    out.push(k.faceTextSvg(k.topMatrix([f.x, 1.2], 31.6, P, "x"), f.name, { size: 2.1, tone: "hi", anchor: "middle" }));

    // Moving plunger group (lifted when its cam lobe is active)
    const initLift = idx === 0 ? LIFT_H : 0;
    const moving = [];
    // Lower cam roller tappet shoe
    moving.push(S(k.cylinder(f.x, f.y, 4.4, 8, 3.2, P, 24, 0.4), { tone: "hi", lit: true }));
    // Plunger vertical stem
    moving.push(S(k.cylinder(f.x, f.y, 2.3, 11.2, 27, P, 20), { tone: "hi", crease: "none", lit: true }));
    // Upper contact head & anvil cap
    moving.push(S(k.cylinder(f.x, f.y, 5.2, 38.2, 4.2, P, 28, 0.5), { tone: "hi", lit: true }));
    moving.push(S(k.cylinder(f.x, f.y, 2.6, 42.4, 2.2, P, 20), { tone: "hi", lit: true }));
    moving.push(D([at([f.x, f.y, 44.6])], { size: 0.55, tone: "hi" }));

    out.push(`<g data-follower="${idx}" transform="${k.translateAlong(P, [0, 0, initLift])}">${moving.join("")}</g>`);
  });

  return out.join("");
}

// 5. Master 30-Second Camshaft Drum turned with lathe.mjs (22 solid parts)
function masterCamshaft() {
  const out = [];
  const CAM_F = G.frameOf([0, CAM_Y, CAM_Z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

  // Left bearing pedestal at x = -118
  const leftPed = { x: -124, y: CAM_Y - 10, w: 12, d: 20, r: 2 };
  out.push(S(k.slabOf(leftPed, 0, CAM_Z + 8, P, 4, 0.6), { tone: "mid" }));
  out.push(S(G.ringBand(-125, -111, 5, 9.5, CAM_F, P), { tone: "mid" }));
  out.push(D(G.dotsOf(CAM_F, -118, 7.8, 8, P), { size: 0.4, tone: "hi" }));

  // Left governor flywheel & index wheel at x = -134..-126
  const flywheelProfile = [
    [-136, 4.5],
    [-134, 16.5],
    [-128, 16.5],
    [-126, 6.0],
  ];
  out.push(S(G.solidOf(flywheelProfile, CAM_F, P, { bevel: 0.5 }), { tone: "hi" }));
  out.push(L(G.ribsOf(CAM_F, -134, -128, 16.5, 28, P, { seams: true }), { tone: "lo" }));
  out.push(D(G.dotsOf(CAM_F, -131, 12.0, 12, P), { size: 0.45, tone: "mid" }));

  // Master stepped camshaft profile from s = -111 to s = 86
  // Lobe 1: [-102, -12] (0-15s), Lobe 2: [-12, 18] (15-20s), Lobe 3: [18, 78] (20-30s)
  const shaftProfile = [
    [-111, 4.6],
    [-104, 4.6],
    [-102, 11.8],
    [-14, 11.8],
    [-12, 6.2],
    [-10, 12.6],
    [16, 12.6],
    [18, 6.2],
    [20, 13.4],
    [78, 13.4],
    [80, 4.6],
    [88, 4.6],
  ];
  out.push(S(G.solidOf(shaftProfile, CAM_F, P, { bevel: 0.4 }), { tone: "hi" }));

  // Precision timing ribs on the 3 Cam Lobes
  out.push(L(G.ribsOf(CAM_F, -100, -16, 11.8, 24, P, { seams: true }), { tone: "lo" }));
  out.push(L(G.ribsOf(CAM_F, -9, 15, 12.6, 20, P, { twist: 0.18, seams: true }), { tone: "lo" }));
  out.push(L(G.ribsOf(CAM_F, 21, 76, 13.4, 24, P, { seams: true }), { tone: "lo" }));

  // Raised active cam tracks (collar bands under each follower)
  out.push(S(G.ringBand(-63, -51, 11.8, 13.8, CAM_F, P), { tone: "hi", lit: true }));
  out.push(S(G.ringBand(-3, 9, 12.6, 14.4, CAM_F, P), { tone: "hi", lit: true }));
  out.push(S(G.ringBand(42, 54, 13.4, 15.0, CAM_F, P), { tone: "hi", lit: true }));

  // Right bearing pedestal at x = 88
  const rightPed = { x: 84, y: CAM_Y - 10, w: 12, d: 20, r: 2 };
  out.push(S(k.slabOf(rightPed, 0, CAM_Z + 8, P, 4, 0.6), { tone: "mid" }));
  out.push(S(G.ringBand(83, 97, 5, 9.5, CAM_F, P), { tone: "mid" }));
  out.push(D(G.dotsOf(CAM_F, 90, 7.8, 8, P), { size: 0.4, tone: "hi" }));

  return out.join("");
}

// 6. Right-Side 80mm Thermal Receipt Cutter & Dispenser Station (14 solid parts)
function thermalPrinter() {
  const out = [];
  const box = { x: 108, y: 18, w: 46, d: 44, r: 4 };
  out.push(S(k.slabOf(box, 0, 28, P, 6, 1.0), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(box, 2.5), 28, 7, P, 5, 0.6), { tone: "hi" }));
  out.push(L(k.planOutline(k.insetPlan(box, 4.5), 35, P), { tone: "lo" }));

  // Internal 80mm thermal paper roll drum visible on top
  const ROLL_F = G.frameOf([131, 34, 36], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  out.push(S(G.ringBand(-12, 12, 3.2, 8.5, ROLL_F, P), { tone: "hi" }));
  out.push(L(G.ribsOf(ROLL_F, -11, 11, 8.5, 18, P, { seams: true }), { tone: "faint" }));

  // Guillotine auto-cutter bridge
  const cutter = { x: 114, y: 49, w: 34, d: 7, r: 1.5 };
  out.push(S(k.slabOf(cutter, 35, 5, P, 4, 0.4), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([131, 53.5], 40.2, P, "x"), "80mm CUTTER", { size: 2.1, tone: "hi", anchor: "middle" }));

  // Sliding 80mm Result Sheet Receipt emerging from front slot
  const receipt = [];
  const sheet = { x: 116, y: 58, w: 30, d: 22, r: 1 };
  receipt.push(S(k.slabOf(sheet, 22, 1.6, P, 3, 0.2), { tone: "hi", lit: true }));
  receipt.push(L(k.lineOnTop([119, 62], [143, 62], 23.7, P), { tone: "hi" }));
  receipt.push(L(k.lineOnTop([119, 66], [140, 66], 23.7, P), { tone: "mid" }));
  receipt.push(L(k.lineOnTop([119, 70], [142, 70], 23.7, P), { tone: "mid" }));
  receipt.push(L(k.lineOnTop([119, 74], [136, 74], 23.7, P), { tone: "lo" }));
  receipt.push(k.faceTextSvg(k.topMatrix([131, 77.5], 23.8, P, "x"), "32 BIOMARKERS", { size: 1.9, tone: "hi", anchor: "middle" }));

  out.push(`<g data-part="receipt" transform="${k.translateAlong(P, [0, -14, 0])}">${receipt.join("")}</g>`);
  return out.join("");
}

// 7. Front Graduated 0–30 Sec Brass Ruler Bar & Sliding Time-Cursor Carriage (12 solid parts)
function timeRulerAndCursor() {
  const out = [];
  // Guide rail supports
  for (const rx of [-114, 90]) {
    out.push(S(k.slabOf({ x: rx - 4, y: RULER_Y - 5, w: 8, d: 14, r: 1.5 }, 0, 10, P, 4, 0.4), { tone: "lo" }));
  }

  // Graduated 0–30 sec ruler bar
  const bar = { x: -110, y: RULER_Y - 4, w: 196, d: 12, r: 2 };
  out.push(S(k.slabOf(bar, 4, 5.5, P, 4, 0.5), { tone: "mid" }));

  // Ticks along X from X_ZERO (-102) to X_ZERO + X_SPAN (78): 30 seconds -> 6 units per second
  const ticks = k.topTicks(X_ZERO, X_ZERO + X_SPAN, 6, 5, RULER_Y - 3.2, 9.6, [2.4, 4.8], P, "x");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "hi" }));

  // Time labels at 0s, 15s, 20s, 30s
  for (const [sec, label] of [
    [0, "0s"],
    [15, "15s"],
    [20, "20s"],
    [30, "30s"],
  ]) {
    const tx = timeToX(sec);
    out.push(k.faceTextSvg(k.topMatrix([tx, RULER_Y + 5.6], 9.6, P, "x"), label, { size: 2.4, tone: "hi", anchor: "middle" }));
  }

  // Sliding Time-Cursor Carriage (moves along X from X_ZERO to X_ZERO + X_SPAN)
  const cursor = [];
  const car = { x: -9, y: RULER_Y - 6.5, w: 18, d: 16, r: 2 };
  cursor.push(S(k.slabOf(car, 6.5, 6.5, P, 4, 0.5), { tone: "hi", lit: true }));
  // Pointer finger reaching back to the camshaft
  cursor.push(S(k.slabOf({ x: -1.8, y: CAM_Y + 10, w: 3.6, d: RULER_Y - CAM_Y - 15, r: 1 }, 11, 3, P, 3, 0.3), { tone: "hi", lit: true }));
  // Knurled thumb knob on cursor
  cursor.push(S(k.cylinder(0, RULER_Y + 1.5, 4.2, 13, 3.5, P, 24, 0.4), { tone: "hi", lit: true }));
  cursor.push(L(k.knurl(0, RULER_Y + 1.5, 4.2, 13.3, 16.2, 20, P, 0.2), { tone: "lo" }));
  cursor.push(D([at([0, RULER_Y + 1.5, 16.5])], { size: 0.5, tone: "hi" }));

  out.push(`<g data-part="cursor" transform="${k.translateAlong(P, [timeToX(7.5), 0, 0])}">${cursor.join("")}</g>`);
  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "30-Second 3-Step One-Stop Measurement Cam Sequencer and 6-Domain 32-Biomarker Bank. A horizontal 0 to 30 second master camshaft with three stepped cam lobes lifts three spring-loaded cam followers in sequence (0-15s BIA/ECG/PPG/rPPG/Iris, 15-20s 80Hz Grip Load Cell, 20-30s MediaPipe 3D ROM/Balance & 80mm Receipt Cutter), locking six analog clinical domain gauges (32 biomarkers total) with zero hallucinated metrics.",
  body: [
    basePlate(),
    instrumentBank(),
    signalTubes(),
    camFollowers(),
    masterCamshaft(),
    thermalPrinter(),
    timeRulerAndCursor(),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const DOMAINS = ${JSON.stringify(DOMAINS)};
const FOLLOWERS = ${JSON.stringify(FOLLOWERS)};
const T_MIN = ${T_MIN}, T_MAX = ${T_MAX}, X_ZERO = ${X_ZERO}, X_SPAN = ${X_SPAN}, LIFT_H = ${LIFT_H};
const timeToX = (t) => X_ZERO + (t / T_MAX) * X_SPAN;

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const cursorEl = svg.querySelector('[data-part="cursor"]');
const receiptEl = svg.querySelector('[data-part="receipt"]');
const followerEls = FOLLOWERS.map((_, i) => svg.querySelector('[data-follower="' + i + '"]'));
const dialEls = DOMAINS.map((_, i) => svg.querySelector('[data-dial="' + i + '"]'));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function dialNeedleAt(idx, turn) {
  const d = DOMAINS[idx];
  const [x, y] = d.pos;
  const topZ = d.z + d.h + 0.3;
  const angle = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return lineOnTop(
    [x - Math.sin(angle) * 2.8, y + Math.cos(angle) * 2.8],
    [x + Math.sin(angle) * (d.r - 3.6), y - Math.cos(angle) * (d.r - 3.6)],
    topZ,
    P
  );
}

let t = 7.5, targetT = 7.5;
let frame = 0, last = 0, clock = 7.5, touring = !still.matches, visible = false, idleTimer = 0;

function draw() {
  const cx = timeToX(t);
  cursorEl.setAttribute("transform", translateAlong(P, [cx, 0, 0]));

  // Follower lifts based on active cam window
  FOLLOWERS.forEach((f, idx) => {
    let lift = 0;
    if (t >= f.t0 && t <= f.t1) {
      const edge = Math.min(t - f.t0, f.t1 - t, 0.8) / 0.8;
      lift = LIFT_H * Math.max(0.25, edge);
    }
    followerEls[idx].setAttribute("transform", translateAlong(P, [0, 0, lift]));
  });

  // 6 Domain dial needles lock in as t progresses through each step
  let lockedCount = 0;
  DOMAINS.forEach((d, idx) => {
    const f = FOLLOWERS[d.follower];
    const progress = clamp((t - f.t0) / Math.max(0.1, d.lockAt - f.t0), 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const turn = 0.06 + (d.targetTurn - 0.06) * eased;
    dialEls[idx].setAttribute("d", dialNeedleAt(idx, turn));
    if (t >= d.lockAt - 0.2) lockedCount += d.count;
  });

  // 80mm Thermal Receipt slides out during Step 3 (20s -> 30s)
  const slideProgress = clamp((t - 20) / 10, 0, 1);
  const slideY = -14 + slideProgress * 15;
  receiptEl.setAttribute("transform", translateAlong(P, [0, slideY, 0]));

  const stepIndex = t < 15 ? 0 : t < 20 ? 1 : 2;
  const active = FOLLOWERS[stepIndex];
  const text = "t = " + t.toFixed(1) + "s · " + active.name + " [" + active.chip + "] · " + lockedCount + " / 32 Biomarkers Locked (Hallucination 0%)";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", t.toFixed(1));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock = (clock + dt * 3.2) % (T_MAX + 3.0);
    targetT = Math.min(T_MAX, clock);
  }
  t = calm ? targetT : t + (targetT - t) * (1 - Math.exp(-dt / 0.18));
  if (Math.abs(targetT - t) < 0.02) t = targetT;
  draw();
  const settled = !touring && t === targetT;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (nextT) => {
  touring = false;
  targetT = clamp(nextT, T_MIN, T_MAX);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = targetT; run(); }, 4500);
  run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.14) / 0.72, 0, 1);
  steer(T_MIN + share * (T_MAX - T_MIN));
});

stage.addEventListener("keydown", (event) => {
  if (event.key === "1") { event.preventDefault(); steer(14.5); }
  else if (event.key === "2") { event.preventDefault(); steer(19.5); }
  else if (event.key === "3") { event.preventDefault(); steer(30.0); }
  else if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); steer(targetT + 2.5); }
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); steer(targetT - 2.5); }
  else if (event.key === "Home") { event.preventDefault(); steer(0); }
  else if (event.key === "End") { event.preventDefault(); steer(30); }
});

draw();
`;

const body = k.plateHtml({
  fig: "Fig 9",
  title: "30-Second Cam Sequencer & 32-Biomarker Bank",
  hint: "Scrub 0–30s or press 1 · 2 · 3 for each protocol step",
  readout: "t = 7.5s · STEP 1 (0–15s) [AD5940+MAX86150+OV2710] · 0 / 32 Biomarkers Locked",
  keys: [
    { mark: "lit", label: "Time cursor, active cam lobes, lifted followers, 6 domain needles & 80mm receipt" },
    { mark: "raised", label: "Step 1 (0–15s: 23종) · Step 2 (15–20s: 4종) · Step 3 (20–30s: 5종 & Cut)" },
  ],
  caption:
    "30초 3-Step 원스톱 측정 캠 시퀀서 & 6대 영역 32종 바이오마커 통합 계기판. 전면의 0~30초 마스터 캠샤프트가 회전하며 ① 0~15초(4극 발판+양손 핸드스틱+카메라 응시: 세포·체성분 8종, 심혈관 7종, 자율신경 5종, 동공·신경 3종 = 23종), ② 15~20초(오른손 3초 최대 악력: 근신경 악력·RFD 4종), ③ 20~30초(1m 후퇴 3D 관절 가동범위·외발서기 5종 및 80mm 감열지 자동 컷팅)를 순차 구동하여 단 하나의 가상 수치(Hallucination 0%) 없이 총 32종 실측 바이오마커 계기판을 잠급니다.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="30-Second Cam Sequencer: scrub pointer or press 1, 2, 3 to inspect the three measurement steps and 32 biomarkers" aria-valuemin="0" aria-valuemax="30" aria-valuenow="7.5">${svg}</div>`,
});

const outName = theme === "light" ? "fig-09-light.html" : "fig-09.html";
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Fig 9 · 30-Second Cam Sequencer & 32-Biomarker Bank", theme, body, script: kitScript() + live, width: 820 }));
console.log("wrote", outName);

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { glCamera } from "../../kit/gl.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import { kitScript, glScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;

const W = 740;
const H = 500;
const AZIMUTH = 39;
const ELEVATION = 33;

// Base metrology plate & world coordinates
const PLATE = { x: -162, y: -88, w: 324, d: 176, r: 10 };
const PLATE_H = 14;
const FOOT_H = 6;

// Left Station: Gate 0 — Heart MAX86150 Lead-I ECG Solenoid Hammer & Bifurcation Manifold
const ECG_PAD_L = { x: -152, y: 34, w: 28, d: 34, r: 4 };
const ECG_PAD_R = { x: -152, y: -64, w: 28, d: 34, r: 4 };
const ECG_BASE = { x: -146, y: -24, w: 48, d: 52, r: 4 };
const ECG_BASE_H = 16;
const SOLENOID = [-122, 2];
const SOLENOID_Z = ECG_BASE_H;
const SOLENOID_TOP = 76;
const MANIFOLD = { x: -108, y: -28, w: 22, d: 60, r: 3 };
const MANIFOLD_H = 34;

// Arterial Conduits:
// Branch A (Front, y = 22): Brachial-Radial Artery to Fingertip MAX86150 PPG Gate (L = 0.80 m)
// Branch B (Back, y = -16): Carotid-Facial Artery to Cheek OV2710 60fps rPPG Gate (L = 0.35 m)
const Y_FINGER = 22;
const Y_FACE = -16;
const Z_PIPE = 20;
const X_START = -86;
const X_VICE = -32;
const X_FACE_GATE = 14;
const X_FINGER_GATE = 56;

// Center Station: Arterial Wall Stiffness Tension Clamp (Moens-Korteweg Eh/2rρ Vice)
const VICE_BASE = { x: X_VICE - 18, y: -36, w: 36, d: 78, r: 3.5 };
const VICE_PILLAR_Y = [-29, 35];
const VICE_TOP_Z = 82;
const VICE_BRIDGE = { x: X_VICE - 12, y: -34, w: 24, d: 74, r: 2.5 };

// Optical Gates
const GATE_FACE_PLAN = { x: X_FACE_GATE - 11, y: Y_FACE - 14, w: 22, d: 28, r: 3 };
const GATE_FINGER_PLAN = { x: X_FINGER_GATE - 13, y: Y_FINGER - 15, w: 28, d: 32, r: 3.5 };

// Wave Oscilloscope Window on Front Plate
const SCOPE_BOX = { x: -78, y: 44, w: 112, d: 34, r: 3 };
const SCOPE_WIN = { x: -73, y: 48, w: 102, d: 26, r: 1.5 };
const SCOPE_H = 5;

// Right Station: Twin Split-Second Chronograph & Cuffless BP Manometer Console
const CONSOLE = { x: 80, y: -74, w: 72, d: 148, r: 5 };
const CONSOLE_H = 22;
const DIAL_PTT = [116, 28];
const DIAL_PTT_R = 26;
const DIAL_PTT_Z = CONSOLE_H;
const DIAL_PTT_H = 11;
const DIAL_PTT_TOP = DIAL_PTT_Z + DIAL_PTT_H;

const DIAL_PWV = [116, -24];
const DIAL_PWV_R = 17;
const DIAL_PWV_Z = CONSOLE_H;
const DIAL_PWV_H = 9;
const DIAL_PWV_TOP = DIAL_PWV_Z + DIAL_PWV_H;

// Cuffless BP Manometer Tower at Rear Right of Console
const MANO_BASE = { x: 84, y: -70, w: 30, d: 26, r: 3 };
const MANO_X = 99;
const MANO_Y = -57;
const MANO_Z0 = CONSOLE_H + 4;
const MANO_Z1 = 96;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [SOLENOID[0], SOLENOID[1], SOLENOID_TOP + 12],
    [X_VICE, 0, VICE_TOP_Z + 18],
    [MANO_X, MANO_Y, MANO_Z1 + 8],
    [DIAL_PTT[0] + DIAL_PTT_R, DIAL_PTT[1] + DIAL_PTT_R, DIAL_PTT_TOP + 4],
  ],
  W,
  H,
  { pad: 28, azimuth: AZIMUTH, elevation: ELEVATION },
);

const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 6, bevel = 0.6) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const AX_X = (o) => G.frameAlong(o, [1, 0, 0]);
const AX_Y = (o) => G.frameAlong(o, [0, 1, 0]);

function vcoil(cx, cy, z0, z1, r, turns) {
  const count = Math.round(turns * 24);
  const back = [];
  const front = [];
  let run = [];
  let near = null;
  for (let index = 0; index <= count; index++) {
    const share = index / count;
    const angle = share * turns * Math.PI * 2;
    const point = at([cx + r * Math.cos(angle), cy + r * Math.sin(angle), z0 + (z1 - z0) * share]);
    const facing = Math.cos(angle) * V[0] + Math.sin(angle) * V[1] > 0;
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(point);
      (near ? front : back).push(k.pathOf(run));
      run = [point];
      near = facing;
      continue;
    }
    run.push(point);
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

function boltFlangeX(x, y, z, rFlange, thick, rPipe) {
  const F = AX_X([x, y, z]);
  return (
    S(G.ringBand(0, thick, rPipe * 0.9, rFlange, F, P, { bevel: 0.35 }), { tone: "mid" }) +
    Dots(G.dotsOf(F, thick, rFlange - 1.3, 8, P, { fade: [0.05, 0.45] }), { size: 0.38, tone: "lo" }) +
    Ln(G.arcOf(F, thick * 0.5, rFlange, P), { tone: "faint" })
  );
}

// Physiological Moens-Korteweg & Bramwell-Hill Hemodynamic Model
function hemodynamicsOf(stiffnessShare) {
  const s = Math.max(0, Math.min(1, stiffnessShare));
  // PWV from 6.2 m/s (supple, Grade A) to 11.4 m/s (stiffened, Grade F)
  const pwv = 6.2 + s * 5.2;
  // Brachial-radial effective path L_finger = 0.80 m + pre-ejection PEP_0 (146 ms -> 88 ms)
  const pttFinger = Math.round(275 - s * 117);
  // Carotid-facial effective path L_face = 0.35 m + PEP
  const pttFace = Math.round(138 - s * 56);
  const deltaPtt = pttFinger - pttFace;
  // Cuffless BP calibrated via inverse PTT + PWV elasticity
  const sbp = Math.round(114 + s * 34);
  const dbp = Math.round(72 + s * 20);
  const grades = ["A (Elastic)", "B (Normal)", "C (Mild)", "D (Moderate)", "E (Stiff)", "F (Rigid)"];
  const apg = grades[Math.min(grades.length - 1, Math.floor(s * grades.length))];
  return { s, pwv, pttFinger, pttFace, deltaPtt, sbp, dbp, apg, spo2: 98 };
}

// ---------------------------------------------------------------------------
// LAYER 1: BACK SVG (Base Plate, Feet, ECG Pads, Solenoid Base, Manifold, Conduits, Vice Back, Console Base)
// ---------------------------------------------------------------------------
const back = [];

// 1. Halo + 6 Turned Levelling Feet (12 solid parts)
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
const FEET = byDepth([
  ...k.corners(PLATE, 24),
  [0, PLATE.y + 22],
  [0, PLATE.y + PLATE.d - 22],
]);
for (const [fx, fy] of FEET) {
  back.push(S(k.cylinder(fx, fy, 8.5, -PLATE_H - FOOT_H, 2.2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(fx, fy, 6.4, -PLATE_H - FOOT_H + 2.2, FOOT_H - 2.2, P, 28), { tone: "mid" }));
  back.push(Ln(k.knurl(fx, fy, 8.5, -PLATE_H - FOOT_H, -PLATE_H - FOOT_H + 2.2, 24, P), { tone: "lo" }));
}

// 2. Heavy Metrology Surface Plate + Grooves + Corner Screws + Side & Front Ruler Strips (8 solid/detail groups)
back.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5.5), 0, P), { tone: "lo" }));
const PLATE_SCREWS = [
  ...k.corners(PLATE, 11),
  [-54, PLATE.y + 10],
  [54, PLATE.y + 10],
  [-54, PLATE.y + PLATE.d - 10],
  [54, PLATE.y + PLATE.d - 10],
];
back.push(Ln(PLATE_SCREWS.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(PLATE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.52 }));

const SIDE_TICKS = k.sideTicks(PLATE.y + 20, PLATE.y + PLATE.d - 20, 8, 5, PLATE.x + PLATE.w, -2.2, [2.4, 4.8], P, "y");
back.push(Ln(SIDE_TICKS.minor, { tone: "lo" }), Ln(SIDE_TICKS.major, { tone: "mid" }));

// Front Metric Arterial Path Ruler Strip (L = 0 .. 800 mm)
const RULER_STRIP = { x: -138, y: PLATE.y + PLATE.d - 14, w: 208, d: 7.5, r: 1 };
back.push(S(slab(RULER_STRIP, 0, 0.8, 3, 0.2), { tone: "lo", crease: "none" }));
const RULER_TICKS = k.topTicks(RULER_STRIP.x + 4, RULER_STRIP.x + RULER_STRIP.w - 4, 4, 5, RULER_STRIP.y + 0.8, 0.8, [2.0, 3.8], P);
back.push(Ln(RULER_TICKS.minor, { tone: "lo" }), Ln(RULER_TICKS.major, { tone: "mid" }));
back.push(Dots([at([RULER_STRIP.x + 2.2, RULER_STRIP.y + 3.8, 0.8]), at([RULER_STRIP.x + RULER_STRIP.w - 2.2, RULER_STRIP.y + 3.8, 0.8])], { size: 0.42 }));

// Engraved Brass Nameplate at Rear-Left
const NAMEPLATE = { x: -148, y: -80, w: 68, d: 12, r: 1.5 };
back.push(S(slab(NAMEPLATE, 0, 1.0, 3, 0.2), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(NAMEPLATE, 1.4), 1.0, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([NAMEPLATE.x + 34, NAMEPLATE.y + 7.8], 1.0, P, "x"), "PTT · 1000HZ SYNC", { size: 3.2, tone: "lo", anchor: "middle" }));
back.push(Dots([at([NAMEPLATE.x + 2.5, NAMEPLATE.y + 6, 1.0]), at([NAMEPLATE.x + NAMEPLATE.w - 2.5, NAMEPLATE.y + 6, 1.0])], { size: 0.4 }));

// 3. Embedded Waveform Inspection Window (ECG R-Peak + Dual PPG Slope Comparator)
back.push(S(slab(SCOPE_BOX, 0, SCOPE_H, 4, 0.6), { tone: "mid" }));
back.push(S(slab(SCOPE_WIN, SCOPE_H - 0.8, 0.8, 3, 0), { tone: "lo", flat: true, crease: "none", className: "ptt-scope-bg" }));
back.push(Ln(k.planOutline(SCOPE_WIN, SCOPE_H, P, 3), { tone: "mid" }));
// Subtle graticule grid inside scope window
for (let gx = SCOPE_WIN.x + 12; gx < SCOPE_WIN.x + SCOPE_WIN.w - 4; gx += 12) {
  back.push(Ln(k.lineOnTop([gx, SCOPE_WIN.y + 1.5], [gx, SCOPE_WIN.y + SCOPE_WIN.d - 1.5], SCOPE_H, P), { tone: "faint" }));
}
for (let gy = SCOPE_WIN.y + 6.5; gy < SCOPE_WIN.y + SCOPE_WIN.d - 2; gy += 6.5) {
  back.push(Ln(k.lineOnTop([SCOPE_WIN.x + 1.5, gy], [SCOPE_WIN.x + SCOPE_WIN.w - 1.5, gy], SCOPE_H, P), { tone: "faint" }));
}
back.push(Dots(k.corners(SCOPE_BOX, 2.6).map(([x, y]) => at([x, y, SCOPE_H])), { size: 0.42 }));

// 4. Left Station: Lead-I ECG Thumb Electrode Pads (Right & Left Hand Dry Ag/AgCl Contacts)
function buildEcgPad(plan, labelText) {
  const out = [];
  out.push(S(slab(plan, 0, 5.5, 4, 0.6), { tone: "mid" }));
  const inner = k.insetPlan(plan, 3);
  out.push(S(slab(inner, 5.5, 2.2, 4, 0.4), { tone: "hi", crease: "lo" }));
  out.push(Ln(k.planOutline(k.insetPlan(inner, 2.2), 7.7, P, 3), { tone: "faint" }));
  // Contact micro-ridges
  for (let ry = inner.y + 5; ry <= inner.y + inner.d - 5; ry += 3.5) {
    out.push(Ln(k.lineOnTop([inner.x + 3, ry], [inner.x + inner.w - 3, ry], 7.7, P), { tone: "lo" }));
  }
  // Binding post & terminal nut
  const bx = plan.x + plan.w - 5;
  const by = plan.y + plan.d / 2;
  out.push(S(k.cylinder(bx, by, 2.6, 5.5, 4.5, P, 18), { tone: "mid" }));
  out.push(Ln(k.knurl(bx, by, 2.6, 6.2, 9.5, 14, P), { tone: "lo" }));
  out.push(Dots([at([bx, by, 10])], { size: 0.45, tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([inner.x + inner.w / 2, inner.y + inner.d - 2.2], 7.7, P, "x"), labelText, { size: 2.3, tone: "lo", anchor: "middle" }));
  return out.join("");
}
back.push(buildEcgPad(ECG_PAD_R, "RA-ECG"));
back.push(buildEcgPad(ECG_PAD_L, "LA-ECG"));

// 5. Gate 0: Heart MAX86150 Lead-I ECG Solenoid Hammer & Bifurcation Manifold (16 solid parts)
back.push(S(slab(ECG_BASE, 0, ECG_BASE_H, 5, 0.8), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(ECG_BASE, 3.2), ECG_BASE_H, P), { tone: "faint" }));
back.push(Dots(k.corners(ECG_BASE, 5).map(([x, y]) => at([x, y, ECG_BASE_H])), { size: 0.48 }));

// Braided ECG electrode lead wires into Gate 0 Base
for (const [py, targetY] of [[-47, -16], [51, 18]]) {
  const lead = tubePieces(
    G.fillet(
      [
        [-129, py, 7.5],
        [-122, py, 7.5],
        [-122, targetY, 4.5],
        [-122, targetY, 8.5],
      ],
      3,
      6,
    ),
    1.0,
    P,
    { maxLength: 14 },
  );
  for (const pc of lead) back.push(tubeSvg(pc, { tone: "mid" }));
}

// Solenoid Lower Stator & Cooling Fin Stack
const SF = UP([SOLENOID[0], SOLENOID[1], SOLENOID_Z]);
const SOL_PROFILE = [
  [0, 14.5],
  [4, 14.5],
  [4.8, 12.2, 1],
  [28, 12.2],
  [29, 14.0, 1],
  [34, 14.0],
  [35, 9.5, 1],
  [42, 9.5],
];
back.push(S(G.solidOf(SOL_PROFILE, SF, P, { bevel: 0.5 }), { tone: "hi", crease: "lo" }));
back.push(k.fadedSvg(G.ribsOf(SF, 6.5, 26.5, 12.2, 36, P, { fade: [0.08, 0.48], seams: true }), { tone: "lo" }));
back.push(Dots(G.dotsOf(SF, 2, 13.0, 12, P, { fade: [0.08, 0.48] }), { size: 0.42, tone: "mid" }));

// Recoil spring back half on solenoid plunger
const SOL_COIL = vcoil(SOLENOID[0], SOLENOID[1], SOLENOID_Z + 42, SOLENOID_TOP - 4, 5.2, 6);
back.push(Ln(SOL_COIL.back, { tone: "lo" }));

// Moving ECG R-Peak Solenoid Striker Cap (triggers down at t = 0 ms)
function buildSolenoidStriker() {
  const out = [];
  out.push(S(k.cylinder(SOLENOID[0], SOLENOID[1], 3.4, SOLENOID_Z + 38, 22, P, 24), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(SOLENOID[0], SOLENOID[1], 8.6, SOLENOID_TOP - 4, 6, P, 36, 0.6), { tone: "hi", crease: "lo" }));
  out.push(Ln(k.knurl(SOLENOID[0], SOLENOID[1], 8.6, SOLENOID_TOP - 3.4, SOLENOID_TOP + 1.4, 32, P), { tone: "lo" }));
  out.push(Ln(k.ring(SOLENOID[0], SOLENOID[1], 5.6, SOLENOID_TOP + 2, P, 24), { tone: "mid" }));
  out.push(Dots([at([SOLENOID[0], SOLENOID[1], SOLENOID_TOP + 2])], { size: 0.6, tone: "hi" }));
  return out.join("");
}
back.push(`<g data-part="ecg-striker">${buildSolenoidStriker()}</g>`);
back.push(Ln(SOL_COIL.front, { tone: "hi" }));

// Aortic Bifurcation Manifold Block & Pressure Chamber Dome
back.push(S(slab(MANIFOLD, 0, MANIFOLD_H, 5, 0.7), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(MANIFOLD, 2.5), MANIFOLD_H, P), { tone: "faint" }));
const DOME_F = UP([-97, 2, MANIFOLD_H]);
back.push(
  S(
    G.solidOf(
      [
        [0, 7.2],
        [3, 7.2],
        [4, 5.6, 1],
        [9, 5.2, 1],
        [12, 2.2, 1],
        [13, 0],
      ],
      DOME_F,
      P,
    ),
    { tone: "hi", crease: "lo" },
  ),
);
back.push(Dots(G.dotsOf(DOME_F, 1.5, 6.2, 8, P, { all: true }), { size: 0.4 }));
// Bleed valve on manifold front
back.push(boltFlangeX(X_START, Y_FACE, Z_PIPE, 6.4, 3.2, 3.2));
back.push(boltFlangeX(X_START, Y_FINGER, Z_PIPE, 6.4, 3.2, 3.2));

// 6. Center Station Back Half: Arterial Stiffness Tension Vice Base & Rear Pillar
back.push(S(slab(VICE_BASE, 0, 9, 5, 0.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(VICE_BASE, 2.5), 9, P), { tone: "faint" }));
back.push(Dots(k.corners(VICE_BASE, 4.5).map(([x, y]) => at([x, y, 9])), { size: 0.45 }));

// Rear Pillar (y = -29)
const PILLAR_R = 3.4;
back.push(S(k.cylinder(X_VICE, VICE_PILLAR_Y[0], 5.6, 9, 3.5, P, 24), { tone: "mid" }));
back.push(S(k.cylinder(X_VICE, VICE_PILLAR_Y[0], PILLAR_R, 12.5, VICE_TOP_Z - 12.5, P, 24), { tone: "mid", crease: "none" }));
back.push(Ln([28, 48, 68].map((z) => k.sideArc(X_VICE, VICE_PILLAR_Y[0], PILLAR_R, z, P, 14)).join(""), { tone: "faint" }));

// Lower Anvil Saddles under both arterial conduits inside the vice
for (const py of [Y_FACE, Y_FINGER]) {
  const anvil = { x: X_VICE - 9, y: py - 6.5, w: 18, d: 13, r: 1.5 };
  back.push(S(slab(anvil, 9, Z_PIPE - 3.2 - 9, 3, 0.4), { tone: "mid" }));
}

// 7. Two Branched Arterial Conduits (Branch B: Carotid-Facial L=0.35m, Branch A: Brachial-Radial L=0.80m)
// Support pedestals along conduits
for (const [px, py] of [
  [-60, Y_FACE],
  [-4, Y_FACE],
  [-60, Y_FINGER],
  [12, Y_FINGER],
]) {
  const ped = { x: px - 4.5, y: py - 5.5, w: 9, d: 11, r: 1.2 };
  back.push(S(slab(ped, 0, Z_PIPE - 3.0, 3, 0.4), { tone: "lo" }));
  back.push(boltFlangeX(px - 1.5, py, Z_PIPE, 5.2, 3.0, 3.1));
}

// Branch B Conduit (Carotid-Facial Artery -> Cheek rPPG Gate, y = Y_FACE)
const PIPE_FACE = tubePieces(
  [
    [X_START + 3.2, Y_FACE, Z_PIPE],
    [X_FACE_GATE - 11, Y_FACE, Z_PIPE],
  ],
  3.1,
  P,
  {
    maxLength: 16,
    gaps: [
      [-60 - (X_START + 3.2) - 1.5, -60 - (X_START + 3.2) + 1.5],
      [-4 - (X_START + 3.2) - 1.5, -4 - (X_START + 3.2) + 1.5],
    ],
    rings: { pitch: 3.2, fade: [0.1, 0.55], tone: "lo" },
  },
);
for (const pc of PIPE_FACE) back.push(tubeSvg(pc, { tone: "hi" }));

// Branch A Conduit (Brachial-Radial Artery -> Fingertip PPG Gate, y = Y_FINGER)
const PIPE_FINGER = tubePieces(
  [
    [X_START + 3.2, Y_FINGER, Z_PIPE],
    [X_FINGER_GATE - 13, Y_FINGER, Z_PIPE],
  ],
  3.2,
  P,
  {
    maxLength: 16,
    gaps: [
      [-60 - (X_START + 3.2) - 1.5, -60 - (X_START + 3.2) + 1.5],
      [12 - (X_START + 3.2) - 1.5, 12 - (X_START + 3.2) + 1.5],
    ],
    rings: { pitch: 3.2, fade: [0.1, 0.55], tone: "lo" },
  },
);
for (const pc of PIPE_FINGER) back.push(tubeSvg(pc, { tone: "hi" }));

// 8. Optical Gate B (Cheek OV2710 60fps Green-rPPG Pickup Housing at x = X_FACE_GATE, y = Y_FACE)
back.push(boltFlangeX(X_FACE_GATE - 13.5, Y_FACE, Z_PIPE, 5.8, 2.5, 3.1));
back.push(S(slab(GATE_FACE_PLAN, 0, 32, 4, 0.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(GATE_FACE_PLAN, 2.2), 32, P), { tone: "faint" }));
// Vertical optical camera column over Gate B
const GF_UP = UP([X_FACE_GATE, Y_FACE, 32]);
back.push(
  S(
    G.solidOf(
      [
        [0, 7.6],
        [4, 7.6],
        [4.8, 5.8, 1],
        [14, 5.8],
        [15, 7.2, 1],
        [19, 7.2],
      ],
      GF_UP,
      P,
      { bevel: 0.4 },
    ),
    { tone: "hi", crease: "lo" },
  ),
);
back.push(k.fadedSvg(G.ribsOf(GF_UP, 6, 13, 5.8, 24, P, { fade: [0.1, 0.5], seams: true }), { tone: "lo" }));
back.push(Dots([at([X_FACE_GATE, Y_FACE, 51])], { size: 0.55, tone: "hi" }));
back.push(k.faceTextSvg(k.topMatrix([GATE_FACE_PLAN.x + 11, GATE_FACE_PLAN.y + 4], 32, P, "x"), "rPPG · 0.35M", { size: 2.2, tone: "lo", anchor: "middle" }));

// 9. Optical Gate A (Fingertip MAX86150 660/880nm PPG Pickup Housing at x = X_FINGER_GATE, y = Y_FINGER)
back.push(boltFlangeX(X_FINGER_GATE - 15.5, Y_FINGER, Z_PIPE, 6.2, 2.5, 3.2));
back.push(S(slab(GATE_FINGER_PLAN, 0, 30, 5, 0.7), { tone: "mid" }));
const FINGER_CRADLE = k.insetPlan(GATE_FINGER_PLAN, 3.2);
back.push(S(slab(FINGER_CRADLE, 30, 4.5, 4, 0.5), { tone: "hi", crease: "lo" }));
back.push(Ln(k.planOutline(k.insetPlan(FINGER_CRADLE, 2), 34.5, P), { tone: "faint" }));
// Dual LED emitter domes (660nm Red + 880nm IR) & Photodiode window
for (const dx of [-4.5, 4.5]) {
  const ledF = UP([X_FINGER_GATE + dx, Y_FINGER, 34.5]);
  back.push(S(G.solidOf([[0, 3.2], [2.2, 3.2], [3.6, 1.8, 1], [4.4, 0]], ledF, P), { tone: "hi", crease: "lo" }));
  back.push(Dots([at([X_FINGER_GATE + dx, Y_FINGER, 39])], { size: 0.5, tone: "hi" }));
}
back.push(k.faceTextSvg(k.topMatrix([GATE_FINGER_PLAN.x + 14, GATE_FINGER_PLAN.y + 4.5], 30, P, "x"), "PPG · 0.80M", { size: 2.3, tone: "lo", anchor: "middle" }));

// Coaxial Timing Cables from Gate B and Gate A to Right Console
const CABLE_FACE = tubePieces(
  G.fillet(
    [
      [X_FACE_GATE + 11, Y_FACE, 16],
      [64, Y_FACE, 16],
      [64, -24, 12],
      [80, -24, 12],
    ],
    4,
    6,
  ),
  1.2,
  P,
  { maxLength: 14 },
);
for (const pc of CABLE_FACE) back.push(tubeSvg(pc, { tone: "mid" }));

const CABLE_FINGER = tubePieces(
  G.fillet(
    [
      [X_FINGER_GATE + 15, Y_FINGER, 15],
      [74, Y_FINGER, 15],
      [74, 28, 12],
      [80, 28, 12],
    ],
    4,
    6,
  ),
  1.2,
  P,
  { maxLength: 14 },
);
for (const pc of CABLE_FINGER) back.push(tubeSvg(pc, { tone: "mid" }));

// SVG Fallback Pulse Curves when WebGL is off
const startHemo = hemodynamicsOf(0.32);
back.push(
  `<g class="ptt-fallback">` +
    Ln(k.segment([X_START, Y_FACE, Z_PIPE + 3.5], [X_FACE_GATE - 11, Y_FACE, Z_PIPE + 3.5], P), { tone: "green", dashed: true, flow: true }) +
    Ln(k.segment([X_START, Y_FINGER, Z_PIPE + 3.5], [X_FINGER_GATE - 13, Y_FINGER, Z_PIPE + 3.5], P), { tone: "red", dashed: true, flow: true }) +
    `</g>`,
);

// ---------------------------------------------------------------------------
// LAYER 2: FRONT SVG (Vice Carriage, Springs, Lead Screw, Right Console, Chronograph Dials & Manometer)
// ---------------------------------------------------------------------------
const front = [];

// 10. Arterial Stiffness Vice Carriage (Moves vertically with stiffness s)
function buildViceCarriage() {
  const out = [];
  const cPlan = { x: X_VICE - 11, y: -33, w: 22, d: 72, r: 2 };
  out.push(S(slab(cPlan, 34, 8, 4, 0.5), { tone: "hi", crease: "lo" }));
  out.push(Ln(k.planOutline(k.insetPlan(cPlan, 2), 42, P), { tone: "faint" }));
  // Dual Elastance Compression Shoes pressing down onto Branch B and Branch A
  for (const py of [Y_FACE, Y_FINGER]) {
    const shoe = { x: X_VICE - 8, y: py - 5, w: 16, d: 10, r: 1.2 };
    out.push(S(slab(shoe, 25.5, 8.5, 3, 0.4), { tone: "mid" }));
    out.push(Dots([at([X_VICE - 4, py, 34]), at([X_VICE + 4, py, 34])], { size: 0.4, tone: "lo" }));
  }
  return out.join("");
}

const VICE_COIL_B = vcoil(X_VICE, Y_FACE, 42, VICE_TOP_Z - 7, 4.2, 6);
const VICE_COIL_A = vcoil(X_VICE, Y_FINGER, 42, VICE_TOP_Z - 7, 4.2, 6);
front.push(Ln(VICE_COIL_B.back, { tone: "lo" }), Ln(VICE_COIL_A.back, { tone: "lo" }));
front.push(`<g data-part="vice-carriage" transform="${k.translateAlong(P, [0, 0, -startHemo.s * 5.2])}">${buildViceCarriage()}</g>`);
front.push(Ln(VICE_COIL_B.front, { tone: "hi" }), Ln(VICE_COIL_A.front, { tone: "hi" }));

// Front Pillar (y = 35) with engraved APG Stiffness scale
front.push(S(k.cylinder(X_VICE, VICE_PILLAR_Y[1], 5.6, 9, 3.5, P, 24), { tone: "mid" }));
front.push(S(k.cylinder(X_VICE, VICE_PILLAR_Y[1], PILLAR_R, 12.5, VICE_TOP_Z - 12.5, P, 24), { tone: "mid", crease: "none" }));
front.push(Ln([24, 36, 48, 60, 72].map((z) => k.sideArc(X_VICE, VICE_PILLAR_Y[1], PILLAR_R, z, P, 14)).join(""), { tone: "lo" }));

// Vice Top Crosshead Bridge & Knurled Acme Lead-Screw Handwheel
front.push(S(slab(VICE_BRIDGE, VICE_TOP_Z - 6, 8, 4, 0.6), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(VICE_BRIDGE, 2.2), VICE_TOP_Z + 2, P), { tone: "faint" }));
for (const py of VICE_PILLAR_Y) {
  front.push(S(k.cylinder(X_VICE, py, 4.6, VICE_TOP_Z + 2, 3, P, 20, 0.4), { tone: "mid" }));
  front.push(Dots([at([X_VICE, py, VICE_TOP_Z + 5])], { size: 0.45 }));
}
// Central Acme Lead Screw & Handwheel
const WHEEL_F = UP([X_VICE, 3, VICE_TOP_Z + 2]);
front.push(S(G.disc(0, 9, 3.2, WHEEL_F, P), { tone: "mid" }));
front.push(k.fadedSvg(G.ribsOf(WHEEL_F, 1, 8, 3.2, 18, P, { fade: [0.1, 0.5], seams: true }), { tone: "lo" }));
front.push(S(k.cylinder(X_VICE, 3, 12.5, VICE_TOP_Z + 11, 5.5, P, 48, 0.6), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(X_VICE, 3, 12.5, VICE_TOP_Z + 11.5, VICE_TOP_Z + 16, 48, P), { tone: "lo" }));
front.push(Ln(k.ring(X_VICE, 3, 9.2, VICE_TOP_Z + 16.5, P, 36), { tone: "mid" }));
const wheelArmAt = (s) => {
  const a = (-135 + s * 270) * DEG;
  return k.lineOnTop([X_VICE + Math.sin(a) * 2, 3 - Math.cos(a) * 2], [X_VICE + Math.sin(a) * 10.5, 3 - Math.cos(a) * 10.5], VICE_TOP_Z + 16.6, P);
};
front.push(`<path data-part="vice-wheel" class="iso-line" data-tone="hi" d="${wheelArmAt(startHemo.s)}" style="stroke-width:1.1"/>`);
front.push(Dots([at([X_VICE, 3, VICE_TOP_Z + 16.6])], { size: 0.6, tone: "hi" }));

// 11. Right Station: Twin Chronograph & Cuffless BP Manometer Console (24 solid parts)
front.push(S(slab(CONSOLE, 0, CONSOLE_H, 6, 0.9), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(CONSOLE, 3.5), CONSOLE_H, P), { tone: "faint" }));
front.push(Dots(k.corners(CONSOLE, 6).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.48 }));

// Cooling louvres on console right wall
const slotOfY = (x, y0, y1, z, half) =>
  k.pathOf(
    [
      ...Array.from({ length: 7 }, (_, i) => [y1 - half + half * Math.sin((i / 6) * Math.PI), z + half * Math.cos((i / 6) * Math.PI)]),
      ...Array.from({ length: 7 }, (_, i) => [y0 + half - half * Math.sin((i / 6) * Math.PI), z - half * Math.cos((i / 6) * Math.PI)]),
    ].map(([y, zz]) => at([x, y, zz])),
    true,
  );
front.push(Ln([7, 11, 15].map((z) => slotOfY(CONSOLE.x + CONSOLE.w, 8, 46, z, 0.85)).join(""), { tone: "faint" }));

// Cuffless Blood Pressure Vertical Manometer Column (SBP / DBP mmHg at Rear-Right)
front.push(S(slab(MANO_BASE, CONSOLE_H, 4, 4, 0.5), { tone: "mid" }));
const MANO_PILLAR_L = [MANO_X - 7, MANO_Y];
const MANO_PILLAR_R = [MANO_X + 7, MANO_Y];
for (const [px, py] of [MANO_PILLAR_L, MANO_PILLAR_R]) {
  front.push(S(k.cylinder(px, py, 2.2, MANO_Z0, MANO_Z1 - MANO_Z0, P, 18), { tone: "mid", crease: "none" }));
}
// Central Manometer Glass/Steel Tube & Calibrated Scale Plate
const MANO_SCALE = { x: MANO_X - 5.5, y: MANO_Y - 1.5, w: 11, d: 3, r: 0.6 };
front.push(S(slab(MANO_SCALE, MANO_Z0, MANO_Z1 - MANO_Z0, 2, 0.3), { tone: "lo" }));
const MANO_TICKS = k.sideTicks(MANO_Z0 + 4, MANO_Z1 - 4, 3, 4, MANO_Y + 1.6, 0, [2.0, 3.6], P, "x");
// Custom horizontal ticks along the front of the manometer column
{
  const minor = [];
  const major = [];
  for (let z = MANO_Z0 + 4, idx = 0; z <= MANO_Z1 - 4; z += 3.2, idx++) {
    const len = idx % 4 === 0 ? 3.8 : 2.0;
    (idx % 4 === 0 ? major : minor).push(k.segment([MANO_X - 4.8, MANO_Y + 1.6, z], [MANO_X - 4.8 + len, MANO_Y + 1.6, z], P));
  }
  front.push(Ln(minor.join(""), { tone: "lo" }), Ln(major.join(""), { tone: "mid" }));
}
// Manometer Dynamic Mercury / Piston Column (rises with SBP)
function buildBpPiston(sbp) {
  const h = 14 + ((sbp - 100) / 60) * 38;
  return S(k.cylinder(MANO_X + 1.5, MANO_Y + 2.2, 2.8, MANO_Z0 + 2, h, P, 24), { tone: "hi", crease: "none" });
}
front.push(`<g data-part="bp-column">${buildBpPiston(startHemo.sbp)}</g>`);
// Manometer Top Cap
front.push(S(slab({ x: MANO_X - 10, y: MANO_Y - 4, w: 20, d: 8, r: 1.5 }, MANO_Z1, 4.5, 3, 0.5), { tone: "hi", crease: "lo" }));
front.push(Dots([at([MANO_PILLAR_L[0], MANO_PILLAR_L[1], MANO_Z1 + 4.5]), at([MANO_PILLAR_R[0], MANO_PILLAR_R[1], MANO_Z1 + 4.5])], { size: 0.45 }));

// Secondary Dial: Moens-Korteweg Pulse Wave Velocity (PWV m/s, x = 116, y = -24)
front.push(S(k.cylinder(DIAL_PWV[0], DIAL_PWV[1], DIAL_PWV_R, DIAL_PWV_Z, DIAL_PWV_H, P, 56, 0.7), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(DIAL_PWV[0], DIAL_PWV[1], DIAL_PWV_R, DIAL_PWV_TOP - 3, DIAL_PWV_TOP, 56, P, 0.3), { tone: "lo" }));
front.push(Ln(k.ring(DIAL_PWV[0], DIAL_PWV[1], DIAL_PWV_R - 2.0, DIAL_PWV_TOP, P, 48), { tone: "lo" }));
const PWV_TICKS = k.radialTicks(DIAL_PWV[0], DIAL_PWV[1], DIAL_PWV_R - 2.6, 30, 5, DIAL_PWV_TOP, [1.2, 2.5], P, -135 * DEG, 270 * DEG);
front.push(Ln(PWV_TICKS.minor, { tone: "lo" }), Ln(PWV_TICKS.major, { tone: "mid" }));
front.push(k.faceTextSvg(k.topMatrix([DIAL_PWV[0], DIAL_PWV[1] + 6.5], DIAL_PWV_TOP, P, "x"), "PWV M/S", { size: 2.3, tone: "lo", anchor: "middle" }));

const pwvNeedleAt = (pwv) => {
  const share = (pwv - 5.0) / 8.0;
  const a = (-135 + share * 270) * DEG;
  const [cx, cy] = DIAL_PWV;
  return k.lineOnTop([cx - Math.sin(a) * 2.5, cy + Math.cos(a) * 2.5], [cx + Math.sin(a) * (DIAL_PWV_R - 3.6), cy - Math.cos(a) * (DIAL_PWV_R - 3.6)], DIAL_PWV_TOP + 0.2, P);
};
front.push(`<path data-part="pwv-needle" class="iso-line" data-tone="hi" data-free="start" d="${pwvNeedleAt(startHemo.pwv)}" style="stroke-width:1.0"/>`);
front.push(Ln(k.ring(DIAL_PWV[0], DIAL_PWV[1], 1.5, DIAL_PWV_TOP + 0.2, P, 16), { tone: "mid" }));

// Primary Subject: Split-Second PTT Chronograph Dial (lit: true on needle & split-second rim)
front.push(S(k.cylinder(DIAL_PTT[0], DIAL_PTT[1], DIAL_PTT_R, DIAL_PTT_Z, DIAL_PTT_H, P, 72, 0.9), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(DIAL_PTT[0], DIAL_PTT[1], DIAL_PTT_R, DIAL_PTT_TOP - 3.6, DIAL_PTT_TOP, 84, P, 0.35), { tone: "lo" }));
front.push(Ln(k.sideArc(DIAL_PTT[0], DIAL_PTT[1], DIAL_PTT_R, DIAL_PTT_TOP - 3.6, P, 40), { tone: "faint" }));
// Lit split-second inner calibration ring (THE ONE LIT SUBJECT ELEMENT)
front.push(S(k.cylinder(DIAL_PTT[0], DIAL_PTT[1], DIAL_PTT_R - 2.4, DIAL_PTT_TOP, 0.8, P, 64), { tone: "hi", lit: true, crease: "none" }));
const PTT_TICKS = k.radialTicks(DIAL_PTT[0], DIAL_PTT[1], DIAL_PTT_R - 3.2, 60, 5, DIAL_PTT_TOP + 0.8, [1.4, 3.2], P);
front.push(Ln(PTT_TICKS.minor, { tone: "lo" }), Ln(PTT_TICKS.major, { tone: "mid" }));
// Inner sub-dial ring for Carotid-Cheek rPPG PTT
front.push(Ln(k.ring(DIAL_PTT[0], DIAL_PTT[1] - 6.5, 6.2, DIAL_PTT_TOP + 0.8, P, 32), { tone: "lo" }));
const SUB_TICKS = k.radialTicks(DIAL_PTT[0], DIAL_PTT[1] - 6.5, 5.8, 12, 3, DIAL_PTT_TOP + 0.8, [0.8, 1.5], P);
front.push(Ln(SUB_TICKS.minor, { tone: "faint" }), Ln(SUB_TICKS.major, { tone: "lo" }));
front.push(k.faceTextSvg(k.topMatrix([DIAL_PTT[0], DIAL_PTT[1] + 9.5], DIAL_PTT_TOP + 0.8, P, "x"), "PTT · 1MS", { size: 2.6, tone: "lo", anchor: "middle" }));

// Chronograph Start/Stop/Split Pushers on the side of the PTT bezel
for (const angleDeg of [-35, 0, 35]) {
  const rad = angleDeg * DEG;
  const px = DIAL_PTT[0] + Math.cos(rad) * (DIAL_PTT_R + 0.5);
  const py = DIAL_PTT[1] + Math.sin(rad) * (DIAL_PTT_R + 0.5);
  const PF = G.frameAlong([px, py, DIAL_PTT_Z + 5.5], [Math.cos(rad), Math.sin(rad), 0]);
  front.push(S(G.disc(0, 3.2, 1.8, PF, P), { tone: "mid" }));
  front.push(S(G.disc(3.2, 5.6, 2.6, PF, P, { bevel: 0.3 }), { tone: "hi", crease: "lo" }));
}

const pttNeedleAt = (pttMs) => {
  const turn = (pttMs - 120) / 220;
  const a = turn * Math.PI * 2;
  const [cx, cy] = DIAL_PTT;
  return k.lineOnTop([cx - Math.sin(a) * 4.2, cy + Math.cos(a) * 4.2], [cx + Math.sin(a) * (DIAL_PTT_R - 4.2), cy - Math.cos(a) * (DIAL_PTT_R - 4.2)], DIAL_PTT_TOP + 1.1, P);
};
const faceNeedleAt = (pttFaceMs) => {
  const turn = (pttFaceMs - 60) / 140;
  const a = turn * Math.PI * 2;
  const cx = DIAL_PTT[0];
  const cy = DIAL_PTT[1] - 6.5;
  return k.lineOnTop([cx - Math.sin(a) * 1.4, cy + Math.cos(a) * 1.4], [cx + Math.sin(a) * 4.8, cy - Math.cos(a) * 4.8], DIAL_PTT_TOP + 1.0, P);
};
front.push(`<path data-part="face-needle" class="iso-line" data-tone="mid" data-free="start" d="${faceNeedleAt(startHemo.pttFace)}" style="stroke-width:0.9"/>`);
front.push(`<path data-part="ptt-needle" class="iso-line" data-tone="lit" data-free="start" d="${pttNeedleAt(startHemo.pttFinger)}" style="stroke-width:1.35"/>`);
front.push(Ln(k.ring(DIAL_PTT[0], DIAL_PTT[1], 1.8, DIAL_PTT_TOP + 1.1, P, 18), { tone: "lit" }));

// ---------------------------------------------------------------------------
// WEBGL SHADER LAYER & LIVE INTERACTION
// ---------------------------------------------------------------------------
const CSS = `
.ptt .iso-plate { overflow: hidden; }
.ptt-stage {
  position: relative;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  cursor: ew-resize;
}
.ptt-stage[data-gl] .ptt-fallback { display: none; }
.ptt-stage > svg, .ptt-stage > canvas {
  display: block;
  width: 100%;
  height: auto;
}
.ptt-stage > .ptt-layer {
  position: absolute;
  inset: 0;
  height: 100% !important;
  pointer-events: none;
}
.iso:not([data-theme="light"]) .ptt-gl {
  mix-blend-mode: screen;
}
.ptt-scope-bg > .iso-fill {
  fill: var(--anatomy-shade-0);
}
`;

const LABEL_TEXT =
  "A dual-site Pulse Transit Time (PTT) and Pulse Wave Velocity (PWV) chronograph rig. On the left, a MAX86150 Lead-I ECG solenoid hammer fires at t = 0 ms on every R-peak into a bifurcation manifold feeding two arterial conduits: a 0.35 m carotid-facial branch to a 60 fps OV2710 rPPG optical gate, and a 0.80 m brachial-radial branch to a fingertip MAX86150 dual-wavelength PPG gate. A central knurled stiffness vice clamps both vessels to vary arterial elasticity (Moens-Korteweg PWV), while twin split-second chronograph dials and a cuffless blood pressure manometer column on the right measure PTT in milliseconds and SBP/DBP in mmHg.";

const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "ptt-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg ptt-layer ptt-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${front.join("")}</svg>`;
const stageHtml = `<div class="ptt-stage" tabindex="0" role="slider" aria-label="Arterial Stiffness & Dual-Site PTT Chronograph: move pointer horizontally or use Left/Right arrow keys to adjust arterial stiffness vice" aria-valuemin="6" aria-valuemax="11" aria-valuenow="8">${backSvg}<canvas class="ptt-layer ptt-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;

const GL_DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  xStart: X_START + 3.2,
  xFaceGate: X_FACE_GATE - 11,
  xFingerGate: X_FINGER_GATE - 13,
  yFace: Y_FACE,
  yFinger: Y_FINGER,
  zPipe: Z_PIPE,
  solenoid: SOLENOID,
  scopeWin: [SCOPE_WIN.x + 2, SCOPE_WIN.y + 2, SCOPE_WIN.x + SCOPE_WIN.w - 2, SCOPE_WIN.y + SCOPE_WIN.d - 2, SCOPE_H],
};

const LIVE = `
const DATA = ${JSON.stringify(GL_DATA)};
const P = DATA.P;
const root = document.querySelector(".ptt");
const stage = root.querySelector(".ptt-stage");
const canvas = stage.querySelector(".ptt-gl");
const readout = root.querySelector("[data-readout]");
const striker = stage.querySelector('[data-part="ecg-striker"]');
const viceCarriage = stage.querySelector('[data-part="vice-carriage"]');
const viceWheel = stage.querySelector('[data-part="vice-wheel"]');
const bpColumn = stage.querySelector('[data-part="bp-column"]');
const pwvNeedle = stage.querySelector('[data-part="pwv-needle"]');
const pttNeedle = stage.querySelector('[data-part="ptt-needle"]');
const faceNeedle = stage.querySelector('[data-part="face-needle"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const pale = !!root.closest('[data-theme="light"]');
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const hemodynamicsOf = ${hemodynamicsOf.toString()};
const wheelArmAt = (s) => {
  const a = (-135 + s * 270) * DEG;
  return lineOnTop([${X_VICE} + Math.sin(a) * 2, 3 - Math.cos(a) * 2], [${X_VICE} + Math.sin(a) * 10.5, 3 - Math.cos(a) * 10.5], ${VICE_TOP_Z + 16.6}, P);
};
const pwvNeedleAt = (pwv) => {
  const share = (pwv - 5.0) / 8.0;
  const a = (-135 + share * 270) * DEG;
  return lineOnTop([${DIAL_PWV[0]} - Math.sin(a) * 2.5, ${DIAL_PWV[1]} + Math.cos(a) * 2.5], [${DIAL_PWV[0]} + Math.sin(a) * ${DIAL_PWV_R - 3.6}, ${DIAL_PWV[1]} - Math.cos(a) * ${DIAL_PWV_R - 3.6}], ${DIAL_PWV_TOP + 0.2}, P);
};
const pttNeedleAt = (pttMs) => {
  const turn = (pttMs - 120) / 220;
  const a = turn * Math.PI * 2;
  return lineOnTop([${DIAL_PTT[0]} - Math.sin(a) * 4.2, ${DIAL_PTT[1]} + Math.cos(a) * 4.2], [${DIAL_PTT[0]} + Math.sin(a) * ${DIAL_PTT_R - 4.2}, ${DIAL_PTT[1]} - Math.cos(a) * ${DIAL_PTT_R - 4.2}], ${DIAL_PTT_TOP + 1.1}, P);
};
const faceNeedleAt = (pttFaceMs) => {
  const turn = (pttFaceMs - 60) / 140;
  const a = turn * Math.PI * 2;
  return lineOnTop([${DIAL_PTT[0]} - Math.sin(a) * 1.4, ${DIAL_PTT[1] - 6.5} + Math.cos(a) * 1.4], [${DIAL_PTT[0]} + Math.sin(a) * 4.8, ${DIAL_PTT[1] - 6.5} - Math.cos(a) * 4.8], ${DIAL_PTT_TOP + 1.0}, P);
};

const FRAGMENT = \`
uniform float uPhase;
uniform float uStiff;
uniform float uPale;
uniform vec4 uScope;
uniform float uScopeZ;
uniform vec3 uPipes; // xStart, xFaceGate, xFingerGate
uniform vec3 uPipeYZ; // yFace, yFinger, zPipe

float segGlow(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  float d = length(pa - ba * h);
  return exp(- (d * d) / (r * r));
}

void main() {
  vec2 vb = viewOf(gl_FragCoord.xy);
  vec3 pPipe = onFloor(vb, uPipeYZ.z);
  vec3 pScope = onFloor(vb, uScopeZ);

  // Speed scales with arterial stiffness (Moens-Korteweg PWV)
  float speed = mix(0.95, 1.68, uStiff);
  float pulseT = fract(uPhase);

  // 1. ECG R-Peak Solenoid Trigger Glow at t = 0
  float rPeakEnv = exp(-pulseT * 14.0) * smoothstep(0.0, 0.03, pulseT);
  vec2 solPos = vec2(-122.0, 2.0);
  float solGlow = exp(-dot(pPipe.xy - solPos, pPipe.xy - solPos) / 72.0) * rPeakEnv;

  // 2. Propagating Systolic Wave Packets along Branch B (Carotid-Face) & Branch A (Brachial-Finger)
  float x0 = uPipes.x;
  float xFace = uPipes.y;
  float xFinger = uPipes.z;

  float headB = x0 + pulseT * speed * 195.0;
  float inB = window(pPipe.x, x0, xFace, 2.0) * exp(-pow((pPipe.y - uPipeYZ.x) / 3.2, 2.0));
  float waveB = exp(-pow((pPipe.x - headB) / 14.0, 2.0)) * inB;
  float gateBHit = exp(-pow((headB - xFace) / 12.0, 2.0)) * exp(-dot(pPipe.xy - vec2(xFace + 4.0, uPipeYZ.x), pPipe.xy - vec2(xFace + 4.0, uPipeYZ.x)) / 52.0);

  float headA = x0 + pulseT * speed * 165.0;
  float inA = window(pPipe.x, x0, xFinger, 2.0) * exp(-pow((pPipe.y - uPipeYZ.y) / 3.4, 2.0));
  float waveA = exp(-pow((pPipe.x - headA) / 16.0, 2.0)) * inA;
  float gateAHit = exp(-pow((headA - xFinger) / 13.0, 2.0)) * exp(-dot(pPipe.xy - vec2(xFinger + 5.0, uPipeYZ.y), pPipe.xy - vec2(xFinger + 5.0, uPipeYZ.y)) / 58.0);

  // 3. Real-time Oscilloscope Window on Base Plate (ECG R-peak + Cheek rPPG + Finger PPG)
  float inScope = window(pScope.x, uScope.x, uScope.z, 1.0) * window(pScope.y, uScope.y, uScope.w, 1.0);
  float u = (pScope.x - uScope.x) / max(uScope.z - uScope.x, 1.0);
  float v = (pScope.y - uScope.y) / max(uScope.w - uScope.y, 1.0);
  float sweep = fract(u - uPhase);

  // ECG trace (top third)
  float ecgY = 0.25 - 0.16 * exp(-pow((u - 0.12) / 0.022, 2.0)) + 0.04 * exp(-pow((u - 0.24) / 0.05, 2.0));
  float ecgLine = exp(-pow((v - ecgY) / 0.032, 2.0)) * inScope;

  // Cheek rPPG trace (middle, shifted by PTT_face)
  float pttShiftB = mix(0.36, 0.21, uStiff);
  float rppgY = 0.54 - 0.13 * exp(-pow((u - 0.12 - pttShiftB) / 0.065, 2.0));
  float rppgLine = exp(-pow((v - rppgY) / 0.034, 2.0)) * inScope;

  // Finger PPG trace (bottom, shifted by PTT_finger)
  float pttShiftA = mix(0.68, 0.41, uStiff);
  float ppgY = 0.82 - 0.14 * exp(-pow((u - 0.12 - pttShiftA) / 0.075, 2.0));
  float ppgLine = exp(-pow((v - ppgY) / 0.034, 2.0)) * inScope;

  vec3 colRed = vec3(1.0, 0.34, 0.32);
  vec3 colGreen = vec3(0.28, 0.92, 0.58);
  vec3 colGold = vec3(1.0, 0.82, 0.35);

  vec3 light = colGold * (solGlow * 0.9 + ecgLine * 0.75)
             + colGreen * (waveB * 1.15 + gateBHit * 1.1 + rppgLine * 0.85)
             + colRed * (waveA * 1.2 + gateAHit * 1.15 + ppgLine * 0.9);

  if (uPale > 0.5) {
    float ink = clamp(length(light) * 0.52, 0.0, 0.82);
    vec3 paperCol = normalize(light + vec3(0.001)) * 0.72;
    gl_FragColor = vec4(paperCol * ink, ink);
  } else {
    vec3 c = tonemap(light, 1.35);
    float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
    gl_FragColor = vec4(c, a);
  }
}
\`;

const layer = glLayer({
  canvas,
  fragment: FRAGMENT,
  view: [DATA.W, DATA.H],
  camera: DATA.camera,
  uniforms: ["uPhase", "uStiff", "uPale", "uScope", "uScopeZ", "uPipes", "uPipeYZ"],
  fixed: {
    uPale: pale ? 1 : 0,
    uScope: DATA.scopeWin.slice(0, 4),
    uScopeZ: DATA.scopeWin[4],
    uPipes: [DATA.xStart, DATA.xFaceGate, DATA.xFingerGate],
    uPipeYZ: [DATA.yFace, DATA.yFinger, DATA.zPipe],
  },
});
if (layer) stage.setAttribute("data-gl", "");

let stiff = 0.32, targetStiff = 0.32;
let phase = 0.18, last = 0, frame = 0, touring = true, visible = false, idleTimer = 0;

function draw() {
  const h = hemodynamicsOf(stiff);
  // Striker pulse dip on R-peak
  const p = phase % 1;
  const strikeDip = Math.exp(-p * 16) * Math.sin(Math.min(1, p * 25) * Math.PI) * -3.2;
  striker.setAttribute("transform", translateAlong(P, [0, 0, strikeDip]));
  viceCarriage.setAttribute("transform", translateAlong(P, [0, 0, -stiff * 5.2]));
  viceWheel.setAttribute("d", wheelArmAt(stiff));
  pwvNeedle.setAttribute("d", pwvNeedleAt(h.pwv));
  pttNeedle.setAttribute("d", pttNeedleAt(h.pttFinger));
  faceNeedle.setAttribute("d", faceNeedleAt(h.pttFace));
  const bpLift = ((h.sbp - 125) / 60) * 14;
  bpColumn.setAttribute("transform", translateAlong(P, [0, 0, bpLift]));

  const text = \`PTT_finger \${h.pttFinger} ms · PTT_face \${h.pttFace} ms · PWV \${h.pwv.toFixed(1)} m/s · BP \${h.sbp}/\${h.dbp} mmHg · APG \${h.apg} · SpO2 \${h.spo2}%\`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", h.pwv.toFixed(1));
  stage.setAttribute("aria-valuetext", text);

  if (layer) {
    layer.draw({ uPhase: phase, uStiff: stiff }, phase);
  }
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 24) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !calm) {
    targetStiff = 0.5 + 0.42 * Math.sin(now * 0.00055);
  }
  stiff = calm ? targetStiff : stiff + (targetStiff - stiff) * (1 - Math.exp(-dt / 0.22));
  if (!calm) phase = (phase + dt * 1.15) % 1000;
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  targetStiff = clamp(next, 0, 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; run(); }, 4000);
  if (still.matches) { stiff = targetStiff; draw(); } else run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (e) => {
  const box = stage.getBoundingClientRect();
  const share = clamp(((e.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  steer(share);
});
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); steer(targetStiff + 0.08); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); steer(targetStiff - 0.08); }
  else if (e.key === "Home") { e.preventDefault(); steer(0); }
  else if (e.key === "End") { e.preventDefault(); steer(1); }
});

draw();
`;

const body = `<div class="ptt"><style>${CSS}</style>${k.plateHtml({
  fig: "Fig 5",
  title: "MAX86150(ECG+PPG) + 60fps rPPG 1ms 동기화 맥파전달시간(PTT/PWV) & 무커프 혈압 크로노그래프",
  hint: "Hover or press ←/→ to tighten the arterial stiffness vice (PWV 6.2 ↔ 11.4 m/s)",
  readout: `PTT_finger ${startHemo.pttFinger} ms · PTT_face ${startHemo.pttFace} ms · PWV ${startHemo.pwv.toFixed(1)} m/s · BP ${startHemo.sbp}/${startHemo.dbp} mmHg · APG ${startHemo.apg} · SpO2 98%`,
  keys: [
    { mark: "lit", label: "Split-second PTT chronograph needle & caliper bezel (Δt = t_PPG − t_ECG-R, 1 ms resolution)" },
    { mark: "red", label: "Brachial-radial arterial branch to fingertip MAX86150 660/880 nm PPG gate (L = 0.80 m)" },
    { mark: "green", label: "Carotid-facial arterial branch to cheek 60 fps OV2710 rPPG gate (L = 0.35 m)" },
    { mark: "raised", label: "Moens–Korteweg arterial stiffness vice (PWV = √(Eh / 2rρ)) & cuffless BP manometer column" },
  ],
  caption:
    "Camera-only rPPG kiosks suffer ±15 mmHg blood pressure error because they lack a t = 0 ms cardiac electrical fiducial point. CONNECT InBody AI locks MAX86150 Lead-I ECG R-peaks at 1000 Hz (Gate 0 solenoid hammer) against both fingertip 660/880 nm PPG (L = 0.80 m) and 60 fps facial rPPG (L = 0.35 m). Tightening the central arterial stiffness vice increases vascular elastance E, accelerating Pulse Wave Velocity (PWV = L / PTT) from 6.2 m/s (PTT_finger 275 ms, 114/72 mmHg, APG Grade A) to 11.4 m/s (PTT_finger 158 ms, 148/92 mmHg, APG Grade F) while isolating pre-ejection period (PEP) via the dual-site ΔPTT differential.",
  body: stageHtml,
})}</div>`;

const outName = theme === "light" ? "fig-05-light.html" : "fig-05.html";
writeFileSync(
  join(HERE, outName),
  k.pageHtml({
    title: "Fig 5 · Dual-Site PTT & PWV Cuffless Blood Pressure Chronograph",
    theme,
    body,
    script: kitScript() + glScript() + LIVE,
    width: 780,
  }),
);
console.log("wrote", outName);

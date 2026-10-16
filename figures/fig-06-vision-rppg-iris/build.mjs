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
const AZIMUTH = 38;
const ELEVATION = 32;

// Metrology Optical Bench Plate
const PLATE = { x: -164, y: -88, w: 328, d: 176, r: 10 };
const PLATE_H = 14;
const FOOT_H = 6;

// Optical Axis & Dovetail Rails
const Y_OPTIC = -4;
const Z_OPTIC = 38;
const RAIL_X0 = -144;
const RAIL_X1 = 68;
const RAIL_Y = [-22, 14];

// Left Station: Subject Gimbal Head, Spherical Eyeball & Pro/Anti-Saccade Stimulus Bar
const X_EYE = -118;
const EYE_R = 15.5;
const GIMBAL_BASE = { x: X_EYE - 16, y: Y_OPTIC - 26, w: 32, d: 52, r: 3.5 };
const STIM_BAR = { x: X_EYE - 8, y: Y_OPTIC - 34, w: 16, d: 68, r: 2 };
const STIM_Z = 74;

// Center Station: OV2710 60fps Telecentric Camera Barrel + UVC Manual Exposure Lock (AE/AWB Lock Pin)
const X_CAM_FRONT = -52;
const X_CAM_BACK = -4;
const CAM_PEDESTAL = { x: -48, y: Y_OPTIC - 20, w: 40, d: 40, r: 3 };

// Right-Center: RGB Dichroic Beam-Splitter Prism Chamber
const X_PRISM = 34;
const PRISM_BASE = { x: X_PRISM - 18, y: Y_OPTIC - 22, w: 36, d: 44, r: 3.5 };
const PRISM_H = 48;

// Right Station: POS / TS-CAN Rotary Drum Plotter & Iris Saccade Latency Chronograph
const CONSOLE = { x: 76, y: -76, w: 76, d: 152, r: 5 };
const CONSOLE_H = 20;
const DRUM_POS = [112, -36];
const DRUM_R = 17.5;
const DRUM_Z = CONSOLE_H + 3;
const DRUM_H = 34;

const DIAL_SAC = [114, 30];
const DIAL_SAC_R = 25;
const DIAL_SAC_Z = CONSOLE_H;
const DIAL_SAC_H = 11;
const DIAL_SAC_TOP = DIAL_SAC_Z + DIAL_SAC_H;

// Front Optical Inspection Window (540nm Green BVP Waveform + Saccade Step Trace)
const WIN_BOX = { x: -84, y: 40, w: 142, d: 38, r: 3 };
const WIN_GLASS = { x: -79, y: 44, w: 132, d: 30, r: 1.5 };
const WIN_H = 5;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [X_EYE, Y_OPTIC - 34, STIM_Z + 12],
    [X_CAM_FRONT, Y_OPTIC, Z_OPTIC + 32],
    [DRUM_POS[0], DRUM_POS[1], DRUM_Z + DRUM_H + 8],
    [DIAL_SAC[0] + DIAL_SAC_R, DIAL_SAC[1] + DIAL_SAC_R, DIAL_SAC_TOP + 5],
  ],
  W,
  H,
  { pad: 28, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 6, bevel = 0.6) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const AX_X = (o) => G.frameAlong(o, [1, 0, 0]);

// Vision rPPG + Iris Saccade Physiological & Cognitive Model
function visionStateOf(share, aeLocked = true) {
  const s = Math.max(0, Math.min(1, share));
  // Saccade latency from 198 ms (normal alert executive function) to 386 ms (frontal fatigue / MCI risk)
  const latencyMs = Math.round(198 + s * 188);
  // Heart rate & autonomic HRV derived from 540 nm Green channel POS algorithm
  const hr = Math.round(64 + s * 22);
  const rmssd = Math.round(48 - s * 29);
  const lfhf = (1.1 + s * 2.4).toFixed(1);
  const snrDb = aeLocked ? (14.8 - s * 1.6).toFixed(1) : (2.1 - s * 0.8).toFixed(1);
  const stateLabel = s < 0.38 ? "Normal Executive" : s < 0.72 ? "Mild Delay" : "Fatigue / MCI Watch";
  return {
    s,
    aeLocked,
    latencyMs,
    hr,
    rmssd,
    lfhf,
    snrDb,
    stateLabel,
  };
}

// ---------------------------------------------------------------------------
// LAYER 1: BACK SVG (Bench Plate, Feet, Dovetail Rails, Eyeball Gimbal Rig, Camera Barrel, Prism Chamber, Console Base)
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

// 2. Metrology Bench Plate + Grooves + Corner Screws + Ruler Strip
back.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.6), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5.5), 0, P), { tone: "lo" }));
const PLATE_SCREWS = [
  ...k.corners(PLATE, 11),
  [-56, PLATE.y + 10],
  [56, PLATE.y + 10],
  [-56, PLATE.y + PLATE.d - 10],
  [56, PLATE.y + PLATE.d - 10],
];
back.push(Ln(PLATE_SCREWS.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(PLATE_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.52 }));

const SIDE_TICKS = k.sideTicks(PLATE.y + 20, PLATE.y + PLATE.d - 20, 8, 5, PLATE.x + PLATE.w, -2.2, [2.4, 4.8], P, "y");
back.push(Ln(SIDE_TICKS.minor, { tone: "lo" }), Ln(SIDE_TICKS.major, { tone: "mid" }));

const RULER_STRIP = { x: -146, y: PLATE.y + PLATE.d - 14, w: 214, d: 7.5, r: 1 };
back.push(S(slab(RULER_STRIP, 0, 0.8, 3, 0.2), { tone: "lo", crease: "none" }));
const RULER_TICKS = k.topTicks(RULER_STRIP.x + 4, RULER_STRIP.x + RULER_STRIP.w - 4, 4, 5, RULER_STRIP.y + 0.8, 0.8, [2.0, 3.8], P);
back.push(Ln(RULER_TICKS.minor, { tone: "lo" }), Ln(RULER_TICKS.major, { tone: "mid" }));
back.push(Dots([at([RULER_STRIP.x + 2.2, RULER_STRIP.y + 3.8, 0.8]), at([RULER_STRIP.x + RULER_STRIP.w - 2.2, RULER_STRIP.y + 3.8, 0.8])], { size: 0.42 }));

// Engraved Brass Nameplate
const NAMEPLATE = { x: -152, y: -80, w: 76, d: 12, r: 1.5 };
back.push(S(slab(NAMEPLATE, 0, 1.0, 3, 0.2), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(NAMEPLATE, 1.4), 1.0, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([NAMEPLATE.x + 38, NAMEPLATE.y + 7.8], 1.0, P, "x"), "OV2710 · 60FPS AE-LOCK", { size: 3.1, tone: "lo", anchor: "middle" }));
back.push(Dots([at([NAMEPLATE.x + 2.5, NAMEPLATE.y + 6, 1.0]), at([NAMEPLATE.x + NAMEPLATE.w - 2.5, NAMEPLATE.y + 6, 1.0])], { size: 0.4 }));

// 3. Precision Dovetail Optical Bench Rails & End Stops
for (const ry of RAIL_Y) {
  const rPlan = { x: RAIL_X0, y: ry - 2.8, w: RAIL_X1 - RAIL_X0, d: 5.6, r: 1 };
  back.push(S(slab(rPlan, 0, 4.5, 3, 0.5), { tone: "mid" }));
  back.push(Dots([-136, -84, -32, 20, 60].map((x) => at([x, ry, 4.5])), { size: 0.42 }));
}
for (const rx of [RAIL_X0 - 5, RAIL_X1]) {
  const stopPlan = { x: rx, y: RAIL_Y[0] - 5, w: 5, d: RAIL_Y[1] - RAIL_Y[0] + 10, r: 1.2 };
  back.push(S(slab(stopPlan, 0, 8, 3, 0.5), { tone: "mid" }));
  back.push(Dots([at([rx + 2.5, RAIL_Y[0], 8]), at([rx + 2.5, RAIL_Y[1], 8])], { size: 0.45 }));
}

// 4. Embedded BVP + Saccade Inspection Window on Front Bench
back.push(S(slab(WIN_BOX, 0, WIN_H, 4, 0.6), { tone: "mid" }));
back.push(S(slab(WIN_GLASS, WIN_H - 0.8, 0.8, 3, 0), { tone: "lo", flat: true, crease: "none", className: "vis-scope-bg" }));
back.push(Ln(k.planOutline(WIN_GLASS, WIN_H, P, 3), { tone: "mid" }));
for (let gx = WIN_GLASS.x + 14; gx < WIN_GLASS.x + WIN_GLASS.w - 4; gx += 14) {
  back.push(Ln(k.lineOnTop([gx, WIN_GLASS.y + 1.5], [gx, WIN_GLASS.y + WIN_GLASS.d - 1.5], WIN_H, P), { tone: "faint" }));
}
for (let gy = WIN_GLASS.y + 7.5; gy < WIN_GLASS.y + WIN_GLASS.d - 2; gy += 7.5) {
  back.push(Ln(k.lineOnTop([WIN_GLASS.x + 1.5, gy], [WIN_GLASS.x + WIN_GLASS.w - 1.5, gy], WIN_H, P), { tone: "faint" }));
}
back.push(Dots(k.corners(WIN_BOX, 2.8).map(([x, y]) => at([x, y, WIN_H])), { size: 0.42 }));

// 5. Left Station: Subject Gimbal Head & Mechanical Iris Eyeball Rig (18 solid parts)
back.push(S(slab(GIMBAL_BASE, 4.5, 7.5, 5, 0.7), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(GIMBAL_BASE, 2.5), 12, P), { tone: "faint" }));
back.push(Dots(k.corners(GIMBAL_BASE, 4).map(([x, y]) => at([x, y, 12])), { size: 0.45 }));

// Rear Gimbal Fork Pillar (y = Y_OPTIC - 22)
const FORK_Y_BACK = Y_OPTIC - 22;
const FORK_Y_FRONT = Y_OPTIC + 22;
back.push(S(slab({ x: X_EYE - 5, y: FORK_Y_BACK - 3, w: 10, d: 6, r: 1.2 }, 12, STIM_Z - 12, 3, 0.5), { tone: "mid" }));
// Trunnion bearing on rear fork
back.push(S(G.disc(-3, 3, 4.2, G.frameAlong([X_EYE, FORK_Y_BACK, Z_OPTIC], [0, 1, 0]), P), { tone: "mid" }));

// Outer Brass Gimbal Ring around Eyeball
const EYE_F = AX_X([X_EYE, Y_OPTIC, Z_OPTIC]);
back.push(S(G.ringBand(-3.5, 3.5, EYE_R + 2.2, EYE_R + 5.2, EYE_F, P, { bevel: 0.4 }), { tone: "mid" }));
back.push(Dots(G.dotsOf(EYE_F, 3.5, EYE_R + 3.7, 12, P, { fade: [0.05, 0.45] }), { size: 0.4, tone: "lo" }));

// Turned Spherical Sclera Eyeball (G.sphereOf)
back.push(S(G.sphereOf([X_EYE, Y_OPTIC, Z_OPTIC], EYE_R, P, { steps: 56 }), { tone: "hi" }));
back.push(Ln(G.arcOf(EYE_F, 0, EYE_R, P), { tone: "lo" }));

// Moving Iris & Pupil Optical Ring on front of Eyeball (lit: true — tracks saccade target!)
function buildIrisUnit() {
  const out = [];
  const IF = AX_X([X_EYE + EYE_R - 2.2, Y_OPTIC, Z_OPTIC]);
  out.push(S(G.ringBand(0, 2.8, 3.2, 7.8, IF, P, { bevel: 0.4 }), { tone: "hi", lit: true }));
  out.push(S(G.disc(0, 3.2, 3.2, IF, P), { tone: "mid" }));
  out.push(Ln(G.spokesOf(IF, 2.8, 3.4, 7.4, 16, P), { tone: "lo" }));
  out.push(Dots([at([X_EYE + EYE_R + 1.1, Y_OPTIC - 1.5, Z_OPTIC + 1.8])], { size: 0.65, tone: "hi" }));
  return out.join("");
}
back.push(`<g data-part="iris-assembly">${buildIrisUnit()}</g>`);

// Malar Cheek Micro-Vascular Perfusion Reference Pad below Gimbal
const MALAR_PAD = { x: X_EYE + 8, y: Y_OPTIC - 12, w: 14, d: 24, r: 2.5 };
back.push(S(slab(MALAR_PAD, 12, 5.5, 4, 0.5), { tone: "hi", crease: "lo" }));
back.push(Ln(k.planOutline(k.insetPlan(MALAR_PAD, 2), 17.5, P), { tone: "green" }));
back.push(k.faceTextSvg(k.topMatrix([MALAR_PAD.x + 7, MALAR_PAD.y + 12], 17.5, P, "y"), "540NM ROI", { size: 2.1, tone: "lo", anchor: "middle" }));

// Front Gimbal Fork Pillar (y = Y_OPTIC + 22)
back.push(S(slab({ x: X_EYE - 5, y: FORK_Y_FRONT - 3, w: 10, d: 6, r: 1.2 }, 12, STIM_Z - 12, 3, 0.5), { tone: "mid" }));
back.push(S(G.disc(-3, 3, 4.2, G.frameAlong([X_EYE, FORK_Y_FRONT, Z_OPTIC], [0, 1, 0]), P), { tone: "mid" }));

// Top Horizontal Saccade Stimulus Rail (Pro-Saccade / Anti-Saccade LED Target Bar)
back.push(S(slab(STIM_BAR, STIM_Z, 5, 4, 0.5), { tone: "mid" }));
const STIM_TICKS = k.topTicks(STIM_BAR.y + 6, STIM_BAR.y + STIM_BAR.d - 6, 4, 4, STIM_BAR.x + 1.2, STIM_Z + 5, [1.6, 3.0], P, "y");
back.push(Ln(STIM_TICKS.minor, { tone: "lo" }), Ln(STIM_TICKS.major, { tone: "mid" }));
// Fixed Left & Right LED Target Posts
for (const ty of [Y_OPTIC - 24, Y_OPTIC + 24]) {
  back.push(S(k.cylinder(X_EYE, ty, 3.4, STIM_Z + 5, 4, P, 20), { tone: "mid" }));
  back.push(Dots([at([X_EYE, ty, STIM_Z + 9])], { size: 0.55, tone: "hi" }));
}
// SlidingLit Saccade Stimulus Flag on Top Rail
function buildStimulusFlag() {
  const flagPlan = { x: X_EYE - 4.5, y: Y_OPTIC - 4, w: 9, d: 8, r: 1.2 };
  return (
    S(slab(flagPlan, STIM_Z + 5, 5.5, 3, 0.4), { tone: "hi", lit: true }) +
    Dots([at([X_EYE, Y_OPTIC, STIM_Z + 10.5])], { size: 0.6, tone: "hi" })
  );
}
back.push(`<g data-part="stimulus-flag">${buildStimulusFlag()}</g>`);

// 6. Center Station: OV2710 60fps Telecentric Camera Barrel & UVC Manual Exposure Lock (18 solid parts)
back.push(S(slab(CAM_PEDESTAL, 4.5, 11.5, 5, 0.7), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(CAM_PEDESTAL, 2.5), 16, P), { tone: "faint" }));
// Saddle Cradle under Camera Barrel
back.push(S(slab({ x: -38, y: Y_OPTIC - 13, w: 22, d: 26, r: 2 }, 16, 8, 4, 0.5), { tone: "mid" }));

// Multi-Element Turned Lens Barrel along X Axis (from X_CAM_FRONT = -52 to X_CAM_BACK = -4)
const CAM_F = AX_X([X_CAM_FRONT, Y_OPTIC, Z_OPTIC]);
const CAM_LEN = X_CAM_BACK - X_CAM_FRONT; // 48 units
const CAM_PROFILE = [
  [0, 17.5],
  [5, 17.5],
  [6, 15.2, 1],
  [18, 15.2],
  [19, 16.6, 1],
  [29, 16.6],
  [30, 14.0, 1],
  [41, 14.0],
  [42, 16.0, 1],
  [48, 16.0],
];
back.push(S(G.solidOf(CAM_PROFILE, CAM_F, P, { bevel: 0.55 }), { tone: "hi", crease: "lo" }));
// Objective lens recessed glass element at s = 1
back.push(S(G.disc(0, 1.2, 14.2, CAM_F, P), { tone: "lo" }));
back.push(Ln(G.arcOf(CAM_F, 0.5, 14.2, P), { tone: "mid" }));
// Knurled Focus Ring (s = 7..17) & Aperture Ring (s = 20..28)
back.push(k.fadedSvg(G.ribsOf(CAM_F, 7.5, 16.5, 15.2, 42, P, { fade: [0.08, 0.48], seams: true }), { tone: "lo" }));
back.push(k.fadedSvg(G.ribsOf(CAM_F, 20.5, 27.5, 16.6, 44, P, { fade: [0.08, 0.48], seams: true }), { tone: "lo" }));
// Heatsink ribs on rear OV2710 sensor housing (s = 32..40)
for (const s of [33, 35.5, 38]) {
  back.push(Ln(G.arcOf(CAM_F, s, 14.1, P), { tone: "lo" }));
}
back.push(Dots(G.dotsOf(CAM_F, 45, 16.0, 12, P, { fade: [0.08, 0.48] }), { size: 0.42, tone: "mid" }));

// Physical UVC Manual Exposure Lock Latch (AE/AWB Lock Pin on top of Aperture Ring at x = -28)
const AE_MOUNT = { x: -33, y: Y_OPTIC - 6, w: 12, d: 12, r: 1.5 };
back.push(S(slab(AE_MOUNT, Z_OPTIC + 15.5, 6, 3, 0.4), { tone: "mid" }));
function buildAeLockPin() {
  const out = [];
  out.push(S(k.cylinder(-27, Y_OPTIC, 2.6, Z_OPTIC + 21.5, 9, P, 20), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(-27, Y_OPTIC, 6.2, Z_OPTIC + 29, 4.5, P, 28, 0.5), { tone: "hi", lit: true }));
  out.push(Ln(k.knurl(-27, Y_OPTIC, 6.2, Z_OPTIC + 29.4, Z_OPTIC + 33, 24, P), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([-27, Y_OPTIC + 0.8], Z_OPTIC + 33.5, P, "x"), "AE", { size: 2.4, tone: "hi", anchor: "middle" }));
  return out.join("");
}
back.push(`<g data-part="ae-latch">${buildAeLockPin()}</g>`);

// Collimated Exit Tube from Rear of Camera into RGB Dichroic Prism Chamber
const COLLIMATOR_F = AX_X([X_CAM_BACK, Y_OPTIC, Z_OPTIC]);
back.push(S(G.disc(0, X_PRISM - 18 - X_CAM_BACK, 5.4, COLLIMATOR_F, P, { bevel: 0.3 }), { tone: "mid" }));

// 7. Right-Center: RGB Dichroic Prism Splitter Chamber (Splits facial light into R, G-540nm, B waveguides)
back.push(S(slab(PRISM_BASE, 0, PRISM_H, 5, 0.8), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(PRISM_BASE, 2.8), PRISM_H, P), { tone: "faint" }));
// Internal 45-degree Dichroic Prism Turret Cap on top
const PRISM_TOP_F = UP([X_PRISM, Y_OPTIC, PRISM_H]);
back.push(
  S(
    G.solidOf(
      [
        [0, 13.5],
        [3.5, 13.5],
        [4.5, 10.5, 1],
        [10, 10.5],
        [11, 6.5, 1],
        [13, 0],
      ],
      PRISM_TOP_F,
      P,
      { bevel: 0.4 },
    ),
    { tone: "hi", crease: "lo" },
  ),
);
back.push(Dots(G.dotsOf(PRISM_TOP_F, 1.8, 12.0, 8, P, { all: true }), { size: 0.42 }));
back.push(k.faceTextSvg(k.topMatrix([PRISM_BASE.x + 18, PRISM_BASE.y + 5], PRISM_H, P, "x"), "RGB PRISM", { size: 2.3, tone: "lo", anchor: "middle" }));

// Three Physical Optical Waveguide Conduits exiting Prism to Console (R: 640nm, G: 540nm Hemoglobin Peak, B: 460nm)
const WAVEGUIDE_R = tubePieces(
  G.fillet(
    [
      [X_PRISM + 18, Y_OPTIC - 10, 34],
      [62, Y_OPTIC - 18, 34],
      [62, -48, 22],
      [76, -48, 22],
    ],
    4,
    6,
  ),
  1.6,
  P,
  { maxLength: 14 },
);
for (const pc of WAVEGUIDE_R) back.push(tubeSvg(pc, { tone: "red" }));

const WAVEGUIDE_G = tubePieces(
  G.fillet(
    [
      [X_PRISM + 18, Y_OPTIC, 28],
      [64, Y_OPTIC, 28],
      [64, -26, 22],
      [76, -26, 22],
    ],
    4,
    6,
  ),
  2.2,
  P,
  { maxLength: 14, rings: { pitch: 2.8, fade: [0.1, 0.55], tone: "green" } },
);
for (const pc of WAVEGUIDE_G) back.push(tubeSvg(pc, { tone: "green" }));

const WAVEGUIDE_B = tubePieces(
  G.fillet(
    [
      [X_PRISM + 18, Y_OPTIC + 10, 22],
      [62, Y_OPTIC + 16, 22],
      [62, 18, 16],
      [76, 18, 16],
    ],
    4,
    6,
  ),
  1.6,
  P,
  { maxLength: 14 },
);
for (const pc of WAVEGUIDE_B) back.push(tubeSvg(pc, { tone: "blue" }));

// SVG Fallback Optical Cone & RGB Beams when WebGL is disabled
const startVis = visionStateOf(0.22, true);
back.push(
  `<g class="vis-fallback">` +
    Ln(k.segment([X_EYE + EYE_R, Y_OPTIC, Z_OPTIC], [X_CAM_FRONT, Y_OPTIC, Z_OPTIC], P), { tone: "green", dashed: true, flow: true }) +
    Ln(k.segment([X_EYE + EYE_R, Y_OPTIC - 4, Z_OPTIC + 4], [X_CAM_FRONT, Y_OPTIC - 8, Z_OPTIC + 8], P), { tone: "lit", dotted: true }) +
    `</g>`,
);

// ---------------------------------------------------------------------------
// LAYER 2: FRONT SVG (Right Console, POS/TS-CAN Drum Plotter & Iris Saccade Latency Chronograph)
// ---------------------------------------------------------------------------
const front = [];

// 8. Right Console Base
front.push(S(slab(CONSOLE, 0, CONSOLE_H, 6, 0.9), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(CONSOLE, 3.5), CONSOLE_H, P), { tone: "faint" }));
front.push(Dots(k.corners(CONSOLE, 6).map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.48 }));

// 9. POS / TS-CAN Rotary Drum Waveform Plotter (Rear of Console, x = 112, y = -36)
const [dx, dy] = DRUM_POS;
front.push(S(k.cylinder(dx, dy, DRUM_R + 2.5, CONSOLE_H, 3, P, 48, 0.5), { tone: "mid" }));
front.push(S(k.cylinder(dx, dy, DRUM_R, DRUM_Z, DRUM_H, P, 56, 0.6), { tone: "hi", crease: "lo" }));
// Ruled chart paper bands on the rotary drum
for (const rz of [DRUM_Z + 7, DRUM_Z + 14, DRUM_Z + 21, DRUM_Z + 28]) {
  front.push(Ln(k.sideArc(dx, dy, DRUM_R, rz, P, 28), { tone: "faint" }));
}
// Knurled top thumb-nut on drum spindle
front.push(S(k.cylinder(dx, dy, 6.5, DRUM_Z + DRUM_H, 4, P, 28, 0.4), { tone: "mid" }));
front.push(Ln(k.knurl(dx, dy, 6.5, DRUM_Z + DRUM_H + 0.4, DRUM_Z + DRUM_H + 3.6, 24, P), { tone: "lo" }));
front.push(Dots([at([dx, dy, DRUM_Z + DRUM_H + 4])], { size: 0.5, tone: "hi" }));

// Vertical Stylus Guide Post & Moving Green-Channel BVP Stylus Arm alongside Drum
const STYLUS_POST = [dx - DRUM_R - 6, dy + 8];
front.push(S(k.cylinder(STYLUS_POST[0], STYLUS_POST[1], 2.4, CONSOLE_H, DRUM_H + 6, P, 18), { tone: "mid", crease: "none" }));
function buildPlotterStylus() {
  const zStylus = DRUM_Z + 16;
  const arm = { x: STYLUS_POST[0] - 2.5, y: STYLUS_POST[1] - 2.5, w: 9, d: 5, r: 1 };
  return (
    S(slab(arm, zStylus, 4, 3, 0.3), { tone: "hi", crease: "lo" }) +
    Ln(k.segment([STYLUS_POST[0] + 6.5, STYLUS_POST[1], zStylus + 2], [dx - DRUM_R + 0.5, dy + 3, zStylus + 2], P), { tone: "green" }) +
    Dots([at([dx - DRUM_R + 0.5, dy + 3, zStylus + 2])], { size: 0.55, tone: "hi" })
  );
}
front.push(`<g data-part="pos-stylus">${buildPlotterStylus()}</g>`);

// 10. Iris Saccade Latency Chronograph Dial (Front of Console, x = 114, y = 30)
front.push(S(k.cylinder(DIAL_SAC[0], DIAL_SAC[1], DIAL_SAC_R, DIAL_SAC_Z, DIAL_SAC_H, P, 72, 0.9), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(DIAL_SAC[0], DIAL_SAC[1], DIAL_SAC_R, DIAL_SAC_TOP - 3.6, DIAL_SAC_TOP, 80, P, 0.35), { tone: "lo" }));
front.push(Ln(k.ring(DIAL_SAC[0], DIAL_SAC[1], DIAL_SAC_R - 2.2, DIAL_SAC_TOP, P, 64), { tone: "lo" }));
const SAC_TICKS = k.radialTicks(DIAL_SAC[0], DIAL_SAC[1], DIAL_SAC_R - 3.0, 50, 5, DIAL_SAC_TOP, [1.4, 3.0], P, -135 * DEG, 270 * DEG);
front.push(Ln(SAC_TICKS.minor, { tone: "lo" }), Ln(SAC_TICKS.major, { tone: "mid" }));
front.push(k.faceTextSvg(k.topMatrix([DIAL_SAC[0], DIAL_SAC[1] + 9.2], DIAL_SAC_TOP, P, "x"), "SACCADE MS", { size: 2.4, tone: "lo", anchor: "middle" }));

const sacNeedleAt = (latencyMs) => {
  const share = (latencyMs - 180) / 240;
  const a = (-135 + share * 270) * DEG;
  const [cx, cy] = DIAL_SAC;
  return k.lineOnTop([cx - Math.sin(a) * 3.8, cy + Math.cos(a) * 3.8], [cx + Math.sin(a) * (DIAL_SAC_R - 4.2), cy - Math.cos(a) * (DIAL_SAC_R - 4.2)], DIAL_SAC_TOP + 0.3, P);
};
front.push(`<path data-part="saccade-needle" class="iso-line" data-tone="lit" data-free="start" d="${sacNeedleAt(startVis.latencyMs)}" style="stroke-width:1.3"/>`);
front.push(Ln(k.ring(DIAL_SAC[0], DIAL_SAC[1], 1.8, DIAL_SAC_TOP + 0.3, P, 18), { tone: "lit" }));

// ---------------------------------------------------------------------------
// WEBGL SHADER LAYER & LIVE INTERACTION
// ---------------------------------------------------------------------------
const CSS = `
.vis .iso-plate { overflow: hidden; }
.vis-stage {
  position: relative;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  cursor: ew-resize;
}
.vis-stage[data-gl] .vis-fallback { display: none; }
.vis-stage > svg, .vis-stage > canvas {
  display: block;
  width: 100%;
  height: auto;
}
.vis-stage > .vis-layer {
  position: absolute;
  inset: 0;
  height: 100% !important;
  pointer-events: none;
}
.iso:not([data-theme="light"]) .vis-gl {
  mix-blend-mode: screen;
}
.vis-scope-bg > .iso-fill {
  fill: var(--anatomy-shade-0);
}
`;

const LABEL_TEXT =
  "An optical metrology bench explaining 60 fps camera rPPG and iris saccade latency measurement. On the left, a spherical eyeball with a lit iris tracking ring sits in a dual-axis gimbal beneath a horizontal pro/anti-saccade LED target bar. In the center, a multi-element OV2710 telecentric lens barrel with a physical UVC manual exposure lock pin captures both the 540 nm green-channel hemoglobin absorption beam from the malar ROI and high-speed iris saccade kinematics. On the right, an RGB dichroic prism chamber splits the light into Red, Green (540 nm peak), and Blue waveguides feeding a POS rotary drum waveform plotter and a saccade latency chronograph dial.";

const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "vis-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg vis-layer vis-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${front.join("")}</svg>`;
const stageHtml = `<div class="vis-stage" tabindex="0" role="slider" aria-label="OV2710 rPPG & Iris Saccade Bench: move pointer horizontally for cognitive saccade latency, press L to toggle UVC Manual Exposure Lock" aria-valuemin="198" aria-valuemax="386" aria-valuenow="240">${backSvg}<canvas class="vis-layer vis-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;

const GL_DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  xEye: X_EYE + EYE_R,
  xCamFront: X_CAM_FRONT,
  xCamBack: X_CAM_BACK,
  xPrism: X_PRISM,
  yOptic: Y_OPTIC,
  zOptic: Z_OPTIC,
  winGlass: [WIN_GLASS.x + 2, WIN_GLASS.y + 2, WIN_GLASS.x + WIN_GLASS.w - 2, WIN_GLASS.y + WIN_GLASS.d - 2, WIN_H],
};

const LIVE = `
const DATA = ${JSON.stringify(GL_DATA)};
const P = DATA.P;
const root = document.querySelector(".vis");
const stage = root.querySelector(".vis-stage");
const canvas = stage.querySelector(".vis-gl");
const readout = root.querySelector("[data-readout]");
const irisAssembly = stage.querySelector('[data-part="iris-assembly"]');
const stimulusFlag = stage.querySelector('[data-part="stimulus-flag"]');
const aeLatch = stage.querySelector('[data-part="ae-latch"]');
const posStylus = stage.querySelector('[data-part="pos-stylus"]');
const saccadeNeedle = stage.querySelector('[data-part="saccade-needle"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const pale = !!root.closest('[data-theme="light"]');
const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const visionStateOf = ${visionStateOf.toString()};
const sacNeedleAt = (latencyMs) => {
  const share = (latencyMs - 180) / 240;
  const a = (-135 + share * 270) * DEG;
  return lineOnTop([${DIAL_SAC[0]} - Math.sin(a) * 3.8, ${DIAL_SAC[1]} + Math.cos(a) * 3.8], [${DIAL_SAC[0]} + Math.sin(a) * ${DIAL_SAC_R - 4.2}, ${DIAL_SAC[1]} - Math.cos(a) * ${DIAL_SAC_R - 4.2}], ${DIAL_SAC_TOP + 0.3}, P);
};

const FRAGMENT = \`
uniform float uPhase;
uniform float uShare;
uniform float uLocked;
uniform float uGazeY;
uniform float uPale;
uniform vec4 uWin;
uniform float uWinZ;
uniform vec4 uOptic; // xEye, xCamFront, xPrism, yOptic
uniform float uZOptic;

void main() {
  vec2 vb = viewOf(gl_FragCoord.xy);
  vec3 pOpt = onFloor(vb, uZOptic);
  vec3 pWin = onFloor(vb, uWinZ);

  // 1. 540 nm Green Hemoglobin Absorption Beam & Iris Saccade Cone between Eye (xEye) and Camera (xCamFront)
  float x0 = uOptic.x;
  float x1 = uOptic.y;
  float y0 = uOptic.w;
  float inConeX = window(pOpt.x, x0, x1, 2.0);
  float tCone = clamp((pOpt.x - x0) / max(x1 - x0, 1.0), 0.0, 1.0);
  float beamCenterY = mix(y0 + uGazeY * 0.45, y0, tCone);
  float beamHalfW = mix(5.0, 12.5, tCone);
  float dBeam = abs(pOpt.y - beamCenterY);
  float greenBeam = exp(-pow(dBeam / (beamHalfW * 0.55), 2.0)) * inConeX;

  // Pulsatile hemoglobin modulation wave along optical axis
  float bvpWave = 0.72 + 0.28 * sin(uPhase * 6.28318 * 1.2 - pOpt.x * 0.12);
  // If AE/AWB lock is disengaged (uLocked < 0.5), ambient auto-exposure hunting corrupts beam
  float aeNoise = (1.0 - uLocked) * (0.45 * sin(uPhase * 37.0) + 0.35 * cos(uPhase * 19.0 + pOpt.x * 0.2));
  greenBeam *= clamp(bvpWave + aeNoise, 0.15, 1.6);

  // Iris Saccade Gaze Tracking Ray (crisp white/cyan ray along gaze center)
  float gazeRay = exp(-pow((pOpt.y - mix(y0 + uGazeY, y0, tCone)) / 1.8, 2.0)) * inConeX;

  // 2. Dichroic Prism RGB Dispersion Glow around xPrism
  vec2 prismPos = vec2(uOptic.z + 10.0, y0);
  float dPrism = length(pOpt.xy - prismPos);
  float prismGlowG = exp(-dot(pOpt.xy - vec2(prismPos.x + 12.0, y0), pOpt.xy - vec2(prismPos.x + 12.0, y0)) / 75.0);
  float prismGlowR = exp(-dot(pOpt.xy - vec2(prismPos.x + 10.0, y0 - 12.0), pOpt.xy - vec2(prismPos.x + 10.0, y0 - 12.0)) / 55.0);
  float prismGlowB = exp(-dot(pOpt.xy - vec2(prismPos.x + 10.0, y0 + 12.0), pOpt.xy - vec2(prismPos.x + 10.0, y0 + 12.0)) / 55.0);

  // 3. Front Inspection Window: Top trace = 540nm Green POS BVP Waveform, Bottom trace = Iris Saccade Step Response
  float inWin = window(pWin.x, uWin.x, uWin.z, 1.0) * window(pWin.y, uWin.y, uWin.w, 1.0);
  float u = (pWin.x - uWin.x) / max(uWin.z - uWin.x, 1.0);
  float v = (pWin.y - uWin.y) / max(uWin.w - uWin.y, 1.0);

  float bvpPhase = (u * 3.5 - uPhase * 1.2) * 6.28318;
  float bvpVal = 0.32 - 0.12 * (sin(bvpPhase) + 0.45 * sin(2.0 * bvpPhase - 0.8))
                 + (1.0 - uLocked) * 0.14 * sin(u * 29.0 + uPhase * 22.0);
  float bvpTrace = exp(-pow((v - bvpVal) / 0.036, 2.0)) * inWin;

  // Saccade latency step curve (shows delay between target jump at u=0.22 and iris response at u=0.22 + latency)
  float delayU = mix(0.14, 0.36, uShare);
  float stimStep = 0.78 - 0.16 * smoothstep(0.20, 0.22, u);
  float eyeStep = 0.78 - 0.16 * smoothstep(0.20 + delayU, 0.25 + delayU, u);
  float stimTrace = exp(-pow((v - stimStep) / 0.028, 2.0)) * inWin * 0.55;
  float eyeTrace = exp(-pow((v - eyeStep) / 0.036, 2.0)) * inWin;

  vec3 colGreen = vec3(0.24, 0.94, 0.56);
  vec3 colRed = vec3(1.0, 0.34, 0.34);
  vec3 colBlue = vec3(0.36, 0.62, 1.0);
  vec3 colCyan = vec3(0.75, 0.95, 1.0);

  vec3 light = colGreen * (greenBeam * 0.85 + prismGlowG * 1.1 + bvpTrace * 0.95)
             + colRed * (prismGlowR * 0.9 + stimTrace * 0.85)
             + colBlue * (prismGlowB * 0.9)
             + colCyan * (gazeRay * 0.8 + eyeTrace * 0.9);

  if (uPale > 0.5) {
    float ink = clamp(length(light) * 0.50, 0.0, 0.82);
    vec3 paperCol = normalize(light + vec3(0.001)) * 0.70;
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
  uniforms: ["uPhase", "uShare", "uLocked", "uGazeY", "uPale", "uWin", "uWinZ", "uOptic", "uZOptic"],
  fixed: {
    uPale: pale ? 1 : 0,
    uWin: DATA.winGlass.slice(0, 4),
    uWinZ: DATA.winGlass[4],
    uOptic: [DATA.xEye, DATA.xCamFront, DATA.xPrism, DATA.yOptic],
    uZOptic: DATA.zOptic,
  },
});
if (layer) stage.setAttribute("data-gl", "");

let share = 0.22, targetShare = 0.22, aeLocked = true;
let phase = 0, last = 0, frame = 0, touring = true, visible = false, idleTimer = 0;

function draw() {
  const st = visionStateOf(share, aeLocked);
  // Stimulus jumps periodically between left (-18) and right (+18), and iris follows with saccade latency
  const cycle = (phase * 0.65) % 1;
  const stimSide = cycle < 0.5 ? -16 : 16;
  const lag = 0.08 + share * 0.18;
  const eyeCycle = ((phase * 0.65 - lag) % 1 + 1) % 1;
  const eyeSide = eyeCycle < 0.5 ? -16 : 16;

  stimulusFlag.setAttribute("transform", translateAlong(P, [0, stimSide, 0]));
  irisAssembly.setAttribute("transform", translateAlong(P, [0, eyeSide * 0.26, 0]));
  aeLatch.setAttribute("transform", translateAlong(P, [0, 0, aeLocked ? 0 : 4.2]));

  const stylusZ = Math.sin(phase * Math.PI * 2 * 1.2) * (aeLocked ? 4.5 : 8.5);
  posStylus.setAttribute("transform", translateAlong(P, [0, 0, stylusZ]));
  saccadeNeedle.setAttribute("d", sacNeedleAt(st.latencyMs));

  const lockTag = aeLocked ? "UVC AE-LOCKED" : "AE UNLOCKED (NOISE!)";
  const text = \`\${lockTag} · Saccade \${st.latencyMs} ms (\${st.stateLabel}) · rPPG HR \${st.hr} bpm · RMSSD \${st.rmssd} ms · SNR \${st.snrDb} dB\`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(st.latencyMs));
  stage.setAttribute("aria-valuetext", text);

  if (layer) {
    layer.draw(
      {
        uPhase: phase,
        uShare: share,
        uLocked: aeLocked ? 1.0 : 0.0,
        uGazeY: eyeSide * 0.35,
      },
      phase,
    );
  }
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 24) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !calm) {
    targetShare = 0.45 + 0.38 * Math.sin(now * 0.0005);
  }
  share = calm ? targetShare : share + (targetShare - share) * (1 - Math.exp(-dt / 0.22));
  if (!calm) phase = (phase + dt) % 1000;
  draw();
  frame = visible && !calm ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  targetShare = clamp(next, 0, 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; run(); }, 4000);
  if (still.matches) { share = targetShare; draw(); } else run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (e) => {
  const box = stage.getBoundingClientRect();
  const s = clamp(((e.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  steer(s);
});
stage.addEventListener("click", () => {
  aeLocked = !aeLocked;
  draw();
});
stage.addEventListener("keydown", (e) => {
  if (e.key === "l" || e.key === "L" || e.key === " ") {
    e.preventDefault();
    aeLocked = !aeLocked;
    draw();
  } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
    e.preventDefault();
    steer(targetShare + 0.08);
  } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
    e.preventDefault();
    steer(targetShare - 0.08);
  }
});

draw();
`;

const body = `<div class="vis"><style>${CSS}</style>${k.plateHtml({
  fig: "Fig 6",
  title: "OV2710 60fps 수동노출 고정 카메라 — 안면 혈류(rPPG) 프리즘 분광기 & 홍채 단속운동(Iris Saccade) 계측기",
  hint: "Hover for Saccade Latency (198 ↔ 386 ms) · Click or press L to toggle UVC AE-Lock",
  readout: `UVC AE-LOCKED · Saccade ${startVis.latencyMs} ms (${startVis.stateLabel}) · rPPG HR ${startVis.hr} bpm · RMSSD ${startVis.rmssd} ms · SNR ${startVis.snrDb} dB`,
  keys: [
    { mark: "lit", label: "Iris saccade tracking ring, LED stimulus flag & UVC manual exposure lock pin (AE/AWB Lock)" },
    { mark: "green", label: "540 nm Green-channel hemoglobin absorption beam & POS rotary drum BVP waveform" },
    { mark: "red", label: "640 nm Red specular reference channel & pro/anti-saccade stimulus step" },
    { mark: "blue", label: "460 nm Blue motion-cancellation reference channel in POS orthogonal projection" },
  ],
  caption:
    "Standard webcams constantly hunt with auto-exposure (AE) and auto-white-balance (AWB), obliterating the 0.5% skin micro-color pulsation of hemoglobin. CONNECT InBody AI drives an OV2710 1080p sensor at a locked 60 fps (16.67 ms frame interval) with a UVC manual exposure lock pin (press L to disengage and observe AE flicker corruption). Incoming light splits in an RGB dichroic prism: the 540 nm Green hemoglobin absorption peak feeds a Plane-Orthogonal-to-Skin (POS) drum plotter (HR, RMSSD, LF/HF), while the 60 fps iris tracker measures Pro/Anti-Saccade response latency (198 ms normal vs 386 ms frontal-lobe fatigue / MCI risk).",
  body: stageHtml,
})}</div>`;

const outName = theme === "light" ? "fig-06-light.html" : "fig-06.html";
writeFileSync(
  join(HERE, outName),
  k.pageHtml({
    title: "Fig 6 · OV2710 60fps Vision rPPG Spectrograph & Iris Saccade Latency Rig",
    theme,
    body,
    script: kitScript() + glScript() + LIVE,
    width: 780,
  }),
);
console.log("wrote", outName);

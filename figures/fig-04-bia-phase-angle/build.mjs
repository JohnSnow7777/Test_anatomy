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

const W = 760;
const H = 520;
const AZIMUTH = 38;
const ELEVATION = 35;

// Base surface plate
const BASE = { x: -182, y: -102, w: 364, d: 204, r: 10 };
const BASE_H = 14;
const FOOT_H = 6;

// Left Control Box: AD5940 Multi-Frequency Sine Generator (5 / 50 / 200 kHz, 400 uArms) + 4,096-pt DFT
const BOX = { x: -168, y: -62, w: 54, d: 128, r: 4 };
const BOX_Z = 2;
const BOX_TOP = 28;
const FREQ_KNOB = [BOX.x + 27, BOX.y + 38];
const INTEGRITY_KNOB = [BOX.x + 27, BOX.y + 88];
const LED_POS = [BOX.x + 12, BOX.y + 114];
const SWITCH_POS = [BOX.x + 40, BOX.y + 114];

// Center Tissue Impedance Chamber (holds 7 cylindrical "Cell Membrane Capacitors" in ECW electrolyte)
const IN = { x: -86, y: -66, w: 164, d: 132, r: 0 };
const OUT = { x: -94, y: -74, w: 180, d: 148, r: 2 };
const FRAME = 8;
const Z = { legTop: 22, bed: 26, floor: 30, fluid: 38, rim: 48, top: 52 };

// 7 Cylindrical Cell Membrane Capacitors arranged in a staggered hexagonal lattice inside the chamber
const CELLS = [
  [-48, -32],
  [-48, 32],
  [-4, -42],
  [-4, 0],
  [-4, 42],
  [40, -32],
  [40, 32],
];
const CELL_R_OUT = 13.5;
const CELL_R_IN = 9.5;
const CELL_H = 15;

// Right Mechanical Readout Instruments:
// 1. Phase Angle Protractor Dial (phi = arctan(Xc / R), 3.0 deg to 9.0 deg)
// 2. ECW/TBW Edema Balance Gauge (0.360 to 0.415)
const PHI_DIAL = [132, -36];
const PHI_R = 28;
const PHI_Z = 34;
const PHI_H = 10;
const PHI_TOP = PHI_Z + PHI_H;

const ECW_DIAL = [132, 42];
const ECW_R = 24;
const ECW_Z = 26;
const ECW_H = 9;
const ECW_TOP = ECW_Z + ECW_H;

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    ...k.boxCorners(OUT, 0, Z.top + 8),
    [PHI_DIAL[0] + PHI_R + 8, PHI_DIAL[1] - PHI_R, PHI_TOP + 10],
    [ECW_DIAL[0] + ECW_R + 8, ECW_DIAL[1] + ECW_R, ECW_TOP + 10],
  ],
  W,
  H,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 5, bevel = 0.6) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const glassLines = (paths) => Ln(paths.outline + paths.crease, { tone: "faint" });

function cable(points, { r = 1.15, bend = 5, maxLength = 14, rings = null } = {}) {
  return tubePieces(G.fillet(points, bend, 8), r, P, { maxLength, spacing: 1.2, rings }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}

// Cole-Cole Physiological Bio-Impedance Model for 5 kHz, 50 kHz, 200 kHz
function coleState(freqKhz, health) {
  // health in [0, 1]:
  // health = 1.0 (Healthy Active Senior): R_50 = 460 Ohm, Xc_50 = 58 Ohm -> phi = 7.18 deg, ECW/TBW = 0.372
  // health = 0.0 (Sarcopenic / Edema):    R_50 = 590 Ohm, Xc_50 = 38 Ohm -> phi = 3.69 deg, ECW/TBW = 0.406
  const h = Math.max(0, Math.min(1, health));
  const f = Math.max(5, Math.min(200, freqKhz));
  const r50 = 590 - 130 * h;
  const xcPeak = 38 + 20 * h;
  // Log-normal Cole-Cole frequency dispersion centered at characteristic frequency fc = 50 kHz
  const logRatio = Math.log(f / 50) / Math.log(4); // -1 at 12.5kHz, 0 at 50kHz, +1 at 200kHz
  const penetration = 1 / (1 + Math.pow(50 / f, 1.35)); // ~0.04 at 5kHz, 0.50 at 50kHz, ~0.87 at 200kHz
  const rFreq = r50 + (1 - penetration - 0.5) * 95;
  const xcFreq = xcPeak * Math.exp(-0.55 * logRatio * logRatio);
  const phiDeg = Math.atan2(xcFreq, rFreq) * (180 / Math.PI);
  const phi50 = Math.atan2(xcPeak, r50) * (180 / Math.PI);
  const ecwTbw = 0.406 - 0.034 * h;
  return { f, h, rFreq, xcFreq, phiDeg, phi50, ecwTbw, penetration, r50, xcPeak };
}

function formatReadout(st) {
  const fLabel = st.f < 15 ? `${st.f.toFixed(0)} kHz (ECW Bypass)` : st.f < 90 ? `${st.f.toFixed(0)} kHz (fc Peak Xc)` : `${st.f.toFixed(0)} kHz (TBW Penetration)`;
  const status = st.phi50 >= 6.0 ? "Healthy Cell Membrane" : st.phi50 >= 4.5 ? "Borderline Vitality" : "Sarcopenia / Edema Alert";
  return `${fLabel} · R ${st.rFreq.toFixed(0)}Ω · Xc ${st.xcFreq.toFixed(1)}Ω · φ ${st.phiDeg.toFixed(2)}° (50kHz: ${st.phi50.toFixed(2)}°) · ECW/TBW ${st.ecwTbw.toFixed(3)} · ${status}`;
}

const START = { freq: 50, health: 1.0 };
const startState = coleState(START.freq, START.health);

// Helper functions for dynamic pointers/needles
const freqAngle = (f) => {
  // Map log(f) from 5 to 200 kHz onto [-130 deg, +130 deg]
  const u = Math.log(Math.max(5, Math.min(200, f)) / 5) / Math.log(40);
  return (-130 + u * 260) * DEG;
};
const healthAngle = (h) => (-130 + Math.max(0, Math.min(1, h)) * 260) * DEG;
const phiAngle = (phi) => (-135 + ((Math.max(3, Math.min(9, phi)) - 3) / 6) * 270) * DEG;
const ecwAngle = (ecw) => (-135 + ((Math.max(0.36, Math.min(0.415, ecw)) - 0.36) / 0.055) * 270) * DEG;

const knobLineAt = ([kx, ky], z, a, r0 = 1.4, r1 = 6.2) =>
  k.lineOnTop([kx + Math.sin(a) * r0, ky - Math.cos(a) * r0], [kx + Math.sin(a) * r1, ky - Math.cos(a) * r1], z, P);

const dialNeedleAt = ([dx, dy], z, a, rBack = 3.8, rTip = 22) =>
  k.lineOnTop([dx - Math.sin(a) * rBack, dy + Math.cos(a) * rBack], [dx + Math.sin(a) * rTip, dy - Math.cos(a) * rTip], z, P);

// SVG fallback streamlines for environments without WebGL
function fallbackStreamlines(penetration) {
  const ecwPaths = [];
  const icwPaths = [];
  const z = Z.fluid - 1.5;
  // 4 outer/weaving ECW lanes that curve around the 7 cell cylinders
  for (const baseY of [-56, -18, 18, 56]) {
    const pts = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = IN.x + 8 + u * (IN.w - 16);
      const wave = Math.sin(u * Math.PI * 3) * (baseY < 0 ? -6.5 : 6.5);
      pts.push(at([x, baseY + wave, z]));
    }
    ecwPaths.push(k.pathOf(pts));
  }
  // 3 straight through-cell ICW+ECW lanes active as frequency rises toward 200 kHz
  if (penetration > 0.15) {
    for (const cy of [-32, 0, 32]) {
      icwPaths.push(k.lineOnTop([IN.x + 8, cy], [IN.x + IN.w - 8, cy], z + 1, P));
    }
  }
  return { ecw: ecwPaths.join(""), icw: icwPaths.join("") };
}

// ---------------- LAYER 1: BACK SVG (Base Plate, Chamber Floor, Lower Cell Bases, Fallback Streamlines) ----------------
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`);
const FEET = byDepth([
  ...k.corners(BASE, 24),
  [0, BASE.y + 24],
  [0, BASE.y + BASE.d - 24],
  [BASE.x + 24, 0],
  [BASE.x + BASE.w - 24, 0],
]);
for (const [fx, fy] of FEET) {
  back.push(S(k.cylinder(fx, fy, 8.8, -BASE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(fx, fy, 6.8, -BASE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
  back.push(Ln(k.knurl(fx, fy, 8.8, -BASE_H - FOOT_H, -BASE_H - FOOT_H + 2, 24, P, 0.2), { tone: "lo" }));
}
back.push(S(slab(BASE, -BASE_H, BASE_H, 8, 1.5), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(BASE, 5.5), 0, P, 8), { tone: "lo" }));
for (const [sx, sy] of k.corners(BASE, 12)) {
  back.push(Ln(k.ring(sx, sy, 2.6, 0, P, 16), { tone: "lo" }));
  back.push(Dots([at([sx, sy, 0])], { size: 0.55 }));
}

// Front scale strip & engraved plate on base
const STRIP = { x: -94, y: BASE.y + BASE.d - 17, w: 184, d: 8, r: 1 };
back.push(S(slab(STRIP, 0, 0.9, 3, 0.2), { tone: "lo", crease: "none" }));
const TICKS = k.topTicks(STRIP.x + 6, STRIP.x + STRIP.w - 6, 4, 5, STRIP.y + 0.9, 0.9, [2, 4.2], P, "x");
back.push(Ln(TICKS.minor, { tone: "lo" }), Ln(TICKS.major, { tone: "mid" }));
back.push(k.faceTextSvg(k.topMatrix([0, STRIP.y + 6.4], 1.0, P, "x"), "COLE-COLE CELLULAR IMPEDANCE CHAMBER (5 / 50 / 200 kHz)", { size: 2.6, tone: "hi", anchor: "middle" }));

// 4 Machined Leveling Legs supporting the center glass-topped Tissue Chamber
const LEGS = byDepth([
  [OUT.x + 12, OUT.y + 12],
  [OUT.x + OUT.w - 12, OUT.y + 12],
  [OUT.x + 12, OUT.y + OUT.d - 12],
  [OUT.x + OUT.w - 12, OUT.y + OUT.d - 12],
]);
for (const [lx, ly] of LEGS) {
  back.push(S(k.cylinder(lx, ly, 6.8, 0, 4.5, P, 28, 0.4), { tone: "mid" }));
  back.push(Ln(k.knurl(lx, ly, 6.8, 0, 4.5, 24, P, 0.2), { tone: "lo" }));
  back.push(S(k.cylinder(lx, ly, 3.8, 4.5, Z.legTop - 4.5, P, 22), { tone: "mid", crease: "none" }));
  back.push(Ln([9, 14, 19].map((z) => k.sideArc(lx, ly, 3.8, z, P, 14)).join(""), { tone: "lo" }));
  back.push(S(slab({ x: lx - 5.5, y: ly - 5.5, w: 11, d: 11, r: 1.5 }, Z.legTop, Z.bed - Z.legTop, 3, 0.3), { tone: "mid" }));
}

// Chamber Floor Bed & Far Frame Rails
const railMinusX = { x: OUT.x, y: OUT.y, w: FRAME, d: OUT.d, r: 1 };
const railMinusY = { x: IN.x, y: OUT.y, w: IN.w, d: FRAME, r: 0.5 };
back.push(S(slab(OUT, Z.bed, Z.floor - Z.bed, 4, 0.5), { tone: "mid" }));
back.push(S(slab(railMinusX, Z.floor, Z.rim - Z.floor, 3, 0.4), { tone: "mid" }));
back.push(S(slab(railMinusY, Z.floor, Z.rim - Z.floor, 3, 0.4), { tone: "mid" }));

// Chamber interior conductive floor grid
back.push(S(slab(IN, Z.floor, 0.6, 2, 0), { tone: "lo", flat: true, crease: "none", className: "bia-floor" }));
for (let gx = IN.x + 20; gx < IN.x + IN.w; gx += 20) {
  back.push(Ln(k.lineOnTop([gx, IN.y + 4], [gx, IN.y + IN.d - 4], Z.floor + 0.65, P), { tone: "faint" }));
}
for (let gy = IN.y + 22; gy < IN.y + IN.d; gy += 22) {
  back.push(Ln(k.lineOnTop([IN.x + 4, gy], [IN.x + IN.w - 4, gy], Z.floor + 0.65, P), { tone: "faint" }));
}

// Left & Right Gold-Plated 4-Wire Kelvin Busbar Electrodes inside the chamber walls
const busbarL = { x: IN.x + 0.5, y: IN.y + 10, w: 3.5, d: IN.d - 20, r: 0.5 };
const busbarR = { x: IN.x + IN.w - 4, y: IN.y + 10, w: 3.5, d: IN.d - 20, r: 0.5 };
back.push(S(slab(busbarL, Z.floor + 0.6, 12, 3, 0.3), { tone: "hi", lit: true }));
back.push(S(slab(busbarR, Z.floor + 0.6, 12, 3, 0.3), { tone: "hi", lit: true }));

// Lower bases of the 7 Cylindrical Cell Membrane Capacitors (under the fluid/WebGL layer)
for (const [cx, cy] of byDepth(CELLS)) {
  const CF = UP([cx, cy, Z.floor + 0.6]);
  back.push(S(G.ringBand(0, 7.5, CELL_R_IN, CELL_R_OUT, CF, P), { tone: "mid" }));
  back.push(S(G.disc(0, 7.2, CELL_R_IN - 1.2, CF, P), { tone: "lo" }));
}

// Fallback SVG streamlines (hidden when WebGL is active)
const startFallback = fallbackStreamlines(startState.penetration);
back.push(
  `<g class="bia-fallback"><path data-part="ecw-lines" class="iso-line" data-tone="hi" data-flow="" d="${startFallback.ecw}" style="stroke-width:1.1"/><path data-part="icw-lines" class="iso-line" data-tone="lit" data-flow="" d="${startFallback.icw}" style="stroke-width:1.3"/></g>`,
);

// ---------------- LAYER 2: FRONT SVG (Cell Capacitor Tops, Chamber Glass Rim, Left AD5940 Box, Right Protractor & ECW Gauges) ----------------
const front = [];

// Upper Dielectric Rings & 8-Bolt Caps of the 7 Cell Membrane Capacitors (protruding through the fluid plane)
for (const [cx, cy] of byDepth(CELLS)) {
  const CF = UP([cx, cy, Z.floor + 0.6]);
  // Double-walled phospholipid bilayer dielectric ring
  front.push(
    S(
      G.lathe(
        [
          [7.5, CELL_R_IN],
          [7.5, CELL_R_OUT],
          [CELL_H, CELL_R_OUT],
          [CELL_H, CELL_R_IN],
        ],
        CF,
        P,
        { steps: 40 },
      ),
      { tone: "hi", crease: "lo" },
    ),
  );
  // Inner ICW (Intracellular Water) conductive core cap
  front.push(S(G.disc(7.2, CELL_H - 1.2, CELL_R_IN - 1.4, CF, P, { bevel: 0.3 }), { tone: "mid" }));
  front.push(Ln(k.ring(cx, cy, (CELL_R_IN + CELL_R_OUT) / 2, Z.floor + 0.6 + CELL_H, P, 36), { tone: "lo" }));
  front.push(Dots(G.dotsOf(CF, CELL_H + 0.1, (CELL_R_IN + CELL_R_OUT) / 2, 8, P, { all: true }), { size: 0.45, tone: "hi" }));
}
front.push(k.faceTextSvg(k.topMatrix([-4, 0], Z.floor + CELL_H + 0.2, P, "x"), "Cm", { size: 2.8, tone: "hi", anchor: "middle" }));

// Near Chamber Walls, Glass Window & Top Beveled Rim
const railPlusX = { x: IN.x + IN.w, y: OUT.y, w: FRAME, d: OUT.d, r: 1 };
const railPlusY = { x: IN.x, y: IN.y + IN.d, w: IN.w, d: FRAME, r: 0.5 };
front.push(glassLines(slab({ x: IN.x + IN.w, y: IN.y, w: 4, d: IN.d, r: 0 }, Z.floor, Z.rim - Z.floor, 1, 0)));
front.push(glassLines(slab({ x: IN.x, y: IN.y + IN.d, w: IN.w, d: 4, r: 0 }, Z.floor, Z.rim - Z.floor, 1, 0)));
front.push(S(slab(railPlusY, Z.floor, Z.bed + 6 - Z.floor, 2, 0.3), { tone: "mid" }));
front.push(S(slab(railPlusX, Z.floor, Z.bed + 6 - Z.floor, 2, 0.3), { tone: "mid" }));

// Top Perimeter Frame Rim & Corner Bolts
const rimL = { x: OUT.x, y: OUT.y, w: FRAME, d: OUT.d, r: 1 };
const rimR = { x: IN.x + IN.w, y: OUT.y, w: FRAME, d: OUT.d, r: 1 };
const rimT = { x: IN.x, y: OUT.y, w: IN.w, d: FRAME, r: 0.5 };
const rimB = { x: IN.x, y: IN.y + IN.d, w: IN.w, d: FRAME, r: 0.5 };
front.push(S(slab(rimL, Z.rim, Z.top - Z.rim, 2, 0.4), { tone: "mid" }));
front.push(S(slab(rimT, Z.rim, Z.top - Z.rim, 2, 0.4), { tone: "mid" }));
front.push(S(slab(rimR, Z.rim, Z.top - Z.rim, 2, 0.4), { tone: "mid" }));
front.push(S(slab(rimB, Z.rim, Z.top - Z.rim, 2, 0.4), { tone: "mid" }));
for (const [px, py] of k.corners(OUT, 4)) {
  front.push(Dots([at([px, py, Z.top])], { size: 0.5, tone: "hi" }));
}

// Left Control Unit: AD5940 Multi-Frequency Generator (5/50/200 kHz, 400 uArms) + 4,096-pt DFT Analyzer
for (const [bx, by] of byDepth(k.corners(BOX, 6))) {
  front.push(S(k.cylinder(bx, by, 3, 0, BOX_Z, P, 16), { tone: "lo" }));
}
front.push(S(slab(BOX, BOX_Z, BOX_TOP - BOX_Z, 6, 0.9), { tone: "mid" }));
front.push(Ln(k.planOutline(k.insetPlan(BOX, 2.8), BOX_TOP, P, 4), { tone: "faint" }));
front.push(Dots(k.corners(BOX, 5).map(([x, y]) => at([x, y, BOX_TOP])), { size: 0.45 }));

// Knob 1: AD5940 Frequency Selector (5 kHz / 50 kHz / 200 kHz)
front.push(S(k.cylinder(FREQ_KNOB[0], FREQ_KNOB[1], 13.5, BOX_TOP, 1.2, P, 44), { tone: "mid" }));
const F_TICKS = k.radialTicks(FREQ_KNOB[0], FREQ_KNOB[1], 12.8, 16, 4, BOX_TOP + 1.2, [1.3, 2.8], P, -130 * DEG, 260 * DEG);
front.push(Ln(F_TICKS.minor, { tone: "lo" }), Ln(F_TICKS.major, { tone: "hi" }));
front.push(S(k.cylinder(FREQ_KNOB[0], FREQ_KNOB[1], 8.5, BOX_TOP + 1.2, 7.5, P, 36, 0.5), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(FREQ_KNOB[0], FREQ_KNOB[1], 8.5, BOX_TOP + 1.2, BOX_TOP + 8.7, 36, P, 0.3), { tone: "lo" }));
front.push(`<path data-part="freq-knob" class="iso-line" data-tone="lit" d="${knobLineAt(FREQ_KNOB, BOX_TOP + 8.8, freqAngle(START.freq), 1.6, 7.2)}" style="stroke-width:1.15"/>`);
front.push(k.faceTextSvg(k.topMatrix([FREQ_KNOB[0], FREQ_KNOB[1] - 16.5], BOX_TOP + 0.2, P, "x"), "AD5940 FREQ", { size: 2.5, tone: "hi", anchor: "middle" }));
front.push(k.faceTextSvg(k.topMatrix([FREQ_KNOB[0] - 14, FREQ_KNOB[1] + 13], BOX_TOP + 0.2, P, "x"), "5k", { size: 2.2, tone: "mid" }));
front.push(k.faceTextSvg(k.topMatrix([FREQ_KNOB[0], FREQ_KNOB[1] - 13], BOX_TOP + 0.2, P, "x"), "50k", { size: 2.2, tone: "hi", anchor: "middle" }));
front.push(k.faceTextSvg(k.topMatrix([FREQ_KNOB[0] + 10, FREQ_KNOB[1] + 13], BOX_TOP + 0.2, P, "x"), "200k", { size: 2.2, tone: "mid" }));

// Knob 2: Cellular Membrane Integrity / Capacitance Selector (Healthy vs Sarcopenia/Edema)
front.push(S(k.cylinder(INTEGRITY_KNOB[0], INTEGRITY_KNOB[1], 11.5, BOX_TOP, 1.2, P, 40), { tone: "mid" }));
const H_TICKS = k.radialTicks(INTEGRITY_KNOB[0], INTEGRITY_KNOB[1], 10.8, 12, 3, BOX_TOP + 1.2, [1.2, 2.4], P, -130 * DEG, 260 * DEG);
front.push(Ln(H_TICKS.minor, { tone: "lo" }), Ln(H_TICKS.major, { tone: "mid" }));
front.push(S(k.cylinder(INTEGRITY_KNOB[0], INTEGRITY_KNOB[1], 7.2, BOX_TOP + 1.2, 6.2, P, 32, 0.4), { tone: "hi", crease: "lo" }));
front.push(Ln(k.knurl(INTEGRITY_KNOB[0], INTEGRITY_KNOB[1], 7.2, BOX_TOP + 1.2, BOX_TOP + 7.4, 32, P, 0.3), { tone: "lo" }));
front.push(`<path data-part="health-knob" class="iso-line" data-tone="lit" d="${knobLineAt(INTEGRITY_KNOB, BOX_TOP + 7.5, healthAngle(START.health), 1.4, 6.0)}" style="stroke-width:1.1"/>`);
front.push(k.faceTextSvg(k.topMatrix([INTEGRITY_KNOB[0], INTEGRITY_KNOB[1] + 16], BOX_TOP + 0.2, P, "x"), "CELL INTEGRITY", { size: 2.4, tone: "mid", anchor: "middle" }));

// Toggle switch & 400 uArms Constant-Current Status LED
front.push(S(k.cylinder(SWITCH_POS[0], SWITCH_POS[1], 3.2, BOX_TOP, 2.2, P, 8), { tone: "mid" }));
front.push(Ln(k.segment([SWITCH_POS[0], SWITCH_POS[1], BOX_TOP + 2.2], [SWITCH_POS[0] + 2.5, SWITCH_POS[1] - 1.5, BOX_TOP + 8.5], P), { tone: "hi" }));
front.push(Dots([at([SWITCH_POS[0] + 2.5, SWITCH_POS[1] - 1.5, BOX_TOP + 8.5])], { size: 1.0, tone: "hi" }));
front.push(S(k.cylinder(LED_POS[0], LED_POS[1], 2.6, BOX_TOP, 1.2, P, 18), { tone: "mid" }));
front.push(Dots([at([LED_POS[0], LED_POS[1], BOX_TOP + 1.8])], { size: 1.2, tone: "hi", pulse: true }));

// Braided 4-Wire Kelvin Drive/Sense Cables from AD5940 Box to Chamber Left Wall
front.push(
  cable(
    [
      [BOX.x + BOX.w, BOX.y + 34, BOX_Z + 14],
      [BOX.x + BOX.w + 10, BOX.y + 34, BOX_Z + 14],
      [OUT.x - 8, -24, Z.floor + 6],
      [OUT.x, -24, Z.floor + 6],
    ],
    { r: 1.35, bend: 5, rings: { pitch: 2.4, tone: "lo" } },
  ),
);
front.push(
  cable(
    [
      [BOX.x + BOX.w, BOX.y + 84, BOX_Z + 14],
      [BOX.x + BOX.w + 10, BOX.y + 84, BOX_Z + 14],
      [OUT.x - 8, 24, Z.floor + 6],
      [OUT.x, 24, Z.floor + 6],
    ],
    { r: 1.35, bend: 5 },
  ),
);

// Right Readout Instrument 1: Phase Angle Protractor Dial (phi = arctan(Xc / R), 3.0 deg - 9.0 deg)
{
  const [px, py] = PHI_DIAL;
  front.push(S(k.cylinder(px, py, 10, 0, 5, P, 32, 0.5), { tone: "mid" }));
  front.push(S(k.cylinder(px, py, 4.5, 5, PHI_Z - 5, P, 24), { tone: "mid", crease: "none" }));
  front.push(S(k.cylinder(px, py, PHI_R, PHI_Z, PHI_H, P, 64, 0.9), { tone: "hi", crease: "lo" }));
  front.push(Ln(k.knurl(px, py, PHI_R, PHI_TOP - 3.5, PHI_TOP, 76, P, 0.3), { tone: "lo" }));
  front.push(Ln(k.ring(px, py, PHI_R - 2.4, PHI_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(px, py, PHI_R - 3.2, 30, 5, PHI_TOP, [1.5, 3.4], P, -135 * DEG, 270 * DEG);
  front.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "hi" }));
  front.push(Ln(k.ring(px, py, 2.2, PHI_TOP + 0.2, P, 20), { tone: "mid" }));
  front.push(k.faceTextSvg(k.topMatrix([px, py - 10], PHI_TOP + 0.1, P, "x"), "PHASE φ (°)", { size: 2.7, tone: "hi", anchor: "middle" }));
  front.push(k.faceTextSvg(k.topMatrix([px, py + 12], PHI_TOP + 0.1, P, "x"), "arctan(Xc/R)", { size: 2.3, tone: "mid", anchor: "middle" }));
  front.push(
    `<path data-part="phi-needle" class="iso-line" data-tone="lit" d="${dialNeedleAt(PHI_DIAL, PHI_TOP + 0.3, phiAngle(startState.phiDeg), 4.2, PHI_R - 4.8)}" style="stroke-width:1.3"/>`,
  );
}

// Right Readout Instrument 2: ECW/TBW Edema Balance Gauge (0.360 - 0.415)
{
  const [ex, ey] = ECW_DIAL;
  front.push(S(k.cylinder(ex, ey, 9, 0, 4.5, P, 30, 0.5), { tone: "mid" }));
  front.push(S(k.cylinder(ex, ey, 4.0, 4.5, ECW_Z - 4.5, P, 22), { tone: "mid", crease: "none" }));
  front.push(S(k.cylinder(ex, ey, ECW_R, ECW_Z, ECW_H, P, 56, 0.8), { tone: "hi", crease: "lo" }));
  front.push(Ln(k.knurl(ex, ey, ECW_R, ECW_TOP - 3.2, ECW_TOP, 68, P, 0.3), { tone: "lo" }));
  front.push(Ln(k.ring(ex, ey, ECW_R - 2.2, ECW_TOP, P, 56), { tone: "lo" }));
  const ticks = k.radialTicks(ex, ey, ECW_R - 2.8, 22, 5, ECW_TOP, [1.4, 3.0], P, -135 * DEG, 270 * DEG);
  front.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "hi" }));
  // Clinical 0.400 edema threshold mark in red
  const edemaAng = ecwAngle(0.400);
  front.push(
    Ln(
      k.lineOnTop(
        [ex + Math.sin(edemaAng) * (ECW_R - 7.5), ey - Math.cos(edemaAng) * (ECW_R - 7.5)],
        [ex + Math.sin(edemaAng) * (ECW_R - 2.4), ey - Math.cos(edemaAng) * (ECW_R - 2.4)],
        ECW_TOP + 0.1,
        P,
      ),
      { tone: "red" },
    ),
  );
  front.push(Ln(k.ring(ex, ey, 2.0, ECW_TOP + 0.2, P, 18), { tone: "mid" }));
  front.push(k.faceTextSvg(k.topMatrix([ex, ey - 8.5], ECW_TOP + 0.1, P, "x"), "ECW / TBW", { size: 2.5, tone: "hi", anchor: "middle" }));
  front.push(k.faceTextSvg(k.topMatrix([ex, ey + 10.5], ECW_TOP + 0.1, P, "x"), "R5 / R200", { size: 2.2, tone: "mid", anchor: "middle" }));
  front.push(
    `<path data-part="ecw-needle" class="iso-line" data-tone="lit" d="${dialNeedleAt(ECW_DIAL, ECW_TOP + 0.3, ecwAngle(startState.ecwTbw), 3.5, ECW_R - 4.2)}" style="stroke-width:1.25"/>`,
  );
}

// Sense cables from Chamber Right Wall to Phase Angle & ECW/TBW Instruments
front.push(
  cable(
    [
      [OUT.x + OUT.w, -24, Z.floor + 6],
      [OUT.x + OUT.w + 12, -24, Z.floor + 6],
      [PHI_DIAL[0] - PHI_R + 2, PHI_DIAL[1], PHI_Z + 3],
    ],
    { r: 1.3, bend: 5 },
  ),
);
front.push(
  cable(
    [
      [OUT.x + OUT.w, 24, Z.floor + 6],
      [OUT.x + OUT.w + 12, 24, Z.floor + 6],
      [ECW_DIAL[0] - ECW_R + 2, ECW_DIAL[1], ECW_Z + 3],
    ],
    { r: 1.3, bend: 5 },
  ),
);

const CSS = `
.bia .iso-plate { overflow: hidden; }
.bia-stage {
  position: relative;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  cursor: crosshair;
}
.bia-stage[data-gl] .bia-fallback { display: none; }
.bia-stage > svg,
.bia-stage > canvas {
  display: block;
  width: 100%;
  height: auto;
}
.bia-stage > .bia-layer {
  position: absolute;
  inset: 0;
  height: 100% !important;
  pointer-events: none;
}
.iso:not([data-theme="light"]) .bia-gl {
  mix-blend-mode: screen;
}
`;

const LABEL_TEXT =
  "An isometric bio-impedance chamber and phase-angle protractor rig modelling the AD5940 multi-frequency (5, 50, and 200 kHz) cellular impedance measurement. A generator on the left drives 400 microamps of AC current into a glass-topped chamber holding seven cylindrical cell-membrane capacitors. At 5 kHz current flows around the cells through extracellular water (ECW); at 50 kHz the cell membranes charge with maximum capacitive reactance Xc and phase lag phi; at 200 kHz current penetrates right through the intracellular cores (TBW). Two dial gauges on the right read Phase Angle phi and ECW/TBW ratio.";

const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "bia-back" });
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg bia-layer bia-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${front.join("")}</svg>`;
const stage = `<div class="bia-stage" tabindex="0" role="group" aria-label="AD5940 Multi-Frequency Bio-Impedance Chamber. Move horizontally or press 1, 2, 3 to sweep frequency (5, 50, 200 kHz); move vertically or press Up and Down arrows to vary cell membrane integrity.">${backSvg}<canvas class="bia-layer bia-gl" aria-hidden="true"></canvas>${frontSvg}</div>`;

const body = `<div class="bia">${k.plateHtml({
  fig: "Fig 4",
  title: "AD5940 Multi-Frequency (5/50/200 kHz) Cellular Phase-Angle (φ) & ECW/TBW Rig",
  hint: "Move across for Frequency (5→200 kHz) · up/down for Cell Health · keys 1/2/3",
  readout: formatReadout(startState),
  keys: [
    { mark: "lit", label: "Phase Angle dial (φ = arctan(Xc/R)), ECW/TBW gauge & 4-wire Kelvin busbars" },
    { mark: "raised", label: "7 cylindrical cell-membrane capacitors (Cm) & AD5940 4,096-pt DFT generator" },
    { mark: "red", label: "Clinical edema cutoff (ECW/TBW ≥ 0.400)" },
  ],
  caption:
    "The object is the Cole-Cole circuit: human tissue is modelled as seven cylindrical phospholipid cell-membrane capacitors (Xc) suspended in conductive extracellular water (ECW). At 5 kHz, capacitive reactance blocks cell entry so current streams solely around the outer lanes (measuring R_ECW). At the 50 kHz characteristic frequency, membrane charging peaks, producing a phase lag φ = arctan(Xc / R) × (180/π) directly proportional to muscle cell mass and fast-twitch fiber vitality. At 200 kHz, current pierces straight through the cell cores to measure Total Body Water (TBW = ICW + ECW).",
  body: stage,
})}</div>`;

const DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  inside: [IN.x, IN.y, IN.x + IN.w, IN.y + IN.d],
  zFluid: Z.fluid - 2.0,
  cells: CELLS.flat(),
  cellRout: CELL_R_OUT,
  cellRin: CELL_R_IN,
  freqKnob: FREQ_KNOB,
  healthKnob: INTEGRITY_KNOB,
  boxTop: BOX_TOP,
  phiDial: PHI_DIAL,
  phiR: PHI_R,
  phiTop: PHI_TOP,
  ecwDial: ECW_DIAL,
  ecwR: ECW_R,
  ecwTop: ECW_TOP,
  start: START,
};

const live = `
const D = ${JSON.stringify(DATA)};
const DEG = Math.PI / 180;
const root = document.querySelector(".bia");
const stage = root.querySelector(".bia-stage");
const canvas = stage.querySelector(".bia-gl");
const readout = root.querySelector("[data-readout]");
const freqKnob = stage.querySelector('[data-part="freq-knob"]');
const healthKnob = stage.querySelector('[data-part="health-knob"]');
const phiNeedle = stage.querySelector('[data-part="phi-needle"]');
const ecwNeedle = stage.querySelector('[data-part="ecw-needle"]');
const ecwLines = stage.querySelector('[data-part="ecw-lines"]');
const icwLines = stage.querySelector('[data-part="icw-lines"]');
const still = matchMedia("(prefers-reduced-motion: reduce)");
const pale = !!root.closest('[data-theme="light"]');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

${coleState.toString()}
${formatReadout.toString()}

const FREQ_GLSL = \`
uniform vec4 uIn;
uniform float uZFluid;
uniform vec2 uCells[7];
uniform float uRout;
uniform float uRin;
uniform float uPen;
uniform float uXcNorm;
uniform float uPhase;
uniform float uPale;

float sdRect(vec2 p, vec4 r) {
  vec2 c = 0.5 * (r.xy + r.zw);
  vec2 h = 0.5 * (r.zw - r.xy);
  vec2 q = abs(p - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

void main() {
  vec2 vb = viewOf(gl_FragCoord.xy);
  float px = pixelOf() / uCam.z;
  vec3 s = onFloor(vb, uZFluid);
  float inside = 1.0 - smoothstep(-px, px, sdRect(s.xy, uIn));
  if (inside < 0.001) {
    gl_FragColor = vec4(0.0);
    return;
  }

  // Distance to nearest of the 7 cell membrane capacitors & potential-flow deflection around cells
  float minD = 1e5;
  vec2 warped = s.xy;
  for (int i = 0; i < 7; i++) {
    vec2 d = s.xy - uCells[i];
    float r = length(d);
    if (r < minD) minD = r;
    // Deflect y-streamlines around cylinder when penetration (uPen) is low (5 kHz ECW mode)
    float deflect = (1.0 - uPen) * (uRout * uRout) / (r * r + 18.0);
    warped.y += d.y * deflect * 0.85;
  }

  float inOuterWall = smoothstep(uRout + 1.2, uRout - 0.5, minD) * smoothstep(uRin - 0.8, uRin + 0.8, minD);
  float inCore = smoothstep(uRin + 0.6, uRin - 1.2, minD);
  float inECW = smoothstep(uRout - 0.5, uRout + 2.0, minD);

  // Flowing AC current streamlines along X, warped around cells at 5kHz and straight through cores at 200kHz
  float lane = abs(sin(warped.y * 0.24));
  float stream = smoothstep(0.76, 0.98, lane);
  float pulseWave = 0.55 + 0.45 * sin(s.x * 0.14 - uPhase * 4.0 + warped.y * 0.05);

  // ECW flow is always active in the extracellular space; ICW core flow scales with high-frequency penetration uPen
  float flowIntensity = stream * pulseWave * (inECW * 0.85 + inCore * uPen * 1.25);

  // At 50 kHz (uXcNorm high), the phospholipid bilayer ring (inOuterWall) charges & glows brightly
  float membraneGlow = inOuterWall * uXcNorm * (0.65 + 0.35 * sin(uPhase * 3.0));

  // Subtle electrode busbar glow near left & right walls
  float busGlow = (exp(-abs(s.x - uIn.x) * 0.18) + exp(-abs(uIn.z - s.x) * 0.18)) * 0.35;

  float total = clamp(flowIntensity + membraneGlow * 1.15 + busGlow, 0.0, 1.0) * inside;

  vec3 colDark = mix(vec3(0.32, 0.64, 1.0), vec3(0.45, 0.95, 0.72), membraneGlow + uPen * inCore * 0.6);
  vec3 colLight = mix(vec3(0.16, 0.36, 0.82), vec3(0.12, 0.62, 0.42), membraneGlow + uPen * inCore * 0.6);
  vec3 col = uPale > 0.5 ? colLight : colDark;
  float alpha = uPale > 0.5 ? total * 0.55 : total * 0.82;
  gl_FragColor = vec4(col * alpha, alpha);
}
\`;

const layer = glLayer({
  canvas,
  fragment: FREQ_GLSL,
  view: [D.W, D.H],
  camera: D.camera,
  uniforms: ["uPen", "uXcNorm", "uPhase"],
  fixed: {
    uIn: D.inside,
    uZFluid: D.zFluid,
    uCells: D.cells,
    uRout: D.cellRout,
    uRin: D.cellRin,
    uPale: pale ? 1 : 0,
  },
});
if (layer) stage.setAttribute("data-gl", "");

const freqAngle = (f) => (-130 + (Math.log(clamp(f, 5, 200) / 5) / Math.log(40)) * 260) * DEG;
const healthAngle = (h) => (-130 + clamp(h, 0, 1) * 260) * DEG;
const phiAngle = (phi) => (-135 + ((clamp(phi, 3, 9) - 3) / 6) * 270) * DEG;
const ecwAngle = (ecw) => (-135 + ((clamp(ecw, 0.36, 0.415) - 0.36) / 0.055) * 270) * DEG;

const knobLineAt = ([kx, ky], z, a, r0, r1) =>
  lineOnTop([kx + Math.sin(a) * r0, ky - Math.cos(a) * r0], [kx + Math.sin(a) * r1, ky - Math.cos(a) * r1], z, D.P);

const dialNeedleAt = ([dx, dy], z, a, rBack, rTip) =>
  lineOnTop([dx - Math.sin(a) * rBack, dy + Math.cos(a) * rBack], [dx + Math.sin(a) * rTip, dy - Math.cos(a) * rTip], z, D.P);

let freq = { x: D.start.freq, v: 0 };
let health = { x: D.start.health, v: 0 };
let targetF = D.start.freq, targetH = D.start.health;
let phase = 0, last = 0, frame = 0, visible = false, touring = !still.matches, tourClock = 0, idleTimer = 0;
const tourStops = [
  { f: 5, h: 1.0 },
  { f: 50, h: 1.0 },
  { f: 200, h: 1.0 },
  { f: 50, h: 0.15 },
];

function draw() {
  const st = coleState(freq.x, health.x);
  freqKnob.setAttribute("d", knobLineAt(D.freqKnob, D.boxTop + 8.8, freqAngle(st.f), 1.6, 7.2));
  healthKnob.setAttribute("d", knobLineAt(D.healthKnob, D.boxTop + 7.5, healthAngle(st.h), 1.4, 6.0));
  phiNeedle.setAttribute("d", dialNeedleAt(D.phiDial, D.phiTop + 0.3, phiAngle(st.phiDeg), 4.2, D.phiR - 4.8));
  ecwNeedle.setAttribute("d", dialNeedleAt(D.ecwDial, D.ecwTop + 0.3, ecwAngle(st.ecwTbw), 3.5, D.ecwR - 4.2));

  if (layer) {
    layer.draw({
      uPen: st.penetration,
      uXcNorm: st.xcFreq / 60,
      uPhase: phase,
    }, phase);
  } else if (ecwLines && icwLines) {
    icwLines.style.opacity = String(clamp(st.penetration, 0.05, 1));
  }

  const text = formatReadout(st);
  if (readout.textContent !== text) readout.textContent = text;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !calm) {
    tourClock += dt;
    const stop = tourStops[Math.floor(tourClock / 3.0) % tourStops.length];
    targetF = stop.f;
    targetH = stop.h;
  }
  settle(freq, targetF, dt, 0.32, calm);
  settle(health, targetH, dt, 0.35, calm);
  if (!calm) phase = (phase + dt * 2.2) % (Math.PI * 20);
  draw();
  const settled = calm && freq.x === targetF && health.x === targetH;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (f, h) => {
  touring = false;
  targetF = clamp(f, 5, 200);
  targetH = clamp(h, 0, 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; tourClock = 0; run(); }, 4200);
  run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = stage.getBoundingClientRect();
  const ux = clamp(((event.clientX - box.left) / box.width - 0.14) / 0.72, 0, 1);
  const uy = 1 - clamp(((event.clientY - box.top) / box.height - 0.16) / 0.68, 0, 1);
  const f = 5 * Math.pow(40, ux);
  steer(f, uy);
});
stage.addEventListener("pointerdown", (event) => {
  const box = stage.getBoundingClientRect();
  const ux = clamp(((event.clientX - box.left) / box.width - 0.14) / 0.72, 0, 1);
  const uy = 1 - clamp(((event.clientY - box.top) / box.height - 0.16) / 0.68, 0, 1);
  const f = 5 * Math.pow(40, ux);
  steer(f, uy);
});
stage.addEventListener("keydown", (event) => {
  if (event.key === "1") { event.preventDefault(); steer(5, targetH); }
  else if (event.key === "2") { event.preventDefault(); steer(50, targetH); }
  else if (event.key === "3") { event.preventDefault(); steer(200, targetH); }
  else if (event.key === "ArrowRight") { event.preventDefault(); steer(targetF * 1.35, targetH); }
  else if (event.key === "ArrowLeft") { event.preventDefault(); steer(targetF / 1.35, targetH); }
  else if (event.key === "ArrowUp") { event.preventDefault(); steer(targetF, targetH + 0.15); }
  else if (event.key === "ArrowDown") { event.preventDefault(); steer(targetF, targetH - 0.15); }
});
window.addEventListener("resize", () => draw());
draw();
`;

const outName = theme === "light" ? "fig-04-light.html" : "fig-04.html";
writeFileSync(
  join(HERE, outName),
  k.pageHtml({
    title: "Fig 4 · AD5940 다주파수(5/50/200kHz) 세포막 위상각(φ) & 세포외수분비(ECW/TBW) 계측기",
    theme,
    body: `<style>${CSS}</style>${body}`,
    script: kitScript() + glScript() + live,
    width: 800,
  }),
);
console.log("wrote", outName);

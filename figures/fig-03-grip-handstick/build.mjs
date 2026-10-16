import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;

const WIDTH = 740;
const HEIGHT = 480;
const AZIMUTH = 39;
const ELEVATION = 32;

const PLATE = { x: -168, y: -92, w: 336, d: 184, r: 10 };
const PLATE_H = 14;
const FOOT_H = 6;

// Left & right heavy cradles holding the cutaway Right Smart Hand-Stick
const CRADLE_L = { x: -146, y: -38, w: 30, d: 68, r: 3 };
const CRADLE_R = { x: 46, y: -38, w: 28, d: 68, r: 3 };
const CRADLE_Z = 24;

// Horizontal axis of the Smart Hand-Stick cutaway assembly
const STICK_Y = -4;
const STICK_Z = 42;
const ROD_YS = [-18, 10];
const ROD_X0 = -94;
const ROD_X1 = -8;

// Sliding grip carriage (moves from xShift = 0 at 0 kg to +24 mm at 48 kg)
const CARRIAGE_X0 = -84;
const MAX_SHIFT = 24;
const MAX_FORCE = 48;

// Dial indicator & RFD drum recorder on the right side of the bench
const DIAL = [108, -28];
const DIAL_R = 25;
const DIAL_Z = 58;
const DIAL_H = 11;
const DIAL_TOP = DIAL_Z + DIAL_H;

const DRUM = [112, 38];
const DRUM_R = 16;
const DRUM_Z = 18;
const DRUM_H = 34;

// Calibration weight reference post at back-left
const CAL_POST = [-138, -66];

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-150, -70, 96],
    [DIAL[0] + DIAL_R + 8, DIAL[1] - DIAL_R, DIAL_TOP + 12],
    [DRUM[0] + DRUM_R + 8, DRUM[1] + DRUM_R, DRUM_Z + DRUM_H + 14],
  ],
  WIDTH,
  HEIGHT,
  { pad: 28, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 6, bevel = 0.6) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const ALONG_X = (o) => G.frameAlong(o, [1, 0, 0]);
const ALONG_Y = (o) => G.frameAlong(o, [0, 1, 0]);

function cable(points, { r = 1.15, bend = 5, maxLength = 14, rings = null } = {}) {
  return tubePieces(G.fillet(points, bend, 8), r, P, { maxLength, spacing: 1.2, rings }).map((piece) => tubeSvg(piece, { tone: "mid" })).join("");
}

function capScrew(x, y, z, r = 2.1, h = 1.8) {
  return (
    S(k.cylinder(x, y, r, z, h, P, 18, 0.3), { tone: "mid" }) +
    L(k.ring(x, y, r * 0.55, z + h, P, 6), { tone: "lo" }) +
    D([at([x, y, z + h])], { size: 0.4, tone: "lo" })
  );
}

// 1. Precision test-bench surface plate, 8 turned feet, ruler scale (0-50 kgf), and calibration weight stack
function surfacePlate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  const feet = byDepth([
    ...k.corners(PLATE, 22),
    [0, PLATE.y + 22],
    [0, PLATE.y + PLATE.d - 22],
    [PLATE.x + 22, 0],
    [PLATE.x + PLATE.w - 22, 0],
  ]);
  for (const [fx, fy] of feet) {
    out.push(S(k.cylinder(fx, fy, 8.5, -PLATE_H - FOOT_H, 2, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(fx, fy, 6.6, -PLATE_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(fx, fy, 8.5, -PLATE_H - FOOT_H, -PLATE_H - FOOT_H + 2, 24, P, 0.2), { tone: "lo" }));
  }

  out.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P, 8), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 8), 0, P, 6), { tone: "faint" }));

  // Precision T-slot grooves on the surface plate
  for (const gy of [-54, 48]) {
    out.push(L(k.lineOnTop([PLATE.x + 18, gy], [PLATE.x + PLATE.w - 18, gy], 0, P), { tone: "faint" }));
    out.push(L(k.lineOnTop([PLATE.x + 18, gy + 2.2], [PLATE.x + PLATE.w - 18, gy + 2.2], 0, P), { tone: "lo" }));
  }

  // Corner anchor bolts
  for (const [sx, sy] of k.corners(PLATE, 12)) {
    out.push(L(k.ring(sx, sy, 2.8, 0, P, 18), { tone: "lo" }));
    out.push(D([at([sx, sy, 0])], { size: 0.55, tone: "mid" }));
  }

  // Side graduation ticks along front-right bevel
  const side = k.sideTicks(PLATE.x + 24, PLATE.x + PLATE.w - 24, 8, 5, PLATE.y + PLATE.d, -2, [2.2, 4.4], P, "x");
  out.push(L(side.minor, { tone: "lo" }), L(side.major, { tone: "mid" }));

  // Front force ruler strip (0 - 50 kgf scale)
  const strip = { x: -138, y: PLATE.y + PLATE.d - 18, w: 210, d: 9, r: 1.2 };
  out.push(S(slab(strip, 0, 1.1, 4, 0.2), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 6, strip.x + strip.w - 6, 4, 5, strip.y + 1, 1.1, [2.2, 4.6], P, "x");
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "hi" }));
  out.push(D([at([strip.x + 3, strip.y + 4.5, 1.1]), at([strip.x + strip.w - 3, strip.y + 4.5, 1.1])], { size: 0.45 }));
  out.push(k.faceTextSvg(k.topMatrix([strip.x + 10, strip.y + 7.2], 1.15, P, "x"), "0 kgf", { size: 2.8, tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([strip.x + 98, strip.y + 7.2], 1.15, P, "x"), "28 kg AWGS", { size: 2.8, tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([strip.x + strip.w - 26, strip.y + 7.2], 1.15, P, "x"), "48 kgf", { size: 2.8, tone: "mid" }));

  // Engraved brass nameplate on right front corner
  const badge = { x: 82, y: PLATE.y + PLATE.d - 19, w: 72, d: 11, r: 1.5 };
  out.push(S(slab(badge, 0, 1.2, 4, 0.3), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(badge, 1.4), 1.2, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([badge.x + 36, badge.y + 7.3], 1.25, P, "x"), "HX711 · 80 SPS RIG", { size: 3.1, tone: "hi", anchor: "middle" }));
  out.push(D([at([badge.x + 3, badge.y + 5.5, 1.2]), at([badge.x + badge.w - 3, badge.y + 5.5, 1.2])], { size: 0.4 }));

  // Calibration weight standard post (back-left corner: 28.0 kg AWGS Sarcopenia Reference)
  const [cx, cy] = CAL_POST;
  const CF = UP([cx, cy, 0]);
  out.push(S(G.solidOf([[0, 12], [3, 12], [3.6, 9.5, 1], [11, 9.5], [11.6, 11.5, 1], [17, 11.5], [17.5, 7, 1], [23, 7], [25, 3.2]], CF, P, { bevel: 0.4 }), { tone: "mid", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, 11.5, 11.6, 17, 32, P, 0.3), { tone: "lo" }));
  out.push(L(G.arcOf(CF, 11, 9.5, P) + G.arcOf(CF, 17, 11.5, P), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([cx, cy + 16], 0.2, P, "x"), "28kg STD", { size: 2.6, tone: "lo", anchor: "middle" }));

  return out.join("");
}

// 2. Back components of the Smart Hand-Stick mount, HX711 80Hz ADC board, and guide rails
function backRig() {
  const out = [];

  // HX711 24-bit 80 SPS ADC Carrier Board & Protective Chassis behind the stick
  const pcbBox = { x: -88, y: -76, w: 108, d: 30, r: 2.5 };
  out.push(S(slab(pcbBox, 0, 5, 4, 0.5), { tone: "mid" }));
  const pcb = k.insetPlan(pcbBox, 2.2);
  out.push(S(slab(pcb, 5, 2.2, 4, 0.3), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(pcb, 1.5), 7.2, P, 3), { tone: "faint" }));
  for (const [px, py] of k.corners(pcb, 3)) out.push(capScrew(px, py, 7.2, 1.5, 1.2));

  // HX711 24-bit ADC IC chip + 80 SPS RATE Jumper + Crystal Oscillator + decoupling caps
  const ic = { x: -64, y: -68, w: 22, d: 14, r: 0.8 };
  out.push(S(slab(ic, 7.2, 3.2, 3, 0.3), { tone: "hi", crease: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([ic.x + 11, ic.y + 8.5], 10.5, P, "x"), "HX711", { size: 2.8, tone: "hi", anchor: "middle" }));
  // IC gull-wing pins
  for (let i = 0; i < 8; i++) {
    const px = ic.x + 2.4 + i * 2.4;
    out.push(L(k.segment([px, ic.y - 1.6, 7.3], [px, ic.y, 9.2], P), { tone: "hi" }));
    out.push(L(k.segment([px, ic.y + ic.d + 1.6, 7.3], [px, ic.y + ic.d, 9.2], P), { tone: "hi" }));
  }
  // 20 MHz Crystal can
  const xtal = { x: -34, y: -66, w: 12, d: 8, r: 2.5 };
  out.push(S(slab(xtal, 7.2, 3.6, 5, 0.4), { tone: "hi", crease: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([xtal.x + 6, xtal.y + 5], 10.9, P, "x"), "80Hz", { size: 2.3, tone: "mid", anchor: "middle" }));

  // 4-Wire Wheatstone terminal block (E+, E-, A+, A-)
  for (let i = 0; i < 4; i++) {
    const tx = -14 + i * 7;
    out.push(S(k.cylinder(tx, -62, 2.4, 7.2, 4.5, P, 18, 0.3), { tone: "mid" }));
    out.push(D([at([tx, -62, 11.7])], { size: 0.6, tone: "hi" }));
  }
  // Telemetry status LEDs on PCB
  out.push(D([[pcb.x + 8, pcb.y + 6, 7.5], [pcb.x + 14, pcb.y + 6, 7.5], [pcb.x + 20, pcb.y + 6, 7.5]].map(at), { size: 0.9, tone: "hi", pulse: true }));

  // Left and Right Machined Test Cradles
  for (const cradle of [CRADLE_L, CRADLE_R]) {
    out.push(S(slab(cradle, 0, 10, 5, 0.7), { tone: "mid" }));
    const tower = { x: cradle.x + 3, y: cradle.y + 6, w: cradle.w - 6, d: cradle.d - 12, r: 2 };
    out.push(S(slab(tower, 10, CRADLE_Z - 10, 4, 0.6), { tone: "mid" }));
    for (const [bx, by] of k.corners(cradle, 4.5)) out.push(capScrew(bx, by, 10, 1.8, 1.5));
  }

  // Lower half-shell of the Smart Hand-Stick (`Yolanda SUS316L` Sense Electrode AIN1 + PEEK insulator + Camry EH101 Frame)
  const SF = ALONG_X([-142, STICK_Y, STICK_Z]);
  // Left rear end-cap & PEEK collar (lathe turned along X)
  out.push(
    S(
      G.solidOf(
        [
          [0, 11.5],
          [8, 11.5],
          [9.5, 14.5, 1],
          [22, 14.5],
          [23, 13.2],
          [32, 13.2],
        ],
        SF,
        P,
        { bevel: 0.5 },
      ),
      { tone: "mid", crease: "lo" },
    ),
  );
  out.push(L(G.ribsOf(SF, 10.5, 21, 14.5, 28, P), { tone: "lo" }));
  out.push(D(G.dotsOf(SF, 26, 13.2, 18, P), { size: 0.45, tone: "hi" }));

  // Lower SUS316L Electrode Shell cradle bed under the cutaway window
  const lowerShell = { x: -110, y: STICK_Y - 15, w: 120, d: 30, r: 4 };
  out.push(S(slab(lowerShell, CRADLE_Z, 8, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(lowerShell, 2), CRADLE_Z + 8, P, 4), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([-52, STICK_Y + 11.5], CRADLE_Z + 8.1, P, "x"), "SUS316L · AIN1 SENSE ELECTRODE", { size: 2.5, tone: "mid", anchor: "middle" }));

  // Right collar & PEEK dielectric separator ringBand
  const RF = ALONG_X([10, STICK_Y, STICK_Z]);
  out.push(S(G.ringBand(0, 6, 9, 14.8, RF, P), { tone: "lo" }));
  out.push(S(G.solidOf([[6, 14.8], [26, 14.8], [28, 12.2, 1], [38, 12.2]], RF, P, { bevel: 0.5 }), { tone: "hi", crease: "lo" }));
  out.push(L(G.ribsOf(RF, 8, 24, 14.8, 32, P), { tone: "lo" }));

  // Two precision chrome guide rods along X for the sliding grip carriage
  for (const ry of ROD_YS) {
    const GF = ALONG_X([ROD_X0, ry, STICK_Z]);
    out.push(S(G.disc(0, ROD_X1 - ROD_X0, 2.2, GF, P), { tone: "hi", crease: "none" }));
    // End bearing blocks
    out.push(S(slab({ x: ROD_X0 - 4, y: ry - 4, w: 5, d: 8, r: 1 }, STICK_Z - 4, 8, 3, 0.3), { tone: "mid" }));
    out.push(S(slab({ x: ROD_X1 - 1, y: ry - 4, w: 5, d: 8, r: 1 }, STICK_Z - 4, 8, 3, 0.3), { tone: "mid" }));
  }

  return out.join("");
}

// Helper for dynamic return coil springs around the two guide rods
function coilsAt(shift) {
  const from = CARRIAGE_X0 + 18 + shift;
  const to = ROD_X1 - 2;
  let back = "";
  let front = "";
  for (const ry of ROD_YS) {
    const c = k.coil(from, to, [ry, STICK_Z], 4.1, 9, "x", P, 18);
    back += c.back;
    front += c.front;
  }
  return { back, front };
}

// 3. Central 100kg Aluminum S-Beam / Bending-Beam Load Cell + Wheatstone Strain Gauge Bridge
function loadCellAssembly() {
  const out = [];
  // Fixed anchor block on right side of cutaway
  const anchor = { x: -8, y: STICK_Y - 10, w: 18, d: 20, r: 2 };
  out.push(S(slab(anchor, STICK_Z - 7, 14, 4, 0.5), { tone: "mid" }));
  out.push(capScrew(anchor.x + 5, STICK_Y - 5, STICK_Z + 7, 1.8, 1.5));
  out.push(capScrew(anchor.x + 5, STICK_Y + 5, STICK_Z + 7, 1.8, 1.5));

  // Braided 4-wire Kelvin / Wheatstone cable from load cell to HX711 PCB
  out.push(
    cable(
      [
        [2, STICK_Y - 8, STICK_Z + 2],
        [8, -32, STICK_Z - 6],
        [8, -48, 14],
        [-2, -58, 12],
        [-4, -62, 11.5],
      ],
      { r: 1.3, bend: 5, rings: { pitch: 2.2, tone: "lo" } },
    ),
  );

  // Mechanical linkage tube from load-cell flexure to Dial Indicator & RFD Drum
  out.push(
    cable(
      [
        [36, STICK_Y, STICK_Z],
        [68, STICK_Y, STICK_Z],
        [84, DIAL[1], STICK_Z],
        [DIAL[0] - DIAL_R - 4, DIAL[1], DIAL_Z + 4],
      ],
      { r: 1.5, bend: 6 },
    ),
  );

  return out.join("");
}

// 4. Sliding Grip Handle Carriage + S-Beam Flexure + Ergonomic Finger Saddles (lit: true — what moves when squeezed)
function slidingCarriage() {
  const out = [];
  const base = { x: CARRIAGE_X0, y: STICK_Y - 22, w: 18, d: 44, r: 2.5 };
  out.push(`<path class="iso-halo" d="${k.haloOf(base, STICK_Z - 6, 14, P)}" style="filter:blur(5px)"/>`);

  // Main sliding bridge block riding on the two chrome guide rods
  out.push(S(slab(base, STICK_Z - 6, 12, 5, 0.7), { tone: "hi", crease: "lo", lit: true }));

  // Bearing sleeves around the two guide rods
  for (const ry of ROD_YS) {
    const BF = ALONG_X([CARRIAGE_X0 - 2, ry, STICK_Z]);
    out.push(S(G.disc(0, 22, 4.4, BF, P, { bevel: 0.4 }), { tone: "hi", crease: "lo", lit: true }));
  }

  // 4 Ergonomic Finger Grip Saddles along the front grip bar (Camry EH101 / MyPark Grip profile)
  const gripBar = { x: CARRIAGE_X0 - 12, y: STICK_Y + 14, w: 20, d: 26, r: 3 };
  out.push(S(slab(gripBar, STICK_Z - 5, 11, 5, 0.6), { tone: "hi", crease: "lo", lit: true }));
  for (let i = 0; i < 4; i++) {
    const fy = STICK_Y - 16 + i * 9.5;
    const saddle = { x: CARRIAGE_X0 + 2, y: fy, w: 12, d: 7.2, r: 2 };
    out.push(S(slab(saddle, STICK_Z + 6, 4.5, 4, 0.5), { tone: "hi", crease: "lo", lit: true }));
    out.push(L(k.planOutline(k.insetPlan(saddle, 1.2), STICK_Z + 10.5, P, 3), { tone: "faint" }));
  }

  // 100kg Aluminum Bending-Beam Load Cell Element coupled to the carriage
  const beam = { x: CARRIAGE_X0 + 18, y: STICK_Y - 6, w: 46, d: 12, r: 1.5 };
  out.push(S(slab(beam, STICK_Z - 4, 8, 4, 0.5), { tone: "hi", crease: "lo", lit: true }));
  // Dual binocular strain-relief holes on top of the load cell beam
  out.push(L(k.ring(CARRIAGE_X0 + 34, STICK_Y, 3.6, STICK_Z + 4, P, 24), { tone: "lo" }));
  out.push(L(k.ring(CARRIAGE_X0 + 46, STICK_Y, 3.6, STICK_Z + 4, P, 24), { tone: "lo" }));
  // White-gold foil strain gauge patches (R1, R2, R3, R4)
  for (const gx of [CARRIAGE_X0 + 31, CARRIAGE_X0 + 49]) {
    const patch = { x: gx, y: STICK_Y - 3.5, w: 5, d: 7, r: 0.5 };
    out.push(S(slab(patch, STICK_Z + 4, 0.6, 2, 0.1), { tone: "lit", lit: true }));
  }
  out.push(k.faceTextSvg(k.topMatrix([CARRIAGE_X0 + 40, STICK_Y + 4.5], STICK_Z + 4.2, P, "x"), "100kg LOAD CELL", { size: 2.3, tone: "hi", anchor: "middle" }));

  // Force pointer arrow riding over the front ruler strip
  const pointerArm = { x: CARRIAGE_X0 + 6, y: STICK_Y + 22, w: 5, d: 46, r: 1 };
  out.push(S(slab(pointerArm, STICK_Z - 4, 3, 3, 0.3), { tone: "hi", lit: true }));
  out.push(S(k.cylinder(CARRIAGE_X0 + 8.5, STICK_Y + 66, 2.2, 2, STICK_Z - 4, P, 16), { tone: "hi", lit: true }));

  return out.join("");
}

// 5. Cutaway Upper SUS316L Electrode Shell (CE0 Current Injection) & MAX86150 Optical Thumb Bezel
function upperElectrodeAndThumbModule() {
  const out = [];

  // Cutaway upper arch bridge at left end of stick (SUS316L CE0 Force Electrode + MAX86150 PPG/ECG Thumb Window)
  const head = { x: -136, y: STICK_Y - 14, w: 34, d: 28, r: 4 };
  out.push(S(slab(head, STICK_Z + 6, 14, 6, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(head, 2.2), STICK_Z + 20, P, 4), { tone: "lo" }));

  // MAX86150 Optical Thumb Bezel (660nm Red + 880nm IR + Photodiode)
  const TX = -119;
  const TY = STICK_Y;
  const TZ = STICK_Z + 20;
  out.push(S(k.cylinder(TX, TY, 9.5, TZ, 3.2, P, 36, 0.5), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(TX, TY, 9.5, TZ, TZ + 3.2, 36, P, 0.2), { tone: "lo" }));
  out.push(S(k.cylinder(TX, TY, 6.8, TZ + 3.2, 0.8, P, 32), { tone: "lo" }));
  // Dual LED emitters + photodiode window inside the MAX86150 optical bezel
  out.push(S(k.slabOf({ x: TX - 4.2, y: TY - 2.2, w: 3.4, d: 4.4, r: 0.6 }, TZ + 4, 0.5, P, 3), { tone: "hi", lit: true }));
  out.push(S(k.slabOf({ x: TX + 0.6, y: TY - 2.2, w: 3.6, d: 4.4, r: 0.6 }, TZ + 4, 0.5, P, 3), { tone: "mid" }));
  out.push(D([at([TX - 2.5, TY - 0.8, TZ + 4.6]), at([TX - 2.5, TY + 0.8, TZ + 4.6])], { size: 1.1, tone: "hi", pulse: true }));
  out.push(k.faceTextSvg(k.topMatrix([TX, TY + 12.2], TZ + 0.2, P, "x"), "MAX86150 PPG", { size: 2.4, tone: "hi", anchor: "middle" }));

  // Upper cutaway rim showing the 2.5mm SUS316L electrode wall thickness
  const cutawayRim = { x: -102, y: STICK_Y - 14, w: 88, d: 4.2, r: 1 };
  out.push(S(slab(cutawayRim, STICK_Z + 8, 5.5, 4, 0.4), { tone: "hi", crease: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([-58, STICK_Y - 11.2], STICK_Z + 13.6, P, "x"), "SUS316L · CE0 FORCE", { size: 2.3, tone: "hi", anchor: "middle" }));

  return out.join("");
}

// 6. Right-side Precision Mechanical Dial Indicator (0-50 kgf) & RFD 200ms Drum Recorder
function dialAndRfdRecorder() {
  const out = [];
  const [dx, dy] = DIAL;

  // Pedestal column supporting the dial indicator
  out.push(S(k.cylinder(dx, dy, 9, 0, 6, P, 32, 0.6), { tone: "mid" }));
  out.push(L(k.knurl(dx, dy, 9, 0, 6, 28, P, 0.3), { tone: "lo" }));
  out.push(S(k.cylinder(dx, dy, 4.2, 6, DIAL_Z - 6, P, 24), { tone: "mid", crease: "none" }));
  out.push(L([22, 38].map((z) => k.sideArc(dx, dy, 4.2, z, P, 16)).join(""), { tone: "faint" }));

  // Dial Indicator Body & Knurled Bezel
  out.push(S(k.cylinder(dx, dy, DIAL_R + 2, DIAL_Z - 2, 2, P, 56), { tone: "lo" }));
  out.push(S(k.cylinder(dx, dy, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.9), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(dx, dy, DIAL_R, DIAL_TOP - 3.6, DIAL_TOP, 80, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(dx, dy, DIAL_R - 2.4, DIAL_TOP, P, 64), { tone: "lo" }));

  // Radial force ticks (50 divisions = 50 kgf full scale, with AWGS 28kg mark highlighted)
  const ticks = k.radialTicks(dx, dy, DIAL_R - 3.2, 50, 5, DIAL_TOP, [1.5, 3.4], P, -140 * DEG, 280 * DEG);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "hi" }));

  // AWGS 28.0 kg Sarcopenia threshold marker arc on dial face
  const awgsAngle = (-140 + (28 / 50) * 280) * DEG;
  out.push(
    L(
      k.lineOnTop(
        [dx + Math.sin(awgsAngle) * (DIAL_R - 8), dy - Math.cos(awgsAngle) * (DIAL_R - 8)],
        [dx + Math.sin(awgsAngle) * (DIAL_R - 2.6), dy - Math.cos(awgsAngle) * (DIAL_R - 2.6)],
        DIAL_TOP + 0.1,
        P,
      ),
      { tone: "red" },
    ),
  );
  out.push(L(k.ring(dx, dy, 2.2, DIAL_TOP + 0.2, P, 20), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([dx, dy + 10], DIAL_TOP + 0.1, P, "x"), "kgf · RFD", { size: 2.7, tone: "mid", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([dx, dy - 9], DIAL_TOP + 0.1, P, "x"), "AWGS 28", { size: 2.3, tone: "lo", anchor: "middle" }));

  // RFD (Rate of Force Development, 0-200ms explosive slope) Kymograph Drum Recorder at front-right
  const [rx, ry] = DRUM;
  const DF = UP([rx, ry, 0]);
  out.push(S(k.cylinder(rx, ry, DRUM_R + 3, 0, 5, P, 40, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(rx, ry, 4, 5, DRUM_Z - 5, P, 24), { tone: "mid" }));
  // Recording cylinder drum
  out.push(S(k.cylinder(rx, ry, DRUM_R, DRUM_Z, DRUM_H, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  // Grid rings around the recording drum
  for (const gz of [DRUM_Z + 7, DRUM_Z + 14, DRUM_Z + 21, DRUM_Z + 28]) {
    out.push(L(k.sideArc(rx, ry, DRUM_R + 0.1, gz, P, 28), { tone: "faint" }));
  }
  // Top thumb nut on drum
  out.push(S(G.solidOf([[DRUM_Z + DRUM_H, 5.5], [DRUM_Z + DRUM_H + 4, 5.5], [DRUM_Z + DRUM_H + 5, 3, 1], [DRUM_Z + DRUM_H + 7, 3]], DF, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(L(k.knurl(rx, ry, 5.5, DRUM_Z + DRUM_H, DRUM_Z + DRUM_H + 4, 20, P, 0.2), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([rx, ry + 7.5], DRUM_Z + DRUM_H + 0.2, P, "x"), "RFD 200ms", { size: 2.3, tone: "mid", anchor: "middle" }));

  // Stylus post next to the drum
  const sx = rx - DRUM_R - 8;
  const sy = ry + 6;
  out.push(S(k.cylinder(sx, sy, 3.2, 0, DRUM_Z + DRUM_H - 2, P, 20, 0.3), { tone: "mid" }));

  return out.join("");
}

const needleAt = (forceKg) => {
  const angle = (-140 + (Math.min(50, Math.max(0, forceKg)) / 50) * 280) * DEG;
  const [x, y] = DIAL;
  return k.lineOnTop(
    [x - Math.sin(angle) * 4.2, y + Math.cos(angle) * 4.2],
    [x + Math.sin(angle) * (DIAL_R - 4.5), y - Math.cos(angle) * (DIAL_R - 4.5)],
    DIAL_TOP + 0.3,
    P,
  );
};

// Dynamic RFD curve drawn on the front face of the rotating drum (0 to 200ms slope)
const rfdTraceAt = (forceKg) => {
  const [rx, ry] = DRUM;
  const [vx, vy] = k.towardViewer(P);
  const baseAngle = Math.atan2(vy, vx);
  const pts = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const angle = baseAngle - 0.95 + u * 1.9;
    // Explosive RFD rise curve: steeper slope for higher force
    const rise = (forceKg / MAX_FORCE) * 24 * (1 - Math.exp(-u * 4.2));
    const px = rx + (DRUM_R + 0.25) * Math.cos(angle);
    const py = ry + (DRUM_R + 0.25) * Math.sin(angle);
    const pz = DRUM_Z + 4 + rise;
    pts.push(at([px, py, pz]));
  }
  return k.pathOf(pts);
};

const START_FORCE = 34.2;
const startShift = (START_FORCE / MAX_FORCE) * MAX_SHIFT;
const startCoils = coilsAt(startShift);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Cutaway isometric test bench of the CONNECT InBody AI Right Smart Hand-Stick (Camry EH101 frame, Yolanda SUS316L 4-wire Kelvin electrodes, MAX86150 optical PPG/ECG thumb module, and HX711 24-bit 80Hz 100kg strain-gauge load cell). Squeezing the sliding grip carriage compresses the dual return springs, flexes the central bending-beam load cell, turns the 0-50 kgf dial indicator, and records the 0.2-second Rate of Force Development (RFD) slope on the kymograph drum.",
  body: [
    surfacePlate(),
    backRig(),
    `<path data-part="coil-back" class="iso-line" data-tone="lo" d="${startCoils.back}"/>`,
    loadCellAssembly(),
    `<g data-part="carriage" transform="${k.translateAlong(P, [startShift, 0, 0])}">${slidingCarriage()}</g>`,
    `<path data-part="coil-front" class="iso-line" data-tone="hi" d="${startCoils.front}"/>`,
    upperElectrodeAndThumbModule(),
    dialAndRfdRecorder(),
    `<path data-part="rfd-trace" class="iso-line" data-tone="lit" d="${rfdTraceAt(START_FORCE)}" style="stroke-width:1.15"/>`,
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(START_FORCE)}" style="stroke-width:1.25"/>`,
  ],
});

function formatReadout(forceKg) {
  const f = Math.max(0, Math.min(MAX_FORCE, forceKg));
  const rfd = f * 3.85; // 0-200ms explosive Rate of Force Development (kg/s)
  const hold = Math.round(78 + Math.min(20, f * 0.42));
  const normal = f >= 28.0;
  const awgs = normal ? "AWGS Normal (≥28kg)" : f >= 18.0 ? "AWGS Low-M / Normal-F" : "AWGS Sarcopenia (<18kg)";
  const club = f >= 32.0 ? "Std Grip · Regular Shaft" : f >= 24.0 ? "Midsize Grip · Flex Shaft" : "+2mm Oversize Grip · Light Shaft";
  return `F_max ${f.toFixed(1)} kg · RFD ${rfd.toFixed(0)} kg/s · Hold ${hold}% · ${awgs} → ${club}`;
}

const live = `
const P = ${JSON.stringify(P)};
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const DRUM = ${JSON.stringify(DRUM)};
const DRUM_R = ${DRUM_R}, DRUM_Z = ${DRUM_Z};
const ROD_YS = ${JSON.stringify(ROD_YS)};
const ROD_X1 = ${ROD_X1}, CARRIAGE_X0 = ${CARRIAGE_X0}, STICK_Z = ${STICK_Z};
const MAX_SHIFT = ${MAX_SHIFT}, MAX_FORCE = ${MAX_FORCE};
const DEG = Math.PI / 180;

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const coilBack = svg.querySelector('[data-part="coil-back"]');
const coilFront = svg.querySelector('[data-part="coil-front"]');
const needle = svg.querySelector('[data-part="needle"]');
const rfdTrace = svg.querySelector('[data-part="rfd-trace"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function coilsAt(shift) {
  const from = CARRIAGE_X0 + 18 + shift;
  const to = ROD_X1 - 2;
  let back = "", front = "";
  for (const ry of ROD_YS) {
    const c = coil(from, to, [ry, STICK_Z], 4.1, 9, "x", P, 18);
    back += c.back;
    front += c.front;
  }
  return { back, front };
}

function needleAt(forceKg) {
  const angle = (-140 + (clamp(forceKg, 0, 50) / 50) * 280) * DEG;
  const [x, y] = DIAL;
  return lineOnTop(
    [x - Math.sin(angle) * 4.2, y + Math.cos(angle) * 4.2],
    [x + Math.sin(angle) * (DIAL_R - 4.5), y - Math.cos(angle) * (DIAL_R - 4.5)],
    DIAL_TOP + 0.3,
    P
  );
}

function rfdTraceAt(forceKg) {
  const [rx, ry] = DRUM;
  const [vx, vy] = towardViewer(P);
  const baseAngle = Math.atan2(vy, vx);
  const pts = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const angle = baseAngle - 0.95 + u * 1.9;
    const rise = (forceKg / MAX_FORCE) * 24 * (1 - Math.exp(-u * 4.2));
    pts.push(iso([rx + (DRUM_R + 0.25) * Math.cos(angle), ry + (DRUM_R + 0.25) * Math.sin(angle), DRUM_Z + 4 + rise], P));
  }
  return pathOf(pts);
}

${formatReadout.toString()}

let force = ${START_FORCE}, target = ${START_FORCE}, vel = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;
const stops = [34.2, 42.5, 21.4, 28.0, 15.6];
const tourAt = (t) => stops[Math.floor(t / 2.6) % stops.length];

function draw() {
  const shift = (force / MAX_FORCE) * MAX_SHIFT;
  carriage.setAttribute("transform", translateAlong(P, [shift, 0, 0]));
  const c = coilsAt(shift);
  coilBack.setAttribute("d", c.back);
  coilFront.setAttribute("d", c.front);
  needle.setAttribute("d", needleAt(force));
  rfdTrace.setAttribute("d", rfdTraceAt(force));
  const text = formatReadout(force);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", force.toFixed(1));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring && !calm) {
    clock += dt;
    target = tourAt(clock);
  }
  if (calm) {
    force = target;
    vel = 0;
  } else {
    const stiff = 260, damp = 24;
    for (let i = 0; i < 4; i++) {
      const h = dt / 4;
      vel += ((target - force) * stiff - vel * damp) * h;
      force += vel * h;
    }
    if (Math.abs(target - force) < 0.02 && Math.abs(vel) < 0.02) {
      force = target;
      vel = 0;
    }
  }
  draw();
  const settled = !touring && force === target && vel === 0;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  touring = false;
  target = clamp(next, 0, MAX_FORCE);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 3800);
  run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.14) / 0.72, 0, 1);
  steer(share * MAX_FORCE);
});
stage.addEventListener("pointerdown", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.14) / 0.72, 0, 1);
  steer(share * MAX_FORCE);
});
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 5 : 1.5;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); steer(target + step); }
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); steer(target - step); }
  else if (event.key === " ") { event.preventDefault(); steer(44.0); }
  else if (event.key === "Home") { event.preventDefault(); steer(15.6); }
  else if (event.key === "End") { event.preventDefault(); steer(46.0); }
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 3",
  title: "Multi-Sensor Grip Hand-Stick & HX711 80Hz Dynamometer Rig",
  hint: "Move across or press Arrow / Space to squeeze grip (0–48 kgf)",
  readout: formatReadout(START_FORCE),
  keys: [
    { mark: "lit", label: "Sliding grip carriage, 100kg strain-gauge load cell, dial needle & RFD stylus" },
    { mark: "raised", label: "Cutaway SUS316L Kelvin electrodes (CE0/AIN1), MAX86150 PPG bezel & HX711 80 SPS PCB" },
    { mark: "red", label: "AWGS 2025 sarcopenia clinical cutoff (28.0 kg M / 18.0 kg F)" },
  ],
  caption:
    "Cutaway test rig of the CONNECT InBody AI Right Smart Hand-Stick. While the outer SUS316L half-shells inject and sense 4-wire bio-impedance current and the top MAX86150 optical module captures 660/880nm thumb PPG, squeezing the internal sliding carriage flexes a 100kg aluminum bending-beam load cell sampled by an HX711 24-bit ADC at 80 Hz (12.5 ms resolution) to quantify peak isometric grip strength (F_max), 0.2 s explosive Rate of Force Development (RFD = ΔF/0.2s), and MyPark club grip/shaft prescription.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Smart Hand-Stick grip dynamometer: move pointer or use arrow keys to vary grip force from 0 to 48 kg" aria-valuemin="0" aria-valuemax="48" aria-valuenow="${START_FORCE}">${svg}</div>`,
});

const outName = theme === "light" ? "fig-03-light.html" : "fig-03.html";
writeFileSync(
  join(HERE, outName),
  k.pageHtml({
    title: "Fig 3 · 스마트 멀티센서 우측 핸드스틱 단면 & HX711 80Hz 악력·RFD 다이나모미터",
    theme,
    body,
    script: kitScript() + live,
    width: 780,
  }),
);
console.log("wrote", outName);

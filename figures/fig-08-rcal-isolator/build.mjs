import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as T from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 680;
const HEIGHT = 450;
const AZIMUTH = 40;
const ELEVATION = 30;

// Dual-Deck Isolation Bench Geometry
const BENCH = { x: -146, y: -74, w: 292, d: 148, r: 8 };
const SUB_Z0 = -16;
const SUB_H = 6; // Insulating phenolic sub-base from z=-16 to z=-10
const FOOT_H = 5;

// Left Deck (Patient Floating Bio-Ground, x: -146 .. -12) & Right Deck (PC USB Host Ground, x: 12 .. 146)
const DECK_L = { x: -146, y: -74, w: 134, d: 148, r: 7 };
const DECK_R = { x: 12, y: -74, w: 134, d: 148, r: 7 };
const DECK_Z0 = -10;
const DECK_H = 10; // Top surface at z = 0

// Dial Gauge on Right Deck
const DIAL = [94, -22];
const DIAL_R = 22;
const DIAL_Z = 56;
const DIAL_H = 10;
const DIAL_TOP = DIAL_Z + DIAL_H;

export const P = k.fitProjection(
  [
    ...k.boxCorners(BENCH, SUB_Z0 - FOOT_H, 0),
    [-130, -60, 74],
    [DIAL[0] + DIAL_R + 8, DIAL[1] + DIAL_R, DIAL_TOP + 6],
  ],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const VERT = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const HORIZ_X = (x, y, z) => G.frameOf([x, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

export const R = A.recorder(P);
let solidCount = 0;
const countSolid = (paths, style) => {
  solidCount++;
  return S(paths, style);
};

// 1. Phenolic Insulating Sub-Base + 6 Heavy Isolation Feet + Creepage Trench Ribs (14 solids)
function isolationBenchBase() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, SUB_Z0 - FOOT_H, SUB_H + DECK_H, P)}"/>`];

  const footPts = [
    [-124, -52],
    [-124, 52],
    [-28, -52],
    [-28, 52],
    [32, -52],
    [32, 52],
    [124, -52],
    [124, 52],
  ];
  for (const [fx, fy] of byDepth(footPts)) {
    out.push(countSolid(k.cylinder(fx, fy, 7.2, SUB_Z0 - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(countSolid(k.cylinder(fx, fy, 5.5, SUB_Z0 - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
  }

  // Continuous High-Dielectric Sub-Base Slab (z: -16 .. -10)
  out.push(
    countSolid(k.slabOf(BENCH, SUB_Z0, SUB_H, P, 8, 1.2), {
      tone: "lo",
      inner: L(k.sideSeam(BENCH, SUB_Z0 + 2.5, P, 8), { tone: "faint" }),
    }),
  );

  // 3 High-Voltage Creepage Barrier Ribs inside the 24mm Center Air-Gap Trench (x: -12 .. +12, z: -10 .. -5.5)
  for (const rx of [-6.5, 0, 6.5]) {
    const rib = { x: rx - 1.4, y: BENCH.y + 4, w: 2.8, d: BENCH.d - 8, r: 0.6 };
    out.push(countSolid(k.slabOf(rib, DECK_Z0, 4.2, P, 2, 0.3), { tone: "lo" }));
  }

  // Left Floating Bio-Ground Deck (x: -146 .. -12, z: -10 .. 0)
  const screwsL = k.corners(DECK_L, 9);
  out.push(
    countSolid(k.slabOf(DECK_L, DECK_Z0, DECK_H, P, 7, 1.4), {
      tone: "mid",
      inner: L(k.sideSeam(DECK_L, DECK_Z0 + 3.5, P, 7), { tone: "faint" }),
    }),
  );
  out.push(L(k.planOutline(k.insetPlan(DECK_L, 4.5), 0, P), { tone: "lo" }));
  out.push(L(screwsL.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screwsL.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // Right PC USB Host Ground Deck (x: +12 .. +146, z: -10 .. 0)
  const screwsR = k.corners(DECK_R, 9);
  out.push(
    countSolid(k.slabOf(DECK_R, DECK_Z0, DECK_H, P, 7, 1.4), {
      tone: "mid",
      inner: L(k.sideSeam(DECK_R, DECK_Z0 + 3.5, P, 7), { tone: "faint" }),
    }),
  );
  out.push(L(k.planOutline(k.insetPlan(DECK_R, 4.5), 0, P), { tone: "lo" }));
  out.push(L(screwsR.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screwsR.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // Front Precision Scale Strip on Left Deck
  const stripL = { x: -134, y: DECK_L.y + DECK_L.d - 13, w: 112, d: 6, r: 1 };
  out.push(countSolid(k.slabOf(stripL, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticksL = k.topTicks(stripL.x + 4, stripL.x + stripL.w - 4, 4, 5, stripL.y + 0.8, 0.6, [1.8, 3.2], P);
  out.push(L(ticksL.minor, { tone: "lo" }), L(ticksL.major, { tone: "mid" }));

  // Deck Engraving Labels
  out.push(
    k.faceTextSvg(k.topMatrix([-79, -62], 0, P, "x"), "PATIENT FLOATING GND (3.3V ISO)", {
      size: 2.9,
      tone: "mid",
      anchor: "middle",
    }),
  );
  out.push(
    k.faceTextSvg(k.topMatrix([0, 64], -5.5, P, "x"), "2500V AIR GAP", {
      size: 2.7,
      tone: "hi",
      anchor: "middle",
    }),
  );
  out.push(
    k.faceTextSvg(k.topMatrix([79, -62], 0, P, "x"), "PC USB HOST GND (5V VBUS)", {
      size: 2.9,
      tone: "mid",
      anchor: "middle",
    }),
  );

  return out.join("");
}

// 2. Left Deck: SUS316L Electrode Posts + AD5940 + Internal 200.0Ω RCAL + SWMatrix Rotary Switch (22 solids)
const TERM_L = [-116, -18];
const TERM_R = [-68, -18];
const TERM_TOP = 24;

function leftPatientDeck() {
  const out = [];

  // Two SUS316L 4-Wire Kelvin Electrode Terminal Posts (Left & Right Handle Simulators)
  for (const [idx, [tx, ty]] of [TERM_L, TERM_R].entries()) {
    const F = VERT(tx, ty, 0);
    // Insulator base collar
    out.push(countSolid(k.cylinder(tx, ty, 9.5, 0, 3.2, P, 32), { tone: "lo" }));
    // Turned brass & chrome Kelvin post using G.solidOf
    const postProfile = [
      [3.2, 7.4],
      [7.0, 7.4],
      [7.8, 5.2],
      [18.5, 5.2],
      [19.2, 6.8],
      [22.4, 6.8],
      [TERM_TOP, 4.4],
    ];
    out.push(
      countSolid(G.solidOf(postProfile, F, P), {
        tone: "hi",
        crease: "lo",
        inner:
          L(G.ribsOf(F, 3.5, 6.7, 7.4, 36, P, { seams: true }), { tone: "lo" }) +
          L(G.arcOf(F, 19.2, 6.8, P), { tone: "faint" }),
      }),
    );
    // Gold contact anvil cap at top of post
    out.push(countSolid(k.cylinder(tx, ty, 3.6, TERM_TOP, 1.8, P, 24), { tone: "hi", lit: true }));
    out.push(D(G.dotsOf(F, 13.0, 5.2, 8, P), { size: 0.45, tone: "lo" }));
    out.push(
      k.faceTextSvg(k.topMatrix([tx, ty + 14], 0, P, "x"), idx === 0 ? "CE0 / RE0 (L)" : "AIN1 / SE0 (R)", {
        size: 2.5,
        tone: "lo",
        anchor: "middle",
      }),
    );
  }

  // Overhead Calibration Arch Frame behind the two electrode posts
  const archPostL = [-128, -38];
  const archPostR = [-56, -38];
  for (const [px, py] of [archPostL, archPostR]) {
    out.push(countSolid(k.slabOf({ x: px - 5.5, y: py - 5.5, w: 11, d: 11, r: 2 }, 0, 5, P, 3, 0.5), { tone: "mid" }));
    out.push(countSolid(k.cylinder(px, py, 3.2, 5, 47, P, 24), { tone: "mid", crease: "none" }));
    out.push(countSolid(k.cylinder(px, py, 4.2, 52, 3, P, 24), { tone: "hi" }));
  }
  // Crossbeam holding the 500Ω Shunt Carriage Actuator
  const beam = { x: -132, y: -43, w: 80, d: 10, r: 2 };
  out.push(countSolid(k.slabOf(beam, 46, 6, P, 4, 0.6), { tone: "mid" }));
  out.push(
    D(
      [
        at([-128, -38, 55]),
        at([-56, -38, 55]),
        at([-116, -38, 52]),
        at([-68, -38, 52]),
      ],
      { size: 0.48 },
    ),
  );

  // AD5940 Analog Front-End + Internal 200.0Ω (0.1%) RCAL Reference Block (front-left of Left Deck)
  const afeBoard = { x: -134, y: 8, w: 110, d: 46, r: 3.5 };
  out.push(countSolid(k.slabOf(afeBoard, 0, 4.5, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(afeBoard, 2.5), 4.5, P, 4), { tone: "faint" }));

  // Internal Factory-Trimmed 200.0 Ω (0.1%) Precision Thin-Film Reference Resistor Block
  const rcalBlock = { x: -128, y: 14, w: 34, d: 16, r: 2 };
  out.push(countSolid(k.slabOf(rcalBlock, 4.5, 6.5, P, 4, 0.5), { tone: "hi", crease: "lo", lit: true }));
  // Gold trim terminals on ends of RCAL 200Ω block
  out.push(countSolid(k.slabOf({ x: -128, y: 15.5, w: 4.5, d: 13, r: 1 }, 4.5, 6.8, P, 3, 0.3), { tone: "hi" }));
  out.push(countSolid(k.slabOf({ x: -98.5, y: 15.5, w: 4.5, d: 13, r: 1 }, 4.5, 6.8, P, 3, 0.3), { tone: "hi" }));
  out.push(
    k.faceTextSvg(k.topMatrix([-111, 22], 11.1, P, "x"), "RCAL 200.0Ω", {
      size: 2.5,
      tone: "hi",
      anchor: "middle",
    }),
  );

  // AD5940 BGA IC Package
  const ad5940 = { x: -86, y: 13, w: 28, d: 26, r: 2 };
  out.push(countSolid(k.slabOf(ad5940, 4.5, 5.2, P, 4, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(ad5940, 2.2), 9.7, P, 3), { tone: "lo" }));
  out.push(
    k.faceTextSvg(k.topMatrix([-72, 26], 9.8, P, "x"), "AD5940", {
      size: 2.8,
      tone: "hi",
      anchor: "middle",
    }),
  );

  // SWMatrix Mechanical Rotary Switch Turret on AD5940 Board
  const swPos = [-40, 26];
  out.push(countSolid(k.cylinder(swPos[0], swPos[1], 10.5, 4.5, 5.0, P, 36), { tone: "mid" }));
  out.push(L(k.knurl(swPos[0], swPos[1], 10.5, 5.0, 9.2, 42, P), { tone: "lo" }));
  const swTicks = k.radialTicks(swPos[0], swPos[1], 9.2, 12, 3, 9.5, [1.2, 2.2], P);
  out.push(L(swTicks.minor, { tone: "lo" }), L(swTicks.major, { tone: "mid" }));
  out.push(countSolid(k.cylinder(swPos[0], swPos[1], 5.8, 9.5, 4.2, P, 28), { tone: "hi", lit: true }));

  // Coiled Kelvin Sensing Tubes from Terminal Posts to AD5940 Board
  const routeL = G.fillet(
    [
      [TERM_L[0], TERM_L[1] + 7, 5.5],
      [TERM_L[0], 2, 5.5],
      [-118, 2, 6.2],
      [-118, 12, 6.2],
    ],
    4,
    8,
  );
  for (const piece of T.tubePieces(routeL, 1.35, P, { maxLength: 18 })) {
    out.push(T.tubeSvg(piece, { tone: "hi" }));
  }

  const routeR = G.fillet(
    [
      [TERM_R[0], TERM_R[1] + 7, 5.5],
      [TERM_R[0], 2, 5.5],
      [-72, 2, 6.2],
      [-72, 13, 6.2],
    ],
    4,
    8,
  );
  for (const piece of T.tubePieces(routeR, 1.35, P, { maxLength: 18 })) {
    out.push(T.tubeSvg(piece, { tone: "hi" }));
  }

  return out.join("");
}

// 3. Movable External 500.0 Ω + 10 nF Precision Axial Calibration Shunt Carriage (10 solids)
function calibrationShuntCarriage() {
  const out = [];
  // Vertical guide rods descending from the overhead arch beam (x: -116 and -68, y: -38 -> -18)
  for (const tx of [TERM_L[0], TERM_R[0]]) {
    // Support arm from y=-38 to y=-18 at z=38
    out.push(
      countSolid(k.slabOf({ x: tx - 2.6, y: -39, w: 5.2, d: 24, r: 1.2 }, 37, 3.5, P, 3, 0.4), { tone: "mid" }),
    );
    // Vertical spring plunger barrel at (tx, -18)
    out.push(countSolid(k.cylinder(tx, TERM_L[1], 3.2, 30, 11, P, 24), { tone: "mid" }));
    // Gold pogo contact tip descending to z = 25.8 (meets TERM_TOP+1.8 = 25.8 when lowered by dz = -3.8)
    out.push(countSolid(k.cylinder(tx, TERM_L[1], 2.1, 26.2, 4.0, P, 20), { tone: "hi", lit: true }));
  }

  // Horizontal Precision 500.0 Ω (0.05%) Axial Reference Resistor Body bridging TERM_L (-116) to TERM_R (-68) at y=-18, z=33.5
  const resF = HORIZ_X(TERM_L[0], TERM_L[1], 33.5);
  const span = TERM_R[0] - TERM_L[0]; // 48 units
  // Axial lead wires (s: 0 .. 9 and 39 .. 48) + ceramic precision resistor body (s: 9 .. 39)
  const resProfile = [
    [0, 1.4],
    [8.5, 1.4],
    [9.2, 5.6],
    [13.5, 5.6],
    [14.2, 4.8],
    [33.8, 4.8],
    [34.5, 5.6],
    [38.8, 5.6],
    [39.5, 1.4],
    [span, 1.4],
  ];
  const colorBands = [16.5, 19.5, 22.5, 25.5, 30.5]
    .map((s) => G.arcOf(resF, s, 4.88, P, { least: -0.2 }))
    .join("");
  out.push(
    countSolid(G.solidOf(resProfile, resF, P), {
      tone: "hi",
      crease: "lo",
      lit: true,
      inner: L(colorBands, { tone: "hi" }),
    }),
  );

  // Parallel 10 nF Cole-Cole Phase Reference Capacitor cylinder mounted above the 500.0Ω resistor at z=41.5
  const capF = HORIZ_X(TERM_L[0] + 12, TERM_L[1], 41.5);
  out.push(
    countSolid(
      G.solidOf(
        [
          [0, 1.0],
          [4, 1.0],
          [4.5, 3.2],
          [19.5, 3.2],
          [20, 1.0],
          [24, 1.0],
        ],
        capF,
        P,
      ),
      { tone: "mid", inner: L(G.arcOf(capF, 8, 3.22, P) + G.arcOf(capF, 16, 3.22, P), { tone: "lo" }) },
    ),
  );

  // Top Bridge Handle Plate with "500.0Ω + 10nF CAL JIG" label
  const bridgePlate = { x: TERM_L[0] - 4, y: TERM_L[1] - 4.5, w: span + 8, d: 9, r: 1.8 };
  out.push(countSolid(k.slabOf(bridgePlate, 44.5, 2.8, P, 3, 0.4), { tone: "hi", lit: true }));
  out.push(
    k.faceTextSvg(k.topMatrix([-92, TERM_L[1] + 0.5], 47.4, P, "x"), "500.0Ω + 10nF JIG", {
      size: 2.5,
      tone: "hi",
      anchor: "middle",
    }),
  );

  return out.join("");
}

// 4. Center 2500 Vrms Galvanic Isolation Bridge: ADuM3160 + B0505S-1WR3 + Surge Breaker Gate (14 solids)
function centerIsolationBridge() {
  const out = [];

  // B0505S-1WR3 Isolated DC-DC Converter spanning the trench at y = -36 (x: -18 .. +18, z: 0 .. 14)
  const dcdc = { x: -18, y: -44, w: 36, d: 18, r: 2.2 };
  out.push(countSolid(k.slabOf(dcdc, 0, 12.5, P, 4, 0.7), { tone: "mid", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(dcdc, 2.0), 12.5, P, 3), { tone: "faint" }));
  out.push(
    k.faceTextSvg(k.topMatrix([0, -35], 12.6, P, "x"), "B0505S 1500V", {
      size: 2.5,
      tone: "mid",
      anchor: "middle",
    }),
  );

  // ADuM3160 2500 Vrms Magnetic-Coupling USB Isolator Bridge spanning the trench at y = 6 (x: -22 .. +22, z: 0 .. 11)
  const adumBase = { x: -22, y: -6, w: 44, d: 28, r: 2.6 };
  out.push(countSolid(k.slabOf(adumBase, 0, 8.5, P, 4, 0.7), { tone: "hi", crease: "lo", lit: true }));

  // Dual Planar Magnetic Transformer Coils embossed on top of ADuM3160 (z: 8.5 .. 11.2)
  for (const cx of [-8.5, 8.5]) {
    out.push(countSolid(k.cylinder(cx, 8, 6.2, 8.5, 2.6, P, 32), { tone: "hi", lit: true }));
    out.push(L(k.ring(cx, 8, 4.2, 11.1, P, 24), { tone: "lo" }));
    out.push(L(k.ring(cx, 8, 2.2, 11.1, P, 18), { tone: "mid" }));
    out.push(D([at([cx, 8, 11.1])], { size: 0.48, tone: "hi" }));
  }
  // Coupling bridge line between the two magnetic transformer coils
  out.push(L(k.lineOnTop([-2.3, 8], [2.3, 8], 11.1, P), { tone: "hi" }));
  out.push(
    k.faceTextSvg(k.topMatrix([0, 18.5], 8.6, P, "x"), "ADuM3160 2.5kV", {
      size: 2.5,
      tone: "hi",
      anchor: "middle",
    }),
  );

  // Isolation Gull-Wing Lead Pins on Left (-22) and Right (+22) edges of ADuM3160
  for (const py of [-2, 3, 8, 13, 18]) {
    out.push(countSolid(k.slabOf({ x: -25.5, y: py - 0.8, w: 3.5, d: 1.6, r: 0.3 }, 0, 3.2, P, 2), { tone: "mid" }));
    out.push(countSolid(k.slabOf({ x: 22.0, y: py - 0.8, w: 3.5, d: 1.6, r: 0.3 }, 0, 3.2, P, 2), { tone: "mid" }));
  }

  return out.join("");
}

// Movable 220V PC Ground Surge Arrester Gate in front of ADuM3160 (y = 38)
function surgeGate() {
  const out = [];
  const gate = { x: -10, y: 34, w: 20, d: 12, r: 1.8 };
  out.push(countSolid(k.slabOf(gate, 0, 14, P, 4, 0.6), { tone: "hi", lit: true }));
  out.push(countSolid(k.cylinder(0, 40, 4.2, 14, 3.5, P, 24), { tone: "mid" }));
  out.push(
    k.faceTextSvg(k.topMatrix([0, 40], 17.6, P, "x"), "<10µA", {
      size: 2.3,
      tone: "hi",
      anchor: "middle",
    }),
  );
  return out.join("");
}

// 5. Right Deck: PC USB Host + Cable Tare Compensation Slider + Precision Tare Dial Indicator (18 solids)
const RAIL_X0 = 32;
const RAIL_X1 = 132;
const CARRIAGE_W = 48;
const STOPS = [44, 68, 92];

function rightHostDeckAndDial() {
  const out = [];

  // Guide Rails on Right Deck for the 3-Mode Calibration / Tare Block Carriage (y: -36 and -8)
  for (const ry of [-36, -8]) {
    out.push(
      countSolid(k.slabOf({ x: RAIL_X0, y: ry, w: RAIL_X1 - RAIL_X0, d: 4.5, r: 1 }, 0, 3.0, P, 3, 0.4), {
        tone: "mid",
      }),
    );
    out.push(D([RAIL_X0 + 5, RAIL_X1 - 5].map((x) => at([x, ry + 2.25, 3.0])), { size: 0.42 }));
  }

  // Magnetic Stand & Vertical Column at back-right (x: 42, y: -54) holding the Tare Dial Indicator over DIAL=[94, -22]
  const mag = { x: 26, y: -66, w: 32, d: 24, r: 2.5 };
  out.push(countSolid(k.slabOf(mag, 0, 14, P, 4, 0.7), { tone: "mid" }));
  out.push(countSolid(k.cylinder(42, -54, 4.5, 14, 4, P, 24), { tone: "mid" }));
  out.push(countSolid(k.cylinder(42, -54, 3.2, 18, 56, P, 24), { tone: "mid", crease: "none" }));
  out.push(countSolid(k.cylinder(42, -54, 4.0, 74, 2.5, P, 24), { tone: "hi" }));

  // Crossbar clamp at z = 60 reaching from (42, -54) to DIAL (94, -22)
  out.push(countSolid(k.slabOf({ x: 36, y: -60, w: 12, d: 12, r: 2 }, 56, 10, P, 3, 0.5), { tone: "mid" }));
  const armRoute = G.fillet(
    [
      [42, -54, 61],
      [94, -54, 61],
      [94, -22, 61],
    ],
    6,
    8,
  );
  for (const piece of T.tubePieces(armRoute, 2.1, P, { maxLength: 24 })) {
    out.push(T.tubeSvg(piece, { tone: "mid" }));
  }

  // Precision Cable-Tare & Impedance Dial Gauge Housing at DIAL = [94, -22], z = 56..66
  const [dx, dy] = DIAL;
  out.push(countSolid(k.cylinder(dx, dy, 3.2, 34, DIAL_Z - 34, P, 20), { tone: "mid" }));
  out.push(countSolid(k.cylinder(dx, dy, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(dx, dy, DIAL_R, DIAL_TOP - 3.2, DIAL_TOP, 76, P, 0.3), { tone: "lo" }));
  out.push(L(k.ring(dx, dy, DIAL_R - 2.2, DIAL_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(dx, dy, DIAL_R - 3.0, 50, 5, DIAL_TOP, [1.3, 2.8], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(dx, dy, 1.8, DIAL_TOP, P, 16), { tone: "mid" }));
  out.push(
    k.faceTextSvg(k.topMatrix([dx, dy + 8.5], DIAL_TOP, P, "x"), "0.01Ω TARE", {
      size: 2.3,
      tone: "lo",
      anchor: "middle",
    }),
  );

  // Front-Right USB Host & Yolanda Cable Tare Module (y: 8 .. 54)
  const usbBoard = { x: 26, y: 8, w: 108, d: 46, r: 3.5 };
  out.push(countSolid(k.slabOf(usbBoard, 0, 4.5, P, 5, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(usbBoard, 2.5), 4.5, P, 4), { tone: "faint" }));

  // STM32F103 Bridge MCU
  const mcu = { x: 36, y: 15, w: 26, d: 24, r: 2 };
  out.push(countSolid(k.slabOf(mcu, 4.5, 4.8, P, 4, 0.5), { tone: "mid" }));
  out.push(
    k.faceTextSvg(k.topMatrix([49, 27], 9.4, P, "x"), "STM32", {
      size: 2.6,
      tone: "hi",
      anchor: "middle",
    }),
  );

  // Non-Volatile Flash Tare Register Block (-1.60 Ω Cable Tare Memory)
  const flashBlock = { x: 70, y: 15, w: 30, d: 24, r: 2 };
  out.push(countSolid(k.slabOf(flashBlock, 4.5, 5.5, P, 4, 0.5), { tone: "hi", lit: true }));
  out.push(
    k.faceTextSvg(k.topMatrix([85, 27], 10.1, P, "x"), "TARE -1.6Ω", {
      size: 2.4,
      tone: "hi",
      anchor: "middle",
    }),
  );

  // PC USB Type-C Host Receptor Block + Shielded USB Cable
  const usbPort = { x: 108, y: 18, w: 20, d: 18, r: 2 };
  out.push(countSolid(k.slabOf(usbPort, 4.5, 7.5, P, 4, 0.5), { tone: "hi", crease: "lo" }));
  const usbCable = G.fillet(
    [
      [128, 27, 8.2],
      [140, 27, 8.2],
      [142, 45, 4.0],
    ],
    4,
    8,
  );
  for (const piece of T.tubePieces(usbCable, 1.8, P, { maxLength: 18 })) {
    out.push(T.tubeSvg(piece, { tone: "hi" }));
  }

  return out.join("");
}

// Sliding 3-Block Calibration Step Carriage on Right Deck (`data-part="mode-slider"`)
const BLOCK_HEIGHTS = [16, 11, 6];
function modeCarriage() {
  const out = [];
  const base = { x: -24, y: -33, w: 48, d: 24, r: 2.5 };
  out.push(countSolid(k.slabOf(base, 2.5, 4.5, P, 4, 0.5), { tone: "mid" }));
  BLOCK_HEIGHTS.forEach((h, i) => {
    const blk = { x: -21 + i * 14.5, y: -30, w: 13, d: 18, r: 1.2 };
    out.push(countSolid(k.slabOf(blk, 7.0, h, P, 3, 0.4), { tone: "hi", crease: "lo", lit: i === 0 }));
  });
  return out.join("");
}

function dialPlunger() {
  const out = [];
  out.push(countSolid(k.cylinder(DIAL[0], DIAL[1], 2.5, 0, 2.2, P, 20), { tone: "hi", lit: true }));
  out.push(countSolid(k.cylinder(DIAL[0], DIAL[1], 1.4, 2.2, 26, P, 16), { tone: "hi", crease: "none", lit: true }));
  return out.join("");
}

const needleAt = (turn) => {
  const angle = turn * Math.PI * 2;
  const [x, y] = DIAL;
  return k.lineOnTop(
    [x - Math.sin(angle) * 3.6, y + Math.cos(angle) * 3.6],
    [x + Math.sin(angle) * (DIAL_R - 4.2), y - Math.cos(angle) * (DIAL_R - 4.2)],
    DIAL_TOP + 0.2,
    P,
  );
};

const swPointerAt = (deg) => {
  const rad = (deg * Math.PI) / 180;
  const [x, y] = [-40, 26];
  return k.lineOnTop(
    [x - Math.cos(rad) * 1.8, y - Math.sin(rad) * 1.8],
    [x + Math.cos(rad) * 5.2, y + Math.sin(rad) * 5.2],
    13.8,
    P,
  );
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A dual-deck medical galvanic isolation and 500-ohm precision calibration bench. The left floating bio-ground deck carries two SUS316L electrode posts, an overhead 500.0-ohm + 10nF calibration shunt carriage that lowers onto the posts, and an AD5940 AFE with an internal 200.0-ohm RCAL reference and SWMatrix rotary switch. The center 2500 Vrms air-gap trench is bridged only by the ADuM3160 magnetic isolator and B0505S DC-DC converter. The right PC host deck holds an STM32 bridge, cable-tare flash register, and a dial indicator reading calibrated impedance.",
  body: [
    isolationBenchBase(),
    leftPatientDeck(),
    `<g data-part="shunt-carriage" transform="${k.translateAlong(P, [0, 0, 0])}">${calibrationShuntCarriage()}</g>`,
    `<path data-part="sw-pointer" class="iso-line" data-tone="lit" data-free="start" d="${swPointerAt(0)}" style="stroke-width:1.25"/>`,
    centerIsolationBridge(),
    `<g data-part="surge-gate" transform="${k.translateAlong(P, [0, 0, 0])}">${surgeGate()}</g>`,
    `<g data-part="mode-slider" transform="${k.translateAlong(P, [STOPS[0] + 50, 0, 0])}">${modeCarriage()}</g>`,
    `<g data-part="plunger" transform="${k.translateAlong(P, [0, 0, 7 + BLOCK_HEIGHTS[0]])}">${dialPlunger()}</g>`,
    rightHostDeckAndDial(),
    `<path data-part="tare-needle" class="iso-line" data-tone="lit" data-free="start" d="${needleAt(0)}" style="stroke-width:1.15"/>`,
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const DIAL = ${JSON.stringify(DIAL)};
const DIAL_R = ${DIAL_R}, DIAL_TOP = ${DIAL_TOP};
const STOPS = [108, 93.5, 79];
const HEIGHTS = [23, 18, 13];
const MODES = [
  {
    key: "C",
    name: "외부 500.0Ω 지그 10초 원터치 영점 보정 (Ext 500Ω Tare)",
    shuntZ: -3.8,
    swDeg: -35,
    surgeZ: 0,
    sliderX: 108,
    plungerZ: 23,
    needleTurn: 0.0,
    readout: "[모드 1 · 외부 500.0Ω 영점 보정] Raw 501.60Ω - 케이블 저항 1.60Ω Tare = 500.00Ω (±0.05Ω) · 위상 0.00° 완료",
  },
  {
    key: "R",
    name: "AD5940 내부 RCAL 200.0Ω 0.1초 자동 영점 (Internal SWMatrix)",
    shuntZ: 2.5,
    swDeg: 55,
    surgeZ: 0,
    sliderX: 93.5,
    plungerZ: 18,
    needleTurn: 0.2,
    readout: "[모드 2 · 매 측정 전 0.1초 자동 보정] SWMatrix → 내부 RCAL 200.0Ω(0.1%) 루프백 · 온도 드리프트 0.00% 보정",
  },
  {
    key: "F",
    name: "ADuM3160 2500Vrms 갈바닉 절연 서지 차단 (IEC 60601-1 보호)",
    shuntZ: 2.5,
    swDeg: 145,
    surgeZ: 5.5,
    sliderX: 79,
    plungerZ: 13,
    needleTurn: 0.0,
    readout: "[모드 3 · PC 220V 접지 서지 차단] ADuM3160 + B0505S 2500Vrms 공극 차단 · 인체 누설전류 < 10µA (KC 안전 통과)",
  },
];

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const shuntEl = svg.querySelector('[data-part="shunt-carriage"]');
const swEl = svg.querySelector('[data-part="sw-pointer"]');
const surgeEl = svg.querySelector('[data-part="surge-gate"]');
const sliderEl = svg.querySelector('[data-part="mode-slider"]');
const plungerEl = svg.querySelector('[data-part="plunger"]');
const needleEl = svg.querySelector('[data-part="tare-needle"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const needleAt = ${needleAt.toString().replace("k.lineOnTop", "lineOnTop")};
const swPointerAt = ${swPointerAt.toString().replace("k.lineOnTop", "lineOnTop")};

let modeIdx = 0;
let state = {
  shuntZ: MODES[0].shuntZ,
  swDeg: MODES[0].swDeg,
  surgeZ: MODES[0].surgeZ,
  sliderX: MODES[0].sliderX,
  plungerZ: MODES[0].plungerZ,
  needleTurn: MODES[0].needleTurn,
};

let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;

function draw() {
  shuntEl.setAttribute("transform", translateAlong(P, [0, 0, state.shuntZ]));
  swEl.setAttribute("d", swPointerAt(state.swDeg));
  surgeEl.setAttribute("transform", translateAlong(P, [0, 0, state.surgeZ]));
  sliderEl.setAttribute("transform", translateAlong(P, [state.sliderX, 0, 0]));
  plungerEl.setAttribute("transform", translateAlong(P, [0, 0, state.plungerZ]));
  needleEl.setAttribute("d", needleAt(state.needleTurn));
  const m = MODES[modeIdx];
  if (readout && readout.textContent !== m.readout) readout.textContent = m.readout;
  stage.setAttribute("aria-valuenow", String(modeIdx + 1));
  stage.setAttribute("aria-valuetext", m.readout);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    modeIdx = Math.floor(clock / 3.8) % MODES.length;
  }
  const want = MODES[modeIdx];
  const k = calm ? 1 : 1 - Math.exp(-dt / 0.16);
  for (const key of Object.keys(state)) {
    state[key] += (want[key] - state[key]) * k;
    if (Math.abs(want[key] - state[key]) < 0.005) state[key] = want[key];
  }
  draw();
  const settled = !touring && Object.keys(state).every((key) => state[key] === want[key]);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};

const selectMode = (idx) => {
  touring = false;
  modeIdx = ((idx % MODES.length) + MODES.length) % MODES.length;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    touring = !still.matches;
    clock = modeIdx * 3.8;
    run();
  }, 4200);
  run();
};

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(0.999, (event.clientX - box.left) / box.width));
  selectMode(Math.floor(ratio * MODES.length));
});

stage.addEventListener("click", () => {
  selectMode(modeIdx + 1);
});

stage.addEventListener("keydown", (event) => {
  const key = event.key.toUpperCase();
  if (key === "1" || key === "C") { event.preventDefault(); selectMode(0); }
  if (key === "2" || key === "R") { event.preventDefault(); selectMode(1); }
  if (key === "3" || key === "F") { event.preventDefault(); selectMode(2); }
  if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); selectMode(modeIdx + 1); }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); selectMode(modeIdx - 1); }
});

draw();
`;

const body = k.plateHtml({
  fig: "Fig 08",
  title: "500.0Ω 기준 저항 10초 영점 보정기(RCAL SWMatrix) & ADuM3160 2500V 갈바닉 절연 브릿지",
  hint: "마우스 좌·중·우 이동 또는 C(500Ω 보정) · R(내부 RCAL) · F(220V 서지 차단) 키 입력",
  readout: "[모드 1 · 외부 500.0Ω 영점 보정] Raw 501.60Ω - 케이블 저항 1.60Ω Tare = 500.00Ω (±0.05Ω) · 위상 0.00° 완료",
  keys: [
    { mark: "lit", label: "500.0Ω+10nF 영점 보정 브릿지 · 내부 200.0Ω RCAL · ADuM3160 절연 코일" },
    { mark: "raised", label: "좌측 피검자 부유 접지(3.3V Iso) · 중앙 2500V 공극 · 우측 PC 호스트 & Tare 다이얼" },
  ],
  caption:
    "비전공자도 10초 만에 끝내는 2단계 자동 영점 보정(Tare)과 의료급 전기 안전 아키텍처: ① 매 측정 직전 AD5940 내부 SWMatrix가 칩 내부 200.0Ω(0.1%) 기준 저항으로 0.1초 만에 온도 드리프트를 영점 보정하고, ② 최초 조립 시 좌·우 손잡이 전극 단자에 500.0Ω 기준 지그를 꽂아 케이블 고유 저항(1.60Ω)을 플래시에 영구 차감(501.6Ω - 1.6Ω = 500.00Ω)하며, ③ 중앙 ADuM3160 자기 결합 절연기와 B0505S가 PC 220V 접지 서지를 2500Vrms 공극으로 물리 차단하여 인체 누설전류를 10µA 미만으로 억제합니다.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="500-ohm RCAL Calibration and ADuM3160 2500V Galvanic Isolator Bench" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1">${svg}</div>`,
});

const html = k.pageHtml({
  title: "Fig 08 · 500.0Ω RCAL Tare & ADuM3160 2500V Isolator",
  theme,
  body,
  script: kitScript() + live,
  width: 720,
});

const outName = `fig-08${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), html);
console.log(`wrote ${outName} · ${(html.length / 1024).toFixed(0)} KB · ${solidCount} solids`);

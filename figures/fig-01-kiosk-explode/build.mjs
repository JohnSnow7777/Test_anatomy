import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../kit/tube.mjs";
import * as A from "../../kit/audit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 680;
const HEIGHT = 500;

const PLATE = { x: -136, y: -112, w: 272, d: 244, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

const FOOTPLATE = { x: -48, y: 24, w: 96, d: 86, r: 6 };
const FP_Z = 4.5;
const FP_H = 5.5;

const COL = { x: -34, y: -68, w: 68, d: 44, r: 6 };
const COL_PLINTH_H = 6;
const COL_TOP = 186;
const FRONT_Y = COL.y + COL.d;
const RIGHT_X = COL.x + COL.w;
const LEFT_X = COL.x;

const BEZEL = { x0: -25, x1: 25, z0: 76, z1: 162, r: 4, depth: 1.8 };
const SCREEN = { x0: -21.5, x1: 21.5, z0: 81, z1: 156, r: 3, depth: 3.2 };
const PRINTER_SLOT = { x0: -15, x1: 15, z0: 52, z1: 58.5, r: 1.8, depth: 3.5 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners(COL, 0, COL_TOP + 22),
    [-98, 65, 130],
    [98, 65, 130],
    [0, 128, 30],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 48, elevation: 29 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) =>
  k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);

const ORDER = ["chassis", "pcb", " leftStick", "screen", "printer", "footplate", "rightStick"].map((s) => s.trim());
const R = A.recorder(P, { order: ORDER, spring: { stagger: 0.04 } });

let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back = "", backClass = "kx-well", inside = "") {
  const id = `kx-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0) [nx, nz] = [-nx, -nz];
    if (nx <= 0 && nz <= 0) return;
    const quad = k.pathOf([at([ax, y, az]), at([bx, y, bz]), at([bx, y - depth, bz]), at([ax, y - depth, az])], true);
    if (nz >= nx) tops.push(quad);
    else sides[Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>` : "")),
    `<g transform="${planeOf(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

// 0. Base Test Bench Plate (12 solid parts)
function benchPlate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7.5, -PLATE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.8, -PLATE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
    R.solid(A.cylinder(x, y, 7.5, -PLATE_H - FOOT_H, FOOT_H, { name: "bench.foot" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  R.solid(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "bench.plate" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5.5), 0, P), { tone: "lo" }));

  const screws = k.corners(PLATE, 11);
  for (const [sx, sy] of screws) {
    out.push(S(k.cylinder(sx, sy, 2.4, 0, 0.7, P, 16), { tone: "lo" }));
    out.push(L(k.ring(sx, sy, 2.8, 0.1, P, 16), { tone: "lo" }));
    out.push(D([at([sx, sy, 0.7])], { size: 0.5 }));
  }

  // Ruler strip on front edge
  const strip = { x: -116, y: PLATE.y + PLATE.d - 14, w: 164, d: 7.5, r: 1.2 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.9, 0.7, [2.2, 4.0], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2.5, strip.y + 3.8, 0.7]), at([strip.x + strip.w - 2.5, strip.y + 3.8, 0.7])], { size: 0.45 }));

  // Engraved label plate (CONNECT INBODY AI)
  const label = { x: 56, y: PLATE.y + PLATE.d - 16, w: 66, d: 10, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.9, P, 3, 0.2), { tone: "mid", crease: "lo" }));
  out.push(
    k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + 6.5], 0.95, P, "x"), "CONNECT INBODY AI", {
      size: 3.1,
      tone: "hi",
      anchor: "middle",
    }),
  );
  out.push(D([at([label.x + 2.5, label.y + 5, 0.9]), at([label.x + label.w - 2.5, label.y + 5, 0.9])], { size: 0.42 }));

  // Rear alignment blocks on bench
  for (const bx of [-42, 34]) {
    out.push(S(k.slabOf({ x: bx, y: -76, w: 8, d: 10, r: 1.2 }, 0, 4, P, 3, 0.4), { tone: "lo" }));
  }

  R.put({ name: "bench", piece: "bench", at: [0, 0, -5], shapes: [] });
  return out.join("");
}

// 1. Sub-assembly 1: Footplate & 4 Load Cells + 4 SUS316L Foot Electrodes (14 solid parts)
function footplateAssembly() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(FOOTPLATE, 0, FP_H, P)}" style="filter:blur(5px)"/>`);

  // 4 Internal Half-bridge Load-cell pucks underneath
  const puckCoords = [
    [FOOTPLATE.x + 14, FOOTPLATE.y + 14],
    [FOOTPLATE.x + FOOTPLATE.w - 14, FOOTPLATE.y + 14],
    [FOOTPLATE.x + 14, FOOTPLATE.y + FOOTPLATE.d - 14],
    [FOOTPLATE.x + FOOTPLATE.w - 14, FOOTPLATE.y + FOOTPLATE.d - 14],
  ];
  for (const [px, py] of byDepth(puckCoords)) {
    out.push(S(k.cylinder(px, py, 6.8, 0, 2.2, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(px, py, 5.2, 2.2, 2.3, P, 24, 0.4), { tone: "mid" }));
    out.push(L(k.ring(px, py, 3.2, 4.5, P, 16), { tone: "faint" }));
  }

  // Sub-chassis carrier frame under glass
  const subFrame = k.insetPlan(FOOTPLATE, 4);
  out.push(S(k.slabOf(subFrame, 2.0, 2.5, P, 6, 0.4), { tone: "lo" }));

  // Central HX711 junction box under footplate
  out.push(S(k.slabOf({ x: -12, y: 54, w: 24, d: 18, r: 2 }, 1.2, 2.8, P, 4), { tone: "mid" }));

  // 32x32cm Yolanda Tempered-glass plate
  out.push(S(k.slabOf(FOOTPLATE, FP_Z, FP_H, P, 8, 1.0), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(FOOTPLATE, 3.2), FP_Z + FP_H, P, 6), { tone: "faint" }));

  // 4 Circular Stainless Foot Electrodes (Left Heel, Right Heel, Left Forefoot, Right Forefoot)
  const electrodes = [
    [-22, 46, 13.5, "L-CUR"],
    [22, 46, 13.5, "R-CUR"],
    [-22, 84, 11.5, "L-SNS"],
    [22, 84, 11.5, "R-SNS"],
  ];
  for (const [ex, ey, rad, tag] of byDepth(electrodes)) {
    out.push(S(k.cylinder(ex, ey, rad, FP_Z + FP_H, 1.4, P, 36, 0.35), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(ex, ey, rad - 2.2, FP_Z + FP_H + 1.4, P, 28), { tone: "lo" }));
    out.push(L(k.ring(ex, ey, 3.0, FP_Z + FP_H + 1.4, P, 16), { tone: "faint" }));
    out.push(
      k.faceTextSvg(k.topMatrix([ex, ey + 1], FP_Z + FP_H + 1.45, P, "x"), tag, {
        size: 2.1,
        tone: "lo",
        anchor: "middle",
      }),
    );
  }

  // Center ITO conductive alignment crosshair & weight mini-OLED window
  const oled = { x: -14, y: 31, w: 28, d: 9, r: 1.5 };
  out.push(S(k.slabOf(oled, FP_Z + FP_H, 0.6, P, 4), { tone: "mid", lit: true }));
  out.push(
    k.faceTextSvg(k.topMatrix([0, 36.8], FP_Z + FP_H + 0.65, P, "x"), "68.4 kg", {
      size: 2.9,
      tone: "hi",
      anchor: "middle",
    }),
  );

  // Umbilical bridge conduit to main column
  const bridge = { x: -7, y: -24, w: 14, d: 50, r: 2 };
  out.push(S(k.slabOf(bridge, 1.0, 3.2, P, 4, 0.4), { tone: "mid" }));

  R.put({ name: "footplate", piece: "footplate", at: [0, 66, 6], move: [0, 34, -8] });
  return `<g class="kx-part" data-part="footplate">${out.join("")}</g>`;
}

// 2. Sub-assembly 2: Main Shenzhen Vercon Kiosk Column Chassis (14 solid parts)
function columnChassis() {
  const out = [`<path class="iso-halo" d="${k.haloOf(COL, 0, 10, P)}"/>`];
  // Heavy base plinth
  out.push(S(k.slabOf(k.insetPlan(COL, -3), 0, COL_PLINTH_H, P, 8, 0.8), { tone: "lo" }));
  // Anchor bolts on plinth
  for (const [bx, by] of byDepth(k.corners( k.insetPlan(COL, -1), 3 ))) {
    out.push(S(k.cylinder(bx, by, 1.8, COL_PLINTH_H, 1.2, P, 14), { tone: "mid" }));
  }
  // Main aluminum column body
  out.push(S(k.slabOf(COL, COL_PLINTH_H, COL_TOP - COL_PLINTH_H, P, 8, 1.8), { tone: "mid" }));
  // Top crown cap
  const crown = k.insetPlan(COL, 2);
  out.push(S(k.slabOf(crown, COL_TOP, 4.5, P, 6, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(crown, 3), COL_TOP + 4.5, P, 6), { tone: "faint" }));

  // Side ventilation louver slots on right face
  const sideSlot = (y, z0, z1, half = 0.8) =>
    k.pathOf(k.roundedPlan({ x: y - half, y: z0, w: half * 2, d: z1 - z0, r: half }, 4).map(([u, z]) => at([RIGHT_X, u, z])), true);
  const vents = [];
  for (let y = COL.y + 8; y <= COL.y + 34; y += 3.2) {
    vents.push(sideSlot(y, 120, 152));
    vents.push(sideSlot(y, 24, 48));
  }
  out.push(L(vents.join(""), { tone: "faint" }));

  // Side maintenance seam & status LED
  out.push(
    L(
      k.lineOnTop([COL.x, FRONT_Y - 10], [RIGHT_X, FRONT_Y - 10], COL_TOP, P) +
        k.segment([RIGHT_X, FRONT_Y - 10, COL_TOP], [RIGHT_X, FRONT_Y - 10, COL_PLINTH_H], P),
      { tone: "lo" },
    ),
  );

  // Side holsters for Left and Right hand-sticks
  const leftBracket = { x: LEFT_X - 8, y: -48, w: 8, d: 14, r: 2 };
  const rightBracket = { x: RIGHT_X, y: -48, w: 8, d: 14, r: 2 };
  out.push(S(k.slabOf(leftBracket, 96, 8, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf(rightBracket, 96, 8, P, 4, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: LEFT_X - 6, y: -46, w: 6, d: 10, r: 1.5 }, 28, 6, P, 3), { tone: "lo" }));
  out.push(S(k.slabOf({ x: RIGHT_X, y: -46, w: 6, d: 10, r: 1.5 }, 28, 6, P, 3), { tone: "lo" }));

  // Front speaker grille slots below printer
  const grille = Array.from({ length: 8 }, (_, i) => flat(-14 + i * 4, 30, -12.4 + i * 4, 40, 0.7, 4)).join("");
  out.push(`<g transform="${planeOf(FRONT_Y)}">${L(grille, { tone: "lo" })}</g>`);

  R.put({ name: "chassis", piece: "chassis", at: [0, -46, 90], move: [0, -18, 0] });
  return `<g class="kx-part" data-part="chassis">${out.join("")}</g>`;
}

// 3. Sub-assembly 4: Internal Intel N100 Mini-PC & ESP32-S3 + AD5940 + MAX86150 + HX711 + ADuM3160 Sensor Hub PCB (15 solid parts)
function internalPcbHub() {
  const out = [];
  // Internal mounting backplane tray inside chassis
  const tray = { x: -24, y: -48, w: 48, d: 12, r: 2.5 };
  out.push(S(k.slabOf(tray, 62, 52, P, 4, 0.6), { tone: "lo" }));

  // Intel N100 Mini-PC box (bottom of tray)
  const n100 = { x: -20, y: -44, w: 22, d: 14, r: 2 };
  out.push(S(k.slabOf(n100, 65, 18, P, 4, 0.6), { tone: "mid" }));
  // N100 radial cooling fan boss
  out.push(S(k.cylinder(-9, -30, 5.5, 74, 2.2, P, 24), { tone: "lo" }));

  // Isolated Sensor Hub Master PCB (lit: true for active telemetry accent)
  const pcb = { x: -21, y: -35, w: 42, d: 4.5, r: 1.5 };
  out.push(S(k.slabOf(pcb, 88, 24, P, 4, 0.5), { tone: "hi", lit: true }));

  // 5 Key ICs mounted on the Sensor Hub PCB
  // 1) ESP32-S3 dual-core MCU
  out.push(S(k.slabOf({ x: -18, y: -31.5, w: 9, d: 2.6, r: 0.6 }, 98, 9, P, 3), { tone: "hi", lit: true }));
  // 2) AD5940 50kHz BIA Analog Front-End
  out.push(S(k.slabOf({ x: -6, y: -31.5, w: 8, d: 2.6, r: 0.6 }, 99, 8, P, 3), { tone: "hi", lit: true }));
  // 3) MAX86150 ECG+PPG Bio-Sensor
  out.push(S(k.slabOf({ x: 4, y: -31.5, w: 7, d: 2.4, r: 0.6 }, 100, 7, P, 3), { tone: "hi", lit: true }));
  // 4) HX711 24-bit Load-Cell ADC
  out.push(S(k.slabOf({ x: -16, y: -31.5, w: 7, d: 2.2, r: 0.5 }, 90, 6, P, 3), { tone: "mid" }));
  // 5) ADuM3160 2500V RMS USB Galvanic Isolator
  out.push(S(k.slabOf({ x: 5, y: -31.5, w: 11, d: 2.8, r: 0.8 }, 90, 6.5, P, 3), { tone: "hi", lit: true }));

  // Brass corner standoffs
  for (const [sx, sz] of [
    [-19, 90],
    [19, 90],
    [-19, 109],
    [19, 109],
  ]) {
    out.push(S(k.cylinder(sx, -31, 1.1, sz, 1.5, P, 12), { tone: "hi" }));
  }

  // Internal 3D ribbon / harness tube connecting N100 to PCB via ADuM3160
  const harnessPts = G.fillet(
    [
      [-4, -32, 74],
      [10, -29, 76],
      [10, -29, 90],
    ],
    2.5,
  );
  for (const piece of tubePieces(harnessPts, 1.0, P)) {
    out.push(tubeSvg(piece, { tone: "hi" }));
  }

  // Labels on PCB plane
  out.push(
    `<g transform="${planeOf(-30.2)}">` +
      `<text class="kx-text" x="-17" y="-108.5" font-size="2.6">ESP32-S3 · AD5940 · MAX86150</text>` +
      `<text class="kx-text" x="-17" y="-85.5" font-size="2.4">ADuM3160 2.5kV · INTEL N100</text>` +
      `</g>`,
  );

  R.put({ name: "pcb", piece: "pcb", at: [0, -35, 92], move: [0, 14, 24] });
  return `<g class="kx-part" data-part="pcb">${out.join("")}</g>`;
}

// 4. Sub-assembly 3: 21.5" Vertical Touch Display & Top OV2710 60fps Camera (12 solid parts)
function displayAndCamera() {
  const out = [];

  // Screen telemetry waveforms & 3D skeleton paths in screen coordinates (x in [-21, 21], -z in [-155, -81])
  const gridLines = [];
  for (let z = SCREEN.z0 + 4; z < SCREEN.z1; z += 4) {
    gridLines.push(`M${SCREEN.x0 + 1} ${(-z).toFixed(1)}H${SCREEN.x1 - 1}`);
  }

  // ECG waveform (lead I, 250Hz)
  const ecgPath =
    "M-19 -141 L-15 -141 L-13.8 -142.8 L-12.6 -141 L-11 -140 L-9.6 -149.5 L-8.2 -137.5 L-7 -141 L-4.5 -143.5 L-2 -141 L2 -141 L3.5 -142.8 L4.7 -141 L6 -140 L7.4 -149.5 L8.8 -137.5 L10 -141 L12.5 -143.5 L15 -141 L19 -141";
  // PPG waveform (finger optical, 250Hz)
  const ppgPath =
    "M-19 -128 Q-15 -135 -12 -129 T-6 -128 Q-2 -135 1 -129 T7 -128 Q11 -135 14 -129 T19 -128";
  // 3D MediaPipe Pose Skeleton wireframe (lower screen region)
  const skeletonPath =
    "M0 -109 L0 -97 M-7 -106 L7 -106 M-7 -106 L-11 -99 L-13 -93 M7 -106 L11 -99 L13 -93 M0 -97 L-5 -89 L-5 -83 M0 -97 L5 -89 L5 -83";

  const screenContent = [
    `<path class="kx-glow" d="${flat(-18, SCREEN.z0 + 5, 18, SCREEN.z1 - 5, 10, 8)}"/>`,
    `<path class="kx-scan" d="${gridLines.join("")}"/>`,
    `<text class="kx-text" x="-18.5" y="-149.5" font-size="3.1">CONNECT INBODY AI · 30s SCAN</text>`,
    `<path class="iso-line" data-tone="lit" d="${ecgPath}" data-part="ecg-wave" style="stroke-width:1.15"/>`,
    `<path class="iso-line" data-tone="green" d="${ppgPath}" data-part="ppg-wave" style="stroke-width:1.0"/>`,
    `<text class="kx-text" data-part="scr-pha" x="-18.5" y="-118" font-size="3.3">PHA 6.4° · PTT 238ms</text>`,
    `<text class="kx-text" data-part="scr-grip" x="-18.5" y="-113" font-size="3.1">GRIP 46.8kg · BP 118/76</text>`,
    `<path class="iso-line" data-tone="hi" d="${skeletonPath}" data-part="skel-wire" style="stroke-width:1.05"/>`,
    `<circle class="kx-dot" cx="0" cy="-112" r="2.1"/>`,
  ].join("");

  // Outer display cassette slab (allows clean explosion away from chassis)
  const dispCassette = { x: -26, y: FRONT_Y - 4, w: 52, d: 4.5, r: 4 };
  out.push(S(k.slabOf(dispCassette, 74, 90, P, 6, 0.8), { tone: "hi", crease: "lo" }));
  out.push(recess(BEZEL, FRONT_Y + 0.5, "", "kx-bezel", recess(SCREEN, FRONT_Y + 0.5 - BEZEL.depth, screenContent, "kx-glass")));

  // Top OV2710 60fps Manual-Exposure Camera pod & turned lens barrel (using lathe.mjs!)
  const camPod = { x: -11, y: FRONT_Y - 5, w: 22, d: 7, r: 2.5 };
  out.push(S(k.slabOf(camPod, 168, 12, P, 5, 0.6), { tone: "hi", crease: "lo" }));

  // Turned camera lens barrel pointing forward along +Y axis
  const Fcam = G.frameAlong([0, FRONT_Y + 2, 174], [0, 1, 0]);
  const barrelProfile = [
    [0, 4.8],
    [2.2, 4.8],
    [2.6, 4.1],
    [5.2, 4.1],
    [5.5, 3.3],
  ];
  out.push(S(G.solidOf(barrelProfile, Fcam, P), { tone: "hi", lit: true }));
  out.push(L(G.ribsOf(Fcam, 0.4, 2.0, 4.85, 20, P), { tone: "lo" }));
  out.push(D(G.dotsOf(Fcam, 3.8, 4.15, 12, P), { size: 0.4, tone: "hi" }));
  // Lens optical glass element disc
  out.push(S(G.disc(5.5, 6.0, 2.8, Fcam, P), { tone: "mid", lit: true }));

  R.put({ name: "screen", piece: "screen", at: [0, FRONT_Y + 2, 125], move: [0, 32, 10] });
  return `<g class="kx-part" data-part="screen">${out.join("")}</g>`;
}

// 5. Sub-assembly 7: 80mm Thermal Receipt Printer Module & Curved Paper Strip (8 solid parts)
function thermalPrinterModule() {
  const out = [];
  const box = { x: -17, y: FRONT_Y - 8, w: 34, d: 8.5, r: 2.2 };
  out.push(S(k.slabOf(box, 47, 15, P, 4, 0.6), { tone: "mid" }));
  // Internal thermal paper roll cylinder (turned along X axis)
  const Froll = G.frameAlong([-9, FRONT_Y - 4, 54.5], [1, 0, 0]);
  out.push(S(G.disc(0, 18, 4.2, Froll, P), { tone: "hi" }));

  out.push(
    recess(
      PRINTER_SLOT,
      FRONT_Y + 0.5,
      `<path class="iso-line" data-tone="lo" d="M${PRINTER_SLOT.x0} ${-(PRINTER_SLOT.z0 + 2.2)}H${PRINTER_SLOT.x1}"/>`,
      "kx-dark",
    ),
  );

  // Extruding 80mm receipt paper stripslab
  const paper = { x: -11, y: FRONT_Y + 0.5, w: 22, d: 14, r: 1.2 };
  out.push(S(k.slabOf(paper, 52.5, 1.1, P, 3, 0.2), { tone: "hi", lit: true }));
  // Printed lines on the receipt
  for (let i = 0; i < 4; i++) {
    const py = FRONT_Y + 3.2 + i * 2.6;
    out.push(L(k.lineOnTop([-8.5, py], [8.5 - (i === 3 ? 5 : 0), py], 53.7, P), { tone: "mid" }));
  }
  // Eject button
  out.push(S(k.cylinder(13.5, FRONT_Y + 0.5, 1.5, 50, 1.2, P, 14), { tone: "hi" }));

  R.put({ name: "printer", piece: "printer", at: [0, FRONT_Y + 6, 53], move: [0, 44, -2] });
  return `<g class="kx-part" data-part="printer">${out.join("")}</g>`;
}

// 6. Sub-assembly 5: Left SUS316L 4-Electrode BIA/ECG Hand-Stick + Coiled Cord (9 solid parts)
function leftHandStick() {
  const out = [];
  const cx = -64;
  const cy = -24;
  // Turned stainless electrode handle along Z axis using lathe.mjs
  const Fstick = G.frameAlong([cx, cy, 86], [0, 0, 1]);
  const profile = [
    [0, 3.8],
    [3, 4.6],
    [16, 4.6],
    [17, 3.9],
    [20, 4.6],
    [34, 4.6],
    [36, 5.2],
    [40, 4.2],
  ];
  out.push(S(G.solidOf(profile, Fstick, P), { tone: "hi", crease: "lo" }));
  // Knurled electrode grip ribs
  out.push(L(G.ribsOf(Fstick, 4, 15, 4.65, 22, P), { tone: "lo" }));
  out.push(L(G.ribsOf(Fstick, 21, 33, 4.65, 22, P), { tone: "lo" }));
  // Top thumb ECG Dry-Electrode cap
  out.push(S(k.cylinder(cx, cy, 4.0, 126, 2.2, P, 24, 0.4), { tone: "hi", lit: true }));

  // Coiled cord + 3D tube lead from left holster to left stick base
  const spring = k.coil(52, 82, [cx + 6, cy + 2], 3.2, 11, "x", P);
  out.push(L(spring.back, { tone: "lo" }), L(spring.front, { tone: "mid" }));

  const cordPts = G.fillet(
    [
      [LEFT_X - 4, -40, 98],
      [cx + 12, -32, 76],
      [cx, cy, 86],
    ],
    4,
  );
  for (const piece of tubePieces(cordPts, 1.15, P)) {
    out.push(tubeSvg(piece, { tone: "mid" }));
  }

  R.put({ name: "leftStick", piece: "leftStick", at: [cx, cy, 106], move: [-32, 10, 8] });
  return `<g class="kx-part" data-part="leftStick">${out.join("")}</g>`;
}

// 7. Sub-assembly 6: Right SUS316L Hand-Stick + Camry EH101 Grip Lever + MAX86150 PPG Window (11 solid parts)
function rightHandStick() {
  const out = [];
  const cx = 64;
  const cy = -24;
  const Fstick = G.frameAlong([cx, cy, 86], [0, 0, 1]);
  const profile = [
    [0, 3.8],
    [3, 4.6],
    [16, 4.6],
    [17, 3.9],
    [20, 4.6],
    [34, 4.6],
    [36, 5.4],
    [40, 4.4],
  ];
  out.push(S(G.solidOf(profile, Fstick, P), { tone: "hi", crease: "lo" }));
  out.push(L(G.ribsOf(Fstick, 4, 15, 4.65, 22, P), { tone: "lo" }));
  out.push(L(G.ribsOf(Fstick, 21, 33, 4.65, 22, P), { tone: "lo" }));

  // Camry EH101 S-beam strain-gauge grip lever parallel to right handle
  const lever = { x: cx + 5.2, y: cy - 2.2, w: 3.4, d: 4.4, r: 1.2 };
  out.push(S(k.slabOf(lever, 92, 26, P, 4, 0.5), { tone: "hi", lit: true }));
  // Dual guide pins bridging handle and grip lever
  out.push(S(k.slabOf({ x: cx + 3.2, y: cy - 1.5, w: 2.5, d: 3, r: 0.6 }, 95, 3, P, 3), { tone: "mid" }));
  out.push(S(k.slabOf({ x: cx + 3.2, y: cy - 1.5, w: 2.5, d: 3, r: 0.6 }, 112, 3, P, 3), { tone: "mid" }));

  // Top MAX86150 Optical PPG + Thumb ECG sensor window (lit: true)
  out.push(S(k.cylinder(cx, cy, 4.2, 126, 2.5, P, 24, 0.4), { tone: "hi", lit: true }));
  out.push(L(k.ring(cx, cy, 2.2, 128.6, P, 16), { tone: "red" }));

  // Coiled cable & 3D tube lead
  const spring = k.coil(52, 82, [cx - 6, cy + 2], 3.2, 11, "x", P);
  out.push(L(spring.back, { tone: "lo" }), L(spring.front, { tone: "mid" }));

  const cordPts = G.fillet(
    [
      [RIGHT_X + 4, -40, 98],
      [cx - 12, -32, 76],
      [cx, cy, 86],
    ],
    4,
  );
  for (const piece of tubePieces(cordPts, 1.15, P)) {
    out.push(tubeSvg(piece, { tone: "mid" }));
  }

  R.put({ name: "rightStick", piece: "rightStick", at: [cx, cy, 106], move: [34, 12, 8] });
  return `<g class="kx-part" data-part="rightStick">${out.join("")}</g>`;
}

// Explode guide alignment dashed lines (visible when exploded)
function explodeGuides() {
  const lines = [
    k.segment([0, -35, 96], [0, 12, 118], P),
    k.segment([-34, -40, 102], [-96, -14, 114], P),
    k.segment([34, -40, 102], [98, -12, 114], P),
    k.segment([0, 24, 6], [0, 58, -2], P),
  ];
  return `<g data-part="guides" style="opacity:0">${lines.map((d) => L(d, { tone: "lo", dashed: true })).join("")}</g>`;
}

A.settle(R, P);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Exploded isometric assembly of the CONNECT InBody AI all-in-one kiosk: a test bench plate supporting a 32x32cm Yolanda 4-electrode tempered-glass footplate with 4 load-cell pucks, a Shenzhen Vercon vertical column, internal Intel N100 and ESP32-S3 + AD5940 + MAX86150 + HX711 + ADuM3160 isolated sensor hub PCB, a 21.5-inch vertical touch display with top OV2710 60fps camera, an 80mm thermal receipt printer, and dual SUS316L 4-electrode hand-sticks with right-hand Camry EH101 grip dynamometer lever.",
  body: [
    benchPlate(),
    explodeGuides(),
    columnChassis(),
    internalPcbHub(),
    leftHandStick(),
    displayAndCamera(),
    thermalPrinterModule(),
    footplateAssembly(),
    rightHandStick(),
  ],
});

const SUB_MOVES = {
  chassis: [0, -18, 0],
  pcb: [0, 16, 26],
  leftStick: [-34, 12, 10],
  screen: [0, 32, 12],
  printer: [0, 46, -2],
  footplate: [0, 36, -8],
  rightStick: [36, 14, 10],
};

const STEPS = [
  {
    id: 1,
    name: "Step 1 (0–15s Bio-Contact)",
    pha: "PHA 6.42° · PTT 238ms",
    grip: "BP 118/76 · HR 68bpm",
    readout: "Step 1 (0-15s Bio-Contact) · Total BOM $608 (63.8만원) · φ 6.42° · PTT 238ms · SBP 118/76",
  },
  {
    id: 2,
    name: "Step 2 (15–20s Grip Squeeze)",
    pha: "MAX GRIP 46.8 kg",
    grip: "RFD 112 kg/s · ASYM 4.2%",
    readout: "Step 2 (15-20s Grip Squeeze) · Total BOM $608 (63.8만원) · Grip 46.8kg · HX711 80SPS",
  },
  {
    id: 3,
    name: "Step 3 (20–30s 3D ROM & Receipt)",
    pha: "ABD 168° · FLEX 172°",
    grip: "80mm RECEIPT PRINTED",
    readout: "Step 3 (20-30s 3D ROM & Print) · Total BOM $608 (63.8만원) · OV2710 60fps · 32 Biomarkers",
  },
];

const live = `
const P = ${JSON.stringify(P)};
const SUB_MOVES = ${JSON.stringify(SUB_MOVES)};
const STEPS = ${JSON.stringify(STEPS)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const guides = svg.querySelector('[data-part="guides"]');
const scrPha = svg.querySelector('[data-part="scr-pha"]');
const scrGrip = svg.querySelector('[data-part="scr-grip"]');
const parts = {};
for (const key of Object.keys(SUB_MOVES)) {
  parts[key] = svg.querySelector('[data-part="' + key + '"]');
}
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

let explode = 0.65, targetExplode = 0.65, vel = 0;
let stepIdx = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;

function draw() {
  for (const [key, vec] of Object.entries(SUB_MOVES)) {
    const el = parts[key];
    if (!el) continue;
    let dx = vec[0] * explode, dy = vec[1] * explode, dz = vec[2] * explode;
    if (stepIdx === 1 && key === "rightStick") dx -= 3.5 * Math.sin(clock * 8);
    if (stepIdx === 2 && key === "printer") dy += 5.5;
    el.setAttribute("transform", translateAlong(P, [dx, dy, dz]));
  }
  if (guides) guides.style.opacity = Math.min(1, explode * 1.1).toFixed(2);
  const st = STEPS[stepIdx];
  if (scrPha) scrPha.textContent = st.pha;
  if (scrGrip) scrGrip.textContent = st.grip;
  const pct = Math.round(explode * 100);
  const stateLabel = pct < 8 ? "Assembled (0%)" : "Exploded (" + pct + "% · 7 Sub-Assemblies)";
  const text = stateLabel + " · " + st.readout;
  if (readout.textContent !== text) readout.textContent = text;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    targetExplode = 0.5 + 0.45 * Math.sin(clock * 0.85);
    stepIdx = Math.floor(clock / 4.2) % STEPS.length;
  }
  if (calm) {
    explode = targetExplode;
    vel = 0;
  } else {
    const stiff = 180, damp = 22;
    vel += ((targetExplode - explode) * stiff - vel * damp) * dt;
    explode += vel * dt;
    if (Math.abs(targetExplode - explode) < 0.002 && Math.abs(vel) < 0.002) {
      explode = targetExplode;
      vel = 0;
    }
  }
  draw();
  const busy = touring || Math.abs(targetExplode - explode) > 0.002 || Math.abs(vel) > 0.002;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function steer(nextExplode, nextStep = null) {
  touring = false;
  if (nextExplode !== null) targetExplode = clamp(nextExplode, 0, 1);
  if (nextStep !== null) stepIdx = nextStep;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!still.matches) {
      touring = true;
      run();
    }
  }, 5000);
  run();
}

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 1);
  steer(share);
});

stage.addEventListener("click", () => {
  steer(targetExplode > 0.5 ? 0 : 1);
  stage.focus({ preventScroll: true });
});

stage.addEventListener("keydown", (event) => {
  if (event.key === "e" || event.key === "E") {
    event.preventDefault();
    steer(targetExplode > 0.5 ? 0 : 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    steer(targetExplode + 0.15);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    steer(targetExplode - 0.15);
  } else if (event.key === "1") {
    event.preventDefault();
    steer(null, 0);
  } else if (event.key === "2") {
    event.preventDefault();
    steer(null, 1);
  } else if (event.key === "3") {
    event.preventDefault();
    steer(null, 2);
  }
});

draw();
`;

const css = `<style>
.kx-well{fill:var(--anatomy-shade-1)}
.kx-bezel{fill:var(--anatomy-top)}
.kx-dark{fill:var(--anatomy-shade-0)}
.kx-glass{fill:var(--anatomy-lit-shade)}
.kx-glow{fill:var(--anatomy-lit);opacity:.08;filter:blur(5px)}
.kx-scan{fill:none;stroke:var(--anatomy-faint);stroke-width:.45px;vector-effect:non-scaling-stroke;opacity:.65}
.kx-text{fill:var(--anatomy-lit);font-family:var(--anatomy-mono);letter-spacing:.03em}
.kx-dot{fill:var(--anatomy-lit)}
.kx-part{cursor:pointer;transition:filter .25s var(--anatomy-ease)}
.iso-stage{touch-action:pan-y;cursor:ew-resize}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 1",
    title: "CONNECT InBody AI 올인원 스탠드 키오스크 분해도 (All-in-One Kiosk Exploded Assembly)",
    hint: "Drag across · press E to explode · 1-3 for scan steps",
    readout: "Exploded (65% · 7 Sub-Assemblies) · Total BOM $608 · 63.8만원 · φ 6.42° · PTT 238ms · Grip 42.6kg",
    keys: [
      { mark: "lit", label: "ESP32-S3 + AD5940 + MAX86150 + ADuM3160 센서 허브 및 21.5\" 실시간 파형 화면" },
      { mark: "raised", label: "Shenzhen Vercon 스탠드 컬럼 · Yolanda 4전극 강화유리 발판 · SUS316L 양손 핸드스틱" },
      { mark: "green", label: "MAX86150 250Hz 광학 PPG 맥파 및 Camry EH101 우측 악력계 스트레인 레버" },
    ],
    caption:
      "기존 1,900만원대 병원용 체성분 장비와 악력계·혈압계·관절가동범위(ROM) 측정기를 대체하는 양산 원가 63.8만원($608) 올인원 키오스크의 7대 모듈 분해도입니다. 하단 32×32cm Yolanda 강화유리 발판(내부 하프브리지 로드셀 4기 및 SUS316L 발바닥 전극 4기), 전면 21.5인치 터치스크린 및 상단 OV2710 60fps 수동노출 카메라, 중단 80mm 감열 영수증 프린터, 내부 Intel N100 미니PC와 ADuM3160 2500V 의료급 절연 센서 허브 PCB, 그리고 좌우 SUS316L 4전극 핸드스틱(우측 Camry EH101 악력 레버 및 상단 MAX86150 PPG 광학창 탑재)이 30초 원스톱 측정 프로토콜로 동기화됩니다. 마우스를 좌우로 움직이거나 E 키를 눌러 7개 서브어셈블리를 분해·결합하고, 숫자 1·2·3 키로 3단계 측정 시퀀스를 확인하세요.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="CONNECT InBody AI All-in-One Kiosk Exploded Assembly. Move pointer horizontally or press E to explode 7 sub-assemblies; press 1, 2, 3 to switch measurement steps.">${svg}</div>`,
  });

const outName = theme === "light" ? "fig-01-light.html" : "fig-01.html";
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Fig 1 · CONNECT InBody AI Kiosk Exploded Assembly", theme, body, script: kitScript() + live, width: 720 }));
console.log("wrote", outName);

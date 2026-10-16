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
const HEIGHT = 480;

const PLATE = { x: -142, y: -102, w: 284, d: 218, r: 10 };
const PLATE_H = 10;
const FOOT_H = 5;

// Left front: Transparent Acrylic Sensor Hub Box (200x150x60mm scaled)
const HUB = { x: -124, y: 8, w: 98, d: 76, r: 4 };
const HUB_BASE_H = 4;
const HUB_WALL_H = 22;

// Back center: 24" Desktop Monitor on Stand
const MON_BASE = { x: -34, y: -88, w: 68, d: 34, r: 4 };
const MON_CASE = { x: -68, y: -76, w: 136, d: 12, r: 4 };
const MON_Z0 = 26;
const MON_Z1 = 114;
const MON_FRONT = MON_CASE.y + MON_CASE.d;
const MON_BEZEL = { x0: -63, x1: 63, z0: 31, z1: 109, r: 3, depth: 1.5 };
const MON_SCREEN = { x0: -59, x1: 59, z0: 35, z1: 105, r: 2.2, depth: 2.8 };

// Right front: Modified Camry EH101 Grip Rig + 2 Turned Yolanda Handles + 4-Electrode Footplate
const FOOT = { x: 46, y: 30, w: 78, d: 68, r: 5 };

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...k.boxCorners(MON_CASE, MON_Z0, MON_Z1 + 16),
    [-128, 90, 48],
    [130, 102, 40],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 46, elevation: 30 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) =>
  k.pathOf(k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps).map(([u, z]) => [u, -z]), true);

const R = A.recorder(P);

let clips = 0;
function recess({ x0, x1, z0, z1, r, depth }, y, back = "", backClass = "poc-well", inside = "") {
  const id = `poc-clip-${clips++}`;
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

// 1. Workbench Base Plate (12 solid parts)
function workbenchPlate() {
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

  // Front calibration ruler strip
  const strip = { x: -124, y: PLATE.y + PLATE.d - 14, w: 182, d: 7.5, r: 1.2 };
  out.push(S(k.slabOf(strip, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.9, 0.7, [2.2, 4.0], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));

  // Engraved nameplate
  const label = { x: 64, y: PLATE.y + PLATE.d - 15.5, w: 66, d: 9.5, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.9, P, 3, 0.2), { tone: "mid", crease: "lo" }));
  out.push(
    k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + 6.2], 0.95, P, "x"), "PHASE 1 POC RIG", {
      size: 3.1,
      tone: "hi",
      anchor: "middle",
    }),
  );
  return out.join("");
}

// 2. Back Center: 24" Desktop Monitor + Stand + Clip-on OV2710 60fps Webcam (13 solid parts)
function desktopMonitor() {
  const out = [`<path class="iso-halo" d="${k.haloOf(MON_BASE, 0, 5, P)}"/>`];
  // Monitor base & neck pillar
  out.push(S(k.slabOf(MON_BASE, 0, 3.8, P, 6, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -9, y: -78, w: 18, d: 10, r: 2 }, 3.8, 24, P, 4, 0.5), { tone: "lo" }));
  // Monitor main housing
  out.push(S(k.slabOf(MON_CASE, MON_Z0, MON_Z1 - MON_Z0, P, 6, 1.2), { tone: "mid" }));

  // Screen dashboard content (connectinbody.vercel.app WebSerial 250Hz live view)
  const scanLines = [];
  for (let z = MON_SCREEN.z0 + 4; z < MON_SCREEN.z1; z += 4.5) {
    scanLines.push(`M${MON_SCREEN.x0 + 1} ${(-z).toFixed(1)}H${MON_SCREEN.x1 - 1}`);
  }
  const ecgWave =
    "M-54 -84 L-44 -84 L-41 -87 L-39 -84 L-36 -82 L-33 -96 L-30 -78 L-27 -84 L-21 -88 L-15 -84 L-4 -84 L-1 -87 L1 -84 L4 -82 L7 -96 L10 -78 L13 -84 L19 -88 L25 -84 L36 -84 L39 -87 L41 -84 L44 -82 L47 -96 L50 -78 L53 -84";
  const ppgWave =
    "M-54 -66 Q-47 -75 -41 -67 T-28 -66 Q-21 -75 -15 -67 T-2 -66 Q5 -75 11 -67 T24 -66 Q31 -75 37 -67 T52 -66";

  const screenInner = [
    `<path class="poc-glow" d="${flat(-52, MON_SCREEN.z0 + 4, 52, MON_SCREEN.z1 - 4, 12, 8)}"/>`,
    `<path class="poc-scan" d="${scanLines.join("")}"/>`,
    `<text class="poc-text" x="-54" y="-97" font-size="3.6">connectinbody.vercel.app · WebSerial 921,600 bps · 250Hz NDJSON</text>`,
    `<path class="iso-line" data-tone="lit" d="${ecgWave}" style="stroke-width:1.15"/>`,
    `<path class="iso-line" data-tone="green" d="${ppgWave}" style="stroke-width:1.0"/>`,
    `<text class="poc-text" data-part="mon-line1" x="-54" y="-50" font-size="4.0">PHA 5.62° · R 498.4Ω · Xc 49.1Ω · PTT 241ms</text>`,
    `<text class="poc-text" data-part="mon-line2" x="-54" y="-41" font-size="3.6">MODULE: ESP32-S3 + AD5940 + MAX86150 + HX711 [ACTIVE]</text>`,
  ].join("");

  out.push(
    recess(
      MON_BEZEL,
      MON_FRONT,
      "",
      "poc-bezel",
      recess(MON_SCREEN, MON_FRONT - MON_BEZEL.depth, screenInner, "poc-glass"),
    ),
  );

  // Top Clip-on OV2710 60fps 1080p Manual-Exposure Webcam
  const camMount = { x: -12, y: MON_CASE.y + 1, w: 24, d: 13, r: 2.2 };
  out.push(S(k.slabOf(camMount, MON_Z1, 8, P, 4, 0.5), { tone: "hi", crease: "lo" }));
  const Fcam = G.frameAlong([0, MON_FRONT + 1.5, MON_Z1 + 4], [0, 1, 0]);
  const lensProfile = [
    [0, 3.8],
    [2.0, 3.8],
    [2.4, 3.1],
    [4.4, 3.1],
  ];
  out.push(S(G.solidOf(lensProfile, Fcam, P), { tone: "hi", lit: true }));
  out.push(L(G.ribsOf(Fcam, 0.3, 1.8, 3.85, 16, P), { tone: "lo" }));
  out.push(S(G.disc(4.4, 4.8, 2.4, Fcam, P), { tone: "mid", lit: true }));

  return `<g data-part="monitor">${out.join("")}</g>`;
}

// 3. Left Front: Transparent Acrylic Sensor Hub + 4 PCB Modules + 13 Jumper Wires (28 solid parts)
function acrylicSensorHub() {
  const out = [`<path class="iso-halo" d="${k.haloOf(HUB, 0, HUB_BASE_H, P)}"/>`];

  // Acrylic base plate
  out.push(S(k.slabOf(HUB, 0, HUB_BASE_H, P, 6, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(HUB, 2.5), HUB_BASE_H, P, 5), { tone: "lo" }));

  // 4 Corner Brass Standoff Pillars inside acrylic box
  for (const [sx, sy] of byDepth(k.corners(HUB, 5.5))) {
    out.push(S(k.cylinder(sx, sy, 2.1, HUB_BASE_H, HUB_WALL_H, P, 18), { tone: "hi" }));
    out.push(L(k.knurl(sx, sy, 2.1, HUB_BASE_H + 2, HUB_BASE_H + HUB_WALL_H - 2, 12, P), { tone: "lo" }));
  }

  // Module 1: ESP32-S3-DevKitC Dual-Core MCU Board (Front-Right of Hub, near USB isolator exit)
  const espPlan = { x: -64, y: 46, w: 32, d: 28, r: 1.8 };
  const espGroup = [
    S(k.slabOf(espPlan, HUB_BASE_H, 3.2, P, 4, 0.4), { tone: "hi", lit: true }),
    // ESP32-S3 WROOM Metal RF Shield Can
    S(k.slabOf({ x: -59, y: 50, w: 16, d: 14, r: 1 }, HUB_BASE_H + 3.2, 2.6, P, 3, 0.3), { tone: "hi", lit: true }),
    // Dual 22-pin header banks
    S(k.slabOf({ x: -62, y: 48, w: 28, d: 2.2, r: 0.4 }, HUB_BASE_H + 3.2, 2.2, P, 2), { tone: "mid" }),
    S(k.slabOf({ x: -62, y: 69, w: 28, d: 2.2, r: 0.4 }, HUB_BASE_H + 3.2, 2.2, P, 2), { tone: "mid" }),
    // USB-C port on right edge
    S(k.slabOf({ x: -35, y: 56, w: 5, d: 8, r: 1 }, HUB_BASE_H + 3.2, 2.4, P, 3), { tone: "hi" }),
    k.faceTextSvg(k.topMatrix([-51, 59], HUB_BASE_H + 5.9, P, "x"), "ESP32-S3", { size: 2.5, tone: "hi", anchor: "middle" }),
  ];
  out.push(`<g class="poc-mod" data-mod="0">${espGroup.join("")}</g>`);

  // Module 2: AD5940-BIOZ 50kHz 4-Terminal Bio-Impedance Board (Back-Left of Hub)
  const adPlan = { x: -116, y: 15, w: 42, d: 26, r: 1.8 };
  const adGroup = [
    S(k.slabOf(adPlan, HUB_BASE_H, 3.2, P, 4, 0.4), { tone: "hi", lit: true }),
    // AD5940 QFN-56 IC chip
    S(k.slabOf({ x: -102, y: 22, w: 12, d: 12, r: 0.8 }, HUB_BASE_H + 3.2, 1.8, P, 3), { tone: "hi", lit: true }),
    // 4 SMA / Screw terminal posts for CE0, RE0, SE0, AIN1
    ...[0, 1, 2, 3].map((i) => S(k.cylinder(-112 + i * 6.5, 18.5, 1.8, HUB_BASE_H + 3.2, 3.0, P, 14), { tone: "hi" })),
    k.faceTextSvg(k.topMatrix([-95, 30], HUB_BASE_H + 5.1, P, "x"), "AD5940 50kHz", { size: 2.4, tone: "hi", anchor: "middle" }),
  ];
  out.push(`<g class="poc-mod" data-mod="1">${adGroup.join("")}</g>`);

  // Module 3: MAX86150 Synchronized ECG + PPG Breakout Board (Back-Right of Hub)
  const maxPlan = { x: -68, y: 15, w: 34, d: 24, r: 1.8 };
  const maxGroup = [
    S(k.slabOf(maxPlan, HUB_BASE_H, 3.2, P, 4, 0.4), { tone: "hi", lit: true }),
    // Optical window sensor package
    S(k.slabOf({ x: -56, y: 21, w: 11, d: 9, r: 0.8 }, HUB_BASE_H + 3.2, 2.0, P, 3), { tone: "hi", lit: true }),
    L(k.ring(-50.5, 25.5, 2.2, HUB_BASE_H + 5.3, P, 16), { tone: "red" }),
    k.faceTextSvg(k.topMatrix([-51, 35], HUB_BASE_H + 3.3, P, "x"), "MAX86150", { size: 2.3, tone: "hi", anchor: "middle" }),
  ];
  out.push(`<g class="poc-mod" data-mod="2">${maxGroup.join("")}</g>`);

  // Module 4: HX711 80SPS 24-Bit Load-Cell & Grip Amplifier Board (Front-Left of Hub)
  const hxPlan = { x: -116, y: 47, w: 42, d: 26, r: 1.8 };
  const hxGroup = [
    S(k.slabOf(hxPlan, HUB_BASE_H, 3.2, P, 4, 0.4), { tone: "mid" }),
    S(k.slabOf({ x: -101, y: 54, w: 12, d: 9, r: 0.8 }, HUB_BASE_H + 3.2, 1.8, P, 3), { tone: "hi", lit: true }),
    // E+, E-, A-, A+, B-, B+ terminal block
    S(k.slabOf({ x: -113, y: 66, w: 26, d: 4.5, r: 0.6 }, HUB_BASE_H + 3.2, 3.2, P, 3), { tone: "mid" }),
    k.faceTextSvg(k.topMatrix([-95, 60], HUB_BASE_H + 5.1, P, "x"), "HX711 80SPS", { size: 2.3, tone: "hi", anchor: "middle" }),
  ];
  out.push(`<g class="poc-mod" data-mod="3">${hxGroup.join("")}</g>`);

  // 13 Color-Coded 3D Jumper Wires (3 routed bundles using tubePieces + tubeSvg)
  // Bundle A: 6 SPI Jumper Wires (AD5940 <-> ESP32-S3 GPIO 8-13)
  const spiWires = [];
  for (let i = 0; i < 6; i++) {
    const off = (i - 2.5) * 1.6;
    const pts = G.fillet(
      [
        [-82 + off, 36, HUB_BASE_H + 4.5],
        [-82 + off, 42, HUB_BASE_H + 12 + (i % 2) * 1.8],
        [-58 + off, 49, HUB_BASE_H + 4.5],
      ],
      3.0,
    );
    for (const pc of tubePieces(pts, 0.55, P)) {
      spiWires.push(tubeSvg(pc, { tone: i < 2 ? "red" : "hi" }));
    }
  }
  out.push(`<g data-bus="1">${spiWires.join("")}</g>`);

  // Bundle B: 4 I2C Jumper Wires (MAX86150 <-> ESP32-S3 GPIO 4-6: SDA, SCL, INT, 3V3)
  const i2cWires = [];
  for (let i = 0; i < 4; i++) {
    const off = (i - 1.5) * 1.8;
    const pts = G.fillet(
      [
        [-48 + off, 36, HUB_BASE_H + 4.5],
        [-48 + off, 42, HUB_BASE_H + 11.5],
        [-46 + off, 49, HUB_BASE_H + 4.5],
      ],
      2.8,
    );
    for (const pc of tubePieces(pts, 0.55, P)) {
      i2cWires.push(tubeSvg(pc, { tone: "green" }));
    }
  }
  out.push(`<g data-bus="2">${i2cWires.join("")}</g>`);

  // Bundle C: 3 HX711 Digital Wires (HX711 <-> ESP32-S3 GPIO 17-18: DOUT, PD_SCK, VCC)
  const hxWires = [];
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 2.0;
    const pts = G.fillet(
      [
        [-78, 58 + off, HUB_BASE_H + 4.5],
        [-70, 58 + off, HUB_BASE_H + 11],
        [-61, 58 + off, HUB_BASE_H + 4.5],
      ],
      2.6,
    );
    for (const pc of tubePieces(pts, 0.58, P)) {
      hxWires.push(tubeSvg(pc, { tone: "blue" }));
    }
  }
  out.push(`<g data-bus="3">${hxWires.join("")}</g>`);

  // Top Clear Acrylic Cover Plate (lifts smoothly on hover/inspect via translateAlong!)
  const lid = [];
  lid.push(S(k.slabOf(HUB, HUB_BASE_H + HUB_WALL_H, 2.2, P, 6, 0.5), { tone: "mid", flat: true }));
  lid.push(L(k.planOutline(HUB, HUB_BASE_H + HUB_WALL_H + 2.2, P, 6), { tone: "hi" }));
  lid.push(L(k.planOutline(k.insetPlan(HUB, 4), HUB_BASE_H + HUB_WALL_H + 2.2, P, 5), { tone: "faint" }));
  for (const [sx, sy] of k.corners(HUB, 5.5)) {
    lid.push(L(k.ring(sx, sy, 2.0, HUB_BASE_H + HUB_WALL_H + 2.2, P, 14), { tone: "hi" }));
  }
  lid.push(
    k.faceTextSvg(
      k.topMatrix([HUB.x + HUB.w / 2, HUB.y + 10], HUB_BASE_H + HUB_WALL_H + 2.3, P, "x"),
      "ACRYLIC SENSOR HUB (24.4만원 BOM)",
      { size: 2.6, tone: "hi", anchor: "middle" },
    ),
  );
  out.push(`<g data-part="acrylic-lid" style="opacity:0.82">${lid.join("")}</g>`);

  return out.join("");
}

// 4. Center: ADuM3160 2500V USB Galvanic Isolator Dongle & Routed USB-CDC Cable (6 solid parts)
function isolatorAndUsbCable() {
  const out = [];
  // Short jumper bridge from ESP32-S3 USB-C to ADuM3160
  const shortBridge = G.fillet(
    [
      [-30, 60, 8.5],
      [-18, 60, 7.5],
    ],
    2,
  );
  for (const pc of tubePieces(shortBridge, 1.0, P)) {
    out.push(tubeSvg(pc, { tone: "mid" }));
  }

  // ADuM3160 2500V RMS Medical-grade USB Isolator Enclosure
  const isoPlan = { x: -18, y: 52, w: 32, d: 16, r: 2.2 };
  const isoGroup = [
    `<path class="iso-halo" d="${k.haloOf(isoPlan, 0, 9, P)}" style="filter:blur(4px)"/>`,
    S(k.slabOf(isoPlan, 2, 8.5, P, 4, 0.6), { tone: "hi", lit: true }),
    // Isolation barrier trench seam across the middle
    L(k.lineOnTop([-2, 52.5], [-2, 67.5], 10.6, P), { tone: "red", dashed: true }),
    // ADuM3160 SOIC-16 chip boss on top
    S(k.slabOf({ x: -8, y: 56, w: 12, d: 8, r: 0.8 }, 10.5, 1.4, P, 3), { tone: "hi", lit: true }),
    k.faceTextSvg(k.topMatrix([-2, 65], 10.6, P, "x"), "ADuM3160 2.5kV", { size: 2.3, tone: "hi", anchor: "middle" }),
  ];
  out.push(`<g class="poc-mod" data-mod="4">${isoGroup.join("")}</g>`);

  // Routed 3D USB-CDC Cable from ADuM3160 output to 24" Monitor / PC Backend
  const usbPts = G.fillet(
    [
      [14, 60, 6.5],
      [26, 60, 4.0],
      [26, -18, 4.0],
      [8, -64, 16.0],
    ],
    8,
  );
  for (const pc of tubePieces(usbPts, 1.15, P)) {
    out.push(tubeSvg(pc, { tone: "hi" }));
  }

  // Animated data flow pulse line overlaid on USB cable
  const flowPath = k.pathOf(usbPts.map((pt) => at([pt[0], pt[1], pt[2] + 1.2])));
  out.push(L(flowPath, { tone: "lit", flow: true }));

  return out.join("");
}

// 5. Right Front: 2 Turned Yolanda Stainless Handles + Camry EH101 Grip Dynamometer + 4-Electrode Footplate (14 solid parts)
function peripheralsRight() {
  const out = [];

  // Cradle block holding the two horizontal Yolanda stainless handles (back-right)
  const cradle = { x: 46, y: -24, w: 76, d: 44, r: 4 };
  out.push(S(k.slabOf(cradle, 0, 4.5, P, 5, 0.6), { tone: "lo" }));

  // Two turned Yolanda 4-Electrode Stainless Handles lying horizontally along X axis (using lathe.mjs!)
  for (const [idx, hy] of [
    [0, -13],
    [1, 6],
  ]) {
    const Fh = G.frameAlong([54, hy, 9.5], [1, 0, 0]);
    const hProfile = [
      [0, 3.6],
      [2, 4.4],
      [18, 4.4],
      [19.5, 3.6],
      [22.5, 4.4],
      [38, 4.4],
      [40, 3.6],
    ];
    out.push(S(G.solidOf(hProfile, Fh, P), { tone: "hi", crease: "lo" }));
    out.push(L(G.ribsOf(Fh, 3, 17, 4.45, 20, P), { tone: "lo" }));
    out.push(L(G.ribsOf(Fh, 23.5, 37, 4.45, 20, P), { tone: "lo" }));

    // Modified Camry EH101 Grip Dynamometer Frame & Spring Lever attached to Front Handle (idx === 1)
    if (idx === 1) {
      const gripBar = { x: 60, y: hy + 6.5, w: 28, d: 4.5, r: 1.5 };
      out.push(S(k.slabOf(gripBar, 7.2, 5.0, P, 4, 0.5), { tone: "hi", lit: true }));
      // Dual calibration springs between handle and Camry grip bar
      const sp1 = k.coil(hy + 3.5, hy + 6.5, [66, 9.5], 1.8, 5, "y", P);
      const sp2 = k.coil(hy + 3.5, hy + 6.5, [82, 9.5], 1.8, 5, "y", P);
      out.push(L(sp1.front, { tone: "hi" }), L(sp2.front, { tone: "hi" }));
    }
  }

  // Front-Right: 4-Electrode Tempered Glass Footplate + 4 Load-Cell Pucks
  out.push(`<path class="iso-halo" d="${k.haloOf(FOOT, 0, 5, P)}" style="filter:blur(4px)"/>`);
  for (const [px, py] of byDepth(k.corners(FOOT, 10))) {
    out.push(S(k.cylinder(px, py, 5.2, 0, 2.6, P, 20), { tone: "lo" }));
  }
  out.push(S(k.slabOf(FOOT, 2.6, 4.4, P, 6, 0.8), { tone: "hi", crease: "lo" }));

  // 4 Circular Stainless Foot Electrodes on Footplate
  const footElecs = [
    [66, 48, 10.5],
    [104, 48, 10.5],
    [66, 78, 9.2],
    [104, 78, 9.2],
  ];
  for (const [ex, ey, rad] of byDepth(footElecs)) {
    out.push(S(k.cylinder(ex, ey, rad, 7.0, 1.2, P, 30, 0.3), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(ex, ey, rad - 2, 8.2, P, 22), { tone: "lo" }));
  }

  // Coiled umbilical cords connecting handles & footplate into the Acrylic Sensor Hub
  const coilA = k.coil(-22, 36, [-2, 5.5], 2.8, 13, "x", P);
  out.push(L(coilA.back, { tone: "lo" }), L(coilA.front, { tone: "mid" }));

  const leadFoot = G.fillet(
    [
      [46, 64, 4.5],
      [22, 78, 3.0],
      [-28, 76, 5.5],
    ],
    6,
  );
  for (const pc of tubePieces(leadFoot, 0.95, P)) {
    out.push(tubeSvg(pc, { tone: "mid" }));
  }

  return out.join("");
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Phase 1 Benchtop PoC Rig (244,000 KRW total BOM) on a calibration workbench: on the left, a transparent acrylic sensor hub housing four breakout boards (ESP32-S3-DevKitC, AD5940-BIOZ 50kHz BIA, MAX86150 ECG+PPG, and HX711 80SPS ADC) wired with 13 color-coded jumper tubes; in the center, an ADuM3160 2500V USB galvanic isolator feeding a 24-inch desktop monitor running the connectinbody.vercel.app WebSerial dashboard with a top OV2710 60fps webcam; on the right, two turned Yolanda stainless electrode handles with a modified Camry EH101 grip dynamometer and a 4-electrode tempered-glass footplate.",
  body: [
    workbenchPlate(),
    desktopMonitor(),
    peripheralsRight(),
    isolatorAndUsbCable(),
    acrylicSensorHub(),
  ],
});

const MODULES = [
  {
    id: 1,
    name: "1: ESP32-S3-DevKitC (250Hz NDJSON Streamer)",
    line1: "ESP32-S3 DUAL-CORE · 921,600 bps USB-CDC",
    line2: "RING-BUFFER DMA · 0% PACKET DROP · BOM 1.1만원",
    readout: "Module 1: ESP32-S3 250Hz NDJSON · PoC BOM 24.4만원 · 921,600 bps WebSerial · 32 Biomarkers",
    lidLift: 24,
  },
  {
    id: 2,
    name: "2: AD5940-BIOZ (50kHz Quadripolar BIA · $22)",
    line1: "AD5940 SPI GPIO 8-13 · 50kHz DFT ENGINE",
    line2: "PHA 5.62° · R 498.4Ω · Xc 49.1Ω · BOM 5.5만원",
    readout: "Module 2: AD5940 SPI GPIO 8-13 ($22) · PoC BOM 24.4만원 · 50kHz Phase Angle 5.62°",
    lidLift: 28,
  },
  {
    id: 3,
    name: "3: MAX86150 (Synchronized ECG + PPG · $15)",
    line1: "MAX86150 I2C GPIO 4-6 · 250Hz SYNC FIFO",
    line2: "PTT 241ms · HRV SDNN 48ms · BP 118/76 · BOM 3.5만원",
    readout: "Module 3: MAX86150 I2C GPIO 4-6 ($15) · PoC BOM 24.4만원 · PTT 241ms Cuffless BP",
    lidLift: 28,
  },
  {
    id: 4,
    name: "4: HX711 24-Bit ADC (80SPS Grip + Weight · $9)",
    line1: "HX711 GPIO 17-18 · 80SPS RATE PIN HIGH",
    line2: "GRIP 44.2kg · RFD 108kg/s · WEIGHT 68.4kg · BOM 1.2만원",
    readout: "Module 4: HX711 80SPS GPIO 17-18 ($9) · PoC BOM 24.4만원 · Camry EH101 + Yolanda Load Cells",
    lidLift: 26,
  },
  {
    id: 5,
    name: "5: ADuM3160 (2500V RMS Medical USB Isolator · $8)",
    line1: "ADuM3160 2500V GALVANIC ISOLATION BARRIER",
    line2: "IEC 60601-1 LEAKAGE < 10uA · AC HUM REJECTED · BOM 1.8만원",
    readout: "Module 5: ADuM3160 2500V Isolator ($8) · PoC BOM 24.4만원 · Medical-Grade Patient Protection",
    lidLift: 12,
  },
];

const live = `
const P = ${JSON.stringify(P)};
const MODULES = ${JSON.stringify(MODULES)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const lid = svg.querySelector('[data-part="acrylic-lid"]');
const mon1 = svg.querySelector('[data-part="mon-line1"]');
const mon2 = svg.querySelector('[data-part="mon-line2"]');
const modEls = [0, 1, 2, 3, 4].map((i) => svg.querySelector('[data-mod="' + i + '"]'));
const busEls = {
  1: svg.querySelector('[data-bus="1"]'),
  2: svg.querySelector('[data-bus="2"]'),
  3: svg.querySelector('[data-bus="3"]'),
};
const still = matchMedia("(prefers-reduced-motion: reduce)");

let activeIdx = 0;
let lift = 22, targetLift = 24, liftVel = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;

function draw() {
  const m = MODULES[activeIdx];
  if (lid) {
    lid.setAttribute("transform", translateAlong(P, [0, 0, lift]));
  }
  modEls.forEach((el, idx) => {
    if (!el) return;
    const isSel = idx === activeIdx;
    const zHop = isSel ? 3.2 : 0;
    el.setAttribute("transform", translateAlong(P, [0, 0, zHop]));
    el.style.opacity = isSel ? "1" : "0.78";
  });
  Object.entries(busEls).forEach(([k, el]) => {
    if (!el) return;
    el.style.opacity = Number(k) === activeIdx ? "1" : "0.65";
  });
  if (mon1) mon1.textContent = m.line1;
  if (mon2) mon2.textContent = m.line2;
  if (readout.textContent !== m.readout) readout.textContent = m.readout;
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    activeIdx = Math.floor(clock / 3.2) % MODULES.length;
    targetLift = MODULES[activeIdx].lidLift;
  }
  if (calm) {
    lift = targetLift;
    liftVel = 0;
  } else {
    const stiff = 190, damp = 22;
    liftVel += ((targetLift - lift) * stiff - liftVel * damp) * dt;
    lift += liftVel * dt;
    if (Math.abs(targetLift - lift) < 0.01 && Math.abs(liftVel) < 0.01) {
      lift = targetLift;
      liftVel = 0;
    }
  }
  draw();
  const busy = touring || Math.abs(targetLift - lift) > 0.01 || Math.abs(liftVel) > 0.01;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

function selectModule(idx) {
  touring = false;
  activeIdx = (idx + MODULES.length) % MODULES.length;
  targetLift = MODULES[activeIdx].lidLift;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!still.matches) {
      touring = true;
      run();
    }
  }, 5500);
  run();
}

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.max(0, Math.min(0.999, (event.clientX - box.left) / box.width));
  selectModule(Math.floor(share * MODULES.length));
});

svg.addEventListener("click", (event) => {
  const mod = event.target.closest("[data-mod]");
  if (mod) {
    selectModule(Number(mod.dataset.mod));
  } else {
    targetLift = targetLift > 5 ? 0 : 28;
    touring = false;
    run();
  }
  stage.focus({ preventScroll: true });
});

stage.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "5") {
    event.preventDefault();
    selectModule(Number(event.key) - 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    selectModule(activeIdx + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    selectModule(activeIdx - 1);
  } else if (event.key === "e" || event.key === "E") {
    event.preventDefault();
    touring = false;
    targetLift = targetLift > 5 ? 0 : 28;
    run();
  }
});

draw();
`;

const css = `<style>
.poc-well{fill:var(--anatomy-shade-1)}
.poc-bezel{fill:var(--anatomy-top)}
.poc-glass{fill:var(--anatomy-lit-shade)}
.poc-glow{fill:var(--anatomy-lit);opacity:.08;filter:blur(5px)}
.poc-scan{fill:none;stroke:var(--anatomy-faint);stroke-width:.45px;vector-effect:non-scaling-stroke;opacity:.65}
.poc-text{fill:var(--anatomy-lit);font-family:var(--anatomy-mono);letter-spacing:.03em}
.poc-mod{cursor:pointer;transition:opacity .25s var(--anatomy-ease)}
.iso-stage{touch-action:pan-y;cursor:pointer}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
</style>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 2",
    title: "Phase 1 벤치탑 1호기 — 24만원 투명 아크릴 센서 허브 & 점퍼선 결선 리그 (Benchtop PoC Rig)",
    hint: "Hover or press 1–5 to inspect modules · click lid to open/close",
    readout: "PoC BOM 24.4만원 · 921,600 bps WebSerial · 32 Biomarkers",
    keys: [
      { mark: "lit", label: "ESP32-S3 + AD5940($22) + MAX86150($15) + HX711($9) + ADuM3160($8) 모듈" },
      { mark: "red", label: "SPI 버스 (GPIO 8–13: AD5940 50kHz 위상각 & 임피던스 6선 결선)" },
      { mark: "green", label: "I2C 버스 (GPIO 4–6: MAX86150 250Hz 동기화 ECG·PPG 4선 결선)" },
      { mark: "blue", label: "HX711 버스 (GPIO 17–18: 80SPS 24-bit 체중·악력 로드셀 3선 결선)" },
    ],
    caption:
      "63.8만원 올인원 스탠드 키오스크를 발주하기 전, 단 24.4만원의 부품비와 무납땜 듀폰 점퍼선 13가닥만으로 32개 전신 바이오마커 파이프라인을 100% 실증하는 Phase 1 벤치탑 1호기 리그입니다. 좌측 투명 아크릴 인클로저 내부에 ESP32-S3-DevKitC, AD5940-BIOZ 50kHz 생체임피던스 보드, MAX86150 동기화 심전도·맥파 보드, HX711 80SPS 로드셀 증폭 보드가 황동 스탠드오프 위에 장착되며, 중앙의 ADuM3160 2500V 의료용 USB 갈바닉 절연 동글을 거쳐 후면 24인치 모니터(connectinbody.vercel.app WebSerial 대시보드 및 상단 OV2710 60fps 웹캠)로 250Hz NDJSON 패킷을 실시간 스트리밍합니다. 우측에는 개조된 Yolanda 4전극 핸들·발판과 Camry EH101 악력계가 연결됩니다. 숫자 1~5 키를 누르거나 마우스를 움직여 각 보드의 결선과 실시간 계측값을 점검하세요.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="Phase 1 Benchtop PoC Rig. Move pointer or press keys 1 to 5 to inspect the 5 hardware modules and lift the acrylic cover.">${svg}</div>`,
  });

const outName = theme === "light" ? "fig-02-light.html" : "fig-02.html";
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Fig 2 · Phase 1 Benchtop PoC Rig", theme, body, script: kitScript() + live, width: 720 }));
console.log("wrote", outName);

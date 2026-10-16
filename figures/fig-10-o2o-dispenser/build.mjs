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

const WIDTH = 780;
const HEIGHT = 520;

const PLATE = { x: -174, y: -88, w: 348, d: 178, r: 10 };
const PLATE_H = 12;
const FOOT_H = 6;

// 6 Custom Supplement Hoppers on the Left Smart Pharmacy Manifold
const HOPPERS = [
  { id: 0, code: "① PROT+LEU", sub: "SMI<7.0 / Grip", pos: [-142, -52], z: 42 },
  { id: 1, code: "② CoQ10+ω3", sub: "PWV>9.0 / BP", pos: [-104, -52], z: 42 },
  { id: 2, code: "③ Mg+THEA", sub: "LF/HF>2.5", pos: [-66, -52], z: 42 },
  { id: 3, code: "④ MSM+CHON", sub: "ROM<140°", pos: [-142, -12], z: 32 },
  { id: 4, code: "⑤ PS NEURO", sub: "Iris>320ms", pos: [-104, -12], z: 32 },
  { id: 5, code: "⑥ VIT-D+AOX", sub: "φ<5.0° Cell", pos: [-66, -12], z: 32 },
];

// 4 Customer Archetypes for Check-to-Play & Play-to-Care O2O Loop
const ARCHETYPES = [
  {
    key: 1,
    name: "Archetype 1 · 오십견·근감소 주의 시니어 (ROM 132° · 악력 23.4kg)",
    hoppers: [0, 3],
    pack: "① 단백질·류신 + ④ MSM·콘드로이친 소분 팩",
    mypark: "Check-to-Play → 3/4 스윙 아크 제한 · 굵은 그립(+2mm) 처방 (1인 18홀 7,000원)",
    swingTurn: 0.45,
    gripShift: 8,
    shuttleDir: 1,
  },
  {
    key: 2,
    name: "Archetype 2 · 혈관경직·자율신경 긴장 직장인 (PWV 9.4m/s · LF/HF 3.1)",
    hoppers: [1, 2],
    pack: "② 코엔자임Q10·오메가3 + ③ 마그네슘·테아닌 팩",
    mypark: "Check-to-Play → 템포 스윙 가이드 · 반경 1km 제휴 마이파크 18홀 라운드",
    swingTurn: 0.72,
    gripShift: 2,
    shuttleDir: 1,
  },
  {
    key: 3,
    name: "Archetype 3 · 세포막 위상각·동공 반응 저하 케어 (φ 4.7° · 335ms)",
    hoppers: [4, 5],
    pack: "⑤ 포스파티딜세린(PS) + ⑥ 항산화·비타민D 팩",
    mypark: "Check-to-Play → 퍼팅 거리감·시각 집중 루틴 + 코어 밸런스 스탠스",
    swingTurn: 0.62,
    gripShift: 4,
    shuttleDir: 1,
  },
  {
    key: 4,
    name: "Archetype 4 · 마이파크 제1회 챔피언쉽 마스터즈 대회 18홀 완주 회원",
    hoppers: [0, 2, 3],
    pack: "① 단백질·류신 + ③ 마그네슘 + ④ MSM 리커버리 팩",
    mypark: "Play-to-Care ← 마스터즈 대회(10.17~12.19 · 참가비 무료·앱 회원) 18홀 피로도 약국 역전송",
    swingTurn: 0.92,
    gripShift: 0,
    shuttleDir: -1,
  },
];

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [-168, -82, 106],
    [168, -82, 106],
    [168, 86, 65],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 39, elevation: 29 },
);

// Audit registration using audit.mjs to verify solid model integrity
const auditShapes = [
  A.slab(PLATE, -PLATE_H, PLATE_H, { name: "base.plate" }),
  ...HOPPERS.map((h) => A.cylinder(h.pos[0], h.pos[1], 11.5, h.z, 26, { name: `hopper.${h.id}` })),
];

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// 1. Base Plate & Twin Station Plinths (14 solid parts)
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
  return out.join("");
}

// 2. Left Station: Smart Pharmacy 6-Hopper Supplement Dispenser & 80mm Printer (34 solid parts)
function pharmacyStation() {
  const out = [];
  // Rear tier manifold block (Row 1 hoppers)
  const rearManifold = { x: -162, y: -74, w: 116, d: 42, r: 5 };
  out.push(S(k.slabOf(rearManifold, 0, 36, P, 6, 1.0), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(rearManifold, 2.5), 36, 6, P, 5, 0.5), { tone: "mid" }));

  // Middle tier manifold block (Row 2 hoppers)
  const midManifold = { x: -162, y: -32, w: 116, d: 40, r: 5 };
  out.push(S(k.slabOf(midManifold, 0, 26, P, 6, 1.0), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(midManifold, 2.5), 26, 6, P, 5, 0.5), { tone: "mid" }));

  // Render the 6 Supplement Hoppers in back-to-front, left-to-right order
  const orderedHoppers = [...HOPPERS].sort(
    (a, b) => k.depthOf([a.pos[0], a.pos[1], a.z], P) - k.depthOf([b.pos[0], b.pos[1], b.z], P),
  );

  for (const h of orderedHoppers) {
    const [x, y] = h.pos;
    const F = G.frameOf([x, y, h.z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);

    // Conical-cylindrical turned hopper body using G.solidOf
    const profile = [
      [0, 5.2],
      [5, 11.5],
      [22, 11.5],
      [24, 12.6],
      [27, 12.6],
    ];
    out.push(S(G.solidOf(profile, F, P, { bevel: 0.4 }), { tone: "hi" }));
    out.push(L(G.ribsOf(F, 6, 21, 11.5, 18, P, { seams: true }), { tone: "lo" }));
    out.push(D(G.dotsOf(F, 25.5, 12.6, 12, P), { size: 0.4, tone: "mid" }));

    // Top dome finial sphere using G.sphereOf
    out.push(S(G.sphereOf([x, y, h.z + 29.5], 3.2, P), { tone: "mid" }));

    // Hopper top label
    out.push(k.faceTextSvg(k.topMatrix([x, y - 3.5], h.z + 27.2, P, "x"), h.code, { size: 2.05, tone: "hi", anchor: "middle" }));
    out.push(k.faceTextSvg(k.topMatrix([x, y + 5.2], h.z + 27.2, P, "x"), h.sub, { size: 1.85, tone: "mid", anchor: "middle" }));

    // Sliding Dosing Gate at base of hopper (lit: true, lifts when dispensing)
    const gate = [];
    const gatePlan = { x: x - 5.5, y: y + 4.5, w: 11, d: 4.5, r: 1 };
    gate.push(S(k.slabOf(gatePlan, h.z - 2, 5.5, P, 3, 0.3), { tone: "hi", lit: true }));
    gate.push(S(k.cylinder(x, y + 6.8, 1.8, h.z + 3.5, 3.2, P, 16), { tone: "hi", lit: true }));
    const initOpen = h.id === 0 || h.id === 3 ? 5.5 : 0;
    out.push(`<g data-gate="${h.id}" transform="${k.translateAlong(P, [0, 0, initOpen])}">${gate.join("")}</g>`);
  }

  // Front-Left Pouch Packaging & 80mm Receipt Dispenser Console
  const dispenser = { x: -162, y: 12, w: 116, d: 56, r: 5 };
  out.push(S(k.slabOf(dispenser, 0, 18, P, 6, 0.9), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(dispenser, 3), 18, 5, P, 5, 0.5), { tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([-104, 22], 23.2, P, "x"), "PHARMACY CUSTOM POUCH & 80mm PRINTER", { size: 2.15, tone: "hi", anchor: "middle" }));

  // Personalized Daily Supplement Pouch (slides forward when dispensed)
  const pouch = [];
  const pouchPlan = { x: -148, y: 34, w: 42, d: 26, r: 2.5 };
  pouch.push(S(k.slabOf(pouchPlan, 23, 3.2, P, 4, 0.4), { tone: "hi", lit: true }));
  pouch.push(L(k.planOutline(k.insetPlan(pouchPlan, 2.5), 26.3, P), { tone: "lo" }));
  pouch.push(k.faceTextSvg(k.topMatrix([-127, 46], 26.4, P, "x"), "DAILY PACK", { size: 2.2, tone: "hi", anchor: "middle" }));
  pouch.push(k.faceTextSvg(k.topMatrix([-127, 53], 26.4, P, "x"), "32-BIO MATCH", { size: 1.85, tone: "mid", anchor: "middle" }));
  out.push(`<g data-part="pouch" transform="${k.translateAlong(P, [0, 4, 0])}">${pouch.join("")}</g>`);

  // 80mm Thermal Prescription & O2O QR Receipt next to the pouch
  const receipt = [];
  const recPlan = { x: -94, y: 34, w: 36, d: 28, r: 1.2 };
  receipt.push(S(k.slabOf(recPlan, 23, 1.6, P, 3, 0.2), { tone: "hi", lit: true }));
  receipt.push(L(k.lineOnTop([-90, 39], [-62, 39], 24.7, P), { tone: "hi" }));
  receipt.push(L(k.lineOnTop([-90, 44], [-65, 44], 24.7, P), { tone: "mid" }));
  receipt.push(L(k.lineOnTop([-90, 49], [-63, 49], 24.7, P), { tone: "lo" }));
  receipt.push(k.faceTextSvg(k.topMatrix([-76, 56], 24.8, P, "x"), "80mm O2O QR", { size: 2.0, tone: "hi", anchor: "middle" }));
  out.push(`<g data-part="receipt" transform="${k.translateAlong(P, [0, 4, 0])}">${receipt.join("")}</g>`);

  return out.join("");
}

// 3. Center Dual Pneumatic O2O Transfer Tubes: Check-to-Play & Play-to-Care (16 solid parts)
function o2oPneumaticBridge() {
  const out = [];

  // Central support stanchion between Pharmacy (-46) and MyPark (+46)
  const postPlan = { x: -10, y: -14, w: 20, d: 24, r: 2.5 };
  out.push(S(k.slabOf(postPlan, 0, 46, P, 5, 0.6), { tone: "lo" }));
  out.push(S(k.slabOf(k.insetPlan(postPlan, 2), 46, 16, P, 4, 0.4), { tone: "mid" }));

  // Upper Tube: Check-to-Play (Pharmacy -> MyPark, y = -36, z = 54)
  const upperRoute = G.fillet(
    [
      [-48, -36, 36],
      [-38, -36, 56],
      [38, -36, 56],
      [48, -36, 40],
    ],
    6,
    10,
    { P, tube: 2.6 },
  );
  auditShapes.push(A.tube(upperRoute, 2.6, { name: "o2o.checkToPlay" }));
  for (const part of tubePieces(upperRoute, 2.6, P, { maxLength: 32, caps: true })) {
    out.push(tubeSvg(part, { tone: "hi" }));
  }

  // Flange collars on Upper Tube
  const UF = G.frameOf([0, -36, 56], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (const s of [-28, 0, 28]) {
    out.push(S(G.disc(s - 1.4, s + 1.4, 4.4, UF, P), { tone: "mid" }));
    out.push(D(G.dotsOf(UF, s, 3.6, 8, P), { size: 0.38, tone: "hi" }));
  }

  // Upper Shuttle Canister (Check-to-Play capsule riding above upper tube)
  const upperShuttle = [];
  const US_F = G.frameOf([0, -36, 63], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  upperShuttle.push(S(G.solidOf([[-8, 2.2], [-6, 3.8], [6, 3.8], [8, 2.2]], US_F, P, { bevel: 0.3 }), { tone: "hi", lit: true }));
  upperShuttle.push(L(G.ribsOf(US_F, -4, 4, 3.8, 12, P, { seams: true }), { tone: "lo" }));
  out.push(`<g data-part="shuttle-upper" transform="${k.translateAlong(P, [-16, 0, 0])}">${upperShuttle.join("")}</g>`);

  // Upper Bridge Label Plate
  const upLabel = { x: -34, y: -44, w: 68, d: 14, r: 2 };
  out.push(S(k.slabOf(upLabel, 42, 3, P, 4, 0.3), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([0, -35.5], 45.2, P, "x"), "CHECK-TO-PLAY →", { size: 2.2, tone: "hi", anchor: "middle" }));

  // Lower Tube: Play-to-Care (MyPark -> Pharmacy, y = 24, z = 26)
  const lowerRoute = G.fillet(
    [
      [48, 24, 18],
      [36, 24, 30],
      [-36, 24, 30],
      [-48, 24, 18],
    ],
    6,
    10,
    { P, tube: 2.6 },
  );
  auditShapes.push(A.tube(lowerRoute, 2.6, { name: "o2o.playToCare" }));
  for (const part of tubePieces(lowerRoute, 2.6, P, { maxLength: 32, caps: true })) {
    out.push(tubeSvg(part, { tone: "mid" }));
  }

  // Flange collars on Lower Tube
  const LF = G.frameOf([0, 24, 30], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  for (const s of [-24, 0, 24]) {
    out.push(S(G.disc(s - 1.4, s + 1.4, 4.4, LF, P), { tone: "mid" }));
    out.push(D(G.dotsOf(LF, s, 3.6, 8, P), { size: 0.38, tone: "hi" }));
  }

  // Lower Shuttle Canister (Play-to-Care capsule riding above lower tube)
  const lowerShuttle = [];
  const LS_F = G.frameOf([0, 24, 37], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  lowerShuttle.push(S(G.solidOf([[-8, 2.2], [-6, 3.8], [6, 3.8], [8, 2.2]], LS_F, P, { bevel: 0.3 }), { tone: "hi", lit: true }));
  lowerShuttle.push(L(G.ribsOf(LS_F, -4, 4, 3.8, 12, P, { seams: true }), { tone: "lo" }));
  out.push(`<g data-part="shuttle-lower" transform="${k.translateAlong(P, [16, 0, 0])}">${lowerShuttle.join("")}</g>`);

  // Lower Bridge Label Plate
  const loLabel = { x: -34, y: 34, w: 68, d: 14, r: 2 };
  out.push(S(k.slabOf(loLabel, 14, 3, P, 4, 0.3), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([0, 42.5], 17.2, P, "x"), "← PLAY-TO-CARE", { size: 2.2, tone: "hi", anchor: "middle" }));

  return out.join("");
}

// 4. Right Station: SmileSquare MyPark 1,800fps Simulator Bay & Swing Prescription Rig (28 solid parts)
function myparkStation() {
  const out = [];

  // Simulator Bay Turf Base Platform (back-right)
  const bayBase = { x: 46, y: -74, w: 116, d: 82, r: 5 };
  out.push(S(k.slabOf(bayBase, 0, 12, P, 6, 1.0), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(bayBase, 3.5), 12, P), { tone: "lo" }));

  // Back Screen Wall & Impact Projection Frame
  const screenWall = { x: 50, y: -72, w: 108, d: 12, r: 2.5 };
  out.push(S(k.slabOf(screenWall, 12, 68, P, 5, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 56, y: -64, w: 96, d: 4.5, r: 1.5 }, 18, 54, P, 4, 0.4), { tone: "hi" }));

  // Overhead 1,800fps High-Speed Vision Camera Bar
  const camBar = { x: 62, y: -58, w: 84, d: 14, r: 2.5 };
  out.push(S(k.slabOf(camBar, 80, 7, P, 4, 0.5), { tone: "hi" }));
  for (const cx of [78, 104, 130]) {
    out.push(S(k.cylinder(cx, -51, 3.4, 77, 3, P, 20), { tone: "mid" }));
    out.push(S(G.sphereOf([cx, -51, 76.5], 2.2, P), { tone: "hi", lit: true }));
  }
  out.push(k.faceTextSvg(k.topMatrix([104, -50], 87.2, P, "x"), "MYPARK 1,800fps VISION", { size: 2.1, tone: "hi", anchor: "middle" }));

  // Putting & Fairway Guide Lines on Turf Deck + Auto-Tee Plate & Park Golf Ball
  out.push(L(k.lineOnTop([104, -56], [104, 0], 12.1, P), { tone: "lo", dashed: true }));
  const stanceMat = { x: 64, y: -28, w: 42, d: 28, r: 2 };
  out.push(S(k.slabOf(stanceMat, 12, 2.2, P, 4, 0.3), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([85, -13], 14.3, P, "x"), "18H · 7,000원", { size: 2.1, tone: "hi", anchor: "middle" }));

  // Auto-Tee Cylinder & Park Golf Ball (G.sphereOf)
  out.push(S(k.cylinder(126, -16, 7.5, 12, 3.2, P, 28, 0.4), { tone: "mid" }));
  out.push(S(k.cylinder(126, -16, 2.2, 15.2, 3.0, P, 18), { tone: "hi", lit: true }));
  out.push(S(G.sphereOf([126, -16, 21.0], 3.6, P), { tone: "hi", lit: true }));

  // Front-Right Mechanical Swing-Arc & Club Grip Prescription Rig
  const rigBox = { x: 46, y: 12, w: 116, d: 56, r: 5 };
  out.push(S(k.slabOf(rigBox, 0, 18, P, 6, 0.9), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan(rigBox, 3), 18, 5, P, 5, 0.5), { tone: "hi" }));
  out.push(k.faceTextSvg(k.topMatrix([104, 21], 23.2, P, "x"), "SWING ARC & +2mm GRIP RIG", { size: 2.1, tone: "hi", anchor: "middle" }));

  // Swing-Arc Protractor Dial Drum at [82, 44]
  const [sx, sy] = [82, 44];
  const sz = 23;
  out.push(S(k.cylinder(sx, sy, 18, sz, 7, P, 48, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.ring(sx, sy, 15.5, sz + 7, P, 40), { tone: "lo" }));
  const ticks = k.radialTicks(sx, sy, 15.0, 28, 4, sz + 7, [1.2, 2.5], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([sx, sy - 5], sz + 7.2, P, "x"), "3/4 vs FULL", { size: 2.0, tone: "hi", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([sx, sy + 8], sz + 7.2, P, "x"), "SWING LIMIT", { size: 1.9, tone: "mid", anchor: "middle" }));
  out.push(S(k.cylinder(sx, sy, 2.0, sz + 7, 1.5, P, 18), { tone: "mid" }));
  out.push(
    `<path data-part="swing-needle" class="iso-line" data-tone="lit" data-free="start" d="${swingNeedleAt(ARCHETYPES[0].swingTurn)}" style="stroke-width:1.2"/>`,
  );

  // Club Grip Diameter Prescription Gauge Block at [134, 44]
  const gripRail = { x: 116, y: 31, w: 34, d: 26, r: 2.5 };
  out.push(S(k.slabOf(gripRail, 23, 3.5, P, 4, 0.4), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([133, 36.5], 26.7, P, "x"), "CLUB GRIP", { size: 2.0, tone: "hi", anchor: "middle" }));
  out.push(k.faceTextSvg(k.topMatrix([133, 53.5], 26.7, P, "x"), "+2mm THICK", { size: 1.9, tone: "mid", anchor: "middle" }));

  // Sliding Club Grip Caliper Boss
  const caliper = [];
  caliper.push(S(k.slabOf({ x: 122, y: 40, w: 14, d: 9, r: 1.5 }, 26.5, 4.5, P, 3, 0.3), { tone: "hi", lit: true }));
  caliper.push(S(k.cylinder(129, 44.5, 2.5, 31, 2.5, P, 18), { tone: "hi", lit: true }));
  out.push(`<g data-part="grip-caliper" transform="${k.translateAlong(P, [ARCHETYPES[0].gripShift, 0, 0])}">${caliper.join("")}</g>`);

  return out.join("");
}

function swingNeedleAt(turn) {
  const [sx, sy] = [82, 44];
  const topZ = 30.3;
  const angle = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return k.lineOnTop(
    [sx - Math.sin(angle) * 2.6, sy + Math.cos(angle) * 2.6],
    [sx + Math.sin(angle) * 14.2, sy - Math.cos(angle) * 14.2],
    topZ,
    P,
  );
}

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Smart Pharmacy Custom Supplement Dispenser and SmileSquare MyPark Screen Park Golf Check-to-Play / Play-to-Care O2O Platform. Six supplement hoppers on the left dispense personalized daily pouches and an 80mm QR receipt, while dual pneumatic O2O tubes exchange joint/grip prescriptions and 18-hole round fatigue data with the MyPark 1,800fps simulator bay on the right.",
  body: [basePlate(), pharmacyStation(), o2oPneumaticBridge(), myparkStation()],
});

const live = `
const P = ${JSON.stringify(P)};
const ARCHETYPES = ${JSON.stringify(ARCHETYPES)};
const HOPPERS = ${JSON.stringify(HOPPERS)};

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const gateEls = HOPPERS.map((_, i) => svg.querySelector('[data-gate="' + i + '"]'));
const pouchEl = svg.querySelector('[data-part="pouch"]');
const receiptEl = svg.querySelector('[data-part="receipt"]');
const upperShuttleEl = svg.querySelector('[data-part="shuttle-upper"]');
const lowerShuttleEl = svg.querySelector('[data-part="shuttle-lower"]');
const swingNeedleEl = svg.querySelector('[data-part="swing-needle"]');
const gripCaliperEl = svg.querySelector('[data-part="grip-caliper"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function swingNeedleAt(turn) {
  const sx = 82, sy = 44, topZ = 30.3;
  const angle = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  return lineOnTop(
    [sx - Math.sin(angle) * 2.6, sy + Math.cos(angle) * 2.6],
    [sx + Math.sin(angle) * 14.2, sy - Math.cos(angle) * 14.2],
    topZ,
    P
  );
}

let activeIdx = 0;
let gateHeights = HOPPERS.map((_, i) => (i === 0 || i === 3 ? 5.5 : 0));
let swingTurn = ARCHETYPES[0].swingTurn;
let gripShift = ARCHETYPES[0].gripShift;
let shuttlePhase = 0;
let frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idleTimer = 0;

function draw() {
  const arch = ARCHETYPES[activeIdx];
  gateEls.forEach((el, i) => {
    el.setAttribute("transform", translateAlong(P, [0, 0, gateHeights[i]]));
  });

  swingNeedleEl.setAttribute("d", swingNeedleAt(swingTurn));
  gripCaliperEl.setAttribute("transform", translateAlong(P, [gripShift, 0, 0]));

  // Smooth shuttle motion along Check-to-Play (upper) and Play-to-Care (lower) tubes
  const wave = Math.sin(shuttlePhase * Math.PI * 2) * 18;
  const upperX = arch.shuttleDir > 0 ? wave : -14;
  const lowerX = arch.shuttleDir < 0 ? -wave : 14;
  upperShuttleEl.setAttribute("transform", translateAlong(P, [upperX, 0, 0]));
  lowerShuttleEl.setAttribute("transform", translateAlong(P, [lowerX, 0, 0]));

  // Subtle dispense slide on pouch & receipt
  const slideY = 2 + Math.abs(Math.sin(shuttlePhase * Math.PI)) * 5.5;
  pouchEl.setAttribute("transform", translateAlong(P, [0, slideY, 0]));
  receiptEl.setAttribute("transform", translateAlong(P, [0, slideY, 0]));

  const text = arch.name + " → [" + arch.pack + "] · " + arch.mypark;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(activeIdx + 1));
  stage.setAttribute("aria-valuetext", text);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    clock += dt;
    activeIdx = Math.floor(clock / 3.6) % ARCHETYPES.length;
  }
  shuttlePhase = calm ? 0.25 : (shuttlePhase + dt * 0.45) % 1;

  const arch = ARCHETYPES[activeIdx];
  let settled = !touring && calm;
  HOPPERS.forEach((_, i) => {
    const want = arch.hoppers.includes(i) ? 5.8 : 0;
    gateHeights[i] = calm ? want : gateHeights[i] + (want - gateHeights[i]) * (1 - Math.exp(-dt / 0.16));
    if (Math.abs(want - gateHeights[i]) < 0.02) gateHeights[i] = want;
    else settled = false;
  });

  swingTurn = calm ? arch.swingTurn : swingTurn + (arch.swingTurn - swingTurn) * (1 - Math.exp(-dt / 0.2));
  gripShift = calm ? arch.gripShift : gripShift + (arch.gripShift - gripShift) * (1 - Math.exp(-dt / 0.2));

  draw();
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const selectArchetype = (idx) => {
  touring = false;
  activeIdx = clamp(idx, 0, ARCHETYPES.length - 1);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { touring = !still.matches; clock = activeIdx * 3.6; run(); }, 5000);
  run();
};

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.12) / 0.76, 0, 0.999);
  selectArchetype(Math.floor(share * ARCHETYPES.length));
});

stage.addEventListener("keydown", (event) => {
  if (event.key >= "1" && event.key <= "4") {
    event.preventDefault();
    selectArchetype(Number(event.key) - 1);
  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    selectArchetype((activeIdx + 1) % ARCHETYPES.length);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    selectArchetype((activeIdx + ARCHETYPES.length - 1) % ARCHETYPES.length);
  }
});

draw();
`;

const body = k.plateHtml({
  fig: "Fig 10",
  title: "Smart Pharmacy Supplement Dispenser × MyPark O2O Platform",
  hint: "Hover or press 1 · 2 · 3 · 4 to switch customer O2O archetypes",
  readout: `${ARCHETYPES[0].name} → [${ARCHETYPES[0].pack}] · ${ARCHETYPES[0].mypark}`,
  keys: [
    { mark: "lit", label: "Active supplement hopper gates, daily pouch, O2O pneumatic shuttles & MyPark swing/grip rig" },
    { mark: "raised", label: "Left: 6-Hopper Pharmacy Dispenser · Center: Check-to-Play / Play-to-Care Tubes · Right: MyPark 1,800fps Bay" },
  ],
  caption:
    "약국 맞춤형 건기식 소분 디스펜서 × 스마일스퀘어 마이파크(MyPark) Check-to-Play / Play-to-Care O2O 순환 플랫폼. 좌측 약국 스테이션의 6종 건기식 호퍼(단백질·류신, 코엔자임Q10·오메가3, 마그네슘·테아닌, MSM·콘드로이친, 포스파티딜세린, 항산화·비타민D)가 32종 생체지표 결핍에 맞춰 일일 소분 팩과 80mm O2O 처방전을 배출합니다. 중앙 상단 공압관(Check-to-Play)은 반경 1km 내 마이파크 스크린 파크골프장(기본 게임비 1인 18홀 7,000원)으로 관절 가동범위·악력 맞춤 스윙 아크(3/4 스윙)와 굵은 그립(+2mm) 클럽 가이드를 전송하고, 하단 공압관(Play-to-Care)은 마이파크 제1회 챔피언쉽 마스터즈 대회(2026.10.17~12.19, 앱 회원 참가비 무료·매장 이용료 별도) 및 일반 18홀 라운드 완주 후 운동 피로도 데이터를 약국으로 역전송하여 재방문 영양 케어 선순환을 완성합니다.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Smart Pharmacy and MyPark O2O Platform: press 1 to 4 to inspect customer archetypes" aria-valuemin="1" aria-valuemax="4" aria-valuenow="1">${svg}</div>`,
});

const outName = theme === "light" ? "fig-10-light.html" : "fig-10.html";
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Fig 10 · Smart Pharmacy × MyPark O2O Platform", theme, body, script: kitScript() + live, width: 820 }));
console.log("wrote", outName, `(${auditShapes.length} audited core assemblies)`);

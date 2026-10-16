import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as A from "../../kit/audit.mjs";
import { turning } from "../../kit/turn-build.mjs";
import { turnScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const theme = argv.includes("--light") ? "light" : "dark";

const WIDTH = 680;
const HEIGHT = 500;
const AZIMUTH = 38;
const ELEVATION = 29;

const BASE = { x: -96, y: -92, w: 192, d: 184, r: 9 };
const BASE_H = 12;
const FOOT_H = 5;

const TURN_R = 54;
const SKIRT_Z0 = 0.2;
const SKIRT_Z1 = 9.0;
const DECK_Z = 12.0;
const DECK_R = 50;
const HUB_Z = 14.5;
const HUB_R = 16;

export const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [-45, -45, 118], [45, 45, 118]],
  WIDTH,
  HEIGHT,
  { pad: 24, azimuth: AZIMUTH, elevation: ELEVATION },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

const frameOf = (o, a, u) => {
  const axis = G.unit3(a);
  const uu = u ? G.unit3(G.sub3(u, G.mul3(axis, G.dot3(u, axis)))) : G.frameAlong(o, axis).u;
  return { o, a: axis, u: uu, v: G.cross3(axis, uu) };
};

export const R = A.recorder(P);
const put = (item) =>
  R.put({
    ...item,
    shapes: item.shapes.map((shape, index) =>
      R.solid(Object.assign(shape, { name: shape.name ?? (index ? `${item.name}#${index + 1}` : item.name) })),
    ),
  });

function buildStaticBase() {
  for (const [x, y] of byDepth(k.corners(BASE, 22))) {
    const svg =
      S(k.cylinder(x, y, 7.5, -BASE_H - FOOT_H, 1.8, P, 28), { tone: "lo" }) +
      S(k.cylinder(x, y, 5.8, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" });
    put({
      name: `stand.foot.${x}.${y}`,
      layer: "back",
      at: [x, y, -BASE_H - FOOT_H],
      svg,
      shapes: [
        A.cylinder(x, y, 7.5, -BASE_H - FOOT_H, 1.8, { ground: true }),
        A.cylinder(x, y, 5.8, -BASE_H - FOOT_H + 1.8, FOOT_H - 1.8),
      ],
    });
  }

  const screws = k.corners(BASE, 8);
  const strip = { x: -78, y: BASE.y + BASE.d - 13, w: 156, d: 6.5, r: 1.2 };
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0, [1.8, 3.4], P);

  const baseSvg = [
    S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), {
      tone: "mid",
      inner: L(k.sideSeam(BASE, -BASE_H + 4, P, 8), { tone: "faint" }),
    }),
    L(k.planOutline(k.insetPlan(BASE, 4.5), 0, P), { tone: "faint" }),
    L(screws.map(([x, y]) => k.ring(x, y, 2.3, 0, P, 16)).join(""), { tone: "lo" }),
    D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.52 }),
    L(k.ring(0, 0, TURN_R + 3.2, 0, P, 64), { tone: "faint" }),
    L(ticks.minor, { tone: "lo" }),
    L(ticks.major, { tone: "mid" }),
    k.faceTextSvg(k.topMatrix([-66, BASE.y + 10], 0, P, "x"), "CONNECT 3D ROM + AFE4300 COP BENCH", {
      size: 3.1,
      tone: "mid",
      anchor: "start",
    }),
    k.faceTextSvg(k.topMatrix([66, BASE.y + 10], 0, P, "x"), "360° TURNTABLE", {
      size: 3.0,
      tone: "lo",
      anchor: "end",
    }),
  ].join("");

  put({
    name: "stand.base",
    layer: "back",
    at: [0, 0, -BASE_H],
    bias: 4,
    svg: baseSvg,
    shapes: [A.slab(BASE, -BASE_H, BASE_H, { ground: true })],
  });

  // Front index pointer wedge on the base (z <= 0.15 so it stays below turntable SKIRT_Z0 = 0.2)
  const idxAngle = ((AZIMUTH + 180) * Math.PI) / 180;
  const ca = Math.cos(idxAngle);
  const sa = Math.sin(idxAngle);
  const wedge = [
    [TURN_R + 2.5, -1.1],
    [TURN_R + 2.5, 1.1],
    [TURN_R + 9.5, 3.0],
    [TURN_R + 9.5, -3.0],
  ].map(([r, t]) => [ca * r - sa * t, sa * r + ca * t]);
  const wedgeSvg = S(k.extrude(wedge, -1.8, 1.9, P, { bevel: 0.35 }), { tone: "hi", lit: true });
  put({
    name: "stand.index",
    layer: "back",
    at: [ca * (TURN_R + 5), sa * (TURN_R + 5), -1.8],
    svg: `<g data-mat="brass">${wedgeSvg}</g>`,
    shapes: [A.extruded(wedge, -1.8, 1.9)],
  });

  // Rear calibration reference post (strictly behind the turntable cylinder along camera view vector)
  const postX = -68;
  const postY = -58;
  const postBase = { x: postX - 8, y: postY - 8, w: 16, d: 16, r: 2.5 };
  const postSvg = [
    S(k.slabOf(postBase, 0, 6, P, 4, 0.6), { tone: "mid" }),
    S(k.cylinder(postX, postY, 3.2, 6, 86, P, 24), { tone: "mid", crease: "none" }),
    S(k.cylinder(postX, postY, 4.4, 92, 3.5, P, 24), { tone: "hi" }),
    S(k.slabOf({ x: postX - 5, y: postY - 5, w: 10, d: 10, r: 1.8 }, 54, 7, P, 3, 0.4), { tone: "mid" }),
    S(k.cylinder(postX + 6, postY, 2.2, 55.5, 4, P, 18), { tone: "hi", lit: true }),
    D([at([postX - 5, postY - 5, 6]), at([postX + 5, postY + 5, 6]), at([postX, postY, 95.5])], { size: 0.48 }),
  ].join("");
  put({
    name: "stand.goniometer.post",
    layer: "back",
    at: [postX, postY, 0],
    svg: postSvg,
    shapes: [
      A.slab(postBase, 0, 6),
      A.cylinder(postX, postY, 3.2, 6, 86),
      A.cylinder(postX, postY, 4.4, 92, 3.5),
    ],
  });
}

export const T = turning(P, { recorder: R });

// Root 3D turntable group + child hinged biomechanical groups
const turntable = T.group("turntable", { turn: { pivot: [0, 0] } });
const neck = T.group("neck", {
  parent: turntable,
  hinge: { point: [0, 0, 74], axis: [0, 1, 0], range: [-5, 32] },
});
const armR = T.group("armR", {
  parent: turntable,
  hinge: { point: [0, -18.5, 66], axis: [1, 0, 0], range: [-175, 10] },
});
const armL = T.group("armL", {
  parent: turntable,
  hinge: { point: [0, 18.5, 66], axis: [1, 0, 0], range: [-175, 10] },
});

const deckLayer = T.layer("deck");
const dummyLayer = T.layer("dummy");
T.stack(["back", "deck", "dummy", "front"]);

export const follow = (values) => ({
  turntable: values.turntable ?? 0,
  neck: values.neck ?? 4,
  armR: values.armR ?? -155,
  armL: values.armL ?? -155,
});

export const poses = () => {
  const out = [];
  const states = [
    { neck: 3, armR: -168, armL: -168 },
    { neck: 24, armR: -118, armL: -166 },
    { neck: 8, armR: -92, armL: -92 },
    { neck: 0, armR: 0, armL: 0 },
  ];
  for (let deg = 0; deg < 360; deg += 15) {
    const s = states[(deg / 15) % states.length];
    out.push(follow({ turntable: deg, ...s }));
  }
  return out;
};

// --- LAYER 1: DECK (z in [0.2, 14.5]) ---
const tickPath = (angle, from, to) =>
  `M${(Math.sin(angle) * from).toFixed(3)} ${(-Math.cos(angle) * from).toFixed(3)}L${(Math.sin(angle) * to).toFixed(3)} ${(-Math.cos(angle) * to).toFixed(3)}`;
const ringPath = (r, steps) =>
  Array.from(
    { length: steps },
    (_, j) =>
      `${j ? "L" : "M"}${(r * Math.cos((j / steps) * Math.PI * 2)).toFixed(3)} ${(r * Math.sin((j / steps) * Math.PI * 2)).toFixed(3)}`,
  ).join("") + "Z";

const deckFaceMarkup = () => {
  const rim = DECK_R - 1.2;
  const minor = [];
  const major = [];
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    (i % 6 ? minor : major).push(tickPath(angle, rim - (i % 6 ? 1.5 : 3.0), rim));
  }
  const numerals = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const r = rim - 6.2;
    return `<text class="iso-face-text" data-tone="lo" font-size="3.1" text-anchor="middle" transform="translate(${(Math.sin(angle) * r).toFixed(3)} ${(-Math.cos(angle) * r).toFixed(3)}) rotate(${(i * 30).toFixed(1)}) translate(0 1.1)">${i * 30}°</text>`;
  }).join("");
  const crosshairs = `M-${(DECK_R - 10).toFixed(1)} 0L${(DECK_R - 10).toFixed(1)} 0M0 -${(DECK_R - 10).toFixed(1)}L0 ${(DECK_R - 10).toFixed(1)}`;
  return [
    `<path class="iso-line" data-tone="lo" d="${ringPath(rim, 140)}"/>`,
    `<path class="iso-line" data-tone="lo" d="${minor.join("")}"/>`,
    `<path class="iso-line" data-tone="mid" d="${major.join("")}"/>`,
    `<path class="iso-line" data-tone="faint" d="${ringPath(31, 100)}${crosshairs}"/>`,
    numerals,
  ].join("");
};

T.round({
  name: "deck.skirt",
  group: turntable,
  layer: deckLayer,
  F: VERT(0, 0),
  s0: SKIRT_Z0,
  s1: SKIRT_Z1,
  r: TURN_R,
  tone: "hi",
  crease: "lo",
  material: "gunmetal",
  details: {
    ribs: { s0: SKIRT_Z0 + 1.0, s1: SKIRT_Z1 - 0.8, count: 132, fade: [0.08, 0.5], seams: true, tone: "lo" },
  },
});

const deckBevel = T.round({
  name: "deck.bevel",
  group: turntable,
  layer: deckLayer,
  F: VERT(0, 0),
  s0: SKIRT_Z1,
  s1: DECK_Z,
  r: [TURN_R, DECK_R],
  tone: "hi",
  crease: "lo",
  material: "steel",
});

T.plane({
  part: deckBevel,
  o: [0, 0, DECK_Z],
  u: [1, 0, 0],
  v: [0, 1, 0],
  svg: deckFaceMarkup(),
  fade: [0.04, 0.3],
});

// Center hub & 4 Corner Load-Cell + BIA Pucks on Deck (z in [DECK_Z, HUB_Z])
T.round({
  name: "deck.hub",
  group: turntable,
  layer: deckLayer,
  F: VERT(0, 0),
  s0: DECK_Z,
  s1: HUB_Z,
  r: HUB_R,
  tone: "mid",
  material: "chrome",
  details: {
    seams: [DECK_Z + 0.8],
    bolts: [{ s: HUB_Z, r: 12.5, count: 6, size: 0.48, phase: 0.3 }],
  },
});

const PUCKS = [
  ["fl", 21, 18],
  ["fr", 21, -18],
  ["bl", -21, 18],
  ["br", -21, -18],
];
for (const [id, px, py] of PUCKS) {
  T.round({
    name: `deck.puck.${id}`,
    group: turntable,
    layer: deckLayer,
    F: VERT(px, py),
    s0: DECK_Z,
    s1: HUB_Z,
    r: 6.2,
    tone: "hi",
    material: "chrome",
    details: {
      seams: [DECK_Z + 0.9],
      bolts: [{ s: HUB_Z, r: 3.6, count: 4, size: 0.42, phase: 0.78 }],
    },
  });
}

// Front AFE4300 CoP Sensor Module mounted on the deck at x = 31 (well clear of pucks and hub)
T.prism({
  name: "deck.afe4300",
  group: turntable,
  layer: deckLayer,
  plan: { x: 24, y: -7.5, w: 11, d: 15, r: 1.5 },
  z: DECK_Z,
  h: HUB_Z - DECK_Z,
  bevel: 0.35,
  tone: "hi",
  material: "brass",
  lit: true,
});

// --- LAYER 2: BIOMECHANICAL ARTICULATED DUMMY (strictly z >= 14.6 > HUB_Z = 14.5) ---
const DUMMY_Z0 = 14.6;

// Left & Right Foot Plates + Ankle Load Columns + Lower & Upper Legs
for (const [side, sy] of [
  ["R", -9.5],
  ["L", 9.5],
]) {
  // Foot sole block on turntable
  T.prism({
    name: `dummy.foot.${side}`,
    group: turntable,
    layer: dummyLayer,
    plan: { x: -7.5, y: sy - 4.2, w: 17, d: 8.4, r: 1.8 },
    z: DUMMY_Z0,
    h: 3.4,
    bevel: 0.4,
    tone: "mid",
    material: "steel",
  });
  // Ankle joint cylinder
  T.round({
    name: `dummy.ankle.${side}`,
    group: turntable,
    layer: dummyLayer,
    F: VERT(-1.5, sy),
    s0: 18.1,
    s1: 21.5,
    r: 3.5,
    tone: "hi",
    material: "brass",
  });
  // Tibia / lower leg column
  T.round({
    name: `dummy.tibia.${side}`,
    group: turntable,
    layer: dummyLayer,
    F: VERT(-1.0, sy),
    s0: 21.6,
    s1: 33.4,
    r: 3.0,
    tone: "hi",
    material: "chrome",
    details: { seams: [24.0, 31.0] },
  });
  // Knee spherical joint
  T.round({
    name: `dummy.knee.${side}`,
    group: turntable,
    layer: dummyLayer,
    F: VERT(-0.5, sy),
    s0: 33.5,
    s1: 37.2,
    r: 3.8,
    tone: "mid",
    material: "brass",
    details: { seams: [35.3] },
  });
  // Femur / upper leg column
  T.round({
    name: `dummy.femur.${side}`,
    group: turntable,
    layer: dummyLayer,
    F: VERT(0, sy),
    s0: 37.3,
    s1: 48.8,
    r: 3.4,
    tone: "hi",
    material: "gold",
    details: { seams: [39.5, 46.5] },
  });
}

// Pelvis Assembly (z in [49.0, 55.2])
T.prism({
  name: "dummy.pelvis",
  group: turntable,
  layer: dummyLayer,
  plan: { x: -6.5, y: -14.0, w: 13.0, d: 28.0, r: 2.6 },
  z: 49.0,
  h: 6.2,
  bevel: 0.6,
  tone: "hi",
  crease: "lo",
  material: "gunmetal",
  details: {
    seams: [52.1],
    dots: [
      { at: [55.2, -4.0, -11.0], normal: [0, 0, 1], size: 0.45 },
      { at: [55.2, 4.0, -11.0], normal: [0, 0, 1], size: 0.45 },
      { at: [55.2, -4.0, 11.0], normal: [0, 0, 1], size: 0.45 },
      { at: [55.2, 4.0, 11.0], normal: [0, 0, 1], size: 0.45 },
    ],
  },
});

// Lumbar Spine Column (z in [55.3, 60.0])
T.round({
  name: "dummy.lumbar",
  group: turntable,
  layer: dummyLayer,
  F: VERT(0, 0),
  s0: 55.3,
  s1: 60.0,
  r: 4.8,
  tone: "mid",
  material: "chrome",
  details: { seams: [56.8, 58.4] },
});

// Thoracic Torso Block (z in [60.1, 72.8])
T.prism({
  name: "dummy.thorax",
  group: turntable,
  layer: dummyLayer,
  plan: { x: -7.5, y: -15.0, w: 15.0, d: 30.0, r: 3.0 },
  z: 60.1,
  h: 12.7,
  bevel: 0.8,
  tone: "hi",
  crease: "lo",
  material: "gold",
  details: {
    seams: [64.2, 68.8],
    dots: [
      { at: [66.5, 7.5, -10.5], normal: [1, 0, 0], size: 0.5 },
      { at: [66.5, 7.5, 10.5], normal: [1, 0, 0], size: 0.5 },
      { at: [72.8, -4.5, -11.5], normal: [0, 0, 1], size: 0.48 },
      { at: [72.8, 4.5, -11.5], normal: [0, 0, 1], size: 0.48 },
      { at: [72.8, -4.5, 11.5], normal: [0, 0, 1], size: 0.48 },
      { at: [72.8, 4.5, 11.5], normal: [0, 0, 1], size: 0.48 },
    ],
  },
});

// C7 Cervical Base Collar (z in [72.9, 74.6])
T.round({
  name: "dummy.c7.collar",
  group: turntable,
  layer: dummyLayer,
  F: VERT(0, 0),
  s0: 72.9,
  s1: 74.6,
  r: 4.6,
  tone: "mid",
  material: "brass",
});

// --- HINGED NECK & HEAD ASSEMBLY (group: neck, pivot at [0, 0, 74], axis [0, 1, 0]) ---
// Built in upright frame at rest, tilts forward (+X) when neck angle > 0 (CVA Turtle-Neck simulation)
const NECK_F = frameOf([0, 0, 74], [0, 0, 1], [1, 0, 0]);
T.round({
  name: "neck.column",
  group: neck,
  layer: dummyLayer,
  F: NECK_F,
  s0: 1.0,
  s1: 7.4,
  r: 3.1,
  fixed: false,
  tone: "hi",
  material: "chrome",
  details: { seams: [2.8, 5.2] },
});

T.prism({
  name: "head.cranium",
  group: neck,
  layer: dummyLayer,
  F: NECK_F,
  polygon: [
    [-5.8, -5.6],
    [6.6, -5.6],
    [6.6, 5.6],
    [-5.8, 5.6],
  ],
  round: 2.2,
  s0: 7.6,
  s1: 18.6,
  bevel: 0.7,
  tone: "hi",
  crease: "lo",
  material: "gold",
  details: {
    seams: [11.5, 15.5],
    dots: [
      { at: [13.5, 6.6, -2.8], normal: [1, 0, 0], size: 0.52 },
      { at: [13.5, 6.6, 2.8], normal: [1, 0, 0], size: 0.52 },
    ],
  },
});

// Visor / Tragus CVA Target Marker on front of head (lit)
T.prism({
  name: "head.visor",
  group: neck,
  layer: dummyLayer,
  F: NECK_F,
  polygon: [
    [6.7, -4.4],
    [8.4, -4.4],
    [8.4, 4.4],
    [6.7, 4.4],
  ],
  round: 0.6,
  s0: 11.8,
  s1: 15.2,
  bevel: 0.3,
  tone: "hi",
  material: "brass",
  lit: true,
});

// --- HINGED LEFT & RIGHT SHOULDER-ARM ASSEMBLIES (groups: armR, armL) ---
// Pivot at [0, ±18.5, 66], axis [1, 0, 0]. At rest (angle=0), arm hangs straight down (-Z).
// When angle = -90°, arm extends horizontally outward (±Y). When angle = -170°, arm raises overhead (+Z)!
for (const [side, grp, sy] of [
  ["R", armR, -18.5],
  ["L", armL, 18.5],
]) {
  const ARM_F = frameOf([0, sy, 66], [0, 0, -1], [1, 0, 0]);
  // Shoulder glenoid hub
  T.round({
    name: `arm.${side}.shoulder`,
    group: grp,
    layer: dummyLayer,
    F: ARM_F,
    s0: -2.8,
    s1: 2.8,
    r: 3.4,
    fixed: false,
    tone: "hi",
    material: "brass",
    lit: true,
  });
  // Humerus / upper arm segment
  T.round({
    name: `arm.${side}.humerus`,
    group: grp,
    layer: dummyLayer,
    F: ARM_F,
    s0: 3.0,
    s1: 16.2,
    r: 2.5,
    fixed: false,
    tone: "hi",
    material: "gold",
    details: { seams: [5.5, 13.5] },
  });
  // Elbow joint drum
  T.round({
    name: `arm.${side}.elbow`,
    group: grp,
    layer: dummyLayer,
    F: ARM_F,
    s0: 16.4,
    s1: 19.6,
    r: 2.9,
    fixed: false,
    tone: "mid",
    material: "chrome",
  });
  // Forearm segment
  T.round({
    name: `arm.${side}.forearm`,
    group: grp,
    layer: dummyLayer,
    F: ARM_F,
    s0: 19.8,
    s1: 31.4,
    r: 2.2,
    fixed: false,
    tone: "hi",
    material: "steel",
    details: { seams: [22.0, 29.0] },
  });
  // Hand / Grip Target Sensor (lit)
  T.round({
    name: `arm.${side}.hand`,
    group: grp,
    layer: dummyLayer,
    F: ARM_F,
    s0: 31.6,
    s1: 36.2,
    r: 2.6,
    ends: ["flat", "dome"],
    fixed: false,
    tone: "hi",
    material: "brass",
    lit: true,
  });
}

buildStaticBase();
const out = T.build({ statics: R.items, poses });
A.settle(R, P);

const layerOf = (name) =>
  R.items
    .filter((item) => item.layer === name)
    .sort((a, b) => a.key - b.key)
    .map((item) => item.svg);

const BACK = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`, ...layerOf("back")];
const FRONT = layerOf("front");

const LABEL =
  "A 360-degree rotating biomechanical test turntable with four corner load-cell and BIA electrode pucks and an articulated metal test mannequin. Dragging horizontally turns the entire platform and mannequin in true 3D; cycling posture states articulates the left and right shoulder-arm hinges from 0 to 172 degrees and tilts the cervical neck hinge to measure Craniovertebral Angle (CVA) and Center-of-Pressure balance.";

const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: BACK });
const staticSvg = (list) =>
  list.length
    ? `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${list.join("")}</svg>`
    : "";

const stage = `<div class="iso-stage iso-turn rom-stage" tabindex="0" role="slider" aria-label="3D Biomechanical ROM & Balance Turntable: drag horizontally to rotate 360 degrees in 3D, press 1, 2, or 3 or drag vertically to switch clinical posture states" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0" aria-valuetext="State 1 Normal ROM">${backSvg}${out.layerSvg("deck", { width: WIDTH, height: HEIGHT })}${out.layerSvg("dummy", { width: WIDTH, height: HEIGHT })}${staticSvg(FRONT)}</div>`;

const CSS = `
${out.css}
.rom-stage {
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.rom-stage[data-drag] {
  cursor: grabbing;
}
`;

const LIVE = `
const DATA = ${JSON.stringify({ turn: out.data })};
const follow = ${follow.toString()};
const stage = document.querySelector(".rom-stage");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const STATES = [
  {
    id: 1,
    name: "정상 가동범위 (Normal Overhead)",
    armR: -172,
    armL: -172,
    neck: 3,
    romLabel: "좌 172° / 우 172°",
    cva: "54.2° (정상)",
    sway: "1.6 cm/s (안정)",
    rula: "RULA 1점 · 백스윙 회전 우수",
  },
  {
    id: 2,
    name: "우측 오십견 & 거북목 (Frozen Shoulder + CVA)",
    armR: -134,
    armL: -168,
    neck: 24,
    romLabel: "우 134° (-22% 제한) / 좌 168°",
    cva: "42.8° (거북목 경추부하 18kg)",
    sway: "2.3 cm/s (전방 쏠림)",
    rula: "RULA 5점 · 우측 회전근개 스트레칭 권고",
  },
  {
    id: 3,
    name: "외발서기 낙상 위험 검사 (Single-Leg CoP Sway)",
    armR: -94,
    armL: -88,
    neck: 9,
    romLabel: "수평 균형 외전 91°",
    cva: "50.5° (양호)",
    sway: "3.9 cm/s (낙상 주의 >3.4cm/s)",
    rula: "RULA 3점 · 하체 코어/발목 균형 강화 권고",
  },
];

let angle = 18;
let targetAngle = 18;
let stateIdx = 0;
let curArmR = STATES[0].armR;
let curArmL = STATES[0].armL;
let curNeck = STATES[0].neck;
let touring = !still.matches;
let clock = 0;
let last = 0;
let frame = 0;
let visible = false;
let idle = 0;
let own = false;

const formatReadout = () => {
  const s = STATES[stateIdx];
  const deg = ((( Math.round(angle) % 360) + 360) % 360);
  const romR = Math.round(Math.abs(curArmR));
  const cvaVal = (56 - curNeck * 0.55).toFixed(1);
  return \`[\${s.id}/3 \${s.name.split(" ")[0]}] 3D 회전 \${deg}° · 우측 어깨 ROM \${romR}° · CVA \${cvaVal}° · CoP \${s.sway} · \${s.rula}\`;
};

const controller = TURN.mount(stage, DATA.turn, {
  follow,
  onHold: () => {
    touring = false;
    clearTimeout(idle);
  },
  onFrame: () => {
    const text = formatReadout();
    if (readout && readout.textContent !== text) readout.textContent = text;
  },
});

const draw = () => {
  own = true;
  controller.set({
    turntable: angle,
    armR: curArmR,
    armL: curArmL,
    neck: curNeck,
  });
  own = false;
  const deg = (((Math.round(angle) % 360) + 360) % 360);
  stage.setAttribute("aria-valuenow", String(deg));
  stage.setAttribute("aria-valuetext", formatReadout());
};

const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    run();
  }, 4200);
};

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (calm) {
    touring = false;
    clearTimeout(idle);
  }
  if (touring) {
    clock += dt;
    targetAngle += 16 * dt;
    stateIdx = Math.floor(clock / 4.2) % STATES.length;
  }
  const want = STATES[stateIdx];
  const rate = 1 - Math.exp(-dt / 0.16);
  angle = calm ? targetAngle : angle + (targetAngle - angle) * (1 - Math.exp(-dt / 0.12));
  curArmR = calm ? want.armR : curArmR + (want.armR - curArmR) * rate;
  curArmL = calm ? want.armL : curArmL + (want.armL - curArmL) * rate;
  curNeck = calm ? want.neck : curNeck + (want.neck - curNeck) * rate;

  if (Math.abs(targetAngle - angle) < 0.01) angle = targetAngle;
  if (Math.abs(want.armR - curArmR) < 0.02) curArmR = want.armR;
  if (Math.abs(want.armL - curArmL) < 0.02) curArmL = want.armL;
  if (Math.abs(want.neck - curNeck) < 0.02) curNeck = want.neck;

  draw();
  const settled =
    !touring &&
    angle === targetAngle &&
    curArmR === want.armR &&
    curArmL === want.armL &&
    curNeck === want.neck;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}

const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  },
  { rootMargin: "120px 0px" },
).observe(stage);

let drag = null;
stage.addEventListener("pointerdown", (event) => {
  hold();
  drag = {
    x0: event.clientX,
    y0: event.clientY,
    baseAngle: targetAngle,
    baseState: stateIdx,
    id: event.pointerId,
    captured: false,
  };
});

stage.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  hold();
  const dx = event.clientX - drag.x0;
  const dy = event.clientY - drag.y0;
  if (!drag.captured && Math.hypot(dx, dy) > 3) {
    drag.captured = true;
    stage.setPointerCapture(event.pointerId);
    stage.setAttribute("data-drag", "");
  }
  if (!drag.captured) return;
  targetAngle = drag.baseAngle + dx * 0.65;
  if (Math.abs(dy) > 28) {
    const step = Math.round(dy / 45);
    stateIdx = (((drag.baseState + step) % STATES.length) + STATES.length) % STATES.length;
  }
  run();
});

const release = (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.captured) {
    stateIdx = (stateIdx + 1) % STATES.length;
    run();
  }
  drag = null;
  stage.removeAttribute("data-drag");
  try {
    stage.releasePointerCapture(event.pointerId);
  } catch {}
};

stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

stage.addEventListener("keydown", (event) => {
  if (event.key === "1" || event.key === "2" || event.key === "3") {
    event.preventDefault();
    hold();
    stateIdx = Number(event.key) - 1;
    run();
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    hold();
    stateIdx = (stateIdx + (event.key === "ArrowDown" ? 1 : STATES.length - 1)) % STATES.length;
    run();
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    hold();
    targetAngle += event.key === "ArrowRight" ? 15 : -15;
    run();
  }
});

draw();
`;

const body = k.plateHtml({
  fig: "Fig 07 · 3D Mode",
  title: "3D 피지컬 AI — 360° 관절 가동범위(ROM) · 거북목(CVA) · 족저압 균형(CoP) 턴테이블",
  hint: "좌우 드래그: 360° 3D 회전 · 클릭 또는 숫자키 1·2·3 / 상하 화살표: 임상 자세 전환",
  readout: "[1/3 정상] 3D 회전 18° · 우측 어깨 ROM 172° · CVA 54.2° · CoP 1.6 cm/s · RULA 1점",
  keys: [
    { mark: "raised", label: "360° 회전 족저압/체성분 턴테이블 & 다관절 인체 더미 (TURN 3D Group)" },
    { mark: "lit", label: "어깨 외전 힌지(0~172°) · 경추 CVA 타겟 바이저 · AFE4300 CoP 센서" },
  ],
  caption:
    "2D RGB 카메라(MediaPipe 33 랜드마크 + RTMPose3D)와 하단 4점 로드셀(AFE4300)의 동기화 계측 원리: 피검자가 제자리에서 회전하거나 팔을 들어올릴 때 어깨 외전 가동범위(오십견 134° 제한 vs 정상 172°), 두개척추각(CVA 거북목 < 44°), 외발서기 압력중심 흔들림 속도(CoP Sway cm/s)를 동시 산출하여 RULA 근골격 부하 점수 및 파크골프 백스윙 가동성을 정밀 평가합니다.",
  body: `<style>${CSS}</style>${stage}`,
});

const page = k.pageHtml({
  title: "Fig 07 · 3D ROM, CVA & CoP Balance Turntable",
  theme,
  body,
  script: turnScript() + LIVE,
  width: 720,
});

const outName = `fig-07${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), page);
console.log(
  `wrote ${outName} · ${(page.length / 1024).toFixed(0)} KB · ${out.report.parts} parts · ${out.report.layers
    .map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`)
    .join(" · ")} · build ${out.report.seconds.toFixed(1)} s`,
);

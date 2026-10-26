/* ============================================================
   기억의 미궁 — sketch.js
   나선 계단을 끝없이 내려가며, 떠오른 생각을 '아리아드네의 실'로 묶어 두는 메모 공간.
   - 메모는 localStorage에 저장되어 창을 닫아도 남습니다.
   - 한 묶음(bundle)으로 묶은 생각들은 따로 따라가며 읽을 수 있습니다.
   ============================================================ */
"use strict";

/* ---------- 상수 ---------- */
const STORE_KEY = "ariadne-labyrinth-v1";
const DRAFT_KEY = "ariadne-labyrinth-draft";
const GAP = 64; // 계단 한 칸의 높이(px)
const DA = 0.52; // 계단 한 칸당 회전각(rad)
const FIRST = 5; // 첫 메모가 놓이는 계단 번호
const STRIDE = 4; // 메모 사이의 계단 칸 수
const BUNDLE_COLORS = [
  "#ff2d95",
  "#b45cff",
  "#ff8ad0",
  "#7a5cff",
  "#ffd1ea",
  "#e0309a",
  "#a0267f",
];

// 방(chamber)마다 바뀌는 색 팔레트 — 마녀의 미궁처럼 깊이에 따라 분위기가 변함
const PALETTES = [
  {
    top: "#07010c",
    bot: "#46093a",
    a: ["#ff2d95", "#c4167a", "#f3d9ec", "#7a1a66"],
  },
  {
    top: "#10031a",
    bot: "#58104e",
    a: ["#ff5fb8", "#9c1f7e", "#ead0e4", "#2e0828"],
  },
  {
    top: "#040006",
    bot: "#34072c",
    a: ["#d6168a", "#ff7ac8", "#f6e0f0", "#6b1a5a"],
  },
  {
    top: "#16031a",
    bot: "#650e46",
    a: ["#ff3a9a", "#b0156e", "#ffd6ee", "#3a0a30"],
  },
];

/* ---------- 상태 ---------- */
let state = loadState();
let W, H, SC, R, CX;
let scrollY = 0,
  scrollTarget = 0;
let spinOff = 0; // 생각 구름이 떠 있는 동안 계단이 혼자 천천히 도는 양
let spin = 0; // 나선 전체의 회전각(rad) — 스크롤에 끌려 돌아간다
const SPIN = 0.0045; // 스크롤 1px당 회전량
let threadEnd = 0; // 아리아드네의 실이 닿아 있는 계단(소수 가능)
const born = {}; // memoId -> 실이 닿아 매듭이 지어진 시각(ms)
let focus = null; // null | bundleId | '__none'
let focusIdx = 0;
let hitRects = [];
let hoverHit = null;
let pressInfo = null;
let overCanvas = false;
const edit = { id: null, bundle: null, open: false };

/* 생각 구름(입력/읽기)의 상태 — 글자는 캔버스 속 구름에 떠오른다 */
const view = {
  mode: null,
  kind: "edit",
  id: null,
  text: "",
  births: [],
  k: 0,
  th: 0,
  scroll: 0,
  scrollT: 0,
  from: { x: 0, y: 0 },
  cache: null,
  lastInput: -1e9,
  caret: { x: 0, y: 0 },
  geom: null,
  px: 0,
  py: 0,
  ps: 1,
  reserve: 190,
  measT: 0,
  shake: -1e9,
  hideCloud: false,
  col: null,
  curCol: null,
  lastG: null,
  lastLay: null,
  tp: 0,
  qHits: [],
};
let tyings = []; // 묶는 순간, 구름이 작아져 날아가는 연출 (여러 개가 순서대로)
const QUEUE_KEY = "ariadne-labyrinth-queue";
let queue = []; // 입력창 안에 쌓아 둔 생각들 — 빨랫줄에 걸린 작은 구름
let followId = null; // 여러 생각을 한꺼번에 묶을 때, 카메라가 실을 따라 내려간다
const sparks = [];
const cwCache = {};
let prevText = "";

/* ---------- 유틸 ---------- */
const $ = (id) => document.getElementById(id);
const mod = (a, m) => ((a % m) + m) % m;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const stepOf = (k) => FIRST + k * STRIDE;
const getBundle = (id) => (id ? state.bundles.find((b) => b.id === id) : null);
const two = (n) => String(n).padStart(2, "0");
function fmtDate(ts) {
  const d = new Date(ts);
  return (
    d.getFullYear() +
    "." +
    two(d.getMonth() + 1) +
    "." +
    two(d.getDate()) +
    " " +
    two(d.getHours()) +
    ":" +
    two(d.getMinutes())
  );
}
function snip(text) {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > 30 ? s.slice(0, 30) + "…" : s;
}
function easeOutBack(x) {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fc(hex, a) {
  const c = color(hex);
  c.setAlpha(a);
  return c;
}
// 하트 (아래쪽이 뾰족, 현재 fill 사용)
function heart(x, y, s) {
  beginShape();
  vertex(x, y + s * 0.6);
  bezierVertex(
    x - s * 1.0,
    y - s * 0.1,
    x - s * 0.55,
    y - s * 0.85,
    x,
    y - s * 0.25,
  );
  bezierVertex(
    x + s * 0.55,
    y - s * 0.85,
    x + s * 1.0,
    y - s * 0.1,
    x,
    y + s * 0.6,
  );
  endShape(CLOSE);
}

/* ---------- 저장 / 불러오기 ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.memos)) {
        return {
          memos: s.memos,
          bundles: Array.isArray(s.bundles) ? s.bundles : [],
          lastBundle: s.lastBundle || null,
        };
      }
    }
  } catch (e) {
    /* 무시 */
  }
  return { memos: [], bundles: [], lastBundle: null };
}
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    /* 용량/권한 문제 무시 */
  }
}

/* ---------- 레이아웃 ---------- */
function calcLayout() {
  W = width;
  H = height;
  SC = constrain(W / 1000, 0.62, 1.15);
  R = Math.min(250 * SC, W * 0.3);
  CX = W / 2;
}
function threadTarget() {
  const n = state.memos.length;
  return n > 0 ? stepOf(n - 1) + 1.5 : 2;
}
// 계단 번호(소수 가능) -> 화면 좌표/깊이
function posAt(f) {
  const a = f * DA + spin,
    z = Math.sin(a);
  return {
    x: CX + Math.cos(a) * R,
    y: f * GAP - scrollY + H * 0.3 + z * 26 * SC,
    z,
    s: 1 + z * 0.26,
    a,
  };
}
// 계단 번호 -> 앞뒤 깊이(z): 1이 가장 앞, -1이 가장 뒤
function zAt(f) {
  return Math.sin(f * DA + spin);
}
function scrollToMemo(mi) {
  scrollTarget = Math.max(0, stepOf(mi) * GAP - H * 0.3);
}

/* ============================================================
   p5 라이프사이클
   ============================================================ */
function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  c.parent("stage");
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  textFont('"Cormorant Garamond", "Nanum Myeongjo", serif');
  if (typeof textWrap === "function") textWrap(CHAR);
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('700 20px "Cormorant Garamond"', "Aa"),
      document.fonts.load('400 20px "Pinyon Script"', "Aa"),
      document.fonts.load('600 20px "Cinzel"', "XIVI"),
      document.fonts.load('700 20px "Nanum Myeongjo"', "가나다"),
    ])
      .then(() => {
        for (const k in cwCache) delete cwCache[k];
        view.cache = null;
      })
      .catch(() => {});
    document.fonts.load("600 14px Cinzel", "XIVI");
  }
  calcLayout();
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(() => {
      for (const k in cwCache) delete cwCache[k];
      view.cache = null;
    });
  state.memos.forEach((m) => {
    born[m.id] = -1e9;
  }); // 이미 묶여 있던 생각은 즉시 표시
  threadEnd = threadTarget();
  bindUI();
  renderDrawer();
  refreshFocusBar();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calcLayout();
}

function draw() {
  const t = millis() / 1000;
  updateScroll();
  updateThread();
  hitRects = [];
  drawBackground(t);
  drawWorld(t);
  drawVignette();
  drawHUD(t);
  drawOverlay(t);
  updateHover();
}

function updateScroll() {
  scrollY += (scrollTarget - scrollY) * 0.14;
  if (Math.abs(scrollTarget - scrollY) < 0.05) scrollY = scrollTarget;
  if (view.mode) spinOff += 0.0016;
  spin += (scrollY * SPIN + spinOff - spin) * 0.08; // 살짝 늦게 따라와서 멈춘 뒤에도 관성으로 돈다
}

function updateThread() {
  const target = threadTarget();
  if (threadEnd < target) {
    threadEnd = Math.min(
      target,
      threadEnd + Math.max(0.03, (target - threadEnd) * 0.04),
    );
  } else if (threadEnd > target) {
    threadEnd = target;
  }
  // 실이 닿은 순간 매듭 탄생
  for (let k = 0; k < state.memos.length; k++) {
    const id = state.memos[k].id;
    if (born[id] === undefined && threadEnd >= stepOf(k)) {
      born[id] = millis();
      if (followId) {
        scrollTarget = Math.max(0, stepOf(k) * GAP - H * 0.32);
        if (id === followId) followId = null;
      }
    }
  }
}

/* ============================================================
   배경 — 깊이에 따라 색이 바뀌고, 종이 오려붙인 듯한 모티프가 흐른다
   ============================================================ */
function drawBackground(t) {
  const cf = scrollY / 1500,
    c0 = Math.floor(cf),
    tt = cf - c0,
    e = tt * tt * (3 - 2 * tt);
  const p0 = PALETTES[mod(c0, PALETTES.length)],
    p1 = PALETTES[mod(c0 + 1, PALETTES.length)];
  const top = lerpColor(color(p0.top), color(p1.top), e);
  const bot = lerpColor(color(p0.bot), color(p1.bot), e);
  const ctx = drawingContext;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top.toString());
  g.addColorStop(1, bot.toString());
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  drawDecor(0, t);
  drawDecor(1, t);
  drawDecor(2, t);
}

function drawDecor(layer, t) {
  const par = [0.2, 0.45, 0.8][layer];
  const CH = [560, 520, 700][layer];
  const count = [5, 4, 2][layer];
  const off = scrollY * par;
  const c0 = Math.floor((off - 200) / CH),
    c1 = Math.floor((off + H + 200) / CH);
  for (let c = c0; c <= c1; c++) {
    const rnd = mulberry32(c * 7919 + layer * 104729 + 13);
    const pal = PALETTES[mod(Math.floor(c / 3), PALETTES.length)].a;
    for (let k = 0; k < count; k++) {
      const x = mod(rnd() * W + spin * [20, 45, 80][layer], W + 160) - 80;
      const y = c * CH + rnd() * CH - off;
      const size =
        (layer === 2 ? 70 + rnd() * 100 : 40 + rnd() * 130) * (0.7 + SC * 0.3);
      const type = Math.floor(rnd() * 11);
      const col = pal[Math.floor(rnd() * pal.length)];
      const sp = (rnd() - 0.5) * 0.4;
      let rot = rnd() * TWO_PI;
      rot =
        type === 8 || type === 0 || type === 9
          ? rot * 0.12 + sp * 0.2 * Math.sin(t)
          : rot + sp * t;
      drawMotif(type, x, y, size, col, rot, layer, t);
    }
  }
}

function drawMotif(type, x, y, s, col, rot, layer, t) {
  const al = [70, 110, 150][layer];
  push();
  translate(x, y);
  rotate(rot);
  noStroke();
  switch (type) {
    case 0: // 눈
      fill(fc("#fff7ea", al));
      ellipse(0, 0, s, s * 0.5);
      fill(fc(col, al + 60));
      circle(0, 0, s * 0.38);
      fill(10, 5, 25, al + 80);
      circle(0, 0, s * 0.16);
      break;
    case 1: // 삼각
      fill(fc(col, al));
      triangle(-s / 2, s / 3, s / 2, s / 3, 0, -s / 2);
      break;
    case 2: // 레이스 원
      noFill();
      stroke(fc(col, al + 40));
      strokeWeight(2);
      for (let k = 1; k <= 4; k++) circle(0, 0, (s * k) / 4);
      for (let k = 0; k < 12; k++) {
        rotate(TWO_PI / 12);
        line(s * 0.12, 0, s * 0.5, 0);
      }
      break;
    case 3: // 체크무늬
      fill(fc(col, al));
      for (let gx = 0; gx < 4; gx++)
        for (let gy = 0; gy < 4; gy++) {
          if ((gx + gy) % 2 === 0)
            rect(-s / 2 + (gx * s) / 4, -s / 2 + (gy * s) / 4, s / 4, s / 4);
        }
      break;
    case 4: // 꽃
      fill(fc(col, al));
      for (let k = 0; k < 8; k++) {
        rotate(TWO_PI / 8);
        ellipse(s * 0.28, 0, s * 0.34, s * 0.16);
      }
      fill(fc("#fff3c4", al + 40));
      circle(0, 0, s * 0.2);
      break;
    case 5: // 줄무늬
      fill(fc(col, al));
      for (let k = -2; k <= 2; k++)
        rect(-s / 2, k * s * 0.16 - s * 0.05, s, s * 0.1);
      break;
    case 6: {
      // 나비
      const fl = 0.45 + 0.55 * Math.abs(Math.sin(t * 3 + x));
      fill(fc(col, al + 30));
      push();
      scale(fl, 1);
      ellipse(s * 0.28, -s * 0.1, s * 0.5, s * 0.4);
      ellipse(s * 0.22, s * 0.18, s * 0.36, s * 0.3);
      pop();
      push();
      scale(-fl, 1);
      ellipse(s * 0.28, -s * 0.1, s * 0.5, s * 0.4);
      ellipse(s * 0.22, s * 0.18, s * 0.36, s * 0.3);
      pop();
      fill(10, 5, 25, al + 80);
      rect(-s * 0.02, -s * 0.2, s * 0.04, s * 0.45, 2);
      break;
    }
    case 7: // 톱니
      fill(fc(col, al));
      circle(0, 0, s * 0.7);
      for (let k = 0; k < 10; k++) {
        rotate(TWO_PI / 10);
        rect(s * 0.32, -s * 0.05, s * 0.12, s * 0.1);
      }
      fill(10, 5, 25, al);
      circle(0, 0, s * 0.28);
      break;
    case 8: // 작은 종이 인형
      fill(fc(col, al + 60));
      circle(0, -s * 0.32, s * 0.2);
      triangle(0, -s * 0.2, -s * 0.14, s * 0.2, s * 0.14, s * 0.2);
      stroke(fc(col, al + 60));
      strokeWeight(3);
      line(-s * 0.06, s * 0.2, -s * 0.09, s * 0.36);
      line(s * 0.06, s * 0.2, s * 0.09, s * 0.36);
      break;
    case 9: // 하트
      fill(fc(col, al + 50));
      heart(0, 0, s * 0.6);
      break;
    case 10: // 십자 수놓기
      stroke(fc(col, al + 60));
      strokeWeight(3);
      line(-s * 0.2, -s * 0.2, s * 0.2, s * 0.2);
      line(s * 0.2, -s * 0.2, -s * 0.2, s * 0.2);
      break;
  }
  pop();
}

function drawVignette() {
  const ctx = drawingContext;
  ctx.save();
  const m = Math.min(W, H);
  const g = ctx.createRadialGradient(
    W / 2,
    H / 2,
    m * 0.3,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.8,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(2,0,6,0.82)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 심장 박동처럼 가장자리가 은은하게 맥동
  const beat = Math.pow(Math.max(0, Math.sin((millis() / 1000) * 2.4)), 6);
  const g2 = ctx.createRadialGradient(
    W / 2,
    H / 2,
    m * 0.45,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  g2.addColorStop(0, "rgba(255,0,120,0)");
  g2.addColorStop(1, "rgba(255,0,120," + (0.05 + 0.12 * beat).toFixed(3) + ")");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/* ============================================================
   세계 — 나선 계단 / 중앙 기둥 / 아리아드네의 실 / 메모
   ============================================================ */
function drawWorld(t) {
  const n = state.memos.length;
  const i0 = Math.max(0, Math.floor((scrollY - H * 0.3) / GAP) - 3);
  const i1 = Math.ceil((scrollY + H * 0.7) / GAP) + 4;
  const items = [];
  for (let i = i0; i <= i1; i++) {
    items.push({ z: zAt(i), k: 0, i });
    if (i < threadEnd) items.push({ z: zAt(i + 0.5) + 0.0005, k: 1, i });
  }
  for (let mi = 0; mi < n; mi++) {
    const s = stepOf(mi);
    if (s < i0 - 3 || s > i1 + 3) continue;
    if (born[state.memos[mi].id] === undefined) continue;
    items.push({ z: zAt(s) + 0.001, k: 2, mi });
  }
  if (threadEnd >= threadTarget() - 0.001) {
    const sn = stepOf(n);
    if (sn >= i0 - 3 && sn <= i1 + 3) items.push({ z: zAt(sn) + 0.001, k: 3 });
  }
  items.push({ z: zAt(threadEnd) + 0.002, k: 4 });
  if (i0 === 0) items.push({ z: 0.0001, k: 5 });

  items.sort((a, b) => a.z - b.z);
  let split = items.findIndex((o) => o.z >= 0);
  if (split < 0) split = items.length;
  for (let q = 0; q < split; q++) drawItem(items[q], t);
  drawPillar(t);
  for (let q = split; q < items.length; q++) drawItem(items[q], t);
  drawBundleThreads(t);
}

function drawItem(o, t) {
  switch (o.k) {
    case 0:
      drawStep(o.i, t);
      break;
    case 1:
      drawSeg(o.i, t);
      break;
    case 2:
      drawMemo(o.mi, t);
      break;
    case 3:
      drawSlot(t);
      break;
    case 4:
      drawEnd(t);
      break;
    case 5:
      drawStart(t);
      break;
  }
}

function drawStep(i, t) {
  const n = state.memos.length;
  const p = posAt(i);
  const pal = PALETTES[mod(Math.floor(i / 14), PALETTES.length)].a;
  const base = color(pal[i % 3]);
  const far = i - stepOf(n);
  const fog = far > 2 ? constrain(1 - (far - 2) * 0.03, 0.35, 1) : 1;
  push();
  drawingContext.globalAlpha = fog;
  // 버팀대
  stroke(18, 9, 38, 230);
  strokeWeight(6 * p.s * SC);
  strokeCap(ROUND);
  line(CX, p.y + 3, p.x, p.y + 3);
  // 판자
  const ang = Math.atan2(Math.cos(p.a) * 26 * SC, -R * Math.sin(p.a));
  const L = 132 * SC * p.s,
    Th = 15 * SC * p.s;
  translate(p.x, p.y);
  rotate(ang);
  const white = i % 2 === 0;
  noStroke();
  fill(white ? color(70, 20, 60) : color(40, 8, 36));
  rect(-L / 2, -Th / 2 + Th * 0.7, L, Th, 3);
  stroke(white ? color(12, 3, 16) : color(255, 150, 215));
  strokeWeight(2);
  fill(white ? color(247, 238, 245) : color(8, 2, 12));
  rect(-L / 2, -Th / 2, L, Th, 3);
  stroke(white ? color(255, 45, 149, 140) : color(255, 255, 255, 90));
  strokeWeight(1.2);
  drawingContext.setLineDash([6, 5]);
  line(-L / 2 + 8, 0, L / 2 - 8, 0);
  pop();
}

function drawPillar(t) {
  const w = 64 * SC + 10;
  push();
  noStroke();
  fill(7, 2, 11, 242);
  rect(CX - w / 2, -10, w, H + 20);
  // 원통 표면의 세로 이음선이 돌아간다
  for (let k = 0; k < 4; k++) {
    const th = spin * 1.3 + (k * TWO_PI) / 4;
    if (Math.cos(th) > 0) {
      const x = CX + ((Math.sin(th) * w) / 2) * 0.92;
      stroke(255, 255, 255, 10 + 26 * Math.cos(th));
      strokeWeight(1.5);
      line(x, -10, x, H + 10);
    }
  }
  noStroke();
  fill(0, 0, 0, 80);
  rect(CX - w / 2, -10, w * 0.16, H + 20);
  rect(CX + w / 2 - w * 0.16, -10, w * 0.16, H + 20);
  const BH = GAP * 2;
  const b0 = Math.floor((scrollY - H * 0.3) / BH) - 1,
    b1 = Math.ceil((scrollY + H * 0.7) / BH) + 1;
  for (let b = b0; b <= b1; b++) {
    const y = b * BH - scrollY + H * 0.3;
    const pal = PALETTES[mod(Math.floor((b * 2) / 14), PALETTES.length)].a;
    fill(fc(pal[mod(b, 3)], 150));
    rect(CX - w / 2, y, w, BH * 0.18);
    if (mod(b, 3) === 1) {
      // 기둥에 박힌 눈 — 원통을 따라 돌며, 앞으로 올 때만 보인다
      const th = spin * 1.3 + b * 2.1,
        cv = Math.cos(th);
      if (cv > 0.15) {
        const ex = CX + ((Math.sin(th) * w) / 2) * 0.78,
          ey = y + BH * 0.55;
        const ew = w * 0.72 * cv,
          eh = w * 0.36;
        fill(250, 244, 230, 220);
        ellipse(ex, ey, ew, eh);
        const px = constrain((mouseX - ex) * 0.03, -ew * 0.12, ew * 0.12);
        const py = constrain((mouseY - ey) * 0.03, -eh * 0.12, eh * 0.12);
        const id = Math.min(ew * 0.42, eh * 0.85);
        fill(fc(pal[0], 255));
        ellipse(ex + px, ey + py, id, id);
        fill(8, 4, 18);
        ellipse(ex + px, ey + py, id * 0.45, id * 0.45);
      }
    }
  }
  pop();
}

/* ----- 아리아드네의 실 ----- */
function drawSeg(i, t) {
  const a = i,
    b = Math.min(i + 1, threadEnd);
  if (b <= a) return;
  const zm = zAt((a + b) / 2),
    sm = 1 + zm * 0.26;
  push();
  noFill();
  stroke(255, 45, 149);
  strokeWeight(2.4 * sm * SC + 0.6);
  drawingContext.shadowBlur = 12;
  drawingContext.shadowColor = "rgba(255,45,149,0.9)";
  beginShape();
  const N = 6;
  for (let q = 0; q <= N; q++) {
    const f = a + ((b - a) * q) / N;
    const p = posAt(f);
    vertex(
      p.x,
      p.y -
        8 * p.s +
        Math.sin((q / N) * Math.PI) * (b - a) * 4 +
        Math.sin(t * 2 + f * 1.3) * 0.9,
    );
  }
  endShape();
  pop();
}

// 실의 끝 — 아직 묶이지 않은 채 흔들리는 끝자락
function drawEnd(t) {
  const p = posAt(threadEnd);
  push();
  translate(p.x, p.y - 8 * p.s);
  const pul = 1 + 0.25 * Math.sin(t * 4);
  drawingContext.shadowBlur = 18;
  drawingContext.shadowColor = "rgba(255,45,149,1)";
  noStroke();
  fill(255, 120, 195);
  circle(0, 0, 7 * p.s * SC * pul);
  fill(255, 240, 245);
  circle(0, 0, 3 * p.s * SC);
  noFill();
  stroke(255, 45, 149, 200);
  strokeWeight(1.6 * SC);
  bezier(0, 0, 5, 8, -5, 16, 2 + 3 * Math.sin(t * 2), 26);
  pop();
}

function drawStart(t) {
  const p = posAt(0);
  push();
  translate(p.x, p.y - 8 * p.s);
  noFill();
  stroke(255, 45, 149);
  strokeWeight(2);
  drawingContext.shadowBlur = 10;
  drawingContext.shadowColor = "rgba(255,45,149,0.9)";
  circle(0, 0, 16 * SC);
  noStroke();
  fill(255, 220, 232, 170);
  textAlign(CENTER, CENTER);
  textSize(11 * SC + 1);
  textFont('"Pinyon Script", cursive');
  textSize(19 * SC + 2);
  text("The Thread Begins", 0, -24 * SC);
  pop();
}

// 다음 생각이 묶일 자리
function drawSlot(t) {
  const n = state.memos.length;
  const p = posAt(stepOf(n));
  const ax = p.x,
    ay = p.y - 8 * p.s;
  const r = 26 * p.s * SC,
    cy = ay - 44 * p.s * SC;
  const hov = hoverHit && hoverHit.type === "slot";
  push();
  stroke(255, 45, 149, 150);
  strokeWeight(1.4);
  line(ax, ay, ax, cy + r);
  translate(ax, cy);
  drawingContext.shadowBlur = hov ? 28 : 16;
  drawingContext.shadowColor = "rgba(255,45,149,0.95)";
  noFill();
  stroke(255, 100, 175, hov ? 255 : 200);
  strokeWeight(2);
  drawingContext.setLineDash([6, 5]);
  drawingContext.lineDashOffset = -t * 18;
  circle(0, 0, r * 2 * (hov ? 1.12 : 1 + 0.05 * Math.sin(t * 3)));
  drawingContext.setLineDash([]);
  noStroke();
  fill(255, 225, 240, hov ? 255 : 215);
  for (let k = -1; k <= 1; k++)
    circle(k * r * 0.42, Math.sin(t * 4 + k * 1.2) * 2.5, r * 0.2);
  noStroke();
  fill(255, 225, 235, hov ? 255 : 175);
  textAlign(CENTER, CENTER);
  textSize(11 * SC + 1);
  textFont('"Pinyon Script", cursive');
  textSize(19 * SC + 2);
  text("Tie a thought here", 0, -r - 14 * SC);
  pop();
  hitRects.push({ type: "slot", x: ax, y: cy, r: r * 1.3 });
}

/* ----- 메모(종이쪽지) ----- */
const CARD_W = 150,
  CARD_H = 96,
  CARD_OFF = 34;

function inFocus(m) {
  if (focus === null) return true;
  if (focus === "__none") return !m.bundle;
  return m.bundle === focus;
}

function drawMemo(mi, t) {
  const m = state.memos[mi];
  const s = stepOf(mi),
    p = posAt(s);
  const bt = born[m.id];
  if (bt === undefined) return;
  const age = (millis() - bt) / 1000;
  const ap = easeOutBack(constrain(age / 0.9, 0, 1));
  const b = getBundle(m.bundle);
  const col = b ? b.color : "#e8e0ff";
  const inF = inFocus(m);
  const fa = inF ? 1 : 0.18;
  const ba = p.z < 0 ? 0.62 + 0.38 * (p.z + 1) : 1;
  const kb = p.s * SC,
    sc = kb * ap;
  const ax = p.x,
    ay = p.y - 8 * p.s;
  const rot = Math.sin(s * 1.7) * 0.07 + Math.sin(t * 1.1 + mi) * 0.025;
  const hov = hoverHit && hoverHit.type === "memo" && hoverHit.id === m.id;

  // 매듭
  push();
  translate(ax, ay);
  scale(kb);
  drawingContext.globalAlpha = Math.max(fa, 0.5) * ba;
  noFill();
  if (b) {
    stroke(col);
    strokeWeight(3);
    ellipse(0, 0, 19, 13);
  }
  stroke(255, 45, 149);
  strokeWeight(2);
  rotate(0.6);
  ellipse(0, 0, 13, 9);
  rotate(-1.2);
  ellipse(0, 0, 13, 9);
  rotate(0.6);
  noStroke();
  fill(255, 45, 149);
  circle(0, 0, 5);
  noFill();
  stroke(255, 45, 149);
  strokeWeight(1.6);
  bezier(0, 0, 5, 6, 9, 5, 13, 12);
  bezier(0, 0, -5, 6, -9, 6, -12, 13);
  pop();

  // 매듭이 지어지는 순간의 파문
  if (age < 1.6) {
    push();
    translate(ax, ay);
    for (let k = 0; k < 2; k++) {
      const tt = constrain(age / 1.4 - k * 0.18, 0, 1);
      if (tt > 0 && tt < 1) {
        noFill();
        stroke(255, 110, 190, 255 * (1 - tt));
        strokeWeight(2);
        circle(0, 0, (10 + tt * 70) * kb);
      }
    }
    const tt = constrain(age / 1.2, 0, 1);
    if (tt < 1) {
      noStroke();
      fill(255, 230, 240, 255 * (1 - tt));
      for (let k = 0; k < 8; k++) {
        const an = (k * TWO_PI) / 8 + 0.3,
          d = tt * 46 * kb;
        circle(Math.cos(an) * d, Math.sin(an) * d, 3.2);
      }
    }
    pop();
  }

  if (ap < 0.01) return;

  // 생각 풍선 — 실에 매달려 둥실 떠 있는 생각
  push();
  translate(ax, ay);
  rotate(rot);
  scale(sc * (hov ? 1.05 : 1));
  const ctx = drawingContext;
  ctx.globalAlpha = constrain(ap, 0, 1) * fa * ba;
  const bob = Math.sin(t * 1.3 + mi * 1.9) * 2.2;
  const edge = b ? b.color : "#ff6fb9";
  const tails = [
    [0, -7, 2.6],
    [3, -16, 4.2],
    [-2, -26, 5.6],
  ];
  for (const q of tails)
    dotGlow(ctx, q[0], q[1] + bob * 0.4, q[2], "#f8eaf6", edge, hov ? 18 : 8);
  const bcy = -CARD_OFF - CARD_H / 2 + bob;
  const pts = cloudPts(0, bcy, 58, 34, 10, 14, t);
  paintCloud(ctx, pts, 0, bcy, 58, 34, "#f8eaf6", edge, hov ? 26 : 12, 2);
  noStroke();
  fill(46, 18, 58);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  textSize(12.5);
  textLeading(14);
  text(snip(m.text), -46, bcy - 26, 92, 54);
  if (b) {
    fill(b.color);
    heart(46, bcy - 30, 4.5);
  }
  pop();

  if (inF && age > 0.6)
    hitRects.push({ type: "memo", id: m.id, x: ax, y: ay, rot, sc: kb });
}

/* ----- 묶음 보기: 같은 묶음의 매듭들을 이어 주는 실 ----- */
function focusMemos() {
  const out = [];
  state.memos.forEach((m, i) => {
    if (inFocus(m)) out.push(i);
  });
  return out;
}

function drawBundleThreads(t) {
  if (focus === null) return;
  const fm = focusMemos();
  if (fm.length < 2) return;
  const b = getBundle(focus);
  const col = b ? b.color : "#e8e0ff";
  for (let j = 0; j < fm.length - 1; j++) {
    const m1 = state.memos[fm[j]],
      m2 = state.memos[fm[j + 1]];
    if (born[m1.id] === undefined || born[m2.id] === undefined) continue;
    const p1 = posAt(stepOf(fm[j])),
      p2 = posAt(stepOf(fm[j + 1]));
    const A = { x: p1.x, y: p1.y - 8 * p1.s },
      B = { x: p2.x, y: p2.y - 8 * p2.s };
    if (Math.min(A.y, B.y) > H + 200 || Math.max(A.y, B.y) < -200) continue;
    const dir = (A.x + B.x) / 2 >= CX ? 1 : -1;
    const out = R + 90 * SC;
    push();
    noFill();
    stroke(col);
    strokeWeight(3);
    drawingContext.shadowBlur = 14;
    drawingContext.shadowColor = col;
    drawingContext.setLineDash([12, 9]);
    drawingContext.lineDashOffset = -t * 40;
    bezier(
      A.x,
      A.y,
      CX + dir * out,
      A.y + (B.y - A.y) * 0.3,
      CX + dir * out,
      B.y - (B.y - A.y) * 0.3,
      B.x,
      B.y,
    );
    pop();
  }
}

/* ============================================================
   HUD — 시계, 깊이
   ============================================================ */
// 클래식 시계바늘 (12시 방향 기준 각도 a, 길이 len, 굵기 wd)
function classicHand(a, len, wd, ring) {
  push();
  rotate(a);
  noStroke();
  fill(18, 6, 24);
  beginShape();
  vertex(-len * 0.18, -wd * 0.4);
  vertex(0, -wd);
  vertex(len * 0.55, -wd * 0.55);
  vertex(len, 0);
  vertex(len * 0.55, wd * 0.55);
  vertex(0, wd);
  vertex(-len * 0.18, wd * 0.4);
  endShape(CLOSE);
  if (ring) {
    fill(250, 235, 245);
    stroke(18, 6, 24);
    strokeWeight(1.2);
    circle(len * 0.62, 0, wd * 1.7);
  }
  pop();
}

// DEPTH: 생각을 하나 지나칠 때마다 1씩 깊어진다 (실이 닿아 매듭이 지어진 생각만 센다)
function depthNow() {
  let d = 0;
  for (let k = 0; k < state.memos.length; k++) {
    if (born[state.memos[k].id] === undefined) break;
    if (stepOf(k) * GAP - H * 0.35 <= scrollY) d++;
    else break;
  }
  return d;
}

function drawHUD(t) {
  push();
  // 시계 (우상단) — 로마숫자 클래식 시계
  const cs = W < 600 ? 0.8 : 1;
  const r = 48 * cs,
    cx = W - r - 22,
    cy = r + 22;
  const d = new Date();
  const sec = d.getSeconds() + d.getMilliseconds() / 1000;
  const min = d.getMinutes() + sec / 60;
  const hr = (d.getHours() % 12) + min / 60;
  push();
  translate(cx, cy);
  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = "rgba(255,45,149,0.55)";
  fill(8, 2, 12);
  stroke(255, 45, 149);
  strokeWeight(2.5);
  circle(0, 0, r * 2); // 바깥 테두리
  drawingContext.shadowBlur = 0;
  noStroke();
  fill(244, 230, 238);
  circle(0, 0, r * 1.84); // 문자판
  noFill();
  stroke(18, 6, 24);
  strokeWeight(1);
  circle(0, 0, r * 1.74);
  for (let k = 0; k < 60; k++) {
    // 눈금
    const an = (k / 60) * TWO_PI - HALF_PI,
      big = k % 5 === 0;
    const r1 = r * (big ? 0.72 : 0.78),
      r2 = r * 0.85;
    stroke(18, 6, 24);
    strokeWeight(big ? 2 : 0.8);
    line(
      Math.cos(an) * r1,
      Math.sin(an) * r1,
      Math.cos(an) * r2,
      Math.sin(an) * r2,
    );
  }
  push(); // 로마숫자
  noStroke();
  fill(18, 6, 24);
  textAlign(CENTER, CENTER);
  textSize(r * 0.17);
  textFont("Cinzel, serif");
  const romans = [
    "XII",
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
  ];
  for (let k = 0; k < 12; k++) {
    const an = (k / 12) * TWO_PI - HALF_PI;
    text(romans[k], Math.cos(an) * r * 0.56, Math.sin(an) * r * 0.56);
  }
  pop();
  noStroke();
  fill(255, 45, 149);
  heart(0, r * 0.3, r * 0.12);
  classicHand((hr / 12) * TWO_PI - HALF_PI, r * 0.5, r * 0.07, true); // 시침
  classicHand((min / 60) * TWO_PI - HALF_PI, r * 0.74, r * 0.05, false); // 분침
  push(); // 초침
  rotate((sec / 60) * TWO_PI - HALF_PI);
  stroke(255, 45, 149);
  strokeWeight(1.3);
  line(-r * 0.2, 0, r * 0.82, 0);
  noStroke();
  fill(255, 45, 149);
  circle(-r * 0.2, 0, r * 0.09);
  circle(r * 0.8, 0, r * 0.06);
  pop();
  noStroke();
  fill(255, 45, 149);
  circle(0, 0, r * 0.1);
  fill(8, 2, 12);
  circle(0, 0, r * 0.04);
  pop();

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  noStroke();
  textAlign(RIGHT, TOP);
  fill(255, 235, 245);
  textFont("Cinzel, serif");
  textSize(17 * cs);
  text(
    two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()),
    W - 20,
    cy + r + 10,
  );
  fill(255, 200, 220, 200);
  textFont('"Cormorant Garamond", serif');
  textStyle(BOLD);
  textSize(16);
  text(
    days[d.getDay()] +
      ", " +
      months[d.getMonth()] +
      " " +
      d.getDate() +
      ", " +
      d.getFullYear(),
    W - 20,
    cy + r + 10 + 24 * cs,
  );

  // 깊이 (좌상단, 버튼 아래)
  textAlign(LEFT, TOP);
  const depth = depthNow();
  fill(255, 220, 235, 190);
  textFont("Cinzel, serif");
  textSize(12);
  text("DEPTH  " + String(depth).padStart(4, "0"), 20, 66);
  fill(255, 200, 220, 170);
  textFont('"Cormorant Garamond", serif');
  textStyle(BOLD);
  textSize(15);
  text(
    state.memos.length +
      (state.memos.length === 1 ? " thought" : " thoughts") +
      " · " +
      state.bundles.length +
      (state.bundles.length === 1 ? " thread" : " threads"),
    20,
    86,
  );

  // 안내 문구
  textAlign(CENTER, CENTER);
  if (state.memos.length === 0 && scrollY < 1200) {
    fill(255, 225, 238, 150 + 40 * Math.sin(t * 2));
    textFont('"Cormorant Garamond", serif');
    textStyle(BOLD);
    textSize(W < 600 ? 15 : 18);
    text(
      "Descend. Tie your first thought where the thread ends.",
      W / 2,
      H - 112,
    );
  } else if (state.memos.length > 0 && scrollY < 90) {
    fill(255, 225, 238, 150 + 40 * Math.sin(t * 2));
    textFont('"Cormorant Garamond", serif');
    textStyle(BOLD);
    textSize(W < 600 ? 15 : 18);
    text("↓ Descend, and follow the thoughts you have tied", W / 2, H - 112);
  }
  pop();
}

/* ============================================================
   입력 처리 — 스크롤 / 클릭 / 키보드
   ============================================================ */
function uiOpen() {
  return document.querySelector(".modal.open") !== null;
}

function hitTest(mx, my) {
  for (let k = hitRects.length - 1; k >= 0; k--) {
    const h = hitRects[k];
    if (h.type === "slot") {
      if (dist(mx, my, h.x, h.y) <= h.r) return h;
    } else {
      const dx = mx - h.x,
        dy = my - h.y;
      const c = Math.cos(-h.rot),
        s = Math.sin(-h.rot);
      const lx = (dx * c - dy * s) / h.sc,
        ly = (dx * s + dy * c) / h.sc;
      if (
        lx >= -CARD_W / 2 &&
        lx <= CARD_W / 2 &&
        ly >= -CARD_OFF - CARD_H &&
        ly <= -CARD_OFF
      )
        return h;
    }
  }
  return null;
}

function updateHover() {
  hoverHit =
    uiOpen() || !overCanvas || (pressInfo && pressInfo.moved)
      ? null
      : hitTest(mouseX, mouseY);
  cursor(hoverHit ? HAND : ARROW);
}

function mousePressed(e) {
  if (!e || !e.target || e.target.tagName !== "CANVAS") return;
  pressInfo = { x: mouseX, y: mouseY, moved: false };
}

function mouseDragged() {
  if (!pressInfo) return;
  if (Math.abs(mouseX - pressInfo.x) + Math.abs(mouseY - pressInfo.y) > 6)
    pressInfo.moved = true;
  if (view.mode) {
    if (view.mode === "read" && pressInfo.moved && view.geom)
      view.scrollT = constrain(
        view.scrollT - (mouseY - pmouseY) / view.geom.leading,
        0,
        Math.max(0, view.geom.lines - view.geom.vis),
      );
    return;
  }
  if (uiOpen()) return;
  if (pressInfo.moved) {
    followId = null;
    scrollTarget = Math.max(0, scrollTarget - (mouseY - pmouseY) * 1.4);
  }
}

function mouseReleased() {
  if (!pressInfo) return;
  const was = pressInfo;
  pressInfo = null;
  if (view.mode) {
    if (!was.moved) handleCloudClick();
    return;
  }
  if (was.moved || uiOpen()) return;
  const h = hitTest(mouseX, mouseY);
  if (!h) return;
  if (h.type === "slot") openEditor(null, mouseX, mouseY);
  else openReader(h.id, mouseX, mouseY);
}

window.addEventListener(
  "wheel",
  (e) => {
    if (!e.target || e.target.tagName !== "CANVAS") return;
    if (view.mode) {
      e.preventDefault();
      if (view.mode === "read" && view.geom)
        view.scrollT = constrain(
          view.scrollT + Math.sign(e.deltaY),
          0,
          Math.max(0, view.geom.lines - view.geom.vis),
        );
      return;
    }
    if (uiOpen()) return;
    e.preventDefault();
    followId = null;
    scrollTarget = Math.max(
      0,
      scrollTarget + e.deltaY * (e.deltaMode === 1 ? 32 : 1),
    );
  },
  { passive: false },
);

window.addEventListener("mousemove", (e) => {
  overCanvas = !!(e.target && e.target.tagName === "CANVAS");
});

window.addEventListener("keydown", (e) => {
  const tag = (document.activeElement || {}).tagName || "";
  const typing = tag === "TEXTAREA" || tag === "INPUT";
  if (e.key === "Escape") {
    closeAll();
    return;
  }
  if (edit.open && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    submitEditor();
    return;
  }
  // →: 글의 맨 끝에서 오른쪽 방향키를 누르면 지금 생각을 걸어 두고 다음 생각으로 넘어간다
  if (
    edit.open &&
    !edit.id &&
    e.key === "ArrowRight" &&
    !e.shiftKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !e.isComposing &&
    e.keyCode !== 229
  ) {
    const ta = $("memoText");
    if (
      document.activeElement === ta &&
      ta.value.trim() &&
      ta.selectionStart === ta.value.length &&
      ta.selectionEnd === ta.value.length
    ) {
      e.preventDefault();
      stackThought();
      return;
    }
  }
  if (typing || uiOpen()) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    scrollTarget += 180;
  } else if (e.key === "PageDown" || e.key === " ") {
    e.preventDefault();
    scrollTarget += H * 0.75;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    scrollTarget = Math.max(0, scrollTarget - 180);
  } else if (e.key === "PageUp") {
    e.preventDefault();
    scrollTarget = Math.max(0, scrollTarget - H * 0.75);
  } else if (e.key === "Home") {
    scrollTarget = 0;
  } else if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    openEditor(null);
  }
});

/* ============================================================
   DOM: 에디터 / 리더 / 서랍 / 묶음 보기
   ============================================================ */
function closeAll() {
  if (edit.open) closeEditor();
  closeReader();
  $("book").classList.remove("open");
  $("drawer").classList.remove("open");
}

/* ----- 에디터: 글자가 실에 꿰어 구름으로 떠오른다 ----- */
function syncBody() {
  document.body.classList.toggle(
    "thinking",
    edit.open || document.getElementById("reader").classList.contains("open"),
  );
}

function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  const mk = (label, id, color) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (edit.bundle === id ? " on" : "");
    b.textContent = label;
    if (color) b.style.setProperty("--c", color);
    b.addEventListener("click", () => {
      edit.bundle = id;
      $("newBundleWrap").classList.remove("show");
      $("newBundle").value = "";
      renderChips();
      $("memoText").focus();
    });
    box.appendChild(b);
  };
  mk("실타래 없음", null, null);
  state.bundles.forEach((b) => mk(b.name, b.id, b.color));
  const nb = document.createElement("button");
  nb.type = "button";
  nb.className =
    "chip" + ($("newBundleWrap").classList.contains("show") ? " on" : "");
  nb.textContent = "+ 새 실타래";
  nb.addEventListener("click", () => {
    $("newBundleWrap").classList.toggle("show");
    if ($("newBundleWrap").classList.contains("show")) {
      edit.bundle = null;
      $("newBundle").focus();
    }
    renderChips();
  });
  box.appendChild(nb);
}

function openEditor(id, fx, fy) {
  closeAll();
  const ta = $("memoText");
  edit.id = id;
  edit.open = true;
  queue = id ? [] : loadQueue();
  $("newBundle").value = "";
  $("newBundleWrap").classList.remove("show");
  if (id) {
    const m = state.memos.find((x) => x.id === id);
    if (!m) {
      edit.open = false;
      return;
    }
    ta.value = m.text;
    edit.bundle = m.bundle || null;
    $("edHint").textContent = "고쳐 쓰면 같은 매듭에 다시 묶여요.";
  } else {
    let draft = "";
    try {
      draft = localStorage.getItem(DRAFT_KEY) || "";
    } catch (e) {
      /* 무시 */
    }
    ta.value = draft;
    edit.bundle =
      state.lastBundle && getBundle(state.lastBundle) ? state.lastBundle : null;
    $("edHint").textContent =
      "떠오르는 대로 적어 보세요. 글 끝에서 → 키를 누르면 걸어 두고 다음 생각을 쓸 수 있어요.";
  }
  prevText = ta.value;
  const len = ta.value.length,
    stepMs = Math.min(14, 900 / Math.max(1, len)),
    t0 = millis() + 200;
  view.births = Array.from({ length: len }, (_, i) => t0 + i * stepMs);
  Object.assign(view, {
    mode: "edit",
    kind: "edit",
    id,
    text: ta.value,
    hideCloud: false,
    th: 0,
    scroll: 0,
    scrollT: 0,
    measT: 0,
    cache: null,
    from: {
      x: fx === undefined ? W / 2 : fx,
      y: fy === undefined ? H - 70 : fy,
    },
  });
  if (!id)
    scrollTarget = Math.max(0, stepOf(state.memos.length) * GAP - H * 0.32); // 새 생각은 실 끝, 계단 위에서 떠올린다
  updateCount();
  renderChips();
  $("editor").classList.add("open");
  syncBody();
  setTimeout(() => {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, 60);
}

function closeEditor() {
  if (!edit.id) {
    // 새 메모의 미완성 글은 초안으로 보존
    try {
      localStorage.setItem(DRAFT_KEY, $("memoText").value);
    } catch (e) {
      /* 무시 */
    }
  }
  edit.open = false;
  if (view.mode === "edit") view.mode = null;
  $("editor").classList.remove("open");
  syncBody();
  $("memoText").blur();
}

function updateCount() {
  refreshEditorButtons();
}

// 글자가 들어올 때마다 그 글자만의 '태어난 시각'을 남겨 떠오르는 연출에 쓴다
function onMemoInput() {
  const ta = $("memoText"),
    nv = ta.value,
    ov = prevText,
    now = millis();
  const m = Math.min(nv.length, ov.length);
  let p = 0;
  while (p < m && nv[p] === ov[p]) p++;
  let q = 0;
  while (q < m - p && nv[nv.length - 1 - q] === ov[ov.length - 1 - q]) q++;
  const mid = nv.length - p - q,
    del = ov.length - p - q;
  const nb = view.births.slice(0, p);
  for (let k = 0; k < mid; k++)
    nb.push(
      del === mid && mid <= 2 && view.births[p + k] !== undefined
        ? view.births[p + k]
        : now,
    );
  for (let k = ov.length - q; k < ov.length; k++)
    nb.push(view.births[k] === undefined ? -1e9 : view.births[k]);
  view.births = nb;
  prevText = nv;
  view.lastInput = now;
  updateCount();
  if (!edit.id) {
    try {
      localStorage.setItem(DRAFT_KEY, nv);
    } catch (e) {
      /* 무시 */
    }
  }
  if (mid > del) spawnSparks(view.caret.x, view.caret.y, Math.min(5, 2 + mid));
}

function commitNewBundle() {
  const nbName = $("newBundle").value.trim();
  if (nbName) {
    const nb = {
      id: uid(),
      name: nbName,
      color: BUNDLE_COLORS[state.bundles.length % BUNDLE_COLORS.length],
    };
    state.bundles.push(nb);
    edit.bundle = nb.id;
    $("newBundle").value = "";
    $("newBundleWrap").classList.remove("show");
    renderChips();
    renderDrawer();
  }
  return edit.bundle;
}

function finishEditor() {
  edit.open = false;
  view.mode = null;
  $("editor").classList.remove("open");
  syncBody();
  $("memoText").blur();
  renderDrawer();
  refreshFocusBar();
}

function refreshEditorButtons() {
  const ta = $("memoText");
  const cur = ta.value.trim() ? 1 : 0;
  const total = (edit.id ? 0 : queue.length) + cur;
  $("edCount").textContent =
    ta.value.length +
    "자" +
    (queue.length && !edit.id ? " · " + queue.length + "개 걸어 둠" : "");
  if (edit.id) {
    $("edSave").textContent = "다시 묶기 (Ctrl+Enter)";
    $("edNext").style.display = "none";
  } else {
    $("edSave").textContent =
      total > 1
        ? "모두 묶기 " + total + "개 (Ctrl+Enter)"
        : "실로 묶기 (Ctrl+Enter)";
    $("edNext").style.display = "";
  }
}

/* ----- 여러 생각을 쌓아 두었다가 한 번에 묶기 ----- */
function toRoman(n) {
  const m = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let r = "";
  for (const [v, c] of m)
    while (n >= v) {
      r += c;
      n -= v;
    }
  return r;
}

function saveQueue() {
  try {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(queue.map((q) => ({ text: q.text, bundle: q.bundle }))),
    );
  } catch (e) {
    /* 무시 */
  }
}

// 글만 알고 있을 때(저장된 대기열 복원) 구름 모양을 새로 계산한다
function snapFor(text) {
  const base = cloudBase(),
    lay = layoutText(text, base.tw, base.fs);
  const availH = H - view.reserve - 2 * base.rr - 36;
  const maxLines = Math.max(
    2,
    Math.floor((availH / 2 - 6) / 0.78 / base.leading),
  );
  const vis = constrain(lay.lines, Math.min(3, maxLines), maxLines);
  const th = vis * base.leading;
  return {
    g: Object.assign({}, base, { th, b: th * 0.78 + 6, vis, lines: lay.lines }),
    lay,
    births: [],
    scroll: 0,
  };
}

function loadQueue() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (e) {
    arr = [];
  }
  if (!Array.isArray(arr)) arr = [];
  const t0 = millis() - 1000;
  return arr
    .filter((x) => x && typeof x.text === "string" && x.text.trim())
    .map((x) =>
      Object.assign(
        {
          text: x.text,
          bundle: getBundle(x.bundle) ? x.bundle : null,
          t0,
          from: { x: W / 2, y: H / 2, s: 0.15 },
          sx: W / 2,
          sy: 74,
          ss: 0.15,
        },
        snapFor(x.text),
      ),
    );
}

function snapCurrent() {
  return {
    g: view.lastG,
    lay: view.lastLay,
    births: view.births.slice(),
    scroll: view.scroll,
    t0: millis(),
    from: { x: view.px, y: view.py, s: view.ps || 1 },
    sx: view.px,
    sy: view.py,
    ss: view.ps || 1,
  };
}

// → 키(또는 버튼): 지금 쓴 생각을 빨랫줄에 걸어 두고, 새 구름을 연다
function stackThought() {
  if (edit.id || !edit.open || !view.lastG) return;
  const ta = $("memoText"),
    text = ta.value.trim();
  if (!text) {
    view.shake = millis();
    return;
  }
  const bundleId = commitNewBundle();
  queue.push(Object.assign({ text, bundle: bundleId || null }, snapCurrent()));
  saveQueue();
  ta.value = "";
  prevText = "";
  view.births = [];
  view.scroll = 0;
  view.scrollT = 0;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    /* 무시 */
  }
  spawnSparks(view.px, view.py, 16);
  view.lastInput = millis();
  refreshEditorButtons();
  ta.focus();
}

// 걸어 둔 생각을 눌러 다시 쓰기 (지금 쓰던 글은 그 자리에 대신 걸린다)
function recallQueued(i) {
  const it = queue[i];
  if (!it || edit.id) return;
  const ta = $("memoText"),
    cur = ta.value.trim();
  queue.splice(i, 1);
  if (cur)
    queue.splice(
      i,
      0,
      Object.assign({ text: cur, bundle: edit.bundle || null }, snapCurrent()),
    );
  ta.value = it.text;
  prevText = it.text;
  const len = it.text.length,
    t0 = millis();
  view.births = Array.from(
    { length: len },
    (_, k) => t0 + k * Math.min(10, 600 / Math.max(1, len)),
  );
  edit.bundle = it.bundle || null;
  renderChips();
  saveQueue();
  try {
    localStorage.setItem(DRAFT_KEY, ta.value);
  } catch (e) {
    /* 무시 */
  }
  view.scroll = 0;
  view.scrollT = 0;
  ta.focus();
  ta.setSelectionRange(len, len);
  refreshEditorButtons();
}

function drawQueue(t, kk) {
  view.qHits = [];
  if (!queue.length || view.mode !== "edit") return;
  const ctx = drawingContext,
    now = millis();
  const cap = Math.max(1, Math.floor((W - 80) / 112)),
    start = Math.max(0, queue.length - cap),
    n = queue.length - start;
  const x0 = W / 2 - (n * 112) / 2 + 56,
    ly = 20;
  push(); // 빨랫줄이 된 아리아드네의 실
  noFill();
  stroke(255, 45, 149, 210 * kk);
  strokeWeight(1.6);
  ctx.shadowBlur = 8;
  ctx.shadowColor = "rgba(255,45,149,0.9)";
  beginShape();
  for (let x = x0 - 80; x <= x0 + (n - 1) * 112 + 80; x += 14)
    vertex(x, ly + Math.sin(x * 0.03 + t * 1.2) * 3);
  endShape();
  pop();
  for (let q = 0; q < n; q++) {
    const it = queue[start + q];
    const tx = x0 + q * 112,
      ty = 74 + Math.sin(t * 1.4 + q) * 2.5;
    const u = constrain((now - it.t0) / 600, 0, 1),
      e = 1 - Math.pow(1 - u, 3);
    const ms = 104 / (2 * (it.g.a + it.g.rr));
    const x = lerp(it.from.x, tx, e),
      y = lerp(it.from.y, ty, e),
      sc = lerp(it.from.s, ms, e);
    it.sx = x;
    it.sy = y;
    it.ss = sc;
    const mh = (it.g.b + it.g.rr) * sc;
    push();
    stroke(255, 45, 149, 200 * kk);
    strokeWeight(1.3);
    line(tx, ly + Math.sin(tx * 0.03 + t * 1.2) * 3, tx, y - mh + 2);
    pop();
    push();
    translate(x, y);
    scale(sc);
    drawThoughtCloud(it.g, it.lay, it.births, {
      t,
      alpha: kk,
      col: (getBundle(it.bundle) || {}).color || "#ff6fb9",
      tail: false,
      scroll: 0,
    });
    pop();
    push();
    noStroke();
    fill(255, 190, 225, 230 * kk);
    textFont("Cinzel, serif");
    textAlign(CENTER, CENTER);
    textSize(12);
    text(toRoman(start + q + 1), tx, y + mh + 12);
    pop();
    view.qHits.push({ i: start + q, x: tx, y: ty, w: 108, h: mh * 2 + 24 });
  }
  if (start > 0) {
    push();
    noStroke();
    fill(255, 190, 225, 200 * kk);
    textFont("Cinzel, serif");
    textAlign(RIGHT, CENTER);
    textSize(12);
    text("+" + start, x0 - 66, 74);
    pop();
  }
}

function submitEditor() {
  const ta = $("memoText");
  const text = ta.value.trim();
  if (edit.id) {
    // 이미 묶인 생각을 고쳐 쓰는 경우
    if (!text) {
      view.shake = millis();
      return;
    }
    const bundleId = commitNewBundle();
    const m = state.memos.find((x) => x.id === edit.id);
    if (m) {
      m.text = text;
      m.bundle = bundleId || null;
      m.edited = Date.now();
    }
    state.lastBundle = bundleId || null;
    saveState();
    spawnSparks(view.px, view.py, 22);
    finishEditor();
    return;
  }
  const bundleId = commitNewBundle();
  const items = queue.map((it) => ({
    text: it.text,
    bundle: it.bundle,
    snap: it,
    src: { x: it.sx, y: it.sy, s: it.ss },
  }));
  if (text)
    items.push({
      text,
      bundle: bundleId || null,
      snap: snapCurrent(),
      src: { x: view.px, y: view.py, s: view.ps || 1 },
    });
  if (!items.length) {
    view.shake = millis();
    return;
  }
  const first = state.memos.length,
    base = Date.now();
  items.forEach((it, i) => {
    const m = {
      id: uid(),
      text: it.text,
      ts: base + i,
      bundle: it.bundle || null,
    };
    state.memos.push(m);
    startTie(m, it.snap, it.src, i);
  });
  scrollTarget = Math.max(0, stepOf(first) * GAP - H * 0.32); // 실이 닿는 곳으로 내려간다
  const d = scrollTarget - scrollY;
  if (Math.abs(d) > H) scrollY = scrollTarget - Math.sign(d) * H * 0.7; // 너무 멀면 가까이서 출발
  followId = items.length > 1 ? state.memos[state.memos.length - 1].id : null;
  view.hideCloud = true;
  try {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(QUEUE_KEY);
  } catch (e) {
    /* 무시 */
  }
  queue = [];
  ta.value = "";
  prevText = "";
  view.births = [];
  state.lastBundle = bundleId || null;
  saveState();
  finishEditor();
}

/* ----- 리더: 생각이 구름으로 펼쳐지며 글자가 하나씩 떠오른다 ----- */
let readingId = null;
function closeReader() {
  document.getElementById("reader").classList.remove("open");
  if (view.mode === "read") view.mode = null;
  syncBody();
}

function openReader(id, fx, fy) {
  const m = state.memos.find((x) => x.id === id);
  if (!m) return;
  closeAll();
  readingId = id;
  const b = getBundle(m.bundle);
  const idx = state.memos.indexOf(m) + 1;
  $("rdMeta").innerHTML =
    `<span>Knot No. ${idx}</span><span>·</span><span>${fmtDate(m.ts)}</span>` +
    (m.edited ? "<span>· rewritten</span>" : "") +
    (b
      ? `<span>·</span><i style="background:${b.color}"></i><span>${esc(b.name)}</span>`
      : "");
  const len = m.text.length,
    stepMs = Math.min(18, 1600 / Math.max(1, len)),
    t0 = millis() + 180;
  view.births = Array.from({ length: len }, (_, i) => t0 + i * stepMs);
  Object.assign(view, {
    mode: "read",
    kind: "read",
    id,
    text: m.text,
    col: b ? b.color : "#ff6fb9",
    hideCloud: false,
    th: 0,
    scroll: 0,
    scrollT: 0,
    measT: 0,
    cache: null,
    from: {
      x: fx === undefined ? W / 2 : fx,
      y: fy === undefined ? H / 2 : fy,
    },
  });
  $("reader").classList.add("open");
  syncBody();
}

/* ----- 묶음 서랍 ----- */
function renderDrawer() {
  const counts = {};
  let none = 0;
  state.memos.forEach((m) => {
    if (m.bundle) counts[m.bundle] = (counts[m.bundle] || 0) + 1;
    else none++;
  });
  let html = `<li class="${focus === null ? "on" : ""}" data-f="">All thoughts<span>${state.memos.length}</span></li>`;
  state.bundles.forEach((b) => {
    html += `<li class="${focus === b.id ? "on" : ""}" data-f="${b.id}"><i style="background:${b.color};color:${b.color}"></i>${esc(b.name)}<span>${counts[b.id] || 0}</span><button class="x" data-del="${b.id}" title="Unbind">✕</button></li>`;
  });
  if (none > 0) {
    html += `<li class="${focus === "__none" ? "on" : ""}" data-f="__none"><i style="background:#e8e0ff"></i>Untied thoughts<span>${none}</span></li>`;
  }
  $("bundleList").innerHTML = html;
}

function setFocus(f) {
  focus = f;
  focusIdx = 0;
  renderDrawer();
  refreshFocusBar();
  const fm = focusMemos();
  if (f !== null && fm.length) scrollToMemo(fm[0]);
  $("drawer").classList.remove("open");
}

function focusName() {
  if (focus === "__none") return { name: "Untied thoughts", color: "#e8e0ff" };
  const b = getBundle(focus);
  return b ? { name: b.name, color: b.color } : { name: "", color: "#fff" };
}

function refreshFocusBar() {
  const bar = $("focusbar");
  if (focus !== null && focus !== "__none" && !getBundle(focus)) focus = null;
  if (focus === null) {
    bar.classList.remove("show");
    return;
  }
  const fm = focusMemos();
  if (focusIdx >= fm.length) focusIdx = Math.max(0, fm.length - 1);
  const f = focusName();
  $("fbName").textContent = f.name;
  $("fbDot").style.background = f.color;
  $("fbDot").style.boxShadow = "0 0 8px " + f.color;
  $("fbPos").textContent = fm.length
    ? focusIdx + 1 + " / " + fm.length
    : "Empty";
  bar.classList.add("show");
}

function stepFocus(d) {
  const fm = focusMemos();
  if (!fm.length) return;
  focusIdx = constrain(focusIdx + d, 0, fm.length - 1);
  scrollToMemo(fm[focusIdx]);
  refreshFocusBar();
}

/* ----- 묶음 펼쳐 읽기 ----- */
function openBook() {
  const fm = focusMemos();
  if (focus === null) return;
  const f = focusName();
  $("bkTitle").innerHTML =
    `<i style="width:12px;height:12px;border-radius:50%;display:inline-block;background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${esc(f.name)} <small style="opacity:.55;font-weight:400">· ${fm.length} knots</small>`;
  $("bkList").innerHTML = fm.length
    ? fm
        .map((mi, j) => {
          const m = state.memos[mi];
          return `<article><header>No. ${j + 1} · ${fmtDate(m.ts)}</header><p>${esc(m.text)}</p><button data-mi="${mi}">Descend to this knot</button></article>`;
        })
        .join("")
    : '<p style="opacity:.6">No thoughts on this thread yet.</p>';
  $("book").classList.add("open");
}

/* ----- 이벤트 바인딩 ----- */
function bindUI() {
  $("btnNew").addEventListener("click", () => openEditor(null));
  $("btnDrawer").addEventListener("click", () => {
    renderDrawer();
    $("drawer").classList.toggle("open");
  });
  $("drawerClose").addEventListener("click", () =>
    $("drawer").classList.remove("open"),
  );

  $("bundleList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = del.dataset.del;
      const b = getBundle(id);
      if (
        b &&
        confirm(
          'Unbind "' +
            b.name +
            '"?\n(The thoughts stay. Only the thread is released.)',
        )
      ) {
        state.memos.forEach((m) => {
          if (m.bundle === id) m.bundle = null;
        });
        state.bundles = state.bundles.filter((x) => x.id !== id);
        if (state.lastBundle === id) state.lastBundle = null;
        if (focus === id) focus = null;
        saveState();
        renderDrawer();
        refreshFocusBar();
      }
      return;
    }
    const li = e.target.closest("li");
    if (li) setFocus(li.dataset.f === "" ? null : li.dataset.f);
  });

  $("fbPrev").addEventListener("click", () => stepFocus(-1));
  $("fbNext").addEventListener("click", () => stepFocus(1));
  $("fbBook").addEventListener("click", openBook);
  $("fbClear").addEventListener("click", () => setFocus(null));

  $("memoText").addEventListener("input", onMemoInput);
  $("edSave").addEventListener("click", submitEditor);
  $("edNext").addEventListener("click", stackThought);
  $("edCancel").addEventListener("click", closeEditor);
  $("newBundle").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("memoText").focus();
    }
  });

  $("rdClose").addEventListener("click", () => closeReader());
  $("rdEdit").addEventListener("click", () => {
    const id = readingId;
    closeReader();
    openEditor(id);
  });
  $("rdDel").addEventListener("click", () => {
    const m = state.memos.find((x) => x.id === readingId);
    if (!m) return;
    if (confirm("Unravel this thought? This cannot be undone.")) {
      state.memos = state.memos.filter((x) => x.id !== readingId);
      delete born[readingId];
      saveState();
      closeReader();
      renderDrawer();
      refreshFocusBar();
    }
  });

  $("bkClose").addEventListener("click", () =>
    $("book").classList.remove("open"),
  );
  $("bkList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-mi]");
    if (b) {
      $("book").classList.remove("open");
      scrollToMemo(parseInt(b.dataset.mi, 10));
    }
  });

  // 모달 바깥(어두운 배경)을 누르면 닫기
  ["reader", "book"].forEach((id) =>
    $(id).addEventListener("mousedown", (e) => {
      if (e.target === $(id)) $(id).classList.remove("open");
    }),
  );
  $("editor").addEventListener("mousedown", (e) => {
    if (e.target === $("editor")) closeEditor();
  });
}

/* ============================================================
   생각 구름 — 글자가 실에 꿰어 떠오르는 입력, 구름으로 펼쳐지는 읽기
   ============================================================ */
function frac(x) {
  return x - Math.floor(x);
}

function cloudBase() {
  const fs = W < 600 ? 21 : 25,
    leading = Math.round(fs * 1.75),
    rr = fs * 1.5;
  const a = Math.min(W * 0.9, 760) / 2 - rr;
  return { fs, leading, rr, a, tw: Math.round(a * 1.5) };
}

function charW(ch, fs) {
  const key = fs + "|" + ch;
  let w = cwCache[key];
  if (w === undefined) {
    push();
    textSize(fs);
    textStyle(BOLD);
    w = textWidth(ch);
    pop();
    cwCache[key] = w;
  }
  return w;
}

// 글자 하나하나의 자리를 계산한다 (한글은 글자 단위, 영어는 단어 단위로 줄바꿈)
function layoutText(str, maxW, fs) {
  const key = fs + "|" + Math.round(maxW) + "|" + str;
  if (view.cache && view.cache.key === key) return view.cache;
  const chars = [];
  let x = 0,
    line = 0,
    lineStart = 0,
    lastSp = -1;
  for (let i = 0; i < str.length; i++) {
    let ch = str[i],
      len = 1;
    const c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      ch = str.substr(i, 2);
      len = 2;
    }
    if (ch === "\n") {
      chars.push({ ch, i, len, x, w: 0, line, nl: true });
      line++;
      x = 0;
      lineStart = chars.length;
      lastSp = -1;
      continue;
    }
    const w = charW(ch, fs);
    if (x + w > maxW && chars.length > lineStart) {
      if (
        ch !== " " &&
        lastSp >= lineStart &&
        /[A-Za-z0-9]/.test(chars[chars.length - 1].ch)
      ) {
        line++;
        let nx = 0;
        for (let j = lastSp + 1; j < chars.length; j++) {
          chars[j].line = line;
          chars[j].x = nx;
          nx += chars[j].w;
        }
        x = nx;
        lineStart = lastSp + 1;
        lastSp = -1;
      } else {
        line++;
        x = 0;
        lineStart = chars.length;
        lastSp = -1;
      }
    }
    chars.push({ ch, i, len, x, w, line });
    x += w;
    if (ch === " ") lastSp = chars.length - 1;
    i += len - 1;
  }
  const last = chars[chars.length - 1];
  const lines = last ? (last.nl ? last.line + 1 : last.line) + 1 : 1;
  view.cache = { key, chars, lines };
  return view.cache;
}

function caretPos(lay, idx) {
  const ch = lay.chars;
  for (let q = 0; q < ch.length; q++)
    if (ch[q].i >= idx) return { x: ch[q].x, line: ch[q].line };
  if (!ch.length) return { x: 0, line: 0 };
  const l = ch[ch.length - 1];
  return l.nl ? { x: 0, line: l.line + 1 } : { x: l.x + l.w, line: l.line };
}

/* ----- 구름 모양 그리기 ----- */
function cloudPts(cx, cy, a, b, rr, n, t) {
  const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  const base = Math.max(rr, (per / n) * 0.64);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const th = (k / n) * TWO_PI,
      v = frac(Math.sin(k * 12.9898) * 43758.5453);
    pts.push({
      x: cx + Math.cos(th) * a,
      y: cy + Math.sin(th) * b,
      r: base * (0.9 + 0.2 * v) * (1 + 0.035 * Math.sin(t * 1.5 + k * 1.7)),
    });
  }
  return pts;
}

function paintCloud(ctx, pts, cx, cy, a, b, fillCol, outCol, glow, lw) {
  const path = (grow) => {
    ctx.beginPath();
    for (const p of pts) {
      ctx.moveTo(p.x + p.r + grow, p.y);
      ctx.arc(p.x, p.y, p.r + grow, 0, TWO_PI);
    }
    ctx.moveTo(cx + a + grow, cy);
    ctx.ellipse(cx, cy, a + grow, b + grow, 0, 0, TWO_PI);
  };
  ctx.save();
  ctx.shadowBlur = glow;
  ctx.shadowColor = outCol;
  ctx.fillStyle = outCol;
  path(lw);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = fillCol;
  path(0);
  ctx.fill();
  ctx.restore();
}

function dotGlow(ctx, x, y, r, fillCol, glowCol, blur) {
  ctx.save();
  ctx.shadowBlur = blur;
  ctx.shadowColor = glowCol;
  ctx.fillStyle = glowCol;
  ctx.beginPath();
  ctx.arc(x, y, r + 1.4, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = fillCol;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

// 구름 한 덩이(중심이 0,0) — 입력/읽기/날아가는 연출이 모두 이 함수를 쓴다
function drawThoughtCloud(g, lay, births, o) {
  const ctx = drawingContext,
    t = o.t,
    now = millis();
  const pts = cloudPts(0, 0, g.a, g.b, g.rr, 38, t);
  ctx.save();
  ctx.globalAlpha = constrain(o.alpha, 0, 1);
  if (o.tail) {
    // 꼬리 방울 — 아래 실타래 쪽으로 이어진다
    const by = g.b + g.rr;
    const tl = [
      [-g.a * 0.1, by + g.rr * 0.5, g.rr * 0.42],
      [-g.a * 0.07, by + g.rr * 1.3, g.rr * 0.27],
      [-g.a * 0.04, by + g.rr * 1.9, g.rr * 0.16],
    ];
    tl.forEach((q, k) =>
      dotGlow(
        ctx,
        q[0],
        q[1] + Math.sin(t * 2 + k) * 2,
        q[2],
        "#f8eaf6",
        o.col,
        10,
      ),
    );
  }
  paintCloud(ctx, pts, 0, 0, g.a, g.b, "#f8eaf6", o.col, 22, 2.5);
  ctx.save(); // 구름을 따라 박음질
  ctx.setLineDash([7, 6]);
  ctx.lineDashOffset = -t * 6;
  ctx.strokeStyle = "rgba(255,45,149,0.55)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, g.a, g.b, 0, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();

  const left = -g.tw / 2,
    top = -g.th / 2,
    sc = o.scroll;
  ctx.beginPath();
  ctx.rect(left - 10, top - 2, g.tw + 20, g.th + 4);
  ctx.clip();
  ctx.save(); // 줄마다 실로 박은 줄선
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(255,45,149,0.3)";
  ctx.lineWidth = 1;
  for (let L = Math.floor(sc) - 1; L <= sc + g.vis + 1; L++) {
    const y = top + (L - sc + 0.5) * g.leading + g.leading * 0.4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + g.tw, y);
    ctx.stroke();
  }
  ctx.restore();

  push();
  noStroke();
  textStyle(BOLD);
  textSize(g.fs);
  textAlign(LEFT, CENTER);
  const L0 = sc - 1.5,
    L1 = sc + g.vis + 1.5;
  if (o.selA !== o.selB) {
    fill(255, 45, 149, 80);
    for (const e of lay.chars) {
      if (
        !e.nl &&
        e.i >= o.selA &&
        e.i < o.selB &&
        e.line >= L0 &&
        e.line <= L1
      )
        rect(
          left + e.x,
          top + (e.line - sc) * g.leading + 3,
          e.w,
          g.leading - 6,
        );
    }
  }
  for (const e of lay.chars) {
    // 글자는 아래에서 떠올라, 마젠타 잉크가 스며 짙은 자두색으로 가라앉는다
    if (e.line < L0 || e.line > L1 || e.nl || e.ch === " ") continue;
    const bt = births[e.i];
    const age = now - (bt === undefined ? -1e9 : bt);
    if (age < 0) continue;
    const kq = Math.min(age / 450, 1),
      ee = 1 - Math.pow(1 - kq, 3),
      ink = Math.min(age / 1600, 1);
    fill(
      255 + (46 - 255) * ink,
      45 + (14 - 45) * ink,
      149 + (58 - 149) * ink,
      255 * ee,
    );
    text(
      e.ch,
      left + e.x,
      top +
        (e.line - sc + 0.5) * g.leading +
        (1 - ee) * 16 +
        Math.sin(t * 1.4 + e.i * 0.55) * 0.8,
    );
  }
  if (o.empty) {
    fill(46, 14, 58, 95);
    text("생각을 적어 보세요…", left + 12, top + 0.5 * g.leading);
  }
  let out = null;
  if (o.caret) {
    // 캐럿: 빛나는 바늘
    const x = left + o.caret.x,
      y = top + (o.caret.line - sc + 0.5) * g.leading;
    const solid = now - view.lastInput < 700;
    const al = solid ? 1 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((now / 1000) * 5));
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255,45,149,0.9)";
    stroke(255, 45, 149, 255 * al);
    strokeWeight(2.2);
    line(x, y - g.fs * 0.62, x, y + g.fs * 0.62);
    out = { x, y };
  }
  pop();
  ctx.restore();
  return out;
}

/* ----- 입력/읽기 화면 ----- */
function drawOverlay(t) {
  const target = view.mode ? 1 : 0;
  view.k += (target - view.k) * 0.2;
  if (Math.abs(target - view.k) < 0.004) view.k = target;
  if (view.k > 0.002) drawThinking(t);
  drawTyings(t);
  drawSparks();
}

function drawThinking(t) {
  const ctx = drawingContext,
    now = millis();
  const ta = $("memoText");
  if (view.mode === "edit") view.text = ta.value;
  const base = cloudBase();
  const lay = layoutText(view.text, base.tw, base.fs);

  if (view.mode && now - view.measT > 300) {
    const pn = $(view.kind === "read" ? "rdPanel" : "edPanel");
    view.reserve = (pn ? pn.offsetHeight : 150) + 16;
    view.measT = now;
  }
  const wantTp = view.mode === "edit" && queue.length ? 108 : 0;
  view.tp += (wantTp - view.tp) * 0.15;
  const tp = view.tp;
  const availH = H - view.reserve - tp - 2 * base.rr - 36;
  const maxLines = Math.max(
    2,
    Math.floor((availH / 2 - 6) / 0.78 / base.leading),
  );
  const minLines = Math.min(view.kind === "read" ? 2 : 3, maxLines);
  const vis = constrain(lay.lines, minLines, maxLines);
  if (view.th < 1) view.th = vis * base.leading;
  else view.th += (vis * base.leading - view.th) * 0.16;
  const th = view.th,
    bb = th * 0.78 + 6;
  const g = Object.assign({}, base, { th, b: bb, vis, lines: lay.lines });

  let selA = 0,
    selB = 0,
    caretIdx = view.text.length;
  if (view.mode === "edit") {
    selA = ta.selectionStart;
    selB = ta.selectionEnd;
    caretIdx = ta.selectionDirection === "backward" ? selA : selB;
  }
  const cp = caretPos(lay, caretIdx);
  if (view.mode === "edit") {
    // 캐럿이 늘 보이도록 구름 속 글이 따라 흐른다
    if (cp.line < view.scrollT) view.scrollT = cp.line;
    if (cp.line > view.scrollT + vis - 1) view.scrollT = cp.line - vis + 1;
  }
  view.scrollT = constrain(view.scrollT, 0, Math.max(0, lay.lines - vis));
  view.scroll += (view.scrollT - view.scroll) * 0.25;

  const cx = W / 2,
    cy = Math.max(bb + base.rr + 16 + tp, (H - view.reserve + tp) / 2);
  const kk = constrain(view.k, 0, 1),
    s = easeOutBack(kk);
  const dt = now - view.shake;
  const sh = dt < 380 ? Math.sin(dt * 0.07) * 10 * (1 - dt / 380) : 0;
  const px = lerp(view.from.x, cx, kk) + sh,
    py = lerp(view.from.y, cy, kk);
  Object.assign(view, { geom: g, px, py, ps: s, lastG: g, lastLay: lay });

  // 막: 세상이 어두워지고, 구름 쪽에서 마젠타 빛이 번진다
  ctx.save();
  ctx.fillStyle = "rgba(4,0,10," + (0.5 * kk).toFixed(3) + ")";
  ctx.fillRect(0, 0, W, H);
  const gl = ctx.createRadialGradient(px, py, 10, px, py, Math.max(W, H) * 0.6);
  gl.addColorStop(0, "rgba(255,45,149," + (0.2 * kk).toFixed(3) + ")");
  gl.addColorStop(1, "rgba(255,45,149,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (view.hideCloud) return;

  let col = "#ff6fb9";
  if (view.mode === "edit") {
    const b = getBundle(edit.bundle);
    if (b) col = b.color;
  } else if (view.mode === "read") col = view.col || col;
  else col = view.curCol || col;
  view.curCol = col;

  // 하늘에서 내려온 아리아드네의 실 — 생각이 이 실에 매달려 있다
  push();
  noFill();
  stroke(255, 45, 149, 255 * kk);
  strokeWeight(2);
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255,45,149,0.9)";
  const topY = py - (bb + base.rr) * s + 10;
  beginShape();
  for (let y = -10; y < topY; y += 12) {
    const u = (y + 10) / Math.max(1, topY + 10);
    vertex(px + Math.sin(y * 0.025 + t * 1.6) * 9 * (1 - u * 0.7), y);
  }
  vertex(px, topY);
  endShape();
  noStroke();
  fill(255, 45, 149, 255 * kk);
  circle(px, topY, 8);
  pop();

  push();
  translate(px, py);
  scale(s);
  const cl = drawThoughtCloud(g, lay, view.births, {
    t,
    alpha: kk,
    col,
    tail: true,
    scroll: view.scroll,
    selA,
    selB,
    caret: view.mode === "edit" ? cp : null,
    empty: view.mode === "edit" && !view.text,
  });
  pop();
  if (cl) {
    view.caret.x = px + cl.x * s;
    view.caret.y = py + cl.y * s;
  }
  drawQueue(t, kk);
}

// 구름을 눌렀을 때: 그 자리에 캐럿을 놓고, 구름 밖을 누르면 접는다
function handleCloudClick() {
  if (view.mode === "edit") {
    // 빨랫줄에 걸어 둔 생각을 누르면 다시 꺼내 쓴다
    for (const h of view.qHits) {
      if (
        Math.abs(mouseX - h.x) < h.w / 2 &&
        Math.abs(mouseY - h.y) < h.h / 2
      ) {
        recallQueued(h.i);
        return;
      }
    }
  }
  const g = view.geom;
  if (!g || view.hideCloud) return;
  const s = easeOutBack(constrain(view.k, 0, 1)) || 1;
  const lx = (mouseX - view.px) / s,
    ly = (mouseY - view.py) / s;
  const inside =
    Math.pow(lx / (g.a + g.rr + 8), 2) + Math.pow(ly / (g.b + g.rr + 8), 2) <=
    1;
  if (!inside) {
    if (view.mode === "edit") closeEditor();
    else closeReader();
    return;
  }
  if (view.mode !== "edit" || !view.cache) return;
  const ln = Math.floor((ly + g.th / 2) / g.leading + view.scroll);
  const tx = lx + g.tw / 2;
  let pos = ln < 0 ? 0 : view.text.length;
  const ent = view.cache.chars.filter((e) => e.line === ln);
  if (ent.length) {
    const l = ent[ent.length - 1];
    pos = l.nl ? l.i : l.i + l.len;
    for (const e of ent) {
      if (tx < e.x + e.w / 2) {
        pos = e.i;
        break;
      }
    }
  }
  const ta = $("memoText");
  ta.focus();
  ta.setSelectionRange(pos, pos);
  view.lastInput = millis();
}

/* ----- 묶는 순간: 구름이 작은 생각 풍선으로 응축되어 실 끝으로 날아간다 ----- */
function startTie(m, snap, src, idx) {
  const b = getBundle(m.bundle);
  tyings.push({
    t0: millis() + idx * 260,
    id: m.id,
    g: snap.g,
    lay: snap.lay,
    births: snap.births,
    sx: src.x,
    sy: src.y,
    s0: src.s,
    scroll: snap.scroll || 0,
    col: b ? b.color : "#ff6fb9",
    trail: [],
    doneAt: 0,
    hold: 3.4 + idx * 1.4,
  });
}

function drawTyings(t) {
  for (let q = tyings.length - 1; q >= 0; q--)
    if (!drawTying(tyings[q], t)) tyings.splice(q, 1);
}

function drawTying(T, t) {
  const now = millis();
  const mi = state.memos.findIndex((m) => m.id === T.id);
  if (mi < 0) return false;
  const an = posAt(stepOf(mi)),
    kb = an.s * SC;
  const tx = an.x,
    ty = an.y - 8 * an.s - (CARD_OFF + CARD_H / 2) * kb;
  const p = (now - T.t0) / 1100,
    pe = constrain(p, 0, 1);
  const e = pe < 0.5 ? 4 * pe * pe * pe : 1 - Math.pow(-2 * pe + 2, 3) / 2;
  const swoop = Math.sin(e * Math.PI);
  const x = lerp(T.sx, tx, e) + swoop * 110,
    y = lerp(T.sy, ty, e) - swoop * 70;
  const endS = (2 * (58 + 13) * kb) / (2 * (T.g.a + T.g.rr));
  const sc = lerp(T.s0, endS, e);
  if (p >= 1 && !T.doneAt && (born[T.id] !== undefined || p > T.hold))
    T.doneAt = now; // 실이 닿아 매듭이 지어지면 풍선으로 바뀐다
  const al = T.doneAt ? 1 - (now - T.doneAt) / 320 : 1;
  if (al <= 0) return false;
  if (p >= 0) {
    T.trail.push({ x, y });
    if (T.trail.length > 22) T.trail.shift();
  }
  if (T.trail.length > 1) {
    push();
    noFill();
    stroke(255, 45, 149, 200 * al);
    strokeWeight(2);
    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = "rgba(255,45,149,0.9)";
    beginShape();
    T.trail.forEach((q) => vertex(q.x, q.y));
    endShape();
    pop();
  }
  push();
  translate(x, y);
  scale(sc);
  drawThoughtCloud(T.g, T.lay, T.births, {
    t,
    alpha: al,
    col: T.col,
    tail: false,
    scroll: T.scroll,
  });
  pop();
  if (p >= 0 && p < 1 && Math.random() < 0.6) spawnSparks(x, y, 1);
  return true;
}

/* ----- 반짝이는 잉크 방울과 하트 ----- */
function spawnSparks(x, y, n) {
  for (let k = 0; k < n; k++) {
    if (sparks.length > 140) sparks.shift();
    sparks.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 1.8,
      vy: -0.5 - Math.random() * 1.5,
      age: 0,
      max: 700 + Math.random() * 600,
      s: 2 + Math.random() * 3,
      h: Math.random() < 0.4,
    });
  }
}

function drawSparks() {
  if (!sparks.length) return;
  const dt = Math.min(deltaTime, 50) / 16.7;
  push();
  noStroke();
  for (let q = sparks.length - 1; q >= 0; q--) {
    const sp = sparks[q];
    sp.age += deltaTime;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.vx *= 0.985;
    sp.vy *= 0.985;
    const u = sp.age / sp.max;
    if (u >= 1) {
      sparks.splice(q, 1);
      continue;
    }
    fill(255, 95 + 100 * (1 - u), 190, 255 * (1 - u));
    if (sp.h) heart(sp.x, sp.y, sp.s * 1.2);
    else circle(sp.x, sp.y, sp.s);
  }
  pop();
}

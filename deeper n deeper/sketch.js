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
  return s.length > 52 ? s.slice(0, 52) + "…" : s;
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
  textFont('"Noto Serif KR", "Nanum Myeongjo", serif');
  if (typeof textWrap === "function") textWrap(CHAR);
  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 14px "Noto Serif KR"', "가나다라마바사");
    document.fonts.load('400 14px "Noto Serif KR"', "가나다라마바사");
    document.fonts.load("600 14px Cinzel", "XIVI");
  }
  calcLayout();
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
  updateHover();
}

function updateScroll() {
  scrollY += (scrollTarget - scrollY) * 0.14;
  if (Math.abs(scrollTarget - scrollY) < 0.05) scrollY = scrollTarget;
  spin += (scrollY * SPIN - spin) * 0.08; // 살짝 늦게 따라와서 멈춘 뒤에도 관성으로 돈다
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
    if (born[id] === undefined && threadEnd >= stepOf(k)) born[id] = millis();
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
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
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
  text("실의 시작", 0, -22 * SC);
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
  line(-r * 0.4, 0, r * 0.4, 0);
  line(0, -r * 0.4, 0, r * 0.4);
  noStroke();
  fill(255, 225, 235, hov ? 255 : 175);
  textAlign(CENTER, CENTER);
  textSize(11 * SC + 1);
  text("다음 생각을 묶는다", 0, -r - 12 * SC);
  pop();
  hitRects.push({ type: "slot", x: ax, y: cy, r: r * 1.3 });
}

/* ----- 메모(종이쪽지) ----- */
const CARD_W = 150,
  CARD_H = 96,
  CARD_OFF = 22;

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

  // 종이쪽지
  push();
  translate(ax, ay);
  rotate(rot);
  scale(sc);
  drawingContext.globalAlpha = constrain(ap, 0, 1) * fa * ba;
  stroke(255, 45, 149, 200);
  strokeWeight(1.4);
  line(0, 0, 0, -CARD_OFF);
  const top = -CARD_OFF - CARD_H;
  noStroke();
  fill(0, 0, 0, 80);
  rect(-CARD_W / 2 + 4, top + 5, CARD_W, CARD_H, 3);
  if (hov) {
    drawingContext.shadowBlur = 26;
    drawingContext.shadowColor = col;
  }
  fill(250, 232, 243);
  rect(-CARD_W / 2, top, CARD_W, CARD_H, 3);
  drawingContext.shadowBlur = 0;
  fill(col);
  rect(-CARD_W / 2, top, CARD_W, 15, 3, 3, 0, 0);
  push();
  translate(0, top);
  rotate(-0.05);
  fill(255, 255, 255, 120);
  rect(-18, -7, 36, 13);
  pop();
  fill(30, 15, 45);
  textAlign(LEFT, TOP);
  textSize(9);
  text(fmtDate(m.ts), -CARD_W / 2 + 7, top + 3);
  fill(46, 28, 60);
  textSize(11.5);
  textLeading(15);
  text(snip(m.text), -CARD_W / 2 + 9, top + 21, CARD_W - 18, CARD_H - 26);
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
  textFont('Cinzel, "Noto Serif KR", serif');
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

  const days = ["일", "월", "화", "수", "목", "금", "토"];
  noStroke();
  textAlign(RIGHT, TOP);
  fill(255, 235, 245);
  textSize(17 * cs);
  text(
    two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds()),
    W - 20,
    cy + r + 10,
  );
  fill(255, 200, 220, 170);
  textSize(11);
  text(
    d.getFullYear() +
      "년 " +
      (d.getMonth() + 1) +
      "월 " +
      d.getDate() +
      "일 " +
      days[d.getDay()] +
      "요일",
    W - 20,
    cy + r + 10 + 22 * cs,
  );

  // 깊이 (좌상단, 버튼 아래)
  textAlign(LEFT, TOP);
  const depth = Math.max(0, Math.floor(scrollY / GAP));
  fill(255, 220, 235, 190);
  textSize(12);
  text("DEPTH  " + String(depth).padStart(4, "0"), 20, 66);
  fill(255, 200, 220, 130);
  textSize(11);
  text(
    "묶인 생각 " + state.memos.length + " · 묶음 " + state.bundles.length,
    20,
    86,
  );

  // 안내 문구
  textAlign(CENTER, CENTER);
  if (state.memos.length === 0 && scrollY < 1200) {
    fill(255, 225, 238, 150 + 40 * Math.sin(t * 2));
    textSize(13);
    text(
      "아래로 스크롤해 내려가세요 — 실이 닿은 자리에 첫 생각을 묶을 수 있어요",
      W / 2,
      H - 112,
    );
  } else if (state.memos.length > 0 && scrollY < 90) {
    fill(255, 225, 238, 150 + 40 * Math.sin(t * 2));
    textSize(13);
    text("↓ 아래로 내려가며 묶어 둔 생각들을 따라가세요", W / 2, H - 112);
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
  if (!pressInfo || uiOpen()) return;
  if (Math.abs(mouseX - pressInfo.x) + Math.abs(mouseY - pressInfo.y) > 6)
    pressInfo.moved = true;
  if (pressInfo.moved)
    scrollTarget = Math.max(0, scrollTarget - (mouseY - pmouseY) * 1.4);
}

function mouseReleased() {
  if (!pressInfo) return;
  const was = pressInfo;
  pressInfo = null;
  if (was.moved || uiOpen()) return;
  const h = hitTest(mouseX, mouseY);
  if (!h) return;
  if (h.type === "slot") openEditor(null);
  else openReader(h.id);
}

window.addEventListener(
  "wheel",
  (e) => {
    if (!e.target || e.target.tagName !== "CANVAS" || uiOpen()) return;
    e.preventDefault();
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
  $("reader").classList.remove("open");
  $("book").classList.remove("open");
  $("drawer").classList.remove("open");
}

/* ----- 에디터 ----- */
function renderChips() {
  const box = $("chips");
  box.innerHTML = "";
  const mk = (label, id, color) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (edit.bundle === id ? " on" : "");
    b.textContent = label;
    if (color) b.style.borderColor = color;
    b.addEventListener("click", () => {
      edit.bundle = id;
      $("newBundleWrap").classList.remove("show");
      $("newBundle").value = "";
      renderChips();
    });
    box.appendChild(b);
  };
  mk("묶음 없음", null, null);
  state.bundles.forEach((b) => mk(b.name, b.id, b.color));
  const nb = document.createElement("button");
  nb.type = "button";
  nb.className =
    "chip" + ($("newBundleWrap").classList.contains("show") ? " on" : "");
  nb.textContent = "＋ 새 묶음";
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

function openEditor(id) {
  closeAll();
  edit.id = id;
  edit.open = true;
  $("newBundle").value = "";
  $("newBundleWrap").classList.remove("show");
  if (id) {
    const m = state.memos.find((x) => x.id === id);
    if (!m) {
      edit.open = false;
      return;
    }
    $("edTitle").textContent = "생각을 고쳐 묶는다";
    $("memoText").value = m.text;
    edit.bundle = m.bundle || null;
    $("edSave").textContent = "고쳐 묶기 (Ctrl+Enter)";
  } else {
    $("edTitle").textContent = "무엇을 떠올렸나요?";
    let draft = "";
    try {
      draft = localStorage.getItem(DRAFT_KEY) || "";
    } catch (e) {
      /* 무시 */
    }
    $("memoText").value = draft;
    edit.bundle =
      state.lastBundle && getBundle(state.lastBundle) ? state.lastBundle : null;
    $("edSave").textContent = "실로 묶기 (Ctrl+Enter)";
  }
  updateCount();
  renderChips();
  $("editor").classList.add("open");
  setTimeout(() => {
    const ta = $("memoText");
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
  $("editor").classList.remove("open");
}

function updateCount() {
  $("edCount").textContent = $("memoText").value.length + "자";
}

function submitEditor() {
  const text = $("memoText").value.trim();
  if (!text) {
    const ta = $("memoText");
    ta.classList.remove("shake");
    void ta.offsetWidth;
    ta.classList.add("shake");
    return;
  }
  // 새 묶음 만들기
  const nbName = $("newBundle").value.trim();
  let bundleId = edit.bundle;
  if (nbName) {
    const nb = {
      id: uid(),
      name: nbName,
      color: BUNDLE_COLORS[state.bundles.length % BUNDLE_COLORS.length],
    };
    state.bundles.push(nb);
    bundleId = nb.id;
  }
  if (edit.id) {
    const m = state.memos.find((x) => x.id === edit.id);
    if (m) {
      m.text = text;
      m.bundle = bundleId || null;
      m.edited = Date.now();
    }
  } else {
    const m = { id: uid(), text, ts: Date.now(), bundle: bundleId || null };
    state.memos.push(m);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      /* 무시 */
    }
    scrollTarget = Math.max(0, stepOf(state.memos.length - 1) * GAP - H * 0.32); // 실이 닿는 곳으로 내려간다
  }
  state.lastBundle = bundleId || null;
  saveState();
  edit.open = false;
  $("editor").classList.remove("open");
  renderDrawer();
  refreshFocusBar();
}

/* ----- 리더 ----- */
let readingId = null;
function openReader(id) {
  const m = state.memos.find((x) => x.id === id);
  if (!m) return;
  closeAll();
  readingId = id;
  const b = getBundle(m.bundle);
  const idx = state.memos.indexOf(m) + 1;
  $("rdMeta").innerHTML =
    `<span>${idx}번째 매듭</span><span>·</span><span>${fmtDate(m.ts)}</span>` +
    (m.edited ? "<span>· 고쳐 씀</span>" : "") +
    (b
      ? `<span>·</span><i style="background:${b.color}"></i><span>${esc(b.name)}</span>`
      : "");
  $("rdText").textContent = m.text;
  $("reader").classList.add("open");
}

/* ----- 묶음 서랍 ----- */
function renderDrawer() {
  const counts = {};
  let none = 0;
  state.memos.forEach((m) => {
    if (m.bundle) counts[m.bundle] = (counts[m.bundle] || 0) + 1;
    else none++;
  });
  let html = `<li class="${focus === null ? "on" : ""}" data-f="">전체 보기<span>${state.memos.length}</span></li>`;
  state.bundles.forEach((b) => {
    html += `<li class="${focus === b.id ? "on" : ""}" data-f="${b.id}"><i style="background:${b.color};color:${b.color}"></i>${esc(b.name)}<span>${counts[b.id] || 0}</span><button class="x" data-del="${b.id}" title="묶음 풀기">✕</button></li>`;
  });
  if (none > 0) {
    html += `<li class="${focus === "__none" ? "on" : ""}" data-f="__none"><i style="background:#e8e0ff"></i>묶이지 않은 생각<span>${none}</span></li>`;
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
  if (focus === "__none") return { name: "묶이지 않은 생각", color: "#e8e0ff" };
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
    : "비어 있음";
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
    `<i style="width:12px;height:12px;border-radius:50%;display:inline-block;background:${f.color};box-shadow:0 0 8px ${f.color}"></i>${esc(f.name)} <small style="opacity:.55;font-weight:400">· 매듭 ${fm.length}개</small>`;
  $("bkList").innerHTML = fm.length
    ? fm
        .map((mi, j) => {
          const m = state.memos[mi];
          return `<article><header>${j + 1}번째 · ${fmtDate(m.ts)}</header><p>${esc(m.text)}</p><button data-mi="${mi}">이 매듭으로 내려가기</button></article>`;
        })
        .join("")
    : '<p style="opacity:.6">아직 이 묶음에는 생각이 없어요.</p>';
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
          '"' +
            b.name +
            '" 묶음을 풀까요?\n(안에 있던 생각은 지워지지 않고 묶음만 해제돼요)',
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

  $("memoText").addEventListener("input", () => {
    updateCount();
    if (!edit.id) {
      try {
        localStorage.setItem(DRAFT_KEY, $("memoText").value);
      } catch (e) {
        /* 무시 */
      }
    }
  });
  $("edSave").addEventListener("click", submitEditor);
  $("edCancel").addEventListener("click", closeEditor);
  $("newBundle").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("memoText").focus();
    }
  });

  $("rdClose").addEventListener("click", () =>
    $("reader").classList.remove("open"),
  );
  $("rdEdit").addEventListener("click", () => {
    const id = readingId;
    $("reader").classList.remove("open");
    openEditor(id);
  });
  $("rdDel").addEventListener("click", () => {
    const m = state.memos.find((x) => x.id === readingId);
    if (!m) return;
    if (confirm("이 생각의 실을 풀어 지울까요? 되돌릴 수 없어요.")) {
      state.memos = state.memos.filter((x) => x.id !== readingId);
      delete born[readingId];
      saveState();
      $("reader").classList.remove("open");
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

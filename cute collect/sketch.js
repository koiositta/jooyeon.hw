/* =========================================================
   Cute♡Collect  —  p5.js + ml5.js (handPose)
   모바일 전용 웹앱 · Firebase(Firestore)로 친구들과 공유

   · 디자인 기준 크기: 1080 x 1920 (일러스트 아트보드와 똑같이)
   · 모든 위치(L)는 이 크기 기준 좌표예요.
   · 그래픽 넣는 법: ASSETS에 파일 경로를 적으면 그 이미지가 나오고,
     null이면 임시 도형이 그려져요.
   ========================================================= */

const W = 1080;
const H = 1920;

const C = {
  bg: "#F9D3EC",
  pink: "#E8308A",
  mint: "#B8DDB4",
  ink: "#2B1A22",
  white: "#FFFFFF",
};

/* ---------- 1. 그래픽 파일 (나중에 여기만 바꾸면 돼요) ----------
   예) logo: 'assets/logo.png'
   각 이미지는 아래 L(레이아웃)의 같은 이름 칸 크기에 맞춰 그려져요.
   전체 화면 그래픽(mainBg, cameraFrame, listBg)은 1080x1920으로 만들어 주세요.
   ------------------------------------------------------------- */
const ASSETS = {
  // 메인 (06)
  mainBg: null, // 메인 배경 1080x1920
  logo: null, // Cute♡Collect 로고
  collectHeart: null, // 큰 하트 "collect!" → 카메라
  myHeart: null, // 작은 하트 (왼쪽) → 내 컬렉션
  shareHeart: null, // 작은 하트 (오른쪽) → 공유
  bestHeart: null, // 작은 하트 (아래) → 점수 랭킹

  // 카메라 (07)
  cameraFrame: null, // 장식 프레임 1080x1920 (가운데 투명 PNG)
  cameraLogo: null, // 위쪽 로고
  crosshair: null, // 가운데 + 표시
  indicator: null, // 손하트 인식 표시 하트
  bar: null, // 아래 타원 바
  galleryBtn: null, // 컬렉션 버튼 (없으면 최근 사진이 보여요)
  flipBtn: null, // 카메라 전환

  // 공통 버튼
  backBtn: null,
  saveBtn: null,
  deleteBtn: null,
  scoreKnob: null, // 점수 바 손잡이 (하트)
  scoreBadge: null, // 컬렉션 썸네일 위 점수 배경

  // 컬렉션
  listBg: null, // 컬렉션 배경 1080x1920
  listTitleMy: null,
  listTitleBest: null,
  emptyHeart: null, // 컬렉션이 비었을 때

  // share (나랑 친구들 프로필)
  peopleTitle: null,
  personCard: null, // 프로필 카드 배경 (940x220)
  avatarFrame: null, // 프로필 사진 테두리
  editBtn: null, // 내 닉네임 바꾸기
};

/* ---------- 2. 레이아웃 (1080x1920 기준) ---------- */
const L = {
  main: {
    logo: { x: 60, y: 40, w: 960, h: 130 },
    collect: { x: 60, y: 470, w: 960, h: 970 },
    my: { x: 45, y: 1255, w: 310, h: 315 },
    share: { x: 720, y: 1255, w: 310, h: 315 },
    best: { x: 385, y: 1505, w: 310, h: 315 },
  },
  top: {
    back: { x: 70, y: 80, w: 130, h: 130 },
    logo: { x: 230, y: 95, w: 620, h: 100 },
  },
  camera: {
    view: { x: 0, y: 0, w: W, h: H }, // 카메라 영상 = 사진 영역
    cross: { x: 466, y: 993, w: 120, h: 120 },
    indicator: { x: 735, y: 1395, w: 140, h: 126 },
  },
  bar: {
    box: { x: 130, y: 1570, w: 820, h: 200 },
    left: { x: 170, y: 1600, w: 140, h: 140 },
    center: { x: 460, y: 1590, w: 160, h: 160 },
    right: { x: 770, y: 1600, w: 140, h: 140 },
    slider: { x: 190, y: 1605, w: 560, h: 130 }, // 점수 바 (1~100)
  },
  score: { x: 290, y: 1300, w: 500, h: 240 }, // 큰 점수 숫자
  list: {
    top: 300, // 그리드 시작 y
    x0: 70,
    gap: 40,
    cols: 2,
    thumbH: 600,
  },
  people: {
    top: 300,
    x0: 70,
    cardH: 220,
    gap: 30,
  },
};

/* ---------- 3. 설정 ---------- */
const LINE = {
  draw: 9, // 화면에 그리는 하트 선 (분홍)
  glow: 5, // 그 선의 흰 테두리 (양쪽으로 더해지는 두께)
  ui: 3, // 프레임, 바, 십자 등 UI 선
  icon: 0.055, // 아이콘 선 (버튼 지름 대비)
};
const HOLD_MS = 900; // 손하트를 이만큼 유지하면 촬영
const PHOTO_W = 576; // 저장 사진 크기 (9:16, Firestore 1MB 제한 안으로)
const PHOTO_H = 1024;
const DEFAULT_SCORE = 50;

// 카메라가 안 켜질 때 보여줄 짧은 안내 [큰 글씨, 작은 글씨]
const CAM_MSG = {
  NotAllowedError: [
    "카메라 권한이 꺼져 있어요",
    "브라우저 설정에서 허용한 뒤 화면을 눌러주세요",
  ],
  NotFoundError: ["카메라를 찾을 수 없어요", "화면을 눌러 다시 시도"],
  NotReadableError: [
    "다른 앱이 카메라를 쓰고 있어요",
    "그 앱을 닫고 화면을 눌러주세요",
  ],
  inapp: [
    "Safari나 Chrome에서 열어주세요",
    "앱 안의 브라우저는 카메라가 막혀 있어요",
  ],
  http: ["https 주소로 열어주세요", "http 주소에서는 카메라가 막혀 있어요"],
  unsupported: [
    "카메라를 지원하지 않는 브라우저예요",
    "Safari나 Chrome에서 열어주세요",
  ],
  error: ["카메라를 켤 수 없어요", "화면을 눌러 다시 시도"],
};

/* ---------- 상태 ---------- */
let img = {}; // 불러온 그래픽
let s = 1,
  ox = 0,
  oy = 0; // 화면 배율 / 여백
let scene = "main";

// 나 (이 폰) — 처음 들어올 때 자동으로 아이디가 생겨요
const ME = {
  uid:
    localStorage.getItem("cc.uid") ||
    "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
  name: localStorage.getItem("cc.name") || "",
};
localStorage.setItem("cc.uid", ME.uid);

let thumbs = {}; // 사진 id → p5.Image
let avatars = {}; // 프로필 사진
let myLatest = null,
  myLatestT = 0; // 카메라 화면 왼쪽 버튼에 보일 내 최근 사진

let videoEl = null;
let facing = "environment"; // 'environment' 후면, 'user' 전면
let camReady = false,
  camError = "";

// 카톡·인스타 등 앱 안 브라우저는 카메라가 막혀 있는 경우가 많음
const UA = navigator.userAgent || "";
const IN_APP =
  /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|everytimeApp|DaumApps/i.test(
    UA,
  );

// 카톡에서 열면 기본 브라우저로 다시 열기
if (/KAKAOTALK/i.test(UA)) {
  location.href =
    "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
}
let crop = { sx: 0, sy: 0, sw: 1, sh: 1 };

let handPose = null,
  modelReady = false,
  detecting = false;
let hands = [];
const DEBUG = /[?&]debug/.test(location.search);
let debugInfo = null;
let holdMs = 0,
  heartPt = null;

let photo = null; // 방금 찍은 사진 (p5.Graphics)
let curStroke = null; // 카메라 화면에 그리는 중인 선
let fading = []; // 하트로 인식 안 된 선 (사라지는 중)
let rating = DEFAULT_SCORE; // 1~100
let sliding = false; // 점수 바 드래그 중

let listMode = "my"; // 'my' | 'best' | 'user'
let listUser = null; // 'user'일 때 그 친구
let listItems = null; // null이면 불러오는 중
let people = null; // share 화면 프로필 목록
let scrollY = 0;
let loadToken = 0;
let uploading = false;
let detailItem = null;
let delArmed = false;

let flash = 0;
let fadeIn = 0; // 화면 바뀔 때 부드럽게
let toastMsg = "",
  toastT = 0;

const pointer = {
  down: false,
  x: 0,
  y: 0,
  sx: 0,
  sy: 0,
  moved: false,
  startScroll: 0,
};

/* =========================================================
   p5 기본 함수
   ========================================================= */
function preload() {
  for (const k in ASSETS) {
    if (ASSETS[k]) {
      img[k] = loadImage(
        ASSETS[k],
        () => {},
        () => {
          img[k] = null;
          console.warn("이미지 못 찾음:", ASSETS[k]);
        },
      );
    }
  }
}

function setup() {
  pixelDensity(Math.min(2, displayDensity()));
  const cnv = createCanvas(windowWidth, windowHeight);
  fit();
  DB.init();
  DB.photosByUser(ME.uid)
    .then((arr) => {
      if (arr[0]) loadThumb(arr[0]);
    })
    .catch(() => {});

  const el = cnv.elt;
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", () => {
    pointer.down = false;
    curStroke = null;
    sliding = false;
  });

  // 손 인식 모델은 미리 불러 둠
  if (typeof ml5 !== "undefined") {
    handPose = ml5.handPose({ maxHands: 2, flipped: false }, () => {
      modelReady = true;
      tryDetect();
    });
  } else {
    console.warn("ml5를 못 불러왔어요 — 손하트 인식 없이 동작");
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCamera();
    else if (scene === "camera") startCamera();
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fit();
}

function fit() {
  s = Math.min(width / W, height / H);
  ox = (width - W * s) / 2;
  oy = (height - H * s) / 2;
}

function draw() {
  background(
    scene === "camera" || scene === "review" || scene === "detail"
      ? C.ink
      : C.bg,
  );

  push();
  translate(ox, oy);
  scale(s);

  if (scene === "main") drawMain();
  else if (scene === "camera") drawCamera();
  else if (scene === "review") drawReview();
  else if (scene === "list") drawList();
  else if (scene === "detail") drawDetail();
  else if (scene === "people") drawPeople();

  if (uploading) {
    noStroke();
    fill(249, 211, 236, 170);
    rect(-ox / s, -oy / s, width / s, height / s);
    loadingDots(W / 2, H / 2);
  }
  drawToast();
  pop();

  if (fadeIn > 0) {
    noStroke();
    const fc = color(
      scene === "main" || scene === "list" || scene === "people" ? C.bg : C.ink,
    );
    fc.setAlpha(fadeIn);
    fill(fc);
    rect(0, 0, width, height);
    fadeIn -= 32;
  }
  if (flash > 0) {
    noStroke();
    fill(255, flash);
    rect(0, 0, width, height);
    flash -= 20;
  }
}

/* =========================================================
   화면 이동
   ========================================================= */
function goto(next) {
  if (scene === "camera" && next !== "camera") stopCamera();
  scene = next;
  fadeIn = 255;
  curStroke = null;
  fading = [];
  holdMs = 0;
  heartPt = null;
  delArmed = false;
  if (next === "camera") startCamera();
}

/* =========================================================
   06 메인
   ========================================================= */
function drawMain() {
  const m = L.main;
  const t = millis() / 1000;
  drawAsset("mainBg", { x: 0, y: 0, w: W, h: H }, () => {});
  drawAsset("logo", m.logo, (r) => logoText(r, C.pink));

  // 하트들이 살짝 숨 쉬듯 움직임
  breathe(m.collect, 1 + 0.018 * sin(t * 2.2), 0, () =>
    button("collectHeart", m.collect, (r) => {
      softShadow(50, 0.3);
      fillHeart(r, C.pink);
      noShadow();
      label(r, "collect!", C.mint, 250, "Oswald", 0.44);
    }),
  );
  const small = [
    ["myHeart", m.my, "my", 0],
    ["shareHeart", m.share, "share", 1.3],
    ["bestHeart", m.best, "best", 2.6],
  ];
  for (const [key, r, txt, ph] of small) {
    breathe(r, 1, 10 * sin(t * 1.8 + ph), () =>
      button(key, r, (rr) => {
        softShadow(30, 0.28);
        fillHeart(rr, C.pink);
        noShadow();
        label(rr, txt, C.white, 60, "Oswald", 0.44);
      }),
    );
  }
}

function breathe(r, sc, dy, fn) {
  push();
  translate(r.x + r.w / 2, r.y + r.h / 2 + dy);
  scale(sc);
  translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  fn();
  pop();
}

function mainButtons() {
  const m = L.main;
  return [
    { r: m.collect, fn: () => goto("camera") },
    { r: m.my, fn: () => openList("my") },
    { r: m.share, fn: () => openPeople() },
    { r: m.best, fn: () => openList("best") },
  ];
}

/* =========================================================
   07 카메라
   ========================================================= */
function drawCamera() {
  const v = L.camera.view;

  if (camReady) {
    drawVideo(v);
  } else {
    noStroke();
    fill(C.ink);
    rect(v.x, v.y, v.w, v.h);
    fill(255, 160);
    textAlign(CENTER, CENTER);
    textFont("Oswald");
    textSize(60);
    if (camError) {
      const msg = CAM_MSG[camError] || CAM_MSG.error;
      textSize(64);
      text(msg[0], v.x + v.w / 2, v.y + v.h / 2 - 50);
      textSize(40);
      fill(255, 130);
      text(msg[1], v.x + v.w / 2, v.y + v.h / 2 + 40);
    } else {
      text("· · ·", v.x + v.w / 2, v.y + v.h / 2);
    }
  }

  if (!camReady) markCamReady(); // 이벤트를 놓쳐도 여기서 확인
  updateHeartGesture();

  drawAsset("cameraFrame", { x: 0, y: 0, w: W, h: H }, framePlaceholder);
  drawAsset("cameraLogo", L.top.logo, (r) => logoText(r, C.white));
  drawAsset("crosshair", L.camera.cross, crossPlaceholder);
  drawIndicator(L.camera.indicator, holdMs / HOLD_MS);

  if (DEBUG) drawDebug();

  // 화면에 그리는 하트 선
  drawStrokes(
    fading.map((f) => f.pts),
    fading.map((f) => f.a),
  );
  fading = fading.filter((f) => (f.a -= 12) > 0);
  if (curStroke) drawStrokes([curStroke]);

  // 손하트 위치 표시
  if (heartPt) {
    const sz = 90 + 40 * (holdMs / HOLD_MS);
    noStroke();
    fill(232, 48, 138, 220);
    heartShape(heartPt.x, heartPt.y - sz * 0.5, sz, sz * 0.9);
  }

  button("backBtn", L.top.back, (r) => iconCircle(r, iconBack));

  const b = L.bar;
  drawAsset("bar", b.box, barPlaceholder);
  button("galleryBtn", b.left, galleryPlaceholder);
  button("flipBtn", b.right, (r) => iconCircle(r, iconFlip));
}

function cameraButtons() {
  const b = L.bar;
  return [
    { r: L.top.back, fn: () => goto("main") },
    { r: b.left, fn: () => openList("my") },
    {
      r: b.right,
      fn: () => {
        facing = facing === "user" ? "environment" : "user";
        startCamera();
      },
    },
  ];
}

function startCamera() {
  stopCamera();
  camReady = false;
  camError = "";

  if (IN_APP) {
    camError = "inapp";
    return;
  }
  if (!window.isSecureContext) {
    camError = "http";
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    camError = "unsupported";
    return;
  }

  const el = document.createElement("video");
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.setAttribute("muted", "");
  el.setAttribute("autoplay", "");
  el.muted = true;
  el.playsInline = true;
  // iOS에서 숨긴 영상이 멈추지 않게 화면 구석에 아주 작게 둠
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "2px",
    height: "2px",
    opacity: "0.01",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(el);
  videoEl = el;

  const tryGet = (constraints) =>
    navigator.mediaDevices.getUserMedia(constraints);

  tryGet({
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  })
    .catch((err) => {
      // 조건이 안 맞는 폰이면 가장 기본 설정으로 한 번 더
      if (
        err &&
        (err.name === "OverconstrainedError" ||
          err.name === "NotReadableError" ||
          err.name === "AbortError")
      ) {
        return tryGet({ audio: false, video: true });
      }
      throw err;
    })
    .then((stream) => {
      if (videoEl !== el) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      el.onloadeddata = () => markCamReady();
      el.srcObject = stream;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    })
    .catch((err) => {
      console.warn("camera error:", err);
      camError = (err && err.name) || "error";
    });
}

function markCamReady() {
  if (camReady || !videoEl) return;
  if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
    // ml5가 영상 크기를 읽을 수 있게 실제 크기를 적어줌 (안 하면 손을 못 찾음)
    videoEl.width = videoEl.videoWidth;
    videoEl.height = videoEl.videoHeight;
    camReady = true;
    tryDetect();
  }
}

function stopCamera() {
  if (detecting && handPose) {
    try {
      handPose.detectStop();
    } catch (e) {}
  }
  detecting = false;
  hands = [];
  if (videoEl) {
    if (videoEl.srcObject)
      videoEl.srcObject.getTracks().forEach((t) => t.stop());
    videoEl.remove();
    videoEl = null;
  }
  camReady = false;
}

function tryDetect() {
  if (
    handPose &&
    modelReady &&
    camReady &&
    !detecting &&
    scene === "camera" &&
    videoEl
  ) {
    handPose.detectStart(videoEl, (results) => {
      hands = results;
    });
    detecting = true;
  }
}

// 영상을 화면 비율에 맞게 꽉 채우기 (잘라내기)
function updateCrop(r) {
  const vw = videoEl.videoWidth,
    vh = videoEl.videoHeight;
  if (!vw || !vh) return false;
  const ratio = r.w / r.h;
  if (vw / vh > ratio) {
    crop.sh = vh;
    crop.sw = vh * ratio;
    crop.sx = (vw - crop.sw) / 2;
    crop.sy = 0;
  } else {
    crop.sw = vw;
    crop.sh = vw / ratio;
    crop.sx = 0;
    crop.sy = (vh - crop.sh) / 2;
  }
  return true;
}

function drawVideo(r) {
  if (!updateCrop(r)) return;
  const ctx = drawingContext;
  push();
  if (facing === "user") {
    // 전면 카메라는 거울처럼
    translate(r.x + r.w, r.y);
    scale(-1, 1);
    ctx.drawImage(videoEl, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, r.w, r.h);
  } else {
    ctx.drawImage(
      videoEl,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      r.x,
      r.y,
      r.w,
      r.h,
    );
  }
  pop();
}

// 영상 좌표 → 디자인 좌표
function mapKp(p) {
  const v = L.camera.view;
  let x = ((p.x - crop.sx) / crop.sw) * v.w;
  const y = ((p.y - crop.sy) / crop.sh) * v.h + v.y;
  if (facing === "user") x = v.w - x;
  return { x: x + v.x, y };
}

/* ---------- 손하트 인식 ---------- */
function updateHeartGesture() {
  let found = null;
  if (camReady && hands && hands.length) {
    for (const h of hands) {
      const p = fingerHeart(h);
      if (p) {
        found = p;
        break;
      }
    }
  }

  if (found) {
    heartPt = mapKp(found);
    holdMs += deltaTime;
    if (holdMs >= HOLD_MS) {
      holdMs = 0;
      takePhoto();
    }
  } else {
    heartPt = null;
    holdMs = Math.max(0, holdMs - deltaTime * 2);
  }
}

// 손하트: 엄지 끝이 검지(끝~둘째 마디) 근처에 겹쳐 있고,
//        중지·약지·새끼는 접혀 있으면 손하트로 봐요.
// 잘 안 되면 주소 뒤에 ?debug 를 붙여서 숫자를 보며 HEART 값을 조절하세요.
const HEART = {
  touch: 0.55, // 엄지 끝 ~ 검지 거리 (손바닥 길이 대비, 클수록 느슨)
  curl: 1.45, // 접힌 손가락 판정 (클수록 느슨)
};

function fingerHeart(h) {
  const k = h.keypoints;
  if (!k || k.length < 21) return null;
  const d = (a, b) => dist(k[a].x, k[a].y, k[b].x, k[b].y);

  const palm = d(0, 9); // 손목 ~ 중지 뿌리
  if (palm < 15) return null;

  const touch = Math.min(d(4, 8), d(4, 7), d(4, 6)) / palm;
  const curls = [
    [12, 9],
    [16, 13],
    [20, 17],
  ].map(([tip, mcp]) => d(tip, 0) / d(mcp, 0));
  const curled = curls.filter((c) => c < HEART.curl).length >= 2; // 셋 중 둘만 접혀도 OK

  debugInfo = {
    touch: touch.toFixed(2),
    curls: curls.map((c) => c.toFixed(2)).join(" / "),
  };

  if (touch < HEART.touch && curled) {
    return { x: (k[4].x + k[7].x) / 2, y: (k[4].y + k[7].y) / 2 };
  }
  return null;
}

// ?debug 일 때: 손 관절 점과 판정 숫자 보기
function drawDebug() {
  noStroke();
  for (const h of hands || []) {
    (h.keypoints || []).forEach((p, i) => {
      const q = mapKp(p);
      fill(
        [4, 6, 7, 8].includes(i) ? C.pink : i === 0 || i === 9 ? C.mint : 255,
      );
      circle(q.x, q.y, 18);
    });
  }
  fill(0, 150);
  rect(80, 260, 920, 230, 30);
  fill(255);
  textFont("monospace");
  textStyle(NORMAL);
  textAlign(LEFT, TOP);
  textSize(34);
  text(
    `model ${modelReady ? "ready" : "loading"} · hands ${hands ? hands.length : 0}`,
    110,
    285,
  );
  if (debugInfo) {
    text(`touch ${debugInfo.touch}  (< ${HEART.touch})`, 110, 340);
    text(`curl  ${debugInfo.curls}  (< ${HEART.curl})`, 110, 395);
  }
  if (!hands || !hands.length) debugInfo = null;
}

/* ---------- 화면에 그린 하트 인식 ----------
   한 번에 이어서 그린 선이 크게 한 바퀴 돌아 시작점 근처로 돌아오면 하트로 봐요. */
function isHeartDrawing(pts) {
  if (pts.length < 12) return false;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    len = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    if (i) len += dist(p.x, p.y, pts[i - 1].x, pts[i - 1].y);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  if (size < 150) return false; // 너무 작음
  const a = pts[0],
    b = pts[pts.length - 1];
  const closed = dist(a.x, a.y, b.x, b.y) < size * 0.4; // 시작점 근처로 돌아옴
  return closed && len > size * 2.2;
}

/* ---------- 촬영 ---------- */
function takePhoto(mark) {
  if (!camReady || !videoEl) return;
  const v = L.camera.view;
  if (!updateCrop(v)) return;

  const g = createGraphics(PHOTO_W, PHOTO_H);
  g.pixelDensity(1);
  const ctx = g.drawingContext;
  if (facing === "user") {
    ctx.translate(PHOTO_W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    videoEl,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    PHOTO_W,
    PHOTO_H,
  );
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 화면에 그린 하트를 사진에 같이 넣기
  if (mark) {
    const k = PHOTO_W / v.w;
    g.noFill();
    g.strokeJoin(ROUND);
    g.strokeCap(ROUND);
    for (const [col, wgt] of [
      [255, LINE.draw + LINE.glow * 2],
      [C.pink, LINE.draw],
    ]) {
      g.stroke(col);
      g.strokeWeight(wgt * k);
      smoothPath(mark, g, k, v.x, v.y);
    }
  }

  if (photo) photo.remove();
  photo = g;
  curStroke = null;
  rating = DEFAULT_SCORE;
  flash = 255;
  goto("review");
}

/* =========================================================
   찍은 사진에 하트 그리기 + 점수
   ========================================================= */
function drawReview() {
  const v = L.camera.view;
  if (photo) image(photo, v.x, v.y, v.w, v.h);

  drawAsset("cameraFrame", { x: 0, y: 0, w: W, h: H }, framePlaceholder);
  button("backBtn", L.top.back, (r) => iconCircle(r, iconBack));

  scoreNumber(L.score, rating);

  const b = L.bar;
  drawAsset("bar", b.box, barPlaceholder);
  scoreSlider(b.slider, rating);
  button("saveBtn", b.right, (r) => iconCircle(r, iconCheck, true));
}

function reviewButtons() {
  return [
    { r: L.top.back, fn: () => goto("camera") }, // 다시 찍기
    { r: L.bar.right, fn: () => saveCurrent() },
  ];
}

function drawStrokes(list, alphas) {
  noFill();
  strokeJoin(ROUND);
  strokeCap(ROUND);
  list.forEach((st, i) => {
    if (st.length < 2) return;
    const a = alphas ? alphas[i] : 255;
    stroke(255, a * 0.9);
    strokeWeight(LINE.draw + LINE.glow * 2);
    smoothPath(st, window);
    const c = color(C.pink);
    c.setAlpha(a);
    stroke(c);
    strokeWeight(LINE.draw);
    smoothPath(st, window);
  });
}

// 손 떨림을 줄여 부드러운 선으로 (g: 그릴 대상, k: 배율)
function smoothPath(pts, g, k = 1, offX = 0, offY = 0) {
  const P = (p) => [(p.x - offX) * k, (p.y - offY) * k];
  g.beginShape();
  g.curveVertex(...P(pts[0]));
  for (const p of pts) g.curveVertex(...P(p));
  g.curveVertex(...P(pts[pts.length - 1]));
  g.endShape();
}

function saveCurrent() {
  if (!photo || uploading) return;
  if (!ME.name) {
    askName(() => saveCurrent());
    return;
  }

  const data = photo.elt.toDataURL("image/jpeg", 0.72);
  const doc = {
    uid: ME.uid,
    name: ME.name,
    img: data,
    score: rating,
    t: Date.now(),
  };

  uploading = true;
  DB.addPhoto(doc)
    .then((id) => {
      loadImage(data, (im) => {
        thumbs[id] = im;
        myLatest = im;
      });
      return refreshMyProfile();
    })
    .then(() => {
      uploading = false;
      toast("collected ♡");
      openList("my");
    })
    .catch((err) => {
      console.warn("upload error:", err);
      uploading = false;
      toast("upload ✕");
    });
}

/* =========================================================
   컬렉션 (my / best / user)
   my   : 내가 모은 사진 (최신순)
   best : 모두의 사진 점수 랭킹
   user : 친구 한 명의 사진
   ========================================================= */
function openList(mode, user) {
  listMode = mode;
  listUser = user || null;
  listItems = null;
  scrollY = 0;
  goto("list");

  const token = ++loadToken;
  const req =
    mode === "best"
      ? DB.bestPhotos(30)
      : DB.photosByUser(mode === "my" ? ME.uid : user.uid);
  req
    .then((arr) => {
      if (token !== loadToken) return;
      listItems = arr;
      arr.forEach(loadThumb);
    })
    .catch((err) => {
      console.warn(err);
      if (token === loadToken) {
        listItems = [];
        toast("load ✕");
      }
    });
}

function loadThumb(it) {
  if (thumbs[it.id] || thumbs[it.id] === false) return;
  thumbs[it.id] = false; // 불러오는 중
  loadImage(it.img, (im) => {
    thumbs[it.id] = im;
    if (it.uid === ME.uid && (!myLatestT || it.t >= myLatestT)) {
      myLatest = im;
      myLatestT = it.t;
    }
  });
}

function cellRect(i) {
  const g = L.list;
  const cw = (W - g.x0 * 2 - g.gap * (g.cols - 1)) / g.cols;
  const col = i % g.cols,
    row = Math.floor(i / g.cols);
  return {
    x: g.x0 + col * (cw + g.gap),
    y: g.top + row * (g.thumbH + g.gap) - scrollY,
    w: cw,
    thumbH: g.thumbH,
  };
}

function listMaxScroll() {
  const g = L.list;
  const rows = Math.ceil((listItems ? listItems.length : 0) / g.cols);
  return Math.max(0, rows * (g.thumbH + g.gap) - (H - g.top - 60));
}

const EMPTY_R = { x: 290, y: 760, w: 500, h: 450 };

function drawList() {
  drawAsset("listBg", { x: 0, y: 0, w: W, h: H }, () => {});
  const g = L.list;

  if (listItems === null) {
    loadingDots(W / 2, H / 2);
  } else if (listItems.length === 0) {
    if (listMode === "my") {
      button("emptyHeart", EMPTY_R, (rr) => {
        noFill();
        stroke(C.pink);
        strokeWeight(LINE.ui * 2);
        heartR(rr);
        noStroke();
        fill(C.pink);
        rectMode(CENTER);
        rect(rr.x + rr.w / 2, rr.y + rr.h * 0.46, 90, 10, 5);
        rect(rr.x + rr.w / 2, rr.y + rr.h * 0.46, 10, 90, 5);
        rectMode(CORNER);
      });
    } else {
      noFill();
      stroke(C.pink);
      strokeWeight(LINE.ui * 2);
      heartR(EMPTY_R);
    }
  } else {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, g.top - 20, W, H - g.top + 20);
    drawingContext.clip();

    listItems.forEach((it, i) => {
      const c = cellRect(i);
      if (c.y + c.thumbH < g.top - 40 || c.y > H) return;
      const th = thumbs[it.id];

      softShadow(30, 0.18);
      noStroke();
      fill(C.white);
      rect(c.x - 6, c.y - 6, c.w + 12, c.thumbH + 12, 30);
      noShadow();
      if (th) imageCover(th, c.x, c.y, c.w, c.thumbH, 24);
      else {
        fill(C.mint);
        rect(c.x, c.y, c.w, c.thumbH, 24);
      }

      // 랭킹 순위
      if (listMode === "best" && i < 3) {
        fill(C.pink);
        circle(c.x + 56, c.y + 56, 76);
        fill(C.white);
        textFont("Oswald");
        textAlign(CENTER, CENTER);
        textSize(44);
        text(i + 1, c.x + 56, c.y + 53);
      }
      // 랭킹에서는 누가 찍었는지
      if (listMode === "best")
        namePill(it.name, c.x + 20, c.y + c.thumbH - 100, 80);

      // 점수
      const br = { x: c.x + c.w - 170, y: c.y + c.thumbH - 110, w: 150, h: 90 };
      drawAsset("scoreBadge", br, (r) => {
        noStroke();
        fill(C.pink);
        rect(r.x, r.y, r.w, r.h, r.h / 2);
      });
      label(br, it.score, C.white, 54, "Oswald", 0.46);
    });
    drawingContext.restore();
  }

  // 위쪽 (스크롤해도 고정)
  noStroke();
  fill(C.bg);
  if (!img.listBg) rect(0, 0, W, g.top - 30);
  button("backBtn", L.top.back, (r) => iconCircle(r, iconBack));
  if (listMode === "user") {
    label(L.top.logo, listUser.name, C.pink, 80, "sans-serif", 0.5);
  } else {
    const key = listMode === "my" ? "listTitleMy" : "listTitleBest";
    drawAsset(key, L.top.logo, (r) =>
      label(r, listMode, C.pink, 110, "Oswald", 0.5),
    );
  }
}

function listButtons() {
  return [
    {
      r: L.top.back,
      fn: () => (listMode === "user" ? openPeople() : goto("main")),
    },
  ];
}

function tapList(p) {
  if (!listItems) return;
  if (listItems.length === 0) {
    if (listMode === "my" && inRect(p, EMPTY_R)) goto("camera");
    return;
  }
  if (p.y < L.list.top - 20) return;
  for (let i = 0; i < listItems.length; i++) {
    const c = cellRect(i);
    if (inRect(p, { x: c.x, y: c.y, w: c.w, h: c.thumbH })) {
      detailItem = listItems[i];
      goto("detail");
      return;
    }
  }
}

/* =========================================================
   share : 나랑 친구들 프로필
   ========================================================= */
function openPeople() {
  people = null;
  scrollY = 0;
  goto("people");
  const token = ++loadToken;
  DB.users()
    .then((arr) => {
      if (token !== loadToken) return;
      // 나를 맨 위로
      arr.sort(
        (a, b) =>
          (b.uid === ME.uid) - (a.uid === ME.uid) || b.updated - a.updated,
      );
      if (!arr.some((u) => u.uid === ME.uid))
        arr.unshift({
          uid: ME.uid,
          name: ME.name || "나",
          count: 0,
          best: 0,
          avatar: "",
        });
      people = arr;
      for (const u of arr) {
        if (u.avatar && !avatars[u.uid + u.updated]) {
          avatars[u.uid + u.updated] = false;
          loadImage(u.avatar, (im) => {
            avatars[u.uid + u.updated] = im;
          });
        }
      }
    })
    .catch((err) => {
      console.warn(err);
      if (token === loadToken) {
        people = [];
        toast("load ✕");
      }
    });
}

function personRect(i) {
  const p = L.people;
  return {
    x: p.x0,
    y: p.top + i * (p.cardH + p.gap) - scrollY,
    w: W - p.x0 * 2,
    h: p.cardH,
  };
}

function peopleMaxScroll() {
  const p = L.people;
  const n = people ? people.length : 0;
  return Math.max(0, n * (p.cardH + p.gap) - (H - p.top - 60));
}

function editRect(r) {
  return { x: r.x + r.w - 130, y: r.y + r.h / 2 - 50, w: 100, h: 100 };
}

function drawPeople() {
  drawAsset("listBg", { x: 0, y: 0, w: W, h: H }, () => {});
  const P = L.people;

  if (people === null) {
    loadingDots(W / 2, H / 2);
  } else {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, P.top - 20, W, H - P.top + 20);
    drawingContext.clip();

    people.forEach((u, i) => {
      const r = personRect(i);
      if (r.y + r.h < P.top - 40 || r.y > H) return;
      const isMe = u.uid === ME.uid;

      // 카드
      push();
      const pressed =
        pointer.down &&
        !pointer.moved &&
        inRect({ x: pointer.sx, y: pointer.sy }, r);
      if (pressed) {
        translate(r.x + r.w / 2, r.y + r.h / 2);
        scale(0.97);
        translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      }
      drawAsset("personCard", r, (rr) => {
        softShadow(30, 0.16);
        noStroke();
        fill(isMe ? C.pink : C.white);
        rect(rr.x, rr.y, rr.w, rr.h, 60);
        noShadow();
      });

      // 프로필 사진 (가장 최근에 찍은 사진)
      const d = r.h - 50;
      const ax = r.x + 25,
        ay = r.y + 25;
      const av = avatars[u.uid + u.updated];
      noStroke();
      fill(isMe ? C.white : C.bg);
      circle(ax + d / 2, ay + d / 2, d + 10);
      if (av) imageCover(av, ax, ay, d, d, d / 2);
      else {
        fill(isMe ? C.bg : C.pink);
        heartShape(ax + d / 2, ay + d * 0.28, d * 0.5, d * 0.45);
      }
      drawAsset(
        "avatarFrame",
        { x: ax - 10, y: ay - 10, w: d + 20, h: d + 20 },
        () => {},
      );

      // 이름
      const tx = ax + d + 40;
      noStroke();
      fill(isMe ? C.white : C.ink);
      textFont("sans-serif");
      textStyle(BOLD);
      textAlign(LEFT, CENTER);
      textSize(58);
      text(u.name || "?", tx, r.y + r.h * 0.36);

      // 모은 개수 · 최고 점수
      const col = isMe ? C.white : C.pink;
      fill(col);
      heartShape(tx + 20, r.y + r.h * 0.6, 40, 36);
      textFont("Oswald");
      textStyle(NORMAL);
      textSize(46);
      text(u.count || 0, tx + 55, r.y + r.h * 0.68);
      const bx = tx + 55 + textWidth(String(u.count || 0)) + 50;
      noFill();
      stroke(col);
      strokeWeight(LINE.ui);
      rect(bx, r.y + r.h * 0.68 - 30, 150, 60, 30);
      noStroke();
      fill(col);
      textAlign(CENTER, CENTER);
      textSize(36);
      text("best " + (u.best || 0), bx + 75, r.y + r.h * 0.68 - 2);

      // 내 이름 바꾸기
      if (isMe) {
        const er = editRect(r);
        drawAsset("editBtn", er, (rr) => {
          noStroke();
          fill(255, 60);
          circle(rr.x + rr.w / 2, rr.y + rr.h / 2, rr.w);
          stroke(C.white);
          strokeWeight(rr.w * LINE.icon);
          noFill();
          iconPencil(rr.x + rr.w / 2, rr.y + rr.h / 2, rr.w * 0.42);
        });
      }
      pop();
    });
    drawingContext.restore();
  }

  noStroke();
  fill(C.bg);
  if (!img.listBg) rect(0, 0, W, P.top - 30);
  button("backBtn", L.top.back, (r) => iconCircle(r, iconBack));
  drawAsset("peopleTitle", L.top.logo, (r) =>
    label(r, "share", C.pink, 110, "Oswald", 0.5),
  );
}

function peopleButtons() {
  return [{ r: L.top.back, fn: () => goto("main") }];
}

function tapPeople(p) {
  if (!people || p.y < L.people.top - 20) return;
  for (let i = 0; i < people.length; i++) {
    const r = personRect(i);
    if (!inRect(p, r)) continue;
    const u = people[i];
    if (u.uid === ME.uid) {
      if (inRect(p, editRect(r)))
        askName(() => refreshMyProfile().then(openPeople));
      else openList("my");
    } else {
      openList("user", u);
    }
    return;
  }
}

/* =========================================================
   사진 크게 보기
   ========================================================= */
function drawDetail() {
  const it = detailItem;
  if (!it) {
    goto("main");
    return;
  }
  const v = L.camera.view;
  const th = thumbs[it.id];
  if (th) image(th, v.x, v.y, v.w, v.h);

  drawAsset("cameraFrame", { x: 0, y: 0, w: W, h: H }, framePlaceholder);
  button("backBtn", L.top.back, (r) => iconCircle(r, iconBack));
  if (it.uid !== ME.uid)
    namePill(it.name, L.top.logo.x + 40, L.top.logo.y + 5, 90);

  const b = L.bar;
  drawAsset("bar", b.box, barPlaceholder);
  if (it.uid === ME.uid)
    button("deleteBtn", b.left, (r) => iconCircle(r, iconTrash, delArmed));
  scoreNumber(
    { x: b.box.x + 200, y: b.box.y, w: b.box.w - 400, h: b.box.h },
    it.score,
    150,
  );
}

function detailButtons() {
  const list = [{ r: L.top.back, fn: () => goto("list") }];
  if (detailItem && detailItem.uid === ME.uid) {
    list.push({
      r: L.bar.left,
      fn: () => {
        if (!delArmed) {
          delArmed = true;
          return;
        }
        const it = detailItem;
        uploading = true;
        DB.deletePhoto(it.id)
          .then(() => refreshMyProfile())
          .then(() => {
            uploading = false;
            openList(listMode, listUser);
          })
          .catch((err) => {
            console.warn(err);
            uploading = false;
            toast("delete ✕");
          });
      },
    });
  }
  return list;
}

/* =========================================================
   내 프로필 (닉네임 + 통계)
   ========================================================= */
function refreshMyProfile() {
  return DB.photosByUser(ME.uid).then((arr) => {
    const best = arr.reduce((m, x) => Math.max(m, x.score), 0);
    const latest = arr[0];
    return (latest ? makeAvatar(latest.img) : Promise.resolve("")).then(
      (avatar) =>
        DB.saveUser(ME.uid, {
          uid: ME.uid,
          name: ME.name || "나",
          count: arr.length,
          best,
          avatar,
          updated: Date.now(),
        }),
    );
  });
}

// 프로필용 작은 동그라미 사진 만들기
function makeAvatar(dataURL) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const S = 200,
        cv = document.createElement("canvas");
      cv.width = cv.height = S;
      const side = Math.min(im.width, im.height);
      cv.getContext("2d").drawImage(
        im,
        (im.width - side) / 2,
        (im.height - side) / 2,
        side,
        side,
        0,
        0,
        S,
        S,
      );
      resolve(cv.toDataURL("image/jpeg", 0.7));
    };
    im.onerror = () => resolve("");
    im.src = dataURL;
  });
}

function askName(done) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "fixed",
    inset: "0",
    zIndex: "10",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    background: "rgba(249,211,236,0.94)",
  });
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 12;
  input.placeholder = "nickname";
  input.value = ME.name || "";
  Object.assign(input.style, {
    font: "bold 20px sans-serif",
    textAlign: "center",
    width: "64vw",
    padding: "14px 20px",
    border: "2px solid #E8308A",
    borderRadius: "999px",
    outline: "none",
    color: "#2B1A22",
    background: "#fff",
  });
  const ok = document.createElement("button");
  ok.textContent = "OK ♡";
  Object.assign(ok.style, {
    font: "bold 18px Oswald, sans-serif",
    padding: "12px 36px",
    border: "none",
    borderRadius: "999px",
    background: "#E8308A",
    color: "#fff",
  });
  const cancel = document.createElement("button");
  cancel.textContent = "✕";
  Object.assign(cancel.style, {
    position: "absolute",
    top: "20px",
    right: "20px",
    width: "44px",
    height: "44px",
    border: "none",
    borderRadius: "50%",
    background: "#fff",
    color: "#E8308A",
    font: "bold 18px sans-serif",
  });
  const submit = () => {
    const v = input.value.trim();
    if (!v) {
      input.focus();
      return;
    }
    ME.name = v;
    try {
      localStorage.setItem("cc.name", v);
    } catch (e) {}
    wrap.remove();
    done && done();
  };
  ok.onclick = submit;
  cancel.onclick = () => wrap.remove();
  input.onkeydown = (e) => {
    if (e.key === "Enter") submit();
  };
  wrap.append(input, ok, cancel);
  document.body.appendChild(wrap);
  setTimeout(() => input.focus(), 50);
}

/* =========================================================
   데이터 (Firebase Firestore / 설정 전에는 이 폰에만 저장)
   ========================================================= */
const DB = {
  fs: null,

  init() {
    const cfg = window.FIREBASE_CONFIG;
    const ok =
      cfg &&
      cfg.apiKey &&
      !/여기/.test(cfg.apiKey) &&
      typeof firebase !== "undefined";
    if (ok) {
      try {
        firebase.initializeApp(cfg);
        this.fs = firebase.firestore();
      } catch (e) {
        console.warn("Firebase 설정 오류:", e);
      }
    }
    if (!this.fs) console.warn("Firebase 설정 전 — 이 폰에만 저장돼요");
  },

  get online() {
    return !!this.fs;
  },

  addPhoto(doc) {
    if (this.fs)
      return this.fs
        .collection("photos")
        .add(doc)
        .then((ref) => ref.id);
    const arr = this._local("photos");
    const id = "p" + Date.now();
    arr.push({ id, ...doc });
    return this._save("photos", arr).then(() => id);
  },

  photosByUser(uid) {
    if (this.fs) {
      return this.fs
        .collection("photos")
        .where("uid", "==", uid)
        .get()
        .then((snap) =>
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => b.t - a.t),
        );
    }
    return Promise.resolve(
      this._local("photos")
        .filter((p) => p.uid === uid)
        .sort((a, b) => b.t - a.t),
    );
  },

  bestPhotos(n) {
    if (this.fs) {
      return this.fs
        .collection("photos")
        .orderBy("score", "desc")
        .limit(n)
        .get()
        .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    return Promise.resolve(
      this._local("photos")
        .sort((a, b) => b.score - a.score || b.t - a.t)
        .slice(0, n),
    );
  },

  deletePhoto(id) {
    if (this.fs) return this.fs.collection("photos").doc(id).delete();
    return this._save(
      "photos",
      this._local("photos").filter((p) => p.id !== id),
    );
  },

  users() {
    if (this.fs) {
      return this.fs
        .collection("users")
        .orderBy("updated", "desc")
        .limit(100)
        .get()
        .then((snap) => snap.docs.map((d) => d.data()));
    }
    return Promise.resolve(this._local("users"));
  },

  saveUser(uid, data) {
    if (this.fs)
      return this.fs.collection("users").doc(uid).set(data, { merge: true });
    const arr = this._local("users").filter((u) => u.uid !== uid);
    arr.push(data);
    return this._save("users", arr);
  },

  _local(key) {
    try {
      return JSON.parse(localStorage.getItem("cc." + key)) || [];
    } catch (e) {
      return [];
    }
  },
  _save(key, arr) {
    try {
      localStorage.setItem("cc." + key, JSON.stringify(arr));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  },
};

/* =========================================================
   터치 입력
   ========================================================= */
function toDesign(e) {
  const r = e.target.getBoundingClientRect();
  return { x: (e.clientX - r.left - ox) / s, y: (e.clientY - r.top - oy) / s };
}

function currentButtons() {
  if (scene === "main") return mainButtons();
  if (scene === "camera") return cameraButtons();
  if (scene === "review") return reviewButtons();
  if (scene === "list") return listButtons();
  if (scene === "detail") return detailButtons();
  if (scene === "people") return peopleButtons();
  return [];
}

function onDown(e) {
  e.preventDefault();
  if (uploading) return;
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch (err) {}
  const p = toDesign(e);
  Object.assign(pointer, {
    down: true,
    x: p.x,
    y: p.y,
    sx: p.x,
    sy: p.y,
    moved: false,
    startScroll: scrollY,
  });

  const onBtn = currentButtons().some((b) => inRect(p, b.r));

  // 카메라 화면에 하트 그리기 시작
  if (
    scene === "camera" &&
    camReady &&
    !onBtn &&
    !inRect(p, L.bar.box) &&
    inRect(p, L.camera.view)
  ) {
    curStroke = [p];
  }
  // 점수 바 드래그
  if (scene === "review" && inRect(p, L.bar.slider)) {
    sliding = true;
    rating = sliderValue(L.bar.slider, p.x);
  }
}

function onMove(e) {
  if (!pointer.down) return;
  e.preventDefault();
  const p = toDesign(e);
  pointer.x = p.x;
  pointer.y = p.y;
  if (dist(p.x, p.y, pointer.sx, pointer.sy) > 18) pointer.moved = true;

  if (sliding) {
    rating = sliderValue(L.bar.slider, p.x);
    return;
  }
  if (curStroke) {
    const last = curStroke[curStroke.length - 1];
    if (dist(p.x, p.y, last.x, last.y) > 4) curStroke.push(p);
  }
  if (scene === "list" || scene === "people") {
    const max = scene === "list" ? listMaxScroll() : peopleMaxScroll();
    scrollY = constrain(pointer.startScroll - (p.y - pointer.sy), 0, max);
  }
}

function onUp(e) {
  if (!pointer.down) return;
  pointer.down = false;
  const p = toDesign(e);

  if (sliding) {
    sliding = false;
    return;
  }
  if (curStroke) {
    const st = curStroke;
    curStroke = null;
    if (isHeartDrawing(st)) {
      takePhoto(st);
      return;
    }
    if (st.length > 2) fading.push({ pts: st, a: 255 });
    if (pointer.moved) return;
  }
  if (pointer.moved) return;

  for (const b of currentButtons()) {
    if (inRect(p, b.r) && inRect({ x: pointer.sx, y: pointer.sy }, b.r)) {
      b.fn();
      return;
    }
  }
  if (scene === "list") tapList(p);
  if (scene === "people") tapPeople(p);
  if (
    scene === "camera" &&
    camError &&
    !["inapp", "http", "unsupported"].includes(camError)
  )
    startCamera();
}

/* =========================================================
   그리기 도우미
   ========================================================= */
function softShadow(blur, alpha) {
  drawingContext.shadowColor = `rgba(150, 20, 80, ${alpha})`;
  const k = s * pixelDensity(); // 그림자는 화면 배율을 따로 적용해야 함
  drawingContext.shadowBlur = blur * k;
  drawingContext.shadowOffsetY = blur * 0.3 * k;
}

function noShadow() {
  drawingContext.shadowColor = "transparent";
  drawingContext.shadowBlur = 0;
  drawingContext.shadowOffsetY = 0;
}

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// 그래픽이 있으면 이미지, 없으면 임시 도형
function drawAsset(key, r, fallback) {
  if (img[key]) image(img[key], r.x, r.y, r.w, r.h);
  else fallback(r);
}

// 누르는 동안 살짝 작아지는 버튼
function button(key, r, fallback) {
  const pressed =
    pointer.down &&
    !pointer.moved &&
    !curStroke &&
    !sliding &&
    inRect({ x: pointer.sx, y: pointer.sy }, r);
  push();
  if (pressed) {
    translate(r.x + r.w / 2, r.y + r.h / 2);
    scale(0.92);
    translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  }
  drawAsset(key, r, fallback);
  pop();
}

function heartShape(cx, top, w, h) {
  const x = cx,
    y = top;
  beginShape();
  vertex(x, y + h * 0.28);
  bezierVertex(
    x + w * 0.08,
    y,
    x + w * 0.5,
    y - h * 0.02,
    x + w * 0.5,
    y + h * 0.32,
  );
  bezierVertex(x + w * 0.5, y + h * 0.6, x + w * 0.12, y + h * 0.75, x, y + h);
  bezierVertex(
    x - w * 0.12,
    y + h * 0.75,
    x - w * 0.5,
    y + h * 0.6,
    x - w * 0.5,
    y + h * 0.32,
  );
  bezierVertex(x - w * 0.5, y - h * 0.02, x - w * 0.08, y, x, y + h * 0.28);
  endShape(CLOSE);
}

function heartR(r) {
  heartShape(r.x + r.w / 2, r.y, r.w, r.h);
}

function fillHeart(r, col) {
  noStroke();
  fill(col);
  heartR(r);
}

function label(r, str, col, size, font, yRatio) {
  noStroke();
  fill(col);
  textFont(font);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(size);
  text(str, r.x + r.w / 2, r.y + r.h * yRatio);
}

function logoText(r, col) {
  push();
  textFont("Syncopate");
  textStyle(BOLD);
  let ts = r.h * 0.75;
  textSize(ts);
  let total = textWidth("Cute") + textWidth("Collect") + ts * 0.9;
  if (total > r.w) {
    ts *= r.w / total;
    textSize(ts);
  }
  const a = textWidth("Cute"),
    b = textWidth("Collect"),
    g = ts * 0.9;
  total = a + b + g;
  const x0 = r.x + r.w / 2 - total / 2,
    cy = r.y + r.h / 2;
  noStroke();
  fill(col);
  textAlign(LEFT, CENTER);
  text("Cute", x0, cy);
  text("Collect", x0 + a + g, cy);
  heartShape(x0 + a + g / 2, cy - ts * 0.62, g * 0.75, g * 0.68);
  pop();
}

// 점수 바: 왼쪽 1점 ~ 오른쪽 100점
function scoreSlider(r, score) {
  const pad = r.h * 0.4;
  const x0 = r.x + pad,
    x1 = r.x + r.w - pad,
    cy = r.y + r.h / 2;
  const kx = map(score, 1, 100, x0, x1);
  strokeCap(ROUND);
  stroke(C.bg);
  strokeWeight(12);
  line(x0, cy, x1, cy);
  stroke(C.pink);
  line(x0, cy, kx, cy);
  const ks = r.h * 0.62;
  drawAsset(
    "scoreKnob",
    { x: kx - ks / 2, y: cy - ks / 2, w: ks, h: ks },
    (rr) => {
      softShadow(18, 0.35);
      noStroke();
      fill(C.pink);
      heartShape(rr.x + rr.w / 2, rr.y + rr.h * 0.05, rr.w, rr.h * 0.9);
      noShadow();
    },
  );
}

function sliderValue(r, x) {
  const pad = r.h * 0.4;
  return Math.round(
    constrain(map(x, r.x + pad, r.x + r.w - pad, 1, 100), 1, 100),
  );
}

function scoreNumber(r, score, size) {
  push();
  textFont("Oswald");
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(size || 220);
  softShadow(30, 0.45);
  noStroke();
  fill(C.white);
  text(score, r.x + r.w / 2, r.y + r.h * 0.45);
  noShadow();
  pop();
}

function imageCover(im, x, y, w, h, radius) {
  const ir = im.width / im.height,
    r = w / h;
  let sw, sh, sx, sy;
  if (ir > r) {
    sh = im.height;
    sw = sh * r;
    sx = (im.width - sw) / 2;
    sy = 0;
  } else {
    sw = im.width;
    sh = sw / r;
    sx = 0;
    sy = (im.height - sh) / 2;
  }
  drawingContext.save();
  drawingContext.beginPath();
  if (drawingContext.roundRect) drawingContext.roundRect(x, y, w, h, radius);
  else drawingContext.rect(x, y, w, h);
  drawingContext.clip();
  image(im, x, y, w, h, sx, sy, sw, sh);
  drawingContext.restore();
}

/* ---------- 임시 그래픽들 ---------- */
function framePlaceholder() {
  // 위아래를 살짝 어둡게 해서 흰 UI가 잘 보이게
  const ctx = drawingContext;
  let gr = ctx.createLinearGradient(0, 0, 0, 380);
  gr.addColorStop(0, "rgba(43,26,34,0.45)");
  gr.addColorStop(1, "rgba(43,26,34,0)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, 380);
  gr = ctx.createLinearGradient(0, H - 480, 0, H);
  gr.addColorStop(0, "rgba(43,26,34,0)");
  gr.addColorStop(1, "rgba(43,26,34,0.5)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, H - 480, W, 480);

  noFill();
  stroke(255, 200);
  strokeWeight(LINE.ui);
  rect(56, 56, W - 112, H - 112, 36);
}

function crossPlaceholder(r) {
  stroke(255, 210);
  strokeWeight(LINE.ui);
  strokeCap(ROUND);
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2,
    a = r.w * 0.32;
  line(cx - a, cy, cx + a, cy);
  line(cx, cy - a, cx, cy + a);
}

function drawIndicator(r, t) {
  if (img.indicator) {
    tint(255, 120 + 135 * t);
    image(img.indicator, r.x, r.y, r.w, r.h);
    noTint();
    return;
  }
  // 손하트를 유지하는 만큼 아래부터 차오름
  push();
  const pop_ = 1 + 0.12 * t;
  translate(r.x + r.w / 2, r.y + r.h / 2);
  scale(pop_);
  translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  noStroke();
  fill(255, 60);
  heartR(r);
  if (t > 0) {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(r.x - 10, r.y + r.h * (1 - t), r.w + 20, r.h * t + 10);
    drawingContext.clip();
    fill(C.pink);
    heartR(r);
    drawingContext.restore();
  }
  noFill();
  stroke(255, 220);
  strokeWeight(LINE.ui);
  heartR(r);
  pop();
}

function barPlaceholder(r) {
  softShadow(40, 0.25);
  noStroke();
  fill(255, 235);
  rect(r.x, r.y, r.w, r.h, r.h / 2);
  noShadow();
}

function galleryPlaceholder(r) {
  const latest = myLatest;
  noStroke();
  fill(C.white);
  rect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 32);
  if (latest) imageCover(latest, r.x, r.y, r.w, r.h, 28);
  else {
    fill(C.bg);
    rect(r.x, r.y, r.w, r.h, 28);
  }
}

function iconCircle(r, iconFn, active) {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2,
    d = r.w;
  softShadow(24, 0.22);
  noStroke();
  fill(active ? C.pink : C.white);
  circle(cx, cy, d);
  noShadow();
  stroke(active ? C.white : C.pink);
  strokeWeight(d * LINE.icon);
  strokeCap(ROUND);
  strokeJoin(ROUND);
  noFill();
  iconFn(cx, cy, d * 0.42, active);
}

function iconBack(cx, cy, u) {
  line(cx + u * 0.15, cy - u * 0.4, cx - u * 0.25, cy);
  line(cx - u * 0.25, cy, cx + u * 0.15, cy + u * 0.4);
}

function iconCheck(cx, cy, u) {
  line(cx - u * 0.38, cy, cx - u * 0.1, cy + u * 0.3);
  line(cx - u * 0.1, cy + u * 0.3, cx + u * 0.4, cy - u * 0.3);
}

function iconFlip(cx, cy, u) {
  arc(cx, cy, u * 0.9, u * 0.9, PI * 1.1, PI * 1.9);
  arc(cx, cy, u * 0.9, u * 0.9, PI * 0.1, PI * 0.9);
  line(cx + u * 0.43, cy - u * 0.12, cx + u * 0.45, cy - u * 0.38);
  line(cx + u * 0.43, cy - u * 0.12, cx + u * 0.2, cy - u * 0.15);
  line(cx - u * 0.43, cy + u * 0.12, cx - u * 0.45, cy + u * 0.38);
  line(cx - u * 0.43, cy + u * 0.12, cx - u * 0.2, cy + u * 0.15);
}

function iconShare(cx, cy, u) {
  line(cx, cy - u * 0.45, cx, cy + u * 0.1);
  line(cx, cy - u * 0.45, cx - u * 0.2, cy - u * 0.25);
  line(cx, cy - u * 0.45, cx + u * 0.2, cy - u * 0.25);
  line(cx - u * 0.15, cy - u * 0.1, cx - u * 0.38, cy - u * 0.1);
  line(cx - u * 0.38, cy - u * 0.1, cx - u * 0.38, cy + u * 0.42);
  line(cx - u * 0.38, cy + u * 0.42, cx + u * 0.38, cy + u * 0.42);
  line(cx + u * 0.38, cy + u * 0.42, cx + u * 0.38, cy - u * 0.1);
  line(cx + u * 0.38, cy - u * 0.1, cx + u * 0.15, cy - u * 0.1);
}

function iconPencil(cx, cy, u) {
  line(cx - u * 0.35, cy + u * 0.35, cx + u * 0.3, cy - u * 0.3);
  line(cx - u * 0.35, cy + u * 0.35, cx - u * 0.38, cy + u * 0.1);
  line(cx - u * 0.35, cy + u * 0.35, cx - u * 0.1, cy + u * 0.38);
}

// 누가 찍었는지 이름표
function namePill(name, x, y, h) {
  push();
  textFont("sans-serif");
  textStyle(BOLD);
  textSize(h * 0.48);
  const tw = textWidth(name || "?") + h * 0.8;
  noStroke();
  fill(255, 235);
  rect(x, y, tw, h, h / 2);
  fill(C.pink);
  textAlign(CENTER, CENTER);
  text(name || "?", x + tw / 2, y + h * 0.5);
  pop();
}

function loadingDots(cx, cy) {
  noStroke();
  for (let i = 0; i < 3; i++) {
    const a = 0.5 + 0.5 * sin(millis() / 180 - i * 0.9);
    fill(232, 48, 138, 90 + 165 * a);
    heartShape(cx + (i - 1) * 90, cy - 30 - a * 14, 60, 54);
  }
}

function iconTrash(cx, cy, u) {
  line(cx - u * 0.32, cy - u * 0.32, cx + u * 0.32, cy + u * 0.32);
  line(cx + u * 0.32, cy - u * 0.32, cx - u * 0.32, cy + u * 0.32);
}

/* ---------- 짧은 알림 ---------- */
function toast(msg) {
  toastMsg = msg;
  toastT = 90;
}

function drawToast() {
  if (toastT <= 0) return;
  toastT--;
  const a = Math.min(1, toastT / 20) * 255;
  textFont("Oswald");
  textSize(56);
  const tw = textWidth(toastMsg) + 100;
  noStroke();
  fill(232, 48, 138, a);
  rect(W / 2 - tw / 2, 1420, tw, 110, 55);
  fill(255, a);
  textAlign(CENTER, CENTER);
  text(toastMsg, W / 2, 1470);
}

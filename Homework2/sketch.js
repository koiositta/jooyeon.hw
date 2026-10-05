// ==========================================
// 1. 커피 컵 클래스 (CoffeeCup Class)
// ==========================================
class CoffeeCup {
  constructor(x, y) {
    this.initialX = x;
    this.initialY = y;
    this.width = 70;
    this.height = 80;
    this.reset();
  }

  reset() {
    this.x = this.initialX;
    this.y = this.initialY;
    this.angle = 0;
    this.coffeeLevel = 1.0;
    this.state = "IDLE"; // IDLE, DRINKING, DRAG_THROW, THROWING, SPILLING, FINISHED

    // 던지기 변수
    this.throwVX = 0;
    this.throwVY = 0;
    this.throwDirection = 1;

    // 엎기 변수
    this.spillProgress = 0;
    this.spillTimer = 0;
    this.spillSpeechTriggered = false;
  }

  contains(px, py) {
    return (
      px > this.x - this.width / 2 - 15 &&
      px < this.x + this.width / 2 + 15 &&
      py > this.y - this.height / 2 - 15 &&
      py < this.y + this.height / 2 + 15
    );
  }

  drinkStep() {
    this.state = "DRINKING";
    this.coffeeLevel -= 0.2;
    if (this.coffeeLevel <= 0) {
      this.coffeeLevel = 0;
    }
  }

  startDrag(mx, my) {
    this.state = "DRAG_THROW";
    this.x = mx;
    this.y = my;
  }

  releaseAndThrow(vx, vy, speechBubble) {
    if (this.state === "DRAG_THROW") {
      this.state = "THROWING";
      this.throwVX = constrain(vx, -25, 25);
      this.throwVY = constrain(vy, -18, 5);

      this.throwDirection = this.throwVX >= 0 ? 1 : -1;

      const lines = ["Hey!!! What are you doing!!!!!", "Oh My God!!!!"];
      speechBubble.trigger(this.throwDirection, random(lines));
    }
  }

  spillByWheel(delta, speechBubble) {
    this.state = "SPILLING";
    this.spillProgress += abs(delta) * 0.008;
    this.spillProgress = constrain(this.spillProgress, 0, 1);

    if (this.spillProgress > 0.3 && !this.spillSpeechTriggered) {
      this.spillSpeechTriggered = true;
      const spillLines = ["Oops! Look at this mess!", "No! My coffee spilled!"];
      speechBubble.trigger(0, random(spillLines));
    }
  }

  update() {
    if (this.state === "DRINKING") {
      if (this.coffeeLevel > 0) {
        this.y = lerp(this.y, this.initialY - 25, 0.2);
        this.angle = lerp(this.angle, -QUARTER_PI * 0.7, 0.2);
      } else {
        this.y = lerp(this.y, this.initialY, 0.1);
        this.angle = lerp(this.angle, 0, 0.1);

        if (abs(this.y - this.initialY) < 1) {
          this.state = "FINISHED";
        }
      }
    } else if (this.state === "THROWING") {
      this.x += this.throwVX;
      this.y += this.throwVY;
      this.throwVY += 0.6;
      this.angle += this.throwDirection * 0.15;

      if (this.x < -120 || this.x > width + 120 || this.y > height + 120) {
        this.state = "FINISHED";
      }
    } else if (this.state === "SPILLING") {
      this.angle = lerp(0, HALF_PI, this.spillProgress);
      this.coffeeLevel = 1.0 - this.spillProgress;

      if (this.spillProgress >= 1) {
        this.spillTimer += 0.05;
        if (this.spillTimer > 1.8) {
          this.state = "FINISHED";
        }
      }
    }
  }

  display() {
    if (this.state === "FINISHED") return;

    if (this.state === "SPILLING" && this.spillProgress > 0.1) {
      stroke(120, 80, 75);
      strokeWeight(1.5);
      fill(160, 105, 95);
      let spillSize = this.spillProgress * 85;
      ellipse(this.x + 40, height / 2 + 95, spillSize * 1.6, spillSize * 0.5);
    }

    push();
    translate(this.x, this.y);
    rotate(this.angle);

    rectMode(CENTER);

    // 손잡이
    stroke(100, 75, 70);
    strokeWeight(2);
    fill(255, 250, 248);
    arc(-38, 0, 30, 42, HALF_PI, HALF_PI + PI);

    // 컵 몸통
    stroke(100, 75, 70);
    strokeWeight(2);
    fill(255, 250, 248);
    rect(0, 0, this.width, this.height, 3, 3, 12, 12);

    // 커피 액체
    if (this.coffeeLevel > 0) {
      noStroke();
      fill(130, 85, 75);
      let h = 64 * this.coffeeLevel;
      rect(0, 28 - h / 2, 58, h, 0, 0, 8, 8);
    }
    pop();

    if (this.state === "IDLE") {
      this.drawSteam();
    }
  }

  drawSteam() {
    noFill();
    stroke(200, 165, 160);
    strokeWeight(1.8);
    let t = frameCount * 0.05;

    for (let i = -1; i <= 1; i += 2) {
      beginShape();
      for (let y = 0; y < 32; y += 5) {
        let sx = sin(t + y * 0.2) * 5 + i * 14;
        vertex(this.x + sx, this.y - 52 - y);
      }
      endShape();
    }
  }
}

// ==========================================
// 2. 동그란 모양의 타자기 영문 말풍선 클래스
// ==========================================
class SpeechBubble {
  constructor() {
    this.fullText = "";
    this.currentText = "";
    this.direction = 1;
    this.opacity = 0;
    this.charIndex = 0;
    this.typeSpeed = 2;
  }

  trigger(direction, text) {
    this.direction = direction;
    this.fullText = text;
    this.currentText = "";
    this.charIndex = 0;
    this.opacity = 255;
  }

  update() {
    if (this.opacity > 0) {
      if (
        frameCount % this.typeSpeed === 0 &&
        this.charIndex < this.fullText.length
      ) {
        this.charIndex++;
        this.currentText = this.fullText.substring(0, this.charIndex);
      }

      if (this.charIndex >= this.fullText.length) {
        this.opacity -= 1.8;
      }
    }
  }

  display() {
    if (this.opacity <= 0) return;

    push();
    let bubbleX, bubbleY;

    if (this.direction === 1) {
      bubbleX = width - 210;
      bubbleY = 110;
    } else if (this.direction === -1) {
      bubbleX = 210;
      bubbleY = 110;
    } else {
      bubbleX = width / 2;
      bubbleY = 110;
    }

    stroke(100, 75, 70, this.opacity);
    strokeWeight(1.8);
    fill(255, 245, 245, constrain(this.opacity, 0, 255));

    let bubbleW = max(textWidth(this.fullText) + 60, 220);
    let bubbleH = 80;
    ellipse(bubbleX, bubbleY, bubbleW, bubbleH);

    let tailStartX, tailTargetX;

    if (this.direction === 1) {
      tailStartX = bubbleX + 50;
      tailTargetX = bubbleX + 110;
    } else if (this.direction === -1) {
      tailStartX = bubbleX - 50;
      tailTargetX = bubbleX - 110;
    } else {
      tailStartX = bubbleX;
      tailTargetX = bubbleX;
    }

    fill(255, 245, 245, constrain(this.opacity, 0, 255));
    triangle(
      tailStartX - 12,
      bubbleY + 30,
      tailStartX + 12,
      bubbleY + 30,
      tailTargetX,
      bubbleY + (this.direction === 0 ? 80 : 55),
    );

    noStroke();
    ellipse(bubbleX, bubbleY, bubbleW - 4, bubbleH - 4);

    fill(90, 60, 55, this.opacity);
    textAlign(CENTER, CENTER);
    textFont("Courier New");
    textSize(13);
    textStyle(BOLD);

    let cursor =
      this.charIndex < this.fullText.length && frameCount % 10 < 5 ? "_" : "";
    text(this.currentText + cursor, bubbleX, bubbleY);
    pop();
  }
}

// ==========================================
// 3. 터지는 하트 파티클 클래스 (Heart Particle)
// ==========================================
class HeartPopParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    let angle = random(TWO_PI);
    let speed = random(1.5, 4.5);
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.size = random(4, 9);
    this.alpha = 255;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08; // 살짝 떨어지는 효과
    this.alpha -= 6; // 점점 사라짐
  }

  display() {
    push();
    noStroke();
    fill(240, 130, 150, this.alpha);
    ellipse(this.x, this.y, this.size);
    pop();
  }
}

// ==========================================
// 4. 떠다니는 파스텔 하트 클래스 (Floating Heart)
// ==========================================
class FloatingHeart {
  constructor() {
    this.reset();
    this.y = random(height);
  }

  reset() {
    this.x = random(width);
    this.y = height + random(10, 40);
    this.size = random(10, 18);
    this.speedY = random(0.5, 1.2);
    this.swing = random(0.02, 0.05);
    this.alpha = random(130, 210);
  }

  // 마우스 클릭 시 터짐 판정
  isClicked(px, py) {
    let d = dist(px, py, this.x, this.y + this.size / 2);
    return d < this.size * 1.5;
  }

  update() {
    this.y -= this.speedY;
    this.x += sin(frameCount * this.swing) * 0.5;

    if (this.y < -20) {
      this.reset();
    }
  }

  display() {
    push();
    translate(this.x, this.y);
    noStroke();
    fill(235, 160, 170, this.alpha);

    beginShape();
    vertex(0, 0);
    bezierVertex(
      -this.size / 2,
      -this.size / 2,
      -this.size,
      this.size / 3,
      0,
      this.size,
    );
    bezierVertex(this.size, this.size / 3, this.size / 2, -this.size / 2, 0, 0);
    endShape(CLOSE);
    pop();
  }
}

// ==========================================
// 5. 메인 p5.js 제어 (Main Canvas & Events)
// ==========================================
let coffeeCup;
let speechBubble;
let hearts = [];
let particles = [];
let isWaitingRespawn = false;
let respawnTimer = 0;

// 마우스 인터랙션 제어 변수
let isCupPressed = false;
let pressStartX = 0;
let pressStartY = 0;
let prevMouseX = 0;
let prevMouseY = 0;
let mouseVX = 0;
let mouseVY = 0;

function setup() {
  let canvas = createCanvas(800, 500);
  canvas.parent("canvas-container");

  coffeeCup = new CoffeeCup(width / 2, height / 2 + 40);
  speechBubble = new SpeechBubble();

  for (let i = 0; i < 15; i++) {
    hearts.push(new FloatingHeart());
  }
}

function draw() {
  background(253, 243, 238);

  // 1. 하트 렌더링
  for (let heart of hearts) {
    heart.update();
    heart.display();
  }

  // 2. 터지는 파티클 애니메이션 렌더링
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // 테이블
  fill(240, 212, 202);
  stroke(100, 75, 70);
  strokeWeight(2);
  rect(-5, height / 2 + 85, width + 10, height / 2 + 10);

  // 컵 받침(코스터)
  drawCoaster(width / 2, height / 2 + 80);

  // 마우스 이동 속도 측정
  mouseVX = mouseX - prevMouseX;
  mouseVY = mouseY - prevMouseY;
  prevMouseX = mouseX;
  prevMouseY = mouseY;

  // 업데이트
  coffeeCup.update();
  speechBubble.update();

  // 인터랙션 완료 감지 -> 5초 리스폰
  if (coffeeCup.state === "FINISHED" && !isWaitingRespawn) {
    isWaitingRespawn = true;
    respawnTimer = millis();
  }

  // 5초 타자기 카운트다운
  if (isWaitingRespawn) {
    let elapsed = (millis() - respawnTimer) / 1000;
    let remaining = max(0, ceil(5 - elapsed));

    noStroke();
    fill(100, 70, 65);
    textAlign(CENTER, CENTER);
    textFont("Courier New");
    textSize(17);
    textStyle(BOLD);
    text(`[ BREWING NEW COFFEE... ${remaining}s ]`, width / 2, height / 2 - 30);

    if (elapsed >= 5) {
      coffeeCup.reset();
      isWaitingRespawn = false;
    }
  }

  // 화면 렌더링
  coffeeCup.display();
  speechBubble.display();

  // 테두리
  stroke(100, 75, 70);
  strokeWeight(2);
  noFill();
  rect(0, 0, width, height);
}

// 입체 컵 받침대 (Coaster)
function drawCoaster(cx, cy) {
  push();
  stroke(100, 75, 70);
  strokeWeight(1.8);

  fill(248, 222, 218);
  ellipse(cx, cy, 130, 42);

  stroke(220, 175, 170);
  strokeWeight(1.2);
  for (let i = -40; i <= 40; i += 16) {
    line(cx + i, cy - 12, cx + i, cy + 12);
  }
  line(cx - 55, cy - 4, cx + 55, cy - 4);
  line(cx - 55, cy + 4, cx + 55, cy + 4);
  pop();
}

// ------------------------------------------
// 마우스 이벤트 처리 (하트 클릭 팝 효과 포함)
// ------------------------------------------

function mousePressed() {
  // 1. 하트 클릭 검사 (하트 클릭 시 터지는 파티클 생성)
  for (let heart of hearts) {
    if (heart.isClicked(mouseX, mouseY)) {
      // 8~12개 파티클 폭발
      for (let i = 0; i < 10; i++) {
        particles.push(new HeartPopParticle(heart.x, heart.y));
      }
      heart.reset(); // 새로운 위치로 하트 재배치
      return; // 하트를 눌렀을 때는 컵 클릭을 방지
    }
  }

  // 2. 커피 컵 클릭 검사
  if (isWaitingRespawn) return;

  if (coffeeCup.contains(mouseX, mouseY)) {
    isCupPressed = true;
    pressStartX = mouseX;
    pressStartY = mouseY;
  }
}

function mouseDragged() {
  if (!isCupPressed || isWaitingRespawn) return;

  let dragDist = dist(mouseX, mouseY, pressStartX, pressStartY);

  if (dragDist > 10 || coffeeCup.state === "DRAG_THROW") {
    if (coffeeCup.state !== "SPILLING") {
      coffeeCup.startDrag(mouseX, mouseY);
    }
  }
}

function mouseReleased() {
  if (!isCupPressed) return;

  let moveDist = dist(mouseX, mouseY, pressStartX, pressStartY);

  if (moveDist <= 10 && coffeeCup.state !== "SPILLING") {
    if (coffeeCup.state === "IDLE" || coffeeCup.state === "DRINKING") {
      coffeeCup.drinkStep();
    }
  } else if (coffeeCup.state === "DRAG_THROW") {
    coffeeCup.releaseAndThrow(mouseVX, mouseVY, speechBubble);
  }

  isCupPressed = false;
}

function mouseWheel(event) {
  if (isWaitingRespawn) return;

  if (isCupPressed && coffeeCup.contains(mouseX, mouseY)) {
    coffeeCup.spillByWheel(event.delta, speechBubble);
    return false;
  }
}

let lemons = [];
let ices = [];
let herbs = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  initScene();
}

function initScene() {
  lemons = [];
  ices = [];
  herbs = [];

  for (let i = 0; i < 2; i++) {
    lemons.push({
      x: random(width * 0.15, width * 0.85),
      startY: height + random(50, 150),
      y: height + random(50, 150),
      targetY: random(height * 0.2, height * 0.45),
      floatOffset: random(100),
      vx: 0,
      vy: 0,
    });
  }

  for (let i = 0; i < 15; i++) {
    ices.push({
      x: random(width * 0.1, width * 0.9),
      startY: height + random(50, 200),
      y: height + random(50, 200),
      targetY: random(height * 0.15, height * 0.5),
      floatOffset: random(100),
      size: random(15, 25),
      vx: 0,
      vy: 0,
    });
  }

  for (let i = 0; i < 3; i++) {
    herbs.push({
      x: random(width * 0.15, width * 0.85),
      startY: height + random(50, 150),
      y: height + random(50, 150),
      targetY: random(height * 0.25, height * 0.55),
      floatOffset: random(100),
      vx: 0,
      vy: 0,
    });
  }
}

function draw() {
  background(255);

  let allItems = [...ices, ...lemons, ...herbs];

  for (let item of allItems) {
    let dy = item.targetY - item.y;
    item.vy += dy * 0.005;

    item.x += item.vx;
    item.y += item.vy;

    item.vx *= 0.92;
    item.vy *= 0.92;
  }

  checkCollisions();

  for (let ice of ices) {
    let floatX = cos(frameCount * 0.02 + ice.floatOffset) * 6;
    let floatY = sin(frameCount * 0.03 + ice.floatOffset) * 5;
    drawIce(ice.x + floatX, ice.y + floatY, ice.size);
  }

  for (let lemon of lemons) {
    let floatX = cos(frameCount * 0.025 + lemon.floatOffset) * 8;
    let floatY = sin(frameCount * 0.035 + lemon.floatOffset) * 6;
    drawLemon(lemon.x + floatX, lemon.y + floatY);
  }

  for (let herb of herbs) {
    let floatX = cos(frameCount * 0.03 + herb.floatOffset) * 7;
    let floatY = sin(frameCount * 0.04 + herb.floatOffset) * 4;
    drawHerb(herb.x + floatX, herb.y + floatY);
  }
}

function drawIce(x, y, size) {
  push();
  translate(x, y);
  stroke(180, 200, 220);
  strokeWeight(1.5);
  fill(255);
  rectMode(CENTER);
  rect(0, 0, size, size, 4);
  pop();
}

function drawLemon(x, y) {
  push();
  translate(x, y);

  noStroke();
  fill(255, 200, 0);
  ellipse(0, 0, 80, 80);

  fill(255, 245, 170);
  ellipse(0, 0, 68, 68);

  stroke(255, 200, 0);
  strokeWeight(3);
  line(-30, 0, 30, 0);
  line(0, -30, 0, 30);
  line(-20, -20, 20, 20);
  line(-20, 20, 20, -20);

  pop();
}

function drawHerb(x, y) {
  push();
  translate(x, y);
  noStroke();
  fill(50, 160, 80);

  rotate(-0.4);
  ellipse(-10, 0, 15, 35);

  rotate(0.8);
  ellipse(10, 0, 15, 35);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initScene();
}

function checkCollisions() {
  let allItems = [];

  for (let item of ices) {
    let floatX = cos(frameCount * 1 + item.floatOffset) * 15;
    let floatY = sin(frameCount * 1 + item.floatOffset) * 10;
    allItems.push({
      ref: item,
      renderX: item.x + floatX,
      renderY: item.y + floatY,
      radius: (item.size / 2) * 0.85,
    });
  }

  for (let item of lemons) {
    let floatX = cos(frameCount * 0.025 + item.floatOffset) * 20;
    let floatY = sin(frameCount * 0.035 + item.floatOffset) * 15;
    allItems.push({
      ref: item,
      renderX: item.x + floatX,
      renderY: item.y + floatY,
      radius: 34,
    });
  }

  for (let item of herbs) {
    let floatX = cos(frameCount * 0.03 + item.floatOffset) * 18;
    let floatY = sin(frameCount * 0.04 + item.floatOffset) * 12;
    allItems.push({
      ref: item,
      renderX: item.x + floatX,
      renderY: item.y + floatY,
      radius: 10,
    });
  }

  for (let i = 0; i < allItems.length; i++) {
    for (let j = i + 1; j < allItems.length; j++) {
      let a = allItems[i];
      let b = allItems[j];

      let d = dist(a.renderX, a.renderY, b.renderX, b.renderY);
      let minDist = a.radius + b.radius;

      if (d < minDist && d > 0) {
        let overlap = minDist - d;

        let dx = (b.renderX - a.renderX) / d;
        let dy = (b.renderY - a.renderY) / d;

        a.ref.x -= dx * overlap * 0.5;
        a.ref.y -= dy * overlap * 0.5;
        b.ref.x += dx * overlap * 0.5;
        b.ref.y += dy * overlap * 0.5;

        let bounceForce = 0.8;
        a.ref.vx -= dx * bounceForce;
        a.ref.vy -= dy * bounceForce;
        b.ref.vx += dx * bounceForce;
        b.ref.vy += dy * bounceForce;
      }
    }
  }
}

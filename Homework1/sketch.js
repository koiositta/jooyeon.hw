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
    });
  }

  for (let i = 0; i < 3; i++) {
    herbs.push({
      x: random(width * 0.15, width * 0.85),
      startY: height + random(50, 150),
      y: height + random(50, 150),
      targetY: random(height * 0.25, height * 0.55),
      floatOffset: random(100),
    });
  }
}

function draw() {
  background(255);

  for (let ice of ices) {
    ice.y = lerp(ice.y, ice.targetY, 0.02);
    let floatY = sin(frameCount * 0.03 + ice.floatOffset) * 5;
    drawIce(ice.x, ice.y + floatY, ice.size);
  }

  for (let lemon of lemons) {
    lemon.y = lerp(lemon.y, lemon.targetY, 0.025);
    let floatY = sin(frameCount * 0.035 + lemon.floatOffset) * 6;
    drawLemon(lemon.x, lemon.y + floatY);
  }

  for (let herb of herbs) {
    herb.y = lerp(herb.y, herb.targetY, 0.03);
    let floatY = sin(frameCount * 0.04 + herb.floatOffset) * 4;
    drawHerb(herb.x, herb.y + floatY);
  }
  checkCollisions();
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
    let floatY = sin(frameCount * 0.03 + item.floatOffset) * 5;
    allItems.push({
      ref: item,
      renderY: item.y + floatY,
      radius: item.size / 2,
    });
  }

  for (let item of lemons) {
    let floatY = sin(frameCount * 0.035 + item.floatOffset) * 6;
    allItems.push({ ref: item, renderY: item.y + floatY, radius: 40 });
  }

  for (let item of herbs) {
    let floatY = sin(frameCount * 0.04 + item.floatOffset) * 4;
    allItems.push({ ref: item, renderY: item.y + floatY, radius: 20 });
  }

  for (let i = 0; i < allItems.length; i++) {
    for (let j = i + 1; j < allItems.length; j++) {
      let a = allItems[i];
      let b = allItems[j];

      let d = dist(a.ref.x, a.renderY, b.ref.x, b.renderY);
      let minDist = a.radius + b.radius;

      if (d < minDist && d > 0) {
        let overlap = minDist - d;

        let dx = (b.ref.x - a.ref.x) / d;
        let dy = (b.renderY - a.renderY) / d;

        let bounceStrength = 1.5;

        a.ref.x -= dx * overlap * bounceStrength;
        a.ref.y -= dy * overlap * bounceStrength;
        b.ref.x += dx * overlap * bounceStrength;
        b.ref.y += dy * overlap * bounceStrength;
      }
    }
  }
}

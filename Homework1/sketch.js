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

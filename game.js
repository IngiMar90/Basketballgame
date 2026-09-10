"use strict";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const ui = {
  score: document.querySelector("#score"), shots: document.querySelector("#shots"), shotsBox: document.querySelector("#shotsBox"),
  highScore: document.querySelector("#highScore"), message: document.querySelector("#message"), start: document.querySelector("#startPanel"),
  end: document.querySelector("#endPanel"), finalScore: document.querySelector("#finalScore"), endStars: document.querySelector("#endStars"),
  left: document.querySelector("#leftBtn"), right: document.querySelector("#rightBtn"), shoot: document.querySelector("#shootBtn"),
  fill: document.querySelector("#powerFill"), marker: document.querySelector("#powerMarker"), powerNumber: document.querySelector("#powerNumber"),
  sound: document.querySelector("#soundBtn"), fullscreen: document.querySelector("#fullscreenBtn")
};

const W = 1280, H = 720, floorY = 662;
const hoop = { rimLeft: 987, rimRight: 1093, rimY: 323 };
const player = { x: 265, y: floorY, vx: 0, width: 148, height: 232, frame: 0, anim: 0 };
const ball = { x: 0, y: 0, vx: 0, vy: 0, radius: 23, active: false, scored: false, bounced: false, age: 0 };
const state = {
  started: false, ended: false, mode: "challenge", score: 0, shots: 10, streak: 0,
  charging: false, power: 0, chargeDirection: 1, canShoot: true, sound: true,
  keys: { left: false, right: false }, lastTime: performance.now(), messageTimer: 0,
  targetX: null, previousTargetX: null
};

const targetPositions = [135, 255, 385, 520, 650, 770];

const images = {};
const sources = {
  gym: "./assets/gym.webp", hoop: "./assets/hoop-game-v2.webp", ball: "./assets/ball-game.webp",
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`p${i}`, `./assets/player/frame-0${i}.webp`]))
};

function loadImages() {
  return Promise.all(Object.entries(sources).map(([key, src]) => new Promise(resolve => {
    const img = new Image(); img.onload = () => { images[key] = img; resolve(); };
    img.onerror = resolve; img.src = src;
  })));
}

function startGame(mode = state.mode) {
  state.mode = mode; state.started = true; state.ended = false; state.score = 0; state.shots = mode === "practice" ? Infinity : 10;
  state.streak = 0; state.charging = false; state.power = 0; state.canShoot = true;
  player.x = 265; player.frame = 0; ball.active = false; state.targetX = null; state.previousTargetX = null;
  if (mode === "target") chooseNextTarget(true);
  ui.start.classList.add("hidden"); ui.end.classList.add("hidden");
  ui.shotsBox.classList.toggle("hidden", mode === "practice");
  updateHud();
  if (mode === "target") showMessage("Stattu í rauða hringnum!", false, 1500);
  else showMessage(mode === "challenge" ? "10 boltar – gangi þér vel!" : "Frjáls æfing", false, 1300);
}

function chooseNextTarget(first = false) {
  const choices = targetPositions.filter(x => x !== state.targetX && (first ? Math.abs(x - player.x) > 80 : Math.abs(x - state.targetX) >= 120));
  state.previousTargetX = state.targetX;
  state.targetX = choices[Math.floor(Math.random() * choices.length)];
}

function playerIsOnTarget() {
  return state.mode !== "target" || Math.abs(player.x - state.targetX) <= 42;
}

function updateHud() {
  ui.score.textContent = state.score;
  ui.shots.textContent = Number.isFinite(state.shots) ? state.shots : "∞";
  ui.highScore.textContent = localStorage.getItem("basketballHighScore") || "0";
}

function endGame() {
  state.ended = true; state.started = false;
  const old = Number(localStorage.getItem("basketballHighScore") || 0);
  if (state.score > old) localStorage.setItem("basketballHighScore", state.score);
  ui.finalScore.textContent = `${state.score} stig`;
  ui.endStars.textContent = state.score >= 20 ? "⭐⭐⭐" : state.score >= 10 ? "⭐⭐" : "⭐";
  ui.end.classList.remove("hidden"); updateHud();
}

function beginCharge() {
  if (!state.started || state.ended || !state.canShoot || ball.active) return;
  if (!playerIsOnTarget()) {
    showMessage("Stattu í rauða hringnum!", false, 900);
    return;
  }
  state.charging = true; state.power = Math.max(5, state.power); state.chargeDirection = 1;
  player.frame = 4; ui.shoot.classList.add("pressed");
}

function releaseShot() {
  ui.shoot.classList.remove("pressed");
  if (!state.charging) return;
  state.charging = false; shootBall(state.power); state.power = 0;
}

function shootBall(power) {
  if (!state.canShoot) return;
  state.canShoot = false; player.frame = 5;
  if (Number.isFinite(state.shots)) state.shots--;
  const startX = player.x + 80, startY = player.y - 190;
  const dx = hoop.rimLeft + 40 - startX;
  const dy = hoop.rimY - 8 - startY;
  const angle = 55 * Math.PI / 180;
  const gravity = 960;
  const denominator = 2 * Math.cos(angle) ** 2 * (dx * Math.tan(angle) + dy);
  const idealSpeed = Math.sqrt(Math.max(1, gravity * dx * dx / denominator));
  const accuracy = Math.max(.55, Math.min(1.38, power / 71));
  ball.x = startX; ball.y = startY; ball.vx = idealSpeed * Math.cos(angle) * accuracy; ball.vy = -idealSpeed * Math.sin(angle) * accuracy;
  ball.active = true; ball.scored = false; ball.bounced = false; ball.age = 0;
  sound("shoot"); updateHud();
}

function resetForNextShot() {
  ball.active = false; player.frame = 0;
  if (state.mode !== "practice" && state.shots <= 0) {
    state.canShoot = false;
    setTimeout(endGame, 550);
  } else {
    state.canShoot = true;
    if (state.mode === "target") {
      chooseNextTarget();
      showMessage("Nýr skotstaður!", false, 850);
    }
  }
}

function scoreBasket() {
  if (ball.scored) return;
  ball.scored = true; state.streak++;
  const three = player.x < 420;
  const points = three ? 3 : 2; state.score += points;
  const old = Number(localStorage.getItem("basketballHighScore") || 0);
  if (state.mode === "challenge" && state.score > old) localStorage.setItem("basketballHighScore", state.score);
  player.frame = 7; updateHud(); sound("score");
  showMessage(state.streak >= 3 ? `🔥 ${state.streak} í röð! +${points}` : `KARFA! +${points}`, true, 1250);
}

function miss() {
  if (!ball.active || ball.scored) return;
  state.streak = 0; showMessage("Næstum því!", false, 800);
}

function showMessage(text, scored = false, duration = 900) {
  clearTimeout(state.messageTimer); ui.message.textContent = text;
  ui.message.classList.toggle("score", scored); ui.message.classList.add("show");
  state.messageTimer = setTimeout(() => ui.message.classList.remove("show"), duration);
}

function sound(type) {
  if (!state.sound) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const audio = sound.context || (sound.context = new AudioCtx());
  if (audio.state === "suspended") audio.resume();
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.connect(gain); gain.connect(audio.destination);
  const now = audio.currentTime;
  if (type === "score") {
    osc.frequency.setValueAtTime(520, now); osc.frequency.exponentialRampToValueAtTime(980, now + .18);
    gain.gain.setValueAtTime(.12, now); gain.gain.exponentialRampToValueAtTime(.001, now + .35);
    osc.start(now); osc.stop(now + .36);
  } else {
    osc.frequency.setValueAtTime(180, now); osc.frequency.exponentialRampToValueAtTime(90, now + .12);
    gain.gain.setValueAtTime(.06, now); gain.gain.exponentialRampToValueAtTime(.001, now + .15);
    osc.start(now); osc.stop(now + .16);
  }
}

function update(dt) {
  if (!state.started || state.ended) return;
  const moving = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
  if (!ball.active && !state.charging) {
    player.vx += moving * 1700 * dt; player.vx *= Math.pow(.002, dt); player.x += player.vx * dt;
    player.x = Math.max(105, Math.min(780, player.x));
    if (moving) { player.anim += dt * 9; player.frame = 1 + (Math.floor(player.anim) % 2); }
    else if (state.canShoot && player.frame !== 7) player.frame = 0;
  }

  if (state.charging) {
    state.power += state.chargeDirection * 82 * dt;
    if (state.power >= 100) { state.power = 100; state.chargeDirection = -1; }
    if (state.power <= 8) { state.power = 8; state.chargeDirection = 1; }
  }
  ui.fill.style.width = `${state.power}%`; ui.marker.style.left = `${state.power}%`; ui.powerNumber.textContent = `${Math.round(state.power)}%`;

  if (ball.active) {
    const oldY = ball.y; ball.age += dt; ball.vy += 960 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    const crossedRim = oldY < hoop.rimY && ball.y >= hoop.rimY && ball.vy > 0;
    if (crossedRim && ball.x > hoop.rimLeft && ball.x < hoop.rimRight) scoreBasket();

    if (!ball.scored && ball.x + ball.radius > 1100 && ball.x - ball.radius < 1116 && ball.y > 215 && ball.y < 388 && ball.vx > 0) {
      ball.x = 1100 - ball.radius; ball.vx *= -.72; sound("bounce");
    }

    for (const rx of [hoop.rimLeft, hoop.rimRight]) {
      const dx = ball.x - rx, dy = ball.y - hoop.rimY, dist = Math.hypot(dx, dy);
      if (dist < ball.radius + 7 && dist > 0) {
        const nx = dx / dist, ny = dy / dist, dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) { ball.vx -= 1.55 * dot * nx; ball.vy -= 1.55 * dot * ny; ball.x = rx + nx * (ball.radius + 7); ball.y = hoop.rimY + ny * (ball.radius + 7); sound("bounce"); }
      }
    }

    if (ball.y + ball.radius > floorY) {
      ball.y = floorY - ball.radius;
      if (!ball.bounced) { miss(); ball.bounced = true; }
      ball.vy *= -.48; ball.vx *= .77; sound("bounce");
    }
    if (ball.age > 5 || ball.x > W + 100 || (ball.bounced && Math.abs(ball.vy) < 55)) resetForNextShot();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (images.gym) ctx.drawImage(images.gym, 0, 0, W, H);
  else { ctx.fillStyle = "#c9e6f5"; ctx.fillRect(0, 0, W, H); }

  if (state.started && state.mode === "target" && state.targetX !== null) {
    const onTarget = playerIsOnTarget();
    ctx.save();
    ctx.fillStyle = onTarget ? "rgba(40, 190, 85, .24)" : "rgba(225, 35, 45, .24)";
    ctx.strokeStyle = onTarget ? "#19a64a" : "#e51f2b";
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(state.targetX, floorY - 2, 62, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "white"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(state.targetX, floorY - 2, 48, 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(9,38,78,.12)"; ctx.beginPath(); ctx.ellipse(player.x, floorY + 2, 72, 13, 0, 0, Math.PI * 2); ctx.fill();
  const p = images[`p${player.frame}`] || images.p0;
  if (p) {
    const scale = Math.min(player.width / p.width, player.height / p.height);
    const dw = p.width * scale, dh = p.height * scale;
    ctx.drawImage(p, player.x - dw / 2, player.y - dh, dw, dh);
  }

  if (images.hoop) ctx.drawImage(images.hoop, 955, 180, 300, 252);
  if (ball.active && images.ball) {
    ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.age * 8); ctx.drawImage(images.ball, -ball.radius, -ball.radius, ball.radius * 2, ball.radius * 2); ctx.restore();
  }

  ctx.save(); ctx.globalAlpha = .7; ctx.strokeStyle = "#0b3d91"; ctx.lineWidth = 5; ctx.setLineDash([13, 11]);
  ctx.beginPath(); ctx.moveTo(420, floorY); ctx.lineTo(420, 565); ctx.stroke(); ctx.restore();
  ctx.fillStyle = "rgba(11,61,145,.78)"; ctx.font = "800 18px system-ui"; ctx.textAlign = "center"; ctx.fillText("3 STIG", 365, 590);
}

function frame(now) {
  const dt = Math.min(.035, (now - state.lastTime) / 1000); state.lastTime = now;
  update(dt); draw(); requestAnimationFrame(frame);
}

function setMove(direction, pressed) {
  state.keys[direction] = pressed; ui[direction].classList.toggle("pressed", pressed);
}

function holdButton(button, onDown, onUp) {
  button.addEventListener("pointerdown", e => { e.preventDefault(); button.setPointerCapture?.(e.pointerId); onDown(); });
  button.addEventListener("pointerup", e => { e.preventDefault(); onUp(); });
  button.addEventListener("pointercancel", onUp); button.addEventListener("lostpointercapture", onUp);
}

holdButton(ui.left, () => setMove("left", true), () => setMove("left", false));
holdButton(ui.right, () => setMove("right", true), () => setMove("right", false));
holdButton(ui.shoot, beginCharge, releaseShot);

window.addEventListener("keydown", e => {
  if (["ArrowLeft","ArrowRight","Space","Enter","KeyA","KeyD"].includes(e.code)) e.preventDefault();
  if (e.repeat && ["Space","Enter"].includes(e.code)) return;
  if (e.code === "ArrowLeft" || e.code === "KeyA") setMove("left", true);
  if (e.code === "ArrowRight" || e.code === "KeyD") setMove("right", true);
  if (e.code === "Space" || e.code === "Enter") beginCharge();
});
window.addEventListener("keyup", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") setMove("left", false);
  if (e.code === "ArrowRight" || e.code === "KeyD") setMove("right", false);
  if (e.code === "Space" || e.code === "Enter") releaseShot();
});

canvas.addEventListener("pointerdown", e => {
  if (!state.started || ball.active || state.charging) return;
  const rect = canvas.getBoundingClientRect(); const target = (e.clientX - rect.left) / rect.width * W;
  player.x = Math.max(105, Math.min(780, target)); player.vx = 0;
});

document.querySelectorAll("[data-mode]").forEach(btn => btn.addEventListener("click", () => startGame(btn.dataset.mode)));
document.querySelector("#playAgainBtn").addEventListener("click", () => startGame(state.mode));
document.querySelector("#menuBtn").addEventListener("click", () => { ui.end.classList.add("hidden"); ui.start.classList.remove("hidden"); state.ended = false; draw(); });
ui.sound.addEventListener("click", () => { state.sound = !state.sound; ui.sound.textContent = state.sound ? "🔊" : "🔇"; });
ui.fullscreen.addEventListener("click", async () => {
  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch (_) { showMessage("Fullscreen er ekki í boði", false); }
});

window.addEventListener("blur", () => { setMove("left", false); setMove("right", false); if (state.charging) releaseShot(); });
window.addEventListener("contextmenu", e => e.preventDefault());
ui.highScore.textContent = localStorage.getItem("basketballHighScore") || "0";
loadImages().then(draw); requestAnimationFrame(frame);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
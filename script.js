'use strict';

// ═══════════════════════════════════════════════════════
//  GLOBAL CONSTANTS
//  These numbers define the game's coordinate system and
//  timing target. Everything is measured in "logical pixels"
//  based on a 1280×720 canvas, then scaled to fit any screen.
// ═══════════════════════════════════════════════════════

const TARGET_FPS = 60;   // The framerate all speeds are designed for
const ASPECT_W   = 16;   // Widescreen ratio width  (16:9)
const ASPECT_H   = 9;    // Widescreen ratio height (16:9)
const BASE_W     = 1280; // Logical canvas width  in pixels
const BASE_H     = 720;  // Logical canvas height in pixels

// The three states a hop can be in: going up, coming down, or on the ground
const HOP_STATES = { RISING: 0, FALLING: 1, LANDED: 2 };

// Key used to save/load session history in the browser's localStorage
const STORAGE_KEY = 'aimrabbit_v2';

// ═══════════════════════════════════════════════════════
//  MATH HELPERS
//  Small reusable math functions used throughout the game.
// ═══════════════════════════════════════════════════════

// Linearly interpolate between a and b by fraction t (0=a, 1=b)
const lerp        = (a, b, t) => a + (b - a) * t;
// Clamp v so it never goes below lo or above hi
const clamp       = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Return a random decimal number between a and b
const randBetween = (a, b) => a + Math.random() * (b - a);

// ═══════════════════════════════════════════════════════
//  SESSION HISTORY  (persists across browser sessions)
//  Saves the last 20 game results in localStorage so the
//  accuracy sparkline on the start screen has data to show.
// ═══════════════════════════════════════════════════════

function loadHistory() {
  // Try to read saved data; return empty array if there's nothing yet
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveHistory(entry) {
  // Load existing data, add this new game's result, keep only the most recent 20
  const h = loadHistory();
  h.push(entry);
  if (h.length > 20) h.splice(0, h.length - 20);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch {}
  return h;
}

// ═══════════════════════════════════════════════════════
//  EASTER BUNNY CHARACTER
//  Draws an Easter Bunny in a full pink bunny suit.
//  The head is a round bunny head (not a human face) with
//  tall ears, big cute eyes, a button nose, and whiskers.
//  The body is a clean pink suit with no chest decorations.
// ═══════════════════════════════════════════════════════

class TacticalBunny {
  constructor(difficulty) {
    this.difficulty = difficulty;

    // Radius controls how big the bunny is; shrinks slightly at higher difficulty
    this.radius = Math.max(28, 52 - difficulty * 2.8);

    // Spawn at a random position away from the very edges
    const margin = this.radius * 2;
    this.x       = randBetween(margin, BASE_W - margin);
    this.y       = randBetween(BASE_H * 0.25, BASE_H * 0.72 - margin);

    // groundY is the Y position at ground level (the hop arc lifts above this)
    this.groundY  = this.y;
    // visualY is the actual rendered Y position (groundY minus hop height)
    this.visualY  = this.y;

    // Hop physics state
    this.hopZ     = 0;                  // Current height above ground (0 = on ground)
    this.hopVZ    = 0;                  // Current vertical velocity (positive = rising)
    this.hopState = HOP_STATES.LANDED;  // Start on the ground
    this.landTimer = 0;                 // Countdown timer for the brief ground pause

    // Horizontal movement velocity
    this.vx = 0;
    this.vy = 0;

    // Visual lean angle (tilts in the direction of travel)
    this.tilt = 0;

    // Timer for the 10-second "catch me" countdown
    this.spawnTime  = performance.now();
    this.timeLimit  = 10000; // 10 seconds in milliseconds

    // How strongly to flash red when the timer is almost up
    this.flashAlpha = 0;

    // Arm-swing animation angle
    this.armSwing = 0;
    this.armRate  = 0;

    // Launch the first hop immediately after spawning
    this._launchHop();
  }

  // Choose a new hop direction and velocity, then spring into the air
  _launchHop() {
    // Speed in logical pixels per second (scales up with difficulty)
    const spd = (3.5 + this.difficulty * 0.55) * TARGET_FPS;

    // Pick a random direction to hop toward
    let ang = randBetween(0, Math.PI * 2);

    // If the bunny is near the edge, nudge the direction back toward center
    const dx = BASE_W / 2 - this.x;
    const dy = BASE_H * 0.5 - this.y;
    if (Math.sqrt(dx * dx + dy * dy) > BASE_W * 0.35) {
      ang = lerp(ang, Math.atan2(dy, dx), 0.45);
    }

    // Add a random jitter so the path zigzags unpredictably
    ang += randBetween(-0.9, 0.9);

    this.vx = Math.cos(ang) * spd;
    this.vy = Math.sin(ang) * spd;

    // Calculate hop height and the upward velocity needed to reach it
    const hopH   = randBetween(40, 80 + this.difficulty * 8);
    const grav   = 1800 + this.difficulty * 80;
    this.gravity = grav;
    this.hopVZ   = Math.sqrt(2 * grav * hopH); // physics: v = sqrt(2gh)

    this.hopState = HOP_STATES.RISING;
    this.hopZ     = 0;

    // Arm swing speed matches movement speed
    this.armRate = (3 + this.difficulty * 0.3) * TARGET_FPS * 0.016;
  }

  // Called every frame to advance physics and animation
  update(dt) { // dt = seconds elapsed since the last frame
    if (this.hopState === HOP_STATES.LANDED) {
      // Count down the ground pause; launch again when it hits zero
      this.landTimer -= dt;
      if (this.landTimer <= 0) this._launchHop();
      // Smoothly straighten the tilt while standing still
      this.tilt = lerp(this.tilt, 0, dt * 8);

    } else {
      // Apply gravity to pull the bunny back down
      this.hopVZ -= this.gravity * dt;
      this.hopZ  += this.hopVZ * dt;

      // If back on the ground, start the brief landing pause
      if (this.hopZ <= 0) {
        this.hopZ     = 0;
        this.hopVZ    = 0;
        this.hopState = HOP_STATES.LANDED;
        // Pause is shorter at higher difficulty (less rest time)
        this.landTimer = Math.max(0.02, randBetween(0.04, 0.18 - this.difficulty * 0.01));

      } else if (this.hopState === HOP_STATES.RISING && this.hopVZ <= 0) {
        // Passed the peak — now falling
        this.hopState = HOP_STATES.FALLING;
      }

      // Move horizontally while airborne
      this.groundY += this.vy * dt;
      this.x       += this.vx * dt;

      // Bounce off left/right walls with a random angle kick (prevents corner-trapping)
      const r = this.radius;
      if (this.x < r) {
        this.x  = r;
        this.vx =  Math.abs(this.vx) + randBetween(0, 50);
        this.vy += randBetween(-200, 200);
      } else if (this.x > BASE_W - r) {
        this.x  = BASE_W - r;
        this.vx = -Math.abs(this.vx) - randBetween(0, 50);
        this.vy += randBetween(-200, 200);
      }

      // Bounce off top/bottom play area boundaries
      const yMin = BASE_H * 0.08 + r;
      const yMax = BASE_H * 0.72 - r;
      if (this.groundY < yMin) {
        this.groundY = yMin;
        this.vy      =  Math.abs(this.vy) + randBetween(0, 50);
      } else if (this.groundY > yMax) {
        this.groundY = yMax;
        this.vy      = -Math.abs(this.vy) - randBetween(0, 50);
      }

      // Lean in the direction of travel
      this.tilt = lerp(this.tilt, clamp(this.vx * 0.0008, -0.35, 0.35), dt * 6);
    }

    // Advance arm-swing animation
    this.armSwing += this.armRate * dt;

    // The visual position is the ground Y minus how high the hop is
    this.visualY = this.groundY - this.hopZ;

    // Pulse a red glow when there are fewer than 3 seconds left
    const rem = (this.timeLimit - (performance.now() - this.spawnTime)) / 1000;
    this.flashAlpha = rem < 3 ? (Math.sin(performance.now() * 0.012) + 1) * 0.28 : 0;
  }

  // Draw the full Easter Bunny character onto the canvas
  draw(ctx) {
    const r        = this.radius;
    const x        = this.x;
    const y        = this.visualY;
    const onGround = this.hopState === HOP_STATES.LANDED;

    // Squish flat when landing, stretch tall when in the air (cartoon feel)
    const airFrac = clamp(this.hopZ / (r * 1.5), 0, 1);
    const scaleX  = onGround ? 1.15 : lerp(1, 0.82, airFrac);
    const scaleY  = onGround ? 0.85 : lerp(1, 1.20, airFrac);

    // Arm swing angle (alternates forward/back like running arms)
    const aa = Math.sin(this.armSwing) * 0.45;

    // Position, rotate, and scale the whole character as one unit
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.tilt);
    ctx.scale(scaleX, scaleY);

    // ── Ground shadow (appears below the bunny when airborne) ─────
    if (this.hopZ > 2) {
      const shadowScale = clamp(1 - this.hopZ / 120, 0.3, 1);
      const shadowY     = (this.groundY - y) / scaleY + r * 0.15;
      ctx.save();
      ctx.globalAlpha = 0.22 * shadowScale;
      ctx.fillStyle   = '#000';
      ctx.beginPath();
      ctx.ellipse(0, shadowY, r * 0.9 * shadowScale, r * 0.2 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Back arm (drawn first so the body covers it) ──────────────
    _drawArm(ctx, r, -1, -aa, true);

    // ── Legs with white paw boots ─────────────────────────────────
    const legSwing = Math.sin(this.armSwing + Math.PI) * (onGround ? 0.18 : 0.08);
    for (const [side, sw] of [[-1, legSwing], [1, -legSwing]]) {
      ctx.save();
      ctx.translate(side * r * 0.26, r * 0.6);
      ctx.rotate(sw);
      // Pink leg
      ctx.fillStyle   = '#f080b8';
      ctx.strokeStyle = '#c0407a';
      ctx.lineWidth   = r * 0.04;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, r * 0.2, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // White fluffy paw/boot at the bottom
      ctx.fillStyle = '#fff8fc';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.62, r * 0.24, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // ── Body — clean pink bunny suit, no decorations ──────────────
    ctx.fillStyle   = '#f06aaa';
    ctx.strokeStyle = '#c0407a';
    ctx.lineWidth   = r * 0.055;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.12, r * 0.68, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Slightly lighter belly patch in the center (gives the suit some shape)
    ctx.fillStyle = '#ff9ecb';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.15, r * 0.35, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Neck connector between body and head ─────────────────────
    ctx.fillStyle   = '#f080b8';
    ctx.strokeStyle = '#c0407a';
    ctx.lineWidth   = r * 0.03;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.28, r * 0.28, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ── Bunny head — round, soft, Easter-bunny shaped ────────────
    ctx.fillStyle   = '#f9d0e8'; // pale pink, like a stuffed bunny
    ctx.strokeStyle = '#d060a0';
    ctx.lineWidth   = r * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.78, r * 0.56, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soft cheek puffs (makes the face look extra round and cute)
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle   = '#ff88bb';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.68, r * 0.18, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( r * 0.32, -r * 0.68, r * 0.18, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Tall bunny ears (drawn before hair so hair sits on top) ───
    const earWiggle = Math.sin(performance.now() * 0.0018) * 0.07;
    for (const [ex, baseRot] of [[-r * 0.24, -0.08], [r * 0.24, 0.08]]) {
      ctx.save();
      ctx.translate(ex, -r * 1.24);
      ctx.rotate(baseRot + earWiggle * (ex < 0 ? 1 : -1));
      // Outer ear — white/pale pink
      ctx.fillStyle   = '#fff0f5';
      ctx.strokeStyle = '#e0a0c8';
      ctx.lineWidth   = r * 0.04;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.22, r * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner ear — bright pink stripe
      ctx.fillStyle = '#ff80b8';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.11, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Fluffy top-of-head fur (covers where ears meet the head) ──
    ctx.fillStyle   = '#fce0f0';
    ctx.strokeStyle = '#e090c8';
    ctx.lineWidth   = r * 0.025;
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.08, r * 0.48, r * 0.20, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Big round cute eyes ───────────────────────────────────────
    // White sclera
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.21, -r * 0.80, r * 0.17, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( r * 0.21, -r * 0.80, r * 0.17, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coloured iris — warm amber/brown (classic Easter bunny look)
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(-r * 0.21, -r * 0.80, r * 0.11, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse( r * 0.21, -r * 0.80, r * 0.11, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupils
    ctx.fillStyle = '#1a0800';
    ctx.beginPath();
    ctx.arc(-r * 0.21, -r * 0.80, r * 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc( r * 0.21, -r * 0.80, r * 0.065, 0, Math.PI * 2);
    ctx.fill();

    // Anime-style eye sparkle highlights
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(-r * 0.17, -r * 0.84, r * 0.04,  0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.77, r * 0.022, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.25, -r * 0.84, r * 0.04,  0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.17, -r * 0.77, r * 0.022, 0, Math.PI * 2); ctx.fill();

    // Curved top eyelid line (makes eyes look soft and friendly)
    ctx.strokeStyle = '#5c1a00';
    ctx.lineWidth   = r * 0.038;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.arc(-r * 0.21, -r * 0.80, r * 0.17, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc( r * 0.21, -r * 0.80, r * 0.17, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // ── Bunny nose — small pink heart-shaped blob ─────────────────
    ctx.fillStyle = '#ff88b0';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.63, r * 0.09, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Smile line ───────────────────────────────────────────────
    ctx.strokeStyle = '#d0507a';
    ctx.lineWidth   = r * 0.045;
    ctx.beginPath();
    ctx.arc(0, -r * 0.56, r * 0.11, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // ── Whiskers (three lines each side) ─────────────────────────
    ctx.strokeStyle = 'rgba(180,80,120,0.55)';
    ctx.lineWidth   = r * 0.025;
    ctx.lineCap     = 'round';
    // Left whiskers
    for (const [x1, y1, x2, y2] of [
      [-r*0.10, -r*0.60,  -r*0.42, -r*0.58],
      [-r*0.10, -r*0.62,  -r*0.42, -r*0.65],
      [-r*0.10, -r*0.64,  -r*0.42, -r*0.72],
    ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
    // Right whiskers
    for (const [x1, y1, x2, y2] of [
      [r*0.10, -r*0.60,   r*0.42, -r*0.58],
      [r*0.10, -r*0.62,   r*0.42, -r*0.65],
      [r*0.10, -r*0.64,   r*0.42, -r*0.72],
    ]) { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }

    // ── Shoulder area — clean rounded bumps, no decorations ───────
    ctx.fillStyle   = '#e8609a';
    ctx.strokeStyle = '#b03070';
    ctx.lineWidth   = r * 0.04;
    ctx.beginPath();
    ctx.ellipse(-r * 0.74, -r * 0.10, r * 0.26, r * 0.19, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse( r * 0.74, -r * 0.10, r * 0.26, r * 0.19, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ── Front arm (drawn last so it appears in front of the body) ─
    _drawArm(ctx, r, 1, aa, false);

    // ── Urgency flash — red glow when timer is almost up ──────────
    if (this.flashAlpha > 0) {
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle   = '#ff1060';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.2, r * 1.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // Returns true if the click coordinates land on the bunny
  isHit(lx, ly) {
    const dx = lx - this.x;
    const dy = ly - this.visualY;
    return Math.sqrt(dx * dx + dy * dy) < this.radius * 1.1;
  }

  // How many milliseconds have passed since this bunny spawned
  getElapsedTime() { return performance.now() - this.spawnTime; }

  // Returns true once the 10-second window has expired
  isTimeUp() { return this.getElapsedTime() > this.timeLimit; }
}

// ─── Shared helper: draw one arm (called twice — back arm before body, front after)
function _drawArm(ctx, r, side, angle, back) {
  ctx.save();
  ctx.translate(side * r * 0.68, -r * 0.05);
  ctx.rotate(side * angle);
  // Arm — slightly darker pink than the body so it reads separately
  ctx.fillStyle   = back ? '#c03070' : '#e8609a';
  ctx.strokeStyle = '#a02050';
  ctx.lineWidth   = r * 0.04;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.3, r * 0.18, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // White fluffy paw at the end of the arm
  ctx.fillStyle = '#fff8fc';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.58, r * 0.17, r * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ─── Helper: draw a 5-pointed star shape (used in hit particle effects)
function _drawStar(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 === 0 ? outerR : innerR;
    ctx.lineTo(cx + Math.cos(rot) * rr, cy + Math.sin(rot) * rr);
    rot += step;
  }
  ctx.closePath();
  ctx.fill();
}

// ═══════════════════════════════════════════════════════
//  HIT PARTICLE
//  When you click the bunny, 20 of these burst outward.
//  Each one is a small circle or star that fades and falls.
// ═══════════════════════════════════════════════════════

class HitParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    // Launch in a random direction at a random speed
    const spd  = randBetween(60, 280);
    const ang  = randBetween(0, Math.PI * 2);
    this.vx    = Math.cos(ang) * spd;
    this.vy    = Math.sin(ang) * spd - randBetween(20, 80); // bias upward
    this.gravity = 420; // pulls the particle down over time
    this.life    = 1;   // 1.0 = fully visible, 0 = gone
    this.decay   = randBetween(1.4, 2.2); // how fast it fades (life units per second)
    this.size    = randBetween(4, 12);
    this.isStar  = Math.random() < 0.4; // 40% chance of star shape instead of circle
    // Pink/gold/violet colour palette matching the bunny
    const pals = [
      `hsl(${randBetween(320, 360)},100%,72%)`,
      `hsl(${randBetween(40,  60 )},100%,68%)`,
      `hsl(${randBetween(280, 310)},100%,72%)`,
      '#fff',
    ];
    this.color = pals[Math.floor(Math.random() * pals.length)];
  }

  update(dt) {
    this.x    += this.vx * dt;
    this.y    += this.vy * dt;
    this.vy   += this.gravity * dt; // gravity pulls it downward
    this.life -= this.decay * dt;   // fade out over time
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.fillStyle   = this.color;
    if (this.isStar) {
      _drawStar(ctx, this.x, this.y, 5, this.size, this.size * 0.45);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  isAlive() { return this.life > 0; }
}

// ═══════════════════════════════════════════════════════
//  MISS FLASH
//  A small red X drawn at the click position when you miss.
//  It expands outward and fades away quickly.
// ═══════════════════════════════════════════════════════

class MissFlash {
  constructor(x, y) { this.x = x; this.y = y; this.life = 1; }

  update(dt) { this.life -= dt * 3.5; } // fades in about 0.3 seconds

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.life * 0.75;
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth   = 3;
    const s = 14 * (1 - this.life * 0.4); // grows slightly as it fades
    ctx.beginPath();
    ctx.moveTo(this.x - s, this.y - s); ctx.lineTo(this.x + s, this.y + s);
    ctx.moveTo(this.x + s, this.y - s); ctx.lineTo(this.x - s, this.y + s);
    ctx.stroke();
    ctx.restore();
  }

  isAlive() { return this.life > 0; }
}

// ═══════════════════════════════════════════════════════
//  FLOATING TEXT
//  Text that pops up at the click position (e.g. "342ms"
//  or "MISS"), floats upward, and fades out.
// ═══════════════════════════════════════════════════════

class FloatingText {
  constructor(x, y, text, color) {
    this.x     = x;
    this.y     = y;
    this.text  = text;
    this.color = color;
    this.life  = 1;    // fades from 1 to 0
    this.vy    = -90;  // initial upward speed in logical pixels/sec
  }

  update(dt) {
    this.y    += this.vy * dt;
    this.vy   *= 0.92;       // slow down as it rises (ease out)
    this.life -= dt * 1.6;   // fades in about 0.6 seconds
  }

  draw(ctx) {
    if (this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth   = 3;
    // Font shrinks as it fades for a subtle scale-down effect
    ctx.font        = `bold ${Math.round(22 * this.life + 10)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.strokeText(this.text, this.x, this.y); // dark outline for readability
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }

  isAlive() { return this.life > 0; }
}

// ═══════════════════════════════════════════════════════
//  SCREEN FLASH
//  A full-screen color wash that appears briefly when you
//  lose a life (red) or when the timer runs out (orange).
// ═══════════════════════════════════════════════════════

class ScreenFlash {
  constructor(color, alpha) { this.color = color; this.alpha = alpha; }

  update(dt) { this.alpha -= dt * 3.5; } // fades out quickly

  isAlive() { return this.alpha > 0; }

  draw(ctx, W, H) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(this.alpha, 0, 1);
    ctx.fillStyle   = this.color;
    ctx.fillRect(0, 0, W, H); // covers the whole logical canvas
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════
//  AUDIO ENGINE
//  Generates all sound effects using the Web Audio API.
//  No audio files needed — sounds are synthesised in code.
// ═══════════════════════════════════════════════════════

class AudioEngine {
  constructor() {
    this._ctx = null; // AudioContext is created lazily on first sound
  }

  // Get (or create) the AudioContext — must be triggered by a user gesture
  _ac() {
    if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this._ctx;
  }

  // Play a simple synthesised tone
  _tone(freq, type, dur, gain, detune = 0) {
    try {
      const ac  = this._ac();
      const osc = ac.createOscillator();
      const g   = ac.createGain();
      osc.type          = type;  // 'sine', 'square', 'sawtooth', etc.
      osc.frequency.value = freq;
      osc.detune.value    = detune;
      g.gain.setValueAtTime(gain, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur); // fade to silence
      osc.connect(g);
      g.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    } catch {} // silently ignore if audio isn't available
  }

  // Satisfying rising-pitch "pop" on a successful hit; pitch rises with streak
  hit(streak) {
    const base = 440 + streak * 40;
    this._tone(base,       'sine', 0.12, 0.35);
    this._tone(base * 1.5, 'sine', 0.08, 0.20);
  }

  // Dull thud noise on a miss, panned left or right by where you clicked
  miss(panX) {
    try {
      const ac  = this._ac();
      const buf = ac.createBuffer(1, ac.sampleRate * 0.1, ac.sampleRate);
      const d   = buf.getChannelData(0);
      // Fill with decaying noise (sounds like a dull impact)
      for (let i = 0; i < d.length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.02));
      }
      const src    = ac.createBufferSource();
      const g      = ac.createGain();
      const panner = ac.createStereoPanner();
      src.buffer       = buf;
      panner.pan.value = clamp((panX / BASE_W) * 2 - 1, -1, 1); // -1=left, 1=right
      g.gain.value     = 0.28;
      src.connect(g); g.connect(panner); panner.connect(ac.destination);
      src.start();
    } catch {}
  }

  // Low growling sound when the timer expires
  timeUp() {
    this._tone(220, 'sawtooth', 0.3, 0.25);
    this._tone(180, 'sawtooth', 0.4, 0.18, -50);
  }

  // Short high beep for the 3-2-1 countdown
  beep() { this._tone(880, 'square', 0.08, 0.12); }
}

// ═══════════════════════════════════════════════════════
//  MAIN GAME CLASS
//  Owns all game state, runs the game loop, handles input,
//  and coordinates drawing across both canvas layers.
// ═══════════════════════════════════════════════════════

class Game {
  constructor() {
    // ── Two canvas layers ────────────────────────────────────────
    // bgCanvas:   sky, ground, buildings, HUD — rendered behind HTML
    // gameCanvas: bunny, particles, overlays — rendered on top (pointer-events:none)
    this.bg  = document.getElementById('bgCanvas');
    this.bgx = this.bg.getContext('2d');
    this.gc  = document.getElementById('gameCanvas');
    this.gx  = this.gc.getContext('2d');

    // Scale/offset are calculated in _resize() to fit a 16:9 area in any window
    this.scale = 1;
    this.ox    = 0; // horizontal letterbox offset
    this.oy    = 0; // vertical letterbox offset
    this._resize();

    // ── Fixed game settings (medium difficulty, always) ──────────
    this.LIVES      = 10;    // how many misses before game over
    this.DIFF_START = 1;     // starting difficulty level
    this.DIFF_RAMP  = 5;     // hits required to gain one difficulty level
    this.TIME_LIMIT = 10000; // milliseconds per bunny (10 seconds)

    // ── Game state ───────────────────────────────────────────────
    this.lives   = this.LIVES;
    this.hits    = 0;
    this.attempts = 0;
    this.diff    = this.DIFF_START;
    this.over    = false; // true when the game has ended
    this.start   = true;  // true while the start screen is showing

    // Reaction times array — stores milliseconds for each successful hit
    this.rts     = [];
    this.streak  = 0; // current consecutive hit streak
    this.best    = 0; // best streak achieved this session

    // Effect object pools — each holds a list of active effects
    this.parts   = []; // hit particles
    this.misses  = []; // miss X flashes
    this.floats  = []; // floating text labels
    this.flashes = []; // full-screen colour flashes

    this.rabbit  = null; // the current active bunny (null when not playing)
    this.lastTs  = null; // timestamp of the previous animation frame

    // Mouse position in logical coordinates (used to draw the crosshair)
    this.mx = BASE_W / 2;
    this.my = BASE_H / 2;

    // ── Subsystems ───────────────────────────────────────────────
    this.audio = new AudioEngine();
    this.hist  = loadHistory(); // session history from localStorage

    // Track which countdown second we last beeped at (avoids duplicate beeps)
    this._lastBeep  = -1;
    // Cache for building window positions (regenerated on resize)
    this._winCache  = null;
    // The tip shown on the game-over screen — picked once when the game ends
    this._currentTip = '';

    // ── Event listeners ──────────────────────────────────────────
    window.addEventListener('resize', () => this._resize());
    // Track mouse position for the crosshair
    this.bg.addEventListener('pointermove', e => {
      const l = this._L(e.clientX, e.clientY);
      this.mx = l.x;
      this.my = l.y;
    });
    // All clicks route through _click() which handles each screen state
    this.bg.addEventListener('pointerdown', e => this._click(e));

    // Kick off the animation loop
    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Recalculate scale and letterbox offsets on window resize ───
  _resize() {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    // Fit the largest 16:9 rectangle inside the window
    let w = sw, h = sw / (ASPECT_W / ASPECT_H);
    if (h > sh) { h = sh; w = sh * (ASPECT_W / ASPECT_H); }
    w = Math.floor(w); h = Math.floor(h);
    this.scale = w / BASE_W;
    this.ox    = Math.floor((sw - w) / 2);
    this.oy    = Math.floor((sh - h) / 2);
    // Both canvases always fill the whole browser window
    for (const c of [this.bg, this.gc]) { c.width = sw; c.height = sh; }
    // Invalidate building window cache (needs to be rebuilt at new size)
    this._winCache = null;
  }

  // Convert a screen pixel coordinate to a logical game coordinate
  _L(sx, sy) {
    return {
      x: (sx - this.ox) / this.scale,
      y: (sy - this.oy) / this.scale,
    };
  }

  // ── Master click handler — routes to the right screen handler ──
  _click(e) {
    const { x: lx, y: ly } = this._L(e.clientX, e.clientY);
    if (this.start) { this._clickStart(lx, ly); return; }
    if (this.over)  { this._clickOver(lx, ly);  return; }
    // During gameplay: check if we hit the bunny
    this.attempts++;
    if (this.rabbit && this.rabbit.isHit(lx, ly)) this._hit(lx, ly);
    else this._miss(lx, ly);
  }

  // Handle clicks on the start screen — hit zone matches the drawn button at BASE_H * 0.60
  _clickStart(lx, ly) {
    if (lx > BASE_W/2 - 140 && lx < BASE_W/2 + 140 &&
        ly > BASE_H * 0.60 - 31 && ly < BASE_H * 0.60 + 31) {
      this._go();
    }
  }

  // Handle clicks on the game-over screen (PLAY AGAIN button)
  _clickOver(lx, ly) {
    if (lx > BASE_W/2 - 140 && lx < BASE_W/2 + 140 &&
        ly > BASE_H * 0.82  && ly < BASE_H * 0.82 + 62) {
      this._restart();
    }
  }

  // ── Successful hit ────────────────────────────────────────────
  _hit(lx, ly) {
    this.hits++;
    this.streak++;
    if (this.streak > this.best) this.best = this.streak;

    // Record how quickly the player clicked after the bunny appeared
    const ms = Math.round(this.rabbit.getElapsedTime());
    this.rts.push(ms);

    this.audio.hit(this.streak);

    // Burst of 20 particles at the click position
    for (let i = 0; i < 20; i++) this.parts.push(new HitParticle(lx, ly));

    // Show reaction time; add fire emoji if on a streak of 3+
    const st = this.streak >= 3 ? ` ×${this.streak}🔥` : '';
    this.floats.push(new FloatingText(lx, ly - this.rabbit.radius, `${ms}ms${st}`, '#ffe44d'));

    // Every DIFF_RAMP hits, increase difficulty by 1
    if (this.hits % this.DIFF_RAMP === 0) this.diff++;

    // Spawn a new bunny immediately
    this.rabbit     = this._newBunny();
    this._lastBeep  = -1;
  }

  // ── Miss ─────────────────────────────────────────────────────
  _miss(lx, ly) {
    this.streak = 0;
    this.lives--;
    this.misses.push(new MissFlash(lx, ly));
    this.floats.push(new FloatingText(lx, ly, 'MISS', '#ff5555'));
    this.flashes.push(new ScreenFlash('rgba(200,0,0,0.18)', 0.6));
    this.audio.miss(lx);
    if (this.lives <= 0) this._end();
  }

  // Create a new bunny with current difficulty and time limit
  _newBunny() {
    const r      = new TacticalBunny(this.diff);
    r.timeLimit  = this.TIME_LIMIT;
    return r;
  }

  // Start or restart the active game session
  _go() {
    this.lives  = this.LIVES;
    this.diff   = this.DIFF_START;
    this.start  = false;
    this.rabbit = this._newBunny();
    this._lastBeep = -1;
    // Hide the native cursor during play — the canvas crosshair replaces it
    this.bg.style.cursor = 'none';
  }

  // End the game, save result to history
  _end() {
    this.over   = true;
    this.rabbit = null;
    // Restore the normal cursor on the game-over screen
    this.bg.style.cursor = 'default';
    const acc   = this.attempts > 0 ? Math.round(this.hits / this.attempts * 100) : 0;
    const avg   = this.rts.length  > 0 ? Math.round(this.rts.reduce((a, b) => a + b, 0) / this.rts.length) : 0;
    // Pick and lock in one tip so it doesn't flicker every frame
    this._currentTip = this._pickTip();
    this.hist = saveHistory({
      date: new Date().toLocaleDateString(),
      hits: this.hits, accuracy: acc, avgMs: avg,
      bestStreak: this.best, difficulty: this.diff,
    });
  }

  // Reset all counters and go back to playing
  _restart() {
    this.hits     = 0; this.attempts  = 0; this.over = false;
    this.rts      = []; this.streak   = 0; this.best = 0;
    this.parts    = []; this.misses   = []; this.floats = []; this.flashes = [];
    this.lastTs   = null; this._lastBeep = -1;
    this._go();
  }

  // ── Main animation loop ──────────────────────────────────────
  _loop(ts) {
    // dt = time since last frame in seconds; clamped to avoid huge jumps after tab switches
    let dt = 0;
    if (this.lastTs !== null) dt = Math.min((ts - this.lastTs) / 1000, 0.1);
    this.lastTs = ts;
    this._update(dt);
    this._drawBg();
    this._drawGame();
    requestAnimationFrame(t => this._loop(t));
  }

  // ── Update all game logic each frame ────────────────────────
  _update(dt) {
    if (this.start || this.over) return; // nothing to update on menu screens

    if (this.rabbit) {
      this.rabbit.update(dt);

      // Play countdown beeps at 3, 2, and 1 seconds remaining
      const rem = (this.rabbit.timeLimit - this.rabbit.getElapsedTime()) / 1000;
      const rf  = Math.floor(rem);
      if (rf <= 3 && rf >= 1 && rf !== this._lastBeep) {
        this._lastBeep = rf;
        this.audio.beep();
      }

      // If the bunny wasn't clicked in time
      if (this.rabbit.isTimeUp()) {
        this.streak = 0;
        this.lives--;
        this.floats.push(new FloatingText(
          this.rabbit.x, this.rabbit.visualY - this.rabbit.radius * 2, 'TIME UP', '#ff8833'));
        this.flashes.push(new ScreenFlash('rgba(255,80,0,0.2)', 0.7));
        this.audio.timeUp();
        if (this.lives <= 0) {
          this._end();
        } else {
          // Recalculate difficulty based on hits so far, then spawn next bunny
          this.diff  = Math.max(this.DIFF_START, Math.floor(this.hits / this.DIFF_RAMP) + this.DIFF_START);
          this.rabbit = this._newBunny();
          this._lastBeep = -1;
        }
      }
    }

    // Update and cull dead effects (iterate backwards so splicing is safe)
    const tick = arr => {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (!arr[i].isAlive()) arr.splice(i, 1);
        else arr[i].update(dt);
      }
    };
    tick(this.parts);
    tick(this.misses);
    tick(this.floats);
    tick(this.flashes);
  }

  // ═══════════════════════════════════════════════════
  //  BACKGROUND CANVAS  (sky, ground, buildings, HUD)
  //  Drawn on the lower z-index canvas so the bunny
  //  (on the upper canvas) always appears in front.
  // ═══════════════════════════════════════════════════

  _drawBg() {
    const ctx = this.bgx;
    const sw  = this.bg.width;
    const sh  = this.bg.height;
    const s   = this.scale;
    const ox  = this.ox; const oy = this.oy;
    const W   = BASE_W * s; const H = BASE_H * s;

    // Fill the entire window with black (letterbox bars)
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, sw, sh);

    // Move origin to the top-left of the 16:9 play area
    ctx.save();
    ctx.translate(ox, oy);
    // Clip so nothing draws outside the game rectangle
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    // Sky: dark blue at the top fading to lighter blue at the horizon
    const sg = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    sg.addColorStop(0,   '#1a1a3e');
    sg.addColorStop(0.5, '#2d4a7a');
    sg.addColorStop(1,   '#4a7aa8');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H * 0.72);

    // Ground: green grass on top, brown dirt below
    const gg = ctx.createLinearGradient(0, H * 0.72, 0, H);
    gg.addColorStop(0,   '#4a7c3f');
    gg.addColorStop(0.1, '#3d6b34');
    gg.addColorStop(0.4, '#8b6340');
    gg.addColorStop(1,   '#6b4c2a');
    ctx.fillStyle = gg;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // Bright grass edge strip at the horizon line
    ctx.fillStyle = '#5a9448';
    ctx.fillRect(0, H * 0.72, W, H * 0.025);

    // Draw dark building silhouettes in the background
    this._drawBuildings(ctx, W, H);

    // Draw the HUD (lives, hits, timer bar, etc.) only during active gameplay
    if (!this.start && !this.over) this._drawHUD(ctx, W, H);

    ctx.restore();
  }

  // Draw dark city building silhouettes with lit windows
  _drawBuildings(ctx, W, H) {
    // Each entry is [x, y, width, height] as fractions of the canvas size
    const bldgs = [
      [0.05, 0.55, 0.07, 0.17],
      [0.10, 0.45, 0.05, 0.27],
      [0.14, 0.50, 0.08, 0.22],
      [0.82, 0.48, 0.06, 0.24],
      [0.87, 0.52, 0.09, 0.20],
      [0.93, 0.44, 0.05, 0.28],
    ];

    // Build the window position cache once (avoids random flicker every frame)
    if (!this._winCache) {
      this._winCache = bldgs.map(([bx, by, bw, bh]) => {
        const wins = [];
        for (let wy = by * BASE_H + BASE_H * 0.02; wy < (by + bh * 0.72) * BASE_H - BASE_H * 0.02; wy += BASE_H * 0.04)
          for (let wx = bx * BASE_W + BASE_W * 0.01; wx < (bx + bw) * BASE_W - BASE_W * 0.01; wx += BASE_W * 0.018)
            if (Math.random() > 0.35) wins.push([wx / BASE_W, wy / BASE_H]);
        return wins;
      });
    }

    bldgs.forEach(([bx, by, bw, bh], i) => {
      // Dark building silhouette
      ctx.fillStyle = 'rgba(15,15,35,0.7)';
      ctx.fillRect(bx * W, by * H, bw * W, bh * H * 0.72);
      // Warm yellow lit windows
      ctx.fillStyle = 'rgba(255,230,100,0.22)';
      this._winCache[i].forEach(([wx, wy]) => ctx.fillRect(wx * W, wy * H, W * 0.008, H * 0.02));
    });
  }

  // Draw the in-game HUD: timer bar, stats panel, title badge
  _drawHUD(ctx, W, H) {

    // ── Timer bar (top center of screen) ──────────────────────────
    if (this.rabbit) {
      const el   = this.rabbit.getElapsedTime();
      const frac = clamp(1 - el / this.rabbit.timeLimit, 0, 1); // 1=full, 0=empty
      const bW   = W * 0.30; const bH = H * 0.034;
      const bX   = W / 2 - bW / 2; const bY = H * 0.022;

      // Dark background track
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(bX - 2, bY - 2, bW + 4, bH + 4, bH * 0.5); ctx.fill();

      // Coloured fill: green → orange → red as time runs out
      ctx.fillStyle = frac > 0.5 ? '#44ff44' : frac > 0.25 ? '#ffaa00' : '#ff3333';
      ctx.beginPath(); ctx.roundRect(bX, bY, bW * frac, bH, bH * 0.5); ctx.fill();

      // Time remaining label below the bar
      ctx.fillStyle   = '#fff';
      ctx.font        = `bold ${Math.round(H * 0.034)}px Arial`;
      ctx.textAlign   = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
      ctx.fillText(`${((this.rabbit.timeLimit - el) / 1000).toFixed(1)}s`, W / 2, bY + bH * 2.1);
      ctx.shadowBlur  = 0;
    }

    // ── Stats panel (top-left corner) ────────────────────────────
    const px = W * 0.012; const py = H * 0.018;
    const fs = Math.round(H * 0.032);  // font size
    const lh = fs * 1.80;              // line height (generous spacing)
    const pW = W * 0.24;               // panel width — wide enough for streak text
    const pH = lh * 6 + py * 2.5;     // panel height for 6 rows

    // Semi-transparent dark panel background with pink border
    ctx.fillStyle   = 'rgba(0,0,0,0.65)';
    ctx.strokeStyle = '#ff80c0';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.roundRect(px, py, pW, pH, 8); ctx.fill(); ctx.stroke();

    // Pre-calculate stats to display
    const acc = this.attempts > 0 ? Math.round(this.hits / this.attempts * 100) : 0;
    const avg = this.rts.length  > 0 ? Math.round(this.rts.reduce((a, b) => a + b, 0) / this.rts.length) : 0;
    const bst = this.rts.length  > 0 ? Math.min(...this.rts) : 0;

    // Each row: [emoji, label text, value text]
    const rows = [
      ['❤️', 'Lives',    `${this.lives}`],
      ['🎯', 'Hits',     `${this.hits}`],
      ['📊', 'Accuracy', `${acc}%`],
      ['⚡', 'Avg',      avg ? `${avg}ms` : '--'],
      ['🏆', 'Best',     bst ? `${bst}ms` : '--'],
      // Streak row: kept compact — "5 (best 8)" fits in the wider panel
      ['🔥', 'Streak',   `${this.streak}  best ${this.best}`],
    ];

    ctx.font = `bold ${fs}px 'Courier New', monospace`;
    const labelX = px + pW * 0.07; // labels start near left edge
    const valueX = px + pW - pW * 0.05; // values are right-aligned near right edge

    rows.forEach(([icon, label, value], i) => {
      const ty = py + lh * (i + 0.82) + py;
      ctx.fillStyle = '#ffccee'; ctx.textAlign = 'left';
      ctx.fillText(`${icon} ${label}`, labelX, ty);
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right';
      ctx.fillText(value, valueX, ty);
    });
    ctx.textAlign = 'left';

    // ── Title badge (top-right corner) ────────────────────────────
    const tW = W * 0.16; const tH = H * 0.072; const tX = W - tW - px;
    ctx.fillStyle   = 'rgba(0,0,0,0.52)';
    ctx.strokeStyle = '#ff60aa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(tX, py, tW, tH, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle   = '#ff80cc';
    ctx.font        = `bold ${Math.round(H * 0.038)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#ff2080'; ctx.shadowBlur = 10;
    ctx.fillText('AIM RABBIT', tX + tW / 2, py + tH * 0.68);
    ctx.shadowBlur  = 0;
    ctx.textAlign   = 'left';
  }

  // ═══════════════════════════════════════════════════
  //  GAME CANVAS  (bunny, particles, screen overlays)
  //  Drawn on the upper z-index canvas so the bunny is
  //  always visible in front of the HUD and buildings.
  // ═══════════════════════════════════════════════════

  _drawGame() {
    const ctx = this.gx;
    const sw  = this.gc.width; const sh = this.gc.height;
    const s   = this.scale;
    const ox  = this.ox; const oy = this.oy;
    const W   = BASE_W * s; const H = BASE_H * s;

    // Clear the entire canvas each frame (transparent so bg shows through)
    ctx.clearRect(0, 0, sw, sh);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    ctx.scale(s, s); // everything drawn after this is in logical coordinates

    if (this.start) {
      this._drawStartScreen(ctx);
    } else if (this.over) {
      this._drawGameOver(ctx);
    } else {
      // Active gameplay: bunny, effects, crosshair
      if (this.rabbit) this.rabbit.draw(ctx);
      this.parts.forEach(p  => p.draw(ctx));
      this.misses.forEach(m => m.draw(ctx));
      this.floats.forEach(f => f.draw(ctx));
      this.flashes.forEach(f => f.draw(ctx, BASE_W, BASE_H));
      this._drawCrosshair(ctx); // drawn last so it's always on top
    }

    ctx.restore();
  }

  // Draw the custom crosshair at the current mouse position
  _drawCrosshair(ctx) {
    const x = this.mx; const y = this.my;
    const gap = 10;  // space between center dot and lines
    const len = 14;  // length of each crosshair line

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;

    // Four lines pointing up/down/left/right from the gap
    ctx.beginPath(); ctx.moveTo(x, y - gap);   ctx.lineTo(x, y - gap - len); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + gap);   ctx.lineTo(x, y + gap + len); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - gap, y);   ctx.lineTo(x - gap - len, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + gap, y);   ctx.lineTo(x + gap + len, y); ctx.stroke();

    // Small dot at the center
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════
  //  START SCREEN
  // ═══════════════════════════════════════════════════

  _drawStartScreen(ctx) {
    // Dark overlay on top of the background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // Game title
    ctx.fillStyle   = '#ff80cc';
    ctx.font        = `bold ${Math.round(BASE_H * 0.11)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#ff2080'; ctx.shadowBlur = 30;
    ctx.fillText('AIM RABBIT', BASE_W / 2, BASE_H * 0.20);
    ctx.shadowBlur  = 0;

    // Subtitle
    ctx.fillStyle = '#aaddff';
    ctx.font      = `${Math.round(BASE_H * 0.042)}px Arial`;
    ctx.fillText('Train your bunny-hopper tracking skills', BASE_W / 2, BASE_H * 0.34);

    // Instruction
    ctx.fillStyle = '#ffeeaa';
    ctx.font      = `${Math.round(BASE_H * 0.034)}px Arial`;
    ctx.fillText('Click the hopping bunny before the timer runs out', BASE_W / 2, BASE_H * 0.43);

    // START button — centred with comfortable spacing below the text
    this._drawButton(ctx, BASE_W / 2, BASE_H * 0.60, 280, 62, '▶  START GAME', '#e0208a', '#ff60cc');
  }

  // ═══════════════════════════════════════════════════
  //  GAME OVER SCREEN
  // ═══════════════════════════════════════════════════

  _drawGameOver(ctx) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.84)';
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // GAME OVER title
    ctx.fillStyle   = '#ff3366';
    ctx.font        = `bold ${Math.round(BASE_H * 0.10)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#ff0044'; ctx.shadowBlur = 30;
    ctx.fillText('GAME OVER', BASE_W / 2, BASE_H * 0.11);
    ctx.shadowBlur  = 0;

    // Calculate final stats
    const acc = this.attempts > 0 ? Math.round(this.hits / this.attempts * 100) : 0;
    const avg = this.rts.length  > 0 ? Math.round(this.rts.reduce((a, b) => a + b, 0) / this.rts.length) : 0;
    const bst = this.rts.length  > 0 ? Math.min(...this.rts) : 0;
    const grd = this._calcGrade(acc, avg);

    // ── Stats panel (left side) ───────────────────────────────────
    const pw = BASE_W * 0.52; const ph = BASE_H * 0.52;
    const spx = BASE_W * 0.03; const spy = BASE_H * 0.16;
    ctx.fillStyle   = 'rgba(0,15,30,0.88)';
    ctx.strokeStyle = '#ff80cc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(spx, spy, pw, ph, 12); ctx.fill(); ctx.stroke();

    const stats = [
      ['🎯', 'Hits',          `${this.hits}`],
      ['📊', 'Accuracy',      `${acc}%`],
      ['⚡', 'Avg Reaction',  avg ? `${avg}ms` : '--'],
      ['🏆', 'Best Reaction', bst ? `${bst}ms` : '--'],
      ['🔥', 'Best Streak',   `${this.best}`],
      ['📈', 'Max Level',     `${this.diff}`],
    ];

    const lh2 = ph / (stats.length + 1); // evenly space rows inside the panel
    ctx.font = `bold ${Math.round(BASE_H * 0.037)}px 'Courier New', monospace`;
    stats.forEach(([icon, label, value], i) => {
      const ty = spy + lh2 * (i + 0.85);
      ctx.fillStyle = '#ffccee'; ctx.textAlign = 'left';
      ctx.fillText(`${icon} ${label}`, spx + pw * 0.05, ty);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
      ctx.fillText(value, spx + pw * 0.95, ty);
    });

    // ── Grade panel (right side) ──────────────────────────────────
    const gpx = BASE_W * 0.58; const gpy = BASE_H * 0.16;
    const gpw = BASE_W * 0.38; const gph = BASE_H * 0.52;
    ctx.fillStyle   = 'rgba(0,15,30,0.88)';
    ctx.strokeStyle = grd.col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(gpx, gpy, gpw, gph, 12); ctx.fill(); ctx.stroke();

    // Big grade letter (S / A / B / C / D)
    ctx.fillStyle   = grd.col;
    ctx.font        = `bold ${Math.round(BASE_H * 0.18)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.shadowColor = grd.col; ctx.shadowBlur = 28;
    ctx.fillText(grd.letter, gpx + gpw / 2, gpy + gph * 0.50);
    ctx.shadowBlur  = 0;

    // Grade label (e.g. "SHARP")
    ctx.fillStyle = '#ccc';
    ctx.font      = `bold ${Math.round(BASE_H * 0.040)}px Arial`;
    ctx.fillText(grd.label, gpx + gpw / 2, gpy + gph * 0.70);

    // Score number
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font      = `${Math.round(BASE_H * 0.028)}px Arial`;
    ctx.fillText(`Score: ${acc - clamp(Math.round((avg - 500) / 50), 0, 30)}`, gpx + gpw / 2, gpy + gph * 0.84);
    ctx.textAlign = 'left';

    // ── Tip of the run (locked in at _end() so it never flickers) ─
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = `${Math.round(BASE_H * 0.026)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('💡 ' + this._currentTip, BASE_W / 2, BASE_H * 0.77);
    ctx.textAlign = 'left';

    // ── PLAY AGAIN button ─────────────────────────────────────────
    this._drawButton(ctx, BASE_W / 2, BASE_H * 0.885, 280, 62, '▶  PLAY AGAIN', '#990040', '#ff2080');
  }

  // Calculate the performance grade based on accuracy and average reaction time
  _calcGrade(acc, avg) {
    // Penalise slow reactions (anything over 500ms deducts points)
    const score = acc - clamp(Math.round((avg - 500) / 50), 0, 30);
    if (score >= 90) return { letter: 'S', col: '#ffe44d', label: 'LEGEND'      };
    if (score >= 75) return { letter: 'A', col: '#44ff88', label: 'SHARP'       };
    if (score >= 55) return { letter: 'B', col: '#44aaff', label: 'SOLID'       };
    if (score >= 35) return { letter: 'C', col: '#cc88ff', label: 'LEARNING'    };
    return               { letter: 'D', col: '#ff5555', label: 'KEEP TRYING'  };
  }

  // Return a random training tip (called once per game-end, stored in _currentTip)
  _pickTip() {
    const tips = [
      "Lead the target — click where it's going, not where it is.",
      'Focus on the center of the bunny, not the edges.',
      'Relax your wrist. Tension slows you down.',
      'Use your whole arm for big movements, wrist for small ones.',
      'Take a breath between shots to reset your focus.',
      "Streaks mean you're reading the movement pattern — keep it up!",
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }

  // Draw a rounded pill-shaped button with a text label
  _drawButton(ctx, cx, cy, w, h, label, bgColor, borderColor) {
    ctx.save();
    ctx.fillStyle   = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = borderColor; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.roundRect(cx - w/2, cy - h/2, w, h, h/2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#fff';
    ctx.font        = `bold ${Math.round(h * 0.46)}px Arial`;
    ctx.textAlign   = 'center';
    ctx.fillText(label, cx, cy + h * 0.18);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════
//  ENTRY POINT — create the Game once the page has loaded
// ═══════════════════════════════════════════════════════
window.addEventListener('load', () => { new Game(); });

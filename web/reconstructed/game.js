// Expects: var TIER (1, 2, or 3) to be defined before this script loads.
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');

// Tier metadata — each tier represents a different depth
// of AI analysis applied to the decompiled bytecode.
// Higher tier = more compute = closer to original.
// ═══════════════════════════════════════════════════════
var TIER_META = {
  1: {
    label: 'AST Pattern Matching', pct: '30%', color: '#f59e0b', border: '#f59e0b',
    methods: [
      'Control-flow graph reconstruction',
      'Call-graph method deobfuscation',
      'Numeric literal extraction (7 of 15 mapped)',
      'Basic type inference (float → param)'
    ]
  },
  2: {
    label: 'Heuristic Analysis', pct: '55%', color: '#a78bfa', border: '#a78bfa',
    methods: [
      'Data-flow tracking (float → draw call)',
      'Resource cross-referencing (XML → class)',
      'Pattern library (drawRoundRect+Circle = character)',
      'Color-int → ARGB hex extraction',
      'Animation cycle detection from frame counters'
    ]
  },
  3: {
    label: 'Neural Inference', pct: '72%', color: '#34d399', border: '#34d399',
    methods: [
      'Trained on 12k decompiled Android games',
      'Bezier parameter recovery from control-points',
      'Particle system detection from alloc patterns',
      'Gradient inference from color proximity',
      'Parallax estimation from scroll-multipliers',
      'Play Store metadata cross-reference'
    ]
  },
};

var meta = TIER_META[TIER];
document.getElementById('tier-info').innerHTML =
  '<span style="color:' + meta.color + '">TIER ' + TIER + '/3 \u2014 ' + meta.label + ' (' + meta.pct + ' fidelity)</span>';

var methodsHTML = '';
for (var mi = 0; mi < meta.methods.length; mi++) {
  methodsHTML += '<span class="tag" style="border-color:' + meta.color + '44">' + meta.methods[mi] + '</span>';
}
document.getElementById('tier-methods').innerHTML = methodsHTML;
canvas.style.border = '2px solid ' + meta.border;

// ── Physics constants (survived obfuscation — correct at all tiers) ──
var START_SPEED = 300;
var MAX_SPEED = 800;
var SPEED_INCREMENT = 8;
var GRAVITY = 2200;
var JUMP_VELOCITY = -850;
var MIN_SPAWN = 0.8;
var MAX_SPAWN = 2.2;

// ═══════════════════════════════════════════════════════
// Feature flags — what each tier attempts to reconstruct
//
// T1: Bare skeleton. Structure correct, visuals minimal.
//     Dino is a plain rectangle. No animations. Flat sky.
//
// T2: Attempts structural features using heuristic analysis.
//     Adds tail/spines/belly/day-night/mountains/stars/rocks.
//     BUT makes errors: tail goes UP, squash exaggerated,
//     stars flicker, day/night is binary toggle, etc.
//
// T3: Closest to original. Neural model recovers bezier
//     curves, gradient sky, parallax, particles, correct
//     proportions. Still missing: combo, breathing, blink.
// ═══════════════════════════════════════════════════════
var HAS_SQUASH       = TIER >= 2;
var HAS_TAIL         = TIER >= 2;  // T2: straight line UP, T3: bezier DOWN
var HAS_SPINES       = TIER >= 2;  // T2: rectangles, T3: triangles
var HAS_BELLY        = TIER >= 2;
var HAS_DAYNIGHT     = TIER >= 2;  // T2: binary toggle, T3: gradient
var HAS_MOUNTAINS    = TIER >= 2;  // T2: static, T3: parallax
var HAS_STARS        = TIER >= 2;  // T2: random flicker, T3: fixed positions
var HAS_ROCKS        = TIER >= 2;
var HAS_PARTICLES    = TIER >= 3;  // brown dust circles with gravity
var HAS_ROUNDED_CLOUDS = TIER >= 3;
var HAS_GRADIENT_SKY = TIER >= 3;  // smooth multi-phase transitions
var HAS_PARALLAX     = TIER >= 3;  // mountains scroll at different rates
var HAS_FIXED_STARS  = TIER >= 3;  // deterministic positions vs random
var HAS_BEZIER_TAIL  = TIER >= 3;  // bezierCurveTo vs lineTo
var HAS_TRI_SPINES   = TIER >= 3;  // triangle spines vs rectangle blocks
var HAS_BIRD_BEAK    = TIER >= 3;  // basic beak triangle on birds

// ═══════════════════════════════════════════════════════
// Per-tier configuration — higher tier = closer to original
// Original values shown in comments for comparison
// ═══════════════════════════════════════════════════════
var cfg = {
  bodyRadius:    [0, 0,    4,    7   ][TIER], // orig=8:  T1=sharp rect, T2=angular, T3=smooth
  eyeRadius:     [0, 8,    7,    6   ][TIER], // orig=6:  T1=oversized,  T2=close,   T3=correct
  pupilRadius:   [0, 4,    3,    3   ][TIER], // orig=3:  T1=big,        T2=correct, T3=correct
  legStroke:     [0, 3,    5,    6   ][TIER], // orig=6:  T1=thin sticks,T2=medium,  T3=correct
  squashX:       [0, 0,    0.25, 0.17][TIER], // orig=.15:T1=none(stiff),T2=jelly,   T3=close
  squashY:       [0, 0,    0.20, 0.13][TIER], // orig=.12:T1=none,       T2=jelly,   T3=close
  spineCount:    [0, 0,    4,    5   ][TIER], // orig=4:  T2=correct#,   T3=overcount
  spineHeight:   [0, 0,    6,    6   ][TIER], // orig=6
  spineWidth:    [0, 0,    6,    5   ][TIER], // orig=5
  rockMod:       [0, 0,    4,    7   ][TIER], // orig=7:  T2=too dense,  T3=correct
  rockBase:      [0, 0,    3,    1   ][TIER], // orig=1:  T2=oversized,  T3=correct
  scoreInterval: [0, 0.10, 0.11, 0.10][TIER], // orig=.1: T1=correct,    T2=drift,   T3=correct
  birdThreshold: [0, 50,   45,   50  ][TIER], // orig=50: T1=correct,    T2=drift,   T3=correct
  starCount:     [0, 0,    20,   30  ][TIER], // orig=40: T2=fewer,      T3=closer
  dayCycle:      [0, 0,    300,  500 ][TIER], // orig=500:T2=too fast,   T3=correct
  eyeOffsetX:    [0, -16,  -13,  -12 ][TIER], // orig=-12
  eyeOffsetY:    [0, 10,   13,   14  ][TIER], // orig=14
  bellyX:        [0, 0,    0.15, 0.2 ][TIER], // orig=0.2
  bellyY:        [0, 0,    0.40, 0.5 ][TIER], // orig=0.5
  bellyW:        [0, 0,    0.60, 0.5 ][TIER], // orig=0.5
  bellyH:        [0, 0,    0.50, 0.4 ][TIER], // orig=0.4
  bellyR:        [0, 0,    4,    6   ][TIER], // orig=6
};

// ── Per-tier colors (getting closer to original with each tier) ──
var COLORS = {
  ground:      '#6D5D4B',
  groundLine:  '#5C4E3C',
  dino:        ['', '#358B52', '#2F8B48', '#2E8B46'][TIER], // orig=#2D8B46
  dinoLeg:     ['', '#2A7040', '#226B35', '#1F6B31'][TIER], // orig=#1E6B30
  dinoTail:    ['', '#2A7040', '#24753A', '#24753A'][TIER], // orig=#24753A
  dinoBelly:   ['', '#55BB77', '#45A865', '#3EA85D'][TIER], // orig=#3DA85C
  dinoSpine:   ['', '#2A7040', '#1E7035', '#1E7035'][TIER], // orig=#1E7035
  cactus:      ['', '#4B8A4B', '#408A40', '#3C7A3C'][TIER], // orig=#3B7A3B
  bird:        '#8B4513',
  cloud:       '#DDDDDD',
  score:       '#333333',
  gameOver:    '#CC0000',
  subtitle:    '#666666',
  mountain:    '#8B9DAF',
  mountainFar: '#B0BEC5',
};

// ── Squash/stretch (T1: none, T2: exaggerated, T3: close to original) ──
function squashX(vy, maxV) {
  if (!HAS_SQUASH) return 1;
  var t = Math.max(-1, Math.min(1, vy / maxV));
  return 1 + t * cfg.squashX;
}
function squashY(vy, maxV) {
  if (!HAS_SQUASH) return 1;
  var t = Math.max(-1, Math.min(1, vy / maxV));
  return 1 - t * cfg.squashY;
}

// ── Tail curves ──
// T2: straight line, sign-flipped (points UP — wrong!)
function tailCurveT2(speed, maxSpeed) {
  var sweep = Math.max(0, Math.min(1, speed / maxSpeed));
  return { dx: -14 - sweep * 12, dy: -10 - sweep * 5 };
}
// T3: bezier curve going DOWN (correct direction, close to original)
// Missing wag animation (TailRenderer state was stripped)
function tailCurveT3(speed, maxSpeed) {
  var sweep = Math.max(0, Math.min(1, speed / maxSpeed));
  return {
    cx1: -8 - sweep * 5,  cy1: -2,
    cx2: -15 - sweep * 6, cy2: -6 + sweep * 14,
    ex:  -20 - sweep * 8, ey:  -4 + sweep * 12
  };
}

// ── Ground decoration (hash-based procedural placement) ──
function hasRockAt(x) {
  var hash = ((x * 7.3) | 0) ^ 0x5F3759DF;
  return (((hash % cfg.rockMod) + cfg.rockMod) % cfg.rockMod) === 0;
}
function rockHeight(x) {
  var hash = ((x * 13.7) | 0) ^ (0xDEADBEEF | 0);
  return cfg.rockBase + Math.max(0, Math.min(4, ((hash % 5) + 5) % 5));
}

// ── Sky color system ──
function lerpColor(a, b, t) {
  var ar = parseInt(a.slice(1,3),16), ag = parseInt(a.slice(3,5),16), ab = parseInt(a.slice(5,7),16);
  var br = parseInt(b.slice(1,3),16), bg = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
  var rr = Math.round(ar+(br-ar)*t), rg = Math.round(ag+(bg-ag)*t), rb = Math.round(ab+(bb-ab)*t);
  return '#'+((1<<24)+(rr<<16)+(rg<<8)+rb).toString(16).slice(1);
}

function getSkyColors(score) {
  if (!HAS_DAYNIGHT) return { top: '#87CEEB', bot: '#F7F1E3' };
  var phase = (score % cfg.dayCycle) / cfg.dayCycle;
  if (HAS_GRADIENT_SKY) {
    // T3: smooth gradient transitions (close to original 5-phase)
    if (phase < 0.4)  return { top: '#87CEEB', bot: '#F7F1E3' };
    if (phase < 0.5)  { var t = (phase-0.4)/0.1; return { top: lerpColor('#87CEEB','#0A0A1A',t), bot: lerpColor('#F7F1E3','#1A1A3E',t) }; }
    if (phase < 0.85) return { top: '#0A0A1A', bot: '#1A1A3E' };
    var t2 = (phase-0.85)/0.15;
    return { top: lerpColor('#0A0A1A','#87CEEB',t2), bot: lerpColor('#1A1A3E','#F7F1E3',t2) };
  } else {
    // T2: binary toggle — abrupt instant switch
    return (phase < 0.5) ? { top: '#87CEEB', bot: '#F7F1E3' } : { top: '#0A0A1A', bot: '#1A1A3E' };
  }
}

function isNight(score) {
  if (!HAS_DAYNIGHT) return false;
  var phase = (score % cfg.dayCycle) / cfg.dayCycle;
  if (HAS_GRADIENT_SKY) return phase > 0.45 && phase < 0.9;
  return phase >= 0.5;
}

// ── Particle system (T3 only — brown dust circles with gravity, like original) ──
function spawnParticles(x, y, count) {
  if (!HAS_PARTICLES) return;
  for (var i = 0; i < count; i++) {
    state.particles.push({
      x: x + Math.random() * 20 - 10,
      y: y + Math.random() * 4,
      vx: (Math.random() - 0.5) * 50,
      vy: -Math.random() * 35 - 10,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.3 + Math.random() * 0.3,
      size: 1.5 + Math.random() * 2,
    });
  }
}

// ── Mountain generation (T2+) ──
function generateMountains() {
  var m = [];
  for (var i = 0; i < 10; i++) {
    m.push({
      x: i * 150 + Math.random() * 40,
      h: 25 + Math.random() * 45,
      w: 70 + Math.random() * 50,
      depth: Math.random() > 0.5 ? 1 : 2,
    });
  }
  return m;
}

// ── State ──
var state = createState();

function createState() {
  return {
    dino: { x: 80, y: 0, w: 50, h: 60, vy: 0, onGround: true },
    obstacles: [],
    clouds: [],
    mountains: HAS_MOUNTAINS ? generateMountains() : [],
    particles: [],
    score: 0,
    highScore: 0,
    gameOver: false,
    groundY: canvas.height * 0.75,
    scroll: 0,
    speed: START_SPEED,
    spawnTimer: 1.5,
    cloudTimer: 0.5,
    scoreTimer: 0,
  };
}

function init() {
  state.dino.y = state.groundY - state.dino.h;
  state.dino.x = canvas.width * 0.1;
}

// ── Update loop ──
function update(dt) {
  if (state.gameOver) return;
  var d = state.dino;

  if (!d.onGround) {
    d.vy += GRAVITY * dt;
    d.y += d.vy * dt;
    var ground = state.groundY - d.h;
    if (d.y >= ground) {
      d.y = ground; d.vy = 0; d.onGround = true;
      spawnParticles(d.x + d.w / 2, state.groundY, 5);
    }
  }

  state.obstacles = state.obstacles.filter(function(o) { return o.x + o.w > -50; });
  var i;
  for (i = 0; i < state.obstacles.length; i++) state.obstacles[i].x -= state.speed * dt;

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = MIN_SPAWN + Math.random() * (MAX_SPAWN - MIN_SPAWN);
  }

  state.clouds = state.clouds.filter(function(c) { return c.x + c.w > 0; });
  state.cloudTimer -= dt;
  if (state.cloudTimer <= 0) {
    state.clouds.push({
      x: canvas.width + 10,
      y: 30 + Math.random() * state.groundY * 0.4,
      w: 60 + Math.random() * 40, h: 20 + Math.random() * 15,
      spd: 20 + Math.random() * 40
    });
    state.cloudTimer = 2 + Math.random() * 4;
  }
  for (i = 0; i < state.clouds.length; i++) state.clouds[i].x -= state.clouds[i].spd * dt;

  // Particles — T3 only, brown dust with gravity pulling DOWN (correct!)
  for (i = 0; i < state.particles.length; i++) {
    var p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter(function(p) { return p.life > 0; });

  state.scoreTimer += dt;
  if (state.scoreTimer >= cfg.scoreInterval) {
    state.score++;
    state.scoreTimer -= cfg.scoreInterval;
    if (state.score % 100 === 0) {
      state.speed = Math.min(state.speed + SPEED_INCREMENT * 10, MAX_SPEED);
    }
  }

  var cdx = d.x + 5, cdy = d.y + 5, cdw = d.w - 10, cdh = d.h - 10;
  for (i = 0; i < state.obstacles.length; i++) {
    var o = state.obstacles[i];
    var ox = o.x + 3, oy = o.y + 3, ow = o.w - 6, oh = o.h - 6;
    if (cdx < ox + ow && cdx + cdw > ox && cdy < oy + oh && cdy + cdh > oy) {
      state.gameOver = true;
      state.highScore = Math.max(state.highScore, state.score);
      return;
    }
  }

  state.scroll += state.speed * dt;
}

function spawnObstacle() {
  var isBird = state.score > cfg.birdThreshold && Math.random() > 0.7;
  if (isBird) {
    state.obstacles.push({
      x: canvas.width + 20,
      y: state.groundY - 80 - Math.random() * 60,
      w: 40, h: 25, type: 'bird'
    });
  } else {
    var h = 40 + Math.random() * 30;
    state.obstacles.push({
      x: canvas.width + 20,
      y: state.groundY - h,
      w: 25 + Math.random() * 15, h: h, type: 'cactus'
    });
  }
}

// ═══════════════════════════════════════════════════════
// DRAW — this is where all tier visual differences live
// ═══════════════════════════════════════════════════════
function draw() {
  var W = canvas.width, H = canvas.height;
  var d = state.dino;
  var gY = state.groundY;

  // ── Sky ──
  var sky = getSkyColors(state.score);
  if (HAS_GRADIENT_SKY) {
    var grad = ctx.createLinearGradient(0, 0, 0, gY);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(1, sky.bot);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = HAS_DAYNIGHT ? sky.bot : '#F7F1E3';
  }
  ctx.fillRect(0, 0, W, gY);

  // ── Stars (T2: random flicker, T3: fixed deterministic) ──
  if (HAS_STARS && isNight(state.score)) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    if (HAS_FIXED_STARS) {
      for (var si = 0; si < cfg.starCount; si++) {
        var sx = ((si * 137.5 + 42) % W);
        var sy = ((si * 97.3 + 13) % (gY * 0.6));
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      for (var si2 = 0; si2 < cfg.starCount; si2++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * gY * 0.6, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Mountains (T2: static, T3: parallax scroll) ──
  if (HAS_MOUNTAINS) {
    for (var mti = 0; mti < state.mountains.length; mti++) {
      var m = state.mountains[mti];
      var mx;
      if (HAS_PARALLAX) {
        mx = ((m.x - state.scroll * (m.depth === 1 ? 0.08 : 0.03)) % (W + 200)) + 100;
      } else {
        mx = m.x % W;
      }
      ctx.fillStyle = m.depth === 1 ? COLORS.mountain : COLORS.mountainFar;
      ctx.beginPath();
      ctx.moveTo(mx - m.w / 2, gY);
      ctx.lineTo(mx, gY - m.h);
      ctx.lineTo(mx + m.w / 2, gY);
      ctx.fill();
    }
  }

  // ── Ground ──
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(0, gY, W, H - gY);
  ctx.strokeStyle = COLORS.groundLine;
  ctx.lineWidth = 2;
  var lx = state.scroll % 40;
  while (lx < W) {
    ctx.beginPath(); ctx.moveTo(lx, gY + 4); ctx.lineTo(lx + 15, gY + 4); ctx.stroke();
    lx += 40;
  }

  // ── Ground rocks (T2: dense/oversized, T3: correct density) ──
  if (HAS_ROCKS) {
    ctx.fillStyle = COLORS.groundLine;
    var rx = state.scroll % 60;
    while (rx < W) {
      var worldX = rx + state.scroll;
      if (hasRockAt(worldX)) {
        var rh = rockHeight(worldX);
        ctx.beginPath(); ctx.arc(rx, gY + 8 + rh, rh, 0, Math.PI * 2); ctx.fill();
      }
      rx += 20;
    }
  }

  // ── Clouds (T1/T2: plain rectangles, T3: rounded multi-blob) ──
  for (var ci = 0; ci < state.clouds.length; ci++) {
    var cl = state.clouds[ci];
    ctx.fillStyle = COLORS.cloud;
    if (HAS_ROUNDED_CLOUDS) {
      roundRect(cl.x, cl.y, cl.w, cl.h, 20);
      roundRect(cl.x + cl.w * 0.2, cl.y - cl.h * 0.3, cl.w * 0.5, cl.h * 0.5, 15);
    } else {
      ctx.fillRect(cl.x, cl.y, cl.w, cl.h);
    }
  }

  // ── Particles (T3: brown dust circles with gravity — like original) ──
  for (var pi = 0; pi < state.particles.length; pi++) {
    var pp = state.particles[pi];
    var alpha = Math.max(0, pp.life / pp.maxLife);
    ctx.fillStyle = 'rgba(109,93,75,' + (alpha * 0.6).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, pp.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  // ═══ DINO ═══
  var sqx = squashX(d.vy, -JUMP_VELOCITY);
  var sqy = squashY(d.vy, -JUMP_VELOCITY);
  var dw = d.w * sqx, dh = d.h * sqy;
  var ddx = d.x + (d.w - dw) / 2;
  var ddy = d.y + (d.h - dh);

  // Spines (T2: rectangle blocks, T3: triangles like original)
  if (HAS_SPINES) {
    ctx.fillStyle = COLORS.dinoSpine;
    for (var spi = 0; spi < cfg.spineCount; spi++) {
      var spx = ddx + dw * 0.2 + (dw * 0.6 / cfg.spineCount) * spi;
      if (HAS_TRI_SPINES) {
        ctx.beginPath();
        ctx.moveTo(spx, ddy);
        ctx.lineTo(spx + cfg.spineWidth / 2, ddy - cfg.spineHeight);
        ctx.lineTo(spx + cfg.spineWidth, ddy);
        ctx.fill();
      } else {
        ctx.fillRect(spx, ddy - 4, 4, 8);
      }
    }
  }

  // Body (T1: sharp rectangle, T2: slightly rounded, T3: smooth)
  ctx.fillStyle = COLORS.dino;
  if (cfg.bodyRadius > 0) {
    roundRect(ddx, ddy, dw, dh, cfg.bodyRadius);
  } else {
    ctx.fillRect(ddx, ddy, dw, dh);
  }

  // Belly (T2: wrong size/position, T3: correct)
  if (HAS_BELLY) {
    ctx.fillStyle = COLORS.dinoBelly;
    roundRect(ddx + dw * cfg.bellyX, ddy + dh * cfg.bellyY, dw * cfg.bellyW, dh * cfg.bellyH, cfg.bellyR);
  }

  // Tail (T2: straight line UP — wrong!, T3: bezier curve DOWN — correct!)
  if (HAS_TAIL) {
    ctx.strokeStyle = COLORS.dinoTail;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ddx, ddy + dh * 0.4);
    if (HAS_BEZIER_TAIL) {
      var tc = tailCurveT3(state.speed, MAX_SPEED);
      ctx.bezierCurveTo(
        ddx + tc.cx1, ddy + dh * 0.4 + tc.cy1,
        ddx + tc.cx2, ddy + dh * 0.4 + tc.cy2,
        ddx + tc.ex,  ddy + dh * 0.4 + tc.ey
      );
    } else {
      var tl = tailCurveT2(state.speed, MAX_SPEED);
      ctx.lineTo(ddx + tl.dx, ddy + dh * 0.4 + tl.dy);
    }
    ctx.stroke();
  }

  // Eye — single eye at all tiers (T3 gets size/position correct)
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(ddx + dw + cfg.eyeOffsetX, ddy + cfg.eyeOffsetY, cfg.eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(ddx + dw + cfg.eyeOffsetX + 2, ddy + cfg.eyeOffsetY, cfg.pupilRadius, 0, Math.PI * 2);
  ctx.fill();

  // Legs — 2 at all tiers (thickness varies)
  ctx.strokeStyle = COLORS.dinoLeg;
  ctx.lineWidth = cfg.legStroke;
  ctx.lineCap = 'round';
  var legTop = ddy + dh;
  var legCycle = ((state.scroll / 15) | 0) % 2;
  if (d.onGround) {
    if (legCycle === 0) {
      line(ddx + 10, legTop, ddx + 6, legTop + 16);
      line(ddx + dw - 20, legTop, ddx + dw - 16, legTop + 16);
    } else {
      line(ddx + 10, legTop, ddx + 14, legTop + 16);
      line(ddx + dw - 20, legTop, ddx + dw - 24, legTop + 16);
    }
  } else {
    line(ddx + 10, legTop, ddx + 8, legTop + 12);
    line(ddx + dw - 20, legTop, ddx + dw - 18, legTop + 12);
  }

  // ═══ OBSTACLES ═══
  for (var oi = 0; oi < state.obstacles.length; oi++) {
    var ob = state.obstacles[oi];
    if (ob.type === 'cactus') {
      ctx.fillStyle = COLORS.cactus;
      if (cfg.bodyRadius > 0) {
        roundRect(ob.x, ob.y, ob.w, ob.h, 4);
      } else {
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
      }
      // Arms: T1=none, T2=symmetric, T3=asymmetric (closer to original)
      if (TIER >= 3) {
        ctx.fillRect(ob.x - 8, ob.y + 10, 12, 15);
        ctx.fillRect(ob.x + ob.w - 4, ob.y + 18, 12, 12);
      } else if (TIER >= 2) {
        ctx.fillRect(ob.x - 8, ob.y + 12, 12, 15);
        ctx.fillRect(ob.x + ob.w - 4, ob.y + 12, 12, 15);
      }
    } else {
      ctx.fillStyle = COLORS.bird;
      roundRect(ob.x, ob.y, ob.w, ob.h, 6);
      // Wing
      var wingOff = ((state.scroll / 5) | 0) % 2 === 0 ? -12 : 12;
      ctx.beginPath();
      ctx.moveTo(ob.x + ob.w / 2, ob.y);
      ctx.lineTo(ob.x + ob.w / 2, ob.y + wingOff);
      ctx.strokeStyle = COLORS.bird; ctx.lineWidth = 3; ctx.stroke();
      // Beak (T3 only)
      if (HAS_BIRD_BEAK) {
        ctx.beginPath();
        ctx.moveTo(ob.x + ob.w, ob.y + ob.h * 0.4);
        ctx.lineTo(ob.x + ob.w + 6, ob.y + ob.h * 0.5);
        ctx.lineTo(ob.x + ob.w, ob.y + ob.h * 0.6);
        ctx.fillStyle = '#D2691E';
        ctx.fill();
      }
    }
  }

  // ── Score ──
  var scoreColor = isNight(state.score) ? '#CCCCCC' : COLORS.score;
  ctx.fillStyle = scoreColor;
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + state.score, 20, 35);
  ctx.font = 'bold 20px monospace';
  ctx.fillText('High: ' + state.highScore, 20, 62);

  // ── Game Over ──
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.gameOver;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
    ctx.fillStyle = isNight(state.score) ? '#AAAAAA' : COLORS.subtitle;
    ctx.font = '24px monospace';
    ctx.fillText('Score: ' + state.score, W / 2, H / 2 + 10);
    ctx.fillText('Click to restart', W / 2, H / 2 + 45);
  }
}

// ── Helpers ──
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// ── Input ──
function handleInput() {
  if (state.gameOver) {
    var hs = state.highScore;
    state = createState();
    init();
    state.highScore = hs;
  } else if (state.dino.onGround) {
    state.dino.vy = JUMP_VELOCITY;
    state.dino.onGround = false;
    spawnParticles(state.dino.x + state.dino.w / 2, state.groundY, 3);
  }
}

canvas.addEventListener('click', handleInput);
canvas.addEventListener('touchstart', function(e) { e.preventDefault(); handleInput(); });
document.addEventListener('keydown', function(e) { if (e.code === 'Space') { e.preventDefault(); handleInput(); } });

var lastTime = performance.now();
init();

function loop(now) {
  var dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
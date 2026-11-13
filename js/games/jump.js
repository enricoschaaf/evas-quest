/* Gipfelsturm – side-scrolling pixel platformer with a secret double jump. Last level before the finale. */
(function () {
  'use strict';
  const T = 8, ROWS = 40;
  const VW = 180, VH = 248, CH = 320;           // view area + control strip below
  const GRAV = 900, JUMP = 300, DJUMP = 380, MAXFALL = 380;
  const SPEED = 85, BOOST_SPEED = 97;
  const COYOTE = 0.08, BUFFER = 0.13, DOUBLE_WIN = 0.4;
  const ROCKET_VY = 500, ROCKET_VX = 200;       // secret: hold ◀+▶ and press ⬆ on the ground
  const CHASM_A = 226, GAP = 18, CHASM_B = CHASM_A + GAP; // big chasm columns [A, B)
  const SH = CHASM_B - 236;                     // everything after the chasm is shifted by this
  const COLS = 280 + SH, GIFT_TX = 270 + SH;
  const TEACH_A = 192, TEACH_B = 202;           // small double-jump teaching gap
  const WALL_SLIDE = 45, WALL_SLIDE_FREE = 110, WALL_COYOTE = 0.15, WALL_LOCK = 0.17; // wall slide / wall jump
  const WALL_TOL = 3;                            // px: wall contact counts within this distance (forgiving)
  // non-lethal shafts [first interior col, end col (exclusive), floor row] – only escapable by wall-jumping
  const SHAFTS = [[41, 44, 38], [77, 80, 36], [93, 96, 34]];
  // hidden rooms live to the right of the main level (separated by solid walls)
  const ROOM_FLOOR = 36, ROOM_CEIL = 10, ROOM_CAMY = 52;
  const ROOM_A0 = COLS + 2, ROOM_A1 = ROOM_A0 + 24;  // cave interior cols [A0, A1)
  const ROOM_B0 = ROOM_A1 + 2, ROOM_B1 = ROOM_B0 + 26; // disco interior cols [B0, B1)
  const WCOLS = ROOM_B1 + 2;
  const POUND_HANG = 0.15, POUND_VY = 560, POUND_R = 12;  // ground pound: mid-air pause, slam speed, shockwave reach (px beyond Eva)
  // cracked floor spots [first col, width] – a ground pound breaks through into a small hidden pocket below
  const CRACKS = [[6, 2], [124, 2]];
  const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];

  GAMES['jump'] = {
    title: 'Gipfelsturm',
    intro: 'Der letzte Aufstieg! ◀ ▶ laufen, ⬆ springen. Deine Freunde stellen sich dir in den Weg – hüpf ihnen auf den Kopf! Kisten von unten anstoßen, ⬇ auf hohlen Stämmen. In der Luft ⬇ = Stampfer! Manche Sprünge sind... knifflig.',
    start(root, api) {
      api.music('game');
      const cv = api.makeCanvas(root, VW, CH);
      const ctx = cv.ctx;
      const prevTouch = root.style.touchAction;
      root.style.touchAction = 'none';

      /* ---------------- Level ---------------- */
      const surf = new Int16Array(WCOLS).fill(-1);
      const ceil = new Int16Array(WCOLS).fill(-1);
      const seg = (a, b, r) => { for (let x = a; x < b; x++) surf[x] = r; };
      seg(0, 20, 34); seg(24, 32, 33); seg(32, 41, 31); seg(44, 56, 30); seg(64, 77, 28); seg(80, 86, 28);
      seg(86, 93, 24); seg(96, 100, 24); seg(114, 130, 24); seg(151, 164, 18); seg(172, TEACH_A, 12);
      seg(TEACH_B, CHASM_A, 11); seg(CHASM_B, 248 + SH, 11); seg(248 + SH, 278 + SH, 9); seg(278 + SH, COLS, 0);
      for (const [a, b, f] of SHAFTS) seg(a, b, f);
      // rooms: walls + floor + ceiling
      seg(COLS, WCOLS, 0);
      for (const [a, b] of [[ROOM_A0, ROOM_A1], [ROOM_B0, ROOM_B1]]) { seg(a, b, ROOM_FLOOR); for (let x = a; x < b; x++) ceil[x] = ROOM_CEIL; }
      const areaOf = tx => tx > ROOM_A1 ? 'disco' : tx >= COLS ? 'cave' : 'main';
      const AREA = { main: { x0: 0, x1: COLS * T }, cave: { x0: (ROOM_A0 - 1) * T, x1: (ROOM_A1 + 1) * T }, disco: { x0: (ROOM_B0 - 1) * T, x1: (ROOM_B1 + 1) * T } };
      // warp pipes (hollow tree trunks, 2 tiles wide, 2 tiles tall). to = id of the exit pipe (one-way)
      const pipes = [
        { id: 'a', tx: 16, to: 'a1' }, { id: 'a1', tx: ROOM_A0 + 1 }, { id: 'a2', tx: ROOM_A1 - 3, to: 'a3' }, { id: 'a3', tx: 82 },
        { id: 'b', tx: 120, to: 'b1' }, { id: 'b1', tx: ROOM_B0 + 1 }, { id: 'b2', tx: ROOM_B1 - 3, to: 'b3' }, { id: 'b3', tx: 173 }
      ];
      const pipeById = {}, pipeCol = new Array(WCOLS).fill(null);
      for (const p of pipes) {
        p.base = surf[p.tx]; p.top = p.base - 2; p.topY = p.top * T; p.area = areaOf(p.tx);
        surf[p.tx] = surf[p.tx + 1] = p.top; pipeCol[p.tx] = pipeCol[p.tx + 1] = p; pipeById[p.id] = p;
      }
      // bonus crates (hit from below)
      const blocks = new Map();
      [[11, 30, 'pilz'], [117, 20, 'kastanie'], [ROOM_A0 + 9, 32, 'kastanie'], [ROOM_B0 + 5, 32, 'pilz']]
        .forEach(([tx, ty, kind]) => blocks.set(tx * 64 + ty, { tx, ty, kind, used: false, bump: 0 }));
      // cracked floor: the crack tiles are solid until a ground pound breaks them; the pocket below is hollow
      const holes = new Map();
      const cracks = CRACKS.map(([a, w]) => {
        const c = { a, b: a + w, row: surf[a], p0: a - 2, p1: a + w + 2, broken: false };
        for (let x = c.p0; x < c.p1; x++) for (let r = c.row + 1; r <= c.row + 3; r++) holes.set(x * 64 + r, { c, tile: false });
        for (let x = a; x < c.b; x++) holes.set(x * 64 + c.row, { c, tile: true });
        return c;
      });
      const shafts = SHAFTS.map(([a, b]) => ({ a, b, rimY: Math.min(surf[a - 1], surf[b]) * T }));
      // the big chasm's walls are slick ice: no wall slide / wall jump there (keeps the rocket-jump secret intact)
      const wallOK = tx => tx >= 0 && tx < COLS && tx !== CHASM_A - 1 && tx !== CHASM_B;
      function solid(tx, ty) {
        if (tx < 0 || tx >= WCOLS) return true;
        if (ty < 0 || ty >= ROWS) return false;
        const s = surf[tx];
        if (s >= 0 && ty >= s) { const hh = holes.get(tx * 64 + ty); return !(hh && (!hh.tile || hh.c.broken)); }
        if (ceil[tx] >= 0 && ty <= ceil[tx]) return true;
        return blocks.has(tx * 64 + ty);
      }
      const plats = [[59, 29, 3], [132, 21, 3], [137, 19, 3], [142, 17, 3], [147, 19, 3]]
        .concat([[ROOM_A0 + 13, 32, 3], [ROOM_B0 + 9, 32, 3], [ROOM_B0 + 14, 29, 3]])
        .map(([x, r, w]) => ({ kind: 's', x: x * T, y: r * T, w: w * T, px: x * T, py: r * T, dx: 0, dy: 0 }));
      plats.push({ kind: 'mx', a: 100.5 * T, b: 110.5 * T, x: 100.5 * T, y: 24 * T, w: 3 * T, speed: 30, dir: 1, wait: 0.5, px: 0, py: 0, dx: 0, dy: 0 });
      plats.push({ kind: 'my', a: 18 * T, b: 11 * T, x: 164.5 * T, y: 18 * T, w: 7 * T, speed: 24, dir: 1, wait: 1.2, px: 0, py: 0, dx: 0, dy: 0 });

      const checkpoints = [[2, 34], [34, 31], [66, 28], [90, 24], [116, 24], [153, 18], [176, 12], [CHASM_A - 7, 11]]
        .map(([tx, r], i) => ({ x: tx * T, y: r * T, active: i === 0 }));
      let cpIndex = 0;

      const candleDefs = [[10, 34, 0], [22, 34, 3], [36, 31, 0], [50, 30, 3], [60, 29, 2], [84, 28, 3],
        [107, 24, 3], [42, 38, 0], [78, 36, 0], [94, 34, 0], [143, 17, 1], [160, 18, 0], [168, 11, 0], [197, 10, 0], [208, 11, 0], [242 + SH, 11, 0],
        // secret cave
        [ROOM_A0 + 5, 36, 0], [ROOM_A0 + 7, 36, 2], [ROOM_A0 + 13, 32, 1], [ROOM_A0 + 15, 32, 1],
        // secret disco
        [ROOM_B0 + 3, 36, 0], [ROOM_B0 + 7, 36, 0], [ROOM_B0 + 9, 32, 1], [ROOM_B0 + 11, 32, 1], [ROOM_B0 + 14, 29, 1], [ROOM_B0 + 16, 29, 1],
        // hidden pockets under the cracked floor (4th value = crack index)
        [9, 38, 0, 0], [127, 28, 0, 1]];
      // Eva turns 28 → exactly 28 candles in the level
      const candles = candleDefs.map(([tx, r, lift, hc]) => ({ x: tx * T + 4, y: r * T - 7 - lift * T, got: false, hid: hc == null ? null : cracks[hc] }));
      let candlesGot = 0;

      const snails = [[46, 53, 30], [70, 76, 28], [155, 162, 18]].map(([a, b, r]) => ({
        a: a * T, b: b * T - 12, x: a * T + 8, y: r * T - 8, dir: 1, shell: 0
      }));

      const npcs = [
        { who: 'laurenz', x: (TEACH_A - 5) * T, feet: 12 * T, flip: true },
        { who: 'magnus', x: (CHASM_A - 3) * T, feet: 11 * T, flip: true }
      ];
      // the friends as (comic) enemies – separate from the friendly helper NPCs above
      const PROJ_OF = { magnus: 'zapfen', hannah: 'konfetti', laurenz: 'wasser', enrico: 'disco' };
      const foes = [
        ['enrico', 'walk', 29, 27, 31], ['laurenz', 'throw', 55], ['enrico', 'throw', 99], ['magnus', 'throw', 128],
        ['hannah', 'throw', 163], ['magnus', 'walk', 181, 179, 184], ['hannah', 'walk', 208, 205, 211]
      ].map(([who, kind, tx, a, b]) => ({
        who, kind, x0: tx * T, x: tx * T, feet: surf[tx] * T, a: (a || tx) * T, b: ((b || tx) + 1) * T - 8,
        dir: -1, face: -1, cd: 1.5, wind: 0, dead: false, deadT: 0, look: 0
      }));
      const gift = { x: GIFT_TX * T, y: 9 * T - 12, w: 14, h: 12 };

      // decor (deterministic)
      let seed = 1337;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      const trees = [];
      const POUND_SIGN_TX = 4;
      for (let tx = 1; tx < 276 + SH;) {
        tx += 3 + Math.floor(rnd() * 5);
        const s = surf[tx];
        if (s < 0 || surf[tx + 1] !== s || surf[tx - 1] !== s) continue;
        if (Math.abs(tx - GIFT_TX) < 4 || Math.abs(tx - (262 + SH)) < 3) continue;
        if (cracks.some(c => tx >= c.p0 - 1 && tx <= c.p1) || Math.abs(tx - POUND_SIGN_TX) < 2) continue;
        const type = tx < 168 ? (rnd() * 3 | 0) : tx < 240 + SH ? (rnd() < 0.6 ? 3 : 4) : (rnd() < 0.4 ? 3 : 4);
        trees.push({ tx, row: s, type, big: rnd() < 0.4 });
      }
      const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;

      /* ---------------- State ---------------- */
      const pl = { x: checkpoints[0].x, y: checkpoints[0].y - 14, w: 8, h: 14, vx: 0, vy: 0, face: 1,
        ground: false, onPlat: null, coyote: 0, buffer: 0, lastJumpT: -9, airJump: false, usedDouble: false,
        boosted: false, rocket: false, animT: 0, inv: 0, stepT: 0,
        wallSide: 0, wallCoy: 0, wallCoySide: 0, wallLock: 0, kickDir: 0, sliding: false };
      let shaftJumps = 0, wallLearned = false, visitedShaft = false;
      let now = 0, presses = 0, won = false, winT = 0, flash = 0;
      let chasmFails = 0, crossed = false, shake = 0;
      let pound = null, downPresses = 0, poundLearned = false;   // ground pound state {phase:'hang'|'slam', t}
      const waves = [];
      let area = 'main', warp = null, power = 0, throwPresses = 0, throwCD = 0, pipeTold = false;
      const projs = [], nuts = [], items = [], popups = [];
      const keys = { L: false, R: false, U: false, D: false };
      const ptrs = new Map();
      const parts = [];
      let camX = 0, camY = 0;

      const leaves = [];
      for (let i = 0; i < 18; i++) leaves.push({ x: rnd() * VW, y: rnd() * VH, s: 8 + rnd() * 14, ph: rnd() * 6, c: ['#d9822b', '#c2452d', '#f2b33d', '#e0703a'][i % 4] });

      /* ---------------- Input ---------------- */
      function pressJump() { if (!won) presses++; }
      // ptrs: pointerId -> zone ('L' | 'R' | 'LR' (thumb on the seam between ◀ and ▶) | 'U' | null)
      function inL() { if (keys.L) return true; for (const z of ptrs.values()) if (z === 'L' || z === 'LR') return true; return false; }
      function inR() { if (keys.R) return true; for (const z of ptrs.values()) if (z === 'R' || z === 'LR') return true; return false; }
      function inU() { for (const z of ptrs.values()) if (z === 'U') return true; return keys.U; }
      function inD() { for (const z of ptrs.values()) if (z === 'D') return true; return keys.D; }
      function inW() { for (const z of ptrs.values()) if (z === 'W') return true; return false; }
      function pressThrow() { if (!won) throwPresses++; }
      function kd(e) {
        const k = e.key; let used = true;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.L = true;
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.R = true;
        else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ' || k === 'Spacebar') { if (!e.repeat) pressJump(); keys.U = true; }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { if (!e.repeat && !won) downPresses++; keys.D = true; }
        else if (k === 'x' || k === 'X' || k === 'f' || k === 'F' || k === 'Shift') { if (!e.repeat) pressThrow(); }
        else used = false;
        if (used) e.preventDefault();
      }
      function ku(e) {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.L = false;
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.R = false;
        else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ' || k === 'Spacebar') keys.U = false;
        else if (k === 'ArrowDown' || k === 's' || k === 'S') keys.D = false;
      }
      function blur() { keys.L = keys.R = keys.U = keys.D = false; ptrs.clear(); }
      function zoneAt(e) {
        const p = cv.pointer(e);
        if (p.y < VH - 8) return null;
        return p.x < 40 ? 'L' : p.x < 56 ? 'LR' : p.x < 95 ? 'R' : p.x < 135 ? (p.y < 285 ? 'W' : 'D') : 'U';
      }
      function pDown(e) {
        e.preventDefault();
        const z = zoneAt(e); ptrs.set(e.pointerId, z);
        if (z === 'U') pressJump();
        if (z === 'W') pressThrow();
        if (z === 'D' && !won) downPresses++;
      }
      function pMove(e) {
        if (!ptrs.has(e.pointerId)) return;
        e.preventDefault();
        const z = zoneAt(e);
        if (z !== ptrs.get(e.pointerId)) { ptrs.set(e.pointerId, z); if (z === 'U') pressJump(); if (z === 'W') pressThrow(); if (z === 'D' && !won) downPresses++; }
      }
      function pUp(e) { ptrs.delete(e.pointerId); }
      const noCtx = e => e.preventDefault();
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      window.addEventListener('blur', blur);
      window.addEventListener('pointerup', pUp);
      window.addEventListener('pointercancel', pUp);
      root.addEventListener('pointerdown', pDown, { passive: false });
      root.addEventListener('pointermove', pMove, { passive: false });
      root.addEventListener('contextmenu', noCtx);

      /* ---------------- FX ---------------- */
      function puff(x, y, n, colors, spd, life, up) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.6);
          parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * (up ? 0.4 : 1) - (up || 0), life, max: life, c: colors[i % colors.length], g: 0 });
        }
      }
      function ring(x, y) {
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * Math.PI * 2;
          parts.push({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 30 + 10, life: 0.4, max: 0.4, c: i % 2 ? '#ffffff' : '#f5d442', g: 0 });
        }
        for (let i = 0; i < 6; i++) parts.push({ x: x + (Math.random() - 0.5) * 14, y: y + Math.random() * 4, vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 20, life: 0.5, max: 0.5, c: '#c9b79a', g: 0, star: false });
      }

      /* ---------------- Player actions ---------------- */
      function doJump() {
        pl.vy = -JUMP; pl.ground = false; pl.onPlat = null; pl.coyote = 0; pl.buffer = 0;
        pl.lastJumpT = now; pl.airJump = true; pl.usedDouble = false;
        api.sfx('jump');
        puff(pl.x + 4, pl.y + pl.h, 4, ['#c9b79a', '#a89a80'], 25, 0.3, 10);
      }
      function doDouble() {
        pl.vy = -DJUMP; pl.usedDouble = true; pl.boosted = true; pl.buffer = 0;
        api.sfx('doublejump');
        ring(pl.x + 4, pl.y + pl.h);
      }
      function doRocket() {
        pl.face = 1; // always rocket toward the summit, no matter which button was pressed first
        pl.vy = -ROCKET_VY; pl.vx = ROCKET_VX; pl.ground = false; pl.onPlat = null; pl.coyote = 0; pl.buffer = 0;
        pl.lastJumpT = now; pl.airJump = false; pl.usedDouble = true; pl.boosted = false; pl.rocket = true;
        api.sfx('launch'); api.sfx('doublejump');
        shake = 0.45;
        puff(pl.x + 4, pl.y + pl.h, 16, ['#f5d442', '#f28a2b', '#d94c3d', '#ffffff'], 70, 0.45, 0);
        puff(pl.x + 4, pl.y + pl.h, 12, ['#8a857c', '#a9a49b', '#6d6a66'], 45, 0.8, 0);
      }
      function doWallJump(side) {           // side: wall is on the right (1) or left (-1)
        if (shaftAt()) shaftJumps++;
        pl.vy = -JUMP; pl.vx = -side * SPEED; pl.face = -side; pl.kickDir = -side; pl.wallLock = WALL_LOCK;
        pl.ground = false; pl.onPlat = null; pl.coyote = 0; pl.buffer = 0; pl.wallCoy = 0; pl.wallSide = 0; pl.sliding = false;
        pl.lastJumpT = now; pl.airJump = false; pl.usedDouble = false; pl.boosted = false; pl.rocket = false;
        api.sfx('jump');
        puff(side > 0 ? pl.x + pl.w : pl.x, pl.y + pl.h - 4, 6, ['#c9b79a', '#a89a80', '#e8dcc4'], 35, 0.35, 6);
      }
      /* ---------------- Ground pound (Stampfer) ---------------- */
      function startPound() {
        pound = { phase: 'hang', t: 0 };
        pl.vx = 0; pl.vy = 0; pl.rocket = false; pl.boosted = false; pl.sliding = false; pl.wallLock = 0; pl.buffer = 0; presses = 0;
        api.sfx('flap');
        puff(pl.x + 4, pl.y + 7, 6, ['#ffffff', '#e8dcc4'], 30, 0.25);
      }
      function poundImpact(by, c0, c1) {
        pound = null; poundLearned = true;
        const fx = pl.x + pl.w / 2, fy = pl.y + pl.h;
        shake = Math.max(shake, 0.4);
        api.sfx('boom'); api.sfx('step');
        // crate underneath opens
        if (by != null) {
          const seen = new Set();
          for (let c = c0; c <= c1; c++) { const b = blocks.get(c * 64 + by); if (b && !seen.has(b)) { seen.add(b); bumpBlock(b); } }
        }
        // shockwave: friends on the same floor within reach get knocked over
        for (const e of foes) {
          if (e.dead) continue;
          if (Math.abs(e.x + 4 - fx) <= 8 + POUND_R && Math.abs(e.feet - fy) < 6) defeat(e, true);
        }
        for (const s of snails) {
          if (s.shell <= 0 && Math.abs(s.x + 6 - fx) <= 10 + POUND_R && Math.abs(s.y + 8 - fy) < 6) {
            s.shell = 3; api.sfx('coin'); puff(s.x + 6, s.y, 6, ['#f5d442', '#ffffff'], 40, 0.3);
          }
        }
        // FX: dust skidding out along the floor, debris, a shockwave arc and a pop-up
        for (let i = 0; i < 18; i++) {
          const d = i % 2 ? 1 : -1, sp = 50 + Math.random() * 80;
          parts.push({ x: fx + d * (2 + Math.random() * 3), y: fy - 1 - Math.random() * 2, vx: d * sp, vy: -Math.random() * 35, life: 0.45, max: 0.45, c: ['#c9b79a', '#a89a80', '#e8dcc4'][i % 3], g: 80 });
        }
        for (let i = 0; i < 8; i++) parts.push({ x: fx + (Math.random() - 0.5) * 8, y: fy - 1, vx: (Math.random() - 0.5) * 60, vy: -70 - Math.random() * 60, life: 0.55, max: 0.55, c: ['#5e3a22', '#7c8a2e', '#8a6a4a', '#d9822b'][i % 4], g: 380 });
        waves.push({ x: fx, y: fy, t: 0 });
        popups.push({ x: fx, y: fy - 30, s: 'STAMPF!', life: 0.8, big: true });
      }
      function breakCrack(c) {
        c.broken = true; shake = Math.max(shake, 0.5);
        api.sfx('boom'); api.sfx('ding');
        for (let x = c.a; x < c.b; x++) puff(x * T + 4, c.row * T + 4, 10, ['#5e3a22', '#4a2c19', '#8a6a4a', '#7c8a2e'], 70, 0.6);
        api.toast('🕳️ Geheimes Versteck!', 1800);
      }
      function shaftAt() {
        for (const s of shafts) if (pl.x + pl.w > s.a * T && pl.x < s.b * T && pl.y + pl.h > s.rimY + 3) return s;
        return null;
      }
      function wallAt(side) {
        const c = Math.floor((side > 0 ? pl.x + pl.w + WALL_TOL : pl.x - WALL_TOL) / T);
        if (!wallOK(c)) return false;
        const r0 = Math.floor((pl.y + 2) / T), r1 = Math.floor((pl.y + pl.h - 2) / T);
        for (let r = r0; r <= r1; r++) if (solid(c, r)) return true;
        return false;
      }
      function tryJump() {
        if ((pl.ground || pl.coyote > 0) && inL() && inR()) doRocket();
        else if (pl.ground || pl.coyote > 0) doJump();
        // touching a wall always means wall jump (it used to lose against the double jump)
        else if (pl.wallSide) doWallJump(pl.wallSide);
        else if (pl.airJump && !pl.usedDouble && now - pl.lastJumpT <= DOUBLE_WIN && !shaftAt()) doDouble();
        else if (pl.wallCoy > 0) doWallJump(pl.wallCoySide);
        else pl.buffer = BUFFER;
      }
      function die() {
        if (won) return;
        if (pl.x + pl.w > (CHASM_A - 2) * T && pl.x < (CHASM_B + 1) * T && !crossed) chasmFails++;
        api.sfx('hit');
        const cp = checkpoints[cpIndex];
        pl.x = cp.x; pl.y = cp.y - pl.h; pl.vx = 0; pl.vy = 0; pl.ground = true; pl.onPlat = null;
        pl.airJump = false; pl.usedDouble = false; pl.boosted = false; pl.rocket = false; pl.buffer = 0; pl.inv = 0.5; pl.face = 1;
        pl.wallSide = 0; pl.wallCoy = 0; pl.wallLock = 0; pl.sliding = false;
        presses = 0; throwPresses = 0; flash = 0.2; pound = null; downPresses = 0;
        // friends, crates and power-ups come back; the power-up is lost
        power = 0; warp = null; setArea('main');
        for (const e of foes) { e.dead = false; e.deadT = 0; e.x = e.x0; e.dir = -1; e.cd = 1.5; e.wind = 0; }
        for (const b of blocks.values()) { b.used = false; b.bump = 0; }
        projs.length = 0; nuts.length = 0; items.length = 0;
        camX = clampCamX(pl.x + 4 - VW / 2 + 20);
      }
      // damage: Super-Eva loses one power level and blinks; without power-up -> respawn at checkpoint
      function hurt() {
        if (won || warp || pl.inv > 0) return;
        if (power > 0) {
          power--; pl.inv = 1.6; shake = 0.25; api.sfx('hit');
          puff(pl.x + 4, pl.y + 6, 10, ['#f5d442', '#ffffff', '#ff9a3a'], 50, 0.5);
          api.toast(power ? 'Autsch! Kastanien weg.' : 'Autsch! Super-Eva ist weg.', 1500);
        } else die();
      }
      function setArea(a) {
        if (a === area) return;
        area = a;
        api.music(a === 'disco' ? 'disco' : 'game');
        if (a === 'disco') api.toast('🪩 Geheime Disco!', 2200);
        else if (a === 'cave') api.toast('🕳️ Geheimgang!', 1800);
      }
      /* ---------------- Pipes ---------------- */
      function pipeUnder() {
        if (!pl.ground) return null;
        const cx = pl.x + pl.w / 2, p = pipeCol[Math.floor(cx / T)];
        if (!p || !p.to || Math.abs(pl.y + pl.h - p.topY) > 1) return null;
        if (cx < p.tx * T + 3 || cx > p.tx * T + 13) return null;
        return p;
      }
      const WARP_T = 0.5;
      function startWarp(p) {
        warp = { from: p, to: pipeById[p.to], t: 0, phase: 'down' };
        pl.vx = 0; pl.vy = 0; pl.x = p.tx * T + 4; pl.rocket = false; pl.sliding = false; pl.wallSide = 0; pl.wallCoy = 0; pl.onPlat = null;
        api.sfx('pour');
      }
      function updWarp(h) {
        warp.t += h;
        const k = Math.min(1, warp.t / WARP_T);
        if (warp.phase === 'down') {
          pl.y = warp.from.topY - pl.h + k * (pl.h + 3);
          if (k >= 1) {
            const to = warp.to;
            setArea(to.area);
            pl.x = to.tx * T + 4; pl.y = to.topY + 3; pl.face = 1;
            warp.phase = 'up'; warp.t = 0; api.sfx('flap');
            camera(0, true);
          }
        } else {
          pl.y = warp.to.topY + 3 - k * (pl.h + 3);
          if (k >= 1) {
            pl.y = warp.to.topY - pl.h; pl.vy = 0; pl.ground = true; pl.coyote = COYOTE;
            pl.airJump = false; pl.usedDouble = false; pl.boosted = false; pl.inv = Math.max(pl.inv, 0.5);
            presses = 0; pl.buffer = 0; warp = null;
          }
        }
      }
      /* ---------------- Crates & power-ups ---------------- */
      function bumpBlock(b) {
        b.bump = 0.18;
        if (b.used) { api.sfx('step'); return; }
        b.used = true; api.sfx('ding');
        items.push({ kind: b.kind, x: b.tx * T, by: b.ty * T, y: b.ty * T, vx: 0, vy: 0, rise: 0.45, dir: pl.x + 4 < b.tx * T + 4 ? 1 : -1 });
        puff(b.tx * T + 4, b.ty * T, 6, ['#f5d442', '#ffffff'], 30, 0.3);
      }
      function updItems(dt) {
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.rise > 0) {
            it.rise -= dt; it.y = it.by - 8 * (1 - Math.max(0, it.rise) / 0.45);
            if (it.rise <= 0 && it.kind === 'pilz') it.vx = it.dir * 34;
          } else if (it.kind === 'pilz') {
            it.vy = Math.min(MAXFALL, it.vy + GRAV * 0.7 * dt);
            const nx = it.x + it.vx * dt, cx = Math.floor((it.vx > 0 ? nx + 7.9 : nx) / T);
            const r0 = Math.floor(it.y / T), r1 = Math.floor((it.y + 7.9) / T);
            let blocked = false; for (let r = r0; r <= r1; r++) if (solid(cx, r)) blocked = true;
            if (blocked) it.vx = -it.vx; else it.x = nx;
            const ny = it.y + it.vy * dt, by = Math.floor((ny + 8) / T);
            if (it.vy > 0 && (solid(Math.floor((it.x + 1) / T), by) || solid(Math.floor((it.x + 7) / T), by))) { it.y = by * T - 8; it.vy = 0; }
            else it.y = ny;
            if (it.y > ROWS * T) { items.splice(i, 1); continue; }
          }
          if (it.rise <= 0.2 && !warp && overlap(pl.x, pl.y, pl.w, pl.h, it.x, it.y, 8, 8)) {
            items.splice(i, 1);
            api.sfx('doublejump'); api.sfx('coin');
            puff(it.x + 4, it.y + 4, 14, ['#f5d442', '#ffffff', it.kind === 'pilz' ? '#d94c3d' : '#9ad04a'], 55, 0.6);
            if (it.kind === 'pilz') { if (power < 1) power = 1; api.toast('🍄 Super-Eva! Hält einen Treffer aus.', 2200); }
            else { power = 2; api.toast('🌰 Kastanien-Power! WURF (oder X) = werfen', 2600); }
          }
        }
      }
      function throwNut() {
        if (power < 2 || warp || won || throwCD > 0 || nuts.length >= 2) return;
        throwCD = 0.22;
        nuts.push({ x: pl.x + 4 + pl.face * 4, y: pl.y + 5, vx: pl.face * 140 + pl.vx * 0.3, vy: -40, life: 1.6, b: 0 });
        api.sfx('flap');
      }

      /* ---------------- Physics step ---------------- */
      function updatePlats(h) {
        for (const p of plats) {
          p.px = p.x; p.py = p.y;
          if (p.kind === 'mx' || p.kind === 'my') {
            if (p.t > 0) { p.t -= h; }
            else {
              const target = p.dir > 0 ? p.b : p.a;
              const cur = p.kind === 'mx' ? p.x : p.y;
              const d = target - cur, st = p.speed * h;
              let nv;
              if (Math.abs(d) <= st) { nv = target; p.dir *= -1; p.t = p.wait; } else nv = cur + Math.sign(d) * st;
              if (p.kind === 'mx') p.x = nv; else p.y = nv;
            }
          }
          p.dx = p.x - p.px; p.dy = p.y - p.py;
        }
      }
      function step(h) {
        now += h;
        updatePlats(h);
        if (warp) { updWarp(h); return; }
        // ⬇: on the ground = into a warp trunk (held), in the air = ground pound (press)
        if (downPresses > 0) { downPresses = 0; if (!won && !pl.ground && !pound) startPound(); }
        if (!won && !pound && inD()) { const wp = pipeUnder(); if (wp) { startWarp(wp); return; } }
        if (pl.onPlat) { pl.x += pl.onPlat.dx; pl.y = pl.onPlat.y - pl.h; }

        // horizontal
        let ax = won ? 0 : (inR() ? 1 : 0) - (inL() ? 1 : 0);
        if (pl.wallLock > 0) { pl.wallLock -= h; if (ax !== pl.kickDir) ax = 0; } // brief lock so the wall kick reads
        if (pound) { ax = 0; pl.vx = 0; presses = 0; pl.buffer = 0; }          // no steering / jumping during the slam
        const maxS = pl.rocket ? ROCKET_VX : pl.boosted ? BOOST_SPEED : SPEED;
        if (ax) {
          pl.vx += ax * (pl.ground ? 900 : 700) * h; pl.face = ax;
        } else if (pl.rocket || pl.wallLock > 0) {
          // rocket / wall kick keep their momentum (she may still be holding both directions)
        } else {
          const dec = (pl.ground ? 1100 : 350) * h;
          pl.vx = Math.abs(pl.vx) <= dec ? 0 : pl.vx - Math.sign(pl.vx) * dec;
        }
        if (pl.vx > maxS) pl.vx = maxS; if (pl.vx < -maxS) pl.vx = -maxS;

        // jumps
        if (!pl.ground) pl.coyote -= h;
        while (presses > 0) { presses--; tryJump(); }
        if (pl.buffer > 0) { pl.buffer -= h; if (pl.ground || pl.coyote > 0) doJump(); else if (pl.wallSide) doWallJump(pl.wallSide); }

        if (pound) {
          pound.t += h;
          if (pound.phase === 'hang') { pl.vy = 0; if (pound.t >= POUND_HANG) { pound.phase = 'slam'; pound.t = 0; pl.vy = POUND_VY; } }
          else pl.vy = POUND_VY;
        } else pl.vy = Math.min(MAXFALL, pl.vy + GRAV * h);

        // move X
        pl.x += pl.vx * h;
        const r0 = Math.floor(pl.y / T), r1 = Math.floor((pl.y + pl.h - 0.001) / T);
        if (pl.vx > 0) {
          const c = Math.floor((pl.x + pl.w - 0.001) / T);
          for (let r = r0; r <= r1; r++) if (solid(c, r)) { pl.x = c * T - pl.w; pl.vx = 0; break; }
        } else if (pl.vx < 0) {
          const c = Math.floor(pl.x / T);
          for (let r = r0; r <= r1; r++) if (solid(c, r)) { pl.x = (c + 1) * T; pl.vx = 0; break; }
        }
        if (pl.x < 0) pl.x = 0;

        // move Y
        const wasGround = pl.ground, prevBottom = pl.y + pl.h, fallV = pl.vy;
        pl.y += pl.vy * h;
        let landed = false, onPlat = null;
        const c0 = Math.floor(pl.x / T), c1 = Math.floor((pl.x + pl.w - 0.001) / T);
        let landBy = null;
        if (pl.vy > 0) {
          const by = Math.floor((pl.y + pl.h) / T);
          if (pound) for (let c = c0; c <= c1; c++) { const hh = holes.get(c * 64 + by); if (hh && hh.tile && !hh.c.broken) breakCrack(hh.c); }
          for (let c = c0; c <= c1; c++) if (solid(c, by)) { landBy = by;
            pl.y = by * T - pl.h; pl.vy = 0; landed = true; break;
          }
          if (!landed) {
            for (const p of plats) {
              if (pl.x + pl.w > p.x + 1 && pl.x < p.x + p.w - 1 &&
                  prevBottom <= Math.max(p.py, p.y) + 0.5 && pl.y + pl.h >= p.y) {
                pl.y = p.y - pl.h; pl.vy = 0; landed = true; onPlat = p; break;
              }
            }
          }
        } else if (pl.vy < 0) {
          const ty = Math.floor(pl.y / T);
          let bonk = false;
          for (let c = c0; c <= c1; c++) if (solid(c, ty)) bonk = true;
          if (bonk) {
            pl.y = (ty + 1) * T; pl.vy = 0;
            const cc = Math.floor((pl.x + pl.w / 2) / T);
            const b = blocks.get(cc * 64 + ty) || blocks.get(c0 * 64 + ty) || blocks.get(c1 * 64 + ty);
            if (b) bumpBlock(b);
          }
        }
        pl.ground = landed; pl.onPlat = onPlat;
        if (landed) {
          pl.coyote = COYOTE;
          if (!wasGround) {
            pl.airJump = false; pl.usedDouble = false; pl.boosted = false; pl.rocket = false;
            if (fallV > 200) puff(pl.x + 4, pl.y + pl.h, 5, ['#c9b79a', '#a89a80'], 30, 0.3, 8);
            if (pl.buffer > 0) doJump();
          }
          if (pound) poundImpact(landBy, c0, c1);
        } else if (wasGround && pl.vy >= 0) {
          // walked off an edge: coyote already running
        }
        // wall contact (airborne, within WALL_TOL px of a non-icy wall)
        let ws = landed ? 0 : wallAt(1) ? 1 : wallAt(-1) ? -1 : 0;
        if (pl.wallLock > 0 && ws === -pl.kickDir) ws = 0;   // can't re-kick off the wall she just left
        pl.wallSide = ws;
        if (ws) { pl.wallCoy = WALL_COYOTE; pl.wallCoySide = ws; } else if (landed) pl.wallCoy = 0; else if (pl.wallCoy > 0) pl.wallCoy -= h;
        // falling along a wall = sliding (pose + dust), even without holding toward it; holding slows her more
        pl.sliding = !!ws && !won && pl.vy > 0 && !pound;
        if (pl.sliding) {
          const cap = (ws > 0 ? inR() : inL()) ? WALL_SLIDE : WALL_SLIDE_FREE;
          if (pl.vy > cap) pl.vy = cap;
          if (Math.random() < h * 22) parts.push({ x: ws > 0 ? pl.x + pl.w - 1 : pl.x, y: pl.y + pl.h - 2 - Math.random() * 6, vx: -ws * (8 + Math.random() * 12), vy: -8 - Math.random() * 10, life: 0.35, max: 0.35, c: ['#c9b79a', '#a89a80', '#e8dcc4'][(Math.random() * 3) | 0], g: 30 });
        }

        if (pl.inv > 0) pl.inv -= h;
        if (pl.rocket && pl.vy < 120 && Math.random() < h * 90) {
          const fx = pl.x + 4 + (Math.random() - 0.5) * 6, fy = pl.y + pl.h;
          parts.push({ x: fx, y: fy, vx: (Math.random() - 0.5) * 30, vy: 40 + Math.random() * 50, life: 0.3, max: 0.3, c: ['#f5d442', '#f28a2b', '#d94c3d'][(Math.random() * 3) | 0], g: 0 });
          if (Math.random() < 0.5) parts.push({ x: fx, y: fy + 3, vx: (Math.random() - 0.5) * 20, vy: 15 + Math.random() * 20, life: 0.7, max: 0.7, c: ['#8a857c', '#a9a49b'][(Math.random() * 2) | 0], g: -20 });
        }
        // falling into a gap: respawn quickly instead of waiting for the bottom of the world
        const inGap = (gx0, gx1) => pl.x + pl.w > gx0 * T && pl.x < gx1 * T;
        if (pl.y > ROWS * T + 16 || (pl.y > 11 * T + 40 && inGap(CHASM_A, CHASM_B)) || (pl.y > 12 * T + 40 && inGap(TEACH_A, TEACH_B))) die();
      }

      /* ---------------- Game logic (per frame) ---------------- */
      function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }
      const STOMP_LINES = { magnus: ['Autsch!', 'Menno!'], hannah: ['Na warte!', 'Hey!!'], laurenz: ['Uff!', 'Na warte!'], enrico: ['Autsch!', 'Nicht fair!'] };
      function defeat(e, big) {
        e.dead = true; e.deadT = 0.4; e.wind = 0;
        api.sfx('coin');
        if (big) { puff(e.x + 4, e.feet - 10, 14, ['#f5d442', '#ffffff', '#ff9a3a', '#d94c3d'], 90, 0.6); e.deadT = 0.55; }
        puff(e.x + 4, e.feet - 8, 12, ['#ffffff', '#e8e0d0', '#c9c2b8'], 45, 0.5);
        puff(e.x + 4, e.feet - 12, 6, ['#f5d442', '#ff3fa4', '#3fe0ff'], 60, 0.4);
        const L = STOMP_LINES[e.who];
        popups.push({ x: e.x + 4, y: e.feet - 22, s: L[(Math.random() * L.length) | 0], life: 1.1 });
      }
      function throwAt(e) {
        const sx = e.x + 4 + e.face * 3, sy = e.feet - 19;
        const dx = pl.x + 4 - sx, ty = pl.y + 7, G = 320;
        const t = Math.max(0.75, Math.min(1.4, Math.abs(dx) / 80));
        let vy = (ty - sy - 0.5 * G * t * t) / t; if (vy < -260) vy = -260;
        projs.push({ kind: PROJ_OF[e.who], x: sx, y: sy, vx: dx / t, vy, G, life: 3.5 });
        api.sfx('flap');
      }
      function updFoes(dt) {
        for (const e of foes) {
          if (e.dead) { if (e.deadT > 0) e.deadT -= dt; continue; }
          if (e.kind === 'walk') {
            e.x += e.dir * 20 * dt;
            if (e.x < e.a) { e.x = e.a; e.dir = 1; } if (e.x > e.b) { e.x = e.b; e.dir = -1; }
            e.face = e.dir;
          } else if (area === 'main') {
            // throwers only throw forward (toward where Eva comes from); behind them they just look puzzled
            const dx = pl.x + 4 - (e.x + 4), dy = pl.y + pl.h - e.feet;
            const front = dx < -10;
            e.look = !front && Math.abs(dx) < 60 ? 1 : 0;
            if (front && dx > -112 && Math.abs(dy) < 90) {
              if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0) { throwAt(e); e.cd = 2.2 + Math.random() * 0.8; } }
              else { e.cd -= dt; if (e.cd <= 0) e.wind = 0.75; }
            } else { e.wind = 0; e.cd = Math.max(e.cd, 1.0); }
          }
          // Eva vs friend
          const ey = e.feet - 14;
          if (overlap(pl.x + 1, pl.y + 1, pl.w - 2, pl.h - 1, e.x, ey, 8, 14)) {
            if (pound && pound.phase === 'slam') defeat(e, true);   // slams right through
            else if (pl.vy > 0 && pl.y + pl.h < ey + 8) {
              defeat(e);
              pl.vy = -230; pl.airJump = true; pl.lastJumpT = now; pl.usedDouble = false; pl.ground = false; pl.onPlat = null;
            } else hurt();
          }
        }
      }
      const POP_COL = { zapfen: ['#6b3a1a', '#a0602a', '#4a2814'], konfetti: LIGHTS, wasser: ['#6fc3ff', '#bfe6ff', '#3a8ad9', '#ffffff'], disco: ['#ffffff', '#d0d8e8', '#ff3fa4', '#3fe0ff'] };
      function popProj(q) { puff(q.x, q.y, q.kind === 'konfetti' ? 16 : 9, POP_COL[q.kind], q.kind === 'konfetti' ? 60 : 40, 0.5); if (q.kind === 'konfetti') for (let i = parts.length - 16; i < parts.length; i++) if (parts[i]) parts[i].g = 90; }
      function updProjs(dt) {
        for (let i = projs.length - 1; i >= 0; i--) {
          const q = projs[i];
          q.life -= dt; q.vy += q.G * dt; q.x += q.vx * dt; q.y += q.vy * dt;
          if (q.life <= 0 || q.y > ROWS * T || solid(Math.floor(q.x / T), Math.floor(q.y / T))) { popProj(q); projs.splice(i, 1); continue; }
          if (!warp && area === 'main' && overlap(pl.x + 1, pl.y + 1, pl.w - 2, pl.h - 2, q.x - 2, q.y - 2, 4, 4)) {
            popProj(q); projs.splice(i, 1);
            if (q.kind === 'wasser' || q.kind === 'konfetti') api.sfx('pour');
            hurt();
          }
        }
      }
      function updNuts(dt) {
        for (let i = nuts.length - 1; i >= 0; i--) {
          const n = nuts[i];
          n.life -= dt; n.vy = Math.min(MAXFALL, n.vy + 800 * dt);
          let gone = n.life <= 0 || Math.abs(n.x - pl.x) > VW || n.y > ROWS * T;
          const nx = n.x + n.vx * dt;
          if (!gone && solid(Math.floor(nx / T), Math.floor(n.y / T))) gone = true; else n.x = nx;
          const ny = n.y + n.vy * dt;
          if (!gone) {
            if (n.vy > 0 && solid(Math.floor(n.x / T), Math.floor((ny + 2) / T))) { n.y = Math.floor((ny + 2) / T) * T - 2; n.vy = -170; if (++n.b > 4) gone = true; }
            else if (n.vy < 0 && solid(Math.floor(n.x / T), Math.floor((ny - 2) / T))) n.vy = 0;
            else n.y = ny;
          }
          if (!gone) for (const e of foes) if (!e.dead && overlap(n.x - 2, n.y - 2, 4, 4, e.x, e.feet - 14, 8, 14)) { defeat(e); gone = true; break; }
          if (!gone) for (const s of snails) if (s.shell <= 0 && overlap(n.x - 2, n.y - 2, 4, 4, s.x, s.y, 12, 8)) { s.shell = 3; api.sfx('coin'); gone = true; break; }
          if (!gone) for (let j = projs.length - 1; j >= 0; j--) if (overlap(n.x - 3, n.y - 3, 6, 6, projs[j].x - 2, projs[j].y - 2, 4, 4)) { popProj(projs[j]); projs.splice(j, 1); gone = true; break; }
          if (gone) { puff(n.x, n.y, 5, ['#8a4a22', '#d08850', '#e8d8b0'], 30, 0.3); nuts.splice(i, 1); }
        }
      }
      function logic(dt) {
        // snails
        for (const s of snails) {
          if (s.shell > 0) s.shell -= dt;
          else { s.x += s.dir * 10 * dt; if (s.x < s.a) { s.x = s.a; s.dir = 1; } if (s.x > s.b) { s.x = s.b; s.dir = -1; } }
          if (!won && pl.inv <= 0 && s.shell <= 0 && overlap(pl.x + 1, pl.y + 1, pl.w - 2, pl.h - 1, s.x + 1, s.y + 2, 10, 6)) {
            if (pound && pound.phase === 'slam') { s.shell = 3; api.sfx('coin'); puff(s.x + 6, s.y, 6, ['#f5d442', '#ffffff'], 40, 0.3); }
            else if (pl.vy > 20 && pl.y + pl.h < s.y + 6) {
              pl.vy = -230; pl.airJump = true; pl.lastJumpT = now; pl.usedDouble = false; s.shell = 3;
              api.sfx('jump'); puff(s.x + 6, s.y, 6, ['#f5d442', '#ffffff'], 40, 0.3);
            } else hurt();
          }
        }
        if (!warp && !won) updFoes(dt);
        updProjs(dt);
        updNuts(dt);
        updItems(dt);
        for (const b of blocks.values()) if (b.bump > 0) b.bump -= dt;
        if (throwCD > 0) throwCD -= dt;
        while (throwPresses > 0) { throwPresses--; throwNut(); }
        for (let i = waves.length - 1; i >= 0; i--) { waves[i].t += dt; if (waves[i].t > 0.35) waves.splice(i, 1); }
        if (pound && pound.phase === 'slam' && Math.random() < dt * 60) parts.push({ x: pl.x + 1 + Math.random() * 6, y: pl.y - 2, vx: 0, vy: -30, life: 0.2, max: 0.2, c: '#ffffff', g: 0 });
        for (let i = popups.length - 1; i >= 0; i--) { const q = popups[i]; q.life -= dt; q.y -= 14 * dt; if (q.life <= 0) popups.splice(i, 1); }
        if (power > 0 && !warp && Math.random() < dt * 10) parts.push({ x: pl.x + Math.random() * 10 - 1, y: pl.y + Math.random() * 14, vx: 0, vy: -12, life: 0.5, max: 0.5, c: power > 1 ? '#ff9a3a' : (Math.random() < 0.5 ? '#ffffff' : '#f5d442'), g: 0 });
        if (!pipeTold && !warp && pipeUnder()) { pipeTold = true; api.toast('⬇ drücken = ab ins Rohr!', 2200); }
        // checkpoints
        checkpoints.forEach((cp, i) => {
          if (i > cpIndex && pl.x + pl.w > cp.x - 2 && pl.x < cp.x + 8 && Math.abs(pl.y + pl.h - cp.y) < 24) {
            cpIndex = i; cp.active = true; api.sfx('ding');
            puff(cp.x + 4, cp.y - 14, 8, ['#d94c3d', '#f5d442', '#ffffff'], 40, 0.5);
          }
        });
        // candles
        for (const c of candles) {
          if (!c.got && !(c.hid && !c.hid.broken) && Math.abs(pl.x + 4 - c.x) < 8 && Math.abs(pl.y + 7 - c.y) < 12) {
            c.got = true; candlesGot++; api.sfx('coin');
            if (candlesGot === candles.length) { api.sfx('win'); api.toast('Alle 28 Kerzen! Alles Gute zum 28., Eva! 🎂', 3500); if (window.Konfetti) { Konfetti.burst(innerWidth / 2, innerHeight * 0.6, 120, 1.5); Konfetti.rain(80); } }
            puff(c.x, c.y, 8, ['#f5d442', '#f2b33d', '#ffffff'], 35, 0.4);
          }
        }
        // made it across the big chasm (only possible with the secret rocket jump)
        if (!crossed && area === 'main' && pl.ground && pl.x > CHASM_B * T) {
          crossed = true; api.sfx('ding');
          api.toast('🚀 RAKETENSPRUNG!', 2600);
          puff(pl.x + 4, pl.y, 14, ['#f5d442', '#ffffff', '#f2a7b8'], 60, 0.7);
        }
        if (shake > 0) shake -= dt;
        // wall-jump hint: learned once she has wall-jumped out of a shaft
        if (shaftAt()) visitedShaft = true;
        else if (visitedShaft && pl.ground) { if (shaftJumps > 0) wallLearned = true; visitedShaft = false; }
        // gift
        if (!won && overlap(pl.x, pl.y, pl.w, pl.h, gift.x - 2, gift.y - 4, gift.w + 4, gift.h + 4)) {
          won = true; winT = 0; pl.vx = 0;
          api.win();
        }
        if (won) {
          winT += dt;
          if (Math.random() < dt * 30) {
            const cols = ['#d94c3d', '#f5d442', '#4a7fd9', '#6fae4f', '#f2a7b8', '#ffffff'];
            parts.push({ x: gift.x + 7, y: gift.y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 90, life: 1.2, max: 1.2, c: cols[(Math.random() * cols.length) | 0], g: 160 });
          }
          if (pl.ground && winT > 0.2) { pl.vy = -180; pl.ground = false; pl.onPlat = null; }
        }
        // anim
        pl.animT += dt;
        if (pl.ground && Math.abs(pl.vx) > 20) { pl.stepT += dt; if (pl.stepT > 0.28) { pl.stepT = 0; api.sfx('step'); } }
        // particles
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.life -= dt;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= 1 - 2 * dt;
        }
        if (flash > 0) flash -= dt;
      }

      /* ---------------- Camera ---------------- */
      function clampCamX(v) { const a = AREA[area]; return Math.max(a.x0, Math.min(a.x1 - VW, v)); }
      function clampCamY(v) { return area !== 'main' ? ROOM_CAMY : Math.max(0, Math.min(ROWS * T - VH, v)); }
      function camera(dt, snap) {
        const tx = clampCamX(pl.x + 4 - VW / 2 + pl.face * 18);
        let ty = clampCamY(pl.y - 150), ky = 4;
        if (area === 'main' && pl.y - 28 < ty) { ty = pl.y - 28; ky = 10; }   // keep Eva in view when she flies above the top
        const k = snap ? 1 : Math.min(1, dt * 5);
        camX += (tx - camX) * k; camY += (ty - camY) * Math.min(1, snap ? 1 : dt * ky);
      }
      camera(0, true);

      /* ---------------- Drawing ---------------- */
      const fr = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
      const SKY = ['#4b6aa8', '#5b7cb8', '#6f90c6', '#88a6cf', '#a7b9cf', '#cfc3b0', '#ecc290', '#f2ae72'];
      function drawBG(ox, oy) {
        const bh = Math.ceil(VH / SKY.length);
        SKY.forEach((c, i) => fr(c, 0, i * bh, VW, bh));
        // sun
        const sx = 140 - ox * 0.02, sy = 150 + (72 - oy) * 0.1;
        fr('#f8d77a', sx - 7, sy - 9, 14, 18); fr('#f8d77a', sx - 9, sy - 7, 18, 14); fr('#fbe7a6', sx - 5, sy - 5, 8, 8);
        // far mountains
        const fy = VH - 30 + (72 - oy) * 0.12;
        for (let i = 0; i < VW; i += 2) {
          const wx = i + ox * 0.12;
          const hgt = 70 + 28 * Math.sin(wx * 0.011) + 14 * Math.sin(wx * 0.031 + 1.3) + 6 * Math.sin(wx * 0.07);
          const top = Math.round(fy - hgt);
          fr('#7383ad', i, top, 2, VH - top);
          if (hgt > 92) fr('#e8eef6', i, top, 2, Math.min(6, Math.round((hgt - 92) * 0.6) + 2));
        }
        // mid hills with autumn tree silhouettes
        const my = VH + (72 - oy) * 0.3;
        for (let i = 0; i < VW; i += 2) {
          const wx = Math.floor(i + ox * 0.35);
          const hgt = 70 + 16 * Math.sin(wx * 0.02) + 8 * Math.sin(wx * 0.053 + 2);
          const top = Math.round(my - hgt);
          fr('#5b4a5e', i, top, 2, VH - top);
          const wq = Math.floor(wx / 2);
          if (hash(wq, 3) % 5 === 0) {
            const c = ['#8c4a3a', '#9a5a36', '#6e4a52'][hash(wq, 7) % 3];
            fr(c, i - 3, top - 7, 8, 7); fr(c, i - 1, top - 10, 4, 3);
          }
        }
      }
      const AUT = [['#d9822b', '#f2b33d', '#a85a22'], ['#c2452d', '#e0703a', '#8e2f22'], ['#d9b03a', '#f5d442', '#a8822a']];
      function drawTree(t, ox, oy) {
        const x = t.tx * T - ox, b = t.row * T - oy;
        if (x < -20 || x > VW + 20) return;
        if (t.type < 3) {
          const c = AUT[t.type], s = t.big ? 4 : 0;
          fr('#4a2c19', x + 3, b - 12 - s, 3, 12 + s);
          fr(c[2], x - 3, b - 23 - s, 15, 10);
          fr(c[0], x - 3, b - 25 - s, 15, 9); fr(c[0], x - 1, b - 29 - s, 11, 4); fr(c[0], x - 2, b - 16 - s, 13, 2);
          fr(c[1], x - 1, b - 27 - s, 5, 3); fr(c[1], x + 6, b - 23 - s, 4, 2); fr(c[1], x, b - 20 - s, 2, 2);
        } else if (t.type === 3) {
          const s = t.big ? 4 : 0, snow = t.tx > 240 + SH;
          fr('#4a2c19', x + 4, b - 4, 2, 4);
          const ws = [11, 9, 7, 5, 3];
          ws.forEach((w, i) => {
            const yy = b - 8 - i * (4 + (t.big ? 1 : 0)) - s / 2;
            fr('#2f5d3a', x + 5 - (w >> 1), yy, w, 5);
            fr(snow ? '#eef3f6' : '#3f7a4a', x + 5 - (w >> 1), yy, w > 3 ? 2 : 1, 1);
          });
        } else {
          fr('#6d6a66', x, b - 5, 10, 5); fr('#8a857c', x + 1, b - 6, 7, 2); fr('#a9a49b', x + 2, b - 6, 3, 1);
          if (t.tx > 244 + SH) fr('#eef3f6', x + 1, b - 6, 6, 1);
        }
      }
      // like solid(), but a still-hidden pocket counts as solid earth (no edge shading gives it away)
      function vsolid(tx, ty) { const hh = holes.get(tx * 64 + ty); return (hh && !hh.c.broken) || solid(tx, ty); }
      function drawTiles(ox, oy) {
        const tx0 = Math.floor(ox / T), ty0 = Math.floor(oy / T);
        for (let tx = tx0; tx <= tx0 + 23; tx++) {
          if (tx < 0 || tx >= WCOLS) continue;
          if (tx >= COLS) { drawRoomCol(tx, ox, oy, ty0); continue; }
          const s = surf[tx]; if (s < 0) continue;
          const pp = pipeCol[tx], top = pp ? pp.base : s;
          const rocky = tx >= 172 + (hash(tx, 1) % 6);
          const snowy = tx >= 244 + SH;
          for (let ty = Math.max(top, ty0); ty <= ty0 + 31 && ty < ROWS; ty++) {
            const x = tx * T - ox, y = ty * T - oy, hv = hash(tx, ty);
            const hh = holes.get(tx * 64 + ty);
            if (hh && hh.c.broken) {           // opened hidden pocket
              fr('#1e120a', x, y, T, T);
              if (hv % 4 === 0) fr('#2e1d12', x + (hv % 6), y + ((hv >> 3) % 6), 2, 1);
              if (ty === hh.c.row + 1 && hv % 2) fr('#6b4a2a', x + (hv % 5) + 1, y, 1, 2 + (hv % 3));   // roots
              continue;
            }
            if (rocky) {
              fr(ty === s ? '#77736d' : '#625e59', x, y, T, T);
              fr('#4e4a46', x + (hv % 6), y + ((hv >> 3) % 6), 2, 1);
              fr('#88837b', x + ((hv >> 2) % 6), y + ((hv >> 5) % 6), 1, 1);
              if ((hv % 4) === 0) fr('#55514c', x, y + 7, T, 1);
            } else {
              fr('#5e3a22', x, y, T, T);
              fr('#4a2c19', x + (hv % 6), y + ((hv >> 3) % 6), 2, 1);
              if (hv % 3 === 0) fr('#8a6a4a', x + ((hv >> 2) % 7), y + ((hv >> 5) % 7), 1, 1);
            }
            if (ty === top) {
              if (rocky) {
                fr(snowy ? '#f4f6f8' : '#a9a49b', x, y, T, 2);
                if (snowy && hv % 2) fr('#f4f6f8', x + (hv % 6), y + 2, 2, 1);
              } else {
                fr('#7c8a2e', x, y, T, 3); fr('#a3a83a', x, y, T, 1);
                const lc = ['#d9822b', '#c2452d', '#f2b33d'];
                fr(lc[hv % 3], x + (hv % 7), y + 1, 2, 1);
                fr(lc[(hv >> 2) % 3], x + ((hv >> 3) % 7), y + 2, 1, 1);
                fr('#6b4a2a', x, y + 3, T, 1);
              }
            }
            if (!vsolid(tx - 1, ty)) fr('rgba(0,0,0,.25)', x, y, 1, T);
            if (!vsolid(tx + 1, ty)) fr('rgba(0,0,0,.25)', x + 7, y, 1, T);
            if (hh && hh.tile) {               // cracked floor tile (breaks with a ground pound)
              const k = tx - hh.c.a;
              fr('#2a180c', x + 1 + k, y + 3, 1, 2); fr('#2a180c', x + 2 + k, y + 4, 2, 1); fr('#2a180c', x + 4 - k, y + 5, 1, 2);
              fr('#2a180c', x + 5 - k, y + 6, 2, 1); fr('#2a180c', x + 3, y + 1, 1, 2);
              fr('#8a6a4a', x + 2 + k, y + 3, 1, 1);
            }
            if (tx === CHASM_A - 1 || tx === CHASM_B) {   // slick ice glaze on the chasm walls
              const ix = tx === CHASM_B ? x : x + 5, gl = ty === s ? 2 : 0;
              fr('#9fd0e4', ix, y + gl, 3, T - gl); fr('#d8f0f8', tx === CHASM_B ? x + 1 : x + 6, y + top, 1, T - top);
              if (hv % 3 === 0) fr('#ffffff', tx === CHASM_B ? x + 1 : x + 6, y + (hv % 6), 1, 2);
            }
          }
        }
      }
      let beatNowV = 0;
      function beatNow() {
        const A = window.Engine && window.Engine.Audio;
        const b = A && A.beat && A.beat();
        if (b != null && A.bpm && A.bpm() === 120) return Math.max(0, b);
        return now * 2;
      }
      function drawRoomCol(tx, ox, oy, ty0) {
        const disco = tx > ROOM_A1, interior = surf[tx] === ROOM_FLOOR || pipeCol[tx];
        const pp = pipeCol[tx], floorTop = pp ? pp.base : surf[tx];
        const bi = Math.floor(beatNowV), pulse = Math.pow(1 - (beatNowV - bi), 2);
        for (let ty = Math.max(0, ty0); ty <= ty0 + 31 && ty < ROWS; ty++) {
          const isFloor = ty >= floorTop, isCeil = ceil[tx] >= 0 && ty <= ceil[tx];
          if (!isFloor && !isCeil) continue;
          const x = tx * T - ox, y = ty * T - oy, hv = hash(tx, ty);
          if (disco) {
            if (interior && ty === floorTop && !pp) {
              const ci = (tx + (bi >> 1) * 3 + (bi % 2 ? tx : 0)) % LIGHTS.length;
              const on = (tx + bi) % 2 === 0;
              fr('#0a0610', x, y, T, T);
              fr(LIGHTS[ci], x + 1, y + 1, T - 2, T - 2);
              ctx.globalAlpha = on ? 0.15 + 0.25 * (1 - pulse) : 0.55; fr('#0a0610', x + 1, y + 1, T - 2, T - 2); ctx.globalAlpha = 1;
              if (on && pulse > 0.4) fr('#ffffff', x + 2, y + 2, 2, 1);
            } else {
              fr('#120a1e', x, y, T, T);
              fr('#22163a', x + (hv % 6), y + ((hv >> 3) % 6), 2, 1);
              if (isCeil && ty === ceil[tx]) fr('#3a2460', x, y + 6, T, 2);
            }
          } else {
            fr('#3b2a22', x, y, T, T);
            fr('#2a1d16', x + (hv % 6), y + ((hv >> 3) % 6), 2, 1);
            if (hv % 3 === 0) fr('#5a4234', x + ((hv >> 2) % 7), y + ((hv >> 5) % 7), 1, 1);
            if (interior && ty === floorTop) { fr('#6b5040', x, y, T, 2); fr('#8a6a50', x + (hv % 6), y, 2, 1); }
            if (isCeil && ty === ceil[tx] && interior) { fr('#2a1d16', x, y + 6, T, 2); if (hv % 2) fr('#3b2a22', x + (hv % 5) + 1, y + 8, 2, 3 + (hv % 4)); }
          }
        }
      }
      function drawPipe(p, ox, oy) {
        const x = p.tx * T - ox, y = p.topY - oy, h = (p.base - p.top) * T;
        if (x < -18 || x > VW + 2) return;
        const disco = p.area === 'disco';
        const C = disco ? ['#1a1030', '#6a4aa8', '#4a3080', '#9a7ad8', '#c0b0e8', '#ffffff', '#0a0614', '#ff3fa4']
                        : ['#2a180c', '#6b4330', '#553420', '#8a5a3a', '#8a5a34', '#b07a4a', '#140a05', '#6fae4f'];
        fr(C[0], x, y, 16, h);
        fr(C[1], x + 1, y + 4, 14, h - 4);
        for (let i = 4; i < 14; i += 3) fr(C[2], x + i, y + 6 + (i % 2) * 2, 1, h - 7 - (i % 2) * 2);
        fr(C[3], x + 2, y + 5, 1, h - 5);
        fr(C[0], x - 1, y, 18, 5);
        fr(C[4], x, y, 16, 4); fr(C[5], x, y, 16, 1);
        fr(C[6], x + 3, y + 1, 10, 2);
        fr(C[7], x, y, 3, 1); fr(C[7], x + 11, y, 5, 1); fr(C[7], x + 1, y + 3, 4, 1); fr(C[7], x + 13, y + 4, 2, 1);
        if (disco && Math.sin(now * 6 + p.tx) > 0.3) fr('#ffffff', x + 13, y + 1, 1, 1);
      }
      const CRATE = ['KKKKKKKK', 'KLlLLlLK', 'KLLrrLLK', 'KLrWrrLK', 'KLLccLLK', 'KlLccLlK', 'KLLLLLLK', 'KKKKKKKK'];
      const CRATE_PAL = { K: '#4a2c19', L: '#c08a4a', l: '#a0703a', r: '#d94c3d', W: '#fff6e8', c: '#f6e7c8' };
      const CRATE_USED = { K: '#3b2416', L: '#6b4a30', l: '#5b3e28', r: '#6b4a30', W: '#6b4a30', c: '#6b4a30' };
      const PILZ = ['..RRRR..', '.RRWWRR.', 'RWWRRRRR', 'RRRRRWWR', '.DDDDDD.', '..SEES..', '..SSSS..', '..SSSS..'];
      const PILZ_PAL = { R: '#d94c3d', W: '#fff6e8', D: '#8e2f22', S: '#f6e7c8', E: '#1d1d1d' };
      const BLUME = ['.g.gg.g.', 'gGGGGGGg', 'gGbBBbGg', '.GBBhBG.', 'gGbBBbGg', '.gGGGGg.', 'L..ss..L', '.LLssLL.'];
      const BLUME_PAL = { g: '#c8e86a', G: '#5d8a2a', b: '#5a2e12', B: '#a0602a', h: '#e0a060', s: '#3e7a3a', L: '#6fae4f' };
      const NUT = ['.bBb.', 'bBBhb', 'bBBBb', '.www.'];
      const NUT_PAL = { b: '#4a2814', B: '#8a4a22', h: '#d08850', w: '#e8d8b0' };
      const PROJ_SPR = {
        zapfen: [['.bBb.', 'bBbBb', 'BbBbB', 'bBbBb', '.bBb.'], { b: '#5b3a1a', B: '#a0703a' }],
        konfetti: [['...y.', '..s..', '.PPP.', 'PpPPP', 'PPPpP', '.PPP.'], { P: '#c8307a', p: '#ff9ad0', y: '#ffe23f', s: '#3a3a3a' }],
        wasser: [['.BB.', 'BbBB', 'BBBB', 'BBBB', '.BB.', '..w.'], { B: '#3a8ad9', b: '#bfe6ff', w: '#ffffff' }],
        disco: [['.sSs.', 'sWsSs', 'SsSsS', 'sSsWs', '.sSs.'], { s: '#7a8498', S: '#d8e0ee', W: '#ffffff' }]
      };
      function drawFoe(e, ox, oy) {
        const x = Math.round(e.x - 2 - ox), y = Math.round(e.feet - 16 - oy);
        if (x < -20 || x > VW + 20) return;
        const flip = e.face < 0;
        if (e.dead) {
          if (e.deadT <= 0) return;
          const k = 1 - e.deadT / 0.4;
          ctx.save(); ctx.translate(x + 6, e.feet - oy); ctx.scale(1 + 0.4 * k, Math.max(0.15, 1 - 0.85 * k));
          api.drawChar(ctx, e.who, 'idle', -6, -16, 1, flip); ctx.restore();
          return;
        }
        let frame = 'idle', sx = 0;
        if (e.kind === 'walk') frame = (Math.floor(now / 0.2) % 2) ? 'run1' : 'run2';
        else if (e.wind > 0) { frame = 'jump'; sx = Math.sin(now * 50) > 0 ? 1 : 0; }
        const fl = e.kind === 'throw' && e.look ? !flip : flip;
        api.drawChar(ctx, e.who, frame, x + sx, y, 1, fl);
        // grumpy eyebrows: these are the "enemy" versions of the friends
        fr('#1d1d1d', x + sx + 3, y + 2, 2, 1); fr('#1d1d1d', x + sx + 7, y + 2, 2, 1);
        if (e.kind === 'throw') {
          if (e.wind > 0) {
            const [rows, pal] = PROJ_SPR[PROJ_OF[e.who]];
            api.drawPixels(ctx, rows, pal, x + sx + 4, y - 7 + (Math.sin(now * 20) > 0 ? 0 : 1), 1);
            if (Math.sin(now * 16) > -0.2) { fr('#d94c3d', x + 11, y - 10, 2, 5); fr('#d94c3d', x + 11, y - 4, 2, 2); }
          } else if (e.look) api.text(ctx, '?', x + 6, y - 10, 8, '#f6e7c8', 'center');
        }
      }
      // disco ball (adapted from js/disco.js, smaller)
      const BR = 11, BD = BR * 2 + 1;
      const ballC = document.createElement('canvas'); ballC.width = BD; ballC.height = BD;
      const ballG = ballC.getContext('2d'), ballImg = ballG.createImageData(BD, BD);
      const ballPx = [];
      for (let y = 0; y < BD; y++) for (let x = 0; x < BD; x++) {
        const nx = (x - BR) / BR, ny = (y - BR) / BR, d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(1 - d), lat = Math.asin(ny), lon = Math.atan2(nx, nz);
        ballPx.push({ i: (y * BD + x) * 4, latf: (lat / Math.PI + 0.5) * 7, lon, cosl: Math.cos(lat), light: 0.35 + 0.65 * Math.max(0, -nx * 0.45 - ny * 0.55 + nz * 0.7), edge: d > 0.8 });
      }
      const LRGB = LIGHTS.map(c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
      const bhash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
      function renderBall(rot, beat) {
        const d = ballImg.data, tint = LRGB[Math.floor(beat) % LRGB.length];
        for (const p of ballPx) {
          const fi = Math.floor(p.latf), frc = p.latf - fi;
          const ncols = Math.max(4, Math.round(14 * p.cosl * 0.5) * 2);
          const lf = ((p.lon + rot) / (Math.PI * 2)) * ncols, fj = Math.floor(lf), fc = lf - fj;
          const jj = ((fj % ncols) + ncols) % ncols;
          const grout = frc < 0.14 || fc < 0.14 / Math.max(0.3, p.cosl);
          const h = bhash(fi, jj);
          let v = (0.45 + h * 0.55) * p.light * 255, r = v, g = v, b = v * 1.06;
          if (h > 0.7) { r = r * 0.5 + tint[0] * 0.5 * p.light; g = g * 0.5 + tint[1] * 0.5 * p.light; b = b * 0.5 + tint[2] * 0.5 * p.light; }
          if (((h * 97 + beat * 0.5) % 1) < 0.05) r = g = b = 255;
          if (grout) { r *= 0.35; g *= 0.35; b *= 0.4; }
          if (p.edge) { r *= 0.7; g *= 0.7; b *= 0.8; }
          d[p.i] = Math.min(255, r); d[p.i + 1] = Math.min(255, g); d[p.i + 2] = Math.min(255, b); d[p.i + 3] = 255;
        }
        ballG.putImageData(ballImg, 0, 0);
      }
      const DOTS = [];
      for (let i = 0; i < 34; i++) DOTS.push({ a: rnd(), y: rnd(), sp: 0.7 + rnd() * 0.6, c: rnd() < 0.55 ? -1 : (rnd() * LIGHTS.length | 0), s: rnd() < 0.25 ? 2 : 1 });
      const BALL_X = (ROOM_B0 + 13) * T, BALL_Y = (ROOM_CEIL + 4) * T;
      function drawRoomBG(ox, oy) {
        if (area === 'cave') {
          fr('#140d09', 0, 0, VW, VH);
          for (let i = 0; i < VW; i += 4) { const wx = Math.floor((i + ox * 0.5) / 4); const hh = 10 + hash(wx, 5) % 30; fr('#1f1510', i, VH - 40 - hh - (oy - ROOM_CAMY), 4, hh + 60); }
          // glowing mushrooms on the cave walls
          for (let tx = ROOM_A0; tx < ROOM_A1; tx += 3) {
            if (hash(tx, 9) % 2) continue;
            const x = tx * T - ox + 2, y = ROOM_FLOOR * T - oy - 3;
            ctx.globalAlpha = 0.25 + 0.15 * Math.sin(now * 2 + tx); fr('#7cffb0', x - 2, y - 3, 7, 5); ctx.globalAlpha = 1;
            fr('#d0fff0', x, y - 2, 3, 1); fr('#7cffb0', x - 1, y - 1, 5, 1); fr('#c9c2b8', x + 1, y, 1, 3);
          }
          return;
        }
        // disco
        const beat = beatNowV, bi = Math.floor(beat), pulse = Math.pow(1 - (beat - bi), 2);
        for (let y = 0; y < VH; y += 4) { const k = y / VH; fr(`rgb(${20 + k * 18 | 0},${8 + k * 6 | 0},${36 + k * 22 | 0})`, 0, y, VW, 4); }
        ctx.globalAlpha = 0.04 + pulse * 0.06; fr(LIGHTS[bi % LIGHTS.length], 0, 0, VW, VH); ctx.globalAlpha = 1;
        const bx = BALL_X - ox, by = BALL_Y - oy;
        // light beams from the ball
        for (let k = 0; k < 3; k++) {
          const ang = Math.PI / 2 + Math.sin(now * 0.9 + k * 2.1) * 0.9;
          ctx.globalAlpha = 0.07 + 0.05 * pulse; ctx.fillStyle = LIGHTS[(bi + k * 2) % LIGHTS.length];
          ctx.beginPath(); ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ang - 0.13) * 260, by + Math.sin(ang - 0.13) * 260); ctx.lineTo(bx + Math.cos(ang + 0.13) * 260, by + Math.sin(ang + 0.13) * 260);
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // reflection dots
        const floorY = ROOM_FLOOR * T - oy, ceilY = (ROOM_CEIL + 1) * T - oy;
        for (const d of DOTS) {
          const x = (((d.a + now * 0.06 * d.sp) % 1) + 1) % 1 * VW, y = ceilY + d.y * (floorY - ceilY - 2);
          fr(d.c < 0 ? '#ffffff' : LIGHTS[d.c], Math.round(x), Math.round(y), d.s, d.s);
        }
        // speakers
        for (const sx of [ROOM_B0 * T, (ROOM_B1 - 1) * T - 6]) {
          const x = sx - ox, y = floorY - 34;
          fr('#0a0610', x, y, 14, 34); fr('#2a2a2a', x + 1, y + 1, 12, 32);
          const pr = 3 + Math.round(pulse * 2);
          fr('#111', x + 7 - pr, y + 22 - pr, pr * 2, pr * 2); fr('#555', x + 6, y + 21, 2, 2);
          fr('#111', x + 5, y + 5, 4, 4);
        }
        // chain + ball
        fr('#8a8a9a', bx, ceilY, 1, by - BR - ceilY);
        renderBall(now * 1.6, beat);
        ctx.drawImage(ballC, Math.round(bx - BR), Math.round(by - BR));
      }
      function drawPlat(p, ox, oy) {
        const x = Math.round(p.x - ox), y = Math.round(p.y - oy);
        if (x > VW || x + p.w < 0) return;
        if (p.kind === 'my') {
          fr('#3b2416', x, y, p.w, 5); fr('#8a5a34', x + 1, y, p.w - 2, 3); fr('#b07a44', x + 1, y, p.w - 2, 1);
          fr('#3b2416', x + 4, y + 5, 2, 3); fr('#3b2416', x + p.w - 6, y + 5, 2, 3);
          // ropes up
          fr('#c9b79a', x + 3, Math.max(0, y - 200), 1, Math.min(200, y)); fr('#c9b79a', x + p.w - 4, Math.max(0, y - 200), 1, Math.min(200, y));
        } else if (p.x > ROOM_A1 * T) {
          const c = LIGHTS[(Math.floor(beatNowV) + (p.x >> 3)) % LIGHTS.length];
          fr('#0a0610', x, y, p.w, 5); fr(c, x + 1, y, p.w - 2, 2); fr('#3a2460', x + 1, y + 2, p.w - 2, 2);
        } else {
          fr('#3b2416', x, y, p.w, 5); fr('#9a6a3a', x + 1, y, p.w - 2, 3); fr('#c08a4a', x + 1, y, p.w - 2, 1);
          for (let i = 7; i < p.w; i += 8) fr('#3b2416', x + i, y, 1, 4);
        }
      }
      const CANDLE_A = ['..y..', '.yoy.', '..o..', '.WWW.', '.WRW.', '.WWW.', '.WRW.', '.wWw.'];
      const CANDLE_B = ['.y...', '..yy.', '.yo..', '.WWW.', '.WRW.', '.WWW.', '.WRW.', '.wWw.'];
      const CANDLE_PAL = { y: '#f5d442', o: '#f28a2b', W: '#f6e7c8', R: '#d94c3d', w: '#cdb99a' };
      const SNAIL = ['..OOOO......', '.OooooO.....', 'OoOOOooO..e.e', 'OoOooOoO..g.g', 'OooOOooO.ggg.',
        '.OOOOOO.gggg.', 'gggggggggggg.', '.ggggggggggg.'];
      const SNAIL_PAL = { O: '#6b3a1a', o: '#d9822b', g: '#c9c27a', e: '#1d1d1d' };
      const SNAIL_SHELL = { O: '#6b3a1a', o: '#d9822b' };
      const SNAIL_L = SNAIL.map(r => r.split('').reverse().join(''));
      const ARROW_U = ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', '..XXX..', '..XXX..', '..XXX..'];
      const ARROW_L = ['...X...', '..XX...', '.XXXXXX', 'XXXXXXX', '.XXXXXX', '..XX...', '...X...'];
      const ARROW_R = ARROW_L.map(r => r.split('').reverse().join(''));
      const ARROW_D = ARROW_U.slice().reverse();

      function bubble(cx, bottomY, lines, arrows) {
        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        let w = 0; lines.forEach(l => { w = Math.max(w, ctx.measureText(l.replace('⬆', ' ').replace('⬇', ' ')).width); });
        ctx.restore();
        w = Math.ceil(w) + 8;
        const lh = 10, hh = lines.length * lh + 4 + (arrows ? 12 : 0);
        const bx = Math.round(Math.min(VW - 3 - w, Math.max(3, cx - w / 2)));
        let by = Math.round(bottomY - hh - 5); if (by < 15) by = 15;
        fr('#1d1d1d', bx - 1, by - 1, w + 2, hh + 2);
        fr('#fffaf0', bx, by, w, hh);
        const tx = Math.round(Math.min(bx + w - 7, Math.max(bx + 3, cx - 2)));
        if (by + hh + 4 <= bottomY + 2) {
          fr('#1d1d1d', tx - 1, by + hh, 6, 2); fr('#fffaf0', tx, by + hh - 1, 4, 2);
          fr('#1d1d1d', tx, by + hh + 2, 4, 2); fr('#fffaf0', tx + 1, by + hh + 1, 2, 2);
        }
        lines.forEach((l, i) => {
          // '⬆' is drawn as the jump button's pixel arrow (the pixel font has no glyph for it)
          const ku = l.indexOf('⬆'), kdn = l.indexOf('⬇'), k = ku >= 0 ? ku : kdn, ly = by + 3 + i * lh;
          api.text(ctx, k < 0 ? l : l.replace('⬆', ' ').replace('⬇', ' '), bx + 4, ly, 8, '#2a1a10', 'left', false);
          if (k >= 0) api.drawPixels(ctx, ku >= 0 ? ARROW_U : ARROW_D, { X: '#d94c3d' }, bx + 4 + k * 8, ly, 1);
        });
        if (arrows && Math.sin(now * 12) > -0.3) {
          const ay = by + 3 + lines.length * lh;
          api.drawPixels(ctx, ARROW_U, { X: '#d94c3d' }, bx + w / 2 - 9 | 0, ay, 1);
          api.drawPixels(ctx, ARROW_U, { X: '#d94c3d' }, bx + w / 2 + 2 | 0, ay, 1);
        }
      }

      const TROLL_DJ = { lines: ['Hallo Eva!', 'Zu weit?', "Probier's mit", 'Doppelsprung!'], arrows: true };
      const TROLL_HM = { lines: ['Hm. Komisch.', "Bei mir ging's."] };
      const TROLL_ANDERS = { lines: ['Vielleicht...', 'anders', 'drücken? 🤔'] };
      const TROLL_FRAG = { lines: ['Frag doch mal', 'Laurenz,', 'Enrico, Hannah', 'oder mich 😏'] };
      function magnusTroll() {
        if (chasmFails === 0) return TROLL_DJ;
        if (chasmFails <= 2) return TROLL_HM;
        if (chasmFails <= 4) return TROLL_ANDERS;
        return [TROLL_FRAG, TROLL_DJ, TROLL_FRAG, TROLL_HM, TROLL_FRAG, TROLL_ANDERS][(chasmFails - 5) % 6];
      }
      function npcLines(n) {
        const dx = Math.abs(pl.x - n.x);
        if (n.who === 'laurenz') {
          // Teaches the double jump at the small gap; gone once she has passed him or is in the air.
          if (dx >= 100 || pl.x > n.x + 20 || (!pl.ground && pl.x > n.x)) return null;
          return { lines: ['2x Hoch =', 'Doppelsprung!'], arrows: true };
        }
        // Magnus: never cover the chasm while she is jumping across it
        if (crossed) return dx < 200 ? { lines: ['WAS?!', 'Wie hast du', '...?!'] } : null;
        if (pl.x > n.x + 14 || (!pl.ground && pl.x > n.x - 8)) return null;
        if (dx > 120) return null;
        return magnusTroll();
      }

      const SIGN_X = (SHAFTS[0][0] - 2) * T, SIGN_FEET = surf[SHAFTS[0][0] - 2] * T;
      const WALL_HINT = ['An die Wand', '+ ⬆ = Walljump!'];
      const PSIGN_X = POUND_SIGN_TX * T, PSIGN_FEET = surf[POUND_SIGN_TX] * T;
      const POUND_HINT = ['In der Luft ⬇', '= STAMPFER!'];
      function drawHint(ox, oy) {
        if (!poundLearned && !won && area === 'main' && pl.ground && Math.abs(pl.x - PSIGN_X) < 64) bubble(PSIGN_X + 5 - ox, PSIGN_FEET - 18 - oy, POUND_HINT);
        if (wallLearned || won) return;
        const s = shaftAt();
        if (s) bubble((s.a + s.b) / 2 * T - ox, s.rimY - 2 - oy, WALL_HINT);
        else if (pl.ground && Math.abs(pl.x - SIGN_X) < 56) bubble(SIGN_X + 5 - ox, SIGN_FEET - 18 - oy, WALL_HINT);
      }
      function drawButton(b, label, pressed, glow, sc, dim) {
        const y = b.y + (pressed ? 2 : 0);
        fr('#000000', b.x - 1, b.y - 1, b.w + 2, b.h + 4);
        if (glow) fr('#f5d442', b.x - 2, b.y - 2, b.w + 4, b.h + 6);
        fr('#000000', b.x - 1, y - 1, b.w + 2, b.h + 2);
        fr(pressed ? '#c9853f' : dim ? '#5e4430' : '#8a5a34', b.x, y, b.w, b.h);
        fr(pressed ? '#e0a060' : dim ? '#6e5240' : '#a8744a', b.x, y, b.w, 3);
        fr('#5b3a24', b.x, y + b.h - 4, b.w, 4);
        const lc = dim ? '#9a8a74' : '#f6e7c8';
        if (typeof label === 'string') api.text(ctx, label, b.x + b.w / 2 + 1, y + ((b.h - 4) >> 1) - 4, 8, lc, 'center');
        else { const s = sc || 3, lw = label[0].length * s, lh = label.length * s; api.drawPixels(ctx, label, { X: lc }, Math.round(b.x + (b.w - lw) / 2), Math.round(y + (b.h - 4 - lh) / 2), s); }
      }
      const BTN_L = { x: 4, y: 258, w: 38, h: 54 }, BTN_R = { x: 54, y: 258, w: 38, h: 54 }, BTN_U = { x: 138, y: 258, w: 38, h: 54 };
      const BTN_W = { x: 97, y: 258, w: 35, h: 24 }, BTN_D = { x: 97, y: 287, w: 35, h: 25 };
      const aura = document.createElement('canvas'); aura.width = 14; aura.height = 18;
      const ag = aura.getContext('2d');
      function drawEva(frame, px, py, flip) {
        if (power > 0) {
          ag.globalCompositeOperation = 'source-over'; ag.clearRect(0, 0, 14, 18);
          api.drawChar(ag, 'eva', frame, 1, 1, 1, flip);
          ag.globalCompositeOperation = 'source-in'; ag.fillStyle = power > 1 ? '#ff9a3a' : '#f5d442'; ag.fillRect(0, 0, 14, 18);
          ag.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now * 8);
          ctx.drawImage(aura, px - 2, py - 1); ctx.drawImage(aura, px, py - 1); ctx.drawImage(aura, px - 1, py - 2); ctx.drawImage(aura, px - 1, py);
          ctx.globalAlpha = 1;
        }
        api.drawChar(ctx, 'eva', frame, px, py, 1, flip);
        if (power > 1) api.drawPixels(ctx, NUT, NUT_PAL, flip ? px + 7 : px, py + 8, 1); // chestnut pouch on the backpack
      }

      function render() {
        const sh = shake > 0 ? Math.ceil(shake * 6) : 0;
        const ox = Math.round(camX) + (sh ? Math.round((Math.random() - 0.5) * sh) : 0), oy = Math.round(camY) + (sh ? Math.round((Math.random() - 0.5) * sh) : 0);
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
        beatNowV = beatNow();
        if (area === 'main') { drawBG(ox, oy); for (const t of trees) drawTree(t, ox, oy); }
        else drawRoomBG(ox, oy);
        drawTiles(ox, oy);
        for (const p of pipes) drawPipe(p, ox, oy);
        for (const p of plats) drawPlat(p, ox, oy);
        // power-ups (drawn before the crates so they rise out of them)
        for (const it of items) {
          const x = Math.round(it.x - ox), y = Math.round(it.y - oy + (it.kind !== 'pilz' && it.rise <= 0 ? Math.sin(now * 4) : 0));
          if (x < -10 || x > VW + 10) continue;
          api.drawPixels(ctx, it.kind === 'pilz' ? PILZ : BLUME, it.kind === 'pilz' ? PILZ_PAL : BLUME_PAL, x, y, 1);
        }
        for (const b of blocks.values()) {
          const x = b.tx * T - ox, y = b.ty * T - oy - (b.bump > 0 ? Math.round(Math.sin((1 - b.bump / 0.18) * Math.PI) * 3) : 0);
          if (x < -10 || x > VW + 10) continue;
          api.drawPixels(ctx, CRATE, b.used ? CRATE_USED : CRATE_PAL, x, y, 1);
          if (!b.used && Math.sin(now * 3 + b.tx) > 0.85) fr('#ffffff', x + 6, y + 1, 1, 1);
        }

        // summit cross + gift
        const cx = (262 + SH) * T - ox, cb = 9 * T - oy;
        fr('#3b2416', cx + 4, cb - 27, 4, 27); fr('#6b4330', cx + 5, cb - 27, 2, 27);
        fr('#3b2416', cx - 1, cb - 22, 14, 4); fr('#6b4330', cx, cb - 21, 12, 2);
        fr('#f5c542', cx + 5, cb - 29, 2, 2);
        const gb = Math.round(Math.sin(now * 3) * 1.5);
        const gx = gift.x - ox, gy = gift.y - oy + gb;
        if (gx > -20 && gx < VW + 20) {
          fr('rgba(245,212,66,.25)', gx - 4, gy - 6, gift.w + 8, gift.h + 8);
          fr('#a83a2e', gx, gy + 4, 14, 8); fr('#d94c3d', gx, gy + 4, 13, 7);
          fr('#e8604f', gx - 1, gy + 2, 16, 3);
          fr('#f5c542', gx + 6, gy + 2, 2, 10);
          fr('#f5c542', gx + 2, gy - 1, 4, 3); fr('#f5c542', gx + 8, gy - 1, 4, 3); fr('#fbe7a6', gx + 6, gy, 2, 2);
          if (Math.sin(now * 5) > 0.6) { fr('#ffffff', gx + 15, gy - 3, 1, 3); fr('#ffffff', gx + 14, gy - 2, 3, 1); }
          if (Math.sin(now * 4 + 2) > 0.7) { fr('#ffffff', gx - 3, gy + 1, 1, 3); fr('#ffffff', gx - 4, gy + 2, 3, 1); }
        }

        // wooden signs: ground-pound hint near the start, wall-jump hint before the first shaft
        for (const [sxw, sfw] of [[PSIGN_X, PSIGN_FEET], [SIGN_X, SIGN_FEET]]) {
          const x = sxw - ox, y = sfw - oy;
          if (x > -16 && x < VW + 16) {
            fr('#3b2416', x + 4, y - 9, 2, 9);
            fr('#3b2416', x - 1, y - 17, 12, 9); fr('#9a6a3a', x, y - 16, 10, 7); fr('#c08a4a', x, y - 16, 10, 1);
            fr('#3b2416', x + 2, y - 14, 1, 4); fr('#3b2416', x + 3, y - 15, 1, 1); fr('#3b2416', x + 7, y - 14, 1, 4); fr('#3b2416', x + 6, y - 15, 1, 1);
          }
        }
        // checkpoints
        for (const c of checkpoints) {
          const x = c.x - ox, y = c.y - oy;
          if (x < -10 || x > VW + 10) continue;
          fr('#3b3b3b', x, y - 1, 4, 1); fr('#d9d9d9', x + 1, y - 16, 1, 15);
          const wv = c.active ? (Math.sin(now * 6 + c.x) > 0 ? 0 : 1) : 0;
          fr(c.active ? '#d94c3d' : '#7a7a7a', x + 2, y - 16 + wv, 6, 4);
          if (c.active) fr('#f5d442', x + 3, y - 15 + wv, 2, 1);
        }
        // candles
        const flick = Math.sin(now * 14) > 0;
        for (const c of candles) {
          if (c.got || (c.hid && !c.hid.broken)) continue;
          const x = Math.round(c.x - 2 - ox), y = Math.round(c.y - 4 - oy + Math.sin(now * 3 + c.x) * 1);
          if (x < -8 || x > VW + 8) continue;
          fr('rgba(245,212,66,.18)', x - 2, y - 2, 9, 6);
          api.drawPixels(ctx, flick ? CANDLE_A : CANDLE_B, CANDLE_PAL, x, y, 1);
        }
        // snails
        for (const s of snails) {
          const x = Math.round(s.x - ox), y = Math.round(s.y - oy);
          if (x < -14 || x > VW + 14) continue;
          if (s.shell > 0) {
            const shake = s.shell < 0.8 && Math.sin(now * 40) > 0 ? 1 : 0;
            api.drawPixels(ctx, s.dir > 0 ? SNAIL : SNAIL_L, SNAIL_SHELL, x + shake, y + 2, 1);
          } else api.drawPixels(ctx, s.dir > 0 ? SNAIL : SNAIL_L, SNAIL_PAL, x, y, 1);
        }
        // npcs
        for (const n of npcs) {
          const x = n.x - ox, y = n.feet - 16 - oy;
          if (x < -20 || x > VW + 20) continue;
          const happy = n.who === 'magnus' ? crossed : Math.abs(pl.x - n.x) < 85;
          const hop = happy && Math.sin(now * 8) > 0.5 ? -2 : 0;
          const faceLeft = pl.x + 4 < n.x + 6;
          api.drawChar(ctx, n.who, hop ? 'jump' : 'idle', Math.round(x), Math.round(y + hop), 1, faceLeft);
          // friendly helpers stand behind a little fence with a heart sign (not enemies!)
          const fx = Math.round(x) - 8, fb = n.feet - oy;
          for (let i = 0; i < 4; i++) fr('#e8dcc4', fx + i * 3, fb - 8, 1, 8);
          fr('#e8dcc4', fx - 1, fb - 6, 12, 1); fr('#e8dcc4', fx - 1, fb - 3, 12, 1);
          fr('#3b2416', fx + 1, fb - 15, 1, 7); fr('#9a6a3a', fx - 3, fb - 20, 9, 6);
          api.drawPixels(ctx, ['X.X', 'XXX', '.X.'], { X: '#d94c3d' }, fx, fb - 19, 1);
        }
        // the friends as enemies
        for (const e of foes) drawFoe(e, ox, oy);
        // Niklas dancing in the secret disco
        if (area === 'disco') {
          const bi = Math.floor(beatNowV), bf = beatNowV - bi;
          const nx = (ROOM_B0 + 19) * T - ox, ny = ROOM_FLOOR * T - 16 - oy - Math.round(Math.sin(Math.PI * bf) * (bi % 4 === 3 ? 8 : 3));
          api.drawChar(ctx, 'niklas', bi % 4 === 3 ? 'jump' : bi % 2 ? 'run1' : 'run2', Math.round(nx), ny, 1, (bi >> 1) % 2 === 1);
        }
        // player
        let frame = 'idle';
        if (warp) frame = 'idle';
        else if (!pl.ground) frame = 'jump';
        else if (Math.abs(pl.vx) > 10) frame = (Math.floor(pl.animT / 0.12) % 2) ? 'run1' : 'run2';
        else if (area === 'disco') frame = Math.floor(beatNowV) % 2 ? 'run1' : 'idle';
        let px = Math.round(pl.x - 2 - ox);
        const py = Math.round(pl.y + pl.h - 16 - oy);
        let hand = -1;
        if (pl.sliding && !warp) {
          // wall-slide pose: drawn snug against the wall (contact counts within WALL_TOL px) with a hand on it
          frame = 'idle';
          const ws = pl.wallSide;
          const wallX = ws > 0 ? Math.floor((pl.x + pl.w + WALL_TOL) / T) * T : (Math.floor((pl.x - WALL_TOL) / T) + 1) * T;
          px += Math.round(ws > 0 ? wallX - (pl.x + pl.w) : wallX - pl.x);
          hand = ws > 0 ? px + 9 : px + 1;
        }
        if (warp) {
          const wp = warp.phase === 'down' ? warp.from : warp.to;
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, wp.topY - oy); ctx.clip();
          drawEva(frame, px, py, pl.face < 0);
          ctx.restore();
        } else if (!(pl.inv > 0 && Math.floor(pl.inv * 16) % 2)) {
          if (pound && pound.phase === 'hang') {
            // little tuck & spin before the slam
            ctx.save(); ctx.translate(px + 6, py + 8); ctx.rotate(Math.min(1, pound.t / POUND_HANG) * Math.PI * 2 * pl.face);
            drawEva('jump', -6, -8, pl.face < 0); ctx.restore();
          } else drawEva(frame, px, py, pl.sliding ? pl.wallSide > 0 : pl.face < 0);
          if (pound && pound.phase === 'slam') { ctx.globalAlpha = 0.7; fr('#ffffff', px + 2, py - 9, 1, 7); fr('#ffffff', px + 9, py - 7, 1, 6); fr('#ffffff', px + 5, py - 12, 1, 5); ctx.globalAlpha = 1; }
          if (hand >= 0) { fr('#5a3a22', hand, py + 4, 2, 3); fr('#f0c8a0', hand, py + 4, 2, 2); }
        }
        // projectiles & chestnuts
        for (const q of projs) {
          const [rows, pal] = PROJ_SPR[q.kind];
          let pp = pal;
          if (q.kind === 'disco' && Math.sin(now * 20) > 0) pp = { s: pal.S, S: pal.s, W: pal.W };
          if (q.kind === 'konfetti') pp = Object.assign({}, pal, { y: Math.sin(now * 30) > 0 ? '#ffe23f' : '#ff8a2a' });
          api.drawPixels(ctx, rows, pp, Math.round(q.x - 2 - ox), Math.round(q.y - 2 - oy), 1);
        }
        for (const n of nuts) api.drawPixels(ctx, NUT, NUT_PAL, Math.round(n.x - 2 - ox), Math.round(n.y - 2 - oy), 1);
        // particles
        for (const p of parts) {
          const a = p.life / p.max;
          ctx.globalAlpha = Math.min(1, a * 1.5);
          fr(p.c, Math.round(p.x - ox), Math.round(p.y - oy), a > 0.5 ? 2 : 1, a > 0.5 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
        // falling leaves / snow (screen space)
        const mid = ox + VW / 2;
        const forest = Math.max(0, Math.min(1, (172 * T - mid) / 240));
        const snow = Math.max(0, Math.min(1, (mid - CHASM_B * T) / 160));
        if (area === 'main') leaves.forEach((l, i) => {
          if (i < leaves.length * forest) fr(l.c, Math.round(l.x), Math.round(l.y), 2 + (Math.sin(now * 3 + l.ph) > 0 ? 1 : 0), 2);
          else if (i < leaves.length * snow) fr('#ffffff', Math.round(l.x), Math.round(l.y), 1, 1);
        });
        // speech bubbles
        for (const n of npcs) {
          const b = npcLines(n);
          if (b) bubble(n.x + 6 - ox, n.feet - 18 - oy, b.lines, b.arrows);
        }
        drawHint(ox, oy);
        if (area === 'disco' && Math.abs(pl.x - (ROOM_B0 + 19) * T) < 56 && !warp) bubble((ROOM_B0 + 19) * T + 6 - ox, ROOM_FLOOR * T - 20 - oy, ['Eva!', 'Tanz mit! 💃']);
        for (const p of pipes) {
          if (!p.to || p.area !== area || warp) continue;
          const d = Math.abs(pl.x + 4 - (p.tx * T + 8));
          if (d > 44) continue;
          const on = pipeUnder() === p;
          const ay = p.topY - oy - (on ? 27 : 12) + Math.round(Math.sin(now * 6) * 2);
          if (on || Math.sin(now * 5) > -0.4) api.drawPixels(ctx, ARROW_D, { X: on ? '#f5d442' : '#e8dcc4' }, p.tx * T + 5 - ox, ay, 1);
        }
        // ground-pound shockwave: two expanding pixel arcs hugging the floor
        for (const w of waves) {
          const k = w.t / 0.35, r = 6 + k * 34;
          ctx.globalAlpha = 1 - k;
          for (let a = 0; a <= 12; a++) {
            const ang = a / 12 * Math.PI, dx = Math.cos(ang) * r, dy = Math.sin(ang) * r * 0.32;
            fr(a % 2 ? '#fff6e8' : '#f5d442', Math.round(w.x + dx - ox), Math.round(w.y - dy - oy), 2, 1);
          }
          fr('#fff6e8', Math.round(w.x - r - ox), Math.round(w.y - 1 - oy), Math.round(r * 2), 1);
          ctx.globalAlpha = 1;
        }
        for (const q of popups) {
          if (q.big) {
            const x = Math.max(60, Math.min(VW - 60, Math.round(q.x - ox)));
            api.text(ctx, q.s, x, Math.round(q.y - oy) - (q.life > 0.7 ? 3 : 0), 16, q.life % 0.16 < 0.08 ? '#f5d442' : '#ff9a3a', 'center');
          } else api.text(ctx, q.s, Math.round(q.x - ox), Math.round(q.y - oy), 8, '#ffffff', 'center');
        }
        // HUD
        fr('rgba(13,21,17,.55)', 0, 0, VW, 13);
        api.drawPixels(ctx, CANDLE_A, CANDLE_PAL, 3, 3, 1);
        api.text(ctx, 'Kerzen ' + candlesGot + '/' + candles.length, 11, 3, 8, candlesGot === candles.length ? '#f5d442' : '#f6e7c8');
        if (power > 0) api.drawPixels(ctx, power > 1 ? BLUME : PILZ, power > 1 ? BLUME_PAL : PILZ_PAL, 116, 3, 1);
        if (area === 'main') {
          const bx0 = 128, bw = 44, prog = Math.max(0, Math.min(1, pl.x / (GIFT_TX * T)));
          fr('#000', bx0 - 1, 4, bw + 2, 6); fr('#3b2416', bx0, 5, bw, 4); fr('#6fae4f', bx0, 5, Math.round(bw * prog), 4);
          fr('#f5c542', bx0 + bw - 1, 2, 3, 3); fr('#d94c3d', bx0 + bw - 1, 3, 3, 1);
        } else api.text(ctx, area === 'disco' ? 'DISCO' : 'HÖHLE', 174, 3, 8, area === 'disco' ? LIGHTS[Math.floor(beatNowV) % LIGHTS.length] : '#c9b79a', 'right');
        if (won) {
          const t = Math.min(1, winT * 3);
          api.text(ctx, 'GIPFEL!', VW / 2, 40 - (1 - t) * 20, 16, '#f5d442', 'center');
        }
        if (flash > 0) { ctx.globalAlpha = Math.min(0.7, flash * 2); fr('#ffffff', 0, 0, VW, VH); ctx.globalAlpha = 1; }
        ctx.restore();

        // controls strip
        fr('#21160e', 0, VH, VW, CH - VH);
        fr('#5b3a24', 0, VH, VW, 2); fr('#3b2416', 0, VH + 2, VW, 1);
        drawButton(BTN_L, ARROW_L, inL(), false);
        drawButton(BTN_R, ARROW_R, inR(), false);
        drawButton(BTN_U, ARROW_U, inU(), false);
        drawButton(BTN_W, 'WURF', inW(), false, 0, power < 2);
        drawButton(BTN_D, ARROW_D, inD(), !warp && !!pipeUnder() && Math.sin(now * 8) > 0, 2, false);
      }

      /* ---------------- Loop ---------------- */
      const stop = api.loop(dt => {
        const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
        for (let i = 0; i < n; i++) step(h);
        logic(dt);
        // leaves
        for (const l of leaves) {
          l.y += l.s * dt; l.x += (Math.sin(now * 2 + l.ph) * 12 - 5) * dt;
          if (l.y > VH) { l.y = -3; l.x = Math.random() * VW; }
          if (l.x < -3) l.x = VW; if (l.x > VW + 3) l.x = 0;
        }
        camera(dt, false);
        render();
      });


      return function cleanup() {
        stop();
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
        window.removeEventListener('blur', blur);
        window.removeEventListener('pointerup', pUp);
        window.removeEventListener('pointercancel', pUp);
        root.removeEventListener('pointerdown', pDown);
        root.removeEventListener('pointermove', pMove);
        root.removeEventListener('contextmenu', noCtx);
        root.style.touchAction = prevTouch;
        cv.destroy();
      };
    }
  };
})();

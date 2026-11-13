/* "Verpflegungsstation" – Eva läuft den Halbmarathon und schnappt sich im Vorbeilaufen Wasser, Bananen & Gels
   von ihren Freunden. Sprudel und Laurenz' Bier lieber stehen lassen, über Bananenschalen springen. */
(function () {
  'use strict';

  const W = 180, H = 320;
  const EX = 40;                       // Eva screen x (left edge, sprite 24 px wide at scale 2)
  const LANE_Y = [194, 234];           // feet y per lane (0 = innen, an den Tischen)
  const ZONE = [EX + 4, EX + 36];      // reach zone (item center screen x)
  const SPEEDS = [80, 92, 104];
  const LENS = [1800, 2100, 2400];
  const DRAIN = [8, 9, 10];
  const KM = [[0, 7], [7, 14], [14, 21.1]];
  const HELPERS = ['magnus', 'hannah', 'enrico', 'laurenz'];
  const SIGNS = ['LAUF EVA!', 'GO EVA!', 'EVA <3', 'ALLES GUTE', 'HOPP HOPP', 'DU ROCKST', 'BRAVO!'];
  const BTN = {
    jump: { x: 4, y: 252, w: 70, h: 31, label: 'SPRINGEN', col: '#3a6fb5', dark: '#244a7a' },
    lane: { x: 4, y: 287, w: 70, h: 30, label: 'SPUR', col: '#8a5bd9', dark: '#5a3a94' },
    grab: { x: 78, y: 252, w: 98, h: 65, label: 'GREIFEN', col: '#3e9a4a', dark: '#24602c' }
  };

  /* ---------- sprites ---------- */
  const SPR = {
    water: { rows: ['wwwwww', 'wbbbbw', 'wbBbbw', '.wbbw.', '.wbbw.', '.wwww.'], pal: { w: '#e8f4ff', b: '#3d9be0', B: '#9fd4ff' } },
    sprudel: { rows: ['..rr..', '..gg..', '.gGgg.', '.gwwg.', '.gwwg.', '.gGgg.', '.gggg.'], pal: { r: '#d94c3d', g: '#3fae6a', G: '#8fe0a8', w: '#f6f6f6' } },
    beer: { rows: ['.ffff..', 'ffffff.', 'aaaaaah', 'aAaaa.h', 'aAaaaah', 'aaaaa..', 'aaaaa..'], pal: { f: '#fff6dc', a: '#e0a020', A: '#f5d070', h: '#e8e0c8' } },
    banana: { rows: ['....kk', '...YY.', '..YYy.', '.YYYy.', 'YYYy..', '.yy...'], pal: { k: '#5b3a24', Y: '#f5d442', y: '#d9a92b' } },
    gel: { rows: ['.oo.', 'oooo', 'owwo', 'oGGo', 'oooo', 'oooo', '.oo.'], pal: { o: '#e8692b', w: '#fff', G: '#f5d442' } },
    peel: { rows: ['...yy...', '..yYYy..', '.yY..Yy.', 'yY....Yy'], pal: { y: '#b88a1f', Y: '#f5d442' } },
    cup: { rows: ['wwww', '.ww.'], pal: { w: '#dfe8ee' } },
    medal: { rows: ['r......r', '.r....r.', '..r..r..', '...rr...', '..gggg..', '.gGgggg.', '.gGgggg.', '.gggggg.', '..gggg..'], pal: { r: '#d94c3d', g: '#d9a52b', G: '#ffe680' } },
    check: { rows: ['.....g', '....gg', 'g..gg.', 'gggg..', '.gg...'], pal: { g: '#5fd35f' } },
    cross: { rows: ['r...r', '.r.r.', '..r..', '.r.r.', 'r...r'], pal: { r: '#ff5a4a' } }
  };
  const RUNNER_HEAD = ['............', '....HHHH....', '...HHHHHH...', '...HSSSSS...', '...SESSES...', '...SSSSSS...', '....SSSS....'];
  const RUNNER_BODY = ['..TTTTTTT...', '..TWWWWTTS..', '..TWNNWTT...', '..STTTTT....', '...DDDDDD...'];
  const RUNNER_LEGS = [['...SS..SS...', '..SS....SS..', '..SS....SS..', '..KK....KK..'], ['....SSSS....', '....SS.SS...', '....SS.SS...', '....KK.KK...']];
  const RUNNER_COLS = [
    { H: '#2a1a10', S: '#e8b48a', T: '#e8692b', D: '#20262b' },
    { H: '#e8c870', S: '#f4cba8', T: '#4a7fd9', D: '#1e2420' },
    { H: '#111111', S: '#a8724a', T: '#d94c3d', D: '#333a44' },
    { H: '#7a4a2a', S: '#f2c39b', T: '#f5d442', D: '#2a3a6a' }
  ];

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const GOOD = { water: 1, banana: 1, gel: 1 };

  GAMES['run_water'] = {
    title: 'Verpflegung',
    intro: 'Halbmarathon! Schnapp dir im Vorbeilaufen Wasser, Bananen & Gels (GREIFEN, wenn es leuchtet). Kein Sprudel, kein Bier! Über Schalen SPRINGEN, Läufern per SPUR ausweichen.',
    start(root, api) {
      api.music('game');
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx, canvas = cv.canvas;

      /* ---------- state ---------- */
      let sec = 0, pos = 0, scroll = 0, T = 0;
      let state = 'run', stateT = 0;      // run | fail | banner | finish
      let meter = 90, laneT = 0, laneF = 0;
      let lift = 0, vy = 0, animT = 0;
      let boostT = 0, stumbleT = 0, wobbleT = 0, grabCd = 0, reachT = 0, blocked = false;
      let items = [], clusters = [], peels = [], runners = [], groundCups = [];
      let flying = [], parts = [], pops = [];
      let banner = null, legendT = 5, fails = 0, won = false, speed = 0;
      const press = { grab: 0, jump: 0, lane: 0 };

      function genSection(s) {
        const rnd = mulberry(4242 + s * 977);
        const len = LENS[s];
        items = []; clusters = []; peels = []; runners = [];
        let x = 300, ci = 0;
        while (x < len - 300) {
          const n = 4 + Math.floor(rnd() * 2) + (s > 0 ? 1 : 0);
          const sp = 52 - s * 3;
          const x0 = x, types = [];
          for (let i = 0; i < n; i++) {
            const r = rnd();
            types.push(r < 0.38 ? 'water' : r < 0.54 ? 'banana' : r < 0.64 ? 'gel' : r < 0.83 ? 'sprudel' : 'beer');
          }
          if (s === 0 && ci === 0) { types[0] = 'water'; types[1] = 'sprudel'; }
          let good = types.filter(t => GOOD[t]).length;
          for (let i = n - 1; i >= 0 && good < 3; i--) if (!GOOD[types[i]]) { types[i] = 'water'; good++; }
          types.forEach((type, i) => {
            const helper = type === 'beer' ? 'laurenz' : HELPERS[(ci * 3 + i) % 4];
            items.push({ x: x0 + 20 + i * sp, type, helper, taken: false });
          });
          const x1 = x0 + 20 + (n - 1) * sp + 26;
          clusters.push({ x0, x1 });
          if (s >= 1 && rnd() < 0.75) peels.push({ x: x0 + 20 + (1 + Math.floor(rnd() * (n - 2))) * sp + sp / 2 - 4, lane: 0, hit: false });
          const nx = x1 + 190 + rnd() * 70;
          const mid = x1 + (nx - x1) / 2;
          if (ci > 0 || s > 0) {
            if (rnd() < 0.5 + 0.15 * s) runners.push({ enc: mid - 20, lane: rnd() < 0.7 ? 0 : 1, active: false, x: 0, col: Math.floor(rnd() * 4), anim: rnd() * 10 });
            else peels.push({ x: mid, lane: rnd() < 0.6 ? 0 : 1, hit: false });
          } else peels.push({ x: mid, lane: 0, hit: false });
          if (s === 2 && rnd() < 0.6) peels.push({ x: mid + 70, lane: rnd() < 0.5 ? 0 : 1, hit: false });
          x = nx; ci++;
        }
      }

      function startSection(s, retry) {
        sec = s; pos = 0; state = 'run'; stateT = 0;
        meter = retry ? 85 : Math.max(meter, 75);
        boostT = stumbleT = wobbleT = grabCd = 0;
        flying = []; blocked = false;
        genSection(s);
        const a = String(KM[s][0]).replace('.', ','), b = String(KM[s][1]).replace('.', ',');
        banner = { l1: retry ? 'Nochmal!' : (s === 0 ? 'Los geht\'s!' : 'Schneller!'), l2: 'km ' + a + ' - ' + b, t: 0, dur: 2 };
        if (retry) legendT = 3.5;
      }

      function pop(txt, x, y, col) { pops.push({ txt, x, y, t: 0, col: col || '#fff' }); }
      function burst(x, y, n, cols, sp) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = (sp || 50) * (0.4 + Math.random());
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.4, t: 0, col: cols[i % cols.length] });
        }
      }

      /* ---------- actions ---------- */
      function zoneItem() {
        if (laneF > 0.3) return null;
        let best = null, bd = 1e9;
        const c = (ZONE[0] + ZONE[1]) / 2;
        for (const it of items) {
          if (it.taken) continue;
          const sx = it.x - pos;
          if (sx >= ZONE[0] && sx <= ZONE[1] && Math.abs(sx - c) < bd) { bd = Math.abs(sx - c); best = it; }
        }
        return best;
      }
      function doGrab() {
        press.grab = 0.15;
        if (state !== 'run' && state !== 'banner') return;
        if (grabCd > 0) return;
        if (laneF > 0.5) { pop('Zu weit!', EX + 12, LANE_Y[1] - 44, '#ccc'); grabCd = 0.3; return; }
        const it = zoneItem();
        reachT = 0.22;
        if (!it) { pop('Daneben', EX + 12, feetY() - 44, '#ccc'); api.sfx('click'); grabCd = 0.4; return; }
        it.taken = true;
        flying.push({ type: it.type, sx: it.x - pos, sy: 134, t: 0 });
        grabCd = 0.12;
      }
      function applyItem(type) {
        const ex = EX + 14, ey = feetY() - 26 - lift;
        if (type === 'water') { meter += 28; api.sfx('pour'); burst(ex, ey, 14, ['#3d9be0', '#9fd4ff', '#ffffff'], 60); pop('Schluck!', ex, ey - 16, '#9fd4ff'); }
        else if (type === 'banana') { meter += 24; api.sfx('coin'); burst(ex, ey, 10, ['#f5d442', '#fff6a0'], 50); pop('Mampf!', ex, ey - 16, '#f5d442'); }
        else if (type === 'gel') { meter += 10; boostT = 3; api.sfx('launch'); burst(ex, ey, 12, ['#e8692b', '#f5d442'], 70); pop('Turbo!', ex, ey - 16, '#ffa050'); }
        else if (type === 'sprudel') { meter -= 8; stumbleT = 1.3; grabCd = 0.9; api.sfx('hit'); burst(ex, ey, 16, ['#ffffff', '#cfefff'], 40); pop('Hicks!', ex, ey - 16, '#ff8a7a'); }
        else if (type === 'beer') { meter -= 12; wobbleT = 2.4; grabCd = 0.6; api.sfx('error'); burst(ex, ey, 12, ['#fff6dc', '#e0a020'], 40); pop('Prost?!', ex, ey - 16, '#ffd070'); }
        meter = Math.min(100, meter);
        if (GOOD[type]) groundCups.push({ gx: scroll + EX + 6, y: LANE_Y[0] - 4 + Math.random() * 40 });
      }
      function doJump() {
        press.jump = 0.15;
        if (state !== 'run' && state !== 'banner') return;
        if (lift <= 0.01) { vy = 150; lift = 0.02; api.sfx('jump'); }
      }
      function doLane() {
        press.lane = 0.15;
        if (state !== 'run' && state !== 'banner') return;
        laneT = laneT ? 0 : 1; api.sfx('step');
      }
      const feetY = () => LANE_Y[0] + laneF * (LANE_Y[1] - LANE_Y[0]);

      /* ---------- input ---------- */
      const downs = {};
      function hitBtn(p) {
        for (const k in BTN) { const b = BTN[k]; if (p.x >= b.x - 2 && p.x <= b.x + b.w + 2 && p.y >= b.y - 2 && p.y <= b.y + b.h + 2) return k; }
        return null;
      }
      function onDown(e) {
        e.preventDefault();
        const p = cv.pointer(e);
        const b = hitBtn(p);
        if (b === 'grab') doGrab(); else if (b === 'jump') doJump(); else if (b === 'lane') doLane();
        else if (p.y < 248) downs[e.pointerId] = { x: p.x, y: p.y };
      }
      function onUp(e) {
        const d = downs[e.pointerId]; if (!d) return;
        delete downs[e.pointerId];
        const p = cv.pointer(e), dy = p.y - d.y;
        if (dy < -18) doJump(); else if (dy > 18) doLane(); else doGrab();
      }
      function onKey(e) {
        const c = e.code;
        if (c === 'Space' || c === 'Enter' || c === 'KeyG') { e.preventDefault(); if (!e.repeat) doGrab(); }
        else if (c === 'ArrowUp' || c === 'KeyW') { e.preventDefault(); if (!e.repeat) doJump(); }
        else if (c === 'ArrowDown' || c === 'KeyS' || c === 'ShiftLeft' || c === 'ShiftRight') { e.preventDefault(); if (!e.repeat) doLane(); }
      }
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      const noTouch = e => e.preventDefault();
      root.addEventListener('touchstart', noTouch, { passive: false });
      root.addEventListener('contextmenu', noTouch);
      window.addEventListener('keydown', onKey);

      /* ---------- update ---------- */
      function update(dt) {
        T += dt; stateT += dt;
        for (const k in press) press[k] = Math.max(0, press[k] - dt);
        boostT = Math.max(0, boostT - dt); stumbleT = Math.max(0, stumbleT - dt); wobbleT = Math.max(0, wobbleT - dt);
        grabCd = Math.max(0, grabCd - dt); reachT = Math.max(0, reachT - dt); legendT = Math.max(0, legendT - dt);
        if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }

        // lane + jump physics
        laneF += clamp(laneT - laneF, -6 * dt, 6 * dt);
        if (lift > 0) { vy -= 520 * dt; lift += vy * dt; if (lift <= 0) { lift = 0; vy = 0; } }

        // speed
        let v = SPEEDS[sec];
        if (boostT > 0) v *= 1.6;
        if (stumbleT > 0) v *= 0.5;
        if (wobbleT > 0) v *= 0.7;
        if (state === 'fail') v = Math.max(18, 40 - stateT * 30);
        if (state === 'finish') v = Math.max(0, SPEEDS[2] * (1 - stateT / 1.1));

        // runners
        blocked = false;
        for (const r of runners) {
          if (!r.active) { if (pos >= r.enc - 250) { r.active = true; r.x = pos + W + 6; } else continue; }
          r.speed = SPEEDS[sec] * 0.5;
          r.x += r.speed * dt; r.anim += r.speed * dt;
          if (state !== 'run' && state !== 'banner') continue;
          const front = pos + EX + 20;
          if (Math.abs(laneF - r.lane) < 0.35 && front >= r.x + 2 && front <= r.x + 14) {
            blocked = true; v = Math.min(v, r.speed);
            if (front > r.x + 5) pos = r.x + 5 - EX - 20;
          }
        }
        speed = v;
        pos += v * dt; scroll += v * dt; animT += v * dt;

        // meter
        if (state === 'run') {
          meter -= DRAIN[sec] * dt;
          if (meter <= 0) { meter = 0; state = 'fail'; stateT = 0; fails++; api.sfx('lose'); pop('Puste weg...', EX + 12, feetY() - 46, '#ff8a7a'); }
        }

        // peels
        if (state === 'run' || state === 'banner') for (const p of peels) {
          if (p.hit) continue;
          const sx = p.x - pos;
          if (Math.abs(laneF - p.lane) < 0.4 && lift < 5 && sx < EX + 18 && sx + 14 > EX + 6) {
            p.hit = true; stumbleT = 1.1; meter -= 10; api.sfx('hit');
            pop('Rutsch!', EX + 12, feetY() - 44, '#f5d442');
            burst(EX + 14, feetY() - 4, 8, ['#f5d442', '#b88a1f'], 40);
          }
        }

        // flying items
        for (const f of flying) {
          f.t += dt;
          if (f.t >= 0.2 && !f.done) { f.done = true; applyItem(f.type); }
        }
        flying = flying.filter(f => !f.done);

        // particles & popups
        for (const p of parts) { p.t += dt; p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        parts = parts.filter(p => p.t < p.life);
        for (const p of pops) p.t += dt;
        pops = pops.filter(p => p.t < 1);
        groundCups = groundCups.filter(c => c.gx - scroll > -20);
        if (boostT > 0 && Math.random() < 0.5) parts.push({ x: EX - 2, y: feetY() - 8 - Math.random() * 22 - lift, vx: -90, vy: -160 * 0.016, life: 0.25, t: 0, col: '#fff', line: true });
        if (state === 'finish' && Math.random() < 0.6) parts.push({ x: Math.random() * W, y: 30, vx: (Math.random() - 0.5) * 30, vy: 20, life: 1.8, t: 0, col: ['#d94c3d', '#f5d442', '#4a7fd9', '#3fae6a', '#f2a7b8'][Math.floor(Math.random() * 5)] });

        // state transitions
        if (state === 'run' && pos >= LENS[sec]) {
          if (sec < 2) { state = 'banner'; stateT = 0; api.sfx('ding'); banner = { l1: 'km ' + KM[sec][1] + ' geschafft!', l2: 'Weiter so, Eva!', t: 0, dur: 1.8 }; }
          else { state = 'finish'; stateT = 0; api.sfx('ding'); }
        } else if (state === 'banner' && stateT > 1.8) startSection(sec + 1, false);
        else if (state === 'fail' && stateT > 1.7) startSection(sec, true);
        else if (state === 'finish' && stateT > 2.6 && !won) { won = true; api.win(); }
      }

      /* ---------- drawing ---------- */
      function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
      function sprite(name, x, y, s) { const sp = SPR[name]; api.drawPixels(ctx, sp.rows, sp.pal, Math.round(x), Math.round(y), s || 2); }
      function textW(str) { ctx.font = '8px "Press Start 2P", monospace'; return ctx.measureText(str).width; }

      function drawBackground() {
        // sky
        rect(0, 30, W, 40, '#9fd8ec'); rect(0, 70, W, 40, '#bfe4ee');
        // skyline (parallax 0.3)
        const off = scroll * 0.3;
        for (let j = Math.floor(off / 26) - 1; j < Math.floor(off / 26) + 9; j++) {
          const bx = j * 26 - off, hgt = 26 + Math.floor(hash(j) * 34), c = ['#7d8ea3', '#93a4b8', '#a88e7a', '#8a7d9a'][Math.floor(hash(j + 99) * 4)];
          rect(bx, 104 - hgt, 24, hgt, c);
          for (let wy = 104 - hgt + 4; wy < 98; wy += 7) for (let wx = 3; wx < 21; wx += 6) rect(bx + wx, wy, 3, 3, hash(j * 31 + wy + wx) < 0.3 ? '#f5e08a' : '#5d6a7a');
        }
        // autumn trees (parallax 0.55)
        const off2 = scroll * 0.55;
        for (let j = Math.floor(off2 / 46) - 1; j < Math.floor(off2 / 46) + 6; j++) {
          const tx = j * 46 - off2 + hash(j + 7) * 20;
          rect(tx + 7, 92, 4, 16, '#5b3a24');
          const c = hash(j + 3) < 0.5 ? '#d9822b' : '#f2b33d';
          rect(tx, 78, 18, 14, c); rect(tx + 3, 74, 12, 4, c); rect(tx + 2, 92, 14, 2, c);
          rect(tx + 3, 80, 3, 3, '#f5d070');
        }
        // crowd (parallax 0.85)
        const off3 = scroll * 0.85;
        for (let i = Math.floor(off3 / 13) - 1; i < Math.floor(off3 / 13) + 16; i++) {
          const cx = i * 13 - off3, hy = 94 + Math.floor(hash(i * 7) * 3);
          const bounce = Math.sin(T * 8 + i) > 0.6 ? -1 : 0;
          rect(cx + 2, hy + 6 + bounce, 9, 12, ['#d94c3d', '#4a7fd9', '#3fae6a', '#8a5bd9', '#f2b33d', '#e3bfae'][Math.floor(hash(i * 13) * 6)]);
          rect(cx + 3, hy + bounce, 7, 6, ['#f2c39b', '#e8b48a', '#a8724a', '#f4cba8'][Math.floor(hash(i * 5) * 4)]);
          rect(cx + 3, hy + bounce, 7, 2, ['#2a1a10', '#e8c870', '#7a4a2a', '#111', '#d98a3d'][Math.floor(hash(i * 3) * 5)]);
          if (((i % 9) + 9) % 9 === 4) {
            const s = SIGNS[Math.floor(hash(i * 17) * SIGNS.length)], tw = textW(s) + 6;
            const sy = 72 + (Math.sin(T * 5 + i) > 0 ? -1 : 0);
            rect(cx + 6, sy + 12, 2, 12, '#5b3a24');
            rect(cx + 7 - tw / 2 - 1, sy - 1, tw + 2, 14, '#1d1d1d');
            rect(cx + 7 - tw / 2, sy, tw, 12, '#f6e7c8');
            api.text(ctx, s, Math.round(cx + 7), sy + 2, 8, '#d94c3d', 'center', false);
          }
        }
        // barrier
        const off4 = scroll * 0.85;
        rect(0, 110, W, 6, '#f6f6f6');
        for (let x = -((off4) % 16); x < W; x += 16) rect(x, 110, 8, 6, '#d94c3d');
        rect(0, 116, W, 2, '#3b2416');
        // sidewalk behind tables
        rect(0, 118, W, 36, '#b8b0a4');
        for (let x = -(scroll % 20); x < W; x += 20) rect(x, 118, 1, 36, '#a39b8f');
        // road
        rect(0, 152, W, 4, '#d9d2c4');
        rect(0, 156, W, 90, '#575c63');
        for (let i = 0; i < 40; i++) { const gx = ((i * 37 + 11) * 7 % 400) - (scroll % 400); const x = gx < -4 ? gx + 400 : gx; rect(x, 160 + (i * 23) % 84, 2, 1, '#62676f'); }
        for (let x = -(scroll % 24); x < W; x += 24) rect(x, 217, 12, 2, '#e8e8e8');
        rect(0, 228, W, 1, '#4a7fd9');
        rect(0, 246, W, 4, '#9aa0a6');
      }

      function drawStations() {
        const zoneIt = state === 'run' || state === 'banner' ? zoneItem() : null;
        // helpers (behind tables)
        for (const it of items) {
          const sx = it.x - pos; if (sx < -30 || sx > W + 30) continue;
          const bob = Math.sin(T * 6 + it.x) > 0.3 ? -1 : 0;
          api.drawChar(ctx, it.helper, 'idle', Math.round(sx), 106 + bob, 2, true);
        }
        // tables
        for (const c of clusters) {
          const x0 = c.x0 - pos - 10, x1 = c.x1 - pos + 14;
          if (x1 < 0 || x0 > W) continue;
          rect(x0, 134, x1 - x0, 4, '#ffffff');
          rect(x0, 138, x1 - x0, 12, '#4a7fd9');
          for (let x = x0; x < x1; x += 8) rect(x, 138, 4, 12, '#5f92e6');
          rect(x0, 150, x1 - x0, 1, '#244a7a');
          rect(x0 + 2, 150, 2, 4, '#3b2416'); rect(x1 - 4, 150, 2, 4, '#3b2416');
          for (let x = x0 + 4; x < x1 - 4; x += 9) rect(x, 131, 3, 3, '#e8f4ff');
        }
        // reach zone marker on table edge
        const zc = zoneIt ? '#f5d442' : 'rgba(245,212,66,0.35)';
        if (laneF < 0.5 && (state === 'run' || state === 'banner')) {
          rect(ZONE[0], 152, 2, 4, zc); rect(ZONE[1], 152, 2, 4, zc); rect(ZONE[0], 155, ZONE[1] - ZONE[0] + 2, 1, zc);
        }
        // held items + arms
        for (const it of items) {
          if (it.taken) continue;
          const sx = it.x - pos; if (sx < -20 || sx > W + 20) continue;
          rect(sx + 1, 128, 6, 2, '#f2c39b');
          const sp = SPR[it.type], w = sp.rows[0].length * 2, h = sp.rows.length * 2;
          const ix = sx - w / 2, iy = 136 - h;
          if (it === zoneIt) {
            const pulse = Math.sin(T * 18) > 0 ? '#ffffff' : '#f5d442';
            rect(ix - 3, iy - 3, w + 6, 1, pulse); rect(ix - 3, iy + h + 2, w + 6, 1, pulse);
            rect(ix - 3, iy - 3, 1, h + 6, pulse); rect(ix + w + 2, iy - 3, 1, h + 6, pulse);
          }
          sprite(it.type, ix, iy, 2);
          if (it.type === 'sprudel') for (let k = 0; k < 3; k++) { const ph = (T * 1.5 + k / 3 + it.x * 0.01) % 1; rect(sx - 2 + k * 2, iy - 2 - ph * 8, 1, 1, '#ffffff'); }
        }
        // speech bubble for the next item ahead of Eva
        if (state === 'run' || state === 'banner') {
          const next = items.find(it => !it.taken && it.x - pos > ZONE[0] - 6);
          if (next) {
            const sx = next.x - pos;
            if (sx < W - 10) {
              const say = { water: 'Wasser!', banana: 'Banane!', gel: 'Gel!', sprudel: 'Sprudel!', beer: 'Prost!' }[next.type];
              const tw = textW(say) + 6;
              let bx = clamp(sx + 12 - tw / 2, 2, W - tw - 2);
              const by = 92;
              rect(bx - 1, by - 1, tw + 2, 13, '#1d1d1d'); rect(bx, by, tw, 11, '#ffffff');
              rect(sx + 10, by + 12, 3, 2, '#1d1d1d');
              api.text(ctx, say, Math.round(bx + tw / 2), by + 2, 8, GOOD[next.type] ? '#24602c' : '#b03020', 'center', false);
            }
          }
        }
        // arches: km sign / finish
        const ax = LENS[sec] - pos + EX + 12;
        if (ax > -30 && ax < W + 30) {
          rect(ax - 2, 120, 4, 128, '#8a8f86'); rect(ax + 48, 120, 4, 128, '#8a8f86');
          const lab = sec < 2 ? 'KM ' + KM[sec][1] : 'ZIEL';
          rect(ax - 4, 116, 60, 16, sec < 2 ? '#4a7fd9' : '#d94c3d');
          for (let x = 0; x < 60; x += 6) rect(ax - 4 + x, 132, 3, 2, '#f6f6f6');
          api.text(ctx, lab, ax + 26, 120, 8, '#fff', 'center');
          if (sec === 2) for (let x = 0; x < 52; x += 4) rect(ax + x, 244, 2, 2, ((x / 4) % 2) ? '#111' : '#fff');
        }
      }

      function drawRunner(r) {
        const sx = r.x - pos, fy = LANE_Y[r.lane];
        if (sx < -30 || sx > W + 30) return;
        const pal = Object.assign({ W: '#ffffff', N: '#1d1d1d', E: '#1d1d1d', K: '#e8e8e8' }, RUNNER_COLS[r.col]);
        const legs = RUNNER_LEGS[Math.floor(r.anim / 10) % 2];
        rect(sx + 4, fy - 1, 16, 2, 'rgba(0,0,0,0.25)');
        api.drawPixels(ctx, [].concat(RUNNER_HEAD, RUNNER_BODY, legs), pal, Math.round(sx), fy - 32, 2);
        if (blocked && Math.abs(laneF - r.lane) < 0.4 && Math.sin(T * 12) > 0) api.text(ctx, '!', sx + 12, fy - 44, 8, '#ff5a4a', 'center');
      }

      function drawEva() {
        const fy = feetY();
        let x = EX, y = fy - 32 - lift;
        if (wobbleT > 0) x += Math.round(Math.sin(T * 9) * 3);
        if (stumbleT > 0) y += (Math.sin(T * 30) > 0 ? 1 : 0);
        rect(EX + 4, fy - 1, 16, 2, 'rgba(0,0,0,0.25)');
        let frame;
        if (lift > 0) frame = 'jump';
        else if (state === 'finish' && speed < 5) frame = 'idle';
        else frame = Math.floor(animT / (state === 'fail' ? 7 : 13)) % 2 ? 'run1' : 'run2';
        api.drawChar(ctx, 'eva', frame, Math.round(x), Math.round(y), 2, false);
        if (reachT > 0) { rect(x + 18, y + 10, 3, 2, '#e3bfae'); rect(x + 20, y + 4, 2, 7, '#e3bfae'); rect(x + 20, y + 2, 3, 3, '#f2c39b'); }
        // race bib
        rect(x + 10, y + 18, 6, 4, '#ffffff'); rect(x + 12, y + 19, 2, 2, '#d94c3d');
        if (state === 'fail') { rect(x + 22, y + 4 + (T * 20) % 6, 1, 2, '#9fd4ff'); }
        if (wobbleT > 0) for (let k = 0; k < 3; k++) { const a = T * 5 + k * 2.1; rect(x + 12 + Math.cos(a) * 10, y - 4 + Math.sin(a) * 3, 2, 2, '#f5d442'); }
        if (state === 'finish' && stateT > 1) sprite('medal', x + 4, y + 10 - Math.max(0, (1.4 - stateT) * 40), 2);
        // flying items toward Eva's hand
        for (const f of flying) {
          const k = Math.min(1, f.t / 0.2), tx = x + 20, ty = y + 4;
          sprite(f.type, f.sx + (tx - f.sx) * k - 6, f.sy + (ty - f.sy) * k - 6 - Math.sin(k * Math.PI) * 10, 2);
        }
      }

      function drawWorld() {
        for (const c of groundCups) sprite('cup', c.gx - scroll, c.y, 2);
        for (const p of peels) {
          const sx = p.x - pos; if (sx < -20 || sx > W + 20) continue;
          if (p.hit) rect(sx, LANE_Y[p.lane] - 3, 14, 2, '#b88a1f');
          else sprite('peel', sx, LANE_Y[p.lane] - 8, 2);
        }
        // depth order: inner lane first, then outer lane (in front)
        const actors = runners.filter(r => r.active).map(r => ({ y: LANE_Y[r.lane], f: () => drawRunner(r) }));
        actors.push({ y: feetY() + 0.5, f: drawEva });
        actors.sort((a, b) => a.y - b.y).forEach(a => a.f());
      }

      function drawFx() {
        for (const p of parts) {
          if (p.line) rect(p.x - p.t * 90, p.y, 6, 1, 'rgba(255,255,255,0.8)');
          else rect(p.x, p.y, 2, 2, p.col);
        }
        for (const p of pops) {
          const a = p.t < 0.8 ? 1 : (1 - p.t) * 5;
          ctx.globalAlpha = a;
          api.text(ctx, p.txt, Math.round(p.x), Math.round(p.y - p.t * 18), 8, p.col, 'center');
          ctx.globalAlpha = 1;
        }
      }

      function drawHud() {
        rect(0, 0, W, 30, '#0d1511'); rect(0, 30, W, 1, '#000');
        api.text(ctx, 'ENERGIE', 4, 3, 8, '#f6e7c8');
        const low = meter < 25;
        rect(4, 13, 92, 9, '#000');
        rect(5, 14, 90, 7, '#2b3b31');
        const col = meter > 50 ? '#5fd35f' : meter > 25 ? '#f5d442' : '#ff5a4a';
        if (!low || Math.sin(T * 14) > -0.3) rect(5, 14, Math.round(90 * clamp(meter, 0, 100) / 100), 7, col);
        rect(5, 14, Math.round(90 * clamp(meter, 0, 100) / 100), 2, 'rgba(255,255,255,0.35)');
        // km
        const k = KM[sec][0] + (KM[sec][1] - KM[sec][0]) * clamp(pos / LENS[sec], 0, 1);
        api.text(ctx, 'km ' + k.toFixed(1).replace('.', ','), W - 4, 3, 8, '#f5c542', 'right');
        api.text(ctx, (sec + 1) + '/3', W - 4, 14, 8, '#8fd3e8', 'right');
        // progress strip
        rect(102, 25, 74, 3, '#2b3b31');
        rect(102, 25, Math.round(74 * k / 21.1), 3, '#f5c542');
        rect(102 + Math.round(74 * 7 / 21.1), 24, 1, 5, '#fff'); rect(102 + Math.round(74 * 14 / 21.1), 24, 1, 5, '#fff');
        if (low && state === 'run' && Math.sin(T * 8) > 0) api.text(ctx, 'DURST!', 50, 36, 8, '#ff5a4a', 'center');
      }

      function drawLegend() {
        if (legendT <= 0) return;
        const a = Math.min(1, legendT);
        ctx.globalAlpha = a;
        rect(18, 36, 144, 50, 'rgba(13,21,17,0.88)');
        rect(18, 36, 144, 1, '#f5c542'); rect(18, 85, 144, 1, '#f5c542');
        api.text(ctx, 'JA', 24, 42, 8, '#5fd35f');
        sprite('check', 42, 42, 1);
        sprite('water', 60, 39, 2); sprite('banana', 84, 40, 2); sprite('gel', 108, 39, 2);
        api.text(ctx, 'NEIN', 24, 66, 8, '#ff5a4a');
        sprite('cross', 58, 67, 1);
        sprite('sprudel', 76, 62, 2); sprite('beer', 100, 62, 2);
        ctx.globalAlpha = 1;
      }

      function drawBanner() {
        if (!banner) return;
        const t = banner.t, slide = t < 0.25 ? (0.25 - t) * 400 : t > banner.dur - 0.25 ? (t - banner.dur + 0.25) * -400 : 0;
        rect(0 + slide, 160, W, 34, 'rgba(13,21,17,0.85)');
        rect(0 + slide, 160, W, 1, '#f5c542'); rect(0 + slide, 193, W, 1, '#f5c542');
        api.text(ctx, banner.l1, W / 2 + slide, 166, 8, '#f5c542', 'center');
        api.text(ctx, banner.l2, W / 2 + slide, 180, 8, '#f6e7c8', 'center');
      }

      function drawButtons() {
        rect(0, 250, W, H - 250, '#1a2420');
        const hint = { grab: !!(state !== 'fail' && zoneItem()), lane: blocked, jump: false };
        // jump hint: peel ahead in current lane
        for (const p of peels) { const sx = p.x - pos; if (!p.hit && Math.abs(laneF - p.lane) < 0.4 && sx > EX + 10 && sx < EX + 60) hint.jump = true; }
        for (const k in BTN) {
          const b = BTN[k], dn = press[k] > 0, glow = hint[k] && Math.sin(T * 16) > -0.2;
          rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, glow ? '#f5d442' : '#000');
          rect(b.x, b.y + (dn ? 2 : 0), b.w, b.h - (dn ? 2 : 0), b.dark);
          rect(b.x, b.y + (dn ? 2 : 0), b.w, b.h - 4, dn ? b.dark : b.col);
          rect(b.x + 2, b.y + 2 + (dn ? 2 : 0), b.w - 4, 2, 'rgba(255,255,255,0.25)');
          const cy = b.y + b.h / 2 - 6 + (dn ? 2 : 0);
          if (k === 'grab') {
            api.text(ctx, b.label, b.x + b.w / 2, cy + 6, 8, '#fff', 'center');
            // little hand icon
            const hx = b.x + b.w / 2 - 6, hy = cy - 14 + (dn ? 2 : 0) * 0;
            api.drawPixels(ctx, ['.s.s.s', '.s.s.s', 'ssssss', 'ssssss', '.ssss.'], { s: '#f2c39b' }, hx, hy, 2);
          } else if (k === 'lane') {
            api.text(ctx, b.label, b.x + b.w / 2 + 6, cy + 2, 8, '#fff', 'center');
            api.drawPixels(ctx, ['..w..', '.www.', 'wwwww', '.....', 'wwwww', '.www.', '..w..'], { w: '#fff' }, b.x + 8, cy, 2);
          } else {
            api.text(ctx, b.label, b.x + b.w / 2, cy + 2, 8, '#fff', 'center');
          }
        }
      }

      function draw() {
        ctx.save();
        if (wobbleT > 0) { ctx.translate(0, Math.round(Math.sin(T * 7) * 1.5)); }
        drawBackground();
        drawStations();
        drawWorld();
        drawFx();
        ctx.restore();
        drawHud();
        drawLegend();
        drawBanner();
        if (state === 'finish' && stateT > 1) {
          rect(10, 44, W - 20, 40, 'rgba(13,21,17,0.88)');
          api.text(ctx, 'ZIEL! 21,1 km', W / 2, 52, 8, '#f5c542', 'center');
          api.text(ctx, 'Medaille für Eva!', W / 2, 68, 8, '#f6e7c8', 'center');
        }
        drawButtons();
      }

      startSection(0, false);
      legendT = 5;
      const stop = api.loop(dt => { update(dt); draw(); });

      return function cleanup() {
        stop();
        window.removeEventListener('keydown', onKey);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        root.removeEventListener('touchstart', noTouch);
        root.removeEventListener('contextmenu', noTouch);
        cv.destroy();
      };
    }
  };
})();

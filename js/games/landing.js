/* Landeanflug: cooperative dice-placement landing mini-game. Pilotin Eva + Co-Pilot Niklas.
   Each of 6 approach steps: both roll 3 dice. Niklas (helper AI) places first, then Eva places hers:
   ACHSE (Eva vs Niklas -> tilt), MOTOR (sum -> speed in green band), extras: FAHRWERK, KLAPPEN, FUNK. */
(function () {
  'use strict';

  const W = 180, H = 320;
  const STEPS = 6;
  const TARGET = [8, 8, 7, 7, 7, 6];         // speed band centre per step
  const TURB_STEPS = [1, 3, 4];               // steps with turbulence
  const GEAR_R = [[1, 2], [3, 4], [5, 6]];
  const FLAP_R = [[1, 3], [4, 6]];
  const EC = { b: '#3e9a4a', d: '#1f5a2a' };  // Eva dice colour (green)
  const NC = { b: '#e0832b', d: '#8a4a12' };  // Niklas dice colour (orange)
  const NIK = 'niklas';

  const DIG = {
    '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'], '-': ['...', '...', '###', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'],
    '/': ['..#', '..#', '.#.', '#..', '#..']
  };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const BIRD = [['#...#', '.#.#.', '..#..'], ['.....', '##.##', '..#..']];
  const MINIPLANE = ['..#....', '..##...', '#######', '..##...', '..#....'];
  const rnd = n => 1 + Math.floor(Math.random() * n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  GAMES['landing'] = {
    title: 'Landeanflug',
    intro: 'Pilotin Eva & Co-Pilot Niklas landen den Flieger! Lege deine Würfel: ACHSE gerade halten, MOTOR-Summe im grünen Bereich, Fahrwerk ausfahren.',
    start(root, api) {
      api.music('game');
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;

      /* ---------- layout ---------- */
      const SL = {
        axE: { x: 10, y: 168, w: 24, h: 24, own: 'E' }, axN: { x: 58, y: 168, w: 24, h: 24, own: 'N' },
        enE: { x: 98, y: 168, w: 24, h: 24, own: 'E' }, enN: { x: 146, y: 168, w: 24, h: 24, own: 'N' },
        g0: { x: 6, y: 207, w: 18, h: 18 }, g1: { x: 27, y: 207, w: 18, h: 18 }, g2: { x: 48, y: 207, w: 18, h: 18 },
        k0: { x: 78, y: 207, w: 18, h: 18 }, k1: { x: 99, y: 207, w: 18, h: 18 },
        radio: { x: 138, y: 207, w: 18, h: 18 }
      };
      const TRAY = [{ x: 32, y: 284 }, { x: 62, y: 284 }, { x: 92, y: 284 }];
      const DS = 26;
      const OKB = { x: 124, y: 286, w: 28, h: 22 };

      /* ---------- state ---------- */
      let fails = 0;
      let S;               // run state
      let phase, pt;       // phase name, time in phase
      let sel = -1;        // selected Eva die index
      let msg = '';        // resolve/feedback message
      let shake = 0, jolt = 0, popT = {};
      let tiltDisp = 0, prDisp = 0, pitch = 0;
      let niklasQueue = [], flying = [];
      let turb = null;
      let won = false, failReason = '';
      let errFlash = 0;
      const clouds = [];
      for (let i = 0; i < 6; i++) clouds.push(newCloud(true));
      const smoke = [], confetti = [];

      const mercy = () => fails >= 2;
      const tiltMax = () => mercy() ? 3 : 2;
      const landTilt = () => mercy() ? 2 : 1;

      function newRun() {
        const cells = shuffle([2, 3, 4, 5]).slice(0, 2).sort();
        S = {
          step: 0, pos: 0, tilt: 0, warn: 0,
          gear: [null, null, null], flaps: [null, null],
          obst: cells.map(c => ({ cell: c, cleared: false, kind: Math.random() < 0.5 ? 'bird' : 'plane' })),
          eD: [], nD: [], slot: {}
        };
        tiltDisp = 0; prDisp = 0; pitch = 0;
        startStep();
      }

      function startStep() {
        S.slot = { axE: null, axN: null, enE: null, enN: null, radio: null };
        S.eD = [0, 1, 2].map(() => ({ v: rnd(6), used: null }));
        S.nD = [0, 1, 2].map(() => ({ v: rnd(6), used: null }));
        sel = -1; msg = ''; turb = null; flying = [];
        setPhase('roll');
        api.sfx('step');
      }
      function setPhase(p) { phase = p; pt = 0; }

      /* ---------- rules ---------- */
      function band() {
        let w = S.gear.filter(Boolean).length + S.flaps.filter(Boolean).length;
        const t = TARGET[Math.min(S.step, STEPS - 1)];
        const m = mercy() ? 1 : 0;
        return [clamp(t - 1 - Math.ceil(w / 2) - m, 2, 12), clamp(t + 1 + Math.floor(w / 2) + m, 2, 12)];
      }
      const inBand = v => { const b = band(); return v >= b[0] && v <= b[1]; };
      const nextObst = () => S.obst.filter(o => !o.cleared && o.cell > S.pos).sort((a, b) => a.cell - b.cell)[0];
      const rangeOk = (r, v) => mercy() || (v >= r[0] && v <= r[1]);

      function extraSlotFor(key, v) {
        if (key[0] === 'g') { const i = +key[1]; return !S.gear[i] && rangeOk(GEAR_R[i], v); }
        if (key[0] === 'k') { const i = +key[1]; return !S.flaps[i] && rangeOk(FLAP_R[i], v); }
        if (key === 'radio') return !S.slot.radio && !!nextObst();
        return false;
      }
      function evaValid(key, v) {
        if (key === 'axE' || key === 'enE') return !S.slot[key];
        if (key === 'axN' || key === 'enN') return false;
        return extraSlotFor(key, v);
      }

      // How good is Niklas putting ax/en for Eva's current dice?
      function evaScore(ax, en) {
        let sc = 0;
        const last = S.step === STEPS - 1;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          if (i === j) continue;
          const nt = S.tilt + S.eD[i].v - ax;
          if (!inBand(S.eD[j].v + en)) continue;
          if (Math.abs(nt) <= (last ? landTilt() : 1)) sc += 2;
          else if (!last && Math.abs(nt) <= tiltMax() - 1) sc += 1;
        }
        return sc;
      }
      function niklasExtra(v) {
        const o = nextObst();
        if (o && o.cell <= S.pos + 2) return 'radio';
        if (S.step >= 3) for (let i = 0; i < 3; i++) if (extraSlotFor('g' + i, v)) return 'g' + i;
        for (let i = 0; i < 2; i++) if (extraSlotFor('k' + i, v)) return 'k' + i;
        return null;
      }
      function planNiklas() {
        const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
        let best = null, bs = -1;
        perms.forEach(p => {
          const ax = S.nD[p[0]].v, en = S.nD[p[1]].v, ex = S.nD[p[2]].v;
          let sc = evaScore(ax, en) * 10 + (niklasExtra(ex) ? 3 : 0) + Math.random();
          if (sc > bs) { bs = sc; best = p; }
        });
        niklasQueue = [{ key: 'axN', d: best[0] }, { key: 'enN', d: best[1] }];
        const ex = niklasExtra(S.nD[best[2]].v);
        if (ex) niklasQueue.push({ key: ex, d: best[2] });
      }
      function putDie(key, val, own, die) {
        const c = { v: val, own, step: S.step, die };
        if (key[0] === 'g') S.gear[+key[1]] = c;
        else if (key[0] === 'k') S.flaps[+key[1]] = c;
        else S.slot[key] = c;
        popT[key] = 0;
      }
      function slotContent(key) {
        if (key[0] === 'g') return S.gear[+key[1]];
        if (key[0] === 'k') return S.flaps[+key[1]];
        return S.slot[key];
      }
      function clearSlot(key) {
        if (key[0] === 'g') S.gear[+key[1]] = null;
        else if (key[0] === 'k') S.flaps[+key[1]] = null;
        else S.slot[key] = null;
      }

      function doTurbulence() {
        const key = Math.random() < 0.5 ? 'axN' : 'enN';
        const c = S.slot[key];
        const old = c.v;
        const cands = shuffle([1, 2, 3, 4, 5, 6].filter(v => v !== old));
        let pick = cands[0];
        for (const v of cands) {
          const ax = key === 'axN' ? v : S.slot.axN.v, en = key === 'enN' ? v : S.slot.enN.v;
          if (evaScore(ax, en) > 0) { pick = v; break; }
        }
        turb = { key, from: old, to: pick };
        shake = 0.9; jolt = (Math.random() < 0.5 ? -1 : 1);
        api.sfx('boom'); setTimeout0(() => api.sfx('hit'), 0.25);
      }
      // tiny scheduler driven by the game loop (no stray timers on cleanup)
      const later = [];
      function setTimeout0(fn, s) { later.push({ t: s, fn }); }

      function evaReady() { return phase === 'eva' && S.slot.axE && S.slot.enE; }

      function resolve() {
        sel = -1;
        const ax = S.slot.axE.v - S.slot.axN.v;
        const speed = S.slot.enE.v + S.slot.enN.v;
        const last = S.step === STEPS - 1;
        S.tilt += ax;
        const parts = [];
        let fail = '';
        if (Math.abs(S.tilt) > tiltMax()) fail = 'Viel zu schief!';
        const b = band();
        if (!fail) {
          if (speed > b[1] || speed < b[0]) {
            const w = speed > b[1] ? 'Zu schnell!' : 'Zu langsam!';
            if (last) fail = w;
            else { S.warn++; parts.push(w + ' Warnung ' + S.warn + '/3'); if (S.warn >= 3) fail = '3 Warnungen!'; }
          } else parts.push('Tempo gut!');
        }
        if (S.slot.radio) { const o = nextObst(); if (o) { o.cleared = true; parts.push('Funk: Luftraum frei!'); } }
        if (!fail) {
          S.pos++;
          const o = S.obst.find(o => o.cell === S.pos && !o.cleared);
          if (o) {
            o.cleared = true;
            const d = S.tilt >= 0 ? 1 : -1;
            S.tilt += d; S.warn++;
            parts.push((o.kind === 'bird' ? 'Vogel!' : 'Flieger!') + ' Ausweichen!');
            shake = 0.5; api.sfx('hit');
            if (Math.abs(S.tilt) > tiltMax()) fail = 'Viel zu schief!';
            else if (S.warn >= 3) fail = '3 Warnungen!';
          }
        }
        if (!fail && S.pos >= STEPS) {
          if (S.gear.some(g => !g)) fail = 'Fahrwerk fehlt!';
          else if (Math.abs(S.tilt) > landTilt()) fail = 'Zu schief zum Landen!';
        }
        if (Math.abs(S.tilt) <= 1 && !fail && !parts.length) parts.push('Kurs stabil!');
        msg = fail ? fail : parts.join(' ');
        failReason = fail;
        api.sfx(fail ? 'error' : 'ding');
        setPhase('resolve');
      }

      /* ---------- input ---------- */
      const hit = (r, p) => p.x >= r.x - 2 && p.x <= r.x + r.w + 2 && p.y >= r.y - 2 && p.y <= r.y + r.h + 2;
      function tapDie(i) {
        if (phase !== 'eva') return;
        const d = S.eD[i];
        if (d.used) { returnDie(d.used); sel = i; api.sfx('click'); return; }
        sel = i; api.sfx('click');
      }
      function returnDie(key) {
        const c = slotContent(key);
        if (!c || c.own !== 'E' || c.step !== S.step) return false;
        S.eD[c.die].used = null; clearSlot(key);
        return true;
      }
      function tapSlot(key) {
        if (phase !== 'eva') return;
        const c = slotContent(key);
        if (sel < 0) {
          if (c && c.own === 'E' && c.step === S.step) { const di = c.die; returnDie(key); sel = di; api.sfx('click'); }
          else { errFlash = 0.6; api.sfx('error'); }
          return;
        }
        const d = S.eD[sel];
        if (!evaValid(key, d.v)) { errFlash = 0.6; api.sfx('error'); return; }
        putDie(key, d.v, 'E', sel); d.used = key;
        sel = -1; api.sfx('coin');
        // auto-select next free die for speed
        if (S.eD.every(x => x.used)) setTimeout0(() => { if (evaReady()) resolve(); }, 0.35);
        else if (!S.slot.axE || !S.slot.enE) { const n = S.eD.findIndex(x => !x.used); sel = n; }
      }
      function tapOk() { if (evaReady()) { api.sfx('click'); resolve(); } }

      function onDown(e) {
        e.preventDefault();
        const p = cv.pointer(e);
        if (phase !== 'eva') return;
        for (let i = 0; i < 3; i++) if (hit({ x: TRAY[i].x, y: TRAY[i].y - 4, w: DS, h: DS + 4 }, p)) return tapDie(i);
        for (const k in SL) if (hit(SL[k], p)) return tapSlot(k);
        if (evaReady() && hit(OKB, p)) return tapOk();
        if (sel >= 0) { sel = -1; }
      }
      function onKey(e) {
        const k = e.key.toLowerCase();
        let used = true;
        if (k === '1' || k === '2' || k === '3') tapDie(+k - 1);
        else if (k === 'arrowleft' || k === 'arrowright') {
          if (phase === 'eva') { const free = [0, 1, 2].filter(i => !S.eD[i].used); if (free.length) { const at = free.indexOf(sel); sel = free[(at + (k === 'arrowleft' ? free.length - 1 : 1)) % free.length]; api.sfx('click'); } }
        }
        else if (k === 'a') tapSlot('axE');
        else if (k === 'm') tapSlot('enE');
        else if (k === 'f' || k === 'k') {
          if (sel >= 0) { const keys = k === 'f' ? ['g0', 'g1', 'g2'] : ['k0', 'k1']; const ok = keys.find(x => evaValid(x, S.eD[sel].v)); tapSlot(ok || keys[0]); }
        }
        else if (k === 'r') tapSlot('radio');
        else if (k === 'enter' || k === ' ') tapOk();
        else used = false;
        if (used) e.preventDefault();
      }
      cv.canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('keydown', onKey);

      /* ---------- drawing helpers ---------- */
      function R(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
      function tiny(str, x, y, c, s, align) {
        s = s || 1; str = String(str);
        const wpx = str.length * 4 * s - s;
        if (align === 'center') x -= wpx / 2; else if (align === 'right') x -= wpx;
        for (let i = 0; i < str.length; i++) { const g = DIG[str[i]]; if (g) api.drawPixels(ctx, g, { '#': c }, Math.round(x + i * 4 * s), Math.round(y), s); }
      }
      function drawDie(x, y, s, v, col, opts) {
        opts = opts || {};
        if (opts.glow) R(x - 2, y - 2, s + 4, s + 4, opts.glow);
        R(x, y + 1, s, s - 2, col.d); R(x + 1, y, s - 2, s, col.d);
        R(x + 1, y + 1, s - 2, s - 3, '#fbf3df'); R(x + 1, y + s - 3, s - 2, 1, '#d8ccb0');
        const ps = Math.max(2, Math.round(s / 7)), m = Math.round(s * 0.22), span = s - 2 * m - ps;
        (PIPS[v] || []).forEach(i => {
          const cx = i % 3, cy = Math.floor(i / 3);
          R(x + m + cx * span / 2, y + m + cy * span / 2 - 1, ps, ps, opts.pip || '#2a2320');
        });
      }
      function wrap(str, maxW) {
        ctx.font = '8px "Press Start 2P", monospace';
        const words = str.split(' '), lines = [];
        let cur = '';
        words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
        if (cur) lines.push(cur);
        return lines;
      }
      function drawCap(x, y, s) { R(x + 3 * s, y - 1 * s, 7 * s, 2 * s, '#1f2a4a'); R(x + 2 * s, y + 1 * s, 9 * s, s, '#141c33'); R(x + 5 * s, y - 1 * s, 2 * s, s, '#f5c542'); }

      function newCloud(init) {
        return { x: 90 + (Math.random() - 0.5) * 30, y: 12 + Math.random() * 18, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.7) * 10, s: init ? 0.4 + Math.random() : 0.2, age: init ? Math.random() * 2 : 0 };
      }

      /* ---------- windshield ---------- */
      function drawWindshield(t) {
        ctx.save();
        ctx.beginPath(); ctx.rect(4, 4, 172, 98); ctx.clip();
        const hy = 46 + pitch;
        ctx.save();
        ctx.translate(90, hy);
        ctx.rotate(-(tiltDisp + jolt * Math.sin(t * 30) * (shake > 0 ? 0.6 : 0)) * 0.13);
        // sky bands
        const sky = ['#2f5d86', '#3a6f9a', '#4f88b0', '#68a3c6', '#86c0da', '#a8d8e8'];
        R(-160, -260, 320, 260, sky[0]);
        for (let i = 1; i < sky.length; i++) R(-160, -60 + i * 10, 320, 60, sky[i]);
        // ground
        R(-160, 0, 320, 200, '#4a7f36');
        const fields = ['#5d9440', '#7a8f3a', '#d9822b', '#4a7f36', '#8aa84a', '#b56a28'];
        for (let k = 0; k < 14; k++) {
          const y0 = Math.pow(k / 14, 2) * 120, y1 = Math.pow((k + 1) / 14, 2) * 120;
          R(-160, y0, 320, Math.max(1, y1 - y0), fields[k % fields.length]);
        }
        for (let i = -40; i < 40; i++) R(i * 4, -2 - ((i * 7) & 1), 3, 3, i % 3 ? '#2f5a26' : '#d9822b'); // treeline
        // runway
        const pr = 0.1 + prDisp * 0.9;
        const nearY = 6 + pr * 70, farY = 1 + pr * 4;
        const farW = 2 + pr * 18, nearW = 6 + pr * 150;
        for (let y = farY; y <= nearY; y++) {
          const f = (y - farY) / Math.max(1, nearY - farY);
          const w = lerp(farW, nearW, f);
          R(-w / 2, y, w, 1, '#4d5258');
          R(-w / 2, y, Math.max(1, w * 0.04), 1, '#f6e7c8'); R(w / 2 - Math.max(1, w * 0.04), y, Math.max(1, w * 0.04), 1, '#f6e7c8');
          const dash = Math.floor((Math.sqrt(f) * 8 + t * (phase === 'land' ? 4 : 0.4)) % 2);
          if (dash === 0 && f < 0.92) R(-Math.max(0.5, w * 0.02), y, Math.max(1, w * 0.04), 1, '#ffffff');
          if (f > 0.93) for (let s = -3; s <= 3; s++) if (s) R(s * w * 0.11 - w * 0.03, y, w * 0.06, 1, '#ffffff');
        }
        ctx.restore();
        // clouds (screen space)
        clouds.forEach(c => {
          const s = c.s;
          ctx.globalAlpha = Math.min(1, c.age) * 0.85;
          R(c.x - 10 * s, c.y - 3 * s, 20 * s, 6 * s, '#ffffff');
          R(c.x - 6 * s, c.y - 7 * s, 12 * s, 6 * s, '#ffffff');
          R(c.x - 10 * s, c.y + 2 * s, 20 * s, 2 * s, '#dce9f0');
          ctx.globalAlpha = 1;
        });
        // obstacle ahead
        const o = S && nextObst();
        if (o && o.cell === S.pos + 1 && (phase === 'eva' || phase === 'roll' || phase === 'niklas' || phase === 'turb')) {
          const ox = 130 + Math.sin(t * 2) * 6, oy = 26 + Math.cos(t * 1.5) * 3;
          if (o.kind === 'bird') {
            [0, 1, 2].forEach(i => api.drawPixels(ctx, BIRD[Math.floor(t * 6 + i) % 2], { '#': '#1d1d1d' }, ox + i * 9, oy + (i % 2) * 5, 1));
          } else api.drawPixels(ctx, MINIPLANE, { '#': '#d94c3d' }, ox, oy, 2);
          if (Math.floor(t * 3) % 2) { R(ox - 4, oy - 9, 34, 9, '#d94c3d'); api.text(ctx, 'ACHTUNG', ox + 13, oy - 9, 8, '#fff', 'center', false); }
        }
        // touchdown smoke
        smoke.forEach(p => { ctx.globalAlpha = Math.max(0, 1 - p.a / 1.2) * 0.8; R(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, '#e8e8e8'); });
        ctx.globalAlpha = 1;
        ctx.restore();
        // cockpit frame
        R(0, 0, W, 4, '#2a2f36'); R(0, 0, 4, 104, '#2a2f36'); R(176, 0, 4, 104, '#2a2f36');
        R(84, 0, 12, 8, '#2a2f36'); R(87, 8, 6, 10, '#2a2f36'); R(88, 8, 4, 9, '#3a414a');
        R(4, 4, 18, 3, '#2a2f36'); R(158, 4, 18, 3, '#2a2f36');
        R(0, 100, W, 6, '#1d2127'); R(0, 102, W, 1, '#4a525c');
      }

      /* ---------- instruments ---------- */
      function drawInstruments(t) {
        R(0, 104, W, 54, '#262b31');
        // artificial horizon
        const cx = 22, cy = 125, r = 15;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        ctx.translate(cx, cy); ctx.rotate(-tiltDisp * 0.25);
        R(-30, -30, 60, 30, '#4f9fd9'); R(-30, 0, 60, 30, '#8a5a2a'); R(-30, 0, 60, 1, '#ffffff');
        for (let i = -2; i <= 2; i++) if (i) R(-4, i * 5, 8, 1, 'rgba(255,255,255,.6)');
        ctx.restore();
        R(cx - 9, cy, 6, 2, '#f5d442'); R(cx + 3, cy, 6, 2, '#f5d442'); R(cx - 1, cy - 1, 2, 3, '#f5d442');
        ctx.strokeStyle = '#8a929c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.stroke();
        // tilt meter -3..3
        const tm = tiltMax(), shown = (phase === 'eva' && S.slot.axE && S.slot.axN) ? S.tilt + S.slot.axE.v - S.slot.axN.v : S.tilt;
        for (let i = -3; i <= 3; i++) {
          const x = cx - 3 + i * 6, y = 145;
          const col = Math.abs(i) <= 1 ? '#3e9a4a' : (Math.abs(i) <= tm ? '#d9a62b' : '#d94c3d');
          R(x, y, 5, 5, '#14181c'); R(x + 1, y + 1, 3, 3, col);
          if (i === S.tilt && !(shown !== S.tilt && Math.floor(t * 4) % 2)) R(x - 1, y - 2, 7, 1, '#ffffff');
          if (i === clamp(shown, -3, 3) && shown !== S.tilt && Math.floor(t * 4) % 2) { R(x - 1, y - 2, 7, 1, '#f5d442'); R(x - 1, y + 6, 7, 1, '#f5d442'); }
        }
        // speed gauge
        api.text(ctx, 'TEMPO', 46, 108, 8, '#cfd6de', 'left', false);
        const b = band();
        const bx = 46, by = 118, cw = 11;
        for (let v = 2; v <= 12; v++) {
          const x = bx + (v - 2) * cw;
          const ok = v >= b[0] && v <= b[1];
          R(x, by, cw - 1, 9, ok ? '#3e9a4a' : (v < b[0] ? '#3a6f8f' : '#a33a2f'));
          tiny(v, x + cw / 2 - 0.5, by + 2, ok ? '#e8ffe0' : '#cfd6de', 1, 'center');
        }
        let sp = null;
        if (S.slot.enE && S.slot.enN) sp = S.slot.enE.v + S.slot.enN.v;
        if (sp != null) {
          const x = bx + (sp - 2) * cw + cw / 2 - 1;
          const okc = inBand(sp) ? '#ffffff' : '#ff6b5a';
          R(x - 2, by - 3, 5, 2, okc); R(x - 1, by - 1, 3, 1, okc); R(x - 2, by + 10, 5, 2, okc);
        }
        // warning lamps
        for (let i = 0; i < 3; i++) R(150 + i * 9, 108, 6, 6, i < S.warn ? (Math.floor(t * 4) % 2 ? '#ff4a3a' : '#a32a20') : '#3a3f45');
        // approach track
        api.text(ctx, 'ANFLUG', 46, 132, 8, '#cfd6de', 'left', false);
        tiny(Math.min(S.pos, STEPS) + '/' + STEPS, 98, 134, '#f5d442', 1);
        const tx = 46, ty = 143, tw = 16;
        for (let c = 0; c <= STEPS; c++) {
          const x = tx + c * tw;
          R(x, ty, tw - 2, 11, c === STEPS ? '#4d5258' : (c <= S.pos ? '#3a5a3a' : '#33393f'));
          if (c === STEPS) { R(x + 2, ty + 5, tw - 6, 1, '#ffffff'); }
          const o = S.obst.find(o => o.cell === c);
          if (o && !o.cleared) {
            if (o.kind === 'bird') api.drawPixels(ctx, BIRD[0], { '#': '#f6e7c8' }, x + 4, ty + 4, 1);
            else api.drawPixels(ctx, MINIPLANE, { '#': '#ff6b5a' }, x + 3, ty + 3, 1);
          }
        }
        const px = tx + lerp(0, STEPS, prDisp) * tw + 2;
        api.drawPixels(ctx, MINIPLANE, { '#': '#f5d442' }, px + (phase === 'land' ? 0 : 0), ty + 3, 1);
      }

      /* ---------- slots ---------- */
      function slotGlow(key, t) {
        if (phase !== 'eva' || sel < 0) return null;
        if (!evaValid(key, S.eD[sel].v)) return null;
        return Math.floor(t * 4) % 2 ? '#f5d442' : '#fff6b0';
      }
      function drawSlot(key, t) {
        const s = SL[key];
        const c = slotContent(key);
        const g = slotGlow(key, t);
        const own = c ? c.own : s.own;
        const col = own === 'E' ? EC : own === 'N' ? NC : { b: '#7a828c', d: '#4a525c' };
        if (g) R(s.x - 2, s.y - 2, s.w + 4, s.h + 4, g);
        R(s.x, s.y, s.w, s.h, '#14181c');
        R(s.x + 1, s.y + 1, s.w - 2, s.h - 2, '#1f2429');
        if (!c) {
          R(s.x, s.y, s.w, 1, col.b); R(s.x, s.y + s.h - 1, s.w, 1, col.b); R(s.x, s.y, 1, s.h, col.b); R(s.x + s.w - 1, s.y, 1, s.h, col.b);
          if (s.own) api.text(ctx, s.own === 'E' ? 'E' : 'N', s.x + s.w / 2, s.y + s.h / 2 - 4, 8, col.d, 'center', false);
          return;
        }
        const fl = flying.find(f => f.key === key);
        if (fl) return;
        const p = popT[key] != null && popT[key] < 0.2 ? 1 + (0.2 - popT[key]) * 2 : 1;
        const ds = Math.round(s.w * p);
        const tb = turb && turb.key === key && phase === 'turb' && pt < 0.8;
        drawDie(s.x + (s.w - ds) / 2 + (tb ? (Math.random() - 0.5) * 4 : 0), s.y + (s.h - ds) / 2, ds, tb ? rnd(6) : c.v, c.own === 'E' ? EC : NC);
      }
      function drawSlots(t) {
        R(0, 158, W, 78, '#30363d');
        R(0, 158, W, 1, '#4a525c');
        api.text(ctx, 'ACHSE', 46, 160, 8, '#f6e7c8', 'center', false);
        api.text(ctx, 'MOTOR', 134, 160, 8, '#f6e7c8', 'center', false);
        R(89, 162, 2, 34, '#262b31');
        ['axE', 'axN', 'enE', 'enN'].forEach(k => drawSlot(k, t));
        // middle info
        const a = S.slot.axE, b = S.slot.axN;
        if (a && b) {
          const d = a.v - b.v, nt = S.tilt + d;
          tiny((d > 0 ? '+' : '') + d, 46, 174, Math.abs(nt) <= 1 ? '#7fe07a' : Math.abs(nt) <= tiltMax() ? '#f5c542' : '#ff6b5a', 2, 'center');
        } else tiny('-', 46, 174, '#6a727c', 2, 'center');
        const e = S.slot.enE, n = S.slot.enN;
        if (e && n) { const s = e.v + n.v; tiny(s, 134, 174, inBand(s) ? '#7fe07a' : '#ff6b5a', 2, 'center'); }
        else tiny('+', 134, 174, '#6a727c', 2, 'center');
        api.text(ctx, 'FAHRWERK', 36, 197, 8, '#f6e7c8', 'center', false);
        api.text(ctx, 'KLAPPEN', 98, 197, 8, '#f6e7c8', 'center', false);
        api.text(ctx, 'FUNK', 147, 197, 8, '#f6e7c8', 'center', false);
        ['g0', 'g1', 'g2', 'k0', 'k1', 'radio'].forEach(k => drawSlot(k, t));
        if (!mercy()) {
          GEAR_R.forEach((r, i) => tiny(r[0] + '-' + r[1], SL['g' + i].x + 9, 228, '#aab2bc', 1, 'center'));
          FLAP_R.forEach((r, i) => tiny(r[0] + '-' + r[1], SL['k' + i].x + 9, 228, '#aab2bc', 1, 'center'));
        } else {
          ['g0', 'g1', 'g2', 'k0', 'k1'].forEach(k => tiny('1-6', SL[k].x + 9, 228, '#aab2bc', 1, 'center'));
        }
        const o = nextObst();
        if (o) api.drawPixels(ctx, o.kind === 'bird' ? BIRD[0] : MINIPLANE, { '#': '#ff6b5a' }, 160, 228, 1);
        else tiny('-', 147, 228, '#6a727c', 1, 'center');
        // gear status lamp
        const gd = S.gear.filter(Boolean).length;
        R(68, 210, 4, 12, '#14181c'); for (let i = 0; i < 3; i++) R(69, 219 - i * 4, 2, 3, i < gd ? '#7fe07a' : '#4a2a2a');
      }

      /* ---------- hint panel + crew ---------- */
      function hintText() {
        if (phase === 'roll') return S.step === 0 && fails === 0 ? 'Anflug ' + (S.step + 1) + '/6. Alle würfeln!' : 'Anflug ' + (S.step + 1) + '/6. Würfeln...';
        if (phase === 'niklas') return 'Niklas legt seine Würfel...';
        if (phase === 'turb') return 'TURBULENZEN! Ein Würfel von Niklas wird durchgeschüttelt!';
        if (phase === 'resolve') return msg;
        if (phase === 'eva') {
          if (errFlash > 0) return sel < 0 ? 'Erst einen Würfel unten antippen!' : 'Da passt er nicht. Leuchtende Felder gehen!';
          if (S.step === 0 && !S.slot.axE && !S.slot.enE) return sel < 0 ? 'Tippe einen Würfel, dann ein Feld.' : 'Jetzt ein leuchtendes Feld antippen!';
          if (sel >= 0) {
            if (!S.slot.axE) return 'ACHSE: Gleich wie Niklas = gerade. Grüne Zahl ist gut!';
            if (!S.slot.enE) return 'MOTOR: Summe muss im grünen TEMPO liegen!';
            return 'Extra: Fahrwerk, Klappen (mehr Grün) oder Funk.';
          }
          if (!S.slot.axE) return 'ACHSE: Würfel nah an Niklas\' Zahl hält uns gerade.';
          if (!S.slot.enE) return 'MOTOR: Würfel + Niklas = grünes TEMPO!';
          const gl = S.gear.filter(g => !g).length;
          if (gl && S.step >= 2) return 'Fahrwerk fehlt noch ' + gl + 'x! Würfel rein oder OK.';
          return 'Extra-Würfel nutzen oder OK tippen.';
        }
        if (phase === 'fail') return 'Niklas: "Durchstarten! Nochmal!"';
        if (phase === 'land') return 'Niklas: "Wow, Eva! Traumlandung!"';
        return '';
      }
      function drawHint(t) {
        R(0, 236, W, 42, '#e9dcc0'); R(0, 236, W, 1, '#8a7a5a'); R(0, 277, W, 1, '#8a7a5a');
        const txt = hintText();
        const red = phase === 'turb' || (phase === 'resolve' && failReason) || (phase === 'eva' && errFlash > 0);
        let maxW = 172, x0 = 4;
        if (phase === 'roll' || phase === 'niklas') maxW = 110;
        const lines = wrap(txt, maxW).slice(0, 4);
        const lh = lines.length > 3 ? 9 : 11;
        const y0 = 240 + (38 - lines.length * lh) / 2;
        lines.forEach((l, i) => api.text(ctx, l, x0, y0 + i * lh, 8, red ? '#b02a1e' : '#2a2320', 'left', false));
        if (phase === 'roll' || phase === 'niklas') {
          S.nD.forEach((d, i) => {
            if (d.used) return;
            drawDie(118 + i * 20, 247, 18, phase === 'roll' ? rnd(6) : d.v, NC);
          });
        }
      }
      function drawCrew(t) {
        R(0, 278, W, 42, '#1d2127');
        const happy = phase === 'land' && pt > 1;
        const ey = 284 + (happy ? -Math.abs(Math.sin(t * 8)) * 6 : 0);
        const ny = 284 + (happy ? -Math.abs(Math.sin(t * 8 + 1.5)) * 6 : (phase === 'niklas' ? -Math.abs(Math.sin(t * 10)) * 2 : 0));
        api.drawChar(ctx, 'eva', happy ? 'jump' : 'idle', 2, ey, 2, false); drawCap(2, ey, 2);
        api.drawChar(ctx, NIK, happy ? 'jump' : 'idle', 154, ny, 2, true); drawCap(154, ny, 2);
        // Eva's dice
        S.eD.forEach((d, i) => {
          const p = TRAY[i];
          if (d.used) { R(p.x + 2, p.y + 2, DS - 4, DS - 4, '#2a2f36'); return; }
          const up = sel === i ? 4 : 0;
          const showV = phase === 'roll' ? rnd(6) : d.v;
          const vis = phase !== 'land' && phase !== 'fail';
          if (!vis) return;
          drawDie(p.x, p.y - up, DS, showV, EC, { glow: sel === i ? '#f5d442' : (phase === 'eva' && sel < 0 && Math.floor(t * 2) % 2 && S.step === 0 ? '#fff6b0' : null) });
        });
        if (evaReady()) {
          const pul = Math.floor(t * 3) % 2;
          R(OKB.x - 1, OKB.y - 1, OKB.w + 2, OKB.h + 2, pul ? '#fff6b0' : '#2a2f36');
          R(OKB.x, OKB.y, OKB.w, OKB.h, '#3e9a4a'); R(OKB.x, OKB.y + OKB.h - 3, OKB.w, 3, '#24502a');
          api.text(ctx, 'OK', OKB.x + OKB.w / 2, OKB.y + 6, 8, '#ffffff', 'center');
        }
        if (mercy()) tiny('+', 176, 280, '#7fe07a', 1, 'right');
      }

      function drawFlying() {
        flying.forEach(f => {
          const k = clamp(f.t / 0.3, 0, 1), e = 1 - Math.pow(1 - k, 2);
          const s = SL[f.key];
          const x = lerp(f.sx, s.x + (s.w - s.w) / 2, e), y = lerp(f.sy, s.y, e) - Math.sin(k * Math.PI) * 14;
          drawDie(x, y, Math.round(lerp(18, s.w, e)), f.v, NC);
        });
      }

      function drawBanners(t) {
        if (phase === 'turb' && pt < 1.2) {
          const c = Math.floor(t * 8) % 2 ? '#d94c3d' : '#f5c542';
          R(0, 40, W, 22, c);
          api.text(ctx, 'TURBULENZEN!', 90, 47, 8, '#ffffff', 'center');
        }
        if (phase === 'fail') {
          R(0, 28, W, 52, 'rgba(160,30,20,.85)');
          api.text(ctx, 'DURCH-', 90, 32, 16, '#ffffff', 'center');
          api.text(ctx, 'STARTEN!', 90, 50, 16, '#ffffff', 'center');
          api.text(ctx, failReason, 90, 69, 8, '#ffe08a', 'center');
        }
        if (phase === 'land' && pt > 1) {
          R(0, 22, W, 44, 'rgba(30,90,40,.85)');
          api.text(ctx, 'SANFT', 90, 26, 16, '#ffffff', 'center');
          api.text(ctx, 'GELANDET!', 90, 45, 16, '#f5d442', 'center');
          confetti.forEach(c => R(c.x, c.y, 2, 3, c.c));
        }
      }

      /* ---------- update ---------- */
      function update(dt, t) {
        pt += dt;
        for (const k in popT) popT[k] += dt;
        for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { const f = later[i].fn; later.splice(i, 1); f(); } }
        shake = Math.max(0, shake - dt); errFlash = Math.max(0, errFlash - dt);
        if (shake <= 0) jolt = 0;
        // clouds: rush outward
        const spd = phase === 'fail' ? 4 : (phase === 'land' ? 2.5 : 1);
        clouds.forEach((c, i) => {
          c.age += dt; c.x += (c.x - 90) * dt * 0.5 * spd + c.vx * dt * 0.2; c.y += (c.y - 40) * dt * 0.3 * spd + (phase === 'fail' ? 60 * dt : 0); c.s += dt * 0.35 * spd;
          if (c.s > 2.5 || c.x < -30 || c.x > 210 || c.y > 40 || c.y < -20) clouds[i] = newCloud(false);
        });
        // display easing
        const tgtTilt = phase === 'fail' ? tiltDisp : S.tilt;
        tiltDisp += (tgtTilt - tiltDisp) * Math.min(1, dt * 5);
        let tgtPr = S.pos / STEPS;
        if (phase === 'land') tgtPr = 1 + Math.min(pt, 1.2) * 0.25;
        prDisp += (tgtPr - prDisp) * Math.min(1, dt * 3);
        pitch += ((phase === 'fail' ? 40 + pt * 30 : (phase === 'land' ? -Math.min(pt, 1) * 8 : 0)) - pitch) * Math.min(1, dt * 3);

        if (phase === 'roll') {
          if (pt === dt) api.sfx('pour');
          if (pt > 0.6) { planNiklas(); setPhase('niklas'); }
        } else if (phase === 'niklas') {
          flying.forEach(f => { f.t += dt; });
          flying = flying.filter(f => f.t < 0.3);
          const due = Math.floor(pt / 0.4);
          const placed = S.nD.filter(d => d.used).length;
          if (placed < niklasQueue.length && due > placed) {
            const q = niklasQueue[placed];
            const d = S.nD[q.d]; d.used = q.key;
            putDie(q.key, d.v, 'N', q.d);
            flying.push({ key: q.key, v: d.v, t: 0, sx: 118 + q.d * 20, sy: 247 });
            api.sfx('click');
          }
          if (placed >= niklasQueue.length && !flying.length && pt > niklasQueue.length * 0.4 + 0.2) {
            if (S.slot.radio) { /* Niklas radioed */ }
            if (TURB_STEPS.indexOf(S.step) >= 0) { setPhase('turb'); doTurbulence(); }
            else { setPhase('eva'); sel = -1; }
          }
        } else if (phase === 'turb') {
          if (pt > 0.8 && turb && S.slot[turb.key].v !== turb.to) { S.slot[turb.key].v = turb.to; popT[turb.key] = 0; api.sfx('ding'); }
          if (pt > 1.6) { setPhase('eva'); sel = -1; }
        } else if (phase === 'resolve') {
          if (pt > 1.5) {
            if (failReason) { setPhase('fail'); api.sfx('launch'); }
            else if (S.pos >= STEPS) { setPhase('land'); }
            else { S.step++; startStep(); }
          }
        } else if (phase === 'fail') {
          if (pt > 2.2) {
            fails++;
            if (fails === 2) api.toast('Niklas: Mehr Spielraum – wir schaffen das!', 2500);
            newRun();
          }
        } else if (phase === 'land') {
          if (pt > 1 && pt - dt <= 1) {
            api.sfx('hit');
            for (let i = 0; i < 14; i++) smoke.push({ x: (i % 2 ? 40 : 140) + (Math.random() - 0.5) * 20, y: 92 + Math.random() * 6, r: 2 + Math.random() * 3, a: Math.random() * 0.3 });
            for (let i = 0; i < 40; i++) confetti.push({ x: Math.random() * W, y: -Math.random() * 60, vy: 30 + Math.random() * 40, c: ['#f5d442', '#d94c3d', '#4a7fd9', '#6fae4f', '#f2a7b8'][i % 5] });
          }
          if (pt > 1.3 && pt - dt <= 1.3) api.sfx('coin');
          if (pt > 1.8 && !won) { won = true; api.win(); }
        }
        smoke.forEach(p => { p.a += dt; p.r += dt * 10; p.y -= dt * 4; });
        for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].a > 1.2) smoke.splice(i, 1);
        confetti.forEach(c => { c.y += c.vy * dt; if (c.y > 100) c.y = -4; });
      }

      function draw(t) {
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 6 * shake), Math.round((Math.random() - 0.5) * 6 * shake));
        R(-4, -4, W + 8, H + 8, '#1d2127');
        drawWindshield(t);
        drawInstruments(t);
        drawSlots(t);
        drawHint(t);
        drawCrew(t);
        drawFlying();
        drawBanners(t);
        ctx.restore();
      }

      newRun();
      const stop = api.loop((dt, t) => { update(dt, t); draw(t); });

      return function cleanup() {
        stop();
        cv.canvas.removeEventListener('pointerdown', onDown);
        window.removeEventListener('keydown', onKey);
        later.length = 0;
        cv.destroy();
      };
    }
  };
})();

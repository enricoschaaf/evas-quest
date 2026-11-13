/* Herbststurm – storm variant of the balloon flight: telegraphed wind gusts, moving gaps, falling acorns, 3 escalation stages. */
(function () {
  'use strict';

  GAMES['flappy_sturm'] = {
    title: 'Herbststurm',
    intro: 'Ein Herbststurm zieht auf! Tippe, um mit den Ballons zu flattern. Wenn BÖE! blinkt, kommt gleich Wind – gegensteuern! Flieg durch 10 Lücken.',
    start(root, api) {
      const W = 180, H = 320, GROUND = 296, GOAL = 10;
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;
      api.music('game');

      /* ---------- tuning (spicier, still fair) ---------- */
      const GRAV = 400, FLAP = -150, MAXFALL = 190, SPEED = 58, SPACING = 118, OB_W = 28;
      const BASE_GAP = 118, MERCY_STEP = 14, MERCY_MAX = 3, STORM_NARROW = 10, HAZ_G = 320;
      const EVA_X = 46; // left of Eva sprite (scale 2 => 24x32)

      /* ---------- pre-rendered parallax layers ---------- */
      function layer(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g); return c; }
      function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

      const sky = layer(W, H, g => {
        const bands = ['#7fb7d6', '#8cc0d8', '#9cc8d6', '#b4cfcf', '#cfd5c2', '#e6d6aa', '#f0cf92'];
        const bh = Math.ceil(GROUND / bands.length);
        bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * bh, W, bh); });
      });
      // far hills + far trees (slow)
      const farW = 240;
      const far = layer(farW, H, g => {
        const r = rnd(7);
        g.fillStyle = '#8a9a8a';
        for (let x = 0; x < farW; x++) { const y = 210 + Math.round(Math.sin(x / farW * Math.PI * 4) * 10 + Math.sin(x / 17) * 3); g.fillRect(x, y, 1, GROUND - y); }
        const cols = ['#a0684a', '#b98a4e', '#7d7a52'];
        for (let i = 0; i < 26; i++) {
          const x = Math.floor(r() * farW), top = 190 + Math.floor(r() * 30), c = cols[i % 3];
          g.fillStyle = '#6f6a5e'; g.fillRect(x, top + 10, 2, GROUND - top);
          g.fillStyle = c;
          for (let k = -6; k <= 6; k++) { const hh = Math.round(Math.sqrt(36 - k * k) * 1.6); g.fillRect((x + k + farW) % farW, top + 10 - hh, 1, hh * 2); }
        }
      });
      // mid trunks (medium)
      const midW = 300;
      const mid = layer(midW, H, g => {
        const r = rnd(42);
        for (let i = 0; i < 7; i++) {
          const x = Math.floor(i * midW / 7 + r() * 20), w = 5 + Math.floor(r() * 4);
          g.fillStyle = '#a3aba0'; g.fillRect(x, 0, w, GROUND);
          g.fillStyle = '#b3bab0'; g.fillRect(x, 0, 1, GROUND);
          g.fillStyle = '#929a90'; for (let y = 20; y < GROUND; y += 23 + Math.floor(r() * 18)) g.fillRect(x + 2, y, w - 4, 1);
        }
        // undergrowth
        const ub = ['#8a5a2a', '#a8642c', '#6b5a2a'];
        for (let x = 0; x < midW; x += 3) { const hgt = 6 + Math.floor(r() * 12); g.fillStyle = ub[x % 3]; g.fillRect(x, GROUND - hgt, 3, hgt); }
      });
      // canopy (top, medium-fast)
      const canW = 240;
      const canopy = layer(canW, 60, g => {
        const r = rnd(99);
        const cols = ['#c9562c', '#e08a2e', '#f2b33d', '#b33a2a', '#d9a03a', '#8a7a2a'];
        for (let i = 0; i < 70; i++) {
          const cx = Math.floor(r() * canW), cy = Math.floor(r() * 26), rad = 5 + Math.floor(r() * 9);
          g.fillStyle = cols[Math.floor(r() * cols.length)];
          for (let dy = -rad; dy <= rad; dy++) { const hw = Math.round(Math.sqrt(rad * rad - dy * dy)); for (let ox = -canW; ox <= canW; ox += canW) g.fillRect(cx - hw + ox, cy + dy, hw * 2, 1); }
        }
        g.fillStyle = '#a8401f'; g.fillRect(0, 0, canW, 6);
      });
      // ground strip (fast, scrolls with obstacles)
      const grW = 64;
      const ground = layer(grW, H - GROUND, g => {
        const r = rnd(5);
        g.fillStyle = '#6b4226'; g.fillRect(0, 0, grW, H - GROUND);
        g.fillStyle = '#4a2c1a'; for (let i = 0; i < 40; i++) g.fillRect(Math.floor(r() * grW), 6 + Math.floor(r() * 18), 2, 1);
        const lc = ['#d9822b', '#f2b33d', '#b33a2a', '#a8642c'];
        for (let x = 0; x < grW; x += 2) { g.fillStyle = lc[Math.floor(r() * 4)]; g.fillRect(x, 0, 2, 2 + Math.floor(r() * 3)); }
        for (let i = 0; i < 14; i++) { g.fillStyle = lc[i % 4]; g.fillRect(Math.floor(r() * (grW - 3)), 5 + Math.floor(r() * 16), 3, 2); }
      });

      function tile(img, off, y) {
        const iw = img.width; let x = -(((off % iw) + iw) % iw);
        for (; x < W; x += iw) ctx.drawImage(img, Math.floor(x), y);
      }

      /* ---------- balloons ---------- */
      const BAL = ['.ccc.', 'cwccc', 'cwccc', 'ccccc', 'ccccc', '.ccc.', '..d..'];
      const BCOL = [
        { c: '#d94c3d', d: '#a8342a' }, { c: '#f5d442', d: '#c9a52a' }, { c: '#4a7fd9', d: '#2f5aa8' },
        { c: '#f2a7b8', d: '#d27a90' }, { c: '#8a5bd9', d: '#6440a8' }
      ];
      // offsets (in canvas px, relative to Eva's hand) of balloon top-left at scale 2
      const BPOS = [[-14, -40], [-2, -46], [8, -38], [-8, -30], [4, -28]];

      function drawFlyer(ex, ey, t, frame) {
        const hx = ex + 17, hy = ey + 16; // Eva's hand (sprite px 8.5, 8)
        BPOS.forEach((p, i) => {
          const wx = Math.round(Math.sin(t * 2.6 + i * 1.7) * 1.5), wy = Math.round(Math.sin(t * 3.3 + i) * 1.2);
          const bx = hx + p[0] + wx, by = hy + p[1] + wy;
          // string: pixel line from knot to hand
          const kx = bx + 5, ky = by + 14;
          ctx.fillStyle = '#e9e1d0';
          const steps = Math.max(Math.abs(kx - hx), Math.abs(ky - hy));
          for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(kx + (hx - kx) * s / steps), Math.round(ky + (hy - ky) * s / steps), 1, 1);
        });
        BPOS.forEach((p, i) => {
          const wx = Math.round(Math.sin(t * 2.6 + i * 1.7) * 1.5), wy = Math.round(Math.sin(t * 3.3 + i) * 1.2);
          const col = BCOL[i];
          api.drawPixels(ctx, BAL, { c: col.c, d: col.d, w: '#ffffff' }, hx + p[0] + wx, hy + p[1] + wy, 2);
        });
        api.drawChar(ctx, 'eva', frame, ex, ey, 2, false);
      }

      /* ---------- obstacles ---------- */
      function drawTrunk(x, top) {
        const w = OB_W;
        ctx.fillStyle = '#9b9a90'; ctx.fillRect(x, top, w, GROUND - top);
        ctx.fillStyle = '#bdbcb0'; ctx.fillRect(x + 3, top, 5, GROUND - top);
        ctx.fillStyle = '#d2d1c6'; ctx.fillRect(x + 4, top, 2, GROUND - top);
        ctx.fillStyle = '#6f6e66'; ctx.fillRect(x + w - 5, top, 5, GROUND - top);
        ctx.fillStyle = '#4e4d47'; ctx.fillRect(x, top, 1, GROUND - top); ctx.fillRect(x + w - 1, top, 1, GROUND - top);
        // beech "eyes" marks
        for (let y = top + 14; y < GROUND - 6; y += 26) { ctx.fillStyle = '#5e5d56'; ctx.fillRect(x + 10, y, 9, 2); ctx.fillRect(x + 13, y + 2, 3, 1); }
        // broken top with a tuft of leaves
        ctx.fillStyle = '#7a7970'; ctx.fillRect(x - 2, top, w + 4, 4);
        ctx.fillStyle = '#4e4d47'; ctx.fillRect(x - 2, top + 4, w + 4, 1);
        ctx.fillStyle = '#e08a2e'; ctx.fillRect(x + 2, top - 3, 5, 3); ctx.fillStyle = '#f2b33d'; ctx.fillRect(x + 6, top - 4, 4, 4);
        ctx.fillStyle = '#c9562c'; ctx.fillRect(x + w - 9, top - 2, 6, 2);
        // roots
        ctx.fillStyle = '#7a7970'; ctx.fillRect(x - 4, GROUND - 4, 5, 4); ctx.fillRect(x + w - 1, GROUND - 3, 5, 3);
      }
      const CLUMP = ['#c9562c', '#e08a2e', '#f2b33d', '#b33a2a'];
      function drawBranch(x, bottom, seed) {
        const w = OB_W;
        // branch wood from the top
        ctx.fillStyle = '#5b3a24'; ctx.fillRect(x + 9, 0, 10, Math.max(0, bottom - 18));
        ctx.fillStyle = '#7a5134'; ctx.fillRect(x + 10, 0, 3, Math.max(0, bottom - 18));
        ctx.fillStyle = '#3b2416'; ctx.fillRect(x + 17, 0, 2, Math.max(0, bottom - 18));
        // side twigs with small leaf clusters along the branch
        for (let y = 26 + (seed % 3) * 6; y < bottom - 34; y += 34) {
          const left = ((y / 34) | 0) % 2 === 0;
          ctx.fillStyle = '#5b3a24';
          if (left) ctx.fillRect(x + 2, y, 8, 3); else ctx.fillRect(x + 18, y, 8, 3);
          ctx.fillStyle = CLUMP[(y + seed) % 4]; ctx.fillRect(left ? x - 1 : x + 23, y - 4, 7, 7);
          ctx.fillStyle = CLUMP[(y + seed + 1) % 4]; ctx.fillRect(left ? x + 1 : x + 25, y - 2, 3, 3);
        }
        // big leafy clump at the end (fills x-3..x+w+3, bottom-30..bottom)
        const cy = bottom - 15;
        const blobs = [[w / 2, 0, 15], [5, -5, 9], [w - 5, -5, 9], [w / 2, -9, 10], [4, 5, 8], [w - 4, 5, 8]];
        blobs.forEach((b, i) => {
          const r = b[2];
          ctx.fillStyle = i === 0 ? '#c9562c' : CLUMP[(i + seed) % 4];
          for (let dy = -r; dy <= r; dy++) {
            const hw = Math.round(Math.sqrt(r * r - dy * dy));
            const yy = cy + b[1] + dy;
            if (yy > bottom) continue;
            ctx.fillRect(Math.round(x + b[0] - hw), yy, hw * 2, 1);
          }
        });
        // highlights / leaf details
        ctx.fillStyle = '#f5d442';
        for (let k = 0; k < 7; k++) ctx.fillRect(x + ((k * 7 + seed * 3) % (w - 2)), cy - 10 + ((k * 11 + seed) % 20), 2, 2);
        ctx.fillStyle = '#8a2e1f';
        for (let k = 0; k < 6; k++) ctx.fillRect(x + 1 + ((k * 9 + seed * 5) % (w - 3)), cy - 6 + ((k * 13 + seed * 2) % 18), 2, 1);
      }

      /* ---------- local storm sounds (whoosh / quiet rumble), honours mute ---------- */
      let actx = null;
      function audio() {
        if (api.isMuted && api.isMuted()) return null;
        try {
          if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
          if (actx.state === 'suspended') actx.resume();
        } catch (e) { return null; }
        return actx;
      }
      function noiseBurst(dur, vol, type, f0, f1, attack) {
        const a = audio(); if (!a) return;
        const t = a.currentTime + 0.01, len = Math.floor(a.sampleRate * dur);
        const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const s = a.createBufferSource(); s.buffer = buf;
        const f = a.createBiquadFilter(); f.type = type; f.Q.value = type === 'bandpass' ? 1.2 : 0.7;
        f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(a.destination); s.start(t); s.stop(t + dur + 0.05);
      }
      const whoosh = () => noiseBurst(1.6, 0.22, 'bandpass', 300, 1400, 0.55);
      const rumble = () => noiseBurst(1.8, 0.35, 'lowpass', 260, 60, 0.12);

      /* ---------- leaves (lots, wind-driven) ---------- */
      const LEAF_C = ['#d9822b', '#f2b33d', '#c9562c', '#b33a2a', '#e8a83a'];
      const leaves = [];
      for (let i = 0; i < 60; i++) leaves.push({ x: Math.random() * W, y: Math.random() * GROUND, vy: 10 + Math.random() * 14, ph: Math.random() * 6, c: LEAF_C[i % LEAF_C.length], far: i % 3 === 0, k: i / 60 });
      const rain = [];
      for (let i = 0; i < 70; i++) rain.push({ x: Math.random() * W, y: Math.random() * H, v: 260 + Math.random() * 120 });

      /* ---------- state ---------- */
      let crashes = 0, state = 'ready', y = 140, vy = 0, passed = 0, scroll = 0, obs = [], spawned = 0, nextSpawnAt = 0;
      let toastTimer = 0, deadT = 0, shake = 0, flashT = 0, winT = 0, won = false, frameT = 0, popT = 0, playT = 0;
      // gust: phase 'none' | 'warn' | 'push'
      let gust = { phase: 'none', t: 0, dir: 1, next: 3 }, windLvl = 0;
      let hazards = [], nextHazard = 6, bolt = { next: 4, t: -1, rumbleAt: -1 }, banner = { text: '', sub: '', t: 0 }, stageShown = 0;
      const mercy = () => Math.min(MERCY_MAX, Math.floor(crashes / 3));
      const stageOf = n => n < 3 ? 1 : n < 6 ? 2 : 3;          // n = gaps passed / gap index (0-based)
      const stage = () => stageOf(passed);
      const gapSize = idx => BASE_GAP + MERCY_STEP * mercy() - (stageOf(idx) === 3 ? STORM_NARROW : 0);
      const gustPower = () => [0, 150, 230, 300][stage()] * (1 - 0.22 * mercy());
      const speed = () => SPEED + Math.min(passed, 9) * 1.8;

      function showBanner(s) {
        const B = [null, ['STUFE 1', 'Leichte Brise'], ['STUFE 2', 'Es wird windig!'], ['STUFE 3', 'HERBSTSTURM!']][s];
        banner = { text: B[0], sub: B[1], t: 2.0 };
        stageShown = s;
        api.music(s === 3 ? 'tense' : 'game');
      }

      function reset() {
        state = 'ready'; y = 140; vy = 0; passed = 0; obs = []; spawned = 0; nextSpawnAt = scroll + 150; deadT = 0; playT = 0;
        gust = { phase: 'none', t: 0, dir: 1, next: 3 }; hazards = []; nextHazard = 7; bolt = { next: 3, t: -1, rumbleAt: -1 };
        stageShown = 0; api.music('game');
      }
      let lastGapY = 150;
      function spawn() {
        const idx = spawned, st = stageOf(idx), g = gapSize(idx);
        // moving gaps: some in stage 2, more in stage 3
        const moves = (st === 2 && idx % 2 === 1) || (st === 3 && idx !== 6);
        const amp = moves ? (st === 2 ? 14 : 20) * (1 - 0.25 * mercy()) : 0;
        const minC = 40 + g / 2 + amp, maxC = GROUND - 30 - g / 2 - amp;
        let c = lastGapY + (Math.random() * 2 - 1) * (st === 1 ? 50 : 60);
        if (idx === 0) c = 150 + (Math.random() * 2 - 1) * 20;
        c = Math.max(minC, Math.min(maxC, c));
        lastGapY = c;
        obs.push({ x: W + 4, c, g, amp, ph: Math.random() * 6.28, w: 1.6 + Math.random() * 0.6, top: 0, bot: 0, passed: false, seed: (Math.random() * 97) | 0 });
        placeObs(obs[obs.length - 1]);
        spawned++;
      }
      function placeObs(o) {
        const c = o.c + Math.sin(frameT * o.w + o.ph) * o.amp;
        o.top = Math.round(c - o.g / 2); o.bot = Math.round(c + o.g / 2);
      }

      function spawnHazard() {
        // time until it reaches Eva's height: warn 1.0 s + fall; place it so it crosses Eva's column
        const WARN = 1.0, fallT = Math.sqrt(2 * Math.max(40, y - 4) / HAZ_G);
        const x = EVA_X + 12 + speed() * (WARN + fallT);
        if (x > W + 30) return;
        // avoid spawning inside a trunk column (unfair stacking)
        for (const o of obs) if (x > o.x - 10 && x < o.x + OB_W + 10) return;
        hazards.push({ x, y: 18, vy: 0, warn: WARN, kind: Math.random() < 0.6 ? 'acorn' : 'twig', rot: 0 });
      }

      function hitbox() { return { l: EVA_X + 6, r: EVA_X + 19, t: y - 12, b: y + 30 }; }

      function crash() {
        state = 'dead'; deadT = 0; shake = 0.3; flashT = 0.12; crashes++;
        api.sfx('hit');
        if (crashes % 3 === 0 && crashes / 3 <= MERCY_MAX) toastTimer = setTimeout(() => api.toast('Der Sturm lässt etwas nach!', 2000), 400);
      }

      function flap() {
        if (state === 'won') return;
        if (state === 'dead') { if (deadT < 0.35) return; reset(); }
        if (state === 'ready') { state = 'play'; nextSpawnAt = scroll + 60; showBanner(1); }
        vy = FLAP; popT = 0.12;
        api.sfx('flap');
        audio(); // unlock local audio on the gesture
      }

      /* ---------- input ---------- */
      function onPointer(e) { e.preventDefault(); flap(); }
      function onKey(e) {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
          e.preventDefault(); if (!e.repeat) flap();
        }
      }
      root.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);

      /* ---------- pixel arrow ---------- */
      const ARROW_UP = ['...a...', '..aaa..', '.aaaaa.', 'aaaaaaa', '..aaa..', '..aaa..', '..aaa..'];
      const ARROW_DN = ARROW_UP.slice().reverse();
      const ACORN = ['.bbbb.', 'bbbbbb', '.cccc.', '.cccc.', '..cc..'];
      const TWIG = ['tt......', '.ttt..l.', '...tttt.', '..l..ttt', '.......t'];

      /* ---------- loop ---------- */
      const stop = api.loop((dt, t) => {
        frameT += dt;
        const moving = state === 'ready' || state === 'play' || state === 'won';
        const spd = moving ? speed() : 0;
        scroll += spd * dt;
        const st = state === 'play' ? stage() : (state === 'won' ? 3 : 1);
        if (state === 'play' && st !== stageShown) showBanner(st);
        banner.t = Math.max(0, banner.t - dt);

        // ----- gusts -----
        let gustAcc = 0;
        if (state === 'play') {
          playT += dt;
          gust.t += dt;
          if (gust.phase === 'none' && playT > gust.next) {
            // more downward gusts later on; first gust of a run is always upward-ish (gentle)
            gust = { phase: 'warn', t: 0, dir: (playT < 5 ? -1 : (Math.random() < 0.55 ? 1 : -1)), next: 0 };
            whoosh();
          } else if (gust.phase === 'warn' && gust.t >= 1.0) { gust.phase = 'push'; gust.t = 0; shake = Math.max(shake, 0.12); }
          else if (gust.phase === 'push' && gust.t >= 1.0) {
            const gapT = [0, [4.5, 6], [3.5, 5], [2.8, 4]][st];
            gust = { phase: 'none', t: 0, dir: gust.dir, next: playT + gapT[0] + Math.random() * (gapT[1] - gapT[0]) + mercy() * 0.6 };
          }
          if (gust.phase === 'push') {
            const env = Math.sin(Math.min(1, gust.t / 1.0) * Math.PI); // swell in & out
            gustAcc = gust.dir * gustPower() * (0.55 + 0.45 * env);
          }
        } else if (state !== 'won') gust.phase = 'none';
        const gustVis = gust.phase === 'push' ? 1 : gust.phase === 'warn' ? gust.t : 0;
        const targetWind = (state === 'won' ? 0.4 : 0.25 * st) + gustVis * 1.2;
        windLvl += (targetWind - windLvl) * Math.min(1, dt * 3);

        if (state === 'ready') {
          y = 140 + Math.sin(frameT * 3) * 4;
        } else if (state === 'play' || state === 'won') {
          vy = Math.min(MAXFALL + (gustAcc > 0 ? 50 : 0), vy + (GRAV + gustAcc) * dt);
          y += vy * dt;
          if (y < 14) { y = 14; if (vy < 0) vy = 0; } // ceiling: clamp only
          if (state === 'won') {
            if (y > 150 && vy > 0) vy = FLAP * 0.7;
            winT += dt;
          }
          if (state === 'play' && spawned < GOAL && scroll >= nextSpawnAt) { spawn(); nextSpawnAt = scroll + SPACING; }
          obs.forEach(o => { o.x -= spd * dt; placeObs(o); });
          obs = obs.filter(o => o.x > -OB_W - 10);

          // ----- falling hazards (from stage 2) -----
          if (state === 'play' && passed >= 2 && spawned < GOAL) {
            nextHazard -= dt;
            if (nextHazard <= 0) { spawnHazard(); nextHazard = (st === 3 ? 5 : 7) + Math.random() * 3 + mercy() * 2; }
          }
          hazards.forEach(h => {
            h.x -= spd * dt;
            if (h.warn > 0) h.warn -= dt;
            else { h.vy += HAZ_G * dt; h.y += h.vy * dt; h.rot += dt * 10; }
          });
          hazards = hazards.filter(h => h.y < GROUND && h.x > -12);

          if (state === 'play') {
            const hb = hitbox();
            for (const o of obs) {
              if (hb.r > o.x + 1 && hb.l < o.x + OB_W - 1 && (hb.t < o.top - 2 || hb.b > o.bot)) { crash(); break; }
              if (!o.passed && o.x + OB_W < hb.l) {
                o.passed = true; passed++; api.sfx('coin');
                if (passed >= GOAL) { state = 'won'; winT = 0; hazards = []; gust.phase = 'none'; if (!won) { won = true; api.win(); } break; }
              }
            }
            if (state === 'play') for (const h of hazards) {
              if (h.warn > 0) continue;
              // small, forgiving hitbox (Eva's body only, not balloons)
              if (h.x + 5 > hb.l + 1 && h.x + 1 < hb.r - 1 && h.y + 8 > y + 2 && h.y + 2 < y + 30) { crash(); break; }
            }
            if (state === 'play' && y + 32 >= GROUND) { y = GROUND - 32; crash(); }
          }
        } else if (state === 'dead') {
          deadT += dt;
          vy = Math.min(260, vy + GRAV * 1.3 * dt);
          y = Math.min(GROUND - 32, y + vy * dt);
        }
        shake = Math.max(0, shake - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt);

        // ----- lightning from gap 5 on -----
        if (state === 'play' && passed >= 4) {
          bolt.next -= dt;
          if (bolt.next <= 0) { bolt.t = 0; bolt.rumbleAt = 0.45; bolt.x = 20 + Math.random() * (W - 40); bolt.next = 6 + Math.random() * 5; }
        }
        if (bolt.t >= 0) {
          bolt.t += dt;
          if (bolt.rumbleAt >= 0 && bolt.t >= bolt.rumbleAt) { bolt.rumbleAt = -1; rumble(); }
          if (bolt.t > 0.5) bolt.t = -1;
        }

        // ----- leaves: count & drift grow with wind -----
        const nLeaves = Math.min(leaves.length, Math.round(20 + windLvl * 28));
        const gdir = (gust.phase !== 'none') ? gust.dir : 0;
        for (let i = 0; i < leaves.length; i++) {
          const l = leaves[i];
          if (i >= nLeaves) { l.y = -4; continue; }
          const swirl = Math.sin(frameT * (1.5 + windLvl * 2) + l.ph) * (8 + windLvl * 30);
          l.x += (swirl * 0.6 - spd * (l.far ? 0.3 : 0.8) - windLvl * 70) * dt;
          l.y += (l.vy + Math.cos(frameT * 2.3 + l.ph * 2) * windLvl * 30 + gdir * gustVis * 90) * dt;
          if (l.y > GROUND) { l.y = -4; l.x = Math.random() * (W + 60); }
          if (l.y < -6) { l.y = GROUND - 2; l.x = Math.random() * (W + 60); }
          if (l.x < -4) { l.x += W + 8 + Math.random() * 30; l.y = Math.random() * GROUND; }
        }
        const raining = (state === 'play' && passed >= 6) || state === 'won';
        if (raining) rain.forEach(r => { r.y += r.v * dt; r.x -= (40 + windLvl * 60) * dt; if (r.y > GROUND) { r.y = -8; r.x = Math.random() * (W + 60); } if (r.x < -6) r.x += W + 10; });

        /* ---------- draw ---------- */
        const sway = Math.sin(frameT * (1.2 + windLvl)) * windLvl;
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * 3), Math.round((Math.random() * 2 - 1) * 2));
        ctx.drawImage(sky, 0, 0);
        // darken sky with the storm
        const dark = state === 'won' ? 0.15 : [0, 0.05, 0.2, 0.38][st];
        if (dark > 0) { ctx.fillStyle = 'rgba(40,44,62,' + dark + ')'; ctx.fillRect(0, 0, W, GROUND); }
        if (bolt.t >= 0 && bolt.t < 0.2) { // bolt in the sky
          ctx.fillStyle = '#fff8d0'; let bx = bolt.x;
          for (let by = 0; by < 120; by += 6) { ctx.fillRect(Math.round(bx), by, 2, 6); bx += ((by * 7) % 5) - 2; }
        }
        tile(far, scroll * 0.15 + sway * 2, 0);
        leaves.forEach((l, i) => { if (l.far && i < nLeaves) { ctx.fillStyle = l.c; ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1); } });
        tile(mid, scroll * 0.45 + sway * 4, 0);
        obs.forEach(o => { drawBranch(Math.round(o.x + sway * 1.5), o.top, o.seed); drawTrunk(Math.round(o.x), o.bot); });
        // hazard shadows / warnings
        hazards.forEach(h => {
          const hx = Math.round(h.x);
          const blink = h.warn > 0 ? (Math.floor(h.warn * 8) % 2 === 0) : true;
          ctx.fillStyle = 'rgba(20,10,5,' + (h.warn > 0 ? 0.35 : 0.5) + ')';
          if (blink) { ctx.fillRect(hx - 3, GROUND - 2, 12, 2); ctx.fillRect(hx - 1, GROUND - 3, 8, 1); }
          if (h.warn > 0 && blink) { // faint drop line + "!" under the canopy
            ctx.fillStyle = 'rgba(20,10,5,.18)'; for (let yy = 28; yy < GROUND; yy += 8) ctx.fillRect(hx + 2, yy, 2, 3);
            api.text(ctx, '!', hx + 3, 26, 8, '#f5c542', 'center');
          }
        });
        tile(canopy, scroll * 0.6 + sway * 6, -4 + Math.round(Math.abs(sway) * 2));
        hazards.forEach(h => {
          const hx = Math.round(h.x), hy = Math.round(h.y);
          if (h.kind === 'acorn') api.drawPixels(ctx, ACORN, { b: '#6b4226', c: '#c98a3a' }, hx, hy, 1.5);
          else api.drawPixels(ctx, TWIG, { t: '#5b3a24', l: '#e08a2e' }, hx - 2, hy, 1.5);
        });
        tile(ground, scroll, GROUND);

        drawFlyer(EVA_X, Math.round(y), frameT * (1 + windLvl), state === 'dead' ? 'idle' : 'jump');
        if (popT > 0) {
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(EVA_X + 6, Math.round(y) + 34, 3, 2); ctx.fillRect(EVA_X + 14, Math.round(y) + 35, 3, 2);
        }
        leaves.forEach((l, i) => {
          if (l.far || i >= nLeaves) return;
          ctx.fillStyle = l.c; const lx = Math.round(l.x), ly = Math.round(l.y);
          ctx.fillRect(lx, ly, 3, 2); if (Math.sin(frameT * 6 + l.ph) > 0) ctx.fillRect(lx + 1, ly + 2, 1, 1);
        });
        if (raining) { ctx.fillStyle = 'rgba(190,210,235,.55)'; rain.forEach(r => { ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 4); ctx.fillRect(Math.round(r.x) - 1, Math.round(r.y) + 4, 1, 2); }); }
        // gust streaks
        if (gustVis > 0.2) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * gustVis) + ')';
          for (let k = 0; k < 7; k++) {
            const sx = ((k * 53 - frameT * 260) % (W + 40) + W + 40) % (W + 40) - 20, sy = 40 + k * 36 + gdir * ((frameT * 40 + k * 9) % 12);
            ctx.fillRect(Math.round(sx), Math.round(sy), 18, 1); ctx.fillRect(Math.round(sx) + 6, Math.round(sy) + gdir, 10, 1);
          }
        }
        ctx.restore();

        if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(0, 0, W, H); }
        if (bolt.t >= 0 && (bolt.t < 0.07 || (bolt.t > 0.13 && bolt.t < 0.18))) { ctx.fillStyle = 'rgba(255,255,240,.55)'; ctx.fillRect(0, 0, W, H); }

        // gust warning / indicator
        if (state === 'play' && gust.phase !== 'none') {
          const warn = gust.phase === 'warn';
          if (!warn || Math.floor(gust.t * 6) % 2 === 0) {
            const ax = W - 26, ay = 128;
            ctx.fillStyle = 'rgba(13,21,17,.55)'; ctx.fillRect(ax - 6, ay - 6, 26, 40);
            api.drawPixels(ctx, gust.dir < 0 ? ARROW_UP : ARROW_DN, { a: warn ? '#f5c542' : '#ffffff' }, ax, ay + (gust.dir > 0 ? 4 : 0), 2);
            api.text(ctx, warn ? 'BÖE!' : 'WIND', ax + 7, ay + 20, 8, warn ? '#f5c542' : '#ffffff', 'center');
          }
        }

        // HUD
        if (state === 'won') {
          const pulse = 1 + Math.round(Math.sin(winT * 6));
          api.text(ctx, GOAL + '/' + GOAL, W / 2, 110 - pulse, 32, '#f5c542', 'center');
          api.text(ctx, 'Sturm besiegt!', W / 2, 152, 8, '#ffffff', 'center');
        } else {
          api.text(ctx, passed + '/' + GOAL, W / 2, 14, 16, '#ffffff', 'center');
        }
        if (state === 'play' && banner.t > 0 && (banner.t < 1.7 || Math.floor(banner.t * 10) % 2 === 0)) {
          const by = 60;
          ctx.fillStyle = 'rgba(13,21,17,.7)'; ctx.fillRect(10, by, W - 20, 32);
          ctx.fillStyle = stageShown === 3 ? '#b33a2a' : '#e08a2e'; ctx.fillRect(10, by, W - 20, 2); ctx.fillRect(10, by + 30, W - 20, 2);
          api.text(ctx, banner.text, W / 2, by + 6, 8, '#f5c542', 'center');
          api.text(ctx, banner.sub, W / 2, by + 18, 8, '#f6e7c8', 'center');
        }
        if (state === 'ready') {
          ctx.fillStyle = 'rgba(13,21,17,.55)'; ctx.fillRect(14, 216, W - 28, 34);
          api.text(ctx, 'Tippen zum', W / 2, 220, 8, '#f6e7c8', 'center');
          api.text(ctx, 'Fliegen', W / 2, 230, 8, '#f6e7c8', 'center');
          api.text(ctx, 'Achtung Böen!', W / 2, 240, 8, '#f5c542', 'center');
        } else if (state === 'dead' && deadT > 0.35) {
          ctx.fillStyle = 'rgba(13,21,17,.6)'; ctx.fillRect(14, 120, W - 28, 34);
          api.text(ctx, 'Autsch!', W / 2, 124, 8, '#f5c542', 'center');
          if (Math.floor(deadT * 2.5) % 2 === 0) api.text(ctx, 'Tippen = nochmal', W / 2, 140, 8, '#f6e7c8', 'center');
        }
      });

      reset();

      return function cleanup() {
        stop(); clearTimeout(toastTimer);
        root.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKey);
        try { if (actx) actx.close(); } catch (e) {}
        cv.destroy();
      };
    }
  };
})();

/* Foto-Safari – Ballonflug variant: fly through the beech forest and photograph forest animals with Eva's camera. */
(function () {
  'use strict';

  GAMES['flappy_foto'] = {
    title: 'Foto-Safari',
    intro: 'Tippe zum Fliegen. Tiere im Wald? Drück 📸, wenn sie im Sucher vor Eva sind! Sammle 6 gute Fotos.',
    start(root, api) {
      const W = 180, H = 320, GROUND = 296, GOAL = 6;
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;
      api.music('game');

      /* ---------- tuning (gentle) ---------- */
      const GRAV = 400, FLAP = -150, MAXFALL = 190, SPEED = 58, SPACING = 118, OB_W = 28;
      const BASE_GAP = 124, MERCY_STEP = 14, MERCY_MAX = 3;
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

      /* ---------- falling leaves ---------- */
      const LEAF_C = ['#d9822b', '#f2b33d', '#c9562c', '#b33a2a', '#e8a83a'];
      const leaves = [];
      for (let i = 0; i < 22; i++) leaves.push({ x: Math.random() * W, y: Math.random() * GROUND, vy: 10 + Math.random() * 14, ph: Math.random() * 6, c: LEAF_C[i % LEAF_C.length], far: i % 3 === 0 });

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

      /* ---------- animal sprites (pre-rendered at 1x, drawn at 2x in the scene) ---------- */
      const SPR = {
        eule: {
          rows: ['.b......b.', '.bbbbbbbb.', 'bbWWbbWWbb', 'bWkWbbWkWb', 'bbWWyyWWbb', '.bbbyybbb.', '.bLLLLLLb.', '.bLlLLlLb.', '.bLLLLLLb.', '.bbLlLlbb.', '..bbbbbb..', '..y..y....'],
          pal: { b: '#7a5434', W: '#f1e6c8', k: '#1b1b1b', y: '#f2b33d', L: '#c9a477', l: '#8a6440' }
        },
        hoernchen: {
          rows: ['.......rrr..', '.r....rrRrr.', 'rr....rRRrrr', 'rkr...rRrrr.', 'rrrr..rrrr..', '.rrrr.rrr...', '.nWrrrrrr...', '.nWrrrrr....', '..rrrrr.....', '..r..r......'],
          pal: { r: '#c4622d', R: '#e08a4a', W: '#f1e1c0', k: '#1b1b1b', n: '#7a4a22' }
        },
        fuchs: {
          rows: ['.o..o.........', '.oooo.........', 'oWkoo.........', 'kooooooooo....', '.WWooooooooo.o', '..Wooooooooooo', '...oooooooo.oW', '...o.o..o.o.WW', '...k.k..k.k...'],
          pal: { o: '#e0702a', W: '#f6ecd8', k: '#1b1b1b' }
        },
        reh: {
          rows: ['.a..a.......', '.a.a........', '..aa........', '.dd.........', 'dkdd........', 'nddd........', '.dDd........', '..dddddddd..', '..dWdWddddd.', '..ddddddddW.', '...dddddd...', '...d.d..d.d.', '...d.d..d.d.', '...k.k..k.k.'],
          pal: { a: '#5b3a24', d: '#a0683a', D: '#c08850', W: '#f1e1c0', k: '#1b1b1b', n: '#1b1b1b' }
        },
        pilz: {
          rows: ['..GGGG..', '.GgGGGG.', 'GGGGgGGG', 'GgGGGGGG', 'dGGGGGGd', '..wwww..', '..wkww..', '..wwww..', '.wwwwww.'],
          pal: { G: '#f5c542', g: '#fff4b0', d: '#c9a52a', w: '#f1e6c8', k: '#d8cbb0' }
        }
      };
      const sprCache = {};
      function sprite(kind, who) {
        const key = kind + (who || '');
        if (sprCache[key]) return sprCache[key];
        let c;
        if (kind === 'bomb') { c = layer(12, 16, g => api.drawChar(g, who, 'idle', 0, 0, 1, true)); }
        else { const s = SPR[kind]; c = layer(s.rows[0].length, s.rows.length, g => api.drawPixels(g, s.rows, s.pal, 0, 0, 1)); }
        sprCache[key] = c; return c;
      }
      const NAMES = { eule: 'Eule', hoernchen: 'Eichhörnchen', fuchs: 'Fuchs', reh: 'Reh', pilz: 'Goldener Pilz' };
      const CAPS = {
        reh: ['Reh, wie aus dem Bilderbuch', 'Reh im Herbstlicht', 'Reh, leicht verwackelt'],
        eule: ['Eule schaut direkt in die Kamera', 'Eule auf ihrem Ast', 'Eule (oder Blätterhaufen?)'],
        hoernchen: ['Eichhörnchen mit Nuss – perfekt!', 'Eichhörnchen, flink erwischt', 'Eichhörnchen-Schweif, unscharf'],
        fuchs: ['Fuchs, total fotogen', 'Fuchs schleicht vorbei', 'Fuchs, halb im Bild'],
        pilz: ['Der goldene Pilz! Extrem selten!', 'Goldener Pilz – ein Glücksfund', 'Goldener Pilz, leicht verwackelt']
      };
      const BOMB_CAP = { laurenz: 'Laurenz ruiniert das Foto', magnus: 'Magnus ruiniert das Foto', niklas: 'Niklas grinst ins Bild' };

      /* ---------- viewfinder (ahead of Eva, follows her height) ---------- */
      const VF_L = 80, VF_W = 60, VF_H = 62;
      function viewfinder() { const t = Math.round(y) - 14; return { l: VF_L, r: VF_L + VF_W, t, b: t + VF_H, cx: VF_L + VF_W / 2, cy: t + VF_H / 2 }; }
      function animalCenter(a) { const s = sprite(a.kind, a.who); return { x: a.x, y: a.y + Math.sin(frameT * 3 + a.ph) * (a.kind === 'eule' ? 0 : 1) }; }
      function inFrame(a, vf) { const c = animalCenter(a); return c.x > vf.l && c.x < vf.r && c.y > vf.t && c.y < vf.b; }

      function drawBgTrunk(x) {
        ctx.fillStyle = '#a9b0a3'; ctx.fillRect(x - 6, 0, 12, GROUND);
        ctx.fillStyle = '#bcc2b6'; ctx.fillRect(x - 4, 0, 2, GROUND);
        ctx.fillStyle = '#8f978b'; ctx.fillRect(x + 4, 0, 2, GROUND);
      }
      function drawAnimal(a) {
        const s = sprite(a.kind, a.who), w = s.width * 2, h = s.height * 2;
        const c = animalCenter(a), ax = Math.round(c.x), ay = Math.round(c.y);
        const left = ax - w / 2, top = ay - h / 2, feet = Math.round(a.y) + h / 2;
        if (a.kind === 'bomb') {
          // peeks out from behind a background beech
          const peek = Math.max(0, Math.min(1, (W - a.x) / 50));
          drawBgTrunk(ax + 8);
          api.drawChar(ctx, a.who, 'idle', Math.round(ax + 8 - 12 - peek * 10), top, 2, true);
          ctx.fillStyle = '#a9b0a3'; ctx.fillRect(ax + 2, top - 2, 12, h + 4);
          ctx.fillStyle = '#bcc2b6'; ctx.fillRect(ax + 4, top - 2, 2, h + 4);
          if (!a.taken && Math.floor(frameT * 3) % 2) api.text(ctx, '!', ax - 10, top - 10, 8, '#f5c542', 'center');
          return;
        }
        if (a.perch === 'branch') {
          drawBgTrunk(ax + 16);
          ctx.fillStyle = '#6b4a30'; ctx.fillRect(ax - 14, feet, 30, 4);
          ctx.fillStyle = '#8a6440'; ctx.fillRect(ax - 14, feet, 30, 1);
          ctx.fillStyle = '#d9822b'; ctx.fillRect(ax - 18, feet - 2, 5, 4); ctx.fillStyle = '#f2b33d'; ctx.fillRect(ax - 15, feet + 2, 4, 3);
        } else {
          // pale rock pillar from the ground (background)
          ctx.fillStyle = '#9c9a8e';
          for (let yy = feet; yy < GROUND; yy++) { const hw = 13 + Math.floor((yy - feet) / 9); ctx.fillRect(ax - hw, yy, hw * 2, 1); }
          ctx.fillStyle = '#b3b1a5'; ctx.fillRect(ax - 12, feet, 10, GROUND - feet);
          ctx.fillStyle = '#7f9a4a'; ctx.fillRect(ax - 14, feet, 28, 3); ctx.fillStyle = '#9ab85a'; ctx.fillRect(ax - 10, feet, 12, 1);
        }
        ctx.drawImage(s, left, top, w, h);
        if (a.kind === 'pilz') { // sparkle
          ctx.fillStyle = '#fff4b0'; const k = Math.floor(frameT * 4) % 3;
          ctx.fillRect(left - 3 + k * 9, top - 3 + (k % 2) * 4, 2, 2);
        }
        if (a.kind === 'eule' && Math.floor(frameT * 1.3 + a.ph) % 4 === 0) { ctx.fillStyle = '#7a5434'; ctx.fillRect(left + 2, top + 6, 6, 2); ctx.fillRect(left + 12, top + 6, 6, 2); } // blink
      }

      /* ---------- state ---------- */
      let crashes = 0, state = 'ready', y = 140, vy = 0, scroll = 0, obs = [], animals = [], spawned = 0, nextSpawnAt = 0;
      let toastTimer = 0, deadT = 0, shake = 0, flashT = 0, winT = 0, won = false, frameT = 0, popT = 0;
      let photos = [], flying = [], pops = [], shotCD = 0, untilAnimal = 2, bag = [], bombTaken = false, sinceBomb = 0, albumEl = null;
      const gapSize = () => BASE_GAP + MERCY_STEP * Math.min(MERCY_MAX, Math.floor(crashes / 3));

      function reset() {
        state = 'ready'; y = 140; vy = 0; obs = []; animals = []; spawned = 0; nextSpawnAt = scroll + 150; deadT = 0; untilAnimal = 1;
      }
      function nextKind() {
        if (photos.length >= 2 && !bombTaken && sinceBomb >= 3) { sinceBomb = 0; return 'bomb'; }
        sinceBomb++;
        if (Math.random() < 0.12) return 'pilz';
        if (!bag.length) bag = ['reh', 'eule', 'hoernchen', 'fuchs'].sort(() => Math.random() - 0.5);
        return bag.pop();
      }
      let lastGapY = 150;
      function spawn() {
        const g = gapSize();
        const minC = 40 + g / 2, maxC = GROUND - 30 - g / 2;
        let c = lastGapY + (Math.random() * 2 - 1) * 55;
        if (spawned === 0) c = 150 + (Math.random() * 2 - 1) * 20;
        c = Math.max(minC, Math.min(maxC, c));
        lastGapY = c;
        const o = { x: W + 4, top: Math.round(c - g / 2), bot: Math.round(c + g / 2), passed: false, seed: (Math.random() * 97) | 0 };
        obs.push(o);
        spawned++;
        if (spawned >= 2 && --untilAnimal <= 0) {
          untilAnimal = 2 + (Math.random() < 0.35 ? 1 : 0);
          const kind = nextKind();
          const who = kind === 'bomb' ? ['magnus', 'laurenz', 'niklas'][(Math.random() * 3) | 0] : null;
          const ay = Math.max(70, Math.min(228, c + 16 + (Math.random() * 2 - 1) * 16));
          animals.push({ kind, who, x: o.x + OB_W + 46, y: ay, perch: (kind === 'eule' || kind === 'hoernchen') ? 'branch' : 'rock', ph: Math.random() * 6, taken: false });
        }
      }

      function hitbox() { return { l: EVA_X + 6, r: EVA_X + 19, t: y - 12, b: y + 30 }; }

      function crash() {
        state = 'dead'; deadT = 0; shake = 0.3; flashT = 0.12; crashes++;
        api.sfx('hit');
        if (crashes % 3 === 0 && crashes / 3 <= MERCY_MAX) toastTimer = setTimeout(() => api.toast('Die Lücken werden etwas größer!', 2000), 400);
      }

      function flap() {
        if (state === 'won') return;
        if (state === 'dead') { if (deadT < 0.35) return; reset(); }
        if (state === 'ready') { state = 'play'; nextSpawnAt = scroll + 60; }
        vy = FLAP; popT = 0.12;
        api.sfx('flap');
      }

      /* ---------- photo ---------- */
      const SLOT_W = 18, SLOT_H = 21, SLOT_GAP = 4, SLOT_X0 = Math.round((W - (GOAL * SLOT_W + (GOAL - 1) * SLOT_GAP)) / 2), SLOT_Y = 3;
      function takePhoto() {
        if (state === 'ready' || state === 'dead') { flap(); return; }
        if (state !== 'play' || shotCD > 0) return;
        shotCD = 0.35; flashT = Math.max(flashT, 0.16);
        api.sfx('click'); setTimeout(() => api.sfx('step'), 70);
        const vf = viewfinder();
        let best = null, bd = 9;
        animals.forEach(a => {
          if (a.taken || !inFrame(a, vf)) return;
          const c = animalCenter(a);
          const d = Math.max(Math.abs(c.x - vf.cx) / (VF_W / 2), Math.abs(c.y - vf.cy) / (VF_H / 2));
          if (d < bd) { bd = d; best = a; }
        });
        if (!best) { pops.push({ txt: 'Nichts im Sucher', x: vf.cx, y: vf.t - 6, t: 0, c: '#f6e7c8' }); return; }
        best.taken = true;
        const q = bd < 0.38 ? 0 : bd < 0.72 ? 1 : 2;
        const label = ['PERFEKT!', 'SCHARF!', 'Verwackelt!'][q];
        if (best.kind === 'bomb') bombTaken = true;
        const idx = photos.length;
        photos.push({ kind: best.kind, who: best.who, q });
        setTimeout(() => api.sfx(q === 0 ? 'ding' : 'coin'), 140);
        pops.push({ txt: best.kind === 'bomb' ? 'Fotobombe!' : label, x: vf.cx, y: vf.t - 6, t: 0, c: q === 0 ? '#f5c542' : '#ffffff' });
        const c = animalCenter(best);
        flying.push({ kind: best.kind, who: best.who, x0: c.x - 15, y0: c.y - 18, idx, t: 0 });
        if (photos.length >= GOAL) { state = 'won'; winT = 0; }
      }

      function drawPolaroid(kind, who, x, y, s) {
        const w = Math.round(SLOT_W * s), h = Math.round(SLOT_H * s);
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = '#f6f1e4'; ctx.fillRect(x, y, w, h);
        const iw = w - Math.round(4 * s), ih = h - Math.round(8 * s), ix = x + Math.round(2 * s), iy = y + Math.round(2 * s);
        ctx.fillStyle = '#6f9a7a'; ctx.fillRect(ix, iy, iw, ih);
        ctx.fillStyle = '#4f7a5a'; ctx.fillRect(ix, iy + ih - Math.max(1, Math.round(3 * s)), iw, Math.max(1, Math.round(3 * s)));
        const sp = sprite(kind, who), k = Math.min(iw / sp.width, ih / sp.height);
        const dw = sp.width * k, dh = sp.height * k;
        ctx.drawImage(sp, Math.round(ix + (iw - dw) / 2), Math.round(iy + (ih - dh) / 2), Math.round(dw), Math.round(dh));
      }

      /* ---------- album (DOM overlay) ---------- */
      function showAlbum() {
        if (albumEl) return;
        albumEl = document.createElement('div');
        albumEl.style.cssText = 'position:absolute;inset:0;z-index:5;background:rgba(43,28,18,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px 16px;box-sizing:border-box;overflow:auto;';
        albumEl.innerHTML = '<div style="font-family:\'Press Start 2P\',monospace;font-size:15px;color:#f5c542;text-shadow:2px 2px 0 #000">Fotoalbum</div>' +
          '<div style="font-family:VT323,monospace;font-size:18px;color:#f6e7c8">Evas Foto-Safari 📸</div>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,150px));gap:12px;width:100%;justify-content:center;';
        photos.forEach((p, i) => {
          const card = document.createElement('div');
          const rot = (i % 2 ? 1 : -1) * (1 + (i % 3));
          card.style.cssText = 'background:#f6f1e4;padding:6px 6px 4px;box-shadow:0 0 0 2px #000,4px 4px 0 rgba(0,0,0,.4);transform:rotate(' + rot + 'deg);';
          const cv2 = document.createElement('canvas'); cv2.width = 40; cv2.height = 30;
          cv2.style.cssText = 'width:100%;aspect-ratio:4/3;display:block;image-rendering:pixelated;';
          const g = cv2.getContext('2d'); g.imageSmoothingEnabled = false;
          g.fillStyle = '#7fb7d6'; g.fillRect(0, 0, 40, 30);
          g.fillStyle = '#c9562c'; g.fillRect(0, 0, 40, 4); g.fillStyle = '#e08a2e'; g.fillRect(6, 3, 10, 2); g.fillRect(26, 2, 8, 3);
          g.fillStyle = '#a9b0a3'; g.fillRect(3, 0, 3, 30); g.fillRect(34, 0, 3, 30);
          g.fillStyle = '#6b8a4a'; g.fillRect(0, 25, 40, 5);
          const sp = sprite(p.kind, p.who), k = Math.max(1, Math.floor(Math.min(34 / sp.width, 22 / sp.height)));
          const dx = Math.round((40 - sp.width * k) / 2) + (p.q === 2 ? 3 : 0), dy = 26 - sp.height * k;
          if (p.q === 2) { g.globalAlpha = 0.45; g.drawImage(sp, dx - 3, dy, sp.width * k, sp.height * k); g.globalAlpha = 1; }
          g.drawImage(sp, dx, dy, sp.width * k, sp.height * k);
          if (p.kind === 'bomb') { g.fillStyle = '#f5c542'; g.fillRect(6, 6, 2, 2); g.fillRect(31, 9, 2, 2); }
          const cap = document.createElement('div');
          cap.textContent = p.kind === 'bomb' ? BOMB_CAP[p.who] : CAPS[p.kind][p.q];
          cap.style.cssText = 'font-family:VT323,monospace;font-size:16px;line-height:1;color:#2b1c12;text-align:center;margin-top:4px;min-height:32px;display:flex;align-items:center;justify-content:center;';
          card.appendChild(cv2); card.appendChild(cap); grid.appendChild(card);
        });
        albumEl.appendChild(grid);
        const btn = document.createElement('button');
        btn.className = 'btn'; btn.textContent = 'Album zuklappen ✓';
        btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); finish(); });
        albumEl.appendChild(btn);
        albumEl.addEventListener('pointerdown', e => e.stopPropagation());
        root.appendChild(albumEl); camBtn.style.display = 'none';
        api.sfx('ding');
      }
      function finish() { if (won) return; won = true; api.win(); }

      /* ---------- input ---------- */
      const camBtn = document.createElement('button');
      camBtn.textContent = '📸';
      camBtn.setAttribute('aria-label', 'Foto machen');
      camBtn.style.cssText = 'position:absolute;right:14px;bottom:14px;z-index:4;width:76px;height:76px;border-radius:50%;border:4px solid #1b1b1b;background:#f5c542;font-size:36px;line-height:1;box-shadow:inset -4px -4px 0 rgba(0,0,0,.25),0 4px 0 #000;touch-action:none;cursor:pointer;padding:0;';
      camBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); camBtn.style.transform = 'translateY(3px)'; takePhoto(); });
      const camUp = () => { camBtn.style.transform = ''; };
      camBtn.addEventListener('pointerup', camUp); camBtn.addEventListener('pointerleave', camUp);
      root.appendChild(camBtn);

      function onPointer(e) { e.preventDefault(); flap(); }
      function onKey(e) {
        if (albumEl) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); finish(); } return; }
        if (e.code === 'KeyF' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) takePhoto(); }
        else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); if (!e.repeat) flap(); }
      }
      root.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);

      /* ---------- loop ---------- */
      const stop = api.loop((dt, t) => {
        frameT += dt;
        const moving = state === 'ready' || state === 'play' || state === 'won';
        const spd = moving ? SPEED : 0;
        scroll += spd * dt;
        shotCD = Math.max(0, shotCD - dt);

        if (state === 'ready') {
          y = 140 + Math.sin(frameT * 3) * 4;
        } else if (state === 'play' || state === 'won') {
          vy = Math.min(MAXFALL, vy + GRAV * dt);
          y += vy * dt;
          if (y < 34) { y = 34; if (vy < 0) vy = 0; } // ceiling below the photo strip
          if (state === 'won') {
            if (y > 150 && vy > 0) vy = FLAP * 0.7;
            winT += dt;
            if (winT > 1.3 && !flying.length) showAlbum();
          }
          if (state === 'play' && scroll >= nextSpawnAt) { spawn(); nextSpawnAt = scroll + SPACING; }
          obs.forEach(o => { o.x -= spd * dt; });
          animals.forEach(a => { a.x -= spd * dt; });
          obs = obs.filter(o => o.x > -OB_W - 10);
          animals = animals.filter(a => a.x > -30);
          if (state === 'play') {
            const hb = hitbox();
            for (const o of obs) {
              if (hb.r > o.x + 1 && hb.l < o.x + OB_W - 1 && (hb.t < o.top - 2 || hb.b > o.bot)) { crash(); break; }
              if (!o.passed && o.x + OB_W < hb.l) o.passed = true;
            }
            if (state === 'play' && y + 32 >= GROUND) { y = GROUND - 32; crash(); }
          }
        } else if (state === 'dead') {
          deadT += dt;
          vy = Math.min(260, vy + GRAV * 1.3 * dt);
          y = Math.min(GROUND - 32, y + vy * dt);
        }
        shake = Math.max(0, shake - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt);
        flying.forEach(f => { f.t += dt; }); flying = flying.filter(f => f.t < 0.7);
        pops.forEach(p => { p.t += dt; }); pops = pops.filter(p => p.t < 1);

        leaves.forEach(l => {
          l.y += l.vy * dt; l.x += (Math.sin(frameT * 1.5 + l.ph) * 8 - spd * (l.far ? 0.3 : 0.8)) * dt;
          if (l.y > GROUND) { l.y = -4; l.x = Math.random() * (W + 40); }
          if (l.x < -4) l.x += W + 8;
        });

        /* ---------- draw ---------- */
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * 3), Math.round((Math.random() * 2 - 1) * 2));
        ctx.drawImage(sky, 0, 0);
        tile(far, scroll * 0.15, 0);
        leaves.forEach(l => { if (l.far) { ctx.fillStyle = l.c; ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1); } });
        tile(mid, scroll * 0.45, 0);
        animals.forEach(drawAnimal);
        obs.forEach(o => { drawBranch(Math.round(o.x), o.top, o.seed); drawTrunk(Math.round(o.x), o.bot); });
        tile(canopy, scroll * 0.6, -4);
        tile(ground, scroll, GROUND);

        const ey = Math.round(y);
        drawFlyer(EVA_X, ey, frameT, state === 'dead' ? 'idle' : 'jump');
        // camera in Eva's hand
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(EVA_X + 18, ey + 15, 7, 5);
        ctx.fillStyle = '#5a6a7a'; ctx.fillRect(EVA_X + 23, ey + 16, 3, 3);
        ctx.fillStyle = '#d94c3d'; ctx.fillRect(EVA_X + 19, ey + 14, 2, 1);
        if (popT > 0) {
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          ctx.fillRect(EVA_X + 6, ey + 34, 3, 2); ctx.fillRect(EVA_X + 14, ey + 35, 3, 2);
        }
        // viewfinder brackets
        if (state === 'play' || state === 'ready') {
          const vf = viewfinder();
          const hot = state === 'play' && animals.some(a => !a.taken && inFrame(a, vf));
          ctx.fillStyle = hot ? '#f5c542' : 'rgba(255,255,255,.55)';
          const L = 6, th = hot ? 2 : 1;
          [[vf.l, vf.t, 1, 1], [vf.r, vf.t, -1, 1], [vf.l, vf.b, 1, -1], [vf.r, vf.b, -1, -1]].forEach(([cx, cy, sx, sy]) => {
            ctx.fillRect(sx > 0 ? cx : cx - L, sy > 0 ? cy : cy - th, L, th);
            ctx.fillRect(sx > 0 ? cx : cx - th, sy > 0 ? cy : cy - L, th, L);
          });
          ctx.fillRect(Math.round(vf.cx) - 1, Math.round(vf.cy), 3, 1); ctx.fillRect(Math.round(vf.cx), Math.round(vf.cy) - 1, 1, 3);
        }
        leaves.forEach(l => {
          if (l.far) return;
          ctx.fillStyle = l.c; const lx = Math.round(l.x), ly = Math.round(l.y);
          ctx.fillRect(lx, ly, 3, 2); if (Math.sin(frameT * 4 + l.ph) > 0) ctx.fillRect(lx + 1, ly + 2, 1, 1);
        });
        ctx.restore();

        if (flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, flashT * 5).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }

        // pops (rating text)
        pops.forEach(p => api.text(ctx, p.txt, Math.round(p.x), Math.round(p.y - p.t * 14), 8, p.c, 'center'));

        // photo strip
        ctx.fillStyle = 'rgba(13,21,17,.45)'; ctx.fillRect(SLOT_X0 - 4, 0, GOAL * (SLOT_W + SLOT_GAP) + 4, SLOT_Y + SLOT_H + 14);
        for (let i = 0; i < GOAL; i++) {
          const sx = SLOT_X0 + i * (SLOT_W + SLOT_GAP);
          const landed = photos[i] && !flying.some(f => f.idx === i);
          if (landed) drawPolaroid(photos[i].kind, photos[i].who, sx, SLOT_Y, 1);
          else { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(sx, SLOT_Y, SLOT_W, 1); ctx.fillRect(sx, SLOT_Y + SLOT_H - 1, SLOT_W, 1); ctx.fillRect(sx, SLOT_Y, 1, SLOT_H); ctx.fillRect(sx + SLOT_W - 1, SLOT_Y, 1, SLOT_H); }
        }
        const shown = photos.length - flying.length;
        api.text(ctx, 'Fotos ' + shown + '/' + GOAL, W / 2, SLOT_Y + SLOT_H + 3, 8, '#ffffff', 'center');
        // flying polaroids
        flying.forEach(f => {
          const k = Math.min(1, f.t / 0.6), e = 1 - Math.pow(1 - k, 3);
          const tx = SLOT_X0 + f.idx * (SLOT_W + SLOT_GAP), s = 1.8 - 0.8 * e;
          drawPolaroid(f.kind, f.who, Math.round(f.x0 + (tx - f.x0) * e), Math.round(f.y0 + (SLOT_Y - f.y0) * e), s);
        });

        if (state === 'won' && !albumEl) {
          api.text(ctx, 'Album voll!', W / 2, 130, 16, '#f5c542', 'center');
        } else if (state === 'ready') {
          ctx.fillStyle = 'rgba(13,21,17,.6)'; ctx.fillRect(10, 206, W - 20, 46);
          api.text(ctx, 'Tippen = fliegen', W / 2, 210, 8, '#f6e7c8', 'center');
          api.text(ctx, '📸 wenn ein Tier', W / 2, 224, 8, '#f5c542', 'center');
          api.text(ctx, 'im Sucher ist', W / 2, 236, 8, '#f5c542', 'center');
        } else if (state === 'dead' && deadT > 0.35) {
          ctx.fillStyle = 'rgba(13,21,17,.6)'; ctx.fillRect(14, 120, W - 28, 46);
          api.text(ctx, 'Autsch!', W / 2, 124, 8, '#f5c542', 'center');
          api.text(ctx, 'Fotos bleiben', W / 2, 138, 8, '#f6e7c8', 'center');
          if (Math.floor(deadT * 2.5) % 2 === 0) api.text(ctx, 'Tippen = weiter', W / 2, 152, 8, '#f6e7c8', 'center');
        }
      });

      reset();

      return function cleanup() {
        stop(); clearTimeout(toastTimer);
        root.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKey);
        camBtn.remove(); if (albumEl) albumEl.remove();
        cv.destroy();
      };
    }
  };
})();

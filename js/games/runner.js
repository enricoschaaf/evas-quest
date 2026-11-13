/* Minimal offline runner: "Kein Internet" – Eva runs through 3 short levels (morning, noon, night). */
(function () {
  'use strict';

  const W = 180, H = 320;
  const GY = 220;          // ground line (y of Eva's feet)
  const EX = 28;           // Eva screen x
  const PPM = 10;          // pixels per meter
  const JUMP_V = 230, GRAV = 650, HOLD_GRAV = 0.45, HOLD_T = 0.22;

  const LEVELS = [
    { name: 'Morgenrunde', len: 150, speed: 100, ramp: 0.12, types: ['stone', 'mush', 'stone', 'log', 'mush2'],
      hint: ['Warmlaufen? Nö.', 'Direkt Vollgas!'],
      pal: { bg: '#f7f7f7', ink: '#535353', mid: '#acacac', faint: '#dcdcdc' } },
    { name: 'Mittagssonne', len: 200, speed: 112, ramp: 0.1, types: ['stone', 'mush', 'log', 'mush2'],
      hint: ['Schneller! Jetzt auch', 'Baumstämme & Pilzgruppen'],
      pal: { bg: '#fbf1df', ink: '#6e4e33', mid: '#c4a079', faint: '#efdcbc' } },
    { name: 'Nachtwanderung', len: 250, speed: 122, ramp: 0.1, types: ['stone', 'mush', 'log', 'mush2', 'bat'],
      hint: ['Fledermäuse: NICHT springen –', 'einfach drunter durchlaufen!'],
      pal: { bg: '#202124', ink: '#e8eaed', mid: '#8a8d92', faint: '#3c3f44' } }
  ];

  function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  /* ---------- sprites (monochrome: I = ink, M = mid, B = background) ---------- */
  const MUSH = ['..III..', '.IIBII.', 'IBIIIBI', 'IIIIIII', '..MMM..', '..MIM..', '.MMMMM.'];
  const STONE = ['..IIII..', '.IIMIII.', 'IIIIIMII', 'IIIIIIII'];
  const LOG = ['.IIIIIIIIMM.', 'IMIIMIIIMBBM', 'IIIIIIIIMBIM', 'IIMIIIMIMBBM', '.IIIIIIIIMM.'];
  const BAT = [
    ['I.......I', 'II.I.I.II', '.IIBIBII.', '...III...', '....I....'],
    ['...I.I...', '..IBIBI..', '.IIIIIII.', 'II.III.II', 'I...I...I']];
  // Start-screen icon: sad Eva head + unplugged cable (greyscale, like an error page icon)
  const ICON = [
    '....H.HHH.H.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHSSSSSSSSHH..',
    '.HHSSSSSSSSSSHH.',
    '.HHGGGGSSGGGGHH.',
    '.HHGWWGGGGWWGHH.',
    '.HHGGGGSSGGGGHH.',
    '..HSSSSSSSSSSH..',
    '..HSSSTSSSSSSH..',
    '..HSSSTKKKKSSH..',
    '...SSKSSSSKSS...',
    '....SSSSSSSS....',
    '......SSSS......',
    '....JJJJJJJJ....',
    '..JJJJJJJJJJJJ..'];
  const ICON_P = { H: '#5f6368', S: '#d5d7da', G: '#3c4043', W: '#f1f3f4', K: '#3c4043', J: '#9aa0a6', T: '#8ab4f8' };
  const PLUG = ['..P..P..', '..P..P..', 'PPPPPPPP', 'PPPPPPPP', '.PPPPPP.', '..PPPP..', '...CC...', '...C....', '..CC....', '..C.....', '.CC.....'];
  const PLUG_P = { P: '#9aa0a6', C: '#5f6368' };

  GAMES['runner'] = {
    title: 'Offline-Lauf',
    intro: 'Oh nein, kein Internet! Lauf trotzdem durch 3 Level. Tippen = springen (gedrückt halten = höher).',
    start(root, api) {
      api.music('runner1');
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx;

      /* ---------- state ---------- */
      let mode = 'offline', modeT = 0, T = 0;
      let lvl = 0, L = LEVELS[0], P = L.pal;
      let s = 0;                 // scrolled pixels within the current level
      let lift = 0, vy = 0, onGround = true, holdT = 0, jumpBuf = 0, held = false;
      let animT = 0;
      let obstacles = [], nextAt = 0, nextType = 'stone';
      let crashes = 0, mercy = 1;
      let shake = 0, endSpeed = 0, won = false, tapeBroken = false;
      const timers = [];

      const meters = () => s / PPM;
      const speedNow = () => (L.speed + L.ramp * meters()) * mercy;

      /* ---------- Eva, tinted to the level's monochrome palette ---------- */
      const evaCache = {};
      function evaSprite(frame) {
        const key = lvl + frame;
        if (evaCache[key]) return evaCache[key];
        const c = document.createElement('canvas'); c.width = 12; c.height = 16;
        const g = c.getContext('2d');
        api.drawChar(g, 'eva', frame, 0, 0, 1);
        try {
          const id = g.getImageData(0, 0, 12, 16), d = id.data;
          const ink = hexToRgb(P.ink), bg = hexToRgb(P.bg);
          for (let i = 0; i < d.length; i += 4) {
            if (!d[i + 3]) continue;
            // luminance → ink (dark parts) … towards background (light parts); keep enough contrast
            const y = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
            const k = clamp(y * 0.72, 0, 0.72);
            for (let j = 0; j < 3; j++) d[i + j] = Math.round(ink[j] + (bg[j] - ink[j]) * k);
          }
          g.putImageData(id, 0, 0);
        } catch (e) { /* tainted canvas – keep colour */ }
        evaCache[key] = c;
        return c;
      }

      /* ---------- input ---------- */
      function onPress() {
        if (mode === 'offline') { mode = 'intro'; modeT = 0; api.sfx('click'); return; }
        if (mode === 'banner' && modeT > 0.6) { go(); return; }
        if (mode === 'run') { if (onGround) doJump(); else jumpBuf = 0.14; return; }
        if (mode === 'crash' && modeT > 0.35) restart();
      }
      function press(e) { if (e && e.cancelable) e.preventDefault(); if (held) return; held = true; onPress(); }
      function release() { held = false; }
      const KEYS = ['Space', 'ArrowUp', 'KeyW', 'Enter'];
      function keydown(e) { if (KEYS.indexOf(e.code) < 0) return; e.preventDefault(); if (e.repeat) return; press(); }
      function keyup(e) { if (KEYS.indexOf(e.code) < 0) return; e.preventDefault(); release(); }
      root.addEventListener('pointerdown', press);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      window.addEventListener('keydown', keydown);
      window.addEventListener('keyup', keyup);

      function doJump() { vy = JUMP_V; lift = 0.01; onGround = false; holdT = 0; jumpBuf = 0; api.sfx('jump'); }

      /* ---------- levels ---------- */
      function startLevel(i) {
        lvl = i; L = LEVELS[i]; P = L.pal;
        crashes = 0; mercy = 1;
        resetRun();
        mode = 'banner'; modeT = 0;
        api.music('runner' + (i + 1));
      }
      function go() { mode = 'run'; modeT = 0; }
      function resetRun() {
        s = 0; lift = 0; vy = 0; onGround = true; jumpBuf = 0; holdT = 0;
        obstacles = []; nextAt = 110; nextType = pickType(true);
      }
      function restart() { resetRun(); mode = 'run'; modeT = 0; }

      /* ---------- obstacles ---------- */
      function pickType(first) {
        const ts = L.types;
        let t = ts[(Math.random() * ts.length) | 0];
        if (first && t === 'bat') t = 'stone';
        if (lvl === 2 && !first && Math.random() < 0.22) t = 'bat';
        return t;
      }
      function spawn(type) {
        const o = { type, x: 192, ph: Math.random() * 6 };
        if (type === 'stone') { o.w = 16; o.h = 8; o.ix = 2; o.iy = 2; }
        else if (type === 'mush') { o.w = 14; o.h = 14; o.ix = 3; o.iy = 3; }
        else if (type === 'mush2') { o.w = 26; o.h = 14; o.ix = 3; o.iy = 3; }
        else if (type === 'log') { o.w = 24; o.h = 10; o.ix = 2; o.iy = 2; }
        else if (type === 'bat') { o.w = 18; o.h = 10; o.ix = 3; o.iy = 2; }
        obstacles.push(o);
      }
      function gapFor(cur, next, sp) {
        let g = sp * 1.1 + Math.random() * sp * 0.8;
        if (cur === 'bat' || next === 'bat') g += sp * 0.9;   // room to land before / after a bat
        // spice: sometimes a quick follow-up obstacle right after landing (still always jumpable: airtime ≈ 0.75 s)
        else if (Math.random() < 0.3) g = sp * 0.95 + 26;
        return g;
      }
      function obsTop(o) {
        if (o.type === 'bat') return GY - 50 + Math.round(Math.sin(T * 4 + o.ph) * 1.5);
        return GY - o.h;
      }

      function crash() {
        mode = 'crash'; modeT = 0; crashes++; shake = 0.25;
        api.sfx('hit');
        if (crashes === 3 && mercy === 1) {
          mercy = 0.85;
          timers.push(setTimeout(() => api.toast('Etwas gemütlicher jetzt …', 1800), 250));
        }
      }

      /* ---------- update ---------- */
      function update(dt) {
        T += dt; modeT += dt;
        if (shake > 0) shake -= dt;

        if (mode === 'intro' && modeT > 0.8) startLevel(0);
        if (mode === 'banner' && modeT > 2.4) go();

        if (mode === 'run' || mode === 'clear' || mode === 'won') {
          const ending = mode !== 'run';
          const sp = ending ? endSpeed : speedNow();
          if (ending) endSpeed = Math.max(mode === 'clear' ? 40 : 0, endSpeed - 70 * dt);
          s += sp * dt;
          animT += dt * sp / 11;

          if (!onGround) {
            if (held && holdT < HOLD_T && vy > 0) { vy -= GRAV * HOLD_GRAV * dt; holdT += dt; }
            else { vy -= GRAV * dt; holdT = HOLD_T; }
            lift += vy * dt;
            if (lift <= 0) { lift = 0; vy = 0; onGround = true; if (jumpBuf > 0 && mode === 'run') doJump(); }
          }
          if (jumpBuf > 0) jumpBuf -= dt;

          for (let i = obstacles.length - 1; i >= 0; i--) {
            const o = obstacles[i]; o.x -= sp * dt;
            if (o.x < -40) obstacles.splice(i, 1);
          }

          if (mode === 'run') {
            if (s >= nextAt) {
              const stopAt = (L.len - 12) * PPM;
              if (s + (192 - EX) < stopAt) {
                const t = nextType; spawn(t);
                nextType = pickType(false);
                if (t === 'bat' && nextType === 'bat') nextType = 'stone';
                nextAt = s + gapFor(t, nextType, sp);
              } else nextAt = Infinity;
            }
            const ex0 = EX + 7, ex1 = EX + 16, ey0 = GY - lift - 27, ey1 = GY - lift - 3;
            for (const o of obstacles) {
              const top = obsTop(o);
              const ox0 = o.x + o.ix, ox1 = o.x + o.w - o.ix, oy0 = top + o.iy, oy1 = top + o.h - 1;
              if (ex1 > ox0 && ex0 < ox1 && ey1 > oy0 && ey0 < oy1) { crash(); break; }
            }
            if (mode === 'run' && s >= L.len * PPM) {
              endSpeed = sp; modeT = 0;
              if (lvl < LEVELS.length - 1) { mode = 'clear'; api.sfx('coin'); }
              else { mode = 'won'; tapeBroken = true; api.sfx('coin'); }
            }
          }
        }

        if (mode === 'clear' && modeT > 1.2) { api.sfx('ding'); startLevel(lvl + 1); }
        if (mode === 'crash' && modeT > 1.0) restart();
        if (mode === 'won') {
          if (endSpeed <= 0 && onGround && modeT > 1.2 && Math.random() < dt * 2) { vy = 140; lift = 0.01; onGround = false; holdT = HOLD_T; }
          if (!won && modeT > 1.0) { won = true; api.win(); }
        }
      }

      /* ---------- drawing ---------- */
      function vt(str, x, y, size, color, align) {
        ctx.save(); ctx.font = size + 'px VT323, monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore();
      }
      function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
      function spr(rows, x, y, sc) { api.drawPixels(ctx, rows, { I: P.ink, M: P.mid, B: P.bg }, Math.round(x), Math.round(y), sc || 2); }

      function cloud(x, y) {
        const c = P.mid;
        // outline only
        rect(x + 8, y, 12, 1, c); rect(x + 7, y + 1, 1, 1, c); rect(x + 20, y + 1, 1, 1, c);
        rect(x + 6, y + 2, 1, 3, c); rect(x + 21, y + 2, 1, 2, c); rect(x + 22, y + 4, 4, 1, c);
        rect(x + 2, y + 5, 5, 1, c); rect(x + 26, y + 5, 1, 3, c); rect(x + 1, y + 6, 1, 2, c);
        rect(x + 1, y + 8, 26, 1, c);
      }

      function drawWorld(groundReveal) {
        rect(0, 0, W, H, P.bg);
        if (lvl === 2) {
          // stars + moon
          for (let i = 0; i < 26; i++) {
            const x = (hash(i * 7 + 1) * W + T * 0.5 * (i % 3)) % W, y = 40 + hash(i * 13 + 5) * 140;
            if (((T * 1.3 + i) | 0) % 9 === 0) continue;
            rect(x, y, 1, 1, i % 4 ? P.mid : P.ink);
          }
          const mx = 134, my = 58;
          rect(mx + 3, my, 8, 14, P.ink); rect(mx + 1, my + 2, 12, 10, P.ink); rect(mx, my + 4, 14, 6, P.ink);
          rect(mx - 2, my + 1, 8, 12, P.bg); rect(mx - 3, my + 3, 8, 8, P.bg);
        } else if (lvl === 1) {
          // simple sun outline
          const sx = 140, sy = 60;
          rect(sx, sy, 12, 1, P.mid); rect(sx, sy + 11, 12, 1, P.mid); rect(sx - 2, sy + 2, 1, 8, P.mid); rect(sx + 13, sy + 2, 1, 8, P.mid);
          rect(sx - 1, sy + 1, 1, 1, P.mid); rect(sx + 12, sy + 1, 1, 1, P.mid); rect(sx - 1, sy + 10, 1, 1, P.mid); rect(sx + 12, sy + 10, 1, 1, P.mid);
        }
        // clouds
        for (let k = -1; k < 4; k++) {
          const off = s * 0.12, gap = 80, base = Math.floor(off / gap), id = base + k + lvl * 50;
          if (hash(id * 3) < 0.3) continue;
          cloud(Math.round((base + k) * gap - off + hash(id * 7) * 30), Math.round(70 + hash(id * 13) * 70));
        }
        // ground line with a few bumps
        const gw = groundReveal == null ? W : W * groundReveal;
        rect(0, GY, gw, 1, P.ink);
        const base = Math.floor(s / 5);
        for (let k = 0; k < W / 5 + 2; k++) {
          const id = base + k, x = id * 5 - s, r = hash(id + lvl * 999);
          if (x > gw) break;
          if (r < 0.06) rect(x, GY - 1, 3, 1, P.ink);
          if (r > 0.6) rect(x, GY + 3 + ((r * 100) | 0) % 6, r > 0.9 ? 2 : 1, 1, P.ink);
          const r2 = hash(id * 97 + 3);
          if (r2 < 0.18) rect(x + 2, GY + 6 + ((r2 * 400) | 0) % 14, 1, 1, P.mid);
        }
      }

      function drawGoal() {
        const gx = EX + 12 + (L.len * PPM - s);
        if (gx < -60 || gx > W + 60) return;
        if (lvl < LEVELS.length - 1) {
          // small level-end flag
          rect(gx, GY - 40, 2, 40, P.ink);
          rect(gx + 2, GY - 40, 16, 10, P.ink);
          rect(gx + 6, GY - 37, 2, 4, P.bg); rect(gx + 8, GY - 35, 2, 2, P.bg); rect(gx + 10, GY - 37, 2, 4, P.bg);
          return;
        }
        rect(gx - 22, GY - 74, 3, 74, P.ink); rect(gx + 22, GY - 74, 3, 74, P.ink);
        rect(gx - 24, GY - 82, 51, 14, P.ink);
        api.text(ctx, 'ZIEL', gx + 2, GY - 79, 8, P.bg, 'center', false);
        if (!tapeBroken) {
          for (let y = GY - 34; y < GY - 8; y += 4) { rect(gx, y, 2, 2, P.ink); rect(gx, y + 2, 2, 2, P.mid); }
        } else {
          const sw = Math.sin(T * 10) * 2;
          for (let i = 0; i < 4; i++) { rect(gx - 2 - i * 2 + sw * (i / 4), GY - 34 + i * 2, 2, 2, i % 2 ? P.mid : P.ink); rect(gx + 2 + i * 2 - sw * (i / 4), GY - 12 - i * 2, 2, 2, i % 2 ? P.mid : P.ink); }
        }
      }

      function drawObstacle(o) {
        const y = obsTop(o);
        if (o.type === 'stone') spr(STONE, o.x, y);
        else if (o.type === 'mush') spr(MUSH, o.x, y);
        else if (o.type === 'mush2') { spr(MUSH, o.x, y); spr(MUSH, o.x + 12, y); }
        else if (o.type === 'log') spr(LOG, o.x, y);
        else if (o.type === 'bat') {
          spr(BAT[((T * 8 + o.ph) | 0) % 2], o.x, y);
          // dotted shadow on the ground → "this one flies, stay down"
          for (let i = 0; i < 4; i++) rect(o.x + 2 + i * 4, GY + 2, 2, 1, P.mid);
        }
      }

      function drawEva() {
        let frame = 'idle';
        if (!onGround) frame = 'jump';
        else if (mode === 'run' || mode === 'clear' || (mode === 'won' && endSpeed > 8)) frame = ((animT | 0) % 2) ? 'run2' : 'run1';
        if (mode === 'crash' && ((modeT * 12) | 0) % 2) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(evaSprite(frame), EX, Math.round(GY - lift - 32), 24, 32);
      }

      function drawHUD() {
        const m = Math.min(L.len, Math.floor(meters()));
        api.text(ctx, 'LEVEL ' + (lvl + 1) + '/3', 6, 8, 8, P.ink, 'left', false);
        api.text(ctx, m + '/' + L.len + 'm', W - 6, 8, 8, P.ink, 'right', false);
        const bx = 6, bw = W - 12, by = 22;
        rect(bx, by, bw, 5, P.faint);
        rect(bx, by, Math.round(bw * m / L.len), 5, P.ink);
        // tiny level pips
        for (let i = 0; i < 3; i++) rect(W / 2 - 10 + i * 8, 32, 4, 4, i < lvl ? P.ink : i === lvl ? P.mid : P.faint);
      }

      function drawBanner() {
        const a = Math.min(1, modeT * 5);
        ctx.globalAlpha = a;
        rect(0, 70, W, 120, P.bg);
        rect(10, 76, W - 20, 1, P.ink); rect(10, 183, W - 20, 1, P.ink);
        api.text(ctx, 'LEVEL ' + (lvl + 1) + '/3', W / 2, 90, 16, P.ink, 'center', false);
        api.text(ctx, L.name, W / 2, 118, 8, P.ink, 'center', false);
        vt(L.hint[0], W / 2, 138, 14, P.mid, 'center');
        vt(L.hint[1], W / 2, 152, 14, P.mid, 'center');
        if (modeT > 0.6 && ((T * 3) | 0) % 2) vt('Tippen = los', W / 2, 166, 12, P.mid, 'center');
        ctx.globalAlpha = 1;
      }

      function drawOffline(alpha) {
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        rect(0, 0, W, H, '#ffffff');
        const bob = Math.round(Math.sin(T * 2) * 1);
        api.drawPixels(ctx, ICON, ICON_P, 50, 52 + bob, 3);
        api.drawPixels(ctx, PLUG, PLUG_P, 112, 82, 2);
        if (((T * 3) | 0) % 2) { rect(104, 78, 2, 2, '#9aa0a6'); rect(108, 74, 2, 2, '#9aa0a6'); }
        api.text(ctx, 'Kein Internet', 14, 122, 8, '#202124', 'left', false);
        vt("Versuch's mit Wandern:", 14, 140, 14, '#3c4043');
        vt('• Wanderschuhe anziehen', 18, 156, 14, '#5f6368');
        vt('• Rucksack aufsetzen', 18, 170, 14, '#5f6368');
        vt('• Router ignorieren', 18, 184, 14, '#5f6368');
        vt('ERR_WALD_DISCONNECTED', 14, 206, 12, '#9aa0a6');
        const pulse = 0.75 + Math.sin(T * 4) * 0.25;
        ctx.globalAlpha = alpha * pulse;
        rect(12, 252, W - 24, 22, '#1a73e8');
        rect(11, 253, 1, 20, '#1a73e8'); rect(W - 12, 253, 1, 20, '#1a73e8');
        ctx.globalAlpha = alpha;
        api.text(ctx, 'Tippen zum Starten', W / 2, 259, 8, '#ffffff', 'center', false);
        ctx.globalAlpha = 1;
      }

      function draw() {
        ctx.save();
        if (shake > 0) ctx.translate(((Math.random() * 4) | 0) - 2, ((Math.random() * 4) | 0) - 2);
        const reveal = mode === 'intro' ? clamp(modeT / 0.7, 0, 1) : mode === 'offline' ? 0 : 1;
        drawWorld(reveal);
        if (mode !== 'offline') {
          drawGoal();
          for (const o of obstacles) drawObstacle(o);
          drawEva();
          if (mode !== 'intro') drawHUD();
          if (mode === 'banner') drawBanner();
          if (mode === 'run' && lvl === 0 && meters() < 30) {
            api.text(ctx, 'Tippen = Springen', W / 2, 256, 8, P.ink, 'center', false);
            vt('gedrückt halten = höher', W / 2, 270, 14, P.mid, 'center');
          }
          if (mode === 'crash') {
            api.text(ctx, 'Nochmal!', W / 2, 100, 16, P.ink, 'center', false);
            vt('Level ' + (lvl + 1) + ' von vorn', W / 2, 124, 14, P.mid, 'center');
          }
          if (mode === 'clear') {
            api.text(ctx, 'Level geschafft!', W / 2, 100, 8, P.ink, 'center', false);
          }
          if (mode === 'won') {
            api.text(ctx, 'Geschafft!', W / 2, 92, 16, P.ink, 'center', false);
            vt('600 m offline gewandert', W / 2, 116, 14, P.mid, 'center');
          }
        }
        ctx.restore();
        if (mode === 'offline') drawOffline(1);
        else if (mode === 'intro') drawOffline(1 - modeT / 0.6);
      }

      const stop = api.loop(dt => { update(dt); draw(); });

      return function cleanup() {
        stop();
        timers.forEach(clearTimeout);
        root.removeEventListener('pointerdown', press);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        window.removeEventListener('keydown', keydown);
        window.removeEventListener('keyup', keyup);
        cv.destroy();
      };
    }
  };
})();

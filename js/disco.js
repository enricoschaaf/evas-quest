/* Disco party: the friends' present (a motorized disco ball) as a 16-bit dancefloor.
   window.Disco.start(root, api) -> cleanup. api = Engine.makeApi(...) */
(function () {
  'use strict';
  const E = window.Engine;

  function start(root, api) {
    const W = 180, H = 320;
    const cv = api.makeCanvas(root, W, H);
    const g = cv.ctx;
    api.music('disco');

    const FLOOR_Y = 196;
    const LIGHTS = ['#ff3fa4', '#3fe0ff', '#ffe23f', '#7cff4f', '#b45cff', '#ff8a2a'];
    const rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const LRGB = LIGHTS.map(rgb);

    /* ---------- beat clock (audio clock if running, else wall clock @120bpm) ---------- */
    const t0 = performance.now();
    function beatNow() {
      const b = E.Audio.beat && E.Audio.beat();
      if (b != null && E.Audio.bpm && E.Audio.bpm() === 120) return Math.max(0, b);
      return (performance.now() - t0) / 500;
    }

    /* ---------- static background (wall + ceiling) ---------- */
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const bgg = bg.getContext('2d');
    for (let y = 0; y < FLOOR_Y; y++) {
      const k = y / FLOOR_Y;
      bgg.fillStyle = `rgb(${18 + k * 14 | 0},${8 + k * 6 | 0},${34 + k * 18 | 0})`;
      bgg.fillRect(0, y, W, 1);
    }
    bgg.fillStyle = '#07040c'; bgg.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    // wall panels
    bgg.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = 6; x < W; x += 28) bgg.fillRect(x, 26, 1, FLOOR_Y - 30);
    bgg.fillStyle = '#0a0612'; bgg.fillRect(0, 0, W, 24);          // ceiling
    bgg.fillStyle = '#1c1428'; bgg.fillRect(0, 22, W, 2);
    bgg.fillStyle = '#05030a'; bgg.fillRect(0, FLOOR_Y - 4, W, 4); // skirting
    // speakers left/right
    function speaker(x) {
      bgg.fillStyle = '#111'; bgg.fillRect(x, 140, 22, 52);
      bgg.fillStyle = '#2a2a2a'; bgg.fillRect(x + 1, 141, 20, 50);
    }
    speaker(2); speaker(W - 24);

    /* ---------- floor tiles (fake perspective) ---------- */
    const ROWS = [14, 17, 20, 23, 27, 23]; // heights; sums to 124 = H - FLOOR_Y
    const tiles = [];
    let yy = FLOOR_Y;
    ROWS.forEach((rh, r) => {
      const cols = 7, rowW = 150 + r * 14 + (r === ROWS.length - 1 ? 30 : 0);
      const tw = rowW / cols, x0 = (W - rowW) / 2;
      for (let c = 0; c < cols; c++) tiles.push({ r, c, x: Math.round(x0 + c * tw), y: yy, w: Math.round(x0 + (c + 1) * tw) - Math.round(x0 + c * tw), h: rh });
      yy += rh;
    });

    /* ---------- disco ball precompute ---------- */
    const BX = 90, BY = 80, BR = 25, BD = BR * 2 + 1;
    const ball = document.createElement('canvas'); ball.width = BD; ball.height = BD;
    const ballG = ball.getContext('2d');
    const img = ballG.createImageData(BD, BD);
    const px = []; // {i, lat, lon, shade}
    const LATN = 11, LONN = 22;
    for (let y = 0; y < BD; y++) for (let x = 0; x < BD; x++) {
      const nx = (x - BR) / BR, ny = (y - BR) / BR, d = nx * nx + ny * ny;
      if (d > 1) continue;
      const nz = Math.sqrt(1 - d);
      const lat = Math.asin(ny), lon = Math.atan2(nx, nz);
      const light = 0.35 + 0.65 * Math.max(0, -nx * 0.45 - ny * 0.55 + nz * 0.7);
      const latf = (lat / Math.PI + 0.5) * LATN;
      px.push({ i: (y * BD + x) * 4, latf, lon, cosl: Math.cos(lat), light, edge: d > 0.86 });
    }
    const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    function renderBall(rot, beat) {
      const d = img.data, bi = Math.floor(beat), tint = LRGB[bi % LRGB.length];
      for (let k = 0; k < px.length; k++) {
        const p = px[k];
        const fi = Math.floor(p.latf), fr = p.latf - fi;
        const ncols = Math.max(4, Math.round(LONN * p.cosl * 0.5) * 2); // fewer facets towards the poles
        const lf = ((p.lon + rot) / (Math.PI * 2)) * ncols;
        const fj = Math.floor(lf), fc = lf - fj;
        const jj = ((fj % ncols) + ncols) % ncols;
        const grout = fr < 0.12 || fc < 0.12 / Math.max(0.3, p.cosl);
        const h = hash(fi, jj);
        let v = (0.45 + h * 0.55) * p.light * 255;
        let r = v, gg = v, b = v * 1.06;
        // some facets reflect the current light colour
        if (h > 0.72) { r = r * 0.5 + tint[0] * 0.5 * p.light; gg = gg * 0.5 + tint[1] * 0.5 * p.light; b = b * 0.5 + tint[2] * 0.5 * p.light; }
        // sparkle: facet flashes white briefly
        if (((h * 97 + beat * 0.5) % 1) < 0.04) { r = gg = b = 255; }
        if (grout) { r *= 0.35; gg *= 0.35; b *= 0.4; }
        if (p.edge) { r *= 0.7; gg *= 0.7; b *= 0.8; }
        d[p.i] = r > 255 ? 255 : r; d[p.i + 1] = gg > 255 ? 255 : gg; d[p.i + 2] = b > 255 ? 255 : b; d[p.i + 3] = 255;
      }
      ballG.putImageData(img, 0, 0);
    }

    /* ---------- reflection dots ---------- */
    const DOTS = [];
    for (let i = 0; i < 46; i++) DOTS.push({ a: Math.random(), y: 30 + Math.random() * (H - 40), sp: 0.7 + Math.random() * 0.6, c: Math.random() < 0.6 ? -1 : (Math.random() * LIGHTS.length | 0), s: Math.random() < 0.25 ? 2 : 1 });

    /* ---------- dancers ---------- */
    const DANCERS = [
      { who: 'magnus', x: 30, y: 246, style: 'side', off: 1 },
      { who: 'laurenz', x: 150, y: 246, style: 'pogo', off: 0 },
      { who: 'eva', x: 78, y: 280, style: 'couple', off: 0, side: 0 },
      { who: 'hannah', x: 38, y: 306, style: 'sway', off: 2 },
      { who: 'enrico', x: 142, y: 306, style: 'robot', off: 3 },
      { who: 'niklas', x: 102, y: 280, style: 'couple', off: 0, side: 1 }
    ];
    // Eva & Niklas (getting married!) dance as a couple; hearts float up between them
    const HEARTS = [];
    const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    let lastHeartBeat = -1;
    function pose(d, beat) {
      const b = beat + d.off * 0.0, bi = Math.floor(b), f = b - bi, bar = ((bi % 4) + 4) % 4;
      const bounce = Math.sin(Math.PI * f);
      let dx = 0, dy = -bounce * 3, frame = bi % 2 ? 'run1' : 'run2', flip = false;
      switch (d.style) {
        case 'star': // Eva: bounce, spin, big jump on beat 4
          if (bar === 3) { dy = -bounce * 14; frame = 'jump'; }
          else if (bar === 2) { flip = f > 0.5; frame = f > 0.5 ? 'run1' : 'run2'; }
          else flip = ((bi >> 2) % 2) === 1;
          break;
        case 'side': // Magnus: sidestep, turns every beat
          dx = Math.sin(b * Math.PI / 2) * 6; flip = (bi % 2) === 1; dy = -bounce * 2;
          break;
        case 'pogo': // Laurenz: jumps on 2 and 4
          if (bar % 2 === 1) { dy = -bounce * 10; frame = 'jump'; } else { dy = 0; frame = 'idle'; }
          flip = true;
          break;
        case 'couple': { // face each other, bounce together, swap sides with a twirl every 4 bars
          const twirl = ((bi >> 2) % 4) === 3;
          dy = -bounce * 3;
          flip = d.side === 1;
          if (twirl) { dx = (d.side ? -1 : 1) * Math.sin(Math.PI * ((bi % 4) + f) / 4) * 12; flip = (bi % 2) === 1; frame = bar === 3 ? 'jump' : frame; if (bar === 3) dy = -bounce * 8; }
          else frame = bar % 2 ? 'run1' : 'idle';
          break;
        }
        case 'sway': // Hannah: hips sway on half beats, flip every bar
          dx = Math.sin(b * Math.PI) * 3; dy = -Math.abs(Math.sin(b * Math.PI)) * 2;
          flip = ((bi >> 2) % 2) === 1; frame = bar % 2 ? 'run1' : 'idle';
          if (((bi >> 3) % 2) && bar === 3) { dy = -bounce * 9; frame = 'jump'; }
          break;
        case 'robot': // Enrico: stiff robot steps on 8ths, moonwalk
          dx = (Math.floor(b * 2) % 4 - 1.5) * 2; dy = (Math.floor(b * 2) % 2) ? -2 : 0;
          frame = ['idle', 'run1', 'idle', 'run2'][Math.floor(b * 2) % 4];
          flip = ((bi >> 1) % 2) === 0;
          break;
      }
      return { dx, dy, frame, flip };
    }

    /* ---------- particles / tap fx ---------- */
    const P = [], POPS = [];
    let flash = 0, hintT = 5;
    const CONF = ['#f5c542', '#d94c3d', '#6fae4f', '#4a7fd9', '#f2a7b8', '#8a5bd9', '#fff', '#3fe0ff'];
    function burst(x, y) {
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
        P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, c: CONF[Math.random() * CONF.length | 0], life: 1.6 + Math.random(), ph: Math.random() * 6 });
      }
      if (P.length > 400) P.splice(0, P.length - 400);
      POPS.push({ x, y, t: 0 });
      flash = 1; hintT = 0;
      api.sfx('coin');
    }
    // Swipe to spin the disco ball (with momentum); a short tap without movement = confetti
    let drag = null, spin = 1.6;           // spin = rotation speed (rad/s); motor keeps it at >= 1.6 when idle
    const onDown = e => { e.preventDefault(); const p = cv.pointer(e); drag = { x0: p.x, y0: p.y, x: p.x, t: performance.now(), moved: 0 }; try { cv.canvas.setPointerCapture(e.pointerId); } catch (_) {} };
    const onMove = e => {
      if (!drag) return;
      const p = cv.pointer(e), dx = p.x - drag.x, now = performance.now(), dtm = Math.max(8, now - drag.t);
      drag.moved += Math.abs(dx); drag.x = p.x; drag.t = now;
      if (drag.moved > 6) { spin = Math.max(-40, Math.min(40, spin * 0.6 + (dx / dtm) * 1000 * 0.08)); hintT = 0; }
    };
    const onUp = e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved <= 6) burst(Math.max(10, Math.min(W - 10, d.x0)), Math.max(10, Math.min(H - 10, d.y0)));
      else if (Math.abs(spin) > 12) api.sfx('launch');
    };
    const onKey = e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); burst(30 + Math.random() * 120, 120 + Math.random() * 120); } };
    cv.canvas.addEventListener('pointerdown', onDown);
    cv.canvas.addEventListener('pointermove', onMove);
    cv.canvas.addEventListener('pointerup', onUp);
    cv.canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);

    /* ---------- drawing helpers ---------- */
    function beam(x, y, ang, len, spread, color, alpha) {
      g.globalAlpha = alpha; g.fillStyle = color;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang - spread) * len, y + Math.sin(ang - spread) * len);
      g.lineTo(x + Math.cos(ang + spread) * len, y + Math.sin(ang + spread) * len);
      g.closePath(); g.fill();
    }
    function neon(str, y, col, glow, k) {
      g.save();
      g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
      g.globalAlpha = 0.35 + 0.4 * k; g.fillStyle = glow;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, 2], [0, -2]]) g.fillText(str, W / 2 + ox, y + oy);
      g.globalAlpha = 1; g.fillStyle = col; g.fillText(str, W / 2, y);
      g.restore();
    }

    let rot = 0, motorA = 0;
    const stop = api.loop((dt, t) => {
      const beat = beatNow();
      const bi = Math.floor(beat), bf = beat - bi, bar = Math.floor(bi / 4);
      const pulse = Math.pow(1 - ((bf % 1) + 1) % 1, 2); // 1 on the beat, decays
      // momentum: spin decays back toward the motor speed; the motor whirs faster when spun hard
      if (!drag) spin += (1.6 - spin) * Math.min(1, dt * 0.6);
      rot += dt * spin; motorA += dt * (22 + Math.abs(spin) * 6);

      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.drawImage(bg, 0, 0);

      // floor tiles: pattern changes every bar
      const mode = ((bar % 4) + 4) % 4;
      for (let i = 0; i < tiles.length; i++) {
        const tl = tiles[i];
        let on, ci;
        if (mode === 0) { on = (tl.r + tl.c + bi) % 2 === 0; ci = (bi + tl.r) % LIGHTS.length; }
        else if (mode === 1) { on = ((tl.c - bi % 7 + 7) % 7) < 2 || ((tl.r + bi) % 6) === 0; ci = (tl.c + bi) % LIGHTS.length; }
        else if (mode === 2) { const dist = Math.abs(tl.c - 3) + Math.abs(tl.r - 4); on = dist % 3 === bi % 3; ci = (dist + bi) % LIGHTS.length; }
        else { on = hash(tl.r * 7 + tl.c, bi) > 0.45; ci = Math.floor(hash(tl.c, tl.r + bi) * LIGHTS.length); }
        ci = ((ci % LIGHTS.length) + LIGHTS.length) % LIGHTS.length;
        g.fillStyle = '#0c0814'; g.fillRect(tl.x, tl.y, tl.w, tl.h);
        g.globalAlpha = on ? 0.55 + 0.45 * pulse : 0.12;
        g.fillStyle = LIGHTS[ci]; g.fillRect(tl.x + 1, tl.y + 1, tl.w - 2, tl.h - 2);
        if (on) { g.globalAlpha = 0.35 * pulse + 0.2; g.fillStyle = '#fff'; g.fillRect(tl.x + 2, tl.y + 2, tl.w - 4, 1); }
        g.globalAlpha = 1;
      }

      // light beams (additive)
      g.globalCompositeOperation = 'lighter';
      const c1 = LIGHTS[bi % LIGHTS.length], c2 = LIGHTS[(bi + 3) % LIGHTS.length];
      beam(4, 24, Math.PI * 0.32 + Math.sin(t * 0.9) * 0.45, 300, 0.07, c1, 0.13 + 0.07 * pulse);
      beam(W - 4, 24, Math.PI * 0.68 + Math.sin(t * 1.1 + 1) * 0.45, 300, 0.07, c2, 0.13 + 0.07 * pulse);
      for (let k = 0; k < 4; k++) {
        const a = rot * 1.3 + k * Math.PI / 2;
        beam(BX, BY, Math.PI / 2 + Math.sin(a) * 1.2, 260, 0.025, LIGHTS[(k + bi) % LIGHTS.length], 0.1);
      }
      // spotlight on the couple (Eva & Niklas)
      const eva = DANCERS[2], cx = 90;
      beam(BX, 24, Math.PI / 2, eva.y - 18, 0.16, '#fff6c8', 0.1 + 0.05 * pulse);
      g.globalAlpha = 0.28; g.fillStyle = '#fff6c8';
      g.beginPath(); g.ellipse(cx, eva.y, 28, 6, 0, 0, Math.PI * 2); g.fill();

      // reflection dots sweeping across walls and floor
      for (let i = 0; i < DOTS.length; i++) {
        const d = DOTS[i];
        const xx = ((((d.a + rot * 0.08 * d.sp) % 1) + 1) % 1) * (W + 20) - 10;
        g.globalAlpha = 0.55 + 0.4 * Math.sin(t * 6 + i);
        g.fillStyle = d.c < 0 ? '#ffffff' : LIGHTS[d.c];
        g.fillRect(xx | 0, d.y | 0, d.s + 1, d.s);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';

      // ceiling mount, motor box, chain
      g.fillStyle = '#3a3346'; g.fillRect(BX - 10, 22, 20, 3);
      g.fillStyle = '#5a5568'; g.fillRect(BX - 8, 25, 16, 11);          // motor housing
      g.fillStyle = '#7a7590'; g.fillRect(BX - 8, 25, 16, 2);
      g.fillStyle = '#2a2636'; g.fillRect(BX - 6, 29, 12, 5);           // vent slot
      const ph = Math.floor(motorA) % 4;                                  // spinning fan blades in the slot
      g.fillStyle = '#9a96b0'; for (let k = 0; k < 3; k++) g.fillRect(BX - 6 + ((k * 4 + ph) % 12), 29, 2, 5);
      g.fillStyle = (Math.floor(t * 4) % 2) ? '#5cff6a' : '#1d6a24'; g.fillRect(BX + 5, 26, 2, 2); // LED
      // whirr lines
      g.fillStyle = 'rgba(220,220,255,0.6)';
      if (ph % 2) { g.fillRect(BX - 12, 28, 2, 1); g.fillRect(BX + 10, 32, 2, 1); } else { g.fillRect(BX - 13, 32, 2, 1); g.fillRect(BX + 11, 28, 2, 1); }
      // rotating chain links
      for (let y = 36; y < BY - BR; y += 3) {
        const alt = ((y / 3 | 0) + Math.floor(rot * 6)) % 2;
        g.fillStyle = alt ? '#c8c8d4' : '#7a7a88';
        g.fillRect(BX - (alt ? 1 : 0), y, alt ? 3 : 1, 2);
      }

      // disco ball
      renderBall(rot, beat);
      g.drawImage(ball, BX - BR, BY - BR);
      // glints
      for (let k = 0; k < 5; k++) {
        const s = (t * 1.7 + k * 0.37) % 1;
        if (s > 0.35) continue;
        const sz = s < 0.17 ? 2 + (s * 18 | 0) % 3 : 2;
        const ang = k * 2.4 + Math.floor(t * 1.7 + k * 0.37) * 1.3, rr = BR * (0.3 + (k * 0.17) % 0.6);
        const gx = BX + Math.cos(ang) * rr | 0, gy = BY + Math.sin(ang) * rr | 0;
        g.fillStyle = '#fff';
        g.fillRect(gx - sz, gy, sz * 2 + 1, 1); g.fillRect(gx, gy - sz, 1, sz * 2 + 1);
      }
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(BX - 13, BY - 15, 3, 2); // highlight

      // dancers (depth sorted by y)
      for (let i = 0; i < DANCERS.length; i++) {
        const d = DANCERS[i], p = pose(d, beat);
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(d.x - 10 + p.dx | 0, d.y - 2, 20, 3);
        api.drawChar(g, d.who, p.frame, Math.round(d.x - 12 + p.dx), Math.round(d.y - 32 + p.dy), 2, p.flip);
      }

      // hearts rising from the couple
      if (bi !== lastHeartBeat) { lastHeartBeat = bi; HEARTS.push({ x: 90 + (Math.random() - 0.5) * 10, y: eva.y - 34, t: 0, c: Math.random() < 0.5 ? '#ff3f7a' : '#ff8fb8' }); }
      for (let i = HEARTS.length - 1; i >= 0; i--) {
        const h = HEARTS[i]; h.t += dt; h.y -= 18 * dt; h.x += Math.sin(h.t * 4) * 0.3;
        if (h.t > 2.2) { HEARTS.splice(i, 1); continue; }
        g.globalAlpha = Math.min(1, (2.2 - h.t) * 1.5);
        api.drawPixels(g, HEART, { X: h.c }, h.x - 3 | 0, h.y | 0, 1);
        g.globalAlpha = 1;
      }

      // confetti
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.vy += 120 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.ph += dt * 10;
        if (p.life <= 0 || p.y > H + 4) { P.splice(i, 1); continue; }
        g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, Math.sin(p.ph) > 0 ? 2 : 1, 2);
      }
      // 🎉 pops
      for (let i = POPS.length - 1; i >= 0; i--) {
        const p = POPS[i]; p.t += dt;
        if (p.t > 0.9) { POPS.splice(i, 1); continue; }
        g.save();
        g.globalAlpha = Math.min(1, 2 * (0.9 - p.t) / 0.9);
        g.font = (12 + Math.min(1, p.t * 6) * 10 | 0) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🎉', p.x, p.y - p.t * 30);
        g.restore();
      }

      // neon title (pulses on the beat)
      const nc = (bi % 2) ? ['#ffd1ef', '#ff3fa4'] : ['#d4fbff', '#3fe0ff'];
      neon('ALLES GUTE, EVA!', 6, nc[0], nc[1], pulse);
      neon('EVA & NIKLAS', 18, nc[1 - (bi % 2)] === undefined ? '#fff' : '#ffe9f3', '#ff3f7a', 1 - pulse);

      if (hintT > 0) {
        hintT -= dt;
        if (Math.floor(t * 2) % 2) api.text(g, 'WISCHEN = DREHEN', W / 2, 118, 8, '#fff', 'center');
      }

      // flash
      if (flash > 0) {
        g.globalAlpha = flash * 0.55; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
        flash = Math.max(0, flash - dt * 4);
      }
    });

    return function cleanup() {
      stop();
      cv.canvas.removeEventListener('pointerdown', onDown);
      cv.canvas.removeEventListener('pointermove', onMove);
      cv.canvas.removeEventListener('pointerup', onUp);
      cv.canvas.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
      cv.destroy();
      api.music('birthday');
    };
  }

  window.Disco = { start };
})();

/* Saft-Sortierer: color-sort puzzle on a forest picnic clearing. */
(function () {
  'use strict';

  const CAP = 4;
  // juice colors: [main, light, dark] — plus a tiny symbol for color-weak players
  const COLORS = [
    { m: '#e0483e', l: '#f27a6c', d: '#8f2620', sym: 'dot' },     // Kirsch
    { m: '#f5d442', l: '#fff08a', d: '#a88a1a', sym: 'bar' },     // Zitrone
    { m: '#5cc24a', l: '#9be36f', d: '#2c6e24', sym: 'plus' },    // Apfel
    { m: '#3f7fe0', l: '#7fb0f5', d: '#1d4590', sym: 'vbar' },    // Blaubeere
    { m: '#a35be0', l: '#cf9bf5', d: '#5a2a8a', sym: 'x' },       // Traube
    { m: '#f28a2b', l: '#ffb86a', d: '#9a4f12', sym: 'ring' }     // Orange (spare)
  ];
  const SYM = {
    dot: ['...', '.#.', '...'],
    bar: ['...', '###', '...'],
    plus: ['.#.', '###', '.#.'],
    vbar: ['.#.', '.#.', '.#.'],
    x: ['#.#', '.#.', '#.#'],
    ring: ['###', '#.#', '###']
  };

  const ROUNDS = [{ colors: 3, empty: 2, maxPairs: 2 }, { colors: 5, empty: 2, maxPairs: 3 }];

  /* ---------- puzzle logic ---------- */
  const top = b => b[b.length - 1];
  function topRun(b) { if (!b.length) return 0; const c = top(b); let k = 0; for (let i = b.length - 1; i >= 0 && b[i] === c; i--) k++; return k; }
  const uniformFull = b => b.length === CAP && b.every(c => c === b[0]);
  const isSolved = st => st.every(b => b.length === 0 || uniformFull(b));
  function canPour(st, i, j) {
    if (i === j) return false;
    const a = st[i], b = st[j];
    if (!a.length || b.length >= CAP || uniformFull(a)) return false;
    return !b.length || top(b) === top(a);
  }
  function pourAmount(st, i, j) { return Math.min(topRun(st[i]), CAP - st[j].length); }
  function doPour(st, i, j) {
    const n = pourAmount(st, i, j), c = top(st[i]);
    for (let k = 0; k < n; k++) { st[i].pop(); st[j].push(c); }
    return n;
  }
  const clone = st => st.map(b => b.slice());
  const key = st => st.map(b => b.join('')).sort().join('|');

  /** DFS solvability check. Returns true / false / null (gave up). */
  function solvable(start, limit) {
    const seen = new Set();
    let nodes = 0;
    function dfs(st) {
      if (isSolved(st)) return true;
      if (++nodes > limit) return null;
      const k = key(st);
      if (seen.has(k)) return false;
      seen.add(k);
      let unknown = false;
      for (let i = 0; i < st.length; i++) for (let j = 0; j < st.length; j++) {
        if (!canPour(st, i, j)) continue;
        // pouring a whole single-color stack into an empty bottle is pointless
        if (!st[j].length && topRun(st[i]) === st[i].length) continue;
        const n2 = clone(st); doPour(n2, i, j);
        const r = dfs(n2);
        if (r === true) return true;
        if (r === null) unknown = true;
      }
      return unknown ? null : false;
    }
    return dfs(clone(start));
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function generate(cfg) {
    const pick = shuffle([0, 1, 2, 3, 4]).slice(0, cfg.colors);
    for (let tries = 0; tries < 400; tries++) {
      const pool = [];
      pick.forEach(c => { for (let k = 0; k < CAP; k++) pool.push(c); });
      shuffle(pool);
      const st = [];
      for (let b = 0; b < cfg.colors; b++) st.push(pool.slice(b * CAP, b * CAP + CAP));
      for (let e = 0; e < cfg.empty; e++) st.push([]);
      let pairs = 0, bad = false;
      st.forEach(b => {
        for (let i = 1; i < b.length; i++) if (b[i] === b[i - 1]) pairs++;
        if (b.length && topRun(b) >= 3) bad = true;
      });
      if (bad || pairs > cfg.maxPairs) continue;
      if (solvable(st, 60000) === true) return shuffle(st);
    }
    // fallback (practically never reached): a simple solvable layout
    const st = pick.map((c, i) => [c, c, c, pick[(i + 1) % pick.length]]);
    st.push([]); st.push([]);
    return st;
  }

  /* ---------- game ---------- */
  GAMES['bottles'] = {
    title: 'Saft-Sortierer',
    intro: 'Sortier die Säfte! Tippe eine Flasche an und dann die, in die du gießen willst. Jede Flasche nur eine Farbe.',
    start(root, api) {
      api.music('game');
      const W = 180, H = 300;

      // layout: canvas area + HTML button bar
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;left:0;right:0;top:0;bottom:64px;';
      const bar = document.createElement('div');
      bar.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:64px;display:flex;gap:12px;justify-content:center;align-items:center;background:#2a1a10;border-top:3px solid #000;padding:0 8px;';
      const mkBtn = (label, cls) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = label; b.style.cssText = 'font-size:11px;padding:12px 10px;flex:1;max-width:200px;touch-action:manipulation;'; bar.appendChild(b); return b; };
      const undoBtn = mkBtn('↶ Rückgängig', 'ghost');
      const newBtn = mkBtn('Neu mischen');
      root.appendChild(wrap); root.appendChild(bar);

      const cv = api.makeCanvas(wrap, W, H);
      const ctx = cv.ctx;

      let round = 0, st = [], history = [], sel = -1, cursor = 0, anim = null, busy = false;
      let parts = [], cheer = 0, done = new Set(), roundDone = 0, finished = false, timers = [], hintShown = false;

      const LH = 12, BW = 24, NECKW = 12, NECKH = 8, BODYH = CAP * LH + 3, BH = BODYH + NECKH;
      const ROW_BASE = [168, 262];

      function layout() {
        const n = st.length, r1 = Math.ceil(n / 2), r2 = n - r1;
        const pos = [];
        for (let i = 0; i < n; i++) {
          const row = i < r1 ? 0 : 1, m = row ? r2 : r1, idx = row ? i - r1 : i;
          const span = 180;
          const sp = Math.min(48, span / m);
          const x0 = (span - sp * m) / 2 + sp / 2;
          pos.push({ x: Math.round(x0 + idx * sp), y: ROW_BASE[row], sp });
        }
        return pos;
      }
      let POS = [];

      function newRound(r) {
        round = r; st = generate(ROUNDS[r]); history = []; sel = -1; cursor = 0; anim = null; busy = false;
        POS = layout(); done = new Set(); st.forEach((b, i) => { if (uniformFull(b)) done.add(i); });
        roundDone = 0; hintShown = false;
      }
      newRound(0);

      function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); }

      /* --- input --- */
      function bottleAt(x, y) {
        for (let i = 0; i < POS.length; i++) {
          const p = POS[i];
          if (Math.abs(x - p.x) <= Math.max(16, p.sp / 2) && y <= p.y + 8 && y >= p.y - BH - 22) return i;
        }
        return -1;
      }
      function tap(i) {
        if (busy || finished || i < 0) return;
        cursor = i;
        if (sel < 0) {
          if (!st[i].length) { api.sfx('error'); return; }
          if (uniformFull(st[i])) { api.sfx('error'); return; }
          sel = i; api.sfx('click'); return;
        }
        if (sel === i) { sel = -1; api.sfx('step'); return; }
        if (canPour(st, sel, i)) { startPour(sel, i); sel = -1; return; }
        // not allowed: if tapped another valid source, switch selection
        if (st[i].length && !uniformFull(st[i])) { api.sfx('error'); sel = i; return; }
        api.sfx('error'); sel = -1;
      }
      function onDown(e) {
        e.preventDefault();
        const p = cv.pointer(e);
        tap(bottleAt(p.x, p.y));
      }
      function onKey(e) {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'a' || k === 'A') { cursor = (cursor + st.length - 1) % st.length; e.preventDefault(); }
        else if (k === 'ArrowRight' || k === 'd' || k === 'D') { cursor = (cursor + 1) % st.length; e.preventDefault(); }
        else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'ArrowDown' || k === 's' || k === 'S') {
          const r1 = Math.ceil(st.length / 2);
          cursor = cursor < r1 ? Math.min(st.length - 1, cursor + r1) : cursor - r1; e.preventDefault();
        }
        else if (k === ' ' || k === 'Enter') { tap(cursor); e.preventDefault(); }
        else if (k === 'u' || k === 'U' || k === 'z' || k === 'Z' || k === 'Backspace') { undo(); e.preventDefault(); }
        else if (k === 'r' || k === 'R') { reshuffle(); e.preventDefault(); }
      }
      function undo() {
        if (busy || finished) return;
        if (!history.length) { api.sfx('error'); return; }
        st = history.pop(); sel = -1; api.sfx('step');
        done = new Set(); st.forEach((b, i) => { if (uniformFull(b)) done.add(i); });
        hintShown = false;
      }
      function reshuffle() {
        if (busy || finished) return;
        api.sfx('click'); newRound(round);
      }
      const onUndo = e => { e.preventDefault(); undo(); };
      const onNew = e => { e.preventDefault(); reshuffle(); };
      cv.canvas.addEventListener('pointerdown', onDown);
      undoBtn.addEventListener('click', onUndo);
      newBtn.addEventListener('click', onNew);
      window.addEventListener('keydown', onKey);

      /* --- pouring --- */
      const T_MOVE = 0.2, T_TILT = 0.14, T_POUR = 0.34, T_UNTILT = 0.1, T_BACK = 0.2;
      function startPour(i, j) {
        busy = true;
        const n = pourAmount(st, i, j);
        anim = { i, j, n, c: top(st[i]), t: 0, committed: false, dir: POS[j].x >= POS[i].x ? 1 : -1 };
        if (POS[j].x === POS[i].x) anim.dir = POS[j].x > W / 2 ? -1 : 1;
        history.push(clone(st));
        if (history.length > 200) history.shift();
      }
      const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);

      function commitPour() {
        const a = anim;
        doPour(st, a.i, a.j);
        a.committed = true;
        if (uniformFull(st[a.j]) && !done.has(a.j)) {
          done.add(a.j); api.sfx('coin'); cheer = 1.6;
          const p = POS[a.j];
          for (let k = 0; k < 18; k++) parts.push({ x: p.x + (Math.random() - 0.5) * 20, y: p.y - BH / 2 + (Math.random() - 0.5) * 40, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40, life: 0.6 + Math.random() * 0.5, c: Math.random() < 0.5 ? '#fff6b0' : COLORS[a.c].l });
        }
      }
      function afterPour() {
        anim = null; busy = false;
        if (isSolved(st)) {
          busy = true;
          if (round === 0) {
            api.sfx('ding'); api.toast('Super! Runde 2 …', 1500);
            later(() => { newRound(1); }, 1400);
          } else {
            finished = true; cheer = 99;
            later(() => api.win(), 500);
          }
          return;
        }
        if (!hintShown && solvable(st, 8000) === false) {
          hintShown = true;
          api.toast('Hier geht\'s nicht weiter – tippe „Rückgängig“!', 2600);
        }
      }

      /* --- drawing helpers --- */
      function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

      // draws bottle with bottom-center at (0,0) in current transform. segs = [{c, h}] bottom→top in units
      function drawBottle(segs, opts) {
        const x0 = -BW / 2, yb = 0;
        // shadow-ish back glass
        rect(x0 + 1, yb - BODYH, BW - 2, BODYH, 'rgba(200,235,255,0.18)');
        // liquid
        let y = yb - 2;
        segs.forEach((s, idx) => {
          if (s.h <= 0) return;
          const hpx = Math.round(s.h * LH);
          const col = COLORS[s.c];
          rect(x0 + 2, y - hpx, BW - 4, hpx, col.m);
          rect(x0 + 2, y - hpx, 3, hpx, col.l);
          rect(x0 + BW - 5, y - hpx, 2, hpx, col.d);
          if (idx === segs.length - 1 || segs.slice(idx + 1).every(t => t.h <= 0)) rect(x0 + 2, y - hpx, BW - 4, 1, col.l);
          // symbol per full unit
          const units = Math.floor(s.h + 0.001);
          for (let u = 0; u < units; u++) {
            const sy = y - (u + 1) * LH + 4;
            if (sy < y - hpx) break;
            api.drawPixels(ctx, SYM[col.sym], { '#': col.d }, -2, sy, 1);
          }
          y -= hpx;
        });
        // glass outline
        const g = opts.done ? '#fff6b0' : '#d8f2ff';
        rect(x0, yb - BODYH, 1, BODYH, g); rect(x0 + BW - 1, yb - BODYH, 1, BODYH, g);
        rect(x0, yb - 1, BW, 1, g);
        rect(x0 + 1, yb - BODYH - 1, (BW - NECKW) / 2 - 1, 1, g);
        rect(x0 + BW / 2 + NECKW / 2, yb - BODYH - 1, (BW - NECKW) / 2 - 1, 1, g);
        rect(-NECKW / 2, yb - BH, 1, NECKH, g); rect(NECKW / 2 - 1, yb - BH, 1, NECKH, g);
        rect(-NECKW / 2 - 1, yb - BH - 1, NECKW + 2, 2, g);
        // shine
        rect(x0 + 3, yb - BODYH + 3, 1, 10, 'rgba(255,255,255,0.7)');
        if (opts.done) { // cork
          rect(-NECKW / 2 + 1, yb - BH - 4, NECKW - 2, 6, '#b5835a');
          rect(-NECKW / 2 + 1, yb - BH - 4, NECKW - 2, 1, '#d9a878');
        }
      }
      function segsOf(b, minus, plusC, plus) {
        const segs = b.map(c => ({ c, h: 1 }));
        let m = minus || 0;
        for (let k = segs.length - 1; k >= 0 && m > 0; k--) { const d = Math.min(segs[k].h, m); segs[k].h -= d; m -= d; }
        if (plus > 0) segs.push({ c: plusC, h: plus });
        return segs;
      }

      // static background into an offscreen canvas
      const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
      (function paintBg() {
        const g = bg.getContext('2d');
        const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
        // sky bands
        ['#f7c98a', '#f4b779', '#e9a06a', '#d9875e'].forEach((c, i) => R(0, i * 12, W, 12, c));
        R(0, 48, W, 40, '#c97650');
        // far trees (autumn)
        for (let x = -6; x < W; x += 14) {
          const h = 26 + ((x * 37) % 13);
          const c = ['#a9452c', '#d9822b', '#7a3a22', '#b8662a'][(x / 14 | 0) & 3];
          R(x + 3, 70 - h, 10, h, c); R(x + 1, 74 - h + 6, 14, h - 10, c); R(x + 7, 70, 2, 10, '#3b2416');
        }
        // meadow
        R(0, 78, W, H - 78, '#4f8a3c');
        for (let y = 80; y < H; y += 6) for (let x = (y * 7) % 11; x < W; x += 11) R(x, y, 1, 2, '#6fae4f');
        for (let i = 0; i < 26; i++) { const x = (i * 53) % W, y = 90 + (i * 97) % (H - 95); R(x, y, 2, 2, ['#f2a7b8', '#f5d442', '#ffffff'][i % 3]); }
        // picnic blanket + basket (top left)
        for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 8; xx++) R(8 + xx * 6, 80 + yy * 3, 6, 3, (xx + yy) % 2 ? '#f6e7c8' : '#d94c3d');
        R(20, 70, 18, 10, '#a8703c'); R(20, 70, 18, 2, '#c98f52'); R(22, 64, 2, 7, '#7a4a2a'); R(34, 64, 2, 7, '#7a4a2a'); R(22, 63, 14, 2, '#7a4a2a');
        R(40, 76, 6, 5, '#d94c3d'); R(42, 75, 1, 2, '#2c6e24'); // apple
        // logs / planks under each row
        ROW_BASE.forEach(y => {
          R(2, y, W - 4, 9, '#7a4a2a'); R(2, y, W - 4, 2, '#a8703c'); R(2, y + 7, W - 4, 2, '#3b2416');
          for (let x = 10; x < W - 6; x += 23) R(x, y + 3, 6, 1, '#5b3a24');
          R(0, y, 4, 9, '#c98f52'); R(1, y + 2, 2, 5, '#7a4a2a'); R(W - 4, y, 4, 9, '#c98f52'); R(W - 3, y + 2, 2, 5, '#7a4a2a');
          R(8, y + 9, 3, 6, '#3b2416'); R(W - 11, y + 9, 3, 6, '#3b2416');
        });
      })();

      /* --- main loop --- */
      let kbUsed = false;
      let time = 0;
      const stopLoop = api.loop((dt) => {
        time += dt;
        if (cheer > 0 && cheer < 50) cheer -= dt;
        // anim update
        if (anim) {
          anim.t += dt;
          const tp = T_MOVE + T_TILT + T_POUR;
          if (!anim.committed && anim.t >= tp) commitPour();
          if (anim.t >= tp + T_UNTILT + T_BACK) afterPour();
        }
        parts = parts.filter(p => (p.life -= dt) > 0);
        parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; });

        ctx.drawImage(bg, 0, 0);
        const r1 = Math.ceil(st.length / 2);
        api.text(ctx, 'Runde ' + (round + 1) + '/2', 4, 4, 8, '#fff');
        const nColors = ROUNDS[round].colors;
        api.text(ctx, done.size + '/' + nColors, W - 4, 4, 8, '#fff6b0', 'right');

        // Eva (top right), cheering
        const cheering = cheer > 0;
        const hop = cheering ? Math.abs(Math.sin(time * 10)) * 6 : 0;
        api.drawChar(ctx, 'eva', cheering ? (Math.sin(time * 10) > 0 ? 'jump' : 'idle') : 'idle', 134, 54 - hop, 2, true);
        if (cheering) {
          rect(96, 34, 40, 14, '#fff'); rect(130, 48, 4, 3, '#fff');
          api.text(ctx, finished ? 'Yay!' : 'Juhu!', 116, 37, 8, '#1b1b1b', 'center', false);
        }

        // bottles
        let drawLast = null;
        for (let i = 0; i < st.length; i++) {
          const p = POS[i];
          if (anim && anim.i === i) { drawLast = i; continue; }
          let segs;
          if (anim && anim.j === i && !anim.committed) {
            const pt = (anim.t - T_MOVE - T_TILT) / T_POUR;
            segs = segsOf(st[i], 0, anim.c, anim.n * Math.max(0, Math.min(1, pt)));
          } else segs = segsOf(st[i]);
          const lift = sel === i ? 8 : 0;
          ctx.save(); ctx.translate(p.x, p.y - lift);
          drawBottle(segs, { done: done.has(i) });
          ctx.restore();
          if (sel === i) { rect(p.x - 3, p.y - BH - lift - 10, 6, 2, '#fff6b0'); rect(p.x - 1, p.y - BH - lift - 8, 2, 2, '#fff6b0'); }
          if (cursor === i && !busy && kbUsed) { rect(p.x - BW / 2 - 2, p.y + 10, BW + 4, 2, '#fff'); }
        }
        if (drawLast !== null) {
          const a = anim, p = POS[a.i], q = POS[a.j];
          const tx = q.x - a.dir * 22, ty = q.y - BH - 6;  // bottle bottom position at pour
          const t1 = ease(a.t / T_MOVE);
          const tilt = ease((a.t - T_MOVE) / T_TILT) - ease((a.t - T_MOVE - T_TILT - T_POUR) / T_UNTILT);
          const back = ease((a.t - T_MOVE - T_TILT - T_POUR - T_UNTILT) / T_BACK);
          const f = t1 * (1 - back);
          const bx = p.x + (tx - p.x) * f, by = (p.y - 8) + (ty - (p.y - 8)) * f;
          const ang = a.dir * tilt * 1.3;
          const pt = Math.max(0, Math.min(1, (a.t - T_MOVE - T_TILT) / T_POUR));
          const segs = a.committed ? segsOf(st[a.i]) : segsOf(st[a.i], a.n * pt);
          // pivot around bottle middle
          const cy = by - BH / 2;
          ctx.save(); ctx.translate(bx, cy); ctx.rotate(ang); ctx.translate(0, BH / 2);
          drawBottle(segs, {});
          ctx.restore();
          // stream
          if (!a.committed && a.t > T_MOVE + T_TILT * 0.7) {
            const mx = bx + Math.sin(ang) * (BH / 2), my = cy - Math.cos(ang) * (BH / 2);
            const surf = q.y - 2 - Math.round((st[a.j].length + a.n * pt) * LH);
            const col = COLORS[a.c];
            const sx = Math.round(mx), sw = 3;
            rect(sx - 1, Math.round(my), sw, Math.max(0, surf - my), col.m);
            rect(sx - 1, Math.round(my), 1, Math.max(0, surf - my), col.l);
            for (let k = 0; k < 3; k++) rect(sx - 3 + ((time * 40 + k * 3) | 0) % 7, surf - 2, 1, 1, col.l);
          }
        }

        // sparkles
        parts.forEach(p => {
          const s = p.life > 0.3 ? 2 : 1;
          rect(Math.round(p.x), Math.round(p.y), s, s, p.c);
          if (s === 2) { rect(Math.round(p.x) - 1, Math.round(p.y) + 0.5, 4, 1, p.c); }
        });

      });
      const onAnyKey = () => { kbUsed = true; };
      window.addEventListener('keydown', onAnyKey);

      // dev hook to verify winnability
      root.__bottles = { get st() { return st; }, tap, isSolved: () => isSolved(st), solvable: () => solvable(st, 60000), get round() { return round; }, get busy() { return busy; } };

      return function cleanup() {
        stopLoop();
        timers.forEach(clearTimeout);
        cv.canvas.removeEventListener('pointerdown', onDown);
        undoBtn.removeEventListener('click', onUndo);
        newBtn.removeEventListener('click', onNew);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keydown', onAnyKey);
        cv.destroy();
        root.innerHTML = '';
      };
    }
  };
})();

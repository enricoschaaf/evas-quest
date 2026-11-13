/* GPS-Kunst: Eva läuft durch Stadt & Park und malt mit ihrer GPS-Spur Formen (Haus, Herz, E). */
(function () {
  'use strict';

  const W = 180, H = 320;
  const COLS = 9, ROWS = 10, GX = 10, GY = 44, SP = 20;
  const MAP_T = 34, MAP_B = 240;
  const RIVER_J = 7;            // river between node rows 7 and 8
  const BRIDGES = [2, 6];
  const SPEED = 72;             // px / s
  const nid = (i, j) => j * COLS + i;
  const ci = n => n % COLS, cj = n => Math.floor(n / COLS);
  const nx = n => GX + ci(n) * SP, ny = n => GY + cj(n) * SP;
  const ekey = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const FONT_B = '"VT323", monospace';

  const ROUNDS = [
    { name: 'DAS HAUS', short: 'Haus', start: [2, 7],
      strokes: [[[2, 7], [2, 4], [6, 4], [6, 7], [2, 7]], [[2, 4], [4, 2], [6, 4]]],
      tip: 'Erst das Quadrat, dann das Dach!' },
    { name: 'DAS HERZ', short: 'Herz', start: [4, 7],
      strokes: [[[4, 7], [1, 4], [1, 3], [2, 2], [3, 2], [4, 3], [5, 2], [6, 2], [7, 3], [7, 4], [4, 7]]],
      tip: 'Schräg durch den Park – wie ein Herz!' },
    { name: 'E WIE EVA', short: 'E', start: [6, 7],
      strokes: [[[6, 7], [2, 7], [2, 1], [6, 1]], [[2, 4], [5, 4]]],
      tip: 'Umdrehen ist erlaubt – kein Umweg!' }
  ];
  function expand(strokes) {
    const out = [], seen = {};
    strokes.forEach(s => {
      for (let k = 0; k < s.length - 1; k++) {
        let [i, j] = s[k]; const [i2, j2] = s[k + 1];
        const di = Math.sign(i2 - i), dj = Math.sign(j2 - j);
        while (i !== i2 || j !== j2) {
          const a = nid(i, j); i += di; j += dj; const b = nid(i, j);
          const key = ekey(a, b);
          if (!seen[key]) { seen[key] = 1; out.push([a, b]); }
        }
      }
    });
    return out;
  }
  ROUNDS.forEach(r => { r.edges = expand(r.strokes); r.keys = new Set(r.edges.map(e => ekey(e[0], e[1]))); r.startN = nid(r.start[0], r.start[1]); });

  /* ---------- street graph ---------- */
  const N = COLS * ROWS;
  const adj = Array.from({ length: N }, () => []);
  const isDiag = {};
  function link(a, b) { if (adj[a].indexOf(b) < 0) { adj[a].push(b); adj[b].push(a); } }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (i < COLS - 1) link(nid(i, j), nid(i + 1, j));
    if (j < ROWS - 1 && (j !== RIVER_J || BRIDGES.indexOf(i) >= 0)) link(nid(i, j), nid(i, j + 1));
  }
  const diagCells = {};  // "i,j" -> '/', '\\', 'X'
  ROUNDS.forEach(r => r.edges.forEach(([a, b]) => {
    if (ci(a) !== ci(b) && cj(a) !== cj(b)) {
      link(a, b); isDiag[ekey(a, b)] = 1;
      const i = Math.min(ci(a), ci(b)), j = Math.min(cj(a), cj(b));
      const t = ((ci(a) - ci(b)) * (cj(a) - cj(b)) > 0) ? '\\' : '/';
      const k = i + ',' + j;
      diagCells[k] = diagCells[k] && diagCells[k] !== t ? 'X' : t;
    }
  }));
  const edgeLenPx = (a, b) => Math.hypot(nx(a) - nx(b), ny(a) - ny(b));
  const edgeMeters = (a, b) => isDiag[ekey(a, b)] ? 170 : 120;
  function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  const isPark = (i, j) => i >= 1 && i <= 6 && j >= 1 && j <= 6;

  /* ---------- sprites ---------- */
  const TREE = ['..ooo..', '.oOooo.', 'ooooOoo', 'oOooooo', '.ooooo.', '...t...', '..ttt..'];
  const BUSH = ['.oo.', 'oOoo', '.oo.'];
  const STAR = ['.....Y.....', '....YYY....', '....YYY....', 'YYYYYYYYYYY', '.YYYYYYYYY.', '..YYYYYYY..',
    '...YYYYY...', '..YYYYYYY..', '..YYY.YYY..', '.YY.....YY.', '.Y.......Y.'];
  const FOLIAGE = [['#d9822b', '#f2b33d'], ['#c0392b', '#e8674f'], ['#e8b830', '#f7dc6f'], ['#3e7a3a', '#6fae4f'], ['#b5502a', '#d9822b']];
  const ROOFS = ['#b84a3a', '#8a5a3c', '#5a6e8a', '#9a3b4a', '#a8783a'];
  const FRIENDS = ['magnus', 'laurenz', 'hannah', 'enrico', 'niklas'];
  const FNAME = { magnus: 'Magnus', laurenz: 'Laurenz', hannah: 'Hannah', enrico: 'Enrico', niklas: 'Niklas' };
  const COMMENTS = [
    ['laurenz: Schönstes Haus! 🏠', 'hannah: Da zieh ich ein 😍', 'enrico: Architektin Eva 📐', 'magnus: Bau mir auch eins!', 'niklas: Hausnummer 1 🏡'],
    ['hannah: Awww, ein Herz ❤', 'magnus: Mein Herz läuft mit', 'niklas: GPS-Romantik 😍', 'laurenz: So süß! ❤', 'enrico: Herzrasen! 💓'],
    ['magnus: E wie EVA! 🎉', 'laurenz: Lauf-Autogramm ✍', 'enrico: Krasse Pace! 🔥', 'hannah: Queen E 👑', 'niklas: E-ndlich! 🎂']
  ];

  GAMES['run_gpsart'] = {
    title: 'GPS-Kunst',
    intro: 'Mal mit deiner Laufspur Bilder auf die Stadtkarte! Wisch/tippe auf der Karte (oder Pfeiltasten) – Eva läuft nur auf Straßen & Wegen. Lauf die blasse Vorlage nach.',
    start(root, api) {
      api.music('game');
      const cv = api.makeCanvas(root, W, H), ctx = cv.ctx, canvas = cv.canvas;
      const T = (s, x, y, size, col, align, shadow) => api.text(ctx, s, x, y, size, col, align, shadow);
      function B(s, x, y, size, col, align) {   // body text (VT323)
        ctx.save(); ctx.font = (size || 12) + 'px ' + FONT_B; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
        ctx.fillStyle = col || '#f6e7c8'; ctx.fillText(s, x, y); ctx.restore();
      }
      function box(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
      function pline(g, x0, y0, x1, y1, r, col) {
        g.fillStyle = col;
        const dx = x1 - x0, dy = y1 - y0, st = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
        for (let s = 0; s <= st; s++) {
          const x = Math.round(x0 + dx * s / st), y = Math.round(y0 + dy * s / st);
          g.fillRect(x - r, y - r, 2 * r + 1, 2 * r + 1);
        }
      }

      /* ---------- pre-rendered map ---------- */
      const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
      (function renderMap() {
        const g = bg.getContext('2d');
        g.fillStyle = '#5d8a45'; g.fillRect(0, MAP_T, W, MAP_B - MAP_T);
        // town blocks (houses) everywhere outside park & river
        const house = (x, y, w, h, seed) => {
          const roof = ROOFS[Math.floor(hash(seed) * ROOFS.length)];
          g.fillStyle = '#e6d6b8'; g.fillRect(x, y, w, h);
          g.fillStyle = roof; g.fillRect(x, y, w, Math.ceil(h * 0.55));
          g.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = y + 2; yy < y + h * 0.55; yy += 3) g.fillRect(x, yy, w, 1);
          g.fillStyle = '#3a4a5a'; for (let xx = x + 2; xx < x + w - 2; xx += 4) g.fillRect(xx, y + h - 4, 2, 2);
        };
        for (let j = -1; j < ROWS; j++) for (let i = -1; i < COLS; i++) {
          const x = GX + i * SP + 3, y = GY + j * SP + 3, w = SP - 6, h = SP - 6;
          if (j === RIVER_J) continue;
          if (isPark(i, j)) continue;
          const s = (i + 3) * 31 + (j + 3) * 97;
          if (hash(s) < 0.15) { // little square with a tree
            g.fillStyle = '#4f7a3a'; g.fillRect(x, y, w, h);
            api.drawPixels(g, TREE, { o: FOLIAGE[s % 5][0], O: FOLIAGE[s % 5][1], t: '#5b3a24' }, x + 4, y + 3, 1);
          } else if (hash(s + 1) < 0.5) { house(x, y, w, h, s); }
          else { house(x, y, 6, h, s); house(x + 7, y, w - 7, h, s + 7); }
        }
        // park
        const px0 = GX + SP, py0 = GY + SP, pw = SP * 6, ph = SP * 6;
        g.fillStyle = '#6a9a48'; g.fillRect(px0 - 1, py0 - 1, pw + 2, ph + 2);
        for (let k = 0; k < 220; k++) { // grass flecks & fallen leaves
          const x = px0 + Math.floor(hash(k * 7 + 3) * pw), y = py0 + Math.floor(hash(k * 13 + 5) * ph);
          g.fillStyle = k % 4 === 0 ? '#d9822b' : k % 4 === 1 ? '#e8b830' : '#7fae55'; g.fillRect(x, y, 1, 1);
        }
        // river
        const ry = GY + RIVER_J * SP + 4, rh = SP - 8;
        g.fillStyle = '#3a6f8f'; g.fillRect(0, ry, W, rh);
        g.fillStyle = '#5a9cc2'; for (let x = 0; x < W; x += 6) { g.fillRect(x + (x % 12 ? 0 : 3), ry + 3, 3, 1); g.fillRect(x + 2, ry + 8, 2, 1); }
        g.fillStyle = '#8fd3e8'; for (let x = 4; x < W; x += 17) g.fillRect(x, ry + 5, 2, 1);
        g.fillStyle = '#b8a77a'; g.fillRect(0, ry - 1, W, 1); g.fillRect(0, ry + rh, W, 1);
        // streets / paths
        const done = {};
        for (let a = 0; a < N; a++) adj[a].forEach(b => {
          const k = ekey(a, b); if (done[k]) return; done[k] = 1;
          const ia = ci(a), ja = cj(a), ib = ci(b), jb = cj(b);
          const inPark = (ia >= 1 && ia <= 7 && ja >= 1 && ja <= 7 && ib >= 1 && ib <= 7 && jb >= 1 && jb <= 7) &&
            !((ja === 7 && jb === 7) || (ia === 1 && ib === 1) || (ia === 7 && ib === 7) || (ja === 1 && jb === 1));
          if (isDiag[k] || inPark) { pline(g, nx(a), ny(a), nx(b), ny(b), 1, '#d9c08a'); }
          else {
            pline(g, nx(a), ny(a), nx(b), ny(b), 2, '#6f6a66');
            if (ja === RIVER_J && jb === RIVER_J + 1) { // bridge
              g.fillStyle = '#7a4a2a'; g.fillRect(nx(a) - 4, ry - 1, 9, rh + 2);
              g.fillStyle = '#a0683a'; for (let y = ry; y < ry + rh; y += 2) g.fillRect(nx(a) - 3, y, 7, 1);
              g.fillStyle = '#3b2416'; g.fillRect(nx(a) - 4, ry - 1, 1, rh + 2); g.fillRect(nx(a) + 4, ry - 1, 1, rh + 2);
            }
          }
        });
        for (let a = 0; a < N; a++) adj[a].forEach(b => {   // street center dashes
          const ia = ci(a), ja = cj(a), ib = ci(b), jb = cj(b);
          if (isDiag[ekey(a, b)]) return;
          const border = ja === 0 || jb === 0 || ja === 9 || ia === 0 || ia === 8 || ja === 8;
          if (!border || (ja === RIVER_J && jb !== ja)) return;
          g.fillStyle = '#9a948c';
          const x0 = nx(a), y0 = ny(a), dx = Math.sign(nx(b) - x0), dy = Math.sign(ny(b) - y0);
          for (let s = 5; s < 16; s += 6) g.fillRect(x0 + dx * s, y0 + dy * s, dx ? 3 : 1, dy ? 3 : 1);
        });
        // park decoration: trees, bushes, pond
        for (let j = 1; j <= 6; j++) for (let i = 1; i <= 6; i++) {
          const x = GX + i * SP, y = GY + j * SP, d = diagCells[i + ',' + j], s = i * 17 + j * 5;
          const fol = FOLIAGE[s % FOLIAGE.length], pal = { o: fol[0], O: fol[1], t: '#5b3a24' };
          if (i === 3 && j === 5) { // pond
            g.fillStyle = '#3a6f8f'; g.fillRect(x + 4, y + 5, 12, 10); g.fillRect(x + 5, y + 4, 10, 12);
            g.fillStyle = '#8fd3e8'; g.fillRect(x + 7, y + 8, 3, 1); g.fillRect(x + 11, y + 11, 2, 1);
            continue;
          }
          if (!d) api.drawPixels(g, TREE, pal, x + 7, y + 6, 1);
          else if (d === '/') { api.drawPixels(g, BUSH, pal, x + 3, y + 3, 1); api.drawPixels(g, BUSH, pal, x + 13, y + 13, 1); }
          else if (d === '\\') { api.drawPixels(g, BUSH, pal, x + 13, y + 3, 1); api.drawPixels(g, BUSH, pal, x + 3, y + 13, 1); }
          else { g.fillStyle = '#f2a7b8'; g.fillRect(x + 4, y + 9, 1, 1); g.fillRect(x + 15, y + 10, 1, 1); g.fillStyle = '#f5d442'; g.fillRect(x + 9, y + 4, 1, 1); g.fillRect(x + 10, y + 15, 1, 1); }
        }
        // labels
        g.font = '10px ' + FONT_B; g.textBaseline = 'top';
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('Stadtpark', GX + SP * 5 + 1, GY + SP * 6 + 9);
        g.fillText('Fluss', 150, ry + 1);
      })();

      /* ---------- state ---------- */
      let round = 0, state = 'run', time = 0;
      let route, cur, moving, target, dragging, fake, banner, result, notifs = [], finishTimer = 0;
      let kudosTotal = 0;
      const done = [];   // per finished round: { route, stars, acc, meters, secs, elev, kudos }
      const keys = {};
      let buttons = [];
      let frame = 0, frameT = 0, lastDirX = 1;

      function startRound(r) {
        round = r; state = 'run';
        const R = ROUNDS[r];
        route = [R.startN]; cur = R.startN; moving = null; target = null; dragging = false;
        fake = { meters: 0, secs: 0, elev: 0 };
        banner = 3.2; result = null; finishTimer = 0;
      }
      function resetRun() {
        const R = ROUNDS[round];
        route = [R.startN]; cur = R.startN; moving = null; target = null;
        fake = { meters: 0, secs: 0, elev: 0 }; finishTimer = 0;
        api.sfx('click');
      }
      function routeEdges() {
        const s = new Set();
        for (let k = 0; k < route.length - 1; k++) s.add(ekey(route[k], route[k + 1]));
        return s;
      }
      function evaluate() {
        const R = ROUNDS[round], es = routeEdges();
        let hit = 0, extra = 0;
        es.forEach(k => { if (R.keys.has(k)) hit++; else extra++; });
        const cov = hit / R.keys.size;
        const acc = Math.max(0, Math.min(1, cov - 0.5 * extra / R.keys.size));
        return { cov, extra, acc, hit };
      }
      function calcFake() {
        let m = 0, el = 0;
        for (let k = 0; k < route.length - 1; k++) {
          m += edgeMeters(route[k], route[k + 1]);
          el += Math.floor(hash(route[k] * 131 + route[k + 1]) * 4) + (isDiag[ekey(route[k], route[k + 1])] ? 1 : 0);
        }
        fake.meters = m; fake.elev = el;
      }
      function evaPos() {
        if (!moving) return { x: nx(cur), y: ny(cur) };
        const t = moving.t;
        return { x: nx(moving.from) + (nx(moving.to) - nx(moving.from)) * t, y: ny(moving.from) + (ny(moving.to) - ny(moving.from)) * t };
      }
      function desired() {
        let kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (kx || ky) { const l = Math.hypot(kx, ky); return { x: kx / l, y: ky / l, key: true }; }
        if (!target) return null;
        const p = evaPos(), vx = target.x - p.x, vy = target.y - p.y, l = Math.hypot(vx, vy);
        if (l < 7) { if (!dragging) target = null; return null; }
        return { x: vx / l, y: vy / l, key: false };
      }
      function pick() {
        const d = desired(); if (!d) return null;
        let best = null, bd = d.key ? 0.7 : 0.4;
        const dc = target ? Math.hypot(target.x - nx(cur), target.y - ny(cur)) : 0;
        adj[cur].forEach(nb => {
          const ex = nx(nb) - nx(cur), ey = ny(nb) - ny(cur), l = Math.hypot(ex, ey);
          const dot = (ex * d.x + ey * d.y) / l;
          if (!d.key && Math.hypot(target.x - nx(nb), target.y - ny(nb)) >= dc) return;
          if (dot > bd) { bd = dot; best = nb; }
        });
        if (best === null && !d.key && !dragging) target = null;   // can't get closer: stop
        return best;
      }
      function arrive(n) {
        cur = n; moving = null;
        if (route[route.length - 1] !== n) {
          route.push(n);
          const a = route[route.length - 2];
          fake.secs += edgeMeters(a, n) / 1000 * (285 + hash(route.length * 7) * 40);
          calcFake();
          api.sfx('step');
          const ev = evaluate();
          if (ev.cov >= 1) { finishTimer = 0.45; target = null; api.sfx('ding'); }
          else if (n === ROUNDS[round].startN && route.length > 4) api.toast('Runde geschlossen! Fertig? → LAUF BEENDEN', 2200);
        }
      }
      function undo() {
        if (state !== 'run') return;
        if (moving) { moving = null; target = null; api.sfx('click'); return; }
        if (route.length <= 1) return;
        route.pop(); cur = route[route.length - 1]; target = null; finishTimer = 0;
        calcFake(); api.sfx('click');
      }

      function finish() {
        if (state !== 'run') return;
        moving = null; target = null; dragging = false;
        const ev = evaluate();
        const stars = ev.cov < 0.3 ? 0 : ev.acc >= 0.85 ? 3 : ev.acc >= 0.6 ? 2 : ev.acc >= 0.35 ? 1 : 0;
        const kudos = stars ? 3 + stars * 4 + Math.floor(hash(route.length * 31 + round) * 5) : 1;
        result = { ...ev, stars, kudos, t: 0, shown: 0 };
        state = 'result';
        api.sfx(stars ? 'coin' : 'error');
        // notifications
        notifs = [];
        if (!stars) notifs.push({ who: 'niklas', text: 'Niklas: Fast! Nochmal! 💪', t: -0.6 });
        else {
          const order = FRIENDS.slice().sort((a, b) => hash(a.length * 13 + round * 7 + b.charCodeAt(0)) - 0.5);
          const cnt = Math.min(5, 2 + stars);
          const com = COMMENTS[round];
          for (let k = 0; k < cnt; k++) {
            const who = order[k];
            let text = FNAME[who] + ' gab dir Kudos 👍';
            const c = com.find(s => s.startsWith(who));
            if (c && k % 2 === 1) text = FNAME[who] + c.slice(who.length);
            notifs.push({ who, text, t: -0.5 - k * 0.75 });
          }
        }
      }
      function next() {
        if (state !== 'result' || !result.stars) return;
        kudosTotal += result.kudos;
        done[round] = { route: route.slice(), stars: result.stars, acc: result.acc, meters: fake.meters, secs: fake.secs, elev: fake.elev, kudos: result.kudos };
        api.sfx('click');
        notifs = [];
        if (round < ROUNDS.length - 1) startRound(round + 1);
        else { state = 'summary'; time = 0; api.sfx('ding'); }
      }
      function retry() { if (state !== 'result') return; notifs = []; startRound(round); api.sfx('click'); }
      let won = false;
      function winNow() { if (won) return; won = true; api.win(); }

      startRound(0);

      /* ---------- input ---------- */
      function inMap(p) { return p.y >= MAP_T && p.y < MAP_B; }
      function onDown(e) {
        e.preventDefault();
        const p = cv.pointer(e);
        for (const b of buttons) if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) { b.fn(); return; }
        if (state === 'run' && inMap(p)) {
          dragging = true; target = p;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        }
      }
      function onMove(e) { if (!dragging) return; e.preventDefault(); const p = cv.pointer(e); target = { x: Math.max(0, Math.min(W, p.x)), y: Math.max(MAP_T, Math.min(MAP_B, p.y)) }; }
      function onUp() { dragging = false; }
      const KMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
      function onKey(e) {
        const k = KMAP[e.code];
        if (k) { e.preventDefault(); keys[k] = true; target = null; return; }
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault(); if (e.repeat) return;
          if (state === 'run') finish(); else if (state === 'result') (result.stars ? next : retry)(); else if (state === 'summary' && time > 1) winNow();
        } else if (e.code === 'Backspace' || e.code === 'KeyZ') { e.preventDefault(); undo(); }
        else if (e.code === 'KeyR') { e.preventDefault(); if (state === 'run') resetRun(); else if (state === 'result') retry(); }
      }
      function onKeyUp(e) { const k = KMAP[e.code]; if (k) keys[k] = false; }
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKeyUp);

      /* ---------- update ---------- */
      function update(dt) {
        time += dt;
        if (banner > 0) banner -= dt;
        notifs.forEach(n => n.t += dt);
        if (state === 'result') { result.t += dt; return; }
        if (state !== 'run') return;
        if (finishTimer > 0) { finishTimer -= dt; if (finishTimer <= 0) finish(); return; }
        if (moving) {
          const d = desired();
          const ex = nx(moving.to) - nx(moving.from), ey = ny(moving.to) - ny(moving.from), l = Math.hypot(ex, ey);
          if (d && (ex * d.x + ey * d.y) / l < -0.6) { const f = moving.from; moving.from = moving.to; moving.to = f; moving.t = 1 - moving.t; }
          moving.t += SPEED * dt / moving.len;
          frameT += dt; if (frameT > 0.12) { frameT = 0; frame ^= 1; }
          if (moving.t >= 1) arrive(moving.to);
        }
        if (!moving) {
          const nb = pick();
          if (nb !== null) {
            moving = { from: cur, to: nb, t: 0, len: edgeLenPx(cur, nb) };
            if (nx(nb) !== nx(cur)) lastDirX = Math.sign(nx(nb) - nx(cur));
          } else if (route.length > 1) fake.secs += dt * 6;  // standing at a red light
        }
      }

      /* ---------- drawing ---------- */
      function fmtTime(s) { s = Math.round(s); const m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
      function fmtKm(m) { return (m / 1000).toFixed(2).replace('.', ',') + ' km'; }
      function fmtPace(m, s) { if (m < 50) return '-:--'; return fmtTime(s / (m / 1000)); }
      function button(x, y, w, h, label, fn, col, size) {
        box(x, y + 2, w, h, '#000'); box(x, y, w, h, col || '#d9822b');
        box(x, y + h - 3, w, 3, 'rgba(0,0,0,.25)'); box(x, y, w, 1, 'rgba(255,255,255,.35)');
        T(label, x + w / 2, y + Math.floor(h / 2) - 4, size || 8, '#1b1b1b', 'center', false);
        buttons.push({ x, y, w, h, fn });
      }
      function drawTarget(r, alpha) {
        const R = ROUNDS[r];
        ctx.globalAlpha = alpha;
        R.edges.forEach(([a, b]) => {
          const x0 = nx(a), y0 = ny(a), dx = nx(b) - x0, dy = ny(b) - y0, st = Math.max(Math.abs(dx), Math.abs(dy));
          for (let s = 0; s <= st; s += 2) { ctx.fillStyle = (s / 2) % 2 ? '#ffffff' : '#f2a7b8'; ctx.fillRect(Math.round(x0 + dx * s / st) - 1, Math.round(y0 + dy * s / st) - 1, 3, 3); }
        });
        ctx.globalAlpha = 1;
      }
      function drawRoute(g, pts, map, r0) {
        const seg = (f) => { for (let k = 0; k < pts.length - 1; k++) f(pts[k], pts[k + 1]); };
        const P = n => typeof n === 'number' ? map(nx(n), ny(n)) : map(n.x, n.y);
        if (r0 > 0) seg((a, b) => { const A = P(a), B2 = P(b); pline(g, A.x, A.y, B2.x, B2.y, r0 + 1, 'rgba(255,120,20,.35)'); });
        seg((a, b) => { const A = P(a), B2 = P(b); pline(g, A.x, A.y, B2.x, B2.y, r0, '#ff8a1e'); });
        if (r0 > 0) seg((a, b) => { const A = P(a), B2 = P(b); pline(g, A.x, A.y, B2.x, B2.y, 0, '#ffe2a8'); });
      }
      const ID = (x, y) => ({ x, y });

      function drawNotifs() {
        let row = 0;
        notifs.forEach(n => {
          if (n.t < 0 || n.t > 3.2) return;
          const slide = Math.min(1, n.t / 0.25) * (n.t > 2.9 ? (3.2 - n.t) / 0.3 : 1);
          const y = MAP_T + 2 + row * 22 - (1 - slide) * 24;
          row++;
          box(6, y + 1, 168, 20, 'rgba(0,0,0,.5)');
          box(5, y, 168, 20, '#fbf6ec'); box(5, y, 3, 20, '#ff8a1e');
          if (n.who === 'niklas') { box(11, y + 3, 14, 14, '#4a7fd9'); T('N', 18, y + 6, 8, '#fff', 'center', false); }
          else { ctx.save(); ctx.beginPath(); ctx.rect(11, y + 2, 14, 16); ctx.clip(); api.drawChar(ctx, n.who, 'idle', 12, y + 2, 1); ctx.restore(); }
          B(n.text, 29, y + 4, 12, '#2a2a2a');
        });
        notifs.forEach(n => { if (n.t >= 0 && !n.pinged) { n.pinged = true; api.sfx('coin'); } });
      }

      function drawHud() {
        box(0, 0, W, MAP_T, '#14201a'); box(0, MAP_T - 2, W, 2, '#000');
        const R = ROUNDS[round];
        T('RUNDE ' + (round + 1) + '/3', 4, 4, 8, '#f2b33d');
        T(R.short.toUpperCase(), 176, 4, 8, '#f6e7c8', 'right');
        const ev = state === 'run' || state === 'result' ? evaluate() : null;
        B(fmtKm(fake.meters) + '  ' + fmtPace(fake.meters, fake.secs) + '/km  ' + fmtTime(fake.secs), 4, 16, 12, '#cfe3c0');
        if (ev) B('Form ' + Math.round(ev.cov * 100) + '%', 176, 16, 12, ev.cov >= 1 ? '#f5d442' : '#ff8a1e', 'right');
      }

      function drawRun() {
        ctx.drawImage(bg, 0, 0);
        drawTarget(round, 0.55 + 0.2 * Math.sin(time * 3));
        // start flag
        const R = ROUNDS[round], sx = nx(R.startN), sy = ny(R.startN);
        box(sx + 3, sy - 12, 1, 12, '#1b1b1b'); box(sx + 4, sy - 12, 6, 4, '#3ad16a'); box(sx + 6, sy - 12, 2, 2, '#fff'); box(sx + 4, sy - 10, 2, 2, '#fff');
        // route + current partial segment
        const pts = route.slice(); if (moving) pts.push(evaPos());
        drawRoute(ctx, pts, ID, 1);
        // Eva + GPS dot
        const p = evaPos();
        const pulse = (time * 2) % 1;
        ctx.globalAlpha = 1 - pulse; ctx.strokeStyle = '#4ab0ff'; ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(p.x) - 2 - pulse * 6, Math.round(p.y) - 2 - pulse * 6, 4 + pulse * 12, 4 + pulse * 12); ctx.globalAlpha = 1;
        box(Math.round(p.x) - 2, Math.round(p.y) - 1, 5, 3, '#1b1b1b');
        api.drawChar(ctx, 'eva', moving ? (frame ? 'run1' : 'run2') : 'idle', Math.round(p.x) - 6, Math.round(p.y) - 15, 1, lastDirX < 0);
        // finger target marker
        if (target && state === 'run') { const tx = Math.round(target.x), ty = Math.round(target.y); box(tx - 3, ty, 7, 1, 'rgba(255,255,255,.7)'); box(tx, ty - 3, 1, 7, 'rgba(255,255,255,.7)'); }
        // banner
        if (banner > 0 && state === 'run') {
          ctx.globalAlpha = Math.min(1, banner / 0.5);
          box(0, 100, W, 44, 'rgba(20,32,26,.88)'); box(0, 100, W, 2, '#ff8a1e'); box(0, 142, W, 2, '#ff8a1e');
          T(R.name, 90, 108, 8, '#f2b33d', 'center');
          B(R.tip, 90, 124, 12, '#f6e7c8', 'center');
          ctx.globalAlpha = 1;
        }
      }

      function drawStars(cx, y, n, scale) {
        for (let k = 0; k < 3; k++) {
          const on = k < n;
          api.drawPixels(ctx, STAR, { Y: on ? '#f5c542' : '#4a4a4a' }, cx - 17 * scale + k * 12 * scale, y, scale);
        }
      }

      function drawResult() {
        const r = result, R = ROUNDS[round];
        box(14, 84, 152, 118, '#000'); box(12, 82, 152, 118, '#1d2b23'); box(12, 82, 152, 3, '#ff8a1e');
        T(r.stars ? R.short.toUpperCase() + ' GEMALT!' : 'FAST...', 88, 92, 8, r.stars ? '#f2b33d' : '#f2a7b8', 'center');
        const shownStars = Math.min(r.stars, Math.floor(r.t / 0.35));
        if (shownStars > r.shown) { r.shown = shownStars; api.sfx('ding'); }
        drawStars(88, 106, shownStars, 1);
        B('Form getroffen: ' + Math.round(r.cov * 100) + '%', 20, 124, 12, '#f6e7c8');
        B('Umwege: ' + r.extra + (r.extra ? '' : '  👌'), 20, 136, 12, '#f6e7c8');
        B('Strecke: ' + fmtKm(fake.meters) + ' · ' + fmtPace(fake.meters, fake.secs) + '/km', 20, 148, 12, '#cfe3c0');
        B(r.stars ? '+' + r.kudos + ' Kudos 👍' : 'Lauf die blasse Vorlage nach!', 20, 164, 12, r.stars ? '#f5d442' : '#f2a7b8');
        B(r.stars ? (r.stars < 3 ? 'Nochmal für mehr Sterne?' : 'Perfekte GPS-Kunst!') : 'Mind. 1 Stern zum Weiterlaufen.', 20, 178, 12, '#9fb49a');
      }

      function drawSummary() {
        box(0, 0, W, H, '#f4f1ec');
        box(0, 0, W, 30, '#ff6a1e');
        T('LAUF-APP', 6, 6, 8, '#fff');
        B('✓ Aktivität gespeichert', 6, 17, 12, '#fff');
        const d = new Date();
        api.drawChar(ctx, 'eva', 'idle', 6, 36, 1);
        B('Eva · ' + d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(), 22, 34, 12, '#222');
        B('Geburtstags-Kunstlauf 🎂', 22, 44, 12, '#555');
        // three art tiles
        const tw = 54, th = 64;
        for (let k = 0; k < 3; k++) {
          const ox = 4 + k * (tw + 4), oy = 60, s = 0.27, dd = done[k];
          box(ox, oy, tw, th, '#2b3440');
          const map = (x, y) => ({ x: ox + 4 + (x - GX) * s, y: oy + 4 + (y - GY) * s });
          // faint grid
          ctx.fillStyle = '#3c4756';
          for (let i = 0; i < COLS; i++) ctx.fillRect(Math.round(map(nx(i), 0).x), oy + 4, 1, 50);
          for (let j = 0; j < ROWS; j++) ctx.fillRect(ox + 4, Math.round(map(0, ny(j * COLS)).y), 44, 1);
          if (dd) drawRoute(ctx, dd.route, map, 0);
          B(ROUNDS[k].short, ox + tw / 2, oy + th - 11, 10, '#cfd8e3', 'center');
          if (dd) for (let st = 0; st < 3; st++) box(ox + tw - 14 + st * 4, oy + 2, 3, 3, st < dd.stars ? '#f5c542' : '#555');
        }
        const tot = done.reduce((a, x) => ({ m: a.m + x.meters, s: a.s + x.secs, e: a.e + x.elev }), { m: 0, s: 0, e: 0 });
        const stat = (lab, val, x, y) => { B(lab, x, y, 10, '#888'); T(val, x, y + 10, 8, '#222', 'left', false); };
        stat('Distanz', fmtKm(tot.m).replace(' km', 'km'), 8, 132);
        stat('Pace', fmtPace(tot.m, tot.s) + '/km', 96, 132);
        stat('Zeit', fmtTime(tot.s), 8, 158);
        stat('Höhenmeter', '+' + tot.e + 'm', 96, 158);
        // elevation profile
        B('Höhenprofil', 8, 182, 10, '#888');
        box(8, 192, 164, 30, '#e6e0d6');
        for (let k = 0; k < 41; k++) {
          const v = 6 + Math.sin(k * 0.35) * 5 + Math.sin(k * 0.9 + 1) * 3 + hash(k + 9) * 4;
          box(9 + k * 4, 221 - Math.round(v * 1.4), 3, Math.round(v * 1.4), '#ff8a1e');
        }
        B('👍 ' + kudosTotal + ' Kudos von Magnus, Laurenz,', 8, 226, 12, '#333');
        B('Hannah, Enrico & Niklas', 8, 237, 12, '#333');
        B('💬 „Happy Birthday, Eva!“', 8, 250, 12, '#c0392b');
        if (time > 1) button(20, 276, 140, 28, 'FERTIG! 🎉', winNow, '#ff8a1e');
      }

      function draw() {
        buttons = [];
        ctx.clearRect(0, 0, W, H);
        if (state === 'summary') { drawSummary(); return; }
        box(0, 0, W, H, '#14201a');
        drawRun();
        drawHud();
        if (state === 'run') {
          button(8, 246, 164, 24, 'LAUF BEENDEN', finish, '#ff8a1e');
          button(8, 276, 80, 22, '< ZURÜCK', undo, '#cfd8c4');
          button(92, 276, 80, 22, 'NEU', resetRun, '#cfd8c4');
          B('Wisch auf der Karte – Eva folgt!', 90, 304, 12, '#9fb49a', 'center');
        } else if (state === 'result') {
          drawResult();
          if (result.stars) {
            button(8, 246, 164, 24, round < 2 ? 'WEITER >' : 'ZUR AUSWERTUNG >', next, '#ff8a1e');
            button(8, 276, 164, 22, 'NOCHMAL VERSUCHEN', retry, '#cfd8c4');
          } else button(8, 246, 164, 24, 'NOCHMAL', retry, '#ff8a1e');
        }
        drawNotifs();
      }

      const stop = api.loop(dt => { update(dt); draw(); });

      return function cleanup() {
        stop();
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('keyup', onKeyUp);
        cv.destroy();
      };
    }
  };
})();

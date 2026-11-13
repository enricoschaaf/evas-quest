/* Zapfen-Schleuder: slingshot physics game (Matter.js for physics, own pixel rendering, camera, juice). */
(function () {
  'use strict';

  const VW = 180, VH = 320;               // screen (canvas) resolution
  const WW = 340, G = 640, WH = G + 120;  // world size (px), ground line y
  const GROUND_SY = 262;                  // screen y of the ground line (constant across zoom)
  const S = 2;                            // physics units per px
  const STEP = 1000 / 60;
  const GRAV = 0.001 * STEP * STEP;       // Matter gravity per step (phys units)
  const ANCHOR = { x: 46, y: G - 32 };    // slingshot pouch rest position (world px)
  const MAXPULL = 34;                     // world px
  const DRAGMAX = 64;                     // screen px of finger travel for full pull
  const VMAX = 13.6;                      // phys units / step at full pull
  const CONE_R = 5;

  const TICK = [
    '....hhhhhh....',
    '..hhhhhhhhhh..',
    'L.BBBBBBBBBB.L',
    '.LBBBBBBBBBBL.',
    '.BBBBBBBBBBBB.',
    'LBBBBBBBBBBBBL',
    '.BBBBBBBBBBBB.',
    'LBBBBBBBBBBBBL',
    '.BBBBBBBBBBBB.',
    '..BBBBBBBBBB..',
    '...BBBBBBBB...'
  ];
  const LEGS_A = ['.L..........L.', 'L............L'];
  const LEGS_B = ['L............L', '.L..........L.'];
  const TICKPAL = { h: '#8a3a32', B: '#6b2626', L: '#2a1410' };
  const CONE = [
    '....gg....',
    '...BDDB...',
    '..BDLDLB..',
    '.BDLDLDLB.',
    '.DLDLDLDD.',
    '.BDLDLDLB.',
    '.DLDLDLDD.',
    '..BDLDLB..',
    '...BDDB...',
    '....BB....'
  ];
  const CONEPAL = { g: '#3e7a3a', B: '#3b2416', D: '#7a4a2a', L: '#c08040' };
  const NEST = [
    '....kkkk....',
    '..kYYYYYYk..',
    '.kYYYYYYYYk.',
    '.kddddddddk.',
    'kYYYYYYYYYYk',
    'kYYYYOOYYYYk',
    'kddddOOddddk',
    'kYYYYYYYYYYk',
    '.kYYYYYYYYk.',
    '.kddddddddk.',
    '..kYYYYYYk..',
    '....kkkk....'
  ];
  const NESTPAL = { k: '#5a3a12', Y: '#e6b84a', d: '#b07a22', O: '#2a1a08' };

  // Level layouts (world px): [type, cx, cy, w, h]. Ticks/nests: [type, cx, cy]. Ticks always sit ON surfaces with open sky.
  const P = 6; // plank thickness
  const LEVELS = [
    { cones: 4, left: 196, right: 300, hint: 'Erledige die 2 Zecken!', items: [
      ['plank', 212, G - 20, P, 40],
      ['plank', 252, G - 20, P, 40],
      ['plank', 232, G - 43, 58, P],
      ['tick', 232, G - 53],
      ['stone', 288, G - 10, 16, 20],
      ['tick', 288, G - 27]
    ] },
    { cones: 5, left: 184, right: 300, hint: 'Triff das Wespennest!', items: [
      ['plank', 196, G - 18, P, 36],
      ['plank', 240, G - 18, P, 36],
      ['plank', 284, G - 18, P, 36],
      ['plank', 240, G - 39, 104, P],
      ['plank', 222, G - 57, P, 30],
      ['plank', 258, G - 57, P, 30],
      ['plank', 240, G - 75, 48, P],
      ['nest', 240, G - 48],
      ['tick', 202, G - 49],
      ['tick', 278, G - 49],
      ['tick', 240, G - 85]
    ] },
    { cones: 5, left: 150, right: 322, hint: 'Die Zecken-Festung!', items: [
      ['nest', 160, G - 6],
      ['plank', 190, G - 20, P, 40],
      ['plank', 230, G - 20, P, 40],
      ['plank', 270, G - 20, P, 40],
      ['plank', 310, G - 20, P, 40],
      ['plank', 250, G - 43, 134, P],
      ['plank', 220, G - 63, P, 34],
      ['plank', 280, G - 63, P, 34],
      ['stone', 250, G - 53, 14, 14],
      ['nest', 250, G - 66],
      ['plank', 250, G - 83, 76, P],
      ['tick', 198, G - 53],
      ['tick', 303, G - 53],
      ['tick', 234, G - 93],
      ['tick', 266, G - 93]
    ] }
  ];
  const TAUNTS = ['Hehe!', 'Daneben!', 'Ätsch!', 'Zu schwach!', 'Hihi!', 'Nö!'];

  GAMES['sling'] = {
    title: 'Zapfen-Schleuder',
    intro: 'Zecken-Alarm im Wald! Zieh die Schleuder zurück und lass los. Im Flug tippen = Dreifach-Zapfen!',
    start(root, api) {
      api.music('game');
      const cv = api.makeCanvas(root, VW, VH);
      const ctx = cv.ctx, canvas = cv.canvas;
      const wc = document.createElement('canvas'); wc.width = WW; wc.height = WH;
      const wx = wc.getContext('2d'); wx.imageSmoothingEnabled = false;
      let alive = true, stopLoop = null, M = null;
      const timers = [];
      const later = (fn, ms) => { const id = setTimeout(() => { if (alive) fn(); }, ms); timers.push(id); };

      // restart button (DOM, always visible)
      const btn = document.createElement('button');
      btn.textContent = '↻ Neustart';
      btn.style.cssText = 'position:absolute;z-index:3;font:9px "Press Start 2P",monospace;color:#f6e7c8;background:rgba(13,21,17,.7);' +
        'border:2px solid #f6e7c8;border-radius:4px;padding:7px 8px;touch-action:manipulation;cursor:pointer;white-space:nowrap;';
      root.appendChild(btn);
      function placeBtn() {
        const l = canvas.offsetLeft + canvas.offsetWidth - btn.offsetWidth - 6;
        const t = canvas.offsetTop + canvas.offsetHeight - btn.offsetHeight - 6;
        btn.style.left = Math.max(0, l) + 'px'; btn.style.top = Math.max(0, t) + 'px';
      }

      // ---------- background (pre-rendered, world size) ----------
      const bg = document.createElement('canvas'); bg.width = WW; bg.height = WH;
      (function paintBg() {
        const b = bg.getContext('2d');
        const bands = ['#5fb2d0', '#6cbcd8', '#7cc6dc', '#8fd3e8', '#a6dcea', '#bfe5ec', '#d8ecdc'];
        const top = G - 420;
        b.fillStyle = bands[0]; b.fillRect(0, 0, WW, WH);
        bands.forEach((c, i) => { b.fillStyle = c; b.fillRect(0, top + i * 60, WW, 60); });
        b.fillStyle = '#fff3b0'; b.fillRect(270, G - 300, 22, 22); b.fillStyle = '#fbe58a'; b.fillRect(272, G - 298, 18, 18);
        b.fillStyle = '#ffffff';
        [[20, G - 330], [120, G - 270], [210, G - 380], [60, G - 200], [250, G - 210], [150, G - 480]].forEach(([x, y]) => {
          b.fillRect(x, y, 34, 6); b.fillRect(x + 6, y - 4, 18, 4); b.fillRect(x + 20, y - 2, 8, 2);
        });
        b.fillStyle = '#9cc397';
        for (let x = 0; x < WW; x++) { const h = 60 + Math.round(16 * Math.sin(x / 31) + 8 * Math.sin(x / 11)); b.fillRect(x, G - h, 1, h); }
        b.fillStyle = '#8fb88a';
        for (let x = 0; x < WW; x++) { const h = 34 + Math.round(10 * Math.sin(x / 23 + 1) + 6 * Math.sin(x / 9)); b.fillRect(x, G - h, 1, h); }
        const cols = ['#d9822b', '#f2b33d', '#3e7a3a', '#d94c3d', '#24502a', '#d9822b'];
        for (let i = 0; i < 16; i++) {
          const x = i * 22 + (i % 3) * 5 - 6, h = 44 + (i * 37) % 34, c = cols[i % cols.length];
          b.fillStyle = '#5b3a24'; b.fillRect(x + 8, G - h * 0.45, 4, h * 0.45);
          b.fillStyle = c;
          b.fillRect(x, G - h, 20, h * 0.4); b.fillRect(x + 3, G - h - 6, 14, 6); b.fillRect(x + 2, G - h * 0.6, 16, 6);
          b.fillStyle = 'rgba(0,0,0,.12)'; b.fillRect(x + 12, G - h, 8, h * 0.4);
        }
        b.fillStyle = '#3e7a3a'; b.fillRect(0, G, WW, 4);
        b.fillStyle = '#6fae4f'; for (let x = 0; x < WW; x += 4) b.fillRect(x, G - 2, 2, 2);
        b.fillStyle = '#7a4a2a'; b.fillRect(0, G + 4, WW, WH - G - 4);
        b.fillStyle = '#5b3a24'; for (let i = 0; i < 70; i++) b.fillRect((i * 53) % WW, G + 8 + (i * 17) % 100, 3, 2);
        const lc = ['#d9822b', '#f2b33d', '#d94c3d'];
        for (let i = 0; i < 40; i++) { b.fillStyle = lc[i % 3]; b.fillRect((i * 41) % WW, G + 1 + (i % 2), 3, 2); }
      })();

      // ---------- state ----------
      let level = 0, cones = 0, score = 0;
      const attempts = [0, 0, 0];
      let engine = null, ticks = [], nests = [], flying = [], restCones = [];
      let state = 'loading';     // loading | intro | aim | flying | settle | clear | banner
      let stateT = 0, levelT = 0, shotPops = 0, shotsFired = 0, splitUsed = false, splitHintShown = 0;
      let drag = null, kbd = null, lastPullLen = 0;
      let timeScale = 1, slowT = 0, shake = 0, cheer = 0, bandWob = 0;
      let lastTrail = [];
      const parts = [], popups = [], bubbles = [], rings = [], breakQ = [], boomQ = [];
      let banner = null;
      const cam = { cx: 78, z: 1.3, vy: 0 };
      const camT = { cx: 78, z: 1.3 };

      const mercy = () => attempts[level] >= 2;
      const LV = () => LEVELS[level];
      const isBlock = b => b.label === 'plank' || b.label === 'stone';

      function clearWorld() {
        if (!engine) return;
        M.Events.off(engine); M.Composite.clear(engine.world, false); M.Engine.clear(engine);
      }

      function buildLevel(skipIntro) {
        const { Engine, Bodies, Composite, Events } = M;
        clearWorld();
        engine = Engine.create();
        engine.positionIterations = 10; engine.velocityIterations = 8;
        ticks = []; nests = []; flying = []; restCones = []; lastTrail = [];
        cones = LV().cones; levelT = 0; shotsFired = 0; timeScale = 1; slowT = 0;
        parts.length = 0; popups.length = 0; bubbles.length = 0; rings.length = 0; breakQ.length = 0; boomQ.length = 0;
        drag = null; kbd = null; banner = null;
        Composite.add(engine.world, Bodies.rectangle(WW / 2 * S, (G + 30) * S, (WW + 400) * S, 60 * S, { isStatic: true, friction: 1, label: 'ground' }));
        LV().items.forEach(([type, cx, cy, w, h]) => {
          let b;
          if (type === 'tick') {
            b = Bodies.circle(cx * S, cy * S, 7 * S, { density: 0.0012, friction: 0.9, frictionStatic: 1, restitution: 0.1, label: 'tick' });
            M.Body.setInertia(b, Infinity);
            b.alive = true; b.pv = { x: 0, y: 0 }; b.cov = 0; b.scare = 0; b.ph0 = Math.random() * 6;
            ticks.push(b);
          } else if (type === 'nest') {
            b = Bodies.circle(cx * S, cy * S, 6 * S, { density: 0.0008, friction: 0.9, frictionStatic: 1, restitution: 0.05, label: 'nest' });
            M.Body.setInertia(b, Infinity);
            b.alive = true; b.pv = { x: 0, y: 0 };
            nests.push(b);
          } else {
            const opt = type === 'stone' ? { density: 0.004, friction: 0.9, frictionStatic: 1 } : { density: 0.0011, friction: 0.8, frictionStatic: 1 };
            b = Bodies.rectangle(cx * S, cy * S, w * S, h * S, Object.assign({ label: type }, opt));
            b.pw = w; b.ph = h; b.hp = 1;
          }
          Composite.add(engine.world, b);
        });
        Events.on(engine, 'collisionStart', onCollide);
        if (mercy()) api.toast('Die Zecken sind jetzt ganz schwach!', 2200);
        if (skipIntro) { state = 'aim'; stateT = 0; }
        else { state = 'intro'; stateT = 0; const c = towerView(); cam.cx = c.cx; cam.z = c.z; }
      }

      function restartLevel(manual) {
        if (!engine || state === 'banner' || state === 'clear') return;
        attempts[level]++;
        if (manual) api.sfx('click'); else { api.sfx('error'); api.toast('Nochmal!', 1400); }
        buildLevel(true);
      }

      // ---------- effects ----------
      function burst(x, y, n, colors, sp, life, grav) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8);
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: life * (0.6 + Math.random() * 0.6), t: 0,
            c: colors[i % colors.length], g: grav == null ? 260 : grav, s: 1 + (Math.random() * 2 | 0) });
        }
      }
      function popup(x, y, str, color, big) { popups.push({ x, y, str, color: color || '#f5d442', t: 0, big: !!big }); }
      function addShake(a) { shake = Math.min(8, Math.max(shake, a)); }

      // ---------- collisions ----------
      function onCollide(ev) {
        if (levelT < 1) return;
        ev.pairs.forEach(p => {
          const a = p.bodyA, b = p.bodyB;
          const rv = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
          [[a, b], [b, a]].forEach(([t, o]) => {
            if (t.label === 'tick' && t.alive) {
              if (o.label === 'cone' && (mercy() || rv > 1.6)) popTick(t, o);
              else if (o.label !== 'ground' && rv > (mercy() ? 0.8 : 2.4)) popTick(t, o);
              else if (o.label === 'ground' && rv > (mercy() ? 1.5 : 3)) popTick(t, o);
            } else if (t.label === 'nest' && t.alive && o.label !== 'ground' && rv > (o.label === 'cone' ? 2 : 3.5)) {
              boomQ.push(t);
            } else if (t.label === 'plank' && !t.broken) {
              const heavy = o.label === 'cone' || o.label === 'stone' || o.label === 'plank';
              if (heavy && rv > (o.label === 'cone' ? 5 : 7)) { t.broken = true; breakQ.push({ b: t, v: rv }); }
            }
            if (t.label === 'cone' && rv > 3) {
              const x = t.position.x / S, y = t.position.y / S;
              if (o.label === 'plank') burst(x, y, 6, ['#b07a44', '#d19a5c', '#8a5a30'], 50, 0.6);
              else if (o.label === 'stone') burst(x, y, 6, ['#b8bec6', '#8a909a', '#e0e0e0'], 40, 0.5, 40);
              else if (o.label === 'ground') burst(x, y, 5, ['#7a4a2a', '#6fae4f', '#a0703a'], 40, 0.5);
              if (o.label !== 'cone') { api.sfx('hit'); if (rv > 6) addShake(rv * 0.4); }
            }
          });
        });
      }

      function popTick(t, why, squash) {
        if (!t.alive) return;
        t.alive = false;
        api.sfx('boom'); later(() => api.sfx('coin'), 90);
        const x = t.position.x / S, y = t.position.y / S;
        burst(x, y, 16, ['#ffffff', '#f2a7b8', '#6b2626', '#d8d0c0'], 70, 0.7, 120);
        rings.push({ x, y, t: 0 });
        score += 500; shotPops++;
        popup(x, y - 10, squash ? 'Zerquetscht! +500' : '+500', squash ? '#f2a7b8' : '#f5d442');
        addShake(3);
        cheer = 1.5;
        later(() => { if (engine) M.Composite.remove(engine.world, t); }, 0);
        const left = ticks.filter(k => k.alive).length;
        if (shotPops === 2) popup(x, y - 24, 'Doppeltreffer!', '#ffffff', true);
        else if (shotPops === 3) popup(x, y - 24, 'Dreifach!', '#ffffff', true);
        if (left === 0 && state !== 'clear' && state !== 'banner') {
          if (shotPops >= 3 || (shotPops === ticks.length && shotsFired === 1)) popup(x, y - 38, 'Strike!', '#f5c542', true);
          state = 'clear'; stateT = 0; timeScale = 0.25; slowT = 0.45;
          camT.cx = x; camT.z = 1.3;
        }
      }

      function explode(n) {
        if (!n.alive) return;
        n.alive = false;
        const x = n.position.x / S, y = n.position.y / S, R = 52;
        api.sfx('boom'); later(() => api.sfx('hit'), 60);
        addShake(8);
        burst(x, y, 26, ['#f5d442', '#e6b84a', '#ff9a3c', '#ffffff', '#5a3a12'], 120, 0.8, 80);
        for (let i = 0; i < 10; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 80, life: 1.4, t: 0, c: '#1d1d1d', g: -20, s: 2, wasp: true });
        rings.push({ x, y, t: 0, big: true });
        popup(x, y - 12, 'BUMM! +200', '#ff9a3c', true);
        score += 200;
        M.Composite.remove(engine.world, n);
        M.Composite.allBodies(engine.world).forEach(b => {
          if (b.isStatic || b === n) return;
          const dx = b.position.x / S - x, dy = b.position.y / S - y, d = Math.hypot(dx, dy);
          if (d > R) return;
          const f = (1 - d / R) * 11, ux = dx / (d || 1), uy = dy / (d || 1) - 0.5;
          M.Body.setVelocity(b, { x: b.velocity.x + ux * f, y: b.velocity.y + uy * f });
          if (b.label === 'plank' && d < R * 0.45 && !b.broken) { b.broken = true; breakQ.push({ b, v: 8 }); }
          if (b.label === 'tick' && b.alive && d < R * 0.6) popTick(b, n);
          if (b.label === 'nest' && b.alive) later(() => explode(b), 120);
        });
      }

      function breakPlank({ b }) {
        if (!engine || M.Composite.get(engine.world, b.id, 'body') == null) return;
        const x = b.position.x / S, y = b.position.y / S;
        const long = Math.max(b.pw, b.ph), horiz = b.pw >= b.ph;
        burst(x, y, 14, ['#b07a44', '#d19a5c', '#8a5a30', '#3b2416'], 80, 0.9);
        api.sfx('hit'); addShake(4);
        score += 50; popup(x, y, '+50', '#f6e7c8');
        M.Composite.remove(engine.world, b);
        if (long < 16) return;
        const half = long / 2 - 1, ca = Math.cos(b.angle), sa = Math.sin(b.angle);
        [-1, 1].forEach(s => {
          const off = s * (long / 4);
          const px = horiz ? x + ca * off : x - sa * off, py = horiz ? y + sa * off : y + ca * off;
          const w = horiz ? half : b.pw, h = horiz ? b.ph : half;
          const nb = M.Bodies.rectangle(px * S, py * S, w * S, h * S, { label: 'plank', density: 0.0011, friction: 0.8, angle: b.angle });
          nb.pw = w; nb.ph = h; nb.broken = long / 2 < 16; // small pieces don't break again (they splinter on next break request)
          M.Body.setVelocity(nb, { x: b.velocity.x + s * 1.2 * (horiz ? ca : -sa), y: b.velocity.y - 0.8 });
          M.Body.setAngularVelocity(nb, s * 0.08);
          M.Composite.add(engine.world, nb);
        });
      }

      // ---------- shooting ----------
      function launch(pull) {
        const len = pull ? Math.hypot(pull.x, pull.y) : 0;
        if (len < 4 || state !== 'aim' || cones <= 0) return;
        const k = VMAX / MAXPULL;
        const c = M.Bodies.circle((ANCHOR.x + pull.x) * S, (ANCHOR.y + pull.y) * S, CONE_R * S,
          { density: 0.006, friction: 0.6, frictionAir: 0, restitution: 0.25, label: 'cone' });
        c.age = 0; c.slow = 0; c.trail = [];
        M.Composite.add(engine.world, c);
        M.Body.setVelocity(c, { x: -pull.x * k, y: -pull.y * k });
        flying = [c];
        cones--; shotsFired++; shotPops = 0; state = 'flying'; stateT = 0; splitUsed = false;
        bandWob = Math.min(1, len / MAXPULL);
        addShake(1.5);
        api.sfx('launch');
        if (splitHintShown < 2) splitHintShown++;
      }

      function split() {
        if (splitUsed || state !== 'flying' || !flying.length || flying[0].age < 0.08) return;
        const c = flying[0];
        if (!M.Composite.get(engine.world, c.id, 'body')) return;
        splitUsed = true;
        api.sfx('doublejump');
        const vx = c.velocity.x, vy = c.velocity.y;
        [-0.2, 0.2].forEach(a => {
          const n = M.Bodies.circle(c.position.x, c.position.y, CONE_R * S, { density: 0.006, friction: 0.6, frictionAir: 0, restitution: 0.25, label: 'cone' });
          n.age = c.age; n.slow = 0; n.trail = [];
          n.collisionFilter = { group: -7, category: 1, mask: 0xFFFFFFFF };
          M.Composite.add(engine.world, n);
          M.Body.setVelocity(n, { x: vx * Math.cos(a) - vy * Math.sin(a), y: vx * Math.sin(a) + vy * Math.cos(a) });
          flying.push(n);
        });
        c.collisionFilter = { group: -7, category: 1, mask: 0xFFFFFFFF };
        burst(c.position.x / S, c.position.y / S, 10, ['#ffffff', '#c08040', '#f5d442'], 60, 0.4, 0);
        popup(c.position.x / S, c.position.y / S - 10, 'x3!', '#ffffff');
      }

      function trajectory(pull) {
        const k = VMAX / MAXPULL;
        let x = (ANCHOR.x + pull.x) * S, y = (ANCHOR.y + pull.y) * S, vx = -pull.x * k, vy = -pull.y * k;
        const pts = [];
        for (let i = 0; i < 300; i++) {
          vy += GRAV; x += vx; y += vy;
          pts.push([x / S, y / S]);
          if (y / S > G || x / S > WW + 10) break;
        }
        return pts.slice(0, Math.max(3, Math.floor(pts.length * 0.45)));
      }

      function currentPull() {
        if (drag) {
          let dx = (drag.px - drag.sx) * MAXPULL / DRAGMAX, dy = (drag.py - drag.sy) * MAXPULL / DRAGMAX;
          if (dx > 6) dx = 6; // can't pull forwards much
          const l = Math.hypot(dx, dy);
          if (l > MAXPULL) { dx *= MAXPULL / l; dy *= MAXPULL / l; }
          return { x: dx, y: dy };
        }
        if (kbd) {
          const a = kbd.ang * Math.PI / 180;
          return { x: -Math.cos(a) * MAXPULL * kbd.pow, y: Math.sin(a) * MAXPULL * kbd.pow };
        }
        return null;
      }

      // ---------- input ----------
      function onDown(e) {
        e.preventDefault();
        if (state === 'intro') { state = 'aim'; stateT = 0; return; }
        if (state === 'flying') { split(); return; }
        if (state === 'banner' && banner && banner.t > 0.6) { banner.next(); return; }
        if (state !== 'aim') return;
        const p = cv.pointer(e);
        drag = { sx: p.x, sy: p.y, px: p.x, py: p.y, id: e.pointerId };
        kbd = null; lastPullLen = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
      function onMove(e) {
        if (!drag) return;
        e.preventDefault();
        const p = cv.pointer(e); drag.px = p.x; drag.py = p.y;
      }
      function onUp(e) {
        if (!drag) return;
        e.preventDefault();
        const pull = currentPull(); drag = null;
        if (pull) launch(pull);
      }
      function onCancel() { drag = null; }
      function onKey(e) {
        const k = e.key;
        if (k === 'r' || k === 'R') { e.preventDefault(); restartLevel(true); return; }
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd', 'Enter'].includes(k)) return;
        e.preventDefault();
        if (k === ' ' || k === 'Enter') {
          if (state === 'intro') { state = 'aim'; stateT = 0; return; }
          if (state === 'flying') { split(); return; }
          if (state === 'banner' && banner && banner.t > 0.6) { banner.next(); return; }
          if (state === 'aim' && kbd) { launch(currentPull()); kbd = null; return; }
        }
        if (state === 'intro') { state = 'aim'; stateT = 0; }
        if (state !== 'aim') return;
        if (!kbd) kbd = { ang: 40, pow: 0.75 };
        if (k === 'ArrowUp' || k === 'w') kbd.ang = Math.min(85, kbd.ang + 3);
        if (k === 'ArrowDown' || k === 's') kbd.ang = Math.max(-10, kbd.ang - 3);
        if (k === 'ArrowRight' || k === 'd') kbd.pow = Math.min(1, kbd.pow + 0.04);
        if (k === 'ArrowLeft' || k === 'a') kbd.pow = Math.max(0.2, kbd.pow - 0.04);
      }
      function onBtn(e) { e.preventDefault(); e.stopPropagation(); restartLevel(true); }
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onCancel);
      btn.addEventListener('pointerdown', onBtn);
      const noTouch = e => e.preventDefault();
      canvas.addEventListener('touchstart', noTouch, { passive: false });
      window.addEventListener('keydown', onKey);

      // ---------- camera ----------
      function towerView() {
        const L = LV(), w = L.right - L.left + 40;
        return { cx: (L.left + L.right) / 2, z: Math.min(1.1, VW / w) };
      }
      function aimWideView() {
        const L = LV(), left = 14, right = L.right + 10;
        return { cx: (left + right) / 2, z: VW / (right - left) };
      }
      function updateCamera(dt) {
        if (state === 'intro') { const v = towerView(); camT.cx = v.cx; camT.z = v.z; }
        else if (state === 'aim') {
          if (drag || kbd) { const v = aimWideView(); camT.cx = v.cx; camT.z = v.z; }
          else { camT.cx = 78; camT.z = 1.3; }
        } else if (state === 'flying' && flying.length) {
          const c = flying[0], x = c.position.x / S, L = LV();
          if (x > L.left - 60) { const v = towerView(); camT.cx = v.cx; camT.z = v.z; }
          else { camT.cx = x + 40; camT.z = 0.8; }
        } else if (state === 'settle') { const v = towerView(); camT.cx = v.cx; camT.z = v.z; }
        const kz = Math.min(1, dt * (state === 'clear' ? 6 : 3.2)), kx = Math.min(1, dt * (state === 'flying' ? 5 : 3.2));
        cam.z += (camT.z - cam.z) * kz;
        cam.cx += (camT.cx - cam.cx) * kx;
        // vertical: keep ground at fixed screen line, but lift to follow high cones
        let vy = G - GROUND_SY / cam.z;
        if (state === 'flying' && flying.length) {
          const cy = flying[0].position.y / S;
          if (cy < vy + 24 / cam.z) vy = cy - 24 / cam.z;
        }
        cam.vy += (vy - cam.vy) * Math.min(1, dt * 8);
        if (Math.abs(cam.vy - vy) > 400) cam.vy = vy;
      }
      function view() {
        const vw = VW / cam.z, vh = VH / cam.z;
        let vx = cam.cx - vw / 2;
        if (vw >= WW) vx = (WW - vw) / 2; else vx = Math.max(0, Math.min(WW - vw, vx));
        let vy = Math.max(0, Math.min(WH - vh, cam.vy));
        return { vx, vy, vw, vh };
      }
      function toScreen(x, y, v) { return { x: (x - v.vx) * cam.z, y: (y - v.vy) * cam.z }; }

      // ---------- tick coverage (anti-softlock) ----------
      function isCovered(t, blockers) {
        const x = t.position.x, y = t.position.y;
        // ray straight up from the tick: something solid right above?
        if (M.Query.ray(blockers, { x, y: y - 8 * S }, { x, y: y - 60 * S }, 2).length) return true;
        // contact with a body resting on top of it
        const pairs = engine.pairs.list;
        for (let i = 0; i < pairs.length; i++) {
          const p = pairs[i];
          if (!p.isActive) continue;
          const o = p.bodyA === t ? p.bodyB : p.bodyB === t ? p.bodyA : null;
          if (!o || o.label === 'ground' || o.label === 'tick') continue;
          if (o.position.y < y - 3 * S) return true;
        }
        return false;
      }
      function worldSettled() {
        const bs = M.Composite.allBodies(engine.world);
        for (const b of bs) {
          if (b.isStatic) continue;
          if (b.speed > 0.15 || Math.abs(b.angularVelocity) > 0.01) return false;
        }
        return true;
      }

      // ---------- update ----------
      let acc = 0;
      function physicsStep() {
        M.Engine.update(engine, STEP);
        levelT += STEP / 1000 * timeScale;
        ticks.concat(nests).forEach(t => {
          if (!t.alive) return;
          const dv = Math.hypot(t.velocity.x - t.pv.x, t.velocity.y - t.pv.y);
          t.pv = { x: t.velocity.x, y: t.velocity.y };
          if (levelT < 1) return;
          const x = t.position.x / S, y = t.position.y / S;
          const out = x > WW + 40 || x < -30 || y > G + 40;
          if (t.label === 'tick' && (out || dv > (mercy() ? 1.2 : 3) * timeScale)) popTick(t);
          if (t.label === 'nest' && (out || dv > 3.5 * timeScale)) boomQ.push(t);
        });
        while (boomQ.length) explode(boomQ.shift());
        while (breakQ.length) breakPlank(breakQ.shift());
      }

      function update(dt) {
        if (!engine) return;
        stateT += dt;
        if (slowT > 0) { slowT -= dt; if (slowT <= 0) timeScale = 1; }
        engine.timing.timeScale = timeScale;
        acc += dt * 1000;
        let n = 0;
        while (acc >= STEP && n < 4) { physicsStep(); acc -= STEP; n++; }
        if (acc > STEP * 4) acc = 0;

        // flying cones
        if (state === 'flying') {
          for (let i = flying.length - 1; i >= 0; i--) {
            const c = flying[i];
            c.age += dt;
            c.trail.push([c.position.x / S, c.position.y / S]); if (c.trail.length > 14) c.trail.shift();
            if (i === 0) lastTrail.push([c.position.x / S, c.position.y / S]);
            c.slow = c.speed < 0.4 ? c.slow + dt : 0;
            const out = c.position.x / S > WW + 30 || c.position.y / S > G + 40;
            if (out) M.Composite.remove(engine.world, c);
            if (out || c.slow > 0.4 || c.age > 6) { flying.splice(i, 1); if (!out) restCones.push(c); }
          }
          while (restCones.length > 4) M.Composite.remove(engine.world, restCones.shift());
          if (!flying.length) { state = 'settle'; stateT = 0; }
          // ticks get scared when a cone flies close
          ticks.forEach(t => {
            if (!t.alive) return;
            flying.forEach(c => { if (Math.hypot(c.position.x - t.position.x, c.position.y - t.position.y) < 50 * S) t.scare = 0.6; });
          });
        }

        // anti-softlock: squash ticks buried under rubble
        if (shotsFired > 0 && (state === 'settle' || state === 'aim')) {
          const blockers = M.Composite.allBodies(engine.world).filter(b => isBlock(b) || b.label === 'cone');
          ticks.forEach(t => {
            if (!t.alive) return;
            if (t.speed < 0.3 && isCovered(t, blockers)) {
              t.cov += dt;
              if (t.cov > (mercy() ? 0.8 : 1.6)) popTick(t, null, true);
            } else t.cov = Math.max(0, t.cov - dt * 2);
          });
        }

        if (state === 'settle') {
          const settled = worldSettled();
          const pending = ticks.some(t => t.alive && t.cov > 0);
          if ((settled && !pending && stateT > 0.6) || stateT > 6) {
            if (stateT > 6) ticks.forEach(t => { if (t.alive && t.cov > 0) popTick(t, null, true); });
            if (state === 'settle') {
              if (shotPops === 0 && ticks.some(t => t.alive)) taunt();
              if (cones > 0) { state = 'aim'; stateT = 0; }
              else { state = 'fail'; stateT = 0; }
            }
          }
        }
        if (state === 'fail' && stateT > 1.1) restartLevel(false);
        if (state === 'intro' && stateT > 1.8) { state = 'aim'; stateT = 0; }
        if (state === 'clear' && stateT > 1.4) showBanner();
        if (state === 'banner' && banner) { banner.t += dt; if (banner.t > 3.2) banner.next(); }

        // stretch creak
        if (drag || kbd) {
          const pl = currentPull(), l = pl ? Math.hypot(pl.x, pl.y) : 0;
          if (Math.floor(l / 7) > Math.floor(lastPullLen / 7)) api.sfx('step');
          lastPullLen = l;
        }

        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97;
          if (p.wasp) { p.vx += (Math.random() - 0.5) * 600 * dt; }
          if (p.y > G - 1 && !p.wasp) { p.y = G - 1; p.vy *= -0.3; p.vx *= 0.6; }
          if (p.t > p.life) parts.splice(i, 1);
        }
        for (let i = popups.length - 1; i >= 0; i--) { popups[i].t += dt; if (popups[i].t > 1.3) popups.splice(i, 1); }
        for (let i = bubbles.length - 1; i >= 0; i--) { bubbles[i].t += dt; if (bubbles[i].t > 1.8 || !bubbles[i].tick.alive) bubbles.splice(i, 1); }
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > 0.35) rings.splice(i, 1); }
        ticks.forEach(t => { if (t.scare > 0) t.scare -= dt; });
        if (cheer > 0) cheer -= dt;
        if (bandWob > 0) bandWob = Math.max(0, bandWob - dt * 2.2);
        shake = Math.max(0, shake - dt * 18);
        updateCamera(dt);
      }

      function taunt() {
        const al = ticks.filter(t => t.alive);
        if (!al.length) return;
        const t = al[Math.floor(Math.random() * al.length)];
        bubbles.push({ tick: t, str: TAUNTS[Math.floor(Math.random() * TAUNTS.length)], t: 0 });
      }

      function showBanner() {
        const left = cones;
        const stars = left >= 2 ? 3 : left === 1 ? 2 : 1;
        const bonus = left * 1000;
        score += bonus;
        state = 'banner'; timeScale = 1;
        api.sfx('ding');
        const last = level === LEVELS.length - 1;
        banner = { t: 0, stars, bonus, last, done: false, next() {
          if (this.done) return; this.done = true;
          if (last) return;
          level++; buildLevel(false);
          api.toast(LV().hint, 1800);
        } };
        for (let i = 0; i < stars; i++) later(() => api.sfx('coin'), 350 + i * 260);
        if (last) later(() => api.win(), 1600);
      }

      // ---------- draw ----------
      function drawBox(b) {
        const x = b.position.x / S, y = b.position.y / S, w = b.pw, h = b.ph;
        wx.save();
        wx.translate(Math.round(x), Math.round(y)); wx.rotate(b.angle);
        const x0 = -w / 2, y0 = -h / 2;
        if (b.label === 'plank') {
          wx.fillStyle = '#3b2416'; wx.fillRect(x0, y0, w, h);
          wx.fillStyle = '#b07a44'; wx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
          wx.fillStyle = '#d19a5c';
          if (w > h) wx.fillRect(x0 + 1, y0 + 1, w - 2, 1); else wx.fillRect(x0 + 1, y0 + 1, 1, h - 2);
          wx.fillStyle = '#8a5a30';
          if (w > h) { for (let i = 6; i < w - 4; i += 11) wx.fillRect(x0 + i, y0 + 2 + (i % 2), 4, 1); }
          else { for (let i = 5; i < h - 4; i += 9) wx.fillRect(x0 + 2 + (i % 2), y0 + i, 1, 4); }
        } else {
          wx.fillStyle = '#3c4048'; wx.fillRect(x0, y0, w, h);
          wx.fillStyle = '#8a909a'; wx.fillRect(x0 + 1, y0 + 1, w - 2, h - 2);
          wx.fillStyle = '#b8bec6'; wx.fillRect(x0 + 2, y0 + 2, 3, 2);
          wx.fillStyle = '#6a7078'; wx.fillRect(x0 + w - 4, y0 + h - 4, 2, 2); wx.fillRect(x0 + 3, y0 + h - 5, 3, 1);
        }
        wx.restore();
      }

      function drawTick(b, t) {
        const look = flying.length ? flying[0] : null;
        const scared = b.scare > 0 || b.cov > 0;
        const smug = bubbles.some(q => q.tick === b);
        const bob = scared ? Math.round(Math.sin(t * 40) * 1) : Math.floor(t * 3 + b.ph0) % 2;
        const x = Math.round(b.position.x / S - 7), y = Math.round(b.position.y / S - 7 - (scared ? 0 : bob));
        api.drawPixels(wx, TICK, TICKPAL, x, y, 1);
        api.drawPixels(wx, (Math.floor(t * 4 + b.ph0) % 2) ? LEGS_A : LEGS_B, TICKPAL, x, y + 11, 1);
        let lx = 1, ly = 0;
        if (look) { lx = Math.sign(look.position.x - b.position.x); ly = look.position.y < b.position.y - 10 ? -1 : 0; }
        else lx = -1; // look towards the slingshot
        if (scared) {
          wx.fillStyle = '#ffffff'; wx.fillRect(x + 2, y + 3, 4, 4); wx.fillRect(x + 8, y + 3, 4, 4);
          wx.fillStyle = '#120808'; wx.fillRect(x + 3 + (lx > 0 ? 1 : 0), y + 4, 1, 1); wx.fillRect(x + 9 + (lx > 0 ? 1 : 0), y + 4, 1, 1);
          wx.fillRect(x + 6, y + 8, 2, 2);
          wx.fillStyle = '#9fd8ff'; wx.fillRect(x + 12, y + 1 + (Math.floor(t * 6) % 3), 1, 2);
        } else if (smug) {
          wx.fillStyle = '#ffffff'; wx.fillRect(x + 2, y + 5, 4, 2); wx.fillRect(x + 8, y + 5, 4, 2);
          wx.fillStyle = '#120808'; wx.fillRect(x + 3, y + 6, 2, 1); wx.fillRect(x + 9, y + 6, 2, 1);
          wx.fillStyle = '#8a3a32'; wx.fillRect(x + 2, y + 4, 4, 1); wx.fillRect(x + 8, y + 4, 4, 1);
          wx.fillStyle = '#f2a7b8'; wx.fillRect(x + 4, y + 8, 6, 1); wx.fillRect(x + 3, y + 7, 1, 1); wx.fillRect(x + 10, y + 7, 1, 1);
        } else {
          wx.fillStyle = '#120808'; wx.fillRect(x + 2, y + 2, 4, 1); wx.fillRect(x + 8, y + 2, 4, 1); // angry brows
          wx.fillStyle = '#ffffff'; wx.fillRect(x + 2, y + 3, 4, 3); wx.fillRect(x + 8, y + 3, 4, 3);
          wx.fillStyle = '#120808';
          const px = lx < 0 ? 0 : 2, py = ly < 0 ? 0 : 1;
          wx.fillRect(x + 2 + px, y + 3 + py, 2, 2); wx.fillRect(x + 8 + px, y + 3 + py, 2, 2);
          wx.fillStyle = '#f2a7b8'; wx.fillRect(x + 5, y + 8, 4, 1);
        }
      }

      function drawSling(t, pull) {
        const bx = ANCHOR.x, by = ANCHOR.y;
        let px = bx, py = by;
        if (pull) { px += pull.x; py += pull.y; }
        else if (bandWob > 0) { const o = Math.sin(t * 50) * bandWob * 8; px += o; py -= o * 0.3; }
        const stretch = pull ? Math.hypot(pull.x, pull.y) / MAXPULL : 0;
        const bandCol = stretch > 0.75 ? '#e0443a' : stretch > 0.4 ? '#b8402e' : '#7a3a22';
        const bandW = pull ? Math.max(1.5, 3.2 - stretch * 1.6) : 3;
        // back band
        wx.strokeStyle = bandCol; wx.lineWidth = bandW;
        wx.beginPath(); wx.moveTo(bx + 6, by - 4); wx.lineTo(px + 2, py); wx.stroke();
        // trunk + fork
        wx.fillStyle = '#3b2416'; wx.fillRect(bx - 3, by + 3, 6, G - by - 3);
        wx.fillStyle = '#5b3a24'; wx.fillRect(bx - 2, by + 3, 4, G - by - 3);
        wx.fillStyle = '#3b2416'; wx.fillRect(bx - 8, by - 8, 4, 13); wx.fillRect(bx + 4, by - 8, 4, 13); wx.fillRect(bx - 7, by + 2, 14, 4);
        wx.fillStyle = '#7a4a2a'; wx.fillRect(bx - 7, by - 8, 1, 11); wx.fillRect(bx + 5, by - 8, 1, 11);
        // loaded cone
        if ((state === 'aim' || state === 'intro') && cones > 0) api.drawPixels(wx, CONE, CONEPAL, Math.round(px - 5), Math.round(py - 5), 1);
        // pouch
        wx.fillStyle = '#4a2a1a'; wx.fillRect(Math.round(px - 3), Math.round(py - 1), 6, 4);
        // front band
        wx.strokeStyle = bandCol; wx.lineWidth = bandW;
        wx.beginPath(); wx.moveTo(bx - 6, by - 4); wx.lineTo(px - 2, py); wx.stroke();
      }

      function drawWorld(t) {
        wx.drawImage(bg, 0, 0);
        const pull = state === 'aim' ? currentPull() : null;

        // last shot ghost path
        wx.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < lastTrail.length; i += 4) wx.fillRect(Math.round(lastTrail[i][0]), Math.round(lastTrail[i][1]), 1, 1);
        // aim preview
        if (pull && Math.hypot(pull.x, pull.y) >= 4) {
          const pts = trajectory(pull);
          pts.forEach((p, i) => {
            if (i % 3) return;
            wx.fillStyle = 'rgba(255,255,255,' + (1 - i / pts.length * 0.7) + ')';
            const s = i < pts.length * 0.5 ? 2 : 1;
            wx.fillRect(Math.round(p[0]) - 1, Math.round(p[1]) - 1, s, s);
          });
        }

        // characters: Eva pulling the sling, Magnus + Laurenz cheering
        const pulling = !!(drag || kbd);
        const jumpy = cheer > 0 && Math.floor(t * 8) % 2 === 0;
        api.drawChar(wx, 'magnus', jumpy ? 'jump' : 'idle', 1, G - 16 - (jumpy ? 4 : 0), 1, false);
        const jumpy2 = cheer > 0 && Math.floor(t * 8 + 1) % 2 === 0;
        api.drawChar(wx, 'laurenz', jumpy2 ? 'jump' : 'idle', 14, G - 16 - (jumpy2 ? 4 : 0), 1, false);
        const evaX = ANCHOR.x - 20 + (pull ? Math.max(-6, Math.round(pull.x * 0.25)) : 0);
        api.drawChar(wx, 'eva', pulling ? 'run1' : (state === 'flying' && stateT < 0.4 ? 'jump' : 'idle'), evaX, G - 16, 1, false);
        if (pulling && pull) { // Eva's arm reaching to the pouch
          wx.strokeStyle = '#e3bfae'; wx.lineWidth = 2;
          wx.beginPath(); wx.moveTo(evaX + 9, G - 8); wx.lineTo(ANCHOR.x + pull.x, ANCHOR.y + pull.y); wx.stroke();
        }
        drawSling(t, pull);

        // bodies
        M.Composite.allBodies(engine.world).forEach(b => {
          if (isBlock(b)) drawBox(b);
          else if (b.label === 'nest' && b.alive) {
            const jig = b.speed > 0.3 ? Math.round(Math.sin(t * 50)) : 0;
            const x = Math.round(b.position.x / S - 6) + jig, y = Math.round(b.position.y / S - 6);
            api.drawPixels(wx, NEST, NESTPAL, x, y, 1);
            wx.fillStyle = '#1d1d1d';
            for (let i = 0; i < 3; i++) {
              const a = t * (3 + i) + i * 2;
              wx.fillRect(Math.round(x + 6 + Math.cos(a) * 10), Math.round(y + 4 + Math.sin(a * 1.3) * 6), 1, 1);
              wx.fillStyle = '#f5d442'; wx.fillRect(Math.round(x + 7 + Math.cos(a) * 10), Math.round(y + 4 + Math.sin(a * 1.3) * 6), 1, 1); wx.fillStyle = '#1d1d1d';
            }
          }
        });
        ticks.forEach(b => { if (b.alive) drawTick(b, t); });
        M.Composite.allBodies(engine.world).forEach(b => {
          if (b.label !== 'cone') return;
          if (b.trail) b.trail.forEach((p, i) => {
            if (flying.indexOf(b) < 0) return;
            wx.fillStyle = i % 2 ? 'rgba(255,255,255,.5)' : 'rgba(240,200,120,.6)';
            const s = i > 8 ? 2 : 1; wx.fillRect(Math.round(p[0]) - (s >> 1), Math.round(p[1]) - (s >> 1), s, s);
          });
          wx.save();
          wx.translate(Math.round(b.position.x / S), Math.round(b.position.y / S)); wx.rotate(b.angle);
          api.drawPixels(wx, CONE, CONEPAL, -5, -5, 1);
          wx.restore();
        });
        // rings
        rings.forEach(r => {
          const k = r.t / 0.35, rad = (r.big ? 8 : 4) + k * (r.big ? 50 : 18);
          wx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; wx.lineWidth = r.big ? 3 : 2;
          wx.beginPath(); wx.arc(r.x, r.y, rad, 0, Math.PI * 2); wx.stroke();
          if (k < 0.3) { wx.fillStyle = 'rgba(255,255,240,' + (0.8 - k * 2) + ')'; wx.beginPath(); wx.arc(r.x, r.y, rad * 0.6, 0, Math.PI * 2); wx.fill(); }
        });
        // particles
        parts.forEach(p => {
          const s = p.wasp ? 2 : Math.max(1, Math.round(p.s * (1 - p.t / p.life) + 0.5));
          wx.fillStyle = p.c; wx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
          if (p.wasp) { wx.fillStyle = '#f5d442'; wx.fillRect(Math.round(p.x), Math.round(p.y - 1), 1, 1); }
        });
      }

      function bubble(x, y, str) {
        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        const w = Math.ceil(ctx.measureText(str).width) + 8;
        const bx = Math.round(Math.max(2, Math.min(VW - w - 2, x - w / 2))), by = Math.round(y - 20);
        ctx.fillStyle = '#1d1d1d'; ctx.fillRect(bx - 1, by - 1, w + 2, 15);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, w, 13);
        ctx.fillRect(Math.round(x) - 2, by + 13, 4, 2); ctx.fillRect(Math.round(x) - 1, by + 15, 2, 2);
        ctx.restore();
        api.text(ctx, str, bx + 4, by + 3, 8, '#1d1d1d', 'left', false);
      }

      function draw(t) {
        if (!engine) {
          ctx.fillStyle = '#7cc6dc'; ctx.fillRect(0, 0, VW, VH);
          api.text(ctx, 'Lade...', VW / 2, VH / 2, 8, '#fff', 'center');
          return;
        }
        drawWorld(t);
        const v = view();
        const sx = shake ? (Math.random() - 0.5) * shake * 2 : 0, sy = shake ? (Math.random() - 0.5) * shake * 2 : 0;
        ctx.fillStyle = '#7a4a2a'; ctx.fillRect(0, 0, VW, VH);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(wc, v.vx, v.vy, v.vw, v.vh, Math.round(sx), Math.round(sy), VW, VH);

        // screen-space overlays: popups, bubbles
        popups.forEach(p => {
          const s = toScreen(p.x, p.y, v), k = p.t / 1.3;
          const yy = s.y - k * 22 - (p.big ? 6 : 0);
          if (p.big && Math.floor(p.t * 10) % 2 && p.t < 0.4) return;
          api.text(ctx, p.str, Math.round(s.x), Math.round(yy), 8, p.color, 'center');
        });
        bubbles.forEach(q => {
          const s = toScreen(q.tick.position.x / S, q.tick.position.y / S - 8, v);
          bubble(s.x, s.y, q.str);
        });
        // off-screen marker for high cones
        flying.forEach(c => {
          const s = toScreen(c.position.x / S, c.position.y / S, v);
          if (s.y < 30) { ctx.fillStyle = '#f5d442'; ctx.fillRect(Math.round(s.x) - 2, 30, 4, 3); }
        });

        // HUD
        ctx.fillStyle = 'rgba(13,21,17,.6)'; ctx.fillRect(0, 0, VW, 28);
        api.text(ctx, 'LEVEL ' + (level + 1) + '/' + LEVELS.length, 4, 3, 8, '#f6e7c8', 'left');
        api.text(ctx, String(score), VW - 4, 3, 8, '#f5d442', 'right');
        const total = LV().cones;
        for (let i = 0; i < total; i++) {
          if (i < cones) api.drawPixels(ctx, CONE, CONEPAL, 4 + i * 12, 15, 1);
          else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(6 + i * 12, 17, 6, 7); }
        }
        const left = ticks.filter(k => k.alive).length;
        api.drawPixels(ctx, TICK, TICKPAL, VW - 54, 15, 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(VW - 52, 18, 3, 2); ctx.fillRect(VW - 46, 18, 3, 2);
        api.text(ctx, left + '/' + ticks.length, VW - 4, 17, 8, '#f6e7c8', 'right');
        if (mercy()) api.text(ctx, 'Zecken geschwächt', VW / 2, 32, 8, '#f2a7b8', 'center');

        // hints in the dirt band
        const bob = Math.floor(t * 2) % 2;
        if (state === 'aim' && !drag && !kbd && shotsFired === 0 && level === 0) {
          api.text(ctx, 'Ziehen &', 58, 276 + bob, 8, '#ffffff', 'left');
          api.text(ctx, 'loslassen!', 58, 288 + bob, 8, '#ffffff', 'left');
        } else if (state === 'flying' && !splitUsed && splitHintShown <= 2 && level < 2) {
          api.text(ctx, 'Tippen im Flug =', VW / 2, 276 + bob, 8, '#ffffff', 'center');
          api.text(ctx, 'Dreifach-Zapfen!', VW / 2, 288 + bob, 8, '#f5d442', 'center');
        } else if (state === 'intro') {
          api.text(ctx, LV().hint, VW / 2, 282, 8, '#ffffff', 'center');
        }
        if (state === 'fail') {
          ctx.fillStyle = 'rgba(13,21,17,.55)'; ctx.fillRect(0, 130, VW, 30);
          api.text(ctx, 'Keine Zapfen mehr!', VW / 2, 141, 8, '#f6e7c8', 'center');
        }

        if (state === 'banner' && banner) drawBanner(t);
      }

      function drawBanner(t) {
        const k = Math.min(1, banner.t / 0.25);
        const h = 118, y = Math.round(100 - (1 - k) * 60);
        ctx.fillStyle = 'rgba(13,21,17,.88)'; ctx.fillRect(10, y, VW - 20, h);
        ctx.fillStyle = '#f5c542'; ctx.fillRect(10, y, VW - 20, 2); ctx.fillRect(10, y + h - 2, VW - 20, 2);
        api.text(ctx, banner.last ? 'Alle Zecken weg!' : 'Level ' + (level + 1) + ' geschafft!', VW / 2, y + 10, 8, '#f6e7c8', 'center');
        for (let i = 0; i < 3; i++) {
          const on = i < banner.stars && banner.t > 0.35 + i * 0.26;
          const cx = VW / 2 - 30 + i * 30, cy = y + 40;
          const pop = on && banner.t < 0.5 + i * 0.26 ? 1 : 0;
          drawStar(cx, cy, on ? '#f5c542' : '#3a4a40', pop);
        }
        api.text(ctx, 'Bonus +' + banner.bonus, VW / 2, y + 66, 8, '#f5d442', 'center');
        api.text(ctx, 'Punkte ' + score, VW / 2, y + 80, 8, '#f6e7c8', 'center');
        if (!banner.last && banner.t > 0.6 && Math.floor(t * 2) % 2) api.text(ctx, 'Tippen = weiter', VW / 2, y + 98, 8, '#9fd8a0', 'center');
      }
      function drawStar(cx, cy, col, pop) {
        const rows = ['....X....', '...XXX...', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '.XXX.XXX.', 'XX.....XX'];
        const s = 2 + pop;
        api.drawPixels(ctx, rows, { X: col }, Math.round(cx - 4.5 * s), Math.round(cy - 3.5 * s), s);
      }

      function begin() {
        if (!alive) return;
        M = window.Matter;
        buildLevel(false);
        api.toast(LV().hint, 1800);
      }
      let frame = 0;
      stopLoop = api.loop((dt, t) => {
        if (!alive) return;
        update(dt); draw(t);
        if ((frame++ & 15) === 0) placeBtn();
      });

      if (window.Matter) begin();
      else {
        let s = document.querySelector('script[data-matter]');
        if (!s) {
          s = document.createElement('script');
          s.src = 'js/vendor/matter.min.js'; s.dataset.matter = '1';
          document.head.appendChild(s);
        }
        s.addEventListener('load', begin, { once: true });
        s.addEventListener('error', () => api.toast('Physik konnte nicht laden', 3000), { once: true });
      }

      return function cleanup() {
        alive = false;
        if (stopLoop) stopLoop();
        timers.forEach(clearTimeout);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        canvas.removeEventListener('touchstart', noTouch);
        btn.removeEventListener('pointerdown', onBtn);
        btn.remove();
        window.removeEventListener('keydown', onKey);
        if (engine && M) { M.Events.off(engine); M.Engine.clear(engine); }
        cv.destroy();
      };
    }
  };
})();

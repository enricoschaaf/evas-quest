/* Pixel-Marathon 3D – low-res three.js trail run. Eva runs 5 km (compressed) through an autumn forest. */
(function () {
  'use strict';

  const D = 1000;              // total world units = 5 km
  const KM = D / 5;
  const LANE = 1.25;
  const JUMP_V = 7.2, GRAV = 21;
  const CHUNK_LEN = 6, CHUNK_ROWS = 4, CHUNKS = 14;
  const COLS = [-18, -11, -6.5, -3.8, -2.2, -1.9, -0.65, 0.65, 1.9, 2.2, 3.8, 6.5, 11, 18];
  const SCENE_BACK = 10, SCENE_AHEAD = 76;

  function hash(a, b) { let n = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); n ^= n >>> 13; n = Math.imul(n, 0x27d4eb2f); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hill = s => 1.3 * Math.sin(s * 0.017) + 0.55 * Math.sin(s * 0.051 + 1.3) + 0.25 * Math.sin(s * 0.11 + 0.4);

  /* Eva from behind (curly hair, green backpack) + generic marathon runners with bibs */
  const BACK_TOP = [
    '....HHHH....',
    '...HhHHhH...',
    '..HHHHhHHH..',
    '..HhHHHHhH..',
    '..HHHhHHHH..',
    '..hHHHHHHh..',
    '...HHSSHH...',
    '..JJBBBBJJ..',
    '.JJBBbbBBJJ.',
    '.JJBBBBBBJJ.',
    '.SJBbBBbBJS.',
    '..JJBBBBJJ..'];
  const BACK_LEGS = {
    run1: ['...PPPPPP...', '...PP..PP...', '...PP..KK...', '...KK.......'],
    run2: ['...PPPPPP...', '...PP..PP...', '...KK..PP...', '.......KK...'],
    jump: ['...PPPPPP...', '..PP....PP..', '..KK....KK..', '............']
  };
  const EVA_PAL = { H: '#4a2c1d', h: '#6b4330', S: '#f2c39b', J: '#e3bfae', j: '#bf968a', B: '#2f5d4a', b: '#1f4034', P: '#8a8f86', K: '#5a4a42' };
  const RUNNER_PALS = [
    { H: '#2a2a2a', h: '#444', S: '#e9b48c', J: '#d94c3d', B: '#d94c3d', b: '#f6e7c8', P: '#1e2420', K: '#f2f2f2' },
    { H: '#c98a3a', h: '#a86a22', S: '#f2c39b', J: '#4a7fd9', B: '#4a7fd9', b: '#f6e7c8', P: '#2a2c33', K: '#f5d442' },
    { H: '#7a2a1a', h: '#5a1a10', S: '#d9a07a', J: '#8a5bd9', B: '#8a5bd9', b: '#f6e7c8', P: '#1e2420', K: '#d94c3d' }
  ];

  let threeLoading = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve();
    if (threeLoading) return threeLoading;
    threeLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/three.min.js';
      s.onload = () => res(); s.onerror = () => { threeLoading = null; rej(new Error('three load failed')); };
      document.head.appendChild(s);
    });
    return threeLoading;
  }

  GAMES['run_3d'] = {
    title: 'Pixel-Marathon 3D',
    intro: 'Lauf 5 km durch den Herbstwald! Wischen oder links/rechts tippen = Spur wechseln, SPRING-Knopf oder nach oben wischen = springen. Sammle Becher & Gels – im Ziel warten Magnus und Laurenz!',
    start(root, api) {
      api.music('game');
      let alive = true, game = null;
      const loading = document.createElement('div');
      loading.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Press Start 2P",monospace;font-size:10px;color:#f6e7c8;background:#14201a';
      loading.textContent = 'Lade Wald…';
      root.appendChild(loading);
      loadThree().then(() => { if (!alive) return; loading.remove(); game = run(root, api); })
        .catch(() => { if (alive) loading.textContent = 'Konnte 3D nicht laden :('; });
      return function cleanup() { alive = false; loading.remove(); if (game) game(); game = null; };
    }
  };

  function run(root, api) {
    const T = window.THREE;
    let alive = true;
    const disposables = [];
    const keep = o => { disposables.push(o); return o; };

    /* ---------- canvases & sizing ---------- */
    const W = 160;
    let H = 284;
    const glCanvas = document.createElement('canvas');
    const hud = document.createElement('canvas');
    [glCanvas, hud].forEach(c => {
      c.style.cssText = 'position:absolute;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;';
      root.appendChild(c);
    });
    const hctx = hud.getContext('2d');
    const renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    const camera = new T.PerspectiveCamera(64, W / H, 0.1, 90);
    function fit() {
      const rw = root.clientWidth || 360, rh = root.clientHeight || 640;
      const nh = clamp(Math.round(W * rh / rw), 220, 340);
      if (nh !== H || hud.width !== W) {
        H = nh; hud.width = W; hud.height = H;
        renderer.setSize(W, H, false);
        camera.aspect = W / H; camera.updateProjectionMatrix();
      }
      const sc = Math.min(rw / W, rh / H);
      const cw = Math.floor(W * sc), ch = Math.floor(H * sc);
      [glCanvas, hud].forEach(c => {
        c.style.width = cw + 'px'; c.style.height = ch + 'px';
        c.style.left = Math.floor((rw - cw) / 2) + 'px'; c.style.top = Math.floor((rh - ch) / 2) + 'px';
      });
    }
    hud.width = 0; fit();
    const ro = new ResizeObserver(fit); ro.observe(root);

    /* ---------- scene ---------- */
    const SKY = 0xf0b878;
    const scene = new T.Scene();
    scene.background = new T.Color(SKY);
    scene.fog = new T.Fog(SKY, 22, 66);
    scene.add(new T.HemisphereLight(0xfff0d8, 0x4a3a20, 0.75));
    const sun = new T.DirectionalLight(0xffe2b0, 0.75); sun.position.set(-4, 8, 3); scene.add(sun);

    const lam = (color, extra) => keep(new T.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra || {})));

    function pixTex(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g);
      const t = keep(new T.CanvasTexture(c));
      t.magFilter = T.NearestFilter; t.minFilter = T.NearestFilter; t.generateMipmaps = false;
      return t;
    }
    function rowsTex(rows, pal) {
      return pixTex(12, 16, g => api.drawPixels(g, rows, pal, 0, 0, 1));
    }
    const backFrames = pal => ({
      run1: rowsTex(BACK_TOP.concat(BACK_LEGS.run1), pal),
      run2: rowsTex(BACK_TOP.concat(BACK_LEGS.run2), pal),
      jump: rowsTex(BACK_TOP.concat(BACK_LEGS.jump), pal)
    });
    const evaTex = backFrames(EVA_PAL);
    const runnerTex = RUNNER_PALS.map(backFrames);
    const charTex = (who, frame, flip) => pixTex(12, 16, g => api.drawChar(g, who, frame, 0, 0, 1, flip));

    function makeSprite(tex, w, h) {
      const m = keep(new T.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
      const s = new T.Sprite(m); s.scale.set(w, h, 1); s.center.set(0.5, 0);
      scene.add(s); return s;
    }

    /* ---------- ground chunks (vertex-coloured, flat shaded) ---------- */
    const groundMat = keep(new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const TRAIL = [0x8a5a34, 0x7a4a2a, 0x94643a, 0x83542f];
    const GRASS = [0x5e7a2e, 0x6f8a35, 0x8a7a2a, 0x4f6a28, 0xb5651d, 0xc9822b, 0x6a6a26];
    const tmpC = new T.Color();
    const nC = COLS.length - 1;
    const chunks = [];
    for (let i = 0; i < CHUNKS; i++) {
      const geo = keep(new T.BufferGeometry());
      const n = CHUNK_ROWS * nC * 6;
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3));
      const mesh = new T.Mesh(geo, groundMat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      chunks.push({ mesh, geo, idx: -999 });
    }
    function vY(row, col) {
      const s = row * (CHUNK_LEN / CHUNK_ROWS), x = COLS[col], ax = Math.abs(x);
      let y = hill(s);
      if (ax > 2.1) y += (ax - 2.1) * 0.16 + hash(row * 7 + 3, col) * Math.min(1, (ax - 2.1) / 3) * 0.9;
      else if (ax > 1.85) y += 0.06;
      return y;
    }
    function buildChunk(ch, idx) {
      ch.idx = idx;
      const pos = ch.geo.attributes.position.array, col = ch.geo.attributes.color.array;
      const dz = CHUNK_LEN / CHUNK_ROWS;
      let p = 0;
      for (let r = 0; r < CHUNK_ROWS; r++) {
        const row = idx * CHUNK_ROWS + r;
        const z0 = -row * dz, z1 = -(row + 1) * dz;
        for (let c = 0; c < nC; c++) {
          const xa = COLS[c], xb = COLS[c + 1];
          const y00 = vY(row, c), y01 = vY(row, c + 1), y10 = vY(row + 1, c), y11 = vY(row + 1, c + 1);
          const mid = (xa + xb) / 2, h = hash(row, c * 13 + 5);
          let hex;
          if (Math.abs(mid) < 1.9) hex = (h < 0.07) ? 0xc9822b : TRAIL[(h * 4) | 0];
          else if (Math.abs(mid) < 2.2) hex = 0x5b3a24;
          else hex = GRASS[(h * GRASS.length) | 0];
          tmpC.setHex(hex);
          const v = [xa, y00, z0, xb, y01, z0, xa, y10, z1, xb, y01, z0, xb, y11, z1, xa, y10, z1];
          for (let k = 0; k < 18; k++) pos[p * 3 + k] = v[k];
          for (let k = 0; k < 6; k++) { col[(p + k) * 3] = tmpC.r; col[(p + k) * 3 + 1] = tmpC.g; col[(p + k) * 3 + 2] = tmpC.b; }
          p += 6;
        }
      }
      ch.geo.attributes.position.needsUpdate = true; ch.geo.attributes.color.needsUpdate = true;
      ch.geo.computeVertexNormals();
      ch.geo.computeBoundingSphere();
    }

    /* ---------- instanced pools ---------- */
    const dummy = new T.Object3D();
    function pool(geo, mat, max, colored) {
      const m = new T.InstancedMesh(keep(geo), mat, max);
      m.count = 0; m.frustumCulled = false;
      if (colored) m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      scene.add(m);
      return m;
    }
    const trunkGeo = new T.CylinderGeometry(0.12, 0.16, 1, 5); trunkGeo.translate(0, 0.5, 0);
    const coneGeo = new T.ConeGeometry(1, 1, 6); coneGeo.translate(0, 0.5, 0);
    const trunks = pool(trunkGeo, lam(0x5b3a24), 120);
    const leaves = pool(coneGeo, lam(0xffffff), 240, true);
    const stemGeo = new T.CylinderGeometry(0.05, 0.06, 0.18, 5); stemGeo.translate(0, 0.09, 0);
    const capGeo = new T.ConeGeometry(0.16, 0.12, 6); capGeo.translate(0, 0.22, 0);
    const stems = pool(stemGeo, lam(0xf6e7c8), 40);
    const caps = pool(capGeo, lam(0xd94c3d), 40);
    const rockGeo = new T.DodecahedronGeometry(0.42, 0);
    const rocks = pool(rockGeo, lam(0x8a8f86), 20);
    const rootGeo = new T.TorusGeometry(0.45, 0.09, 4, 7, Math.PI);
    const roots = pool(rootGeo, lam(0x6b4330), 20);
    const logGeo = new T.CylinderGeometry(0.27, 0.27, 4.4, 7); logGeo.rotateZ(Math.PI / 2);
    const logs = pool(logGeo, lam(0x7a4a2a), 10);
    const cupGeo = new T.CylinderGeometry(0.15, 0.1, 0.3, 6);
    const cups = pool(cupGeo, lam(0xf2f2f2, { emissive: 0x3a6f8f, emissiveIntensity: 0.5 }), 40);
    const gelGeo = new T.BoxGeometry(0.16, 0.3, 0.06);
    const gels = pool(gelGeo, lam(0xf5c542, { emissive: 0xd9822b, emissiveIntensity: 0.6 }), 20);
    const shadowGeo = keep(new T.CircleGeometry(0.32, 8)); shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = keep(new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    const shadow = new T.Mesh(shadowGeo, shadowMat); scene.add(shadow);

    const LEAF_COLS = [0xd9822b, 0xf2b33d, 0xd94c3d, 0xb5651d, 0x6f8a35, 0xe8a03a];
    function placeTrees(list) {
      let t = 0, l = 0;
      for (const tr of list) {
        if (t >= 120 || l >= 238) break;
        const y = hill(tr.s) + (Math.abs(tr.x) - 2.1) * 0.16 + (tr.dy || 0);
        dummy.rotation.set(0, tr.rot, 0);
        dummy.position.set(tr.x, y, -tr.s); dummy.scale.set(1, tr.h * 0.45, 1); dummy.updateMatrix(); trunks.setMatrixAt(t++, dummy.matrix);
        tmpC.setHex(tr.c);
        dummy.position.set(tr.x, y + tr.h * 0.3, -tr.s); dummy.scale.set(tr.r, tr.h * 0.55, tr.r); dummy.updateMatrix();
        leaves.setMatrixAt(l, dummy.matrix); leaves.setColorAt(l++, tmpC);
        dummy.position.set(tr.x, y + tr.h * 0.6, -tr.s); dummy.scale.set(tr.r * 0.7, tr.h * 0.45, tr.r * 0.7); dummy.updateMatrix();
        tmpC.multiplyScalar(1.12);
        leaves.setMatrixAt(l, dummy.matrix); leaves.setColorAt(l++, tmpC);
      }
      trunks.count = t; leaves.count = l;
      trunks.instanceMatrix.needsUpdate = true; leaves.instanceMatrix.needsUpdate = true; leaves.instanceColor.needsUpdate = true;
    }

    /* ---------- signs, finish arch, friends ---------- */
    const postGeo = keep(new T.BoxGeometry(0.1, 1.4, 0.1));
    const postMat = lam(0x5b3a24);
    const kmTex = [1, 2, 3, 4].map(k => pixTex(32, 16, g => {
      g.fillStyle = '#f6e7c8'; g.fillRect(0, 0, 32, 16); g.fillStyle = '#3b2416'; g.fillRect(0, 0, 32, 1); g.fillRect(0, 15, 32, 1); g.fillRect(0, 0, 1, 16); g.fillRect(31, 0, 1, 16);
      g.fillStyle = '#d94c3d'; g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top'; g.textAlign = 'center'; g.fillText(k + 'KM', 16, 4);
    }));
    const boardGeo = keep(new T.PlaneGeometry(1.4, 0.7));
    const boardMat = keep(new T.MeshBasicMaterial({ map: kmTex[0] }));
    const sign = new T.Group();
    const signPost = new T.Mesh(postGeo, postMat); signPost.position.y = 0.7;
    const board = new T.Mesh(boardGeo, boardMat); board.position.y = 1.5; board.rotation.y = -0.35;
    sign.add(signPost, board); scene.add(sign);

    const finish = new T.Group();
    const archPostGeo = keep(new T.BoxGeometry(0.3, 3.4, 0.3));
    const archMat = lam(0x3a6f8f);
    const pL = new T.Mesh(archPostGeo, archMat), pR = new T.Mesh(archPostGeo, archMat);
    pL.position.set(-2.5, 1.7, 0); pR.position.set(2.5, 1.7, 0);
    const bannerTex = pixTex(64, 16, g => {
      for (let x = 0; x < 64; x += 4) { g.fillStyle = (x / 4) % 2 ? '#f6e7c8' : '#1d1d1d'; g.fillRect(x, 0, 4, 2); g.fillRect(x + 2 * ((x / 4) % 2 ? 1 : -1), 14, 4, 2); }
      g.fillStyle = '#d94c3d'; g.fillRect(0, 2, 64, 12);
      g.fillStyle = '#f5d442'; g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top'; g.textAlign = 'center'; g.fillText('ZIEL', 33, 4);
    });
    const banner = new T.Mesh(keep(new T.PlaneGeometry(5.3, 1.1)), keep(new T.MeshBasicMaterial({ map: bannerTex })));
    banner.position.set(0, 3.0, 0);
    finish.add(pL, pR, banner); scene.add(finish);
    finish.position.set(0, hill(D), -D);
    const friendTex = {
      magnus: [charTex('magnus', 'idle', false), charTex('magnus', 'jump', false)],
      laurenz: [charTex('laurenz', 'idle', true), charTex('laurenz', 'jump', true)]
    };
    const magnus = makeSprite(friendTex.magnus[0], 1.2, 1.6);
    const laurenz = makeSprite(friendTex.laurenz[0], 1.2, 1.6);
    magnus.position.set(-1.9, hill(D + 0.6), -D - 0.6); laurenz.position.set(1.9, hill(D + 0.6), -D - 0.6);

    /* falling leaves (one draw call) */
    const LEAFN = 60;
    const lp = new Float32Array(LEAFN * 3), lc = new Float32Array(LEAFN * 3);
    const leafGeo = keep(new T.BufferGeometry());
    leafGeo.setAttribute('position', new T.BufferAttribute(lp, 3));
    leafGeo.setAttribute('color', new T.BufferAttribute(lc, 3));
    for (let i = 0; i < LEAFN; i++) { tmpC.setHex(LEAF_COLS[i % 4]); lc[i * 3] = tmpC.r; lc[i * 3 + 1] = tmpC.g; lc[i * 3 + 2] = tmpC.b; }
    const leafPts = new T.Points(leafGeo, keep(new T.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true })));
    leafPts.frustumCulled = false; scene.add(leafPts);
    const leafD = [];

    /* Eva + runner sprites */
    const eva = makeSprite(evaTex.run1, 0.85, 1.13);
    const runnerSprites = [0, 1, 2].map(i => { const sp = makeSprite(runnerTex[i].run1, 0.85, 1.13); sp.visible = false; return sp; });

    /* ---------- game state ---------- */
    let s = 0, lane = 0, ex = 0, jy = 0, vy = 0, grounded = true;
    let state = 'count', stateT = 0, time = 0;
    let speedMul = 1, stumbleT = 0, invulnT = 0, animT = 0;
    let crashTimes = [], cupsN = 0, lastKmShown = 0;
    let msg = '', msgT = 0, msgCol = '#f6e7c8';
    let camY = hill(0) + 2.4, shake = 0, won = false;
    let trees = [], decos = [], obs = [], items = [];
    let nextTreeS = 0, nextObsS = 0;

    function rnd() { return Math.random(); }
    function addTree(at) {
      const side = rnd() < 0.5 ? -1 : 1;
      trees.push({ s: at, x: side * (2.9 + rnd() * 9), h: 1.8 + rnd() * 2.4, r: 0.6 + rnd() * 0.6, rot: rnd() * 6, c: LEAF_COLS[(rnd() * LEAF_COLS.length) | 0] });
      if (rnd() < 0.35) decos.push({ s: at + rnd() * 3, x: (rnd() < 0.5 ? -1 : 1) * (2.3 + rnd() * 1.2) });
    }
    function spawnPattern(at) {
      const p = clamp(at / D, 0, 1);
      const L = () => ((rnd() * 3) | 0) - 1;
      const runnerActive = obs.some(o => o.type === 'runner' && !o.done);
      const opts = ['rock', 'root', 'rock', 'root', 'cups'];
      if (p > 0.08) opts.push('log', 'tree');
      if (p > 0.18 && !runnerActive) opts.push('runner');
      if (p > 0.35) opts.push('double', 'log', 'tree');
      const pick = opts[(rnd() * opts.length) | 0];
      const free = L();
      if (pick === 'rock') obs.push({ type: 'rock', s: at, lane: L(), h: 0.5 });
      else if (pick === 'root') obs.push({ type: 'root', s: at, lane: L(), h: 0.32 });
      else if (pick === 'log') {
        obs.push({ type: 'log', s: at, lane: 9, h: 0.55 });
        items.push({ type: 'gel', s: at, lane: free, y: 1.25 });
      } else if (pick === 'tree') {
        const l = L();
        obs.push({ type: 'tree', s: at, lane: l, h: 99, r: 0.55 + rnd() * 0.2, c: LEAF_COLS[(rnd() * 4) | 0] });
        for (let k = 0; k < 3; k++) items.push({ type: 'cup', s: at - 2 + k * 2, lane: l === 0 ? (rnd() < 0.5 ? -1 : 1) : 0, y: 0.5 });
      } else if (pick === 'runner') {
        obs.push({ type: 'runner', s: at + 8, lane: L(), h: 99, v: 5 + rnd() * 2, tex: (rnd() * 3) | 0, ph: rnd() * 3 });
      } else if (pick === 'double') {
        for (let l = -1; l <= 1; l++) if (l !== free) obs.push({ type: rnd() < 0.5 ? 'rock' : 'root', s: at, lane: l, h: 0.5 });
        items.push({ type: 'cup', s: at, lane: free, y: 0.5 });
      } else {
        const l = L();
        for (let k = 0; k < 4; k++) items.push({ type: 'cup', s: at + k * 2, lane: l, y: 0.5 });
      }
      if (pick === 'rock' || pick === 'root') {
        const o = obs[obs.length - 1];
        items.push({ type: rnd() < 0.3 ? 'gel' : 'cup', s: at, lane: o.lane, y: 1.3 });
      }
    }
    function resetWorld(at) {
      s = at; trees = []; decos = []; obs = []; items = [];
      nextTreeS = at - SCENE_BACK;
      while (nextTreeS < at + SCENE_AHEAD) { addTree(nextTreeS); nextTreeS += 1.1 + rnd() * 1.4; }
      nextObsS = at + 32;
      placeTrees(trees);
      chunks.forEach(c => c.idx = -999);
      lane = 0; ex = 0; jy = 0; vy = 0; grounded = true;
      camY = hill(at) + 2.4;
      for (let i = 0; i < LEAFN; i++) { leafD[i] = { s: at + rnd() * 40, x: (rnd() - 0.5) * 12, y: rnd() * 5, ph: rnd() * 6 }; }
    }
    resetWorld(0);

    function showMsg(t, ms, col) { msg = t; msgT = (ms || 1400) / 1000; msgCol = col || '#f6e7c8'; }

    /* ---------- input ---------- */
    function moveLane(d) {
      if (state !== 'run' && state !== 'count') return;
      const nl = clamp(lane + d, -1, 1);
      if (nl !== lane) { lane = nl; api.sfx('click'); }
    }
    function jump() {
      if (state !== 'run') return;
      if (grounded) { vy = JUMP_V; grounded = false; api.sfx('jump'); }
    }
    const btn = () => ({ x: W / 2 - 30, y: H - 34, w: 60, h: 26 });
    let pd = null;
    function hudPt(e) { const r = hud.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height, cx: e.clientX, cy: e.clientY }; }
    function onDown(e) {
      e.preventDefault();
      const p = hudPt(e), b = btn();
      if (p.x >= b.x - 4 && p.x <= b.x + b.w + 4 && p.y >= b.y - 6 && p.y <= b.y + b.h + 4) { jump(); pd = null; return; }
      pd = { id: e.pointerId, x: p.cx, y: p.cy, px: p.x, done: false };
    }
    function onMove(e) {
      if (!pd || pd.done || e.pointerId !== pd.id) return;
      const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) {
        pd.done = true;
        if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < 0) jump();
      }
    }
    function onUp(e) {
      if (!pd || e.pointerId !== pd.id) return;
      if (!pd.done) moveLane(pd.px < W / 2 ? -1 : 1);
      pd = null;
    }
    function onKey(e) {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { moveLane(-1); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { moveLane(1); e.preventDefault(); }
      else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (!e.repeat) jump(); e.preventDefault(); }
    }
    hud.addEventListener('pointerdown', onDown);
    hud.addEventListener('pointermove', onMove);
    hud.addEventListener('pointerup', onUp);
    hud.addEventListener('pointercancel', onUp);
    const noCtx = e => e.preventDefault();
    hud.addEventListener('contextmenu', noCtx);
    window.addEventListener('keydown', onKey);

    /* ---------- update ---------- */
    function crash(o) {
      o.hit = true;
      api.sfx('hit');
      speedMul = 0.3; stumbleT = 0.6; invulnT = 1.4; shake = 0.35;
      crashTimes = crashTimes.filter(t => time - t < 15); crashTimes.push(time);
      if (crashTimes.length >= 3) {
        const km = Math.floor(s / KM);
        state = 'setback'; stateT = 1.6;
        api.sfx('lose');
        showMsg(km ? 'Zurück zu KM ' + km : 'Nochmal von vorn!', 1600, '#f2b33d');
      } else showMsg(crashTimes.length === 2 ? 'Vorsicht!' : 'Autsch!', 700, '#f2a7b8');
    }

    function update(dt) {
      time += dt; animT += dt;
      if (msgT > 0) msgT -= dt;
      if (state === 'count') {
        stateT += dt;
        if (stateT >= 2.4) { state = 'run'; showMsg('LOS!', 700, '#f5d442'); api.sfx('ding'); }
      } else if (state === 'setback') {
        stateT -= dt;
        if (stateT <= 0) { resetWorld(Math.floor(s / KM) * KM); crashTimes = []; speedMul = 1; invulnT = 1; state = 'count'; stateT = 0.6; }
      }
      const running = state === 'run' || state === 'finish';
      let v = 0;
      if (running) {
        if (state === 'run') speedMul = Math.min(1, speedMul + dt * 0.5);
        const base = 13 + 4.5 * clamp(s / D, 0, 1);
        v = base * speedMul;
        if (state === 'finish') { stateT += dt; v = Math.max(0, 9 - stateT * 7); }
        s += v * dt;
      }
      stumbleT = Math.max(0, stumbleT - dt); invulnT = Math.max(0, invulnT - dt); shake = Math.max(0, shake - dt);
      ex += (lane * LANE - ex) * Math.min(1, dt * 14);
      if (!grounded) { vy -= GRAV * dt; jy += vy * dt; if (jy <= 0) { jy = 0; vy = 0; grounded = true; } }

      /* km signs */
      const kmNow = Math.floor(s / KM);
      if (state === 'run' && kmNow > lastKmShown && kmNow < 5) { lastKmShown = kmNow; api.sfx('ding'); showMsg(kmNow + ' km geschafft!', 1200, '#f5d442'); }
      if (state === 'run' && s >= D) {
        state = 'finish'; stateT = 0; showMsg('ZIEL!', 3000, '#f5d442'); api.sfx('coin');
        setTimeout(() => { if (!won && alive) { won = true; api.win(); } }, 1700);
      }

      /* spawn */
      while (nextTreeS < s + SCENE_AHEAD) { addTree(nextTreeS); nextTreeS += 1.1 + rnd() * 1.4; }
      if (trees.length && trees[0].s < s - SCENE_BACK) { trees = trees.filter(t => t.s >= s - SCENE_BACK); }
      decos = decos.filter(d => d.s >= s - SCENE_BACK);
      while (nextObsS < s + 62 && nextObsS < D - 25) { spawnPattern(nextObsS); nextObsS += 11 + (1 - s / D) * 6 + rnd() * 4; }

      /* obstacles & items */
      for (const o of obs) {
        if (o.type === 'runner') o.s += o.v * dt * (running ? 1 : 0);
        const ox = o.lane === 9 ? ex : o.lane * LANE;
        const dz = Math.abs(o.s - s);
        if (!o.hit && state === 'run' && invulnT <= 0 && dz < (o.type === 'log' ? 0.45 : 0.5) && Math.abs(ox - ex) < 0.75 && jy < o.h) crash(o);
        if (o.s < s - 6) o.done = true;
      }
      obs = obs.filter(o => !o.done || o.s > s - 6);
      for (const it of items) {
        if (!it.got && Math.abs(it.s - s) < 0.6 && Math.abs(it.lane * LANE - ex) < 0.7 && Math.abs((it.y - 0.5) - jy) < 0.75) {
          it.got = true; cupsN++; api.sfx('coin');
        }
      }
      items = items.filter(it => !it.got && it.s > s - 4);

      /* leaves */
      for (let i = 0; i < LEAFN; i++) {
        const L = leafD[i];
        L.y -= dt * 0.8; L.ph += dt * 2;
        if (L.y < -0.2 || L.s < s - 4) { L.s = s + 4 + rnd() * 40; L.x = (rnd() - 0.5) * 12; L.y = 3 + rnd() * 3; }
        lp[i * 3] = L.x + Math.sin(L.ph) * 0.4; lp[i * 3 + 1] = hill(L.s) + L.y; lp[i * 3 + 2] = -L.s;
      }
      leafGeo.attributes.position.needsUpdate = true;
    }

    /* ---------- render ---------- */
    let lastTreeHead = -1, lastTreeLen = -1;
    function render() {
      /* ground chunks */
      const first = Math.floor((s - SCENE_BACK) / CHUNK_LEN);
      const want = new Set(); for (let i = 0; i < CHUNKS; i++) want.add(first + i);
      const free = chunks.filter(c => !want.has(c.idx));
      const have = new Set(chunks.map(c => c.idx));
      for (const idx of want) if (!have.has(idx)) { const c = free.pop(); if (c) buildChunk(c, idx); }

      if (trees.length !== lastTreeLen || (trees[0] && trees[0].s !== lastTreeHead)) {
        placeTrees(trees); lastTreeLen = trees.length; lastTreeHead = trees[0] ? trees[0].s : -1;
      }
      let n = 0;
      for (const d of decos) {
        if (n >= 40) break;
        const y = hill(d.s) + 0.04;
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(d.x, y, -d.s); dummy.updateMatrix();
        stems.setMatrixAt(n, dummy.matrix); caps.setMatrixAt(n, dummy.matrix); n++;
      }
      stems.count = caps.count = n; stems.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;

      /* obstacles */
      let nr = 0, nroot = 0, nl = 0, ri = 0;
      const tExtra = [];
      runnerSprites.forEach(sp => sp.visible = false);
      for (const o of obs) {
        const x = o.lane * LANE, y = hill(o.s);
        const tilt = o.hit ? 0.5 : 0;
        if (o.type === 'rock' && nr < 20) {
          dummy.position.set(x, y + 0.12, -o.s); dummy.rotation.set(o.s, o.s * 2, tilt); dummy.scale.set(1, 0.85, 1); dummy.updateMatrix(); rocks.setMatrixAt(nr++, dummy.matrix);
        } else if (o.type === 'root' && nroot < 20) {
          dummy.position.set(x, y - 0.12, -o.s); dummy.rotation.set(0, 0, 0); dummy.scale.set(1.3, 1, 1.3); dummy.updateMatrix(); roots.setMatrixAt(nroot++, dummy.matrix);
        } else if (o.type === 'log' && nl < 10) {
          dummy.position.set(0, y + 0.26, -o.s); dummy.rotation.set(o.hit ? 0.3 : 0, 0.05, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); logs.setMatrixAt(nl++, dummy.matrix);
        } else if (o.type === 'tree') {
          tExtra.push({ s: o.s, x, h: 2.8, r: o.r, rot: 0, c: o.c, dy: -(Math.abs(x) - 2.1) * 0.16 });
        } else if (o.type === 'runner' && ri < 3) {
          const sp = runnerSprites[ri++]; sp.visible = true;
          const fr = Math.floor(animT * 7 + o.ph) % 2 ? 'run1' : 'run2';
          sp.material.map = runnerTex[o.tex][fr];
          sp.position.set(x, y + Math.abs(Math.sin(animT * 11 + o.ph)) * 0.06, -o.s);
          sp.material.rotation = o.hit ? 0.3 : 0;
        }
      }
      if (tExtra.length) placeTrees(trees.concat(tExtra)), lastTreeLen = -1;
      rocks.count = nr; roots.count = nroot; logs.count = nl;
      rocks.instanceMatrix.needsUpdate = roots.instanceMatrix.needsUpdate = logs.instanceMatrix.needsUpdate = true;

      let nc = 0, ng = 0;
      for (const it of items) {
        const y = hill(it.s) + it.y + Math.sin(animT * 4 + it.s) * 0.06;
        dummy.position.set(it.lane * LANE, y, -it.s); dummy.rotation.set(0, animT * 3 + it.s, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        if (it.type === 'cup' && nc < 40) cups.setMatrixAt(nc++, dummy.matrix);
        else if (it.type === 'gel' && ng < 20) gels.setMatrixAt(ng++, dummy.matrix);
      }
      cups.count = nc; gels.count = ng; cups.instanceMatrix.needsUpdate = gels.instanceMatrix.needsUpdate = true;

      /* km sign */
      const nextKm = Math.floor((s - 6) / KM) + 1;
      if (nextKm >= 1 && nextKm <= 4) {
        sign.visible = true; boardMat.map = kmTex[nextKm - 1];
        sign.position.set(2.5, hill(nextKm * KM) + 0.05, -nextKm * KM);
      } else sign.visible = false;

      /* friends cheering */
      const fj = Math.floor(animT * 4) % 2;
      magnus.material.map = friendTex.magnus[fj]; laurenz.material.map = friendTex.laurenz[1 - fj];
      magnus.position.y = hill(D + 0.6) + (fj ? 0.25 : 0); laurenz.position.y = hill(D + 0.6) + (fj ? 0 : 0.25);

      /* Eva */
      const gy = hill(s);
      let fr = 'run1';
      if (!grounded) fr = 'jump';
      else if (state === 'run' || (state === 'finish' && stateT < 1.2)) fr = Math.floor(animT * 8) % 2 ? 'run1' : 'run2';
      eva.material.map = evaTex[fr];
      eva.material.rotation = stumbleT > 0 ? Math.sin(stumbleT * 18) * 0.35 : (ex - lane * LANE) * 0.25;
      eva.material.opacity = 1;
      eva.visible = !(invulnT > 0 && stumbleT <= 0 && Math.floor(time * 12) % 2);
      eva.position.set(ex, gy + jy + (grounded && state === 'run' ? Math.abs(Math.sin(animT * 12.5)) * 0.05 : 0), -s);
      shadow.position.set(ex, gy + 0.03, -s);
      shadow.scale.setScalar(1 - Math.min(0.5, jy * 0.35));

      /* camera */
      const ty = Math.max(hill(s - 5.6), gy) + 2.3;
      camY += (ty - camY) * 0.12;
      const sh = shake > 0 ? (Math.random() - 0.5) * shake * 0.4 : 0;
      camera.position.set(ex * 0.55 + sh, camY + sh, -(s - 5.6));
      camera.lookAt(ex * 0.75, hill(s + 6) + 1.0, -(s + 6));

      renderer.render(scene, camera);
      drawHud();
    }

    /* ---------- HUD ---------- */
    function drawHud() {
      const g = hctx;
      g.clearRect(0, 0, W, H);
      const p = clamp(s / D, 0, 1);
      // progress bar
      g.fillStyle = 'rgba(13,21,17,.75)'; g.fillRect(4, 4, W - 8, 9);
      g.fillStyle = '#3b2416'; g.fillRect(6, 6, W - 12, 5);
      g.fillStyle = '#f2b33d'; g.fillRect(6, 6, Math.round((W - 12) * p), 5);
      for (let k = 1; k < 5; k++) { g.fillStyle = '#f6e7c8'; g.fillRect(6 + Math.round((W - 12) * k / 5), 5, 1, 7); }
      g.fillStyle = '#d94c3d'; g.fillRect(W - 8, 2, 2, 12); g.fillRect(W - 12, 2, 4, 4);
      const mx = 6 + Math.round((W - 12) * p);
      g.fillStyle = '#2f5d4a'; g.fillRect(mx - 2, 12, 4, 4); g.fillStyle = '#4a2c1d'; g.fillRect(mx - 2, 11, 4, 2);
      // km + cups
      const kmTxt = (Math.min(5, s / KM)).toFixed(1).replace('.', ',') + '/5 KM';
      api.text(g, kmTxt, 5, 18, 8, '#f6e7c8', 'left');
      api.text(g, '' + cupsN, W - 5, 18, 8, '#8fd3e8', 'right');
      const cw = String(cupsN).length * 8;
      g.fillStyle = '#f2f2f2'; g.fillRect(W - 15 - cw, 18, 7, 2); g.fillRect(W - 14 - cw, 20, 5, 6);
      g.fillStyle = '#4a7fd9'; g.fillRect(W - 14 - cw, 21, 5, 2);
      // stumble pips
      const recent = crashTimes.filter(t => time - t < 15).length;
      for (let i = 0; i < 3; i++) { g.fillStyle = i < recent ? '#d94c3d' : 'rgba(246,231,200,.35)'; g.fillRect(5 + i * 7, 29, 5, 5); }
      // message
      if (state === 'count') {
        const n = 3 - Math.floor(stateT / 0.8);
        api.text(g, n > 0 ? String(n) : 'LOS!', W / 2, H * 0.32, 16, '#f5d442', 'center');
      } else if (msgT > 0 && msg) {
        const parts = msg.length > 14 ? msg.split(' ').reduce((a, w) => { const l = a[a.length - 1]; if (l && (l + ' ' + w).length <= 14) a[a.length - 1] = l + ' ' + w; else a.push(w); return a; }, []) : [msg];
        parts.forEach((t, i) => api.text(g, t, W / 2, H * 0.3 + i * 12, 8, msgCol, 'center'));
      }
      // jump button
      if (state !== 'finish') {
        const b = btn();
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(b.x, b.y + 2, b.w, b.h);
        g.fillStyle = grounded ? '#d9822b' : '#7a4a2a'; g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = '#f2b33d'; g.fillRect(b.x, b.y, b.w, 2);
        api.text(g, 'SPRING', W / 2, b.y + 9, 8, '#1d1d1d', 'center', false);
        g.fillStyle = 'rgba(246,231,200,.45)';
        const ay = b.y + 13;
        for (let i = 0; i < 5; i++) { g.fillRect(10 + i, ay - i, 1, i * 2 + 1); g.fillRect(W - 11 - i, ay - i, 1, i * 2 + 1); }
      }
    }

    const stop = api.loop(dt => { update(dt); render(); });

    return function cleanup() {
      alive = false;
      stop();
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      hud.removeEventListener('pointerdown', onDown);
      hud.removeEventListener('pointermove', onMove);
      hud.removeEventListener('pointerup', onUp);
      hud.removeEventListener('pointercancel', onUp);
      hud.removeEventListener('contextmenu', noCtx);
      [trunks, leaves, stems, caps, rocks, roots, logs, cups, gels].forEach(m => m.dispose && m.dispose());
      disposables.forEach(d => { try { d.dispose(); } catch (e) {} });
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      glCanvas.remove(); hud.remove();
    };
  }
})();

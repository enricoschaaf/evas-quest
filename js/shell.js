/* Shell: title → captcha → notifications → world map ⇄ levels (+ ads) → finale. */
(function () {
  'use strict';
  const C = window.CONTENT, E = window.Engine, A = E.Audio;
  const stage = document.getElementById('stage');
  const overlay = document.getElementById('overlay');
  const hudTitle = document.getElementById('hudTitle');
  const hudProgress = document.getElementById('hudProgress');
  const LEVELS = C.levels;

  /* ---------- state (persisted so a reload doesn't lose progress) ---------- */
  const KEY = 'eva-quest-v1';
  let S = { phase: 'title', done: 0 };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const params = new URLSearchParams(location.search);
  if (params.has('reset')) S = { phase: 'title', done: 0 };
  if (params.has('level')) { S.done = Math.max(0, Math.min(LEVELS.length, +params.get('level') - 1)); S.phase = 'map'; }
  if (params.has('finale')) { S.done = LEVELS.length; S.phase = 'finale'; }
  if (params.has('ad')) S.phase = 'ad:' + params.get('ad');
  // ?nosave: preview pages (e.g. the finale in the chooser) must not overwrite the real progress
  function save() { if (params.has('nosave')) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- HUD / mute ---------- */
  const muteBtn = document.getElementById('muteBtn');
  const updMute = () => { muteBtn.textContent = A.isMuted() ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', e => { e.stopPropagation(); A.toggleMute(); updMute(); });
  updMute();
  function hud(title) {
    hudTitle.textContent = title;
    hudProgress.textContent = '★'.repeat(S.done) + '☆'.repeat(LEVELS.length - S.done);
  }

  let cleanup = null;
  function clearStage() {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    stage.innerHTML = ''; overlay.innerHTML = ''; overlay.className = '';
  }
  const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function imgExists(src) {
    return new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = src; });
  }

  /* =====================================================================
     TITLE
     ===================================================================== */
  function showTitle() {
    clearStage(); hud('Evas Quest');
    const resume = S.done > 0 || S.phase === 'map';
    const el = h(`
      <div class="screen title-screen">
        <div class="title-bg"></div>
        <div class="title-inner">
          <div class="title-logo px">EVAS<br>QUEST</div>
          <div class="title-sub">Ein Geburtstagsabenteuer in ${LEVELS.length} Welten</div>
          <div class="title-actions">
            <label class="name-row">Dein Name: <input id="playerName" maxlength="16" autocomplete="off" value=""></label>
            <button class="btn big" id="go">${resume ? 'WEITERSPIELEN ▶' : 'START ▶'}</button>
            ${resume ? '<button class="btn ghost small" id="restart">von vorne</button>' : ''}
          </div>
          <div class="title-hint">🔊 Mit Ton spielen!</div>
        </div>
      </div>`);
    stage.appendChild(el);
    imgExists('assets/gen/title.png').then(ok => { if (ok) el.querySelector('.title-bg').style.backgroundImage = 'url(assets/gen/title.png)'; });
    const nameIn = el.querySelector('#playerName');
    nameIn.value = playerName();
    nameIn.onchange = () => setPlayerName(nameIn.value);
    el.querySelector('#go').onclick = () => {
      setPlayerName(nameIn.value);
      A.unlock(); A.sfx('coin'); A.music('map');
      if (resume && S.phase !== 'title') go(S.phase === 'finale' ? 'finale' : S.phase.startsWith('ad:') ? S.phase : (S.phase === 'notify' || S.phase === 'captcha') ? S.phase : 'map');
      else go('captcha');
    };
    const r = el.querySelector('#restart');
    if (r) r.onclick = () => { setPlayerName(nameIn.value); S = { phase: 'title', done: 0 }; save(); A.unlock(); A.music('map'); go('captcha'); };
  }

  /* =====================================================================
     CAPTCHA
     ===================================================================== */
  // Square crops of the forest photo (1500x2000). eva:true = correct answer.
  const PHOTO = 'assets/photos/wald.jpg', PW = 1500, PH = 2000;
  const CROPS = [
    { x: 990, y: 570, s: 190, eva: true },   // Eva face
    { x: 940, y: 660, s: 340, eva: true },   // Eva jacket
    { x: 560, y: 520, s: 170 },              // Magnus face
    { x: 700, y: 630, s: 160 },              // Laurenz face
    { x: 120, y: 60, s: 360 },               // leaves
    { x: 1150, y: 1330, s: 330 },            // log
    { x: 300, y: 1620, s: 360 },             // forest floor
    { x: 0, y: 0, s: 300 },                  // trunk
    { x: 1180, y: 120, s: 300 }              // bushes
  ];
  function cropStyle(c) {
    return `background-image:url(${PHOTO});background-size:${PW / c.s * 100}% auto;` +
      `background-position:${c.x / (PW - c.s) * 100}% ${c.y / (PH - c.s) * 100}%`;
  }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

  async function showCaptcha() {
    clearStage(); hud('Sicherheitscheck');
    A.music('map');
    const hasPortrait = await imgExists('assets/gen/eva_portrait.png');
    const el = h(`
      <div class="screen captcha-screen">
        <p class="captcha-pre">Bevor es losgeht: Wir müssen sicherstellen, dass du wirklich <b>${C.birthdayName}</b> bist.</p>
        <div class="cap-box" id="capBox">
          <button class="cap-check" id="capCheck" aria-label="Ich bin kein Roboter"><span></span></button>
          <span class="cap-label">Ich bin kein Roboter</span>
          <div class="cap-logo"><div class="cap-logo-icon">♻</div><div>evaCAPTCHA</div><small>Datenschutz · Kuchen</small></div>
        </div>
      </div>`);
    stage.appendChild(el);
    const chk = el.querySelector('#capCheck');
    let dodged = 0;
    chk.onclick = async () => {
      // The checkbox dodges once – it's a robot test after all.
      if (dodged < 1) {
        dodged++; A.sfx('error');
        el.querySelector('#capBox').classList.add('dodge');
        E.toast('Zu schnell! Roboter-Verdacht 🤖', 1500);
        return;
      }
      A.sfx('click');
      chk.classList.add('loading');
      await wait(1300);
      chk.classList.remove('loading');
      runChallenges(el, hasPortrait);
    };
  }

  function runChallenges(el, hasPortrait) {
    const rounds = [
      { q: `Wähle alle Bilder mit <b>${C.birthdayName}</b>.`, sub: 'Klicke auf „Bestätigen“, wenn keine mehr vorhanden sind.' },
      { q: 'Hmm, verdächtig gut. Noch einmal: Wähle alle Bilder mit <b>jemandem, der heute Geburtstag hat</b>.', sub: 'Letzte Chance, Roboter.' }
    ];
    let round = 0;
    const pop = h(`<div class="cap-pop"></div>`);
    overlay.className = 'dim'; overlay.appendChild(pop);

    function render() {
      let tiles = CROPS.map(c => ({ style: cropStyle(c), eva: !!c.eva }));
      if (hasPortrait) tiles[8] = { style: 'background-image:url(assets/gen/eva_portrait.png);background-size:cover;image-rendering:pixelated', eva: true };
      tiles = shuffle(tiles);
      pop.innerHTML = `
        <div class="cap-head">${rounds[round].q}<small>${rounds[round].sub}</small></div>
        <div class="cap-grid">${tiles.map((t, i) => `<button class="cap-tile" data-i="${i}" style="${t.style}"></button>`).join('')}</div>
        <div class="cap-foot"><span class="cap-icons">⟳ 🎧 ⓘ</span><button class="cap-ok" id="capOk">BESTÄTIGEN</button></div>`;
      pop.querySelectorAll('.cap-tile').forEach(b => b.onclick = () => { A.sfx('click'); b.classList.toggle('sel'); });
      pop.querySelector('#capOk').onclick = () => {
        const sel = [...pop.querySelectorAll('.cap-tile')].map(b => b.classList.contains('sel'));
        const ok = tiles.every((t, i) => t.eva === sel[i]);
        if (!ok) {
          A.sfx('error'); pop.classList.remove('shake'); void pop.offsetWidth; pop.classList.add('shake');
          E.toast('Bitte versuche es erneut.', 1500);
          return;
        }
        round++;
        if (round < rounds.length) { A.sfx('coin'); render(); return; }
        A.sfx('ding');
        overlay.innerHTML = ''; overlay.className = '';
        const chk = el.querySelector('#capCheck'); chk.classList.add('done');
        el.querySelector('.cap-label').textContent = 'Du bist Eva. Willkommen!';
        setTimeout(() => go('notify'), 1400);
      };
    }
    render();
  }

  /* =====================================================================
     NOTIFICATIONS (asked, not really used)
     ===================================================================== */
  function showNotify() {
    clearStage(); hud('Fast geschafft…');
    stage.appendChild(h(`<div class="screen notify-screen"><div class="notify-bg-text px">Lade Abenteuer…</div></div>`));
    const pop = h(`
      <div class="perm">
        <div class="perm-site">🔒 evas-quest.de möchte</div>
        <div class="perm-row">🔔 Benachrichtigungen anzeigen</div>
        <div class="perm-small">z. B. tägliche Pilz-Fakten, Erinnerungen ans Trinken und Updates zu Laurenz' Lachanfällen.</div>
        <div class="perm-btns"><button class="btn ghost small" id="block">Blockieren</button><button class="btn small" id="allow">Zulassen</button></div>
      </div>`);
    overlay.className = 'dim'; overlay.appendChild(pop);
    A.sfx('ding');
    const done = msg => { overlay.innerHTML = ''; overlay.className = ''; E.toast(msg, 2600); setTimeout(() => go('map'), 1600); };
    // The real browser prompt comes either way – whatever she clicks (wanted by the friends)
    const askReal = () => { try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch (e) {} };
    pop.querySelector('#allow').onclick = () => { A.sfx('coin'); askReal(); done('Super! Ab jetzt täglich Pilz-Fakten 🍄 (Spaß)'); };
    pop.querySelector('#block').onclick = () => { A.sfx('error'); askReal(); done('Schade. Wir fragen trotzdem nochmal. 😄'); };
  }

  /* =====================================================================
     WORLD MAP
     ===================================================================== */
  const MW = 180, MH = 320;
  const NODES = [[88, 306], [40, 270], [134, 236], [48, 200], [136, 164], [50, 126], [134, 86], [90, 36]]; // start, L1..L6, finale
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  }
  // segs[i] = sampled points from NODES[i] to NODES[i+1]
  const SEGS = [];
  for (let i = 0; i < NODES.length - 1; i++) {
    const p0 = NODES[Math.max(0, i - 1)], p1 = NODES[i], p2 = NODES[i + 1], p3 = NODES[Math.min(NODES.length - 1, i + 2)];
    const pts = []; for (let s = 0; s <= 40; s++) pts.push(catmull(p0, p1, p2, p3, s / 40));
    SEGS.push(pts);
  }
  const ICONS = {
    bottle: [['...KK...', '...WW...', '..WWWW..', '.WRRRRW.', '.WRRRRW.', '.WBBBBW.', '.WBBBBW.', '..WWWW..'], { K: '#7a4a2a', W: '#cfe8f0', R: '#d94c3d', B: '#4a7fd9' }],
    nowifi: [['..YYYY..', '.Y....Y.', 'Y..YY..Y', '..Y..Y..', '...YY...', '...YY...', '........', '...YY...'], { Y: '#f6e7c8' }],
    balloon: [['..RRR...', '.RRRRR..', '.RRWRR..', '.RRRRR..', '..RRR...', '...R....', '....K...', '...K....'], { R: '#d94c3d', W: '#fff', K: '#f6e7c8' }],
    sling: [['K.....K.', 'K.....K.', '.K...K..', '..K.K...', '...K....', '...K....', '...K....', '..KKK...'], { K: '#7a4a2a' }],
    mountain: [['...W....', '..WWW...', '..GWG...', '.GGGGG..', '.GGGGGG.', 'GGGGGGGG', 'GGGGGGGG', '........'], { W: '#ffffff', G: '#8a8f86' }],
    cake: [['..Y..Y..', '..R..R..', '.PPPPPP.', '.WWWWWW.', '.PPPPPP.', '.WWWWWW.', 'KKKKKKKK', '........'], { Y: '#f5d442', R: '#d94c3d', P: '#f2a7b8', W: '#f6e7c8', K: '#7a4a2a' }],
    disco: [['...K....', '..WSWS..', '.SWSWSW.', '.WSWSWS.', '.SWSWSW.', '..WSWS..', '........', '........'], { K: '#9a96b0', W: '#ffffff', S: '#8fd3e8' }],
    shoe: [['........', '........', '.KK.....', '.KKK....', '.KKKKK..', 'KKKKKKKK', 'WWWWWWWW', '........'], { K: '#3fe07a', W: '#ffffff' }],
    plane: [['...W....', '...WW...', 'W..WWW..', 'WWWWWWWW', 'W..WWW..', '...WW...', '...W....', '........'], { W: '#e8eef5' }],
    flag: [['.RRRR...', '.RRRRRR.', '.RRRR...', '.K......', '.K......', '.K......', '.K......', 'KKK.....'], { R: '#d94c3d', K: '#5b3a24' }]
  };
  let mapBgCache = null;
  function mapBackground() {
    if (mapBgCache) return mapBgCache;
    const c = document.createElement('canvas'); c.width = MW; c.height = MH; const g = c.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // grass gradient by height (valley → mountain)
    for (let y = 0; y < MH; y++) {
      const t = y / MH;
      g.fillStyle = t < 0.18 ? '#6d7a6a' : t < 0.3 ? '#4f6a45' : t < 0.6 ? '#3e7a3a' : '#4a8a3f';
      g.fillRect(0, y, MW, 1);
    }
    // snow cap top
    g.fillStyle = '#dfe9ea'; for (let x = 0; x < MW; x++) { const hh = 10 + Math.sin(x * 0.09) * 5 + Math.sin(x * 0.31) * 2; g.fillRect(x, 0, 1, hh); }
    // grass speckles
    for (let i = 0; i < 900; i++) { g.fillStyle = rnd() < 0.5 ? '#5c9a46' : '#356a33'; g.fillRect(rnd() * MW | 0, 40 + rnd() * (MH - 40) | 0, 1, 1); }
    // river
    g.fillStyle = '#3a6f8f';
    for (let y = 185; y < MH; y++) { const x = 160 + Math.sin(y * 0.05) * 8; g.fillRect(x | 0, y, 6, 1); g.fillStyle = (y % 7 === 0) ? '#8fd3e8' : '#3a6f8f'; }
    // path (dirt)
    SEGS.forEach(seg => seg.forEach(([x, y]) => { g.fillStyle = '#9a6a3a'; g.fillRect(x - 3 | 0, y - 2 | 0, 6, 5); }));
    SEGS.forEach(seg => seg.forEach(([x, y], i) => { if (i % 3 === 0) { g.fillStyle = '#b8864f'; g.fillRect(x - 1 | 0, y | 0, 2, 1); } }));
    // trees (avoid path)
    const near = (x, y) => SEGS.some(s => s.some(([px, py]) => Math.abs(px - x) < 11 && Math.abs(py - y) < 13));
    const trees = [];
    for (let i = 0; i < 140; i++) {
      const x = rnd() * MW | 0, y = 30 + rnd() * (MH - 30) | 0;
      if (near(x, y) || (x > 150 && y > 180)) continue;
      trees.push([x, y, y < 110 ? 'pine' : (rnd() < 0.5 ? 'autumn' : 'beech')]);
    }
    trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, k]) => {
      g.fillStyle = '#3b2416'; g.fillRect(x, y, 2, 4);
      if (k === 'pine') { g.fillStyle = '#24502a'; g.fillRect(x - 3, y - 2, 8, 3); g.fillRect(x - 2, y - 5, 6, 3); g.fillRect(x - 1, y - 8, 4, 3); }
      else {
        const col = k === 'autumn' ? ['#d9822b', '#f2b33d'] : ['#2f6a30', '#5c9a46'];
        g.fillStyle = col[0]; g.fillRect(x - 4, y - 7, 10, 7); g.fillRect(x - 3, y - 9, 8, 2);
        g.fillStyle = col[1]; g.fillRect(x - 2, y - 8, 3, 2);
      }
    });
    return (mapBgCache = c);
  }

  function showMap() {
    clearStage(); hud('Weltkarte');
    A.music('map');
    S.phase = 'map'; save();
    const cv = E.makeCanvas(stage, MW, MH);
    const g = cv.ctx;
    const allDone = S.done >= LEVELS.length;
    const btn = h(`<div class="map-ui"><div class="map-label px" id="mapLabel"></div><button class="btn" id="mapGo"></button></div>`);
    stage.appendChild(btn);
    const label = btn.querySelector('#mapLabel'), goBtn = btn.querySelector('#mapGo');
    const next = S.done; // index of next level (0-based), or LEVELS.length = finale
    label.textContent = allDone ? 'Ziel: Die Geburtstagslichtung' : `Welt ${next + 1}: ${LEVELS[next].world}`;
    goBtn.textContent = allDone ? 'ZUM ZIEL ▶' : 'LOS GEHT\'S ▶';

    let walking = null; // {pts, i}
    let pos = NODES[S.done].slice();
    let frameT = 0, bob = 0;

    function startWalk() {
      if (walking) return;
      A.sfx('click');
      goBtn.disabled = true;
      walking = { pts: SEGS[S.done], i: 0 };
    }
    goBtn.onclick = startWalk;
    const onTap = e => {
      const p = cv.pointer(e), n = NODES[S.done + 1];
      if (n && Math.hypot(p.x - n[0], p.y - n[1]) < 18) startWalk();
    };
    cv.canvas.addEventListener('pointerdown', onTap);

    const stop = E.loop((dt, t) => {
      frameT += dt; bob = t;
      if (walking) {
        walking.i += dt * 22;
        const k = Math.min(walking.pts.length - 1, walking.i | 0);
        pos = walking.pts[k];
        if ((walking.i * 10 | 0) % 25 === 0) A.sfx('step');
        if (k >= walking.pts.length - 1) {
          walking = null;
          if (allDone) go('finale'); else startLevel(next);
          return;
        }
      }
      g.drawImage(mapBackground(), 0, 0);
      // nodes
      for (let i = 1; i < NODES.length; i++) {
        const [x, y] = NODES[i];
        const isFinale = i === NODES.length - 1;
        const done = i <= S.done, isNext = i === S.done + 1;
        g.fillStyle = '#000'; g.fillRect(x - 9, y - 7, 18, 16);
        g.fillStyle = done ? '#6fae4f' : isNext ? '#f5c542' : '#5a5a5a'; g.fillRect(x - 8, y - 6, 16, 14);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 8, y + 5, 16, 3);
        const icon = isFinale ? ICONS.cake : ICONS[LEVELS[i - 1].icon];
        E.drawPixels(g, icon[0], icon[1], x - 8 + 4, y - 6 + 2 + (isNext ? Math.round(Math.sin(t * 5)) : 0), 1);
        if (done) E.drawPixels(g, ICONS.flag[0], ICONS.flag[1], x + 6, y - 14, 1);
        if (isNext && !walking) { // blinking arrow
          if ((t * 3 | 0) % 2 === 0) { g.fillStyle = '#fff'; g.fillRect(x - 2, y - 15, 5, 2); g.fillRect(x - 1, y - 13, 3, 2); g.fillRect(x, y - 11, 1, 1); }
        }
      }
      // Eva
      const fr = walking ? ((frameT * 8 | 0) % 2 ? 'run1' : 'run2') : 'idle';
      const flip = walking ? (walking.pts[Math.min(walking.pts.length - 1, (walking.i | 0) + 1)][0] < pos[0]) : false;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(pos[0] - 5 | 0, pos[1] + 5 | 0, 10, 2);
      E.drawChar(g, 'eva', fr, pos[0] - 6 | 0, pos[1] - 11 - (walking ? 0 : Math.round(Math.abs(Math.sin(bob * 2)))) | 0, 1, flip);
      // title banner
      E.text(g, 'EVAS WELT', MW / 2, 4, 8, '#1b1b1b', 'center', false);
    });
    cleanup = () => { stop(); cv.canvas.removeEventListener('pointerdown', onTap); cv.destroy(); };
  }

  /* =====================================================================
     LEVEL
     ===================================================================== */
  function startLevel(i) {
    const L = LEVELS[i], G = window.GAMES[L.id];
    clearStage();
    hud(`Welt ${i + 1}: ${L.world}`);
    const card = h(`
      <div class="screen card-screen">
        <div class="card">
          <div class="card-world px">WELT ${i + 1}</div>
          <div class="card-title px">${G ? G.title : L.world}</div>
          <p>${G ? G.intro : 'Dieses Level wird gerade noch gebaut… 🛠️'}</p>
          <button class="btn" id="play">${G ? 'SPIELEN ▶' : 'ÜBERSPRINGEN ▶'}</button>
          <button class="btn ghost small" id="back">◀ Karte</button>
        </div>
      </div>`);
    stage.appendChild(card);
    card.querySelector('#back').onclick = () => { A.sfx('click'); go('map'); };
    card.querySelector('#play').onclick = () => {
      A.sfx('click');
      if (!G) return levelWon(i);
      clearStage(); hud(`Welt ${i + 1}: ${G.title}`);
      const root = document.createElement('div'); root.className = 'game-root'; stage.appendChild(root);
      let finished = false;
      const t0 = performance.now();
      const api = E.makeApi(() => { if (!finished) { finished = true; levelWon(i, performance.now() - t0 - 900); } });
      devSkip = () => { if (!finished) { finished = true; levelWon(i); } };
      // Each world has its own music: a game asking for the generic 'game' track gets its world's track instead.
      const rawMusic = api.music; api.music = name => rawMusic(name === 'game' && L.music ? L.music : name);
      // Safety net: after 4 minutes in a world, a joker button lets her skip it.
      const joker = document.getElementById('jokerBtn');
      const jt = L.joker === false ? 0 : setTimeout(() => { joker.hidden = false; E.toast('Hängst du fest? Oben gibt\'s jetzt einen Joker ⏭', 3500); }, 4 * 60 * 1000);
      joker.onclick = () => { if (finished) return; if (confirm('Joker einsetzen und diese Welt überspringen?')) { finished = true; levelWon(i); } };
      let gameCleanup = null;
      const wrapCleanup = () => { clearTimeout(jt); joker.hidden = true; joker.onclick = null; if (gameCleanup) gameCleanup(); };
      try { gameCleanup = G.start(root, api) || null; cleanup = wrapCleanup; }
      catch (e) { cleanup = wrapCleanup; console.error(e); E.toast('Ups, Fehler im Level – wird übersprungen', 2500); setTimeout(() => levelWon(i), 1500); }
    };
  }

  function levelWon(i, ms) {
    clearStage();
    // run bookkeeping for the "whole quest" board: only clean runs (all worlds played, no skips) count
    if (i === 0) S.run = { ms: 0, n: 0, clean: true };
    S.run = S.run || { ms: 0, n: 0, clean: false };
    if (ms > 0) { S.run.ms += ms; S.run.n++; } else S.run.clean = false;
    S.done = Math.max(S.done, i + 1); save();
    hud('Geschafft!');
    const L = LEVELS[i];
    A.music('map');
    const msg = h(`<div class="screen card-screen"><div class="card win-card">
      <div class="card-title px">WELT ${i + 1}<br>GESCHAFFT!</div>
      <div class="stars px">${'★'.repeat(S.done)}${'☆'.repeat(LEVELS.length - S.done)}</div>
      ${ms > 0 ? `<div class="win-time">⏱ Deine Zeit: <b>${fmtTime(ms)}</b><br><span id="rankLine">Wird eingetragen…</span></div>` : ''}
      <button class="btn ghost small" id="showBoard">🏆 Bestenliste</button>
      <button class="btn" id="cont">WEITER ▶</button></div></div>`);
    stage.appendChild(msg);
    msg.querySelector('#showBoard').onclick = () => showBoard(L.id);
    if (ms > 0) submitScore(L.id, ms).then(r => {
      const el = msg.querySelector('#rankLine'); if (!el) return;
      el.textContent = r && r.rank ? `Platz ${r.rank} von ${r.board.length} 🏆` : 'Bestenliste gerade nicht erreichbar';
    });
    if (S.done >= LEVELS.length && S.run && S.run.clean && S.run.n === LEVELS.length) { submitScore('total', S.run.ms); S.run.clean = false; save(); }
    msg.querySelector('#cont').onclick = () => {
      A.sfx('click');
      // ad may be a number or an array (ad break with several spots in a row)
      const q = L.ad == null ? [] : [].concat(L.ad);
      S.adQueue = q.slice(1); save();
      if (q.length) go('ad:' + q[0]); else go('map');
    };
  }

  /* =====================================================================
     ADS — 5 s countdown; the skip button opens a new tab (as requested)
     ===================================================================== */
  function afterAd() {
    const q = S.adQueue || [];
    if (q.length) { const n = q.shift(); S.adQueue = q; save(); go('ad:' + n); } else go('map');
  }
  async function showAd(idx) {
    const ad = C.ads[idx] || C.ads[0];
    S.phase = 'ad:' + idx; save();
    clearStage(); hud('Werbung');
    A.music(null);
    const playable = ad.play && window.GAMES[ad.play];
    const hasImg = !playable && await imgExists(ad.img);
    const el = h(`
      <div class="screen ad-screen ${ad.kind}${playable ? ' playable' : ''}">
        <div class="ad-top"><span class="ad-badge">Anzeige</span>${ad.kind === 'ki' ? '<span class="ad-badge ki">✨ KI-generiert</span>' : (ad.kind === 'play' ? '<span class="ad-badge ki">🎮 Spielbare Anzeige</span>' : '<span class="ad-badge wir">Bezahlte Partnerschaft</span>')}<span class="ad-timer" id="adTimer">5</span></div>
        <div class="ad-visual" id="adVisual">${playable ? '' : hasImg ? `<img src="${ad.img}" alt="" style="object-position:${ad.imgPos || '50% 50%'}">` : `<div class="ad-emoji">${ad.fallbackEmoji}</div>`}</div>
        <div class="ad-copy">
          <div class="ad-brand">${ad.brand}</div>
          <div class="ad-head">${ad.headline}</div>
          <div class="ad-sub">${ad.sub}</div>
          <div class="ad-price">${ad.price}</div>
          <button class="ad-cta" id="adCta">${ad.cta} ›</button>
        </div>
        <div class="ad-progress"><div id="adBar"></div></div>
        <button class="ad-skip" id="adSkip" disabled>Werbung überspringen in 5</button>
        <div class="ad-fine">${ad.fine || ''}</div>
      </div>`);
    stage.appendChild(el);
    // jingle
    const jingle = playable ? 0 : setInterval(() => A.sfx('coin'), 1300); A.sfx('ding');
    // Playable ad: a mini game inside the ad. Winning it skips the ad WITHOUT the new-tab troll.
    let playCleanup = null, adDone = false;
    if (playable) {
      const root = el.querySelector('#adVisual');
      const api = E.makeApi(() => { if (adDone) return; adDone = true; E.toast('Gewonnen! Werbung übersprungen 🎉', 2200); setTimeout(afterAd, 600); });
      api.music = () => {};
      try { playCleanup = playable.start(root, api) || null; } catch (e) { console.error(e); }
    }
    const skip = el.querySelector('#adSkip'), timerEl = el.querySelector('#adTimer'), bar = el.querySelector('#adBar');
    const t0 = performance.now(); let left = 5;
    const iv = setInterval(() => {
      const el2 = (performance.now() - t0) / 1000;
      bar.style.width = Math.min(100, el2 / 5 * 100) + '%';
      const l = Math.max(0, Math.ceil(5 - el2));
      if (l !== left) { left = l; timerEl.textContent = l; skip.textContent = l > 0 ? `Werbung überspringen in ${l}` : 'Werbung überspringen ⏭'; }
      if (l === 0) { skip.disabled = false; clearInterval(iv); }
    }, 100);
    const landing = () => window.open('ad.html?ad=' + idx, '_blank');
    el.querySelector('#adCta').onclick = () => { A.sfx('click'); landing(); };
    skip.onclick = () => {
      if (skip.disabled) return;
      A.sfx('click');
      landing();          // the troll: skipping opens a new tab
      setTimeout(afterAd, 300);
    };
    cleanup = () => { clearInterval(iv); clearInterval(jingle); if (playCleanup) playCleanup(); };
  }

  /* =====================================================================
     FINALE
     ===================================================================== */
  async function showFinale() {
    clearStage(); hud('🎂 ' + C.birthdayName);
    S.phase = 'finale'; save();
    A.music('birthday');
    const hasImg = await imgExists('assets/gen/finale.png');
    const names = C.from.slice(0, -1).join(', ') + ' & ' + C.from[C.from.length - 1];
    const el = h(`
      <div class="screen finale-screen">
        <canvas class="confetti"></canvas>
        <div class="finale-scroll">
          <div class="finale-hero" style="background-image:url(${hasImg ? 'assets/gen/finale.png' : 'assets/photos/wald.jpg'})"></div>
          <h1 class="px finale-title"><span>ALLES GUTE</span><span>ZUM</span><span>GEBURTSTAG,</span><span class="name">${C.birthdayName.toUpperCase()}!</span></h1>
          <div class="finale-msg">${C.message.map(l => `<p>${l}</p>`).join('')}</div>
          <div class="finale-from">Von ${names} 💛</div>
          <div class="finale-gift">
              <div class="gift-wrap" id="gift">
                <canvas class="gift-cv" width="32" height="32"></canvas>
                <div class="gift-hint px">Tipp mich an!</div>
              </div>
              <div class="gift-reveal" id="reveal" hidden>
                <div class="px gift-text">DEIN GESCHENK:<br><span>EINE DISKO-KUGEL<br>MIT MOTOR! 🪩</span></div>
                <button class="btn big party-btn" id="party">🪩 PARTY STARTEN</button>
              </div>
          </div>
          <div class="finale-gallery">${C.gallery.map(src => `<img src="${src}" alt="" loading="lazy">`).join('')}</div>
          <div class="finale-actions">
            <div class="bonus-title px">BONUS-FINALES</div>
            <button class="btn small" data-bonus="finale_dance">💃 Dance-Off</button>
            <button class="btn small" data-bonus="finale_boss">🎁 Geschenk-Boss</button>
            <button class="btn small" data-bonus="finale_credits">🎆 Abspann</button>
            <button class="btn ghost small" id="again">Nochmal spielen</button>
          </div>
        </div>
      </div>`);
    stage.appendChild(el);
    const conf = el.querySelector('.confetti');
    const stopConf = confetti(conf);
    // --- gift reveal ---
    const gift = el.querySelector('#gift'), gcv = gift.querySelector('canvas');
    drawGift(gcv, false);
    let opened = false;
    gift.onclick = () => {
      if (opened) return; opened = true;
      A.sfx('boom'); setTimeout(() => A.sfx('win'), 180);
      gift.classList.add('open'); drawGift(gcv, true); burst = 200;
      const rv = el.querySelector('#reveal'); rv.hidden = false;
      setTimeout(() => rv.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    };
    // --- disco party (full-screen over the stage) ---
    let stopDisco = null;
    function closeDisco() {
      if (!stopDisco) return;
      const f = stopDisco; stopDisco = null;
      try { f(); } catch (e) { console.error(e); }
      hud('🎂 ' + C.birthdayName); A.music('birthday');
    }
    // Full-screen layer over the finale page: the disco party or one of the bonus finales
    function openLayer(title, startFn) {
      if (stopDisco) return;
      A.sfx('click'); hud(title);
      const wrap = h(`<div class="disco-root"><div class="game-root"></div><button class="btn small disco-close" aria-label="Zurück">✕</button></div>`);
      stage.appendChild(wrap);
      const onKey = e => { if (e.key === 'Escape') closeDisco(); };
      let stopInner = null;
      try { stopInner = startFn(wrap.firstElementChild, E.makeApi(() => {})); } catch (e) { console.error(e); }
      stopDisco = () => { window.removeEventListener('keydown', onKey); if (stopInner) stopInner(); wrap.remove(); };
      wrap.querySelector('.disco-close').onclick = e => { e.stopPropagation(); closeDisco(); };
      window.addEventListener('keydown', onKey);
    }
    el.querySelector('#party').onclick = () => openLayer('🪩 Party!', (root, api) => window.Disco.start(root, api));
    el.querySelectorAll('[data-bonus]').forEach(b => {
      const G = window.GAMES[b.dataset.bonus];
      if (!G) { b.remove(); return; }
      b.onclick = () => openLayer(b.textContent, (root, api) => G.start(root, api));
    });
    el.querySelector('#again').onclick = () => { S = { phase: 'title', done: 0 }; save(); go('title'); };
    cleanup = () => { if (stopDisco) { const f = stopDisco; stopDisco = null; f(); } stopConf(); };
  }
  function drawGift(cv, open) {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 32, 32);
    const pal = { R: '#d94c3d', r: '#a8322a', Y: '#f5c542', y: '#c99a24', W: '#fff', K: '#000', P: '#f2a7b8' };
    const box = [
      'KKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRWRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRWRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRWRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRWRRK',
      'KrrrrrrrrrryyyyrrrrrrrrrrK',
      'KrrrrrrrrrryyyyrrrrrrrrrrK',
      'KKKKKKKKKKKKKKKKKKKKKKKKKK'];
    const lid = [
      '.......KKK......KKK.......',
      '......KYYYK....KYYYK......',
      '.......KYYYK..KYYYK.......',
      '........KKYYKKYYKK........',
      'KKKKKKKKKKKKKKKKKKKKKKKKKK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KRRRRRRRRRRYYYYRRRRRRRRRRK',
      'KKKKKKKKKKKKKKKKKKKKKKKKKK'];
    E.drawPixels(g, box, pal, 3, 18, 1);
    if (!open) E.drawPixels(g, lid, pal, 3, 10, 1);
    else {
      // tiny disco ball peeking out
      E.drawPixels(g, [
        '...KKKK...', '..KWWdWK..', '.KWdWWdWK.', '.KWWdWWWK.', '.KdWWWdWK.', '..KWWdWK..', '...KKKK...'],
        { K: '#000', W: '#d8dce8', d: '#7a8090' }, 11, 11, 1);
      g.fillStyle = '#9a9aa8'; g.fillRect(15, 6, 1, 5);
    }
  }
  let burst = 0;
  function confetti(canvas) {
    const g = canvas.getContext('2d');
    const P = [];
    const colors = ['#f5c542', '#d94c3d', '#6fae4f', '#4a7fd9', '#f2a7b8', '#8a5bd9', '#fff'];
    function fit() { canvas.width = canvas.clientWidth / 3 | 0; canvas.height = canvas.clientHeight / 3 | 0; }
    fit(); const ro = new ResizeObserver(fit); ro.observe(canvas);
    burst = 220;
    const stop = E.loop(dt => {
      const W = canvas.width, H = canvas.height;
      const spawn = burst > 0 ? 6 : (Math.random() < 0.35 ? 1 : 0);
      for (let i = 0; i < spawn; i++) { P.push({ x: Math.random() * W, y: -4, vx: (Math.random() - .5) * 30, vy: 20 + Math.random() * 40, c: colors[Math.random() * colors.length | 0], w: Math.random() * 6, p: Math.random() * 6 }); burst--; }
      g.clearRect(0, 0, W, H);
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.x += p.vx * dt + Math.sin(p.p += dt * 4) * 0.3; p.y += p.vy * dt;
        g.fillStyle = p.c; g.fillRect(p.x | 0, p.y | 0, Math.sin(p.p) > 0 ? 2 : 1, 2);
        if (p.y > H + 4) P.splice(i, 1);
      }
    });
    return () => { stop(); ro.disconnect(); };
  }

  /* =====================================================================
     ROUTER
     ===================================================================== */
  function go(phase) {
    if (phase !== 'title') { S.phase = phase; save(); }
    if (phase === 'title') return showTitle();
    if (phase === 'captcha') return showCaptcha();
    if (phase === 'notify') return showNotify();
    if (phase === 'map') return showMap();
    if (phase === 'finale') return showFinale();
    if (phase.startsWith('ad:')) return showAd(+phase.slice(3));
    showMap();
  }
  /* =====================================================================
     HIGHSCORES — shared board (Cloudflare Worker), times per world + whole quest
     ===================================================================== */
  function playerName() { try { return localStorage.getItem('eva-name') || C.birthdayName; } catch (e) { return C.birthdayName; } }
  function setPlayerName(v) { v = String(v || '').trim().slice(0, 16); if (!v) return; try { localStorage.setItem('eva-name', v); } catch (e) {} }
  function fmtTime(ms) { const s = ms / 1000; return s < 60 ? s.toFixed(1).replace('.', ',') + ' s' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + ' min'; }
  async function submitScore(world, ms) {
    if (!C.scoresUrl || params.has('nosave')) return null;
    try {
      const r = await fetch(C.scoresUrl + '/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: playerName(), world, ms: Math.round(ms) }) });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }
  function showBoard(startWorld) {
    if (!C.scoresUrl) return;
    const boards = [...LEVELS.map((L, i) => ({ id: L.id, label: `${i + 1} ${L.world}` })), { id: 'total', label: '★ Ganze Quest' }];
    let cur = boards.some(b => b.id === startWorld) ? startWorld : boards[0].id, data = null, timer = 0;
    const box = h(`<div class="board"><div class="px board-title">🏆 BESTENLISTE</div>
      <div class="board-tabs">${boards.map(b => `<button data-b="${b.id}">${b.label}</button>`).join('')}</div>
      <ol class="board-list"><li>Lade…</li></ol><div class="board-foot">Live – aktualisiert sich alle 5 s · Du spielst als <b></b></div>
      <button class="btn ghost small" id="boardClose">Schließen</button></div>`);
    box.querySelector('.board-foot b').textContent = playerName();
    const list = box.querySelector('.board-list');
    function render() {
      box.querySelectorAll('[data-b]').forEach(b => b.classList.toggle('on', b.dataset.b === cur));
      if (!data) return;
      const rows = data[cur] || [], me = playerName().toLowerCase();
      list.innerHTML = rows.length ? '' : '<li class="empty">Noch keine Zeiten – sei die Erste!</li>';
      rows.slice(0, 15).forEach((e, k) => {
        const li = document.createElement('li'); if (e.name.toLowerCase() === me) li.className = 'me';
        li.innerHTML = `<span class="rk">${['🥇', '🥈', '🥉'][k] || (k + 1) + '.'}</span><span class="nm"></span><span class="tm">${fmtTime(e.ms)}</span>`;
        li.querySelector('.nm').textContent = e.name; list.appendChild(li);
      });
    }
    async function load() { try { const r = await fetch(C.scoresUrl + '/scores', { cache: 'no-store' }); data = await r.json(); } catch (e) { list.innerHTML = '<li class="empty">Bestenliste gerade nicht erreichbar</li>'; return; } render(); }
    box.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { A.sfx('click'); cur = b.dataset.b; render(); });
    const close = () => { clearInterval(timer); overlay.innerHTML = ''; overlay.className = ''; };
    box.querySelector('#boardClose').onclick = close;
    overlay.innerHTML = ''; overlay.className = 'dim'; overlay.appendChild(box);
    load(); timer = setInterval(() => { if (!document.body.contains(box)) return clearInterval(timer); load(); }, 5000);
  }
  document.getElementById('scoreBtn').onclick = () => { A.unlock(); A.sfx('click'); showBoard(); };

  window.__go = go; // handy for testing from the console

  /* =====================================================================
     DEV MODE — open once with ?dev (stays on), turn off with ?dev=0.
     🛠 in the HUD jumps anywhere; ⏭ Sieg wins the running world instantly.
     ===================================================================== */
  let devSkip = null;
  try {
    if (params.get('dev') === '0') localStorage.removeItem('eva-dev');
    else if (params.has('dev')) localStorage.setItem('eva-dev', '1');
  } catch (e) {}
  let devOn = false; try { devOn = localStorage.getItem('eva-dev') === '1'; } catch (e) {}
  if (devOn) {
    const devBtn = document.getElementById('devBtn'), devWin = document.getElementById('devWin');
    devBtn.hidden = false;
    setInterval(() => { devWin.hidden = !(devSkip && stage.querySelector('.game-root')); }, 300);
    devWin.onclick = () => { if (devSkip) { const f = devSkip; devSkip = null; f(); } };
    devBtn.onclick = () => {
      A.unlock();
      const items = [
        ['Titel', () => go('title')], ['Captcha', () => go('captcha')], ['Benachrichtigung', () => go('notify')], ['Karte', () => go('map')],
        ...LEVELS.map((L, i) => [`Welt ${i + 1}: ${L.world}`, () => { S.done = i; save(); devSkip = null; startLevel(i); }]),
        ...C.ads.map((ad, i) => [`Werbung ${i}: ${ad.brand}`, () => { S.adQueue = []; go('ad:' + i); }]),
        ['Finale + Disko', () => { S.done = LEVELS.length; go('finale'); }],
        ['Lauf-Minispiele ↗', () => window.open('minispiele.html', '_blank')],
        ['Flappy-Varianten ↗', () => window.open('minispiele.html?set=flappy', '_blank')],
        ['Finale-Varianten ↗', () => window.open('minispiele.html?set=finale', '_blank')],
        ['Fortschritt zurücksetzen', () => { S = { phase: 'title', done: 0 }; save(); go('title'); }],
        ['Dev-Modus aus', () => { try { localStorage.removeItem('eva-dev'); } catch (e) {} location.href = location.pathname; }]
      ];
      const box = h(`<div class="dev-menu"><div class="px dev-title">DEV-MENÜ</div><div class="dev-list"></div><button class="btn ghost small" id="devClose">Schließen</button></div>`);
      const list = box.querySelector('.dev-list');
      items.forEach(([label, fn]) => { const b = document.createElement('button'); b.className = 'btn small dev-item'; b.textContent = label; b.onclick = () => { overlay.innerHTML = ''; overlay.className = ''; fn(); }; list.appendChild(b); });
      box.querySelector('#devClose').onclick = () => { overlay.innerHTML = ''; overlay.className = ''; };
      overlay.innerHTML = ''; overlay.className = 'dim'; overlay.appendChild(box);
    };
  }

  // Always start on the title screen (it's the user gesture that unlocks sound),
  // unless a dev param asked for something specific.
  if (params.has('level') || params.has('finale') || params.has('ad')) { go(S.phase); }
  else showTitle();
})();

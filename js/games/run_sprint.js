/* Zielsprint gegen die Jungs – side-scrolling pixel race with stamina management.
   HOLD = push (faster, stamina drains, heart rate up). RELEASE = cruise (stamina regenerates).
   Stamina 0 → "Seitenstechen!" (2 s slow jog). Final stretch: tap-mash for a final kick. */
(function () {
  'use strict';

  const W = 180, H = 320;
  const UNITS = 30;          // every race is 30 "units" long (≈30 s at cruise speed)
  const PPU = 40;            // screen pixels per unit
  const EVA_SX = 62;         // Eva's screen x
  const GROUND = 214;        // base ground y (scene)
  const V_CRUISE = 1.0, V_PUSH = 1.45, V_STITCH = 0.6;
  const DRAIN = 22, REGEN = 15, STITCH_T = 2;

  // Runners: lane 0 = back, 2 = front. ai(x) = base speed by race fraction x.
  const RACES = [
    { name: 'Stadionrunde', len: 400, theme: 'stadium', hills: false,
      card: ['RENNEN 1/3', '400 m', 'gegen Laurenz'],
      rivals: [{ who: 'laurenz', lane: 1, ai: x => x < 0.25 ? 1.42 : x < 0.45 ? 1.0 : x < 0.86 ? 0.95 : 1.12 }],
      evaLane: 2 },
    { name: 'Parkrunde', len: 1000, theme: 'park', hills: false,
      card: ['RENNEN 2/3', '1 km', 'gegen Magnus'],
      rivals: [{ who: 'magnus', lane: 1, ai: x => x < 0.88 ? 1.1 : 1.16 }],
      evaLane: 2 },
    { name: 'Waldrunde', len: 800, theme: 'forest', hills: true,
      card: ['RENNEN 3/3', '800 m mit Hügel', 'gegen ALLE'],
      rivals: [
        { who: 'laurenz', lane: 0, ai: x => x < 0.22 ? 1.45 : x < 0.5 ? 1.02 : x < 0.86 ? 1.04 : 1.16 },
        { who: 'magnus', lane: 2, ai: x => x < 0.88 ? 1.12 : 1.16 }],
      evaLane: 1 }
  ];
  const HILL = { upA: 0.33, upB: 0.47, dnA: 0.55, dnB: 0.69, height: 30 };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = t => t * t * (3 - 2 * t);

  function hillH(race, u) { // terrain height in px at world unit u
    if (!race.hills) return 0;
    const x = u / UNITS;
    if (x < HILL.upA) return 0;
    if (x < HILL.upB) return HILL.height * smooth((x - HILL.upA) / (HILL.upB - HILL.upA));
    if (x < HILL.dnA) return HILL.height;
    if (x < HILL.dnB) return HILL.height * (1 - smooth((x - HILL.dnA) / (HILL.dnB - HILL.dnA)));
    return 0;
  }
  function slopeAt(race, u) {
    if (!race.hills) return 0;
    const x = u / UNITS;
    if (x >= HILL.upA && x < HILL.upB) return 1;
    if (x >= HILL.dnA && x < HILL.dnB) return -1;
    return 0;
  }
  const finaleFrac = race => Math.min(100 / race.len, 0.15);

  /* ---------- pure simulation (also used for balancing tests) ---------- */
  function newState(ri, losses) {
    const race = RACES[ri];
    const mercy = Math.max(0.8, 1 - 0.04 * losses);
    return {
      race, ri, mercy, t: 0,
      eva: { who: 'eva', lane: race.evaLane, pos: 0, v: 0, stamina: 100, stitch: 0, burst: 0, hr: 92, isEva: true },
      rivals: race.rivals.map(r => ({ who: r.who, lane: r.lane, ai: r.ai, pos: 0, v: 0 })),
      events: []
    };
  }
  function inFinale(s, r) { return r.pos / UNITS >= 1 - finaleFrac(s.race); }
  function tapBurst(s) {
    const e = s.eva;
    if (!inFinale(s, e) || e.stamina <= 0 || e.stitch > 0) return false;
    e.burst = Math.min(0.6, e.burst + 0.12);
    e.stamina = Math.max(0, e.stamina - 2.5);
    return true;
  }
  function step(s, dt, held) {
    const e = s.eva, race = s.race;
    s.t += dt;
    const sl = slopeAt(race, e.pos), fin = inFinale(s, e);
    let target;
    if (e.stitch > 0) {
      target = V_STITCH; e.stitch -= dt; e.stamina = Math.min(100, e.stamina + 12 * dt);
    } else if (held && e.stamina > 0) {
      target = V_PUSH;
      e.stamina -= DRAIN * (sl > 0 ? 1.7 : sl < 0 ? 0.6 : 1) * dt;
      if (e.stamina <= 0) {
        e.stamina = 0;
        if (!fin) { e.stitch = STITCH_T; s.events.push('stitch'); }
      }
    } else {
      target = V_CRUISE;
      e.stamina = Math.min(100, e.stamina + REGEN * (sl > 0 ? 0.55 : 1) * dt);
    }
    target += sl * -0.2 + e.burst;
    e.burst *= Math.exp(-2.5 * dt);
    e.v += (target - e.v) * Math.min(1, 3 * dt);
    e.pos += e.v * dt;
    const hrT = e.stitch > 0 ? 178 : (held && e.stamina > 0) ? 186 : 128;
    e.hr += (hrT + (sl > 0 ? 14 : 0) + e.burst * 30 - e.hr) * Math.min(1, 0.9 * dt);
    for (const r of s.rivals) {
      const x = r.pos / UNITS;
      const t = r.ai(x) * s.mercy + slopeAt(race, r.pos) * -0.2;
      r.v += (t - r.v) * Math.min(1, 3 * dt);
      r.pos += r.v * dt;
    }
  }
  // Returns null while running; otherwise { winner, order, gap } once someone crossed the line.
  function checkFinish(s) {
    const all = [s.eva].concat(s.rivals);
    if (!all.some(r => r.pos >= UNITS)) return null;
    const ft = r => r.v > 0 ? (UNITS - r.pos) / r.v : 99; // negative = already crossed that long ago
    const order = all.slice().sort((a, b) => ft(a) - ft(b));
    return { winner: order[0], order, gap: ft(order[1]) - ft(order[0]) };
  }

  /* ---------- sprites ---------- */
  const HEART = ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
  const MEDAL = ['R.....R', '.R...R.', '..R.R..', '..GGG..', '.GYYYG.', 'GYYGYYG', '.GYYYG.', '..GGG..'];
  const TREE = ['...LL...', '..LLLL..', '.LLlLLL.', 'LLLLLlLL', '.LlLLLL.', 'LLLLlLLL', '.LLLLLL.', '...TT...', '...TT...'];

  GAMES['run_sprint'] = {
    title: 'Zielsprint',
    intro: 'Renn gegen Laurenz & Magnus! GEDRÜCKT HALTEN = Vollgas (kostet Puste), LOSLASSEN = Puste tanken. Puste leer = Seitenstechen! Im Endspurt: schnell tippen!',
    _sim: { RACES, UNITS, newState, step, checkFinish, tapBurst, inFinale },
    start(root, api) {
      api.music('game');
      const cv = api.makeCanvas(root, W, H);
      const ctx = cv.ctx, P = api.PAL;

      let ri = 0, losses = 0, mode = 'card', modeT = 0, T = 0;
      let S = newState(0, 0);
      let held = false, result = null, photo = false, won = false;
      let bubbles = [], lastSay = {}, lastRank = 1, said = {};
      let flash = 0, stepT = 0, confetti = [];

      /* ---------- speech ---------- */
      function say(who, text, ms, force) {
        if (!force && lastSay[who] && T - lastSay[who] < 2.4) return;
        lastSay[who] = T;
        bubbles = bubbles.filter(b => b.who !== who);
        bubbles.push({ who, text, until: T + (ms || 1800) / 1000 });
      }
      const LINES = {
        laurenz: { start: 'Tschüss Eva! HAHA', fade: '*keuch* *keuch*', passed: 'Was?! *keuch*', passes: 'HAHAHA!', hill: 'Wer hat den Berg bestellt?!', finale: 'NEEEIN!' },
        magnus: { start: 'Ich lauf einfach.', fade: 'Gleichmäßig.', passed: 'Hm. Okay.', passes: 'Tschuldigung.', hill: 'Hügel. Schön.', finale: 'Interessant.' }
      };

      function startRace() {
        S = newState(ri, losses);
        mode = 'count'; modeT = 0; result = null; photo = false;
        bubbles = []; lastSay = {}; said = {}; lastRank = rankOf(S.eva);
      }
      function rankOf(r) {
        const all = [S.eva].concat(S.rivals);
        return 1 + all.filter(o => o !== r && o.pos > r.pos + 1e-6).length;
      }

      /* ---------- input ---------- */
      function press() {
        if (mode === 'card') { if (modeT > 0.4) { api.sfx('click'); startRace(); } return; }
        held = true;
        if (mode === 'race' && tapBurst(S)) api.sfx('step');
      }
      function release() { held = false; }
      const onDown = e => { e.preventDefault(); press(); };
      const isKey = e => e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowRight' || e.code === 'KeyW' || e.code === 'KeyD' || e.code === 'Enter';
      const onKeyDown = e => { if (!isKey(e)) return; e.preventDefault(); if (e.repeat) return; press(); };
      const onKeyUp = e => { if (!isKey(e)) return; e.preventDefault(); release(); };
      const onBlur = () => { held = false; };
      root.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);

      /* ---------- update ---------- */
      function update(dt) {
        T += dt; modeT += dt;
        if (flash > 0) flash = Math.max(0, flash - dt * 2);
        bubbles = bubbles.filter(b => b.until > T);
        if (mode === 'count') {
          const prev = Math.floor(modeT - dt), now = Math.floor(modeT);
          if (now !== prev && now < 3) api.sfx('click');
          if (modeT >= 3) {
            mode = 'race'; modeT = 0; api.sfx('ding');
            S.rivals.forEach((r, i) => { said[r.who + 'startAt'] = 0.3 + i * 0.9; });
          }
        } else if (mode === 'race') {
          step(S, dt, held);
          const e = S.eva;
          // footsteps
          stepT += dt * e.v * 4; if (stepT > 1) { stepT = 0; api.sfx('step'); }
          while (S.events.length) {
            const ev = S.events.shift();
            if (ev === 'stitch') { api.sfx('hit'); say('eva', 'Au! Seitenstechen!', 2000, true); }
          }
          for (const r of S.rivals) {
            const x = r.pos / UNITS, L = LINES[r.who];
            if (!said[r.who + 'start'] && modeT > said[r.who + 'startAt']) { said[r.who + 'start'] = 1; say(r.who, L.start, 1800, true); }
            if (!said[r.who + 'fade'] && ((r.who === 'laurenz' && x > (ri === 2 ? 0.23 : 0.26)) || (r.who === 'magnus' && x > 0.45))) { said[r.who + 'fade'] = 1; say(r.who, L.fade); }
            if (S.race.hills && !said[r.who + 'hill'] && x > HILL.upA) { said[r.who + 'hill'] = 1; say(r.who, L.hill, 2000); }
            if (!said[r.who + 'fin'] && inFinale(S, r) && r.pos < e.pos) { said[r.who + 'fin'] = 1; say(r.who, L.finale); }
            // overtakes
            const ahead = r.pos > e.pos;
            if (r._ahead !== undefined && r._ahead !== ahead) {
              if (ahead) say(r.who, L.passes); else { say(r.who, L.passed); if (Math.random() < 0.5) say('eva', 'Bis später!', 1300); }
            }
            r._ahead = ahead;
          }
          if (!said.evaFin && inFinale(S, e)) { said.evaFin = 1; api.sfx('launch'); api.toast('ENDSPURT! Schnell tippen!', 1600); }
          const rank = rankOf(e);
          if (rank < lastRank) api.sfx('coin');
          lastRank = rank;
          const fin = checkFinish(S);
          if (fin) {
            result = fin; flash = 1;
            photo = fin.gap < 0.45 && (fin.winner === e || fin.order[1] === e);
            mode = photo ? 'photo' : 'result'; modeT = 0;
            api.sfx(photo ? 'boom' : (fin.winner === e ? 'coin' : 'lose'));
            if (photo) bubbles = [];
          }
        } else if (mode === 'photo') {
          if (modeT > 1.8) { mode = 'result'; modeT = 0; api.sfx(result.winner === S.eva ? 'coin' : 'lose'); }
        } else if (mode === 'result') {
          // keep everyone jogging out
          if (result.winner === S.eva) {
            if (modeT > 1.8) {
              losses = 0;
              if (ri === 2) { mode = 'podium'; modeT = 0; api.sfx('win'); initConfetti(); }
              else { ri++; mode = 'card'; modeT = 0; }
            }
          } else if (modeT > 1.8) { losses++; startRace(); }
        } else if (mode === 'podium') {
          confetti.forEach(c => { c.y += c.vy * dt; c.x += Math.sin(T * 3 + c.p) * 10 * dt; if (c.y > H) c.y = -4; });
          if (modeT > 2.8 && !won) { won = true; api.win(); }
        }
      }
      function initConfetti() {
        const cols = [P.red, P.yellow, P.blue, P.pink, P.leafLight, P.autumnLight];
        confetti = Array.from({ length: 60 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H - H, vy: 25 + Math.random() * 40, p: Math.random() * 6, c: cols[i % cols.length] }));
      }

      /* ---------- drawing ---------- */
      const THEMES = {
        stadium: { sky: ['#6fb8e0', '#a8dcf0'], far: '#5a6e80', track: '#c2543a', trackDark: '#9e3f2a', line: '#f6e7c8', grass: '#4f9a3f' },
        park: { sky: ['#7fbfdf', '#c4e6ef'], far: '#5d8a4a', track: '#b8935f', trackDark: '#94733f', line: '#d8bd8a', grass: '#5ea04a' },
        forest: { sky: ['#e6a35a', '#f5d08a'], far: '#6b4a2a', track: '#8a5a32', trackDark: '#6a4224', line: '#a87444', grass: '#7a8a2e' }
      };
      function camU() { return S.eva.pos - EVA_SX / PPU; } // world unit at screen x=0
      function groundY(u) { return GROUND - hillH(S.race, u); }

      function drawScene() {
        const th = THEMES[S.race.theme], cu = camU();
        // sky
        ctx.fillStyle = th.sky[0]; ctx.fillRect(0, 60, W, 60);
        ctx.fillStyle = th.sky[1]; ctx.fillRect(0, 120, W, 70);
        // sun
        ctx.fillStyle = S.race.theme === 'forest' ? '#fff0b0' : '#fff6c8'; ctx.fillRect(140, 74, 14, 14); ctx.fillRect(138, 77, 18, 8); ctx.fillRect(143, 72, 8, 18);
        // clouds (parallax 0.08)
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 67 - cu * PPU * 0.08 - T * 3) % 260 + 260) % 260 - 40, cy = 78 + ((i * 29) % 40);
          ctx.fillRect(cx, cy, 26, 6); ctx.fillRect(cx + 6, cy - 4, 12, 4); ctx.fillRect(cx + 4, cy + 6, 18, 2);
        }
        // far layer (parallax 0.2)
        const fo = (cu * PPU * 0.2) % 60;
        ctx.fillStyle = th.far;
        for (let i = -1; i < 5; i++) {
          const x = i * 60 - fo;
          if (S.race.theme === 'stadium') { ctx.fillRect(x, 150, 58, 40); ctx.fillStyle = '#7a8ea0'; ctx.fillRect(x, 146, 58, 4); ctx.fillStyle = th.far; }
          else { ctx.fillRect(x + 10, 160, 40, 30); ctx.fillRect(x + 20, 148, 20, 12); ctx.fillRect(x, 172, 60, 18); }
        }
        // stadium crowd dots / mid trees (parallax 0.5)
        const mo = (cu * PPU * 0.5) % 24;
        if (S.race.theme === 'stadium') {
          const crowd = [P.red, P.yellow, P.cream, P.blue, P.pink];
          for (let i = -1; i < 9; i++) for (let row = 0; row < 3; row++) {
            ctx.fillStyle = crowd[(i * 7 + row * 3 + Math.floor(cu * 0.5)) % 5 + (0)] || P.cream;
            const bob = (Math.floor(T * 4 + i + row) % 2);
            ctx.fillRect(i * 24 - mo + row * 8, 156 + row * 10 - bob, 4, 5);
          }
          ctx.fillStyle = '#3a4a5a'; ctx.fillRect(0, 186, W, 4);
        } else {
          const pal = S.race.theme === 'forest' ? { L: P.autumn, l: P.autumnLight, T: P.bark } : { L: P.leaf, l: P.leafLight, T: P.bark };
          for (let i = -1; i < 9; i++) {
            const seed = Math.floor(cu * PPU * 0.5 / 24) + i;
            const hx = ((seed * 37) % 11) - 5;
            api.drawPixels(ctx, TREE, (seed & 1) && S.race.theme === 'forest' ? { L: P.red, l: P.autumnLight, T: P.bark } : pal, i * 24 - mo + hx, 160 + ((seed * 13) & 3), 3);
          }
        }
        // ground columns
        for (let sx = 0; sx < W; sx += 2) {
          const u = cu + sx / PPU, gy = Math.round(groundY(u));
          ctx.fillStyle = th.grass; ctx.fillRect(sx, gy - 26, 2, 4);
          ctx.fillStyle = th.track; ctx.fillRect(sx, gy - 22, 2, 34);
          ctx.fillStyle = th.trackDark; ctx.fillRect(sx, gy + 12, 2, 4);
          ctx.fillStyle = P.soil; ctx.fillRect(sx, gy + 16, 2, 250 - gy - 16);
          // lane lines
          if (S.race.theme === 'stadium' || ((Math.floor((u * PPU) / 6)) & 1)) {
            ctx.fillStyle = th.line; ctx.fillRect(sx, gy - 10, 2, 1); ctx.fillRect(sx, gy + 1, 2, 1);
          }
        }
        // distance markers every 100 m
        const len = S.race.len;
        for (let m = 100; m < len; m += 100) {
          const u = m / len * UNITS, sx = (u - cu) * PPU;
          if (sx < -20 || sx > W + 20) continue;
          const gy = groundY(u);
          ctx.fillStyle = P.cream; ctx.fillRect(sx, gy - 40, 2, 16);
          ctx.fillStyle = '#2a2a2a'; ctx.fillRect(sx - 13, gy - 48, 28, 9);
          api.text(ctx, m + '', sx + 1, gy - 47, 8, P.cream, 'center', false);
        }
        // start + finish lines
        drawLine(0, false);
        drawLine(UNITS, true);
        // slope signs
        if (S.race.hills) {
          [[HILL.upA, '▲'], [HILL.dnA, '▼']].forEach(([x, s]) => {
            const u = x * UNITS - 1.2, sx = (u - cu) * PPU; if (sx < -20 || sx > W + 20) return;
            const gy = groundY(u);
            ctx.fillStyle = P.bark; ctx.fillRect(sx, gy - 46, 2, 22);
            ctx.fillStyle = P.yellow; ctx.fillRect(sx - 7, gy - 56, 16, 12);
            ctx.fillStyle = '#2a2a2a';
            if (s === '▲') { for (let k = 0; k < 5; k++) ctx.fillRect(sx - 4 + k * 2, gy - 46 - k * 2, 2, 2 + k * 2); }
            else { for (let k = 0; k < 5; k++) ctx.fillRect(sx - 4 + k * 2, gy - 54 + k * 2 - 0, 2, 10 - k * 2); }
          });
        }
      }
      function drawLine(u, finish) {
        const sx = Math.round((u - camU()) * PPU);
        if (sx < -30 || sx > W + 30) return;
        const gy = groundY(u);
        for (let y = gy - 22; y < gy + 12; y += 3) { ctx.fillStyle = ((y / 3) & 1) ? '#ffffff' : (finish ? '#1d1d1d' : '#ffffff'); ctx.fillRect(sx, y, 3, 3); }
        if (finish) {
          ctx.fillStyle = '#e0e0e0'; ctx.fillRect(sx - 1, gy - 70, 2, 48); ctx.fillRect(sx + 3, gy - 70, 2, 48);
          for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = ((i + j) & 1) ? '#1d1d1d' : '#ffffff'; ctx.fillRect(sx - 15 + i * 4, gy - 78 + j * 4, 4, 4); }
          api.text(ctx, 'ZIEL', sx + 2, gy - 90, 8, P.yellow, 'center');
        }
      }
      function runnerScreen(r) {
        const sx = EVA_SX + (r.pos - S.eva.pos) * PPU;
        const laneOff = [-12, -1, 10][r.lane];
        return { sx, fy: groundY(r.pos) + laneOff };
      }
      function drawRunners(frozen) {
        const list = [S.eva].concat(S.rivals).sort((a, b) => a.lane - b.lane);
        for (const r of list) {
          const { sx, fy } = runnerScreen(r);
          if (sx < -26 || sx > W + 2) continue;
          let frame = 'idle';
          if (mode !== 'card' && mode !== 'count' || (mode === 'count' && false)) {
            const ph = Math.floor((r.pos * 5 + (frozen ? 0 : 0)) * 1.0) % 2;
            frame = ph ? 'run1' : 'run2';
          }
          const stitched = r.isEva && r.stitch > 0;
          const bob = frame === 'run1' ? -1 : 0;
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(sx) + 3, fy - 1, 18, 3);
          api.drawChar(ctx, r.who, frame, Math.round(sx), fy - 32 + bob + (stitched ? 2 : 0), 2, false);
          if (r.isEva) {
            // sweat when pushing, stitch star
            if (stitched && Math.floor(T * 6) % 2) { ctx.fillStyle = P.red; ctx.fillRect(sx + 20, fy - 20, 3, 3); ctx.fillRect(sx + 22, fy - 23, 2, 2); }
            else if (held && mode === 'race' && Math.floor(T * 8) % 3 === 0) { ctx.fillStyle = P.sky; ctx.fillRect(sx - 2, fy - 30, 2, 3); }
          }
          if (r.who === 'laurenz' && mode === 'race' && r.pos / UNITS > 0.25 && r.pos / UNITS < 0.5 && Math.floor(T * 5) % 2) {
            ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(sx + 24, fy - 24, 3, 2); ctx.fillRect(sx + 28, fy - 26, 2, 2);
          }
        }
        // off-screen indicators
        for (const r of S.rivals) {
          const { sx, fy } = runnerScreen(r);
          const dm = Math.round(Math.abs(r.pos - S.eva.pos) / UNITS * S.race.len);
          const name = r.who === 'magnus' ? 'MAG' : 'LAU';
          if (sx > W + 2) { indicator(W - 2, fy - 30, name, '+' + dm + 'm', 'right'); }
          else if (sx < -26) { indicator(2, fy - 30, name, '-' + dm + 'm', 'left'); }
        }
      }
      function indicator(x, y, name, d, align) {
        const bw = 34, bx = align === 'right' ? x - bw : x;
        ctx.fillStyle = 'rgba(20,32,26,.8)'; ctx.fillRect(bx, y, bw, 20);
        ctx.fillStyle = P.yellow;
        if (align === 'right') { ctx.fillRect(x, y + 6, 2, 8); ctx.fillRect(x + 2, y + 8, 1, 4); }
        else { ctx.fillRect(x - 2, y + 6, 2, 8); ctx.fillRect(x - 3, y + 8, 1, 4); }
        api.text(ctx, name, bx + bw / 2, y + 2, 8, P.cream, 'center', false);
        api.text(ctx, d, bx + bw / 2, y + 11, 8, P.yellow, 'center', false);
      }
      function wrapText(str, maxChars) {
        const words = str.split(' '), lines = []; let cur = '';
        for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
        if (cur) lines.push(cur);
        return lines;
      }
      function drawBubbles() {
        for (const b of bubbles) {
          const r = b.who === 'eva' ? S.eva : S.rivals.find(o => o.who === b.who);
          if (!r) continue;
          let { sx, fy } = runnerScreen(r);
          const lines = wrapText(b.text, 12);
          const bw = Math.max(...lines.map(l => l.length)) * 8 + 8, bh = lines.length * 9 + 6;
          let bx = clamp(Math.round(sx + 12 - bw / 2), 2, W - bw - 2);
          let by = fy - 36 - bh - (r.lane === 0 ? 8 : 0);
          by = Math.max(62, by);
          ctx.fillStyle = '#1d1d1d'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, bw, bh);
          const tx = clamp(Math.round(sx + 12), bx + 3, bx + bw - 5);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, by + bh, 3, 3); ctx.fillRect(tx + 1, by + bh + 3, 1, 2);
          lines.forEach((l, i) => api.text(ctx, l, bx + bw / 2, by + 4 + i * 9, 8, '#1d1d1d', 'center', false));
        }
      }
      function drawHUD() {
        const e = S.eva;
        ctx.fillStyle = P.dark; ctx.fillRect(0, 0, W, 60);
        ctx.fillStyle = P.leafDark; ctx.fillRect(0, 59, W, 1);
        api.text(ctx, 'RENNEN ' + (ri + 1) + '/3', 4, 4, 8, P.cream);
        api.text(ctx, S.race.len >= 1000 ? (S.race.len / 1000) + ' km' : S.race.len + ' m', 4, 14, 8, P.sky);
        // position
        const rank = mode === 'card' ? 1 : rankOf(e);
        const posCol = rank === 1 ? P.gold : rank === 2 ? '#c0c8d0' : '#cd7f32';
        api.text(ctx, rank + '.', W - 4, 4, 16, posCol, 'right');
        api.text(ctx, 'PLATZ', W - 4, 22, 8, P.cream, 'right');
        // stamina bar
        api.text(ctx, 'PUSTE', 4, 26, 8, P.cream);
        const bx = 48, by = 26, bw = 70, bh = 8;
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(bx, by, bw, bh);
        const st = e.stamina / 100;
        ctx.fillStyle = e.stitch > 0 ? (Math.floor(T * 6) % 2 ? P.red : '#5a1a14') : st > 0.5 ? P.leafLight : st > 0.25 ? P.yellow : P.red;
        ctx.fillRect(bx, by, Math.round(bw * st), bh);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(bx, by, Math.round(bw * st), 2);
        // heart + bpm
        const beat = (T * e.hr / 60) % 1 < 0.25;
        api.drawPixels(ctx, HEART, { R: P.red }, 4, beat ? 42 : 43, beat ? 2 : 1.7);
        api.text(ctx, Math.round(e.hr) + ' BPM', 22, 44, 8, e.hr > 175 ? P.red : P.cream);
        const togo = Math.max(0, Math.round((1 - e.pos / UNITS) * S.race.len));
        api.text(ctx, 'noch ' + togo + 'm', W - 4, 44, 8, P.yellow, 'right');
      }
      function drawBottom() {
        ctx.fillStyle = P.dark; ctx.fillRect(0, 250, W, 70);
        ctx.fillStyle = P.leafDark; ctx.fillRect(0, 250, W, 1);
        // mini course map
        const mx = 10, mw = W - 20, my = 262;
        ctx.fillStyle = '#3a4a40'; ctx.fillRect(mx, my, mw, 2);
        if (S.race.hills) {
          ctx.fillStyle = '#6a5a3a';
          for (let i = 0; i < mw; i++) { const h = Math.round(hillH(S.race, i / mw * UNITS) / 5); if (h) ctx.fillRect(mx + i, my - h, 1, h); }
        }
        const ff = 1 - finaleFrac(S.race);
        ctx.fillStyle = P.autumn; ctx.fillRect(mx + mw * ff, my, mw * (1 - ff), 2);
        ctx.fillStyle = '#fff'; ctx.fillRect(mx + mw - 1, my - 6, 2, 8);
        const dots = S.rivals.map(r => [r, r.who === 'magnus' ? '#1f9a7c' : '#d98a3d']).concat([[S.eva, P.pink]]);
        for (const [r, c] of dots) {
          const x = mx + clamp(r.pos / UNITS, 0, 1) * mw;
          ctx.fillStyle = '#000'; ctx.fillRect(x - 3, my - 3, 6, 6);
          ctx.fillStyle = c; ctx.fillRect(x - 2, my - 2, 4, 4);
        }
        // hint
        let l1, l2, c = P.cream;
        if (mode === 'race' && inFinale(S, S.eva)) {
          l1 = 'ENDSPURT!'; l2 = 'TIPPEN! TIPPEN!'; c = Math.floor(T * 6) % 2 ? P.yellow : P.autumnLight;
        } else if (S.eva.stitch > 0) { l1 = 'Seitenstechen!'; l2 = 'Kurz verschnaufen...'; c = P.red; }
        else { l1 = held ? '>> VOLLGAS <<' : 'HALTEN = Vollgas'; l2 = 'LOS = Puste tanken'; c = held ? P.autumnLight : P.cream; }
        api.text(ctx, l1, W / 2, 278, 8, c, 'center');
        api.text(ctx, l2, W / 2, 292, 8, '#9fb5a8', 'center');
        if (losses > 0 && mode !== 'podium') api.text(ctx, 'Revanche Nr. ' + losses, W / 2, 306, 8, '#6f8a7c', 'center', false);
      }
      function panel(y, h) {
        ctx.fillStyle = 'rgba(13,21,17,.88)'; ctx.fillRect(10, y, W - 20, h);
        ctx.fillStyle = P.autumn; ctx.fillRect(10, y, W - 20, 2); ctx.fillRect(10, y + h - 2, W - 20, 2);
      }
      function drawCard() {
        panel(70, 150);
        const c = S.race.card;
        api.text(ctx, c[0], W / 2, 80, 8, P.autumnLight, 'center');
        api.text(ctx, c[1], W / 2, 96, 16, P.cream, 'center');
        api.text(ctx, c[2], W / 2, 118, 8, P.sky, 'center');
        let x = W / 2 - (S.race.rivals.length * 30 + 30) / 2;
        api.drawChar(ctx, 'eva', 'idle', x, 134, 2); x += 30;
        for (const r of S.race.rivals) { api.drawChar(ctx, r.who, 'idle', x, 134, 2, true); x += 30; }
        const tips = ri === 0 ? ['Laurenz startet', 'viel zu schnell...'] : ri === 1 ? ['Magnus läuft wie', 'ein Uhrwerk.'] : ['Bergauf kostet', 'mehr Puste!'];
        api.text(ctx, tips[0], W / 2, 174, 8, '#c8d8c0', 'center', false);
        api.text(ctx, tips[1], W / 2, 184, 8, '#c8d8c0', 'center', false);
        if (Math.floor(T * 2) % 2) api.text(ctx, 'TIPPEN = START', W / 2, 202, 8, P.yellow, 'center');
      }
      function drawPodium() {
        ctx.fillStyle = '#2a3a6a'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#3a4a8a'; for (let i = 0; i < 9; i++) ctx.fillRect(i * 22 - 10 + ((T * 20) % 22), 0, 8, 220);
        // podium
        const base = 240;
        const blocks = [{ who: 'magnus', x: 22, h: 40, n: '2', c: '#c0c8d0' }, { who: 'eva', x: 66, h: 64, n: '1', c: P.gold }, { who: 'laurenz', x: 110, h: 26, n: '3', c: '#cd7f32' }];
        for (const b of blocks) {
          ctx.fillStyle = b.c; ctx.fillRect(b.x, base - b.h, 48, b.h);
          ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(b.x, base - b.h + b.h - 4, 48, 4);
          api.text(ctx, b.n, b.x + 24, base - b.h + 8, 16, '#1d1d1d', 'center', false);
          const jump = b.who === 'eva' ? Math.abs(Math.sin(T * 5)) * 6 : 0;
          api.drawChar(ctx, b.who, b.who === 'eva' && jump > 3 ? 'jump' : 'idle', b.x + 12, base - b.h - 32 - jump, 2, b.who === 'laurenz');
          if (b.who === 'eva') api.drawPixels(ctx, MEDAL, { R: P.red, G: '#b8860b', Y: P.gold }, b.x + 17, base - b.h - 16 - jump, 2);
        }
        ctx.fillStyle = P.soil; ctx.fillRect(0, base, W, H - base);
        confetti.forEach(c => { ctx.fillStyle = c.c; ctx.fillRect(c.x, c.y, 3, 3); });
        api.text(ctx, 'SIEGERIN!', W / 2, 40, 16, P.gold, 'center');
        api.text(ctx, 'Eva - 1. Platz', W / 2, 66, 8, P.cream, 'center');
        api.text(ctx, '"Respekt."', 46, 120, 8, '#c8f0e0', 'center', false);
        api.text(ctx, '*keuch*', 140, 150, 8, '#ffd0a0', 'center', false);
        api.text(ctx, 'Alle 3 Rennen', W / 2, 262, 8, P.cream, 'center');
        api.text(ctx, 'gewonnen!', W / 2, 274, 8, P.cream, 'center');
      }
      function drawOverlay() {
        if (mode === 'count') {
          const n = 3 - Math.floor(modeT);
          api.text(ctx, n > 0 ? n + '' : 'LOS!', W / 2, 110, 24, P.yellow, 'center');
          api.text(ctx, 'Auf die Plätze...', W / 2, 140, 8, P.cream, 'center');
        }
        if (mode === 'photo') {
          ctx.fillStyle = 'rgba(120,90,50,.35)'; ctx.fillRect(0, 60, W, 190);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(6, 66, W - 12, 178);
          if (Math.floor(modeT * 4) % 2 === 0) api.text(ctx, 'FOTO-FINISH!', W / 2, 80, 8, '#ffffff', 'center');
          ctx.fillStyle = '#ff3030'; if (Math.floor(T * 3) % 2) ctx.fillRect(12, 72, 4, 4);
        }
        if (mode === 'result') {
          const win = result.winner === S.eva;
          panel(86, 64);
          if (win) {
            api.text(ctx, 'GEWONNEN!', W / 2, 98, 16, P.gold, 'center');
            api.text(ctx, ri === 2 ? 'Ab aufs Podest!' : 'Nächstes Rennen...', W / 2, 124, 8, P.cream, 'center');
          } else {
            const nm = result.winner.who === 'magnus' ? 'Magnus' : 'Laurenz';
            api.text(ctx, nm + ' war', W / 2, 96, 8, P.cream, 'center');
            api.text(ctx, 'schneller!', W / 2, 108, 8, P.cream, 'center');
            api.text(ctx, 'REVANCHE!', W / 2, 126, 8, P.yellow, 'center');
            api.text(ctx, 'Tipp: Puste einteilen', W / 2, 140, 8, '#9fb5a8', 'center', false);
          }
        }
        if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.8).toFixed(2) + ')'; ctx.fillRect(0, 60, W, 190); }
      }
      function draw() {
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        if (mode === 'podium') { drawPodium(); return; }
        ctx.save(); ctx.beginPath(); ctx.rect(0, 60, W, 190); ctx.clip();
        drawScene();
        drawRunners(mode === 'photo');
        if (mode === 'race' || mode === 'count') drawBubbles();
        drawOverlay();
        if (mode === 'card') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 60, W, 190); }
        ctx.restore();
        drawHUD();
        drawBottom();
        if (mode === 'card') drawCard();
      }

      const stop = api.loop(dt => { update(dt); draw(); });
      return function cleanup() {
        stop();
        root.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        mode = 'dead';
        cv.destroy();
      };
    }
  };
})();

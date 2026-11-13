/* "Im Takt" – running rhythm game. Tap L / R on the beat so Eva keeps her running stride.
   Own WebAudio groove; notes are scheduled on the AudioContext clock so visuals, audio and judging match. */
(function () {
  'use strict';

  const W = 180, H = 320;
  const GROUND = 130;            // Eva's feet y in the scene
  const EVA_X = 34;
  const LANE_TOP = 140, HIT_Y = 244, BTN_Y = 264;
  const APPROACH = 1.25;         // seconds a note is visible before the hit line
  const WIN_PERFECT = 0.06, WIN_GOOD = 0.12, WIN_OK = 0.2;
  const COL_X = { L: 50, R: 130 };

  const PHASES = [
    { name: 'WARMLAUFEN', bpm: 100, notes: 32, sky: ['#9fd8ec', '#d8f0e8'], hill: '#7fa86a', tree: ['#d9822b', '#f2b33d', '#b5532a'] },
    { name: 'TEMPOLAUF', bpm: 120, notes: 40, sky: ['#f2c879', '#f8e6b0'], hill: '#9a8a4a', tree: ['#c0562a', '#e08a2b', '#8a3a1f'] },
    { name: 'ENDSPURT', bpm: 140, notes: 48, sky: ['#e0705a', '#f5b06a'], hill: '#7a4a3a', tree: ['#a8341f', '#d9622b', '#6a2a18'] }
  ];
  const TOTAL_NOTES = PHASES.reduce((a, p) => a + p.notes, 0);
  const COUNT_IN = 4;
  const PROG = [45, 41, 48, 43];  // A F C G (bass roots, one per bar)

  const FOOT = [
    '..XXX.',
    '.XXXXX',
    '.XXXXX',
    'XXXXXX',
    'XXXXX.',
    'XXXXX.',
    '.XXX..',
    '......',
    '.XXX..',
    'XXXXX.',
    'XXXX..',
    '.XX...'];
  const flipRows = rows => rows.map(r => r.split('').reverse().join(''));
  const FOOT_L = FOOT, FOOT_R = flipRows(FOOT);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  GAMES['run_rhythm'] = {
    title: 'Im Takt',
    intro: 'Lauf im Takt der Musik! Tippe LINKS und RECHTS abwechselnd, genau wenn die Fußspur die Linie trifft. Tastatur: ← → (oder A/D, F/J).',
    start(root, api) {
      api.music(null);
      const cv = api.makeCanvas(root, W, H);
      const g = cv.ctx;

      /* ---------------- audio (own context) ---------------- */
      let ac = null, master = null, noiseBuf = null, lat = 0, useCtx = false, mutedNow = null;
      function initAudio() {
        if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ac = new AC();
          master = ac.createGain(); master.gain.value = api.isMuted() ? 0 : 0.7; master.connect(ac.destination);
          mutedNow = api.isMuted();
          const len = Math.floor(ac.sampleRate * 0.3);
          noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          if (ac.state === 'suspended') ac.resume();
        } catch (e) { ac = null; }
      }
      function osc(type, f0, f1, t, dur, vol, dest, attack) {
        const o = ac.createOscillator(), gn = ac.createGain();
        o.type = type; o.frequency.setValueAtTime(f0, t);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        if (attack) { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + attack); }
        else gn.gain.setValueAtTime(vol, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gn); gn.connect(dest); o.start(t); o.stop(t + dur + 0.03);
      }
      function nz(t, dur, vol, dest, hp) {
        const s = ac.createBufferSource(); s.buffer = noiseBuf;
        const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
        const gn = ac.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(gn); gn.connect(dest); s.start(t); s.stop(t + dur + 0.03);
      }
      const kick = (t, d, v) => osc('sine', 160, 45, t, 0.18, v || 0.9, d);
      const hat = (t, d, v) => nz(t, 0.04, v || 0.18, d, 7000);
      const clap = (t, d) => { nz(t, 0.1, 0.32, d, 1500); nz(t + 0.012, 0.08, 0.22, d, 1800); };
      const tick = (t, d, hi) => osc('square', hi ? 1760 : 1175, 0, t, 0.06, 0.18, d);
      function blip(kind) {   // immediate tap feedback through our context
        if (!ac || !useCtx) return;
        const t = ac.currentTime + 0.002;
        if (kind === 'perfect') { osc('square', 1319, 0, t, 0.05, 0.07, master); osc('square', 1976, 0, t + 0.04, 0.06, 0.05, master); }
        else if (kind === 'good') osc('square', 988, 0, t, 0.05, 0.06, master);
        else osc('triangle', 140, 70, t, 0.08, 0.2, master);
      }

      /* ---------------- clock ---------------- */
      const clock = () => useCtx ? ac.currentTime : performance.now() / 1000;
      const songNow = () => clock() - (useCtx ? lat : 0);

      /* ---------------- sections ---------------- */
      function makeSection(p, t0) {
        const P = PHASES[p], spb = 60 / P.bpm;
        const notes = [];
        for (let i = 0; i < P.notes; i++) notes.push({ t: t0 + (COUNT_IN + i) * spb, foot: i % 2 ? 'R' : 'L', j: null });
        let bus = null;
        if (useCtx) { bus = ac.createGain(); bus.gain.value = 1; bus.connect(master); }
        return { p, bpm: P.bpm, spb, t0, notes, endBeat: COUNT_IN + P.notes, e: 0, bus, next: null, done: false };
      }
      function scheduleEighth(s, e) {
        const t = s.t0 + e * s.spb / 2, beat = e >> 1, off = e & 1, d = s.bus;
        if (beat >= s.endBeat) return;
        if (beat < COUNT_IN) {
          if (!off) { tick(t, d, beat === COUNT_IN - 1); if (s.p > 0) kick(t, d, 0.6); }
          else if (s.p > 0) hat(t, d, 0.12);
          return;
        }
        const k = beat - COUNT_IN, bar = Math.floor(k / 4), bb = k % 4;
        const root = PROG[bar % PROG.length];
        if (!off) {
          kick(t, d);
          if (s.p >= 1 && (bb === 1 || bb === 3)) clap(t, d);
        } else hat(t, d, s.p === 2 ? 0.22 : 0.16);
        if (s.p === 2 && off) hat(t - s.spb / 4, d, 0.08);
        // bass: octave bounce on 8ths
        const bn = root + (off ? 12 : 0);
        osc(s.p === 0 ? 'triangle' : 'square', mtof(bn), 0, t, s.spb / 2 * 0.85, s.p === 0 ? 0.22 : 0.07, d, 0.008);
        // lead arpeggio from phase 2 on
        if (s.p >= 1) {
          const arp = [0, 7, 12, 16, 12, 7, 3, 7];
          const step = (bb * 2 + off);
          if (s.p === 2 || step % 2 === 0) {
            const m = root + 24 + arp[step % 8] - (arp[step % 8] === 16 ? 1 : 0);
            osc('square', mtof(m), 0, t, s.spb / 2 * 0.6, 0.045, d, 0.005);
          }
        }
        if (beat === s.endBeat - 1 && off && s.p === PHASES.length - 1) {
          // final crash + chord
          const tf = t + s.spb / 2;
          nz(tf, 1.2, 0.3, d, 3000);
          [57, 61, 64, 69].forEach(m => osc('square', mtof(m), 0, tf, 1.2, 0.05, d, 0.01));
        }
      }
      let sched = null;   // section the scheduler is working on
      function scheduler() {
        if (!useCtx || !sched || ac.state !== 'running') return;
        const horizon = ac.currentTime + 0.15;
        let guard = 0;
        while (sched && guard++ < 64) {
          const t = sched.t0 + sched.e * sched.spb / 2;
          if (sched.e >= sched.endBeat * 2) {
            if (sched.next) { sched = sched.next; continue; }
            break;
          }
          if (t > horizon) break;
          scheduleEighth(sched, sched.e);
          sched.e++;
        }
      }
      const schedTimer = setInterval(scheduler, 25);

      /* ---------------- game state ---------------- */
      let state = 'ready', stateT = 0, T = 0;
      let cur = null;
      let meter = 75, combo = 0, best = 0, doneBefore = 0;
      const trips = [0, 0, 0];
      let scroll = 0, speed = 30, frame = 'idle', stepT = 0, stumbleT = 0, beatPulse = 0, lastBeatIdx = -1;
      let judge = null;   // {txt, col, t}
      let pressFx = { L: 0, R: 0 };
      let parts = [];
      let finish = null;  // {x0, broken, t}
      let wonCalled = false, startWait = 0;
      const timers = [];

      function startSection(p, t0) {
        cur = makeSection(p, t0);
        sched = cur;
        meter = Math.min(100, 75 + trips[p] * 8);
        combo = 0;
      }
      function beginGame() {
        state = 'run'; stateT = 0;
        startSection(0, clock() + 0.25);
      }

      function popJudge(txt, col) { judge = { txt, col, t: 0 }; }
      function penaltyMul() { return Math.pow(0.72, cur ? trips[cur.p] : 0); }

      function stumble(amount) {
        meter -= amount * penaltyMul();
        combo = 0;
        stumbleT = 0.45;
        speed *= 0.55;
        api.sfx('hit');
        for (let i = 0; i < 3; i++) sweat();
        if (meter <= 0) trip();
      }
      function trip() {
        meter = 0;
        state = 'trip'; stateT = 0;
        trips[cur.p]++;
        if (cur.bus) { cur.bus.gain.setTargetAtTime(0, ac.currentTime, 0.05); }
        cur.next = null; sched = null;
        api.sfx('lose');
        for (let i = 0; i < 8; i++) dust(EVA_X + 12, GROUND, true);
      }
      function good(perfect) {
        meter = Math.min(100, meter + (perfect ? 5 : 3));
        combo++; best = Math.max(best, combo);
        speed = Math.min(speed + (perfect ? 6 : 3), maxSpeed() + 10);
        if (perfect) for (let i = 0; i < 2; i++) dust(EVA_X + 10, GROUND, false);
      }

      function stepAnim(foot) { frame = foot === 'L' ? 'run1' : 'run2'; stepT = 1; }

      function press(foot) {
        pressFx[foot] = 1;
        if (state === 'ready') { initAudio(); state = 'starting'; startWait = 0; stepAnim(foot); return; }
        if (ac && ac.state === 'suspended') ac.resume();
        if (state !== 'run' || !cur) return;
        const now = songNow();
        // during count-in taps are free (just a step)
        if (now < cur.t0 + (COUNT_IN - 0.5) * cur.spb) { stepAnim(foot); return; }
        let bestN = null, bestD = 1e9;
        for (const n of cur.notes) {
          if (n.j) continue;
          const dd = Math.abs(now - n.t);
          if (dd < bestD) { bestD = dd; bestN = n; }
          if (n.t > now + 0.5) break;
        }
        stepAnim(foot);
        if (!bestN || bestD > WIN_OK) { popJudge('DANEBEN', '#ff7a5c'); blip('bad'); stumble(5); return; }
        if (bestN.foot !== foot) { bestN.j = 'wrong'; popJudge('FALSCHER FUSS', '#ff7a5c'); blip('bad'); stumble(9); return; }
        if (bestD <= WIN_PERFECT) { bestN.j = 'perfect'; popJudge('PERFEKT!', '#f5d442'); blip('perfect'); good(true); }
        else if (bestD <= WIN_GOOD) { bestN.j = 'good'; popJudge('GUT', '#8fe86a'); blip('good'); good(false); }
        else { bestN.j = 'off'; popJudge('DANEBEN', '#ff7a5c'); blip('bad'); stumble(9); }
      }

      /* ---------------- input ---------------- */
      function onPointer(e) {
        e.preventDefault();
        const p = cv.pointer(e);
        press(p.x < W / 2 ? 'L' : 'R');
      }
      const KEYS = { ArrowLeft: 'L', KeyA: 'L', KeyF: 'L', ArrowRight: 'R', KeyD: 'R', KeyJ: 'R' };
      function onKey(e) {
        const f = KEYS[e.code];
        if (!f) return;
        e.preventDefault();
        if (e.repeat) return;
        press(f);
      }
      function onVis() {
        if (!ac) return;
        if (document.visibilityState === 'hidden') { if (ac.state === 'running') ac.suspend(); }
        else if (ac.state === 'suspended') ac.resume();
      }
      cv.canvas.addEventListener('pointerdown', onPointer);
      window.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVis);

      /* ---------------- particles ---------------- */
      function sweat() { parts.push({ k: 'sweat', x: EVA_X + 8 + Math.random() * 10, y: GROUND - 30, vx: -20 - Math.random() * 25, vy: -40 - Math.random() * 30, life: 0.7 }); }
      function dust(x, y, big) { parts.push({ k: 'dust', x: x + Math.random() * 6 - 3, y: y - 1, vx: -30 - Math.random() * 30, vy: -10 - Math.random() * 15, life: big ? 0.8 : 0.4 }); }
      function confetti() {
        const cols = ['#f5d442', '#d94c3d', '#4a7fd9', '#8fe86a', '#f2a7b8', '#ffffff'];
        for (let i = 0; i < 70; i++) parts.push({ k: 'conf', x: Math.random() * W, y: -10 - Math.random() * 60, vx: Math.random() * 30 - 15, vy: 20 + Math.random() * 40, life: 3, c: cols[i % cols.length] });
      }

      const maxSpeed = () => cur ? 40 + (cur.bpm - 100) * 0.9 + 25 : 50;

      /* ---------------- update ---------------- */
      function update(dt) {
        T += dt; stateT += dt;
        // mute follows the shell's mute button
        if (master) {
          const m = api.isMuted();
          if (m !== mutedNow) { mutedNow = m; master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.02); }
        }
        stepT = Math.max(0, stepT - dt * 5);
        stumbleT = Math.max(0, stumbleT - dt);
        pressFx.L = Math.max(0, pressFx.L - dt * 5); pressFx.R = Math.max(0, pressFx.R - dt * 5);
        if (judge) { judge.t += dt; if (judge.t > 0.7) judge = null; }
        beatPulse = Math.max(0, beatPulse - dt * 4);

        if (state === 'starting') {
          startWait += dt;
          if (ac && ac.state === 'running' && ac.currentTime > 0) {
            useCtx = true;
            lat = clamp(ac.outputLatency || ac.baseLatency || 0, 0, 0.25);
            beginGame();
          } else if (startWait > 0.5) { useCtx = false; beginGame(); }
        }

        if (state === 'run' && cur) {
          const now = songNow();
          // switch to the next section once its time has come
          if (cur.next && now >= cur.next.t0) {
            doneBefore += cur.notes.length;
            cur = cur.next;
            combo = combo; // keep combo across phases
          }
          // beat pulse + auto steps during count-in
          const bi = Math.floor((now - cur.t0) / cur.spb);
          if (bi !== lastBeatIdx && bi >= 0) {
            lastBeatIdx = bi; beatPulse = 1;
            if (bi < COUNT_IN) stepAnim(bi % 2 ? 'R' : 'L');
          }
          // missed notes
          for (const n of cur.notes) {
            if (n.j) continue;
            if (now > n.t + WIN_OK) { n.j = 'miss'; popJudge('DANEBEN', '#ff7a5c'); stumble(12); if (state !== 'run') break; }
            else break;
          }
          // queue next section shortly before this one ends (seamless tempo change)
          if (state === 'run' && !cur.next && cur.p < PHASES.length - 1 && now > cur.t0 + (cur.endBeat - 2) * cur.spb) {
            const nx = makeSection(cur.p + 1, cur.t0 + cur.endBeat * cur.spb);
            cur.next = nx;
            trips[nx.p] = trips[nx.p] || 0;
          }
          // finished last section?
          if (state === 'run' && cur.p === PHASES.length - 1 && cur.notes.every(n => n.j)) {
            doneBefore += cur.notes.length;
            state = 'finish'; stateT = 0;
            finish = { x0: scroll + 150, broken: false, t: 0 };
          }
          // speed toward target; sweat in endspurt
          const target = 40 + (cur.bpm - 100) * 0.9 + Math.min(combo, 12) * 2;
          speed += (target - speed) * Math.min(1, dt * 1.5);
          if (cur.p === 2 && Math.random() < dt * 1.5) sweat();
        } else if (state === 'trip') {
          speed *= Math.pow(0.05, dt);
          if (stateT > 1.4) {
            state = 'run'; stateT = 0; lastBeatIdx = -1;
            startSection(cur.p, clock() + 0.2);
            popJudge('NOCHMAL!', '#f6e7c8');
          }
        } else if (state === 'finish') {
          const fx = finish.x0 - scroll;
          if (!finish.broken) {
            speed += (70 - speed) * Math.min(1, dt * 2);
            // auto steps
            if (Math.floor(stateT * 4) !== lastBeatIdx) { lastBeatIdx = Math.floor(stateT * 4); stepAnim(lastBeatIdx % 2 ? 'R' : 'L'); }
            if (fx <= EVA_X + 14) { finish.broken = true; finish.t = 0; confetti(); api.sfx('coin'); }
          } else {
            finish.t += dt;
            speed *= Math.pow(0.02, dt);
            if (Math.random() < dt * 8) parts.push({ k: 'conf', x: Math.random() * W, y: -5, vx: Math.random() * 20 - 10, vy: 30 + Math.random() * 30, life: 3, c: ['#f5d442', '#d94c3d', '#4a7fd9', '#8fe86a'][(Math.random() * 4) | 0] });
            if (finish.t > 2.2 && !wonCalled) { wonCalled = true; api.win(); }
          }
        } else if (state === 'ready' || state === 'starting') {
          speed = 0;
        }

        scroll += speed * dt;
        for (const p of parts) {
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.k === 'sweat') p.vy += 260 * dt;
          if (p.k === 'conf') { p.vx += Math.sin(T * 5 + p.y) * 20 * dt; }
        }
        parts = parts.filter(p => p.life > 0 && p.y < H + 10);
      }

      /* ---------------- drawing ---------------- */
      const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
      function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

      function drawTree(x, y, sz, cols, seed) {
        rect(x + sz * 0.45, y - sz * 0.6, Math.max(2, sz * 0.15), sz * 0.6, '#5b3a24');
        const r = sz * 0.5;
        for (let i = 0; i < 3; i++) {
          const cx = x + sz * 0.5 + (i - 1) * r * 0.5, cy = y - sz * 0.8 - (i === 1 ? r * 0.4 : 0);
          g.fillStyle = cols[(seed + i) % 3];
          g.fillRect(Math.round(cx - r * 0.6), Math.round(cy - r * 0.5), Math.round(r * 1.2), Math.round(r));
          g.fillRect(Math.round(cx - r * 0.4), Math.round(cy - r * 0.7), Math.round(r * 0.8), Math.round(r * 1.4));
        }
      }

      function drawScene() {
        const P = PHASES[cur ? cur.p : 0];
        // sky bands
        const bands = 6;
        for (let i = 0; i < bands; i++) {
          g.fillStyle = i < bands / 2 ? P.sky[0] : P.sky[1];
          if (i === 2 || i === 3) g.fillStyle = i === 2 ? P.sky[0] : P.sky[1];
          g.fillRect(0, 26 + i * 12, W, 12);
        }
        rect(0, 26, W, 20, P.sky[0]);
        // sun
        rect(140, 36, 12, 12, '#fff3b0'); rect(138, 38, 16, 8, '#fff3b0'); rect(142, 34, 8, 16, '#fff3b0');
        // hills (parallax 0.2)
        g.fillStyle = P.hill;
        for (let x = 0; x < W; x += 2) {
          const wx = x + scroll * 0.2;
          const h = 14 + Math.sin(wx * 0.03) * 6 + Math.sin(wx * 0.071) * 4;
          g.fillRect(x, 100 - h, 2, h + 10);
        }
        // far trees (0.45)
        const off1 = scroll * 0.45, sp1 = 22;
        for (let i = Math.floor(off1 / sp1) - 1; i < Math.floor(off1 / sp1) + 10; i++) {
          const x = i * sp1 - off1 + hash(i) * 8;
          drawTree(x, 108, 14 + hash(i * 7) * 6, P.tree, i & 3);
        }
        // ground
        rect(0, 108, W, 34, '#4e7a34');
        rect(0, 108, W, 2, '#6fae4f');
        // path
        rect(0, 120, W, 16, '#9a6a3a');
        rect(0, 120, W, 1, '#7a4a2a');
        rect(0, 135, W, 1, '#7a4a2a');
        const off2 = scroll, sp2 = 18;
        for (let i = Math.floor(off2 / sp2) - 1; i < Math.floor(off2 / sp2) + 12; i++) {
          const x = i * sp2 - off2;
          rect(x + hash(i) * 10, 124 + hash(i * 3) * 9, 2, 1, '#7a4a2a');
          if (hash(i * 5) > 0.6) rect(x + hash(i * 11) * 14, 112 + hash(i * 13) * 6, 3, 2, ['#d9822b', '#f2b33d', '#b5532a'][i & 1 ? 0 : 1]);
          if (hash(i * 17) > 0.75) { rect(x + 4, 137, 4, 3, '#3e6a2a'); rect(x + 5, 136, 2, 1, '#6fae4f'); }
        }
        // speed lines on a combo
        if (state === 'run' && combo >= 8) {
          g.fillStyle = 'rgba(255,255,255,0.5)';
          for (let i = 0; i < 4; i++) {
            const y = 70 + hash(i * 31) * 50, x = ((-(scroll * 2.5) + i * 57) % (W + 40) + W + 40) % (W + 40) - 20;
            g.fillRect(Math.round(x), Math.round(y), 14, 1);
          }
        }
        drawSpectators();
        // finish line + friends
        if (finish) {
          const fx = Math.round(finish.x0 - scroll);
          drawFriends(fx);
          rect(fx, 98, 2, 34, '#f6e7c8');
          rect(fx + 1, 98, 1, 34, '#b9a888');
          if (!finish.broken) {
            for (let x = 0; x < 8; x++) rect(fx - 8 + x, 108 + (x & 1), 1, 2, '#d94c3d');
            rect(fx - 9, 98, 2, 34, '#f6e7c8');
          } else {
            const a = Math.min(1, finish.t * 3);
            rect(fx - 1, 108 + a * 6, 2, 8 * (1 - a * 0.5), '#d94c3d');
            rect(fx - 9, 98, 2, 34, '#f6e7c8');
            rect(fx - 8, 108 + a * 8, 2, 7, '#d94c3d');
          }
          // banner "ZIEL"
          rect(fx - 22, 88, 36, 11, '#d94c3d'); rect(fx - 22, 88, 36, 1, '#f2a7b8');
          api.text(g, 'ZIEL', fx - 4, 90, 8, '#fff', 'center', false);
        }
        // beat pulse vignette
        if (beatPulse > 0 && state === 'run') {
          g.fillStyle = `rgba(255,240,200,${0.18 * beatPulse})`;
          g.fillRect(0, 26, W, 2); g.fillRect(0, 138, W, 2);
          g.fillRect(0, 26, 2, 114); g.fillRect(W - 2, 26, 2, 114);
        }
      }

      // Friends pop up along the course every few seconds and shout silly running slogans
      const FANS = ['magnus', 'laurenz', 'hannah', 'enrico', 'niklas'];
      const SLOGANS = [
        ['magnus', ['TEMPO IST KEIN', 'TASCHENTUCH!']],
        ['laurenz', ['WENN DIR SCHWARZ', 'VOR AUGEN WIRD,', 'BIST DU', 'EINGESCHLAFEN!']],
        ['hannah', ['WER RASTET,', 'DER ROSTET!']],
        ['enrico', ['SCHMERZ IST NUR', 'SCHWÄCHE, DIE', 'DICH VERLÄSST!']],
        ['niklas', ['LAUF, EVA, LAUF!', 'ICH WARTE', 'IM ZIEL!']],
        ['magnus', ['HINTEN WIRD', 'DIE ENTE FETT!']],
        ['laurenz', ['LAUFEN IST WIE', 'GEHEN, NUR', 'SCHNELLER!']],
        ['hannah', ['NUR NOCH 42 KM!']],
        ['enrico', ['PACE EGAL,', 'HAUPTSACHE', 'KUCHEN!']],
        ['niklas', ['DU LÄUFST WIE', 'EIN REH!', '(FAST)']],
        ['laurenz', ['ICH HAB POMMES', 'IM ZIEL!']],
        ['magnus', ['NICHT AUFHÖREN,', 'WENN\'S WEHTUT -', 'AUFHÖREN, WENN', 'DU FERTIG BIST!']]
      ];
      const FAN_GAP = 230;
      function drawSpectators() {
        if (state === 'ready') return;
        const first = Math.floor((scroll - 40) / FAN_GAP), last = Math.floor((scroll + W + 40) / FAN_GAP);
        for (let k = Math.max(1, first); k <= last; k++) {
          const x = Math.round(k * FAN_GAP + 60 - scroll);
          if (finish && Math.abs(finish.x0 - scroll - x) < 70) continue; // the finish has its own crowd
          const [who, lines] = SLOGANS[(k - 1) % SLOGANS.length];
          const jump = Math.sin(T * 8 + k) > 0.2;
          const by = jump ? Math.abs(Math.sin(T * 8 + k)) * 5 : 0;
          api.drawChar(g, who, jump ? 'jump' : 'idle', x, 86 - by, 2, x > EVA_X + 10);
          // waving arm / little flag
          rect(x + (k & 1 ? -2 : 22), 84 - by - (jump ? 4 : 0), 2, 8, '#f6e7c8');
          rect(x + (k & 1 ? -8 : 24), 84 - by - (jump ? 4 : 0), 6, 4, ['#d94c3d', '#f5c542', '#4a7fd9', '#ff3f7a', '#6fae4f'][k % 5]);
          // speech bubble while she's close
          if (x > -10 && x < W - 30) {
            const bw = Math.max(...lines.map(l => l.length)) * 8 + 8, bh = lines.length * 10 + 4;
            const bx = Math.max(2, Math.min(W - bw - 2, x + 12 - bw / 2)), byy = 80 - bh - 6;
            rect(bx - 1, byy - 1, bw + 2, bh + 2, '#1d1d1d');
            rect(bx, byy, bw, bh, '#fffaf0');
            rect(Math.max(bx + 2, Math.min(bx + bw - 6, x + 10)), byy + bh, 4, 3, '#fffaf0');
            lines.forEach((l, i) => api.text(g, l, bx + 4, byy + 3 + i * 10, 8, '#2a1a10', 'left', false));
          }
        }
      }

      function drawFriends(fx) {
        const cheering = finish && (finish.broken || (finish.x0 - scroll) < 120);
        const bounce = i => cheering ? Math.abs(Math.sin(T * 9 + i * 1.7)) * 6 : 0;
        const fr = i => cheering && Math.sin(T * 9 + i * 1.7) > 0.3 ? 'jump' : 'idle';
        api.drawChar(g, 'magnus', fr(0), fx + 10, 86 - bounce(0), 2, true);
        api.drawChar(g, 'laurenz', fr(1), fx + 34, 88 - bounce(1), 2, true);
        if (cheering) {
          const by = 68 + Math.round(Math.sin(T * 6));
          rect(fx + 2, by, 64, 12, '#ffffff');
          rect(fx + 20, by + 12, 4, 3, '#ffffff');
          api.text(g, 'LAUF EVA!', fx + 34, by + 2, 8, '#d94c3d', 'center', false);
        }
      }

      function drawEva() {
        let fr = frame;
        if (state === 'ready' || state === 'starting') fr = 'idle';
        if (finish && finish.broken && finish.t > 0.6) fr = Math.sin(T * 9) > 0 ? 'jump' : 'idle';
        const bob = stepT > 0.6 ? -2 : 0;
        const x = EVA_X, y = GROUND - 32 + bob - (fr === 'jump' && finish && finish.broken ? Math.abs(Math.sin(T * 9)) * 6 : 0);
        // shadow
        rect(x + 4, GROUND - 1, 16, 2, 'rgba(0,0,0,0.25)');
        g.save();
        if (state === 'trip') {
          const a = Math.min(1, stateT * 5);
          g.translate(x + 12, GROUND);
          g.rotate(-a * Math.PI / 2 * 0.95);
          api.drawChar(g, 'eva_run', 'jump', -12, -32 + a * 6, 2);
        } else if (stumbleT > 0) {
          g.translate(x + 12, GROUND);
          g.rotate(Math.sin(T * 45) * 0.28 * (stumbleT / 0.45));
          api.drawChar(g, 'eva_run', fr, -12, -32 + bob, 2);
        } else {
          api.drawChar(g, 'eva_run', fr, x, y, 2);
        }
        g.restore();
      }

      function drawParts() {
        for (const p of parts) {
          if (p.k === 'sweat') { rect(p.x, p.y, 2, 2, '#8fd3e8'); rect(p.x, p.y - 1, 1, 1, '#ffffff'); }
          else if (p.k === 'dust') { g.fillStyle = `rgba(230,210,170,${clamp(p.life * 1.5, 0, 0.8)})`; g.fillRect(Math.round(p.x), Math.round(p.y), 3, 2); }
          else if (p.k === 'conf') rect(p.x, p.y, 2, 2, p.c);
        }
      }

      function drawHud() {
        rect(0, 0, W, 26, '#0d1511');
        const p = cur ? cur.p : 0, P = PHASES[p];
        api.text(g, (p + 1) + '/3 ' + P.name, 3, 3, 8, '#f6e7c8');
        // distance bar
        const done = state === 'finish' ? TOTAL_NOTES : doneBefore + (cur ? cur.notes.filter(n => n.j).length : 0);
        const frac = clamp(done / TOTAL_NOTES, 0, 1);
        rect(3, 14, 80, 9, '#26352b');
        rect(4, 15, Math.round(78 * frac), 7, '#6fae4f');
        // flag at end
        rect(81, 12, 1, 11, '#f6e7c8'); rect(82, 12, 4, 3, '#d94c3d');
        // mini Eva head
        const hx = 4 + Math.round(74 * frac);
        rect(hx, 15, 5, 4, '#4a2c1d'); rect(hx + 1, 17, 3, 2, '#f2c39b');
        // Takt-Meter
        rect(90, 14, 87, 9, '#26352b');
        const mc = meter > 50 ? '#8fe86a' : meter > 25 ? '#f5d442' : '#ff6a4c';
        const mw = Math.round(85 * clamp(meter, 0, 100) / 100);
        rect(91, 15, mw, 7, (meter < 25 && Math.sin(T * 20) > 0) ? '#ffffff' : mc);
        for (let i = 1; i < 10; i++) rect(91 + i * 8.5, 15, 1, 7, 'rgba(0,0,0,0.25)');
        api.text(g, 'TAKT', 94, 15, 8, '#ffffff');
        api.text(g, (cur ? cur.bpm : 100) + 'BPM', 177, 3, 8, '#9fb39a', 'right');
      }

      function drawLane() {
        rect(0, LANE_TOP, W, BTN_Y - LANE_TOP + 60, '#14201a');
        const pulse = state === 'run' ? beatPulse : 0;
        for (const f of ['L', 'R']) {
          const cx = COL_X[f];
          rect(cx - 26, LANE_TOP, 52, BTN_Y - LANE_TOP - 4, f === 'L' ? '#1d2e25' : '#1b2a30');
          rect(cx - 26, LANE_TOP, 1, BTN_Y - LANE_TOP - 4, '#2c4436');
          rect(cx + 25, LANE_TOP, 1, BTN_Y - LANE_TOP - 4, '#2c4436');
        }
        // hit line
        rect(4, HIT_Y - 1, W - 8, 2 + Math.round(pulse * 2), pulse > 0.5 ? '#fff3b0' : '#f6e7c8');
        // target footprints
        for (const f of ['L', 'R']) {
          const rows = f === 'L' ? FOOT_L : FOOT_R;
          api.drawPixels(g, rows, { X: pressFx[f] > 0 ? '#5a7a62' : '#2f4a3a' }, COL_X[f] - 9, HIT_Y - 18, 3);
        }
        // notes
        const now = songNow();
        const list = [];
        if (cur && state === 'run') { list.push(...cur.notes); if (cur.next) list.push(...cur.next.notes); }
        for (const n of list) {
          if (n.j && n.j !== 'miss' && n.j !== 'wrong' && n.j !== 'off') continue;
          const dtn = n.t - now;
          if (dtn > APPROACH || dtn < -0.35) continue;
          const y = HIT_Y - (dtn / APPROACH) * (HIT_Y - LANE_TOP);
          const rows = n.foot === 'L' ? FOOT_L : FOOT_R;
          const col = n.j ? '#6a4040' : (n.foot === 'L' ? '#f2b33d' : '#8fd3e8');
          if (y - 18 < LANE_TOP - 2) {
            // clip at lane top
            g.save(); g.beginPath(); g.rect(0, LANE_TOP, W, H); g.clip();
            api.drawPixels(g, rows, { X: col }, COL_X[n.foot] - 9, y - 18, 3);
            g.restore();
          } else api.drawPixels(g, rows, { X: col }, COL_X[n.foot] - 9, y - 18, 3);
        }
        // count-in numbers
        if (cur && state === 'run') {
          const bi = Math.floor((now - cur.t0) / cur.spb);
          if (bi >= 0 && bi < COUNT_IN) {
            const P = PHASES[cur.p];
            api.text(g, 'PHASE ' + (cur.p + 1) + ': ' + P.name, W / 2, LANE_TOP + 8, 8, '#f5d442', 'center');
            api.text(g, P.bpm + ' BPM', W / 2, LANE_TOP + 20, 8, '#9fb39a', 'center');
            api.text(g, '' + (COUNT_IN - bi), W / 2, LANE_TOP + 40, 24, '#ffffff', 'center');
          }
          if (combo >= 4) api.text(g, combo + 'x', W / 2, HIT_Y + 4, 8, '#f5d442', 'center');
        }
        // judgement popup
        if (judge) {
          const s = judge.t < 0.08 ? 16 : 8;
          const yy = 190 - judge.t * 16;
          g.globalAlpha = clamp(1.4 - judge.t * 2, 0, 1);
          api.text(g, judge.txt, W / 2, yy, s, judge.col, 'center');
          g.globalAlpha = 1;
        }
        // buttons
        for (const f of ['L', 'R']) {
          const x = f === 'L' ? 6 : 94, pr = pressFx[f];
          const yo = pr > 0.5 ? 2 : 0;
          rect(x, BTN_Y + 4, 80, 48, '#0a100c');
          rect(x, BTN_Y + yo, 80, 48, pr > 0 ? (f === 'L' ? '#f2b33d' : '#8fd3e8') : (f === 'L' ? '#b5782a' : '#4a7f9a'));
          rect(x + 2, BTN_Y + yo + 2, 76, 3, 'rgba(255,255,255,0.3)');
          api.text(g, f, x + 40, BTN_Y + yo + 10, 16, '#ffffff', 'center');
          api.text(g, f === 'L' ? 'LINKS' : 'RECHTS', x + 40, BTN_Y + yo + 32, 8, '#ffffff', 'center');
        }
      }

      function drawOverlay() {
        if (state === 'ready' || state === 'starting') {
          rect(10, 156, W - 20, 70, 'rgba(13,21,17,0.92)');
          api.text(g, 'IM TAKT!', W / 2, 162, 16, '#f5d442', 'center');
          api.text(g, 'Tippe L/R im Takt,', W / 2, 184, 8, '#f6e7c8', 'center');
          api.text(g, 'wenn die Spur die', W / 2, 195, 8, '#f6e7c8', 'center');
          api.text(g, 'Linie trifft.', W / 2, 206, 8, '#f6e7c8', 'center');
          if (Math.sin(T * 6) > -0.3) api.text(g, 'TIPPEN = START', W / 2, 232, 8, '#8fe86a', 'center');
        } else if (state === 'trip') {
          rect(0, 60, W, 30, 'rgba(13,21,17,0.8)');
          api.text(g, 'GESTOLPERT!', W / 2, 64, 16, '#ff7a5c', 'center');
          api.text(g, 'Gleich nochmal...', W / 2, 80, 8, '#f6e7c8', 'center');
        } else if (state === 'finish' && finish && finish.broken) {
          const s = Math.min(1, finish.t * 3);
          rect(0, 40, W, 34 * s, 'rgba(13,21,17,0.75)');
          if (s >= 1) {
            api.text(g, 'GESCHAFFT!', W / 2, 44, 16, '#f5d442', 'center');
            api.text(g, 'Beste Serie: ' + best, W / 2, 62, 8, '#f6e7c8', 'center');
          }
        }
      }

      function draw() {
        g.imageSmoothingEnabled = false;
        drawScene();
        drawEva();
        drawParts();
        drawHud();
        drawLane();
        drawOverlay();
      }

      const stopLoop = api.loop(dt => { update(dt); draw(); });

      return function cleanup() {
        stopLoop();
        clearInterval(schedTimer);
        timers.forEach(clearTimeout);
        cv.canvas.removeEventListener('pointerdown', onPointer);
        window.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
        try { if (ac) ac.close(); } catch (e) {}
        ac = null; sched = null;
        cv.destroy();
      };
    }
  };
})();

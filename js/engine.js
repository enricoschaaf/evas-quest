/* Shared engine: audio (music + sfx + mute), pixel sprites, canvas helper, game API.
   Classic script (no modules). Exposes window.Engine and window.GAMES registry. */
(function () {
  'use strict';
  window.GAMES = window.GAMES || {};

  /* ---------------- Palette ---------------- */
  const PAL = {
    bg: '#14201a', dark: '#0d1511', leaf: '#3e7a3a', leafLight: '#6fae4f', leafDark: '#24502a',
    bark: '#5b3a24', barkDark: '#3b2416', soil: '#7a4a2a', autumn: '#d9822b', autumnLight: '#f2b33d',
    red: '#d94c3d', pink: '#f2a7b8', cream: '#f6e7c8', white: '#ffffff', sky: '#8fd3e8', skyDark: '#3a6f8f',
    blue: '#4a7fd9', purple: '#8a5bd9', yellow: '#f5d442', text: '#f6e7c8', gold: '#f5c542'
  };

  /* ---------------- Audio ---------------- */
  const Audio = (function () {
    let ctx = null, master = null, musicGain = null, sfxGain = null;
    let muted = false;
    try { muted = localStorage.getItem('eva-muted') === '1'; } catch (e) {}
    let wantTrack = null, curTrack = null, timer = null, nextTime = 0, step = 0;
    const listeners = [];

    function unlock() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
        musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
        sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
      }
      if (ctx.state === 'suspended' && audible()) ctx.resume();
      if (wantTrack && curTrack !== wantTrack) startTrack(wantTrack);
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
      window.addEventListener(ev, unlock, { passive: true, capture: true }));

    /* Only ONE tab makes sound: the visible tab the user last interacted with.
       Hidden tabs are silent; when another tab claims audio, this one goes quiet. */
    const tabId = Math.random().toString(36).slice(2);
    let owner = true;
    let bc = null; try { bc = new BroadcastChannel('eva-audio'); } catch (e) {}
    const audible = () => owner && document.visibilityState === 'visible';
    function applyAudible() {
      if (!ctx) return;
      if (audible()) { if (ctx.state === 'suspended') ctx.resume(); }
      else if (ctx.state === 'running') ctx.suspend();
    }
    function claim() { owner = true; if (bc) bc.postMessage({ claim: tabId }); applyAudible(); }
    if (bc) bc.onmessage = e => { if (e.data && e.data.claim && e.data.claim !== tabId) { owner = false; applyAudible(); } };
    ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, e => { if (e.isTrusted && document.visibilityState === 'visible') claim(); }, { capture: true }));
    document.addEventListener('visibilitychange', applyAudible);

    function setMuted(m) {
      muted = !!m;
      try { localStorage.setItem('eva-muted', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
      listeners.forEach(f => f(muted));
    }

    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

    function tone(freq, t, dur, type, vol, dest, slideTo) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || sfxGain);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(t, dur, vol, hp, dest) {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vol;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
      s.connect(f); f.connect(g); g.connect(dest || sfxGain); s.start(t);
    }

    const SFX = {
      click: t => tone(880, t, 0.06, 'square', 0.25),
      jump: t => tone(300, t, 0.18, 'square', 0.25, null, 700),
      doublejump: t => { tone(500, t, 0.12, 'square', 0.25, null, 1100); tone(800, t + 0.06, 0.12, 'square', 0.18, null, 1400); },
      flap: t => tone(420, t, 0.09, 'triangle', 0.35, null, 650),
      coin: t => { tone(988, t, 0.08, 'square', 0.2); tone(1319, t + 0.08, 0.2, 'square', 0.2); },
      pour: t => { for (let i = 0; i < 5; i++) tone(500 + i * 90, t + i * 0.05, 0.07, 'sine', 0.25); },
      hit: t => { tone(180, t, 0.25, 'sawtooth', 0.3, null, 60); noise(t, 0.15, 0.25, 400); },
      boom: t => { noise(t, 0.5, 0.5, 120); tone(120, t, 0.4, 'sine', 0.5, null, 40); },
      launch: t => { tone(200, t, 0.3, 'triangle', 0.35, null, 900); noise(t, 0.2, 0.15, 2000); },
      lose: t => { [392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.14, 0.18, 'square', 0.22)); },
      win: t => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.16, 'square', 0.22)); },
      error: t => { tone(160, t, 0.15, 'square', 0.3); tone(150, t + 0.16, 0.2, 'square', 0.3); },
      ding: t => { tone(1568, t, 0.5, 'sine', 0.3); tone(2093, t + 0.02, 0.4, 'sine', 0.15); },
      step: t => tone(120, t, 0.04, 'square', 0.12)
    };
    function sfx(name) {
      if (!ctx || !SFX[name]) return;
      SFX[name](ctx.currentTime + 0.005);
    }

    /* ---- Music: step sequencer. Each track: bpm, steps per beat, lead/bass arrays (midi, 0=rest, -1=hold) ---- */
    const n = s => s.trim().split(/\s+/).map(x => x === '.' ? 0 : x === '-' ? -1 : +x);
    const TRACKS = {
      map: { bpm: 112, spb: 2, leadType: 'square', bassType: 'triangle',
        lead: n(`72 - 76 - 79 - 76 77 | 79 - 81 79 77 76 74 - | 72 - 76 - 79 - 84 - | 83 81 79 77 76 - . . |
                 77 - 81 - 84 - 81 79 | 77 - 76 74 76 77 79 - | 76 74 72 74 76 79 77 76 | 74 - 72 - . . . .`.replace(/\|/g, '')),
        bass: n(`48 . 55 . 48 . 55 . | 53 . 60 . 53 . 60 . | 48 . 55 . 48 . 55 . | 55 . 62 . 55 . 59 . |
                 53 . 60 . 53 . 60 . | 50 . 57 . 50 . 57 . | 48 . 55 . 45 . 52 . | 43 . 50 . 48 . . .`.replace(/\|/g, '')) },
      game: { bpm: 150, spb: 2, leadType: 'square', bassType: 'square',
        lead: n(`76 76 . 76 . 72 76 . | 79 - - . 67 - - . | 72 . . 67 . . 64 . | 69 . 71 . 70 69 . . |
                 67 76 79 81 . 77 79 . | 76 . 72 74 71 . . . | 72 . 74 . 76 . 79 . | 77 76 74 72 . . . .`.replace(/\|/g, '')),
        bass: n(`48 . 48 . 55 . 48 . | 43 . 43 . 50 . 43 . | 48 . 48 . 55 . 48 . | 41 . 43 . 45 . 43 . |
                 48 . 52 . 55 . 52 . | 45 . 48 . 43 . 47 . | 48 . 50 . 52 . 55 . | 43 . 47 . 48 . . .`.replace(/\|/g, '')) },
      tense: { bpm: 132, spb: 2, leadType: 'square', bassType: 'triangle',
        lead: n(`69 . 72 . 76 . 72 . | 69 . 72 . 77 - 76 . | 68 . 71 . 76 . 71 . | 68 . 71 . 74 - 72 . `.replace(/\|/g, '')),
        bass: n(`45 45 . 45 45 . 45 . | 41 41 . 41 41 . 41 . | 40 40 . 40 40 . 40 . | 40 40 . 44 44 . 44 . `.replace(/\|/g, '')) },
      birthday: { bpm: 100, spb: 4, leadType: 'triangle', bassType: 'square',
        // Happy Birthday (public domain), 16th-note grid, 3/4
        lead: n(`. . . . . . . . 67 - - 67 | 69 - - - 67 - - - 72 - - - | 71 - - - - - - - 67 - - 67 |
                 69 - - - 67 - - - 74 - - - | 72 - - - - - - - 67 - - 67 | 79 - - - 76 - - - 72 - - - |
                 71 - - - 69 - - - 77 - - 77 | 76 - - - 72 - - - 74 - - - | 72 - - - - - - - . . . .`.replace(/\|/g, '')),
        bass: n(`. . . . . . . . . . . . | 48 . . . 55 . . . 55 . . . | 43 . . . 50 . . . 50 . . . |
                 43 . . . 50 . . . 50 . . . | 48 . . . 55 . . . 55 . . . | 48 . . . 52 . . . 55 . . . |
                 53 . . . 57 . . . 53 . . . | 48 . . . 55 . . . 43 . . . | 48 . . . 55 . . . 48 . . .`.replace(/\|/g, '')) }
    };

    const T = (bpm, lead, bass, leadType, bassType) => ({ bpm, spb: 2, leadType: leadType || 'square', bassType: bassType || 'triangle',
      lead: n(lead.replace(/\|/g, '')), bass: n(bass.replace(/\|/g, '')) });
    Object.assign(TRACKS, {
      bottles: T(96, '64 . 67 . 72 - 71 . | 69 . 67 . 64 - - . | 65 . 69 . 72 - 74 . | 72 . 71 . 67 - - .',
                     '48 . 55 . 52 . 55 . | 45 . 52 . 48 . 52 . | 41 . 48 . 45 . 48 . | 43 . 50 . 47 . 50 .', 'triangle', 'triangle'),
      flappy: T(160, '72 74 76 . 79 . 76 . | 77 76 74 . 72 . . . | 74 76 77 . 81 . 77 . | 79 77 76 . 74 . 79 .',
                     '48 . 60 . 48 . 60 . | 53 . 65 . 53 . 65 . | 50 . 62 . 50 . 62 . | 55 . 67 . 55 . 59 .'),
      sling: T(120, '67 . 67 72 . 72 74 . | 76 . 74 72 . 71 69 . | 67 . 67 72 . 72 76 . | 74 . 71 67 . 69 71 .',
                    '48 . 43 . 48 . 43 . | 48 . 43 . 45 . 47 . | 48 . 43 . 48 . 43 . | 43 . 47 . 50 . 43 .', 'square', 'square'),
      runner1: T(140, '69 . 72 . 76 . 72 . | 74 . 72 . 69 . . . | 69 . 72 . 76 . 79 . | 77 . 76 . 74 . . .',
                      '45 . 45 . 45 . 45 . | 41 . 41 . 41 . 41 . | 43 . 43 . 43 . 43 . | 40 . 40 . 44 . 44 .'),
      runner2: T(160, '76 . 79 . 84 . 79 . | 81 79 76 . 74 . 76 . | 72 . 76 . 79 . 84 . | 83 81 79 . 77 . 79 .',
                      '48 60 48 60 48 60 48 60 | 45 57 45 57 45 57 45 57 | 41 53 41 53 41 53 41 53 | 43 55 43 55 43 55 47 59', 'square', 'square'),
      runner3: T(180, '81 . 81 84 . 81 79 . | 77 . 77 81 . 77 76 . | 74 . 74 77 . 76 74 . | 73 . 76 . 79 . 81 .',
                      '45 45 57 45 45 57 45 57 | 41 41 53 41 41 53 41 53 | 38 38 50 38 38 50 38 50 | 45 45 57 45 44 56 44 56', 'square', 'square')
    });


    /* Disco (≈120 bpm, 16th grid, four-on-the-floor). drums tokens: k=kick h=hihat c=clap, combinable (e.g. "kc"), "."=none.
       Bars 1-4 funky riff (C Am F G), bars 5-8 quote "Happy Birthday" (public domain). */
    const oct = (r, o) => `${r} . ${o} . ${r} . ${o} ${r} . ${r} ${o} . ${r} . ${o} .`;
    const half = (r1, o1, r2, o2) => `${r1} . ${o1} . ${r1} . ${o1} ${r1} ${r2} . ${o2} . ${r2} . ${o2} .`;
    TRACKS.disco = { bpm: 120, spb: 4, leadType: 'square', bassType: 'sawtooth', bassVol: 0.07, leadVol: 0.12,
      lead: n(`72 . 76 . 79 . 76 72 . 74 76 . 79 - 76 . | 76 . 72 . 69 . 72 76 . 77 76 . 72 - . . |
               77 . 81 . 84 . 81 77 . 79 81 . 77 - 76 . | 74 . 79 . 83 . 79 74 . 76 77 . 79 . 74 71 |
               67 - - 67 69 - - - 67 - - - 72 - - - | 71 - - - - - - - 67 - - 67 69 - - - |
               67 - - - 74 - - - 72 - - - - - . . | 67 - 67 - 79 - - - 76 - - - 72 71 69 . `.replace(/\|/g, '')),
      bass: n([oct(48, 60), oct(45, 57), oct(41, 53), oct(43, 55), oct(48, 60), oct(43, 55), half(43, 55, 48, 60), half(48, 60, 41, 53)].join(' ')),
      drums: Array(8).fill('k . h . kc . h . k . h . kc . h h').join(' ').trim().split(/\s+/) };

    function noteLen(arr, i, total) { let k = 1; while (arr[(i + k) % total] === -1 && k < total) k++; return k; }

    const DRUM = {
      k: t => tone(150, t, 0.16, 'sine', 0.9, musicGain, 42),
      h: t => noise(t, 0.035, 0.22, 7000, musicGain),
      c: t => { noise(t, 0.12, 0.45, 1200, musicGain); noise(t + 0.012, 0.08, 0.3, 1500, musicGain); }
    };
    let beatT0 = 0, beatBpm = 0;

    function startTrack(name) {
      curTrack = name;
      beatBpm = 0;
      if (timer) clearInterval(timer);
      timer = null;
      if (!name || !TRACKS[name] || !ctx) return;
      const tr = TRACKS[name];
      const stepDur = 60 / tr.bpm / tr.spb;
      const total = Math.max(tr.lead.length, tr.bass.length, tr.drums ? tr.drums.length : 0);
      step = 0; nextTime = ctx.currentTime + 0.08;
      beatT0 = nextTime; beatBpm = tr.bpm;
      timer = setInterval(() => {
        while (nextTime < ctx.currentTime + 0.15) {
          const i = step % total;
          const L = tr.lead[i % tr.lead.length], B = tr.bass[i % tr.bass.length];
          if (L > 0) tone(mtof(L), nextTime, stepDur * noteLen(tr.lead, i % tr.lead.length, tr.lead.length) * 0.92, tr.leadType, tr.leadVol || 0.16, musicGain);
          if (B > 0) tone(mtof(B), nextTime, stepDur * noteLen(tr.bass, i % tr.bass.length, tr.bass.length) * 0.9, tr.bassType, tr.bassVol || (tr.bassType === 'square' ? 0.08 : 0.22), musicGain);
          if (tr.drums) { const D = tr.drums[i % tr.drums.length]; if (D && D !== '.') for (const ch of D) if (DRUM[ch]) DRUM[ch](nextTime); }
          nextTime += stepDur; step++;
        }
      }, 25);
    }
    function music(name) {
      wantTrack = name;
      if (ctx && ctx.state !== 'suspended' && curTrack !== name) startTrack(name);
      else if (ctx && curTrack !== name) { if (audible()) ctx.resume(); startTrack(name); }
    }

    return {
      unlock, sfx, music, setMuted,
      isMuted: () => muted,
      toggleMute: () => setMuted(!muted),
      onMute: f => listeners.push(f),
      ready: () => !!ctx && ctx.state === 'running',
      /** Current beat position (float, beats since the track started) of the playing track, or null if no audio clock. */
      beat: () => (ctx && beatBpm && ctx.state === 'running') ? (ctx.currentTime - beatT0) * beatBpm / 60 : null,
      bpm: () => beatBpm
    };
  })();

  /* ---------------- Pixel sprites ---------------- */
  // 12x16 characters. '.' = transparent.
  const CHAR_PAL = {
    eva: { H: '#4a2c1d', h: '#6b4330', S: '#f2c39b', G: '#1d1d1d', J: '#e3bfae', j: '#bf968a', B: '#2f5d4a', b: '#1f4034', P: '#8a8f86', K: '#5a4a42', E: '#1d1d1d' },
    magnus: { H: '#f2c6c9', h: '#d99aa0', S: '#efc19a', G: '#1d1d1d', J: '#1f5a4c', j: '#163f36', B: '#1f5a4c', b: '#163f36', P: '#1e2420', K: '#3a6bd9', E: '#1d1d1d' },
    laurenz: { H: '#d98a3d', h: '#b56a28', S: '#f4c8a4', G: '#1d1d1d', J: '#20262b', j: '#4a86b5', B: '#c06a2a', b: '#8a4a1a', P: '#20262b', K: '#d9d9d9', E: '#1d1d1d' },
    hannah: { H: '#e8a56c', h: '#c47b45', S: '#f4cba8', G: '#141414', J: '#f4f1ea', j: '#1b1b1b', B: '#d23a32', b: '#9a2420', P: '#2a2c33', K: '#3a3a3a', E: '#1d1d1d' },
    enrico: { H: '#d9b46a', h: '#b8914c', S: '#f2c6a0', G: '#1d1d1d', J: '#1b1b1f', j: '#2e2e35', B: '#1b1b1f', b: '#111114', P: '#1b1b1f', K: '#e8e8e8', E: '#3a6fa8' },
    eva_run: { H: '#4a2c1d', h: '#6b4330', S: '#f2c39b', G: '#1d1d1d', R: '#ff3f7a', J: '#ff6b5a', j: '#e04a3a', W: '#ffffff', P: '#1d1d24', K: '#3fe07a', k: '#ffffff', E: '#1d1d1d' },
    niklas: { H: '#6a4126', h: '#4a2c18', S: '#f0c39c', G: '#1d1d1d', J: '#b9c7d6', j: '#93a4b8', B: '#9fb0c3', b: '#7d8ea3', P: '#2f7fe6', K: '#f2d23a', k: '#1b1b1b', E: '#1d1d1d' }
  };
  const HEAD = {
    eva: [
      '....HHHH....',
      '...HHhHHH...',
      '..HHHSSSSH..',
      '..HHGSGSGG..',
      '..HHSSSSSS..',
      '..HHHSSSS...',
      '..HHH.SS....'],
    magnus: [
      '...HHHHH....',
      '..HHHHHHHHH.',
      '...SSSSSS...',
      '...SESSES...',
      '...SSSSSS...',
      '....SSSS....',
      '.....SS.....'],
    laurenz: [
      '..H.HhH.H...',
      '.HHHHHHHHH..',
      '.HHSSSSSSH..',
      '..HSESSES...',
      '..HSSSSSS...',
      '...SSjjSS...',
      '.....SS.....'],
    hannah: [
      '...HHHHHH...',
      '..HHhHHhHH..',
      '.HHSSSSSSHH.',
      '.HHGGSSGGHh.',
      '.hHSSSSSSHH.',
      '.HHHSSSSHHh.',
      '.hHH.SS.HH..'],
    niklas: [
      '....HHHH....',
      '...HHhHHH...',
      '..HHHSSSSH..',
      '..HSESSES...',
      '...SSSSSS...',
      '....SSSS....',
      '.....SS.....']
  };
  HEAD.eva_run = [
      '....HHHH....',
      '...RRRRRR...',
      '..HHHSSSSH..',
      '..HHGSGSGG..',
      '..HHSSSSSS..',
      '..HHHSSSS...',
      '..HH..SS....'];
  const BODIES_RUN = [
      '...JJJJJ....',
      '..SJWJJJJ...',
      '..SJJjJJS...',
      '...JJJJJ....',
      '...PPPPP....'];
  HEAD.enrico = [
      '....HHHH....',
      '...HHHHHH...',
      '...HSSSSH...',
      '...SESSES...',
      '...SSSSSS...',
      '....SSSS....',
      '.....SS.....'];
  const BODIES = {
    hannah: [
      '.hBBjjjjjH..',
      '..BBJJJJJJ..',
      '..BBjjjjjS..',
      '..bbJJJJJ...',
      '...jjjjjj...'],
    niklas: [
      '..BBJJJJJ...',
      '..BBJjJJjJ..',
      '..BBJJjJJS..',
      '..bbjJJjJ...',
      '...JJJJJJ...']
  };
  const BODY = [
    '..BBJJJJJ...',
    '..BBJJJJJJ..',
    '..BBJJjJJS..',
    '..bbJJJJJ...',
    '...JJJJJJ...'];
  const LEGS = {
    idle: ['....PPPP....', '....PP.PP...', '....PP.PP...', '...KKK.KKK..'],
    run1: ['....PPPP....', '...PP..PP...', '..PP....PP..', '..KK....KK..'],
    run2: ['....PPPP....', '....PPPP....', '....PP.PP...', '....KK.KK...'],
    jump: ['....PPPP....', '...PPPPPP...', '...KK..KK...', '............']
  };
  const LEGS_BY = {
    eva_run: {
      idle: ['....PPPP....', '....SS.SS...', '....SS.SS...', '...KKK.KKK..'],
      run1: ['....PPPP....', '...SS..SS...', '..SS....SS..', '..KK....KK..'],
      run2: ['....PPPP....', '....SSSS....', '....SS.SS...', '....KK.KK...'],
      jump: ['....PPPP....', '...SSSSSS...', '...KK..KK...', '............']
    }
  };
  const spriteCache = {};
  function charSprite(who, frame) {
    const key = who + ':' + frame;
    if (spriteCache[key]) return spriteCache[key];
    const pal = CHAR_PAL[who] || CHAR_PAL.eva;
    const legs = (LEGS_BY[who] && LEGS_BY[who][frame]) || LEGS[frame] || LEGS.idle;
    const rows = [].concat(HEAD[who] || HEAD.eva, (who === 'eva_run' ? BODIES_RUN : BODIES[who]) || BODY, legs);
    const c = document.createElement('canvas'); c.width = 12; c.height = 16;
    const g = c.getContext('2d');
    rows.forEach((r, y) => { for (let x = 0; x < 12; x++) { const ch = r[x]; if (ch && ch !== '.' && pal[ch]) { g.fillStyle = (ch === 'K' && pal.k && x % 2) ? pal.k : pal[ch]; g.fillRect(x, y, 1, 1); } } });
    spriteCache[key] = c;
    return c;
  }
  /** Draw a 12x16 pixel character. who: 'eva'|'magnus'|'laurenz'|'hannah'|'enrico'|'niklas'. frame: 'idle'|'run1'|'run2'|'jump'.
      (x,y) = top-left in the target ctx's coordinates; scale = pixels per sprite pixel; flip = face left. */
  function drawChar(ctx, who, frame, x, y, scale, flip) {
    const s = charSprite(who, frame);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) { ctx.translate(x + 12 * scale, y); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0, 12 * scale, 16 * scale); }
    else ctx.drawImage(s, x, y, 12 * scale, 16 * scale);
    ctx.restore();
  }
  /** Draw a small pixel-art from string rows + palette map. Returns nothing. */
  function drawPixels(ctx, rows, pal, x, y, scale) {
    rows.forEach((r, yy) => { for (let xx = 0; xx < r.length; xx++) { const c = pal[r[xx]]; if (c) { ctx.fillStyle = c; ctx.fillRect(x + xx * scale, y + yy * scale, scale, scale); } } });
  }

  /* ---------------- Canvas helper ---------------- */
  /** Creates a pixelated canvas with a fixed internal resolution (w x h), scaled to fit `root` (contain, centered).
      Returns { canvas, ctx, w, h, pointer(evt) -> {x,y} in internal coords, destroy() } */
  function makeCanvas(root, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.className = 'game-canvas';
    canvas.style.cssText = 'position:absolute;image-rendering:pixelated;image-rendering:crisp-edges;touch-action:none;';
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    function fit() {
      const rw = root.clientWidth, rh = root.clientHeight;
      const s = Math.min(rw / w, rh / h);
      const cw = Math.floor(w * s), ch = Math.floor(h * s);
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      canvas.style.left = Math.floor((rw - cw) / 2) + 'px'; canvas.style.top = Math.floor((rh - ch) / 2) + 'px';
    }
    fit();
    const ro = new ResizeObserver(fit); ro.observe(root);
    function pointer(e) {
      const r = canvas.getBoundingClientRect();
      const p = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) || e;
      return { x: (p.clientX - r.left) * w / r.width, y: (p.clientY - r.top) * h / r.height };
    }
    return { canvas, ctx, w, h, pointer, destroy() { ro.disconnect(); canvas.remove(); } };
  }

  /** Pixel text helper on canvas (uses the page pixel font). */
  function text(ctx, str, x, y, size, color, align, shadow) {
    ctx.save();
    ctx.font = (size || 8) + 'px "Press Start 2P", monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
    if (shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(str, x + 1, y + 1); }
    ctx.fillStyle = color || PAL.text; ctx.fillText(str, x, y);
    ctx.restore();
  }

  /** Simple game loop with fixed-ish dt (seconds, clamped). Returns stop(). */
  function loop(fn) {
    let raf = 0, last = performance.now(), alive = true;
    function f(t) { if (!alive) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt, t / 1000); raf = requestAnimationFrame(f); }
    raf = requestAnimationFrame(f);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, ms) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms || 1800);
  }

  /** Build the API object handed to a game's start(root, api). onWin is called exactly once. */
  function makeApi(onWin) {
    let won = false;
    return {
      win() { if (won) return; won = true; Audio.sfx('win'); setTimeout(onWin, 900); },
      sfx: Audio.sfx, music: Audio.music, isMuted: Audio.isMuted,
      makeCanvas, drawChar, drawPixels, text, loop, toast, PAL
    };
  }

  window.Engine = { Audio, PAL, drawChar, drawPixels, makeCanvas, text, loop, toast, makeApi };
})();

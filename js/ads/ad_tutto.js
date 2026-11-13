/* Playable ad: "ZOCK & ROLL™" – push-your-luck card & dice. Reach 1000 points or roll one TUTTO to skip the ad (gently rigged). */
(function () {
  'use strict';

  const CSS = `
  .att{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
    padding:6px 8px 8px;box-sizing:border-box;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;
    background:radial-gradient(ellipse at 50% 30%,#7a2f8a 0%,#4a1a63 55%,#220b33 100%);color:#fff;font-family:'VT323',monospace}
  .att *{box-sizing:border-box}
  .att-px{font-family:'Press Start 2P',monospace}
  .att-z{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;align-items:center}
  .att-top{width:100%;display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:8px}
  .att-pill{background:rgba(0,0,0,.45);border:2px solid #f5c542;border-radius:4px;padding:4px 5px;white-space:nowrap}
  .att-stars{color:#f5c542}
  .att-logo{font-size:10px;color:#fff200;text-shadow:2px 2px 0 #e8202a,3px 3px 0 #000;white-space:nowrap}
  .att-mid{width:100%;display:flex;gap:10px;align-items:center;justify-content:center}
  .att-card{width:58px;height:80px;flex:0 0 auto;perspective:400px;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .att-in{position:relative;width:100%;height:100%;transition:transform .55s cubic-bezier(.3,1.5,.5,1);transform-style:preserve-3d}
  .att-card.flip .att-in{transform:rotateY(180deg)}
  .att-card.wob{animation:attWob 1s ease-in-out infinite}
  @keyframes attWob{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg) scale(1.06)}}
  .att-f{position:absolute;inset:0;border-radius:6px;border:3px solid #2a1a10;backface-visibility:hidden;-webkit-backface-visibility:hidden;
    display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 4px 0 rgba(0,0,0,.5)}
  .att-back{background:repeating-linear-gradient(45deg,#e8202a 0 6px,#b3121b 6px 12px);font:20px 'Press Start 2P',monospace;color:#fff200;text-shadow:2px 2px 0 #000}
  .att-front{transform:rotateY(180deg);background:#fff6d0;color:#2a1a10;font:8px 'Press Start 2P',monospace;line-height:1.4;padding:3px}
  .att-front b{font-size:15px;display:block;margin:3px 0}
  .att-front.k-bonus b{color:#c77d00}.att-front.k-x2 b{color:#c7281f}.att-front.k-klee b{color:#1f8a3a}
  .att-info{flex:1 1 auto;max-width:210px;font-size:8px;line-height:1.7}
  .att-info .big{font-size:12px;color:#f5d442;text-shadow:2px 2px 0 #000}
  .att-bar{height:10px;border:2px solid #000;background:#2a1030;margin-top:3px;border-radius:2px;overflow:hidden}
  .att-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#f5b52a,#fff200);transition:width .4s}
  .att-msg{font-size:10px;text-align:center;min-height:2.8em;line-height:1.4;text-shadow:2px 2px 0 #000;padding:0 2px;display:flex;align-items:center;justify-content:center}
  .att-row{display:flex;gap:5px;justify-content:center;width:100%;padding-top:6px;min-height:70px}
  .att-die{position:relative;flex:0 1 54px;aspect-ratio:1;align-self:flex-start;padding:0;border:0;background:none;cursor:pointer;transition:transform .12s,opacity .2s;-webkit-tap-highlight-color:transparent}
  .att-die canvas{width:100%;height:100%;image-rendering:pixelated;display:block;filter:drop-shadow(0 3px 0 rgba(0,0,0,.5))}
  .att-die.sel{transform:translateY(-6px)}
  .att-die.sel::after{content:'✓';position:absolute;left:50%;bottom:-15px;transform:translateX(-50%);font:8px 'Press Start 2P',monospace;color:#f5d442;text-shadow:1px 1px 0 #000}
  .att-die.aside{opacity:.35;transform:scale(.78) translateY(10px);cursor:default}
  .att-die.hide{visibility:hidden}
  .att-die.roll{animation:attShake .09s linear infinite}
  .att-die.land{animation:attLand .25s ease-out}
  @keyframes attShake{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(-3px,-4px) rotate(-12deg)}50%{transform:translate(2px,-7px) rotate(8deg)}75%{transform:translate(3px,-2px) rotate(-6deg)}100%{transform:translate(0,0) rotate(0)}}
  @keyframes attLand{0%{transform:scale(1.25)}60%{transform:scale(.92)}100%{transform:scale(1)}}
  .att-btns{display:flex;gap:6px;width:100%;justify-content:center}
  .att-btn{font-family:'Press Start 2P',monospace;font-size:11px;line-height:1.35;color:#3b1d00;background:linear-gradient(#ffe27a,#f5b52a);border:0;border-radius:10px;
    padding:12px 8px;box-shadow:0 5px 0 #a8620a,0 8px 14px rgba(0,0,0,.4);cursor:pointer;flex:1 1 0;max-width:220px;min-height:48px;-webkit-tap-highlight-color:transparent}
  .att-btn.go{animation:attPulse 1s ease-in-out infinite}
  .att-btn.safe{background:linear-gradient(#9ff0a8,#3fbf5a);box-shadow:0 5px 0 #1e7a33,0 8px 14px rgba(0,0,0,.4);color:#05300f}
  .att-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #a8620a}
  .att-btn:disabled{filter:grayscale(.8) brightness(.7);animation:none;cursor:default}
  .att-btn small{display:block;font-size:7px;margin-top:4px;opacity:.85}
  @keyframes attPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  .att-fine{font-size:8px;color:#ffd6f5;opacity:.85;margin-top:6px;text-align:center}
  .att-fine s{opacity:.7}
  .att-hand{position:absolute;z-index:5;pointer-events:none;font-size:28px;line-height:1;transition:left .3s,top .3s;animation:attPoint .7s ease-in-out infinite;text-align:center}
  .att-hand span{display:block;font:7px 'Press Start 2P',monospace;background:#e8202a;color:#fff;padding:3px 4px;border-radius:3px;white-space:nowrap;margin-top:2px}
  @keyframes attPoint{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-8px)}}
  .att-float{position:absolute;z-index:6;pointer-events:none;font:13px 'Press Start 2P',monospace;color:#f5d442;text-shadow:2px 2px 0 #b3261e,4px 4px 0 #000;
    transform:translateX(-50%);white-space:nowrap;animation:attFloat 1.1s ease-out forwards}
  .att-float.neg{color:#ff8a8a;text-shadow:2px 2px 0 #3a0000,4px 4px 0 #000}
  @keyframes attFloat{0%{opacity:0;margin-top:10px;transform:translateX(-50%) scale(.6)}20%{opacity:1;transform:translateX(-50%) scale(1.15)}100%{opacity:0;margin-top:-50px;transform:translateX(-50%) scale(1)}}
  .att-banner{position:absolute;z-index:8;left:50%;top:42%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;
    font:24px 'Press Start 2P',monospace;line-height:1.3;color:#fff200;text-shadow:3px 3px 0 #e8202a,6px 6px 0 #000;animation:attBanner .6s cubic-bezier(.2,1.6,.4,1) forwards;white-space:nowrap}
  .att-banner small{display:block;font-size:9px;color:#fff;text-shadow:2px 2px 0 #000;margin-top:8px}
  .att-banner.sad{color:#9fc4ff;text-shadow:3px 3px 0 #1b2a6b,6px 6px 0 #000;animation:attSad 1.3s ease-out forwards}
  @keyframes attBanner{0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(-4deg)}}
  @keyframes attSad{0%{transform:translate(-50%,-50%) scale(1.6);opacity:0}20%{transform:translate(-50%,-50%) scale(1);opacity:1}70%{transform:translate(-50%,-40%) rotate(6deg)}100%{transform:translate(-50%,-20%) rotate(10deg);opacity:0}}
  .att-rays{position:absolute;inset:-50%;z-index:1;pointer-events:none;opacity:.35;
    background:repeating-conic-gradient(from 0deg,#fff200 0 10deg,transparent 10deg 20deg);animation:attSpin 4s linear infinite}
  @keyframes attSpin{to{transform:rotate(360deg)}}
  .att-coin{position:absolute;top:-30px;z-index:7;pointer-events:none;font-size:22px;animation:attFall linear forwards}
  @keyframes attFall{to{transform:translateY(calc(var(--h) + 60px)) rotate(720deg)}}
  .att-shake{animation:attScr .35s linear}
  @keyframes attScr{0%,100%{transform:translate(0,0)}20%{transform:translate(-6px,2px)}40%{transform:translate(5px,-3px)}60%{transform:translate(-4px,3px)}80%{transform:translate(3px,-1px)}}
  `;

  // 14x14 pixel die (same style as the sibling ad)
  const PIPS = { 1: [[6, 6]], 2: [[3, 3], [9, 9]], 3: [[3, 3], [6, 6], [9, 9]], 4: [[3, 3], [9, 3], [3, 9], [9, 9]],
    5: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]], 6: [[3, 3], [9, 3], [3, 6], [9, 6], [3, 9], [9, 9]] };
  function drawDie(cv, v, sel, blur) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 14, 14);
    c.fillStyle = sel ? '#f5c542' : '#2a1a10'; c.fillRect(1, 0, 12, 14); c.fillRect(0, 1, 14, 12);
    c.fillStyle = sel ? '#fff6d0' : '#f6efe0'; c.fillRect(1, 1, 12, 12);
    c.fillStyle = sel ? '#f0d890' : '#d9cdb4'; c.fillRect(1, 11, 12, 2); c.fillRect(11, 1, 2, 12);
    c.fillStyle = '#ffffff'; c.fillRect(2, 2, 3, 1); c.fillRect(2, 2, 1, 3);
    c.fillStyle = blur ? '#7a5a5a' : (v === 1 || v === 5 ? '#c7281f' : '#1c1410');
    for (const [x, y] of PIPS[v]) c.fillRect(x, y, 2, 2);
  }

  // Score a set of dice. Every die must count, otherwise invalid.
  function scoreSet(vals) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    vals.forEach(v => c[v]++);
    let pts = 0, ok = vals.length > 0;
    for (let v = 1; v <= 6; v++) {
      const t = Math.floor(c[v] / 3), r = c[v] % 3;
      pts += t * (v === 1 ? 1000 : v * 100);
      if (v === 1) pts += r * 100;
      else if (v === 5) pts += r * 50;
      else if (r) ok = false;
    }
    return { pts, ok };
  }
  // Indices (into `idx`) of the dice that can score in a roll
  function scoringIdx(vals, idx) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    idx.forEach(i => c[vals[i]]++);
    const out = [];
    for (let v = 1; v <= 6; v++) {
      let n = (v === 1 || v === 5) ? c[v] : Math.floor(c[v] / 3) * 3;
      for (const i of idx) if (n > 0 && vals[i] === v) { out.push(i); n--; }
    }
    return out;
  }

  const CARDS = [
    { k: 'bonus', top: 'BONUS', big: '+300', sub: 'bei TUTTO' },
    { k: 'x2', top: 'DOPPELT', big: 'x2', sub: 'bei TUTTO' },
    { k: 'klee', top: 'KLEE-<br>BLATT', big: '🍀', sub: 'TUTTO =<br>SIEG!' },
  ];
  const GOAL = 1000;
  const rnd = n => Math.floor(Math.random() * n);

  GAMES['ad_tutto'] = {
    title: 'ZOCK & ROLL™',
    intro: 'Zieh eine Karte, würfle und leg Punkte-Würfel (1er, 5er, Dreier) zur Seite. 1000 Punkte oder ein TUTTO gewinnt!',
    start(root, api) {
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const iv = new Set();

      const wrap = document.createElement('div');
      wrap.className = 'att';
      wrap.innerHTML = `<style>${CSS}</style>
        <div class="att-z">
          <div class="att-top att-px">
            <span class="att-pill">LVL 1/∞</span>
            <span class="att-logo">ZOCK &amp; ROLL™</span>
            <span class="att-pill">4.8 <span class="att-stars">★★★★★</span></span>
          </div>
        </div>
        <div class="att-z"><div class="att-mid">
          <div class="att-card" id="attCard"><div class="att-in"><div class="att-f att-back">?</div><div class="att-f att-front" id="attFront"></div></div></div>
          <div class="att-info att-px">
            <div>ZUG <span id="attTurn">1</span> · DIESE RUNDE:</div>
            <div class="big" id="attPot">0</div>
            <div>GESAMT <span id="attTot">0</span>/${GOAL}</div>
            <div class="att-bar"><i id="attBar"></i></div>
          </div>
        </div></div>
        <div class="att-z"><div class="att-msg att-px" id="attMsg">Zieh eine Glückskarte!</div></div>
        <div class="att-z"><div class="att-row" id="attRow"></div></div>
        <div class="att-z">
          <div class="att-btns">
            <button class="att-btn go" id="attA">KARTE<br>ZIEHEN</button>
            <button class="att-btn safe" id="attB" style="display:none">PUNKTE<br>SICHERN</button>
          </div>
          <div class="att-fine att-px">Nur heute: <s>0 €</s> statt 0 €!</div>
        </div>`;
      root.appendChild(wrap);

      const $ = id => wrap.querySelector('#' + id);
      const card = $('attCard'), front = $('attFront'), msgEl = $('attMsg'), row = $('attRow');
      const btnA = $('attA'), btnB = $('attB');
      const potEl = $('attPot'), totEl = $('attTot'), barEl = $('attBar'), turnEl = $('attTurn');

      // state
      const dice = [1, 2, 3, 4, 5, 6];
      const aside = [false, false, false, false, false, false];
      const sel = [false, false, false, false, false, false];
      let phase = 'draw'; // draw | roll | rolling | pick | busy | won
      let curCard = null, total = 0, pot = 0, turn = 1, nieten = 0, firstRoll = true, rolledOnce = false;

      const els = dice.map((v, i) => {
        const b = document.createElement('button');
        b.className = 'att-die hide';
        b.setAttribute('aria-label', 'Würfel ' + (i + 1));
        const cv = document.createElement('canvas'); cv.width = 14; cv.height = 14;
        b.appendChild(cv); row.appendChild(b);
        b.addEventListener('pointerdown', e => { e.preventDefault(); toggle(i); });
        return { b, cv };
      });
      const render = (i, blur) => {
        drawDie(els[i].cv, dice[i], sel[i], blur);
        els[i].b.classList.toggle('sel', sel[i]);
        els[i].b.classList.toggle('aside', aside[i]);
      };

      const hand = document.createElement('div');
      hand.className = 'att-hand';
      hand.innerHTML = '👆<span>Tippe hier!</span>';
      wrap.appendChild(hand);

      const setMsg = s => { msgEl.innerHTML = s; };
      const free = () => dice.map((_, i) => i).filter(i => !aside[i]);
      const selIdx = () => dice.map((_, i) => i).filter(i => sel[i]);
      const selScore = () => scoreSet(selIdx().map(i => dice[i]));
      const relPos = el => { const w = wrap.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - w.left + r.width / 2, y: r.top - w.top, r }; };
      const nudge = () => nieten >= 2 || turn >= 4 || (curCard && curCard.k === 'klee');

      function updHud() {
        potEl.textContent = pot + (phase === 'pick' && selScore().ok ? ' +' + selScore().pts : '');
        totEl.textContent = total;
        turnEl.textContent = turn;
        barEl.style.width = Math.min(100, total / GOAL * 100) + '%';
      }

      function floatText(str, x, y, neg) {
        const f = document.createElement('div');
        f.className = 'att-float' + (neg ? ' neg' : ''); f.textContent = str;
        f.style.left = x + 'px'; f.style.top = y + 'px';
        wrap.appendChild(f); later(() => f.remove(), 1150);
      }
      function banner(html, cls, ms) {
        const b = document.createElement('div');
        b.className = 'att-banner' + (cls ? ' ' + cls : ''); b.innerHTML = html;
        wrap.appendChild(b); later(() => b.remove(), ms);
        return b;
      }
      function coinRain(n) {
        const H = wrap.clientHeight;
        for (let k = 0; k < n; k++) later(() => {
          const c = document.createElement('div'); c.className = 'att-coin';
          c.textContent = Math.random() < 0.75 ? '🪙' : (Math.random() < 0.5 ? '💰' : '💎');
          c.style.left = (Math.random() * 95) + '%'; c.style.setProperty('--h', H + 'px');
          c.style.animationDuration = (0.9 + Math.random() * 0.9) + 's';
          wrap.appendChild(c); later(() => c.remove(), 2000);
          if (k % 4 === 0) api.sfx('coin');
        }, k * 45);
      }

      function setButtons() {
        btnA.classList.add('go');
        if (phase === 'draw') {
          btnA.innerHTML = 'KARTE<br>ZIEHEN'; btnA.disabled = false; btnB.style.display = 'none';
        } else if (phase === 'roll') {
          btnA.innerHTML = 'WÜRFELN!<small>6 Würfel</small>'; btnA.disabled = false; btnB.style.display = 'none';
        } else if (phase === 'pick') {
          const s = selScore(), allSel = s.ok && selIdx().length === free().length;
          const rest = free().length - selIdx().length;
          btnA.innerHTML = allSel ? 'TUTTO!!!<small>alle 6 geschafft</small>' : 'WEITER<br>WÜRFELN<small>mit ' + rest + ' Würfel' + (rest === 1 ? '' : 'n') + '</small>';
          btnA.disabled = !s.ok;
          btnB.style.display = allSel ? 'none' : '';
          const klee = curCard && curCard.k === 'klee';
          btnB.disabled = !s.ok || klee;
          btnB.innerHTML = klee ? '🍀 NUR<br>TUTTO ZÄHLT' : 'PUNKTE<br>SICHERN<small>' + (s.ok ? '+' + (pot + s.pts) : '–') + '</small>';
        } else {
          btnA.disabled = true; btnB.disabled = true; btnA.classList.remove('go');
        }
      }

      function placeHand() {
        if (phase === 'busy' || phase === 'rolling' || phase === 'won') { hand.style.display = 'none'; return; }
        hand.style.display = '';
        let target = btnA, under = false;
        if (phase === 'draw') { target = card; under = true; }
        else if (phase === 'pick') {
          const best = scoringIdx(dice, free());
          const next = best.find(i => !sel[i]);
          const s = selScore();
          if (!s.ok || next !== undefined && selIdx().length === 0) { if (next !== undefined) { target = els[next].b; under = true; } }
          else if (s.ok && total + pot + s.pts >= GOAL && !(curCard && curCard.k === 'klee')) target = btnB;
          else if (next !== undefined && (nudge() || free().length - selIdx().length <= 2)) { target = els[next].b; under = true; }
        }
        const { x, y, r } = relPos(target);
        hand.style.left = (under ? x : x + r.width / 2 - 20) + 'px';
        hand.style.top = (under ? y + r.height + 4 : y + r.height / 2 - 10) + 'px';
      }

      function refresh() { setButtons(); updHud(); placeHand(); }

      /* ---------- turn flow ---------- */
      function drawCard() {
        if (phase !== 'draw') return;
        phase = 'busy'; refresh();
        // Lucky clover after two busts makes the TUTTO-nudge feel "earned"
        curCard = nieten >= 2 ? CARDS[2] : CARDS[rnd(2)];
        front.className = 'att-f att-front k-' + curCard.k;
        front.innerHTML = curCard.top + '<b>' + curCard.big + '</b>' + curCard.sub;
        card.classList.remove('wob'); card.classList.add('flip');
        api.sfx('flap');
        later(() => {
          api.sfx('ding');
          const p = relPos(card);
          floatText(curCard.k === 'klee' ? 'GLÜCK!' : curCard.big, p.x, p.y - 4);
          setMsg(curCard.k === 'bonus' ? 'TUTTO bringt +300 extra!' : curCard.k === 'x2' ? 'TUTTO verdoppelt die Runde!' : '🍀 Ein TUTTO = SOFORT-SIEG!');
          phase = 'roll'; refresh();
        }, 560);
      }

      function rollValues(n) {
        let v = Array.from({ length: n }, () => 1 + rnd(6));
        if (nudge()) {
          // every die scores → each roll leads straight towards TUTTO
          v = Array.from({ length: n }, () => (Math.random() < 0.55 ? 1 : 5));
          if (n >= 3 && Math.random() < 0.4) { const t = 2 + rnd(5); v[0] = v[1] = v[2] = t; }
          v.sort(() => Math.random() - 0.5);
        } else if (!v.some(x => x === 1 || x === 5) && (firstRoll || Math.random() < 0.35)) {
          v[rnd(n)] = Math.random() < 0.5 ? 1 : 5;
        }
        return v;
      }

      function roll() {
        if (phase !== 'roll') return;
        phase = 'rolling';
        const idx = free();
        const vals = rollValues(idx.length);
        firstRoll = false;
        sel.fill(false);
        refresh(); setMsg('🎲 🎲 🎲');
        idx.forEach(i => { els[i].b.classList.remove('hide'); els[i].b.classList.add('roll'); });
        api.sfx('pour');
        const flick = setInterval(() => {
          idx.forEach(i => { if (els[i].b.classList.contains('roll')) { dice[i] = 1 + rnd(6); render(i, true); } });
        }, 70);
        iv.add(flick);
        idx.forEach((i, n) => later(() => {
          els[i].b.classList.remove('roll');
          dice[i] = vals[n]; render(i);
          els[i].b.classList.remove('land'); void els[i].b.offsetWidth; els[i].b.classList.add('land');
          api.sfx('click');
        }, 450 + n * 90));
        later(() => { clearInterval(flick); iv.delete(flick); afterRoll(); }, 500 + idx.length * 90);
      }

      function afterRoll() {
        rolledOnce = true;
        const best = scoringIdx(dice, free());
        if (!best.length) return niete();
        phase = 'pick';
        setMsg(selIdx().length ? '' : 'Tippe Punkte-Würfel an!<br><span style="color:#f5d442">1er=100 · 5er=50 · Dreier</span>');
        refresh();
      }

      function toggle(i) {
        if (phase !== 'pick' || aside[i]) {
          if (phase === 'roll' || phase === 'draw') { api.sfx('error'); setMsg(phase === 'draw' ? 'Erst eine KARTE ziehen! 👇' : 'Erst WÜRFELN! 👇'); }
          return;
        }
        const before = selScore();
        sel[i] = !sel[i]; render(i);
        const s = selScore();
        if (s.ok) {
          api.sfx(sel[i] ? 'coin' : 'click');
          if (sel[i] && s.pts > before.pts) { const p = relPos(els[i].b); floatText('+' + (s.pts - (before.ok ? before.pts : 0)), p.x, p.y - 8); }
          const allSel = selIdx().length === free().length;
          setMsg(allSel ? 'ALLE WÜRFEL! Hol dir das TUTTO!!! 🔥' : 'Super! Weiter zocken oder sichern?');
        } else if (selIdx().length) {
          api.sfx('error');
          setMsg(dice[i] === 1 || dice[i] === 5 ? 'Hmm, so zählt das nicht…' : 'Eine ' + dice[i] + ' zählt nur als DREIER!');
        } else {
          api.sfx('click'); setMsg('Tippe Punkte-Würfel an!');
        }
        refresh();
      }

      function continueRoll() {
        if (phase !== 'pick') return;
        const s = selScore(); if (!s.ok) return;
        pot += s.pts;
        selIdx().forEach(i => { aside[i] = true; sel[i] = false; render(i); });
        if (free().length === 0) return tutto();
        phase = 'roll'; setMsg('Noch ' + free().length + ' Würfel – trau dich!');
        refresh();
        later(roll, 120);
      }

      function bank() {
        if (phase !== 'pick' || (curCard && curCard.k === 'klee')) return;
        const s = selScore(); if (!s.ok) return;
        pot += s.pts;
        total += pot;
        const p = relPos(totEl);
        floatText('+' + pot, p.x, p.y - 6);
        api.sfx('coin');
        pot = 0;
        phase = 'busy'; refresh();
        if (total >= GOAL) return winSeq(total + ' PUNKTE!!!');
        setMsg('Gesichert! 💰 Nächster Zug…');
        later(nextTurn, 900);
      }

      function niete() {
        phase = 'busy'; refresh();
        nieten++;
        if (pot) { const p = relPos(potEl); floatText('-' + pot, p.x, p.y, true); }
        pot = 0;
        banner('NIETE!<small>😭 Rundenpunkte weg…</small>', 'sad', 1400);
        api.sfx('lose'); later(() => api.sfx('hit'), 250);
        wrap.classList.remove('att-shake'); void wrap.offsetWidth; wrap.classList.add('att-shake');
        setMsg(nieten >= 2 ? 'Psst… die nächste Karte ist eine GLÜCKSKARTE 🍀' : 'Pech! Neuer Zug…');
        updHud();
        later(nextTurn, 1500);
      }

      function nextTurn() {
        turn++;
        aside.fill(false); sel.fill(false);
        els.forEach((e, i) => { e.b.classList.add('hide'); render(i); });
        card.classList.remove('flip'); card.classList.add('wob');
        curCard = null; firstRoll = true;
        phase = 'draw';
        setMsg('Zug ' + turn + ': Zieh eine Karte!');
        later(refresh, 300); refresh();
      }

      function tutto() {
        phase = 'busy'; refresh();
        let bonusTxt = '';
        if (curCard.k === 'bonus') { pot += 300; bonusTxt = '+300 BONUS'; }
        else if (curCard.k === 'x2') { pot *= 2; bonusTxt = 'PUNKTE x2'; }
        else { pot += 1000; bonusTxt = '🍀 SOFORT-SIEG'; }
        total += pot; pot = 0;
        els.forEach((e, i) => { aside[i] = false; render(i); e.b.classList.remove('land'); void e.b.offsetWidth; e.b.classList.add('land'); });
        winSeq('TUTTO!!!<small>' + bonusTxt + '</small>');
      }

      function winSeq(html) {
        phase = 'won'; refresh();
        updHud();
        const rays = document.createElement('div'); rays.className = 'att-rays'; wrap.insertBefore(rays, wrap.children[1]);
        banner(html, '', 99999);
        setMsg('🎉 WERBUNG BESIEGT 🎉');
        api.sfx('boom'); later(() => api.sfx('ding'), 200);
        coinRain(32);
        later(() => api.win(), 1900);
      }

      /* ---------- input ---------- */
      const onA = () => { if (phase === 'draw') drawCard(); else if (phase === 'roll') roll(); else if (phase === 'pick') continueRoll(); };
      btnA.addEventListener('click', e => { e.preventDefault(); api.sfx('click'); onA(); });
      btnB.addEventListener('click', e => { e.preventDefault(); bank(); });
      card.addEventListener('pointerdown', e => { e.preventDefault(); drawCard(); });
      const onKey = e => {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); onA(); return; }
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); bank(); return; }
        const n = '123456'.indexOf(e.key);
        if (n >= 0) { e.preventDefault(); toggle(n); }
      };
      window.addEventListener('keydown', onKey);
      const onResize = () => placeHand();
      window.addEventListener('resize', onResize);

      card.classList.add('wob');
      dice.forEach((_, i) => render(i));
      refresh();
      later(placeHand, 60);

      return function cleanup() {
        phase = 'won';
        timers.forEach(clearTimeout); timers.clear();
        iv.forEach(clearInterval); iv.clear();
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        wrap.remove();
      };
    }
  };
})();

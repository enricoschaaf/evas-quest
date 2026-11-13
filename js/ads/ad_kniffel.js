/* Playable ad: "KNIFFLIG™ – Das Würfelspiel". Roll a five-of-a-kind to skip the ad (rigged, like every mobile ad). */
(function () {
  'use strict';

  const CSS = `
  .akn{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
    padding:8px 8px 12px;box-sizing:border-box;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;
    background:radial-gradient(ellipse at 50% 35%,#2f7a3e 0%,#1d5229 55%,#0f2e17 100%);color:#fff;font-family:'VT323',monospace}
  .akn *{box-sizing:border-box}
  .akn-px{font-family:'Press Start 2P',monospace}
  .akn-top{width:100%;display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:9px}
  .akn-pill{background:rgba(0,0,0,.45);border:2px solid #f5c542;border-radius:4px;padding:4px 6px;white-space:nowrap}
  .akn-stars{color:#f5c542}
  .akn-score{font-size:10px;color:#f5d442;text-shadow:2px 2px 0 #000}
  .akn-msg{font-size:12px;text-align:center;min-height:2.6em;line-height:1.35;text-shadow:2px 2px 0 #000;padding:0 4px;display:flex;align-items:center}
  .akn-row{display:flex;gap:6px;justify-content:center;width:100%}
  .akn-die{position:relative;flex:0 1 68px;aspect-ratio:1;padding:0;border:0;background:none;cursor:pointer;transition:transform .12s;-webkit-tap-highlight-color:transparent}
  .akn-die canvas{width:100%;height:100%;image-rendering:pixelated;display:block;filter:drop-shadow(0 3px 0 rgba(0,0,0,.5))}
  .akn-die.held{transform:translateY(-8px)}
  .akn-die.held canvas{filter:drop-shadow(0 0 0 #f5c542) drop-shadow(0 3px 0 #b8860b)}
  .akn-die.held::after{content:'HALTEN';position:absolute;left:50%;bottom:-16px;transform:translateX(-50%);font:7px 'Press Start 2P',monospace;color:#f5d442;text-shadow:1px 1px 0 #000;white-space:nowrap}
  .akn-die.roll{animation:aknShake .09s linear infinite}
  .akn-die.land{animation:aknLand .25s ease-out}
  @keyframes aknShake{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(-3px,-4px) rotate(-12deg)}50%{transform:translate(2px,-7px) rotate(8deg)}75%{transform:translate(3px,-2px) rotate(-6deg)}100%{transform:translate(0,0) rotate(0)}}
  @keyframes aknLand{0%{transform:scale(1.25)}60%{transform:scale(.92)}100%{transform:scale(1)}}
  .akn-btn{font-family:'Press Start 2P',monospace;font-size:16px;color:#3b1d00;background:linear-gradient(#ffe27a,#f5b52a);border:0;border-radius:10px;
    padding:14px 26px;box-shadow:0 5px 0 #a8620a,0 8px 14px rgba(0,0,0,.4);cursor:pointer;animation:aknPulse 1s ease-in-out infinite;min-width:70%}
  .akn-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #a8620a}
  .akn-btn:disabled{filter:grayscale(.6) brightness(.8);animation:none}
  .akn-btn small{display:block;font-size:8px;margin-top:6px;color:#6b3a00}
  @keyframes aknPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
  .akn-hand{position:absolute;z-index:5;pointer-events:none;font-size:30px;line-height:1;transition:left .3s,top .3s;animation:aknPoint .7s ease-in-out infinite;text-align:center}
  .akn-hand span{display:block;font:7px 'Press Start 2P',monospace;background:#e8202a;color:#fff;padding:3px 4px;border-radius:3px;white-space:nowrap;margin-top:2px}
  @keyframes aknPoint{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-8px)}}
  .akn-float{position:absolute;z-index:6;pointer-events:none;font:14px 'Press Start 2P',monospace;color:#f5d442;text-shadow:2px 2px 0 #b3261e,4px 4px 0 #000;
    left:50%;transform:translateX(-50%);white-space:nowrap;animation:aknFloat 1.1s ease-out forwards}
  @keyframes aknFloat{0%{opacity:0;margin-top:10px;transform:translateX(-50%) scale(.6)}20%{opacity:1;transform:translateX(-50%) scale(1.15)}100%{opacity:0;margin-top:-50px;transform:translateX(-50%) scale(1)}}
  .akn-banner{position:absolute;z-index:8;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;
    font:22px 'Press Start 2P',monospace;line-height:1.3;color:#fff200;text-shadow:3px 3px 0 #e8202a,6px 6px 0 #000;animation:aknBanner .6s cubic-bezier(.2,1.6,.4,1) forwards}
  .akn-banner.gift{font-size:12px;color:#fff;text-shadow:2px 2px 0 #8a5bd9,4px 4px 0 #000;background:rgba(0,0,0,.6);padding:12px 10px;border:3px solid #f5c542;border-radius:8px;width:88%}
  @keyframes aknBanner{0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(-4deg)}}
  .akn-rays{position:absolute;inset:-50%;z-index:1;pointer-events:none;opacity:.35;
    background:repeating-conic-gradient(from 0deg,#fff200 0 10deg,transparent 10deg 20deg);animation:aknSpin 4s linear infinite}
  @keyframes aknSpin{to{transform:rotate(360deg)}}
  .akn-coin{position:absolute;top:-30px;z-index:7;pointer-events:none;font-size:22px;animation:aknFall linear forwards}
  @keyframes aknFall{to{transform:translateY(calc(var(--h) + 60px)) rotate(720deg)}}
  .akn-z{position:relative;z-index:2;width:100%;display:flex;flex-direction:column;align-items:center}
  `;

  // 14x14 pixel die
  const PIPS = { 1: [[6, 6]], 2: [[3, 3], [9, 9]], 3: [[3, 3], [6, 6], [9, 9]], 4: [[3, 3], [9, 3], [3, 9], [9, 9]],
    5: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9]], 6: [[3, 3], [9, 3], [3, 6], [9, 6], [3, 9], [9, 9]] };
  function drawDie(cv, v, held, blur) {
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 14, 14);
    const edge = held ? '#f5c542' : '#2a1a10';
    c.fillStyle = edge; c.fillRect(1, 0, 12, 14); c.fillRect(0, 1, 14, 12);
    c.fillStyle = held ? '#fff6d0' : '#f6efe0'; c.fillRect(1, 1, 12, 12);
    c.fillStyle = held ? '#f0d890' : '#d9cdb4'; c.fillRect(1, 11, 12, 2); c.fillRect(11, 1, 2, 12);
    c.fillStyle = '#ffffff'; c.fillRect(2, 2, 3, 1); c.fillRect(2, 2, 1, 3);
    c.fillStyle = blur ? '#7a5a5a' : (v === 1 || v === 4 ? '#c7281f' : '#1c1410');
    for (const [x, y] of PIPS[v]) c.fillRect(x, y, 2, 2);
  }

  GAMES['ad_kniffel'] = {
    title: 'KNIFFLIG™',
    intro: 'Würfle einen Fünferpasch! Tippe Würfel an, um sie zu halten.',
    start(root, api) {
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const iv = [];

      const wrap = document.createElement('div');
      wrap.className = 'akn';
      wrap.innerHTML = `<style>${CSS}</style>
        <div class="akn-z">
          <div class="akn-top akn-px">
            <span class="akn-pill">LEVEL 1/∞</span>
            <span class="akn-score" id="aknScore">0 PKT</span>
            <span class="akn-pill">4.9 <span class="akn-stars">★★★★★</span></span>
          </div>
        </div>
        <div class="akn-z"><div class="akn-msg akn-px" id="aknMsg">Würfle 5 GLEICHE!</div></div>
        <div class="akn-z"><div class="akn-row" id="aknRow"></div></div>
        <div class="akn-z"><button class="akn-btn" id="aknBtn">WÜRFELN!<small id="aknLeft">Noch 3 Würfe</small></button></div>`;
      root.appendChild(wrap);

      const $ = id => wrap.querySelector('#' + id);
      const msgEl = $('aknMsg'), row = $('aknRow'), btn = $('aknBtn'), leftEl = $('aknLeft'), scoreEl = $('aknScore');

      const dice = [1, 2, 3, 4, 5].map(() => 1 + Math.floor(Math.random() * 6));
      const held = [false, false, false, false, false];
      let rollsLeft = 3, attempt = 1, rolled = false, rolling = false, won = false, score = 0;

      const els = dice.map((v, i) => {
        const b = document.createElement('button');
        b.className = 'akn-die';
        b.setAttribute('aria-label', 'Würfel ' + (i + 1));
        const cv = document.createElement('canvas'); cv.width = 14; cv.height = 14;
        b.appendChild(cv); row.appendChild(b);
        b.addEventListener('pointerdown', e => { e.preventDefault(); toggle(i); });
        return { b, cv };
      });
      const render = (i, blur) => { drawDie(els[i].cv, dice[i], held[i], blur); els[i].b.classList.toggle('held', held[i]); };
      dice.forEach((_, i) => render(i));

      const hand = document.createElement('div');
      hand.className = 'akn-hand';
      hand.innerHTML = '👆<span>Tippe hier!</span>';
      wrap.appendChild(hand);

      const counts = () => { const c = [0, 0, 0, 0, 0, 0, 0]; dice.forEach(v => c[v]++); return c; };
      const mode = (onlyHeld) => {
        const c = [0, 0, 0, 0, 0, 0, 0];
        dice.forEach((v, i) => { if (!onlyHeld || held[i]) c[v]++; });
        let best = 0, bv = 0;
        for (let v = 6; v >= 1; v--) if (c[v] > best) { best = c[v]; bv = v; }
        return bv;
      };
      const setMsg = s => { msgEl.textContent = s; };
      const rowTop = () => row.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
      const setScore = n => { score = n; scoreEl.textContent = score + ' PKT'; };

      function floatText(str, topPx) {
        const f = document.createElement('div');
        f.className = 'akn-float'; f.textContent = str; f.style.top = topPx + 'px';
        wrap.appendChild(f); later(() => f.remove(), 1150);
      }

      function placeHand() {
        if (won || rolling) { hand.style.display = 'none'; return; }
        hand.style.display = '';
        let target = btn;
        if (rolled && rollsLeft > 0) {
          const m = mode(held.some(Boolean));
          const c = counts();
          const i = dice.findIndex((v, k) => v === m && !held[k]);
          // suggest holding the matching dice first (only useful if it's at least a pair or something's held)
          if (i >= 0 && (c[m] >= 2 || held.some(Boolean))) target = els[i].b;
        }
        const wr = wrap.getBoundingClientRect(), tr = target.getBoundingClientRect();
        const onBtn = target === btn;
        hand.style.left = (tr.left - wr.left + (onBtn ? tr.width - 22 : tr.width / 2)) + 'px';
        hand.style.top = (onBtn ? tr.top - wr.top + tr.height / 2 - 12 : tr.bottom - wr.top + 4) + 'px';
      }

      function toggle(i) {
        if (rolling || won || !rolled) { if (!rolled && !won) { api.sfx('error'); setMsg('Erst WÜRFELN! 👇'); } return; }
        held[i] = !held[i]; api.sfx('click'); render(i);
        if (held[i]) setMsg('Gehalten! Jetzt WÜRFELN!');
        placeHand();
      }

      function roll() {
        if (rolling || won || rollsLeft <= 0) return;
        rolling = true; btn.disabled = true; rollsLeft--;
        leftEl.textContent = rollsLeft === 1 ? 'Noch 1 Wurf' : 'Noch ' + rollsLeft + ' Würfe';
        placeHand(); setMsg('🎲 🎲 🎲');
        const anyHeld = held.some(Boolean);
        const target = anyHeld ? mode(true) : (rolled ? mode(false) : 0);
        const p = anyHeld ? 0.55 : (rolled ? 0.3 : 0);
        const force = attempt >= 2 && rollsLeft === 0; // the ad "never" lets you lose twice
        const finalVals = dice.map((v, i) => {
          if (held[i]) return v;
          if (force && target) return target;
          return target && Math.random() < p ? target : 1 + Math.floor(Math.random() * 6);
        });
        if (force && !target) finalVals.fill(finalVals[0]);
        const idx = dice.map((_, i) => i).filter(i => !held[i]);
        idx.forEach(i => els[i].b.classList.add('roll'));
        api.sfx('pour');
        const flick = setInterval(() => {
          idx.forEach(i => { if (els[i].b.classList.contains('roll')) { dice[i] = 1 + Math.floor(Math.random() * 6); render(i, true); } });
        }, 70);
        iv.push(flick);
        idx.forEach((i, n) => later(() => {
          els[i].b.classList.remove('roll');
          dice[i] = finalVals[i]; render(i);
          els[i].b.classList.remove('land'); void els[i].b.offsetWidth; els[i].b.classList.add('land');
          api.sfx('click');
        }, 550 + n * 110));
        later(() => { clearInterval(flick); afterRoll(); }, 600 + idx.length * 110);
      }

      function afterRoll() {
        rolling = false; rolled = true;
        const c = counts(), best = Math.max(...c);
        if (best === 5) return winSeq();
        const pts = best >= 4 ? 500 : best === 3 ? 250 : best === 2 ? 100 : 50;
        setScore(score + pts);
        floatText('+' + pts + ' PUNKTE', rowTop() - 30);
        if (best >= 2) api.sfx('coin');
        if (rollsLeft === 0) {
          const g = document.createElement('div');
          g.className = 'akn-banner gift';
          g.innerHTML = 'FAST! 😱<br><br>Noch ein<br>Gratis-Versuch 🎁';
          wrap.appendChild(g); api.sfx('ding');
          setMsg('So knapp!!');
          later(() => {
            g.remove(); attempt++; rollsLeft = 3; held.fill(false); dice.forEach((_, i) => render(i));
            leftEl.textContent = 'Noch 3 Würfe'; btn.disabled = false; setMsg('Versuch ' + attempt + ' – du schaffst das!'); placeHand();
          }, 1600);
          return;
        }
        btn.disabled = false;
        setMsg(best >= 4 ? 'NUR NOCH EINER!!! 🔥' : best === 3 ? 'DREIER! Halte sie fest!' : best === 2 ? 'Ein Paar! Tippe es an zum Halten' : 'Tippe Würfel an zum Halten');
        placeHand();
      }

      function winSeq() {
        won = true; btn.disabled = true; placeHand();
        setScore(score + 1000);
        floatText('+1000 PUNKTE', rowTop() - 30);
        const rays = document.createElement('div'); rays.className = 'akn-rays'; wrap.insertBefore(rays, wrap.children[1]);
        const b = document.createElement('div'); b.className = 'akn-banner';
        b.innerHTML = 'FÜNFER-<br>PASCH!!!'; wrap.appendChild(b);
        setMsg('🎉 WERBUNG BESIEGT 🎉');
        api.sfx('coin');
        const H = wrap.clientHeight;
        for (let k = 0; k < 28; k++) later(() => {
          const c = document.createElement('div'); c.className = 'akn-coin';
          c.textContent = Math.random() < 0.8 ? '🪙' : '💰';
          c.style.left = (Math.random() * 95) + '%'; c.style.setProperty('--h', H + 'px');
          c.style.animationDuration = (0.9 + Math.random() * 0.9) + 's';
          wrap.appendChild(c); later(() => c.remove(), 2000);
          if (k % 4 === 0) api.sfx('coin');
        }, k * 50);
        later(() => api.win(), 1800);
      }

      btn.addEventListener('click', e => { e.preventDefault(); api.sfx('click'); roll(); });
      const onKey = e => {
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); roll(); }
        const n = '12345'.indexOf(e.key);
        if (n >= 0) { e.preventDefault(); toggle(n); }
      };
      window.addEventListener('keydown', onKey);
      const onResize = () => placeHand();
      window.addEventListener('resize', onResize);
      later(placeHand, 50);

      return function cleanup() {
        timers.forEach(clearTimeout); timers.clear();
        iv.forEach(clearInterval);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        wrap.remove();
      };
    }
  };
})();

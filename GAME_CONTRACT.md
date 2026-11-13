# Eva's Birthday Quest – game module contract

A birthday surprise website for **Eva** (from Laurenz, Enrico, Hannah and Magnus). A QR code leads to it; Eva plays a chain of
mini-games on her **phone (portrait, touch)** — desktop with keyboard must work too. All UI text is **German**.
Retro **16-bit pixel art** look, autumn-forest theme (she loves hiking). Sound plays through the shared engine.

Project root: `/Users/enrico/.t3/scratch/2026-11-13-wir-wollen-ein-spiel-um-f3007d1c/eva/`
A dev server is already running: `http://localhost:8080/` — do NOT start another one.
Test a single game standalone: `http://localhost:8080/dev.html?game=<id>`.

## Files
- `js/engine.js` — shared engine (read it! it's short). Do not edit it; if you really need something, implement it locally in your game file.
- `css/style.css` — base styles (fonts "Press Start 2P" for pixel headings and "VT323" for body text). Don't edit.
- `js/games/<id>.js` — **your file. Only create/edit your own file** (plus `js/vendor/*` if your brief allows). Other agents write the other games in parallel.

## Module shape (classic script, no ES modules, no build step)
```js
(function () {
  GAMES['<id>'] = {
    title: 'Kurzer Titel',               // shown in the HUD
    intro: 'Ein, zwei Sätze Anleitung.',  // shown by the shell on a card before the game starts
    start(root, api) {
      // root: an empty absolutely-positioned <div> filling the screen below a 44px HUD. You own its contents.
      // Build everything inside root. Call api.win() exactly once when the player has beaten the game.
      return function cleanup() { /* stop loops, remove ALL window/document listeners, timers */ };
    }
  };
})();
```

## api (from Engine.makeApi)
- `api.win()` — call once when solved (plays win jingle; shell moves on ~1 s later; call cleanup soon after is done by shell).
- `api.sfx(name)` — `click jump doublejump flap coin pour hit boom launch lose win error ding step`.
- `api.music(name)` — tracks `map`, `game`, `tense`, `birthday`. Call `api.music('game')` (or `tense`) at start of your game.
- `api.makeCanvas(root, w, h)` → `{canvas, ctx, w, h, pointer(evt)->{x,y}, destroy()}` — fixed low internal resolution, scaled
  with nearest-neighbour to fit root (contain, centered). Use a portrait-friendly resolution like **180×320** or **200×300** so it is
  big on phones (landscape desktop just gets letterboxed – fine). Draw everything with fillRect-style pixel art.
- `api.drawChar(ctx, who, frame, x, y, scale, flip)` — 12×16 pixel characters: who = `'eva'|'magnus'|'laurenz'`,
  frame = `'idle'|'run1'|'run2'|'jump'`. Eva = curly brown hair, glasses, beige jacket, green backpack.
  Magnus = pink cap, green hoodie. Laurenz = curly ginger hair, dark jacket.
- `api.drawPixels(ctx, rows, palMap, x, y, scale)` — draw a sprite from string rows, e.g. `['.RR.', 'RRRR']` with `{R:'#d94c3d'}`.
- `api.text(ctx, str, x, y, size, color, align, shadow)` — pixel font text on canvas (size 8 looks crisp; use multiples of 8).
- `api.loop(fn(dt, t))` → `stop()` — rAF loop, dt in seconds clamped to 0.05.
- `api.toast(msg, ms)` — small message at the bottom of the screen.
- `api.PAL` — shared palette colors.

## Rules
- Touch first: `pointerdown` on the canvas / big on-screen buttons; add keyboard too (space / arrows / WASD). Call
  `e.preventDefault()` so the page doesn't scroll/zoom. No hover-only interactions.
- **Fair & winnable in ~1–2 minutes** by a non-gamer. It's a birthday present, not Dark Souls. Fast instant retry on fail
  (no "game over" screens that require multiple taps). Show progress (e.g. "7/10").
- Original game: genre/mechanics may be familiar, but don't copy any existing game's name, characters, art or exact look.
- Cleanup must leave no running loops or listeners (the shell swaps games in the same page).
- No external network assets except where your brief explicitly allows.
- Verify: `node --check js/games/<id>.js`, then actually load `http://localhost:8080/dev.html?game=<id>` in a browser tool if you
  have one (preview tools) or at least sanity-check logic carefully. Make sure the game can be won (e.g. temporarily simulate).
  Close any browser tab you open when finished.
- Final reply: 3–6 lines: what you built, controls, how to win, anything the shell author should know.

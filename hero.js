/* ============================================================
   hero.js

   Three parts:
     1. the field   — a vector field you can push around
     2. the eyes    — a small character that watches things
     3. the intro   — typed name, cycling, with no timers racing

   The old build ran a 210-particle trail system that issued about
   15,000 stroke calls per frame and never stopped, plus a separate
   patch file that monkey-patched window.setInterval to paper over
   a race in the name cycle. Both are gone.
   ============================================================ */

(function(){
  'use strict';

  const NAMES   = ['Tory', 'T.J.'];
  const PREFIX  = "hi, i\u2019m ";

  const hero      = document.getElementById('hero');
  const fieldEl   = document.getElementById('heroField');
  const eyebrowEl = document.getElementById('heroEyebrow');
  const prefixEl  = document.getElementById('heroPrefix');
  const nameEl    = document.getElementById('heroName');
  const caretEl   = document.getElementById('heroCaret');
  const taglineEl = document.getElementById('heroTagline');
  const actionsEl = document.getElementById('heroActions');
  const cueEl     = document.getElementById('heroCue');
  const statEl    = document.getElementById('heroStat');
  const eyesEl    = document.getElementById('heroEyes');
  const nudgeEl   = document.getElementById('heroNudge');

  if(!hero) return;

  /* ==========================================================
     1. THE FIELD

     A grid of short segments. Each one points along a slow flow,
     until the pointer gets near — then it swings tangential, like
     iron filings finding a magnet. Cheap: one stroke call per
     brightness bucket, four buckets, ~1,200 segments total.
     ========================================================== */
  const field = (function(){
    const BUCKETS = 4;
    const state = {
      cells: [], cols: 0, rows: 0, spacing: 32,
      sinX: [], cosY: [],
      order: 0, orderTarget: 0,     // 0 = flowing, 1 = snapped to a grid
      pulses: [],
      count: 0
    };

    function init(rig){
      const spacing = rig.w < 620 ? 34 : rig.w < 1100 ? 34 : 31;
      state.spacing = spacing;
      state.cols = Math.ceil(rig.w / spacing) + 1;
      state.rows = Math.ceil(rig.h / spacing) + 1;
      state.cells = [];
      for(let j = 0; j < state.rows; j++){
        for(let i = 0; i < state.cols; i++){
          state.cells.push({
            x: i * spacing + spacing * 0.5,
            y: j * spacing + spacing * 0.5,
            i, j,
            // a fixed per-cell jitter keeps it from reading as a grid
            seed: Math.random() * 6.283
          });
        }
      }
      state.sinX = new Float32Array(state.cols);
      state.cosY = new Float32Array(state.rows);
      state.count = state.cells.length;
    }

    function draw(rig, t){
      const { ctx, w, h } = rig;
      const { cells, spacing } = state;

      ctx.fillStyle = '#161220';
      ctx.fillRect(0, 0, w, h);

      // ease the "order" parameter toward its target
      state.order += (state.orderTarget - state.order) * 0.06;

      // Per-column / per-row trig, computed once instead of per cell.
      for(let i = 0; i < state.cols; i++){
        state.sinX[i] = Math.sin((i * spacing) * 0.0062 + t * 0.20);
      }
      for(let j = 0; j < state.rows; j++){
        state.cosY[j] = Math.cos((j * spacing) * 0.0080 - t * 0.15);
      }

      const px = TJ.pointer.sx - rig.rectLeft;
      const py = TJ.pointer.sy - rig.rectTop;
      const live = TJ.pointer.inside && TJ.pointer.fine;
      const R = Math.min(w, h) * 0.42;
      const R2 = R * R;

      // decay pulses
      const pulses = state.pulses;
      for(let p = pulses.length - 1; p >= 0; p--){
        pulses[p].age += 1 / 60;
        if(pulses[p].age > 2.2) pulses.splice(p, 1);
      }

      // bucket the segments by brightness so we stroke four times,
      // not twelve hundred times
      const paths = [[], [], [], []];

      for(let k = 0; k < cells.length; k++){
        const c = cells[k];
        let ang = state.sinX[c.i] + state.cosY[c.j] + c.seed * 0.14;
        let vx = Math.cos(ang), vy = Math.sin(ang);
        let energy = 0;

        if(live){
          const dx = c.x - px, dy = c.y - py;
          const d2 = dx * dx + dy * dy;
          if(d2 < R2){
            const d = Math.sqrt(d2) || 1;
            let f = 1 - d / R;
            f = f * f * (3 - 2 * f);            // smoothstep
            // tangential: perpendicular to the radius
            const sx = -dy / d, sy = dx / d;
            vx += (sx - vx) * f;
            vy += (sy - vy) * f;
            energy += f;
          }
        }

        // click ripples
        for(let p = 0; p < pulses.length; p++){
          const pu = pulses[p];
          const dx = c.x - pu.x, dy = c.y - pu.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const wave = pu.age * 620;
          const band = Math.abs(d - wave);
          if(band < 90){
            const f = (1 - band / 90) * (1 - pu.age / 2.2);
            const rx = dx / d, ry = dy / d;
            vx += (rx - vx) * f * 0.9;
            vy += (ry - vy) * f * 0.9;
            energy += f * 0.9;
          }
        }

        // "order" snaps everything toward the nearest right angle
        if(state.order > 0.01){
          const a = Math.atan2(vy, vx);
          const snapped = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
          const o = state.order;
          vx += (Math.cos(snapped) - vx) * o;
          vy += (Math.sin(snapped) - vy) * o;
          energy = Math.max(energy, o * 0.5);
        }

        const m = Math.hypot(vx, vy) || 1;
        const len = spacing * (0.34 + energy * 0.42);
        const ux = (vx / m) * len * 0.5;
        const uy = (vy / m) * len * 0.5;

        const bucket = energy < 0.02 ? 0
                     : energy < 0.22 ? 1
                     : energy < 0.55 ? 2 : 3;

        const arr = paths[bucket];
        arr.push(c.x - ux, c.y - uy, c.x + ux, c.y + uy);
      }

      const styles = rig.data.styles;
      for(let b = 0; b < BUCKETS; b++){
        const arr = paths[b];
        if(!arr.length) continue;
        ctx.strokeStyle = styles[b];
        ctx.lineWidth = b === 3 ? 1.5 : b === 2 ? 1.2 : 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for(let n = 0; n < arr.length; n += 4){
          ctx.moveTo(arr[n], arr[n + 1]);
          ctx.lineTo(arr[n + 2], arr[n + 3]);
        }
        ctx.stroke();
      }
    }

    return {
      state,
      init, draw,
      pulse(x, y){ if(state.pulses.length < 4) state.pulses.push({ x, y, age: 0 }); },
      setOrder(v){ state.orderTarget = v; }
    };
  })();

  let rig = null;
  if(fieldEl){
    const accentStyles = () => {
      const cs = getComputedStyle(hero);
      const a = cs.getPropertyValue('--accent').trim() || '#e2a9b2';
      return [
        'rgba(241,236,245,0.13)',
        'rgba(241,236,245,0.24)',
        'rgba(148,166,208,0.46)',
        a
      ];
    };

    rig = TJ.canvas(fieldEl, {
      measure: hero,
      init(r){
        field.init(r);
        r.data.styles = accentStyles();
        const box = hero.getBoundingClientRect();
        r.rectLeft = box.left; r.rectTop = box.top;
      },
      draw(r, t){
        // hero is at the top of the document, so its offset only
        // changes on scroll — refresh cheaply rather than per frame
        field.draw(r, t);
      },
      still(r){
        field.init(r);
        r.data.styles = accentStyles();
        r.rectLeft = 0; r.rectTop = 0;
        field.draw(r, 1.5);
      }
    });

    if(rig){
      const syncRect = () => {
        const box = hero.getBoundingClientRect();
        rig.rectLeft = box.left;
        rig.rectTop = box.top;
      };
      syncRect();
      window.addEventListener('scroll', syncRect, { passive: true });
      window.addEventListener('resize', syncRect);
      requestAnimationFrame(() => fieldEl.classList.add('is-lit'));
    }
  }

  /* ==========================================================
     2. THE EYES
     ========================================================== */
  const eyes = (function(){
    if(!eyesEl) return null;

    const balls = Array.from(eyesEl.querySelectorAll('.eye-ball'));
    const MAX = 7;
    let rects = [];
    let dirty = true;
    let look = null;          // {x,y,until} — an override target
    let lastMove = performance.now();
    let opened = false;

    const measure = () => {
      rects = balls.map(b => {
        const r = b.parentElement.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      });
      dirty = false;
    };

    const invalidate = () => { dirty = true; };
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate);

    window.addEventListener('pointermove', () => { lastMove = performance.now(); }, { passive: true });

    // Look at whatever just took keyboard focus. Small thing,
    // but it makes tabbing through the page feel watched-over.
    document.addEventListener('focusin', e => {
      const el = e.target;
      if(!el || el === eyesEl || !el.getBoundingClientRect) return;
      const r = el.getBoundingClientRect();
      if(!r.width && !r.height) return;
      look = { x: r.left + r.width / 2, y: r.top + r.height / 2, until: performance.now() + 1600 };
    });

    TJ.tick(() => {
      if(!opened) return;
      if(dirty) measure();

      const now = performance.now();
      let tx, ty;

      if(look && now < look.until){
        tx = look.x; ty = look.y;
      }else if(TJ.pointer.inside && TJ.pointer.fine && now - lastMove < 4200){
        tx = TJ.pointer.sx; ty = TJ.pointer.sy;
      }else{
        // idle: drift slowly around, as if thinking
        const p = now / 2600;
        const base = rects[0] || { cx: 0, cy: 0 };
        tx = base.cx + Math.cos(p) * 180;
        ty = base.cy + Math.sin(p * 0.7) * 90 + 40;
      }

      let near = false;
      for(let i = 0; i < balls.length; i++){
        const r = rects[i]; if(!r) continue;
        const dx = tx - r.cx, dy = ty - r.cy;
        const d = Math.hypot(dx, dy) || 1;
        // full deflection once you're more than ~120px away
        const reach = Math.min(1, d / 120);
        const ox = (dx / d) * MAX * reach;
        const oy = (dy / d) * MAX * reach;
        balls[i].style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px)`;
        if(d < 92) near = true;
      }
      eyesEl.classList.toggle('is-squint', near && !eyesEl.classList.contains('is-blinking'));
    });

    let blinkTimer = null;
    function scheduleBlink(){
      clearTimeout(blinkTimer);
      blinkTimer = setTimeout(() => {
        if(!document.hidden && opened && !TJ.reduced){
          eyesEl.classList.add('is-blinking');
          setTimeout(() => eyesEl.classList.remove('is-blinking'), 110);
          // occasional double blink
          if(Math.random() < 0.22){
            setTimeout(() => {
              eyesEl.classList.add('is-blinking');
              setTimeout(() => eyesEl.classList.remove('is-blinking'), 100);
            }, 230);
          }
        }
        scheduleBlink();
      }, TJ.rand(2600, 6400));
    }

    return {
      open(){
        opened = true;
        eyesEl.classList.add('is-open');
        measure();
        scheduleBlink();
      },
      lookAt(x, y, ms = 1400){ look = { x, y, until: performance.now() + ms }; }
    };
  })();

  /* ==========================================================
     3. THE INTRO
     ========================================================== */
  const letters = [];

  function makeLetter(ch){
    const s = document.createElement('span');
    s.className = 'hero-letter' + (ch === ' ' ? ' is-space' : '');
    s.textContent = ch === ' ' ? '\u00a0' : ch;
    return s;
  }

  async function type(container, text, speed = 78){
    caretEl && caretEl.classList.add('is-typing');
    for(const ch of text){
      const el = makeLetter(ch);
      container.appendChild(el);
      // force style flush so the transition actually plays
      void el.offsetWidth;
      el.classList.add('is-on');
      await TJ.wait(speed);
    }
    caretEl && caretEl.classList.remove('is-typing');
  }

  async function erase(container, speed = 46){
    caretEl && caretEl.classList.add('is-typing');
    while(container.lastElementChild){
      const el = container.lastElementChild;
      el.classList.remove('is-on');
      await TJ.wait(speed);
      el.remove();
    }
    caretEl && caretEl.classList.remove('is-typing');
  }

  function setInstant(container, text){
    container.textContent = '';
    for(const ch of text){
      const el = makeLetter(ch);
      el.classList.add('is-on');
      container.appendChild(el);
    }
  }

  /* The name cycle. A single async loop that awaits each phase,
     so two passes can never interleave — which is the bug the old
     hero-cycle-guard.js existed to hide. */
  let cycleIndex = 0;
  let heroOnScreen = true;
  let cyclePaused = false;

  async function runCycle(){
    // eslint-disable-next-line no-constant-condition
    while(true){
      await TJ.wait(900);
      if(TJ.reduced) return;
      if(cyclePaused || document.hidden || !heroOnScreen) continue;

      // hold each name for a beat before swapping
      if(runCycle.hold === undefined) runCycle.hold = 0;
      runCycle.hold += 900;
      if(runCycle.hold < 6300) continue;
      runCycle.hold = 0;

      cycleIndex = (cycleIndex + 1) % NAMES.length;
      await erase(nameEl);
      await TJ.wait(140);
      await type(nameEl, NAMES[cycleIndex], 84);
    }
  }

  /* Lock the line width to the widest variant so the caret doesn't
     shuffle sideways every time the name swaps. Re-run once the real
     font arrives, in case we measured with fallback metrics. */
  function measureName(){
    if(!nameEl) return;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;';
    nameEl.parentElement.appendChild(probe);
    let widest = 0;
    for(const n of NAMES){
      probe.textContent = n;
      widest = Math.max(widest, probe.getBoundingClientRect().width);
    }
    probe.remove();
    nameEl.style.minWidth = Math.ceil(widest) + 'px';
  }
  if(document.fonts && document.fonts.ready){
    document.fonts.ready.then(measureName);
  }
  window.addEventListener('resize', measureName);

  async function intro(){
    measureName();

    if(TJ.reduced){
      eyebrowEl && eyebrowEl.classList.add('is-in');
      prefixEl && setInstant(prefixEl, PREFIX);
      nameEl && setInstant(nameEl, NAMES[0]);
      taglineEl && taglineEl.classList.add('is-in');
      actionsEl && actionsEl.classList.add('is-in');
      cueEl && cueEl.classList.add('is-in');
      eyes && eyes.open();
      nudgeEl && nudgeEl.classList.add('is-in');
      return;
    }

    await TJ.wait(380);
    eyebrowEl && eyebrowEl.classList.add('is-in');
    await TJ.wait(420);

    await type(prefixEl, PREFIX, 62);
    await type(nameEl, NAMES[0], 92);

    await TJ.wait(220);
    taglineEl && taglineEl.classList.add('is-in');

    await TJ.wait(260);
    actionsEl && actionsEl.classList.add('is-in');
    cueEl && cueEl.classList.add('is-in');

    // the eyes open last — they've been closed this whole time
    await TJ.wait(340);
    eyes && eyes.open();

    await TJ.wait(1500);
    nudgeEl && nudgeEl.classList.add('is-in');

    runCycle();
  }

  // Wait for fonts so letters don't reflow mid-type, but never hang
  // on it — a font CDN hiccup should not cost you the whole intro.
  const fontsReady = (document.fonts && document.fonts.ready)
    ? Promise.race([document.fonts.ready, TJ.wait(1800)])
    : Promise.resolve();
  fontsReady.then(intro);

  /* ---- hero visibility gates the cycle and the field --------- */
  TJ.onVisible(hero, on => { heroOnScreen = on; if(on) TJ.wake(); });

  /* ---- eyes → chess ----------------------------------------- */
  if(eyesEl){
    eyesEl.addEventListener('click', () => {
      const r = eyesEl.getBoundingClientRect();
      const box = hero.getBoundingClientRect();
      field.pulse(r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top);
      nudgeEl && (nudgeEl.classList.remove('is-in'), nudgeEl.classList.add('is-out'));
      window.dispatchEvent(new CustomEvent('tj:chess-open'));
    });
  }

  window.addEventListener('tj:chess-open', () => {
    cyclePaused = true;
    field.setOrder(0.78);          // the field falls into rank and file
    if(eyes){
      const board = document.getElementById('chessBoard');
      if(board){
        const r = board.getBoundingClientRect();
        eyes.lookAt(r.left + r.width / 2, r.top + r.height / 2, 2600);
      }
    }
  });
  window.addEventListener('tj:chess-close', () => {
    cyclePaused = false;
    field.setOrder(0);
  });

  /* ---- the readout ------------------------------------------
     Real numbers from the running simulation, not decoration.
     ----------------------------------------------------------- */
  if(statEl && !TJ.reduced){
    let frames = 0, mark = performance.now(), fps = 60;
    TJ.tick(() => {
      frames++;
      const now = performance.now();
      if(now - mark >= 900){
        fps = Math.round(frames * 1000 / (now - mark));
        frames = 0; mark = now;
        statEl.innerHTML =
          `<b>${field.state.count.toLocaleString()}</b> vectors · <b>${fps}</b> fps`;
      }
    });
  }else if(statEl){
    statEl.textContent = 'motion reduced';
  }
})();

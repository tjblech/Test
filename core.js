/* ============================================================
   core.js — shared runtime.

   Three things every other script on this site depends on:

   1. ONE requestAnimationFrame loop. Every canvas rig registers
      with it. Rigs that are off-screen, or in a background tab,
      are not called at all. When nothing is animating the loop
      stops completely rather than idling.

   2. ONE pointermove listener, smoothed, that everything reads.

   3. ONE IntersectionObserver driving every scroll reveal.

   The previous build had six rAF loops, four observers and three
   copies of the scramble function. This is the same behaviour for
   a fraction of the work.
   ============================================================ */

window.TJ = (function(){

  /* ---- reduced motion, live ------------------------------- */
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionListeners = new Set();
  const state = { reduced: motionQuery.matches };

  const onMotionChange = () => {
    state.reduced = motionQuery.matches;
    motionListeners.forEach(fn => fn(state.reduced));
  };
  motionQuery.addEventListener
    ? motionQuery.addEventListener('change', onMotionChange)
    : motionQuery.addListener(onMotionChange);

  /* ---- maths ---------------------------------------------- */
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const lerp  = (a, b, t) => a + (b - a) * t;
  const rand  = (a, b) => a + Math.random() * (b - a);
  const TAU   = Math.PI * 2;

  /* ============================================================
     The ticker
     ============================================================ */
  const items = new Set();
  let looping = false;
  let last = 0;
  let docHidden = document.hidden;

  function frame(now){
    if(!looping) return;

    // Cap dt so a backgrounded tab doesn't teleport every simulation
    // forward by ten seconds when it wakes up.
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;

    let anyActive = false;
    for(const item of items){
      if(item.paused || !item.visible || docHidden) continue;
      anyActive = true;
      item.clock += dt;
      try{ item.fn(item.clock, dt); }
      catch(err){ console.error('[tick]', err); items.delete(item); }
    }

    if(anyActive){
      requestAnimationFrame(frame);
    }else{
      looping = false;   // nothing to draw — stop burning frames
    }
  }

  function wake(){
    if(looping || docHidden) return;
    looping = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    docHidden = document.hidden;
    if(!docHidden) wake();
  });

  /* Register an animation. Returns a handle you can pause/kill. */
  function tick(fn, opts = {}){
    const item = {
      fn,
      clock: opts.clock || 0,
      paused: false,
      visible: opts.visible !== false
    };
    items.add(item);

    const handle = {
      get clock(){ return item.clock; },
      set visible(v){
        if(item.visible === v) return;
        item.visible = v;
        if(v) wake();
      },
      pause(){ item.paused = true; },
      resume(){ item.paused = false; wake(); },
      kill(){ items.delete(item); }
    };

    wake();
    return handle;
  }

  /* ============================================================
     Visibility — one observer, shared by everything that wants
     to know "am I on screen?"
     ============================================================ */
  const visCallbacks = new WeakMap();
  const visObserver = new IntersectionObserver(entries => {
    for(const entry of entries){
      const fn = visCallbacks.get(entry.target);
      if(fn) fn(entry.isIntersecting, entry);
    }
  }, { rootMargin: '120px 0px', threshold: 0 });

  function onVisible(el, fn){
    visCallbacks.set(el, fn);
    visObserver.observe(el);
    return () => { visObserver.unobserve(el); visCallbacks.delete(el); };
  }

  /* ============================================================
     Canvas helper

     Handles DPR, resize, and — importantly — caches width/height
     so draw loops never call getBoundingClientRect(). The old
     build read layout once per frame per canvas, which is the
     classic way to make a 60fps page cost 200% CPU.
     ============================================================ */
  function canvas(el, opts = {}){
    const ctx = el.getContext('2d', { alpha: opts.alpha !== false });
    if(!ctx) return null;

    const box = opts.measure || el.parentElement || el;
    const rig = {
      ctx, el,
      w: 1, h: 1, dpr: 1,
      data: {},
      handle: null
    };

    function resize(){
      const rect = box.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = clamp(window.devicePixelRatio || 1, 1, opts.maxDpr || 2);
      if(w === rig.w && h === rig.h && dpr === rig.dpr) return;

      rig.w = w; rig.h = h; rig.dpr = dpr;
      el.width  = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      el.style.width  = w + 'px';
      el.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if(opts.init) opts.init(rig);
      if(state.reduced && opts.still) opts.still(rig);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();

    // Reduced motion: paint one static frame, never animate.
    if(state.reduced){
      if(opts.still) opts.still(rig);
      else if(opts.draw) opts.draw(rig, 0, 0);
      return rig;
    }

    rig.handle = tick((t, dt) => opts.draw(rig, t, dt), { visible: false });
    onVisible(el, on => { rig.handle.visible = on; });

    rig.destroy = () => { ro.disconnect(); rig.handle && rig.handle.kill(); };
    return rig;
  }

  /* ============================================================
     Pointer — one listener, smoothed, shared.
     ============================================================ */
  const pointer = {
    x: -9999, y: -9999,     // raw viewport coords
    sx: -9999, sy: -9999,   // smoothed
    inside: false,
    fine: window.matchMedia('(pointer: fine)').matches
  };

  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if(!pointer.inside){
      pointer.sx = e.clientX;
      pointer.sy = e.clientY;
      pointer.inside = true;
    }
  }, { passive: true });

  window.addEventListener('pointerleave', () => { pointer.inside = false; }, { passive: true });

  tick((t, dt) => {
    const k = 1 - Math.pow(0.0015, dt);
    pointer.sx = lerp(pointer.sx, pointer.x, k);
    pointer.sy = lerp(pointer.sy, pointer.y, k);
  });

  /* ============================================================
     Reveal — one observer for every [data-reveal] on the page.
     Optional data-reveal-delay staggers a group.
     ============================================================ */
  const revealObserver = new IntersectionObserver(entries => {
    for(const entry of entries){
      if(!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      entry.target.dispatchEvent(new CustomEvent('tj:reveal', { bubbles: false }));
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  function reveal(root = document){
    root.querySelectorAll('[data-reveal]:not(.is-in)').forEach(el => {
      const delay = el.dataset.revealDelay;
      if(delay) el.style.setProperty('--rv-delay', delay + 'ms');
      revealObserver.observe(el);
    });
    root.querySelectorAll('.rule').forEach(el => revealObserver.observe(el));
  }

  /* ============================================================
     Scramble — one implementation. Was copy-pasted three times.
     ============================================================ */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&+=/\\<>';
  const runs = new WeakMap();

  function scramble(el, text, duration = 620){
    if(!el) return;
    const run = (runs.get(el) || 0) + 1;
    runs.set(el, run);

    if(state.reduced){ el.textContent = text; return; }

    const start = performance.now();
    const step = now => {
      if(runs.get(el) !== run) return;          // a newer run took over
      const p = clamp((now - start) / duration, 0, 1);
      // ease-out so the last few letters settle rather than snap
      const eased = 1 - Math.pow(1 - p, 2.2);
      const shown = Math.floor(eased * text.length);
      let out = '';
      for(let i = 0; i < text.length; i++){
        out += (i < shown || text[i] === ' ')
          ? text[i]
          : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if(p < 1) requestAnimationFrame(step);
      else el.textContent = text;
    };
    requestAnimationFrame(step);
  }

  /* ---- misc ------------------------------------------------ */
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function onMotion(fn){ motionListeners.add(fn); return () => motionListeners.delete(fn); }

  return {
    get reduced(){ return state.reduced; },
    onMotion,
    tick, wake, onVisible, canvas, pointer,
    reveal, scramble, wait,
    clamp, lerp, rand, TAU
  };
})();

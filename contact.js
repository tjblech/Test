/* ============================================================
   contact.js

   Same field primitive as the hero, inverted: instead of flowing
   past you, every vector here points at the one thing on the page
   worth clicking.
   ============================================================ */

(function(){
  'use strict';

  const section = document.getElementById('contact');
  const wrap    = document.getElementById('contactWrap');
  const canvas  = document.getElementById('contactField');
  const mail    = document.getElementById('contactMail');
  const copyBtn = document.getElementById('contactCopy');
  if(!section) return;

  const EMAIL = 'tjblech@gmail.com';

  if(wrap){
    wrap.addEventListener('tj:reveal', () => {
      TJ.scramble(document.getElementById('contactEyebrow'), 'get in touch', 400);
      TJ.scramble(document.getElementById('contactHeading'), "let\u2019s talk", 700);
    });
  }

  /* ---- copy ------------------------------------------------- */
  if(copyBtn){
    copyBtn.addEventListener('click', async () => {
      let ok = false;
      try{
        await navigator.clipboard.writeText(EMAIL);
        ok = true;
      }catch(err){
        // clipboard API needs a secure context; fall back
        const ta = document.createElement('textarea');
        ta.value = EMAIL;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:absolute;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
        ta.remove();
      }
      copyBtn.textContent = ok ? 'copied ✓' : 'select and copy manually';
      copyBtn.classList.toggle('is-done', ok);
      setTimeout(() => {
        copyBtn.textContent = 'copy address';
        copyBtn.classList.remove('is-done');
      }, 2200);
    });
  }

  /* ---- the converging field --------------------------------- */
  if(!canvas) return;

  const state = { cells: [], spacing: 34, cols: 0, rows: 0 };

  TJ.canvas(canvas, {
    measure: section,
    init(r){
      const spacing = r.w < 620 ? 40 : 34;
      state.spacing = spacing;
      state.cols = Math.ceil(r.w / spacing) + 1;
      state.rows = Math.ceil(r.h / spacing) + 1;
      state.cells = [];
      for(let j = 0; j < state.rows; j++){
        for(let i = 0; i < state.cols; i++){
          state.cells.push({
            x: i * spacing + spacing * 0.5,
            y: j * spacing + spacing * 0.5,
            seed: Math.random() * 6.283
          });
        }
      }
    },
    still(r){ paint(r, 1.2); },
    draw(r, t){ paint(r, t); }
  });

  function paint(r, t){
    const { ctx, w, h } = r;
    ctx.clearRect(0, 0, w, h);

    // aim at the email, or the middle if it hasn't laid out yet
    let tx = w / 2, ty = h * 0.46;
    if(mail){
      const box = mail.getBoundingClientRect();
      const sec = section.getBoundingClientRect();
      if(box.width){
        tx = box.left + box.width / 2 - sec.left;
        ty = box.top + box.height / 2 - sec.top;
      }
    }

    const near = [], far = [];
    const maxD = Math.hypot(w, h) * 0.55;

    for(const c of state.cells){
      const dx = tx - c.x, dy = ty - c.y;
      const d = Math.hypot(dx, dy) || 1;
      // a slow wave so it breathes instead of sitting still
      const wave = Math.sin(d * 0.014 - t * 1.1 + c.seed) * 0.34;
      const a = Math.atan2(dy, dx) + wave;

      const pull = TJ.clamp(1 - d / maxD, 0, 1);
      const len = state.spacing * (0.26 + pull * 0.34);
      const ux = Math.cos(a) * len * 0.5;
      const uy = Math.sin(a) * len * 0.5;

      (pull > 0.55 ? near : far).push(c.x - ux, c.y - uy, c.x + ux, c.y + uy);
    }

    const stroke = (arr, style, width) => {
      if(!arr.length) return;
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for(let i = 0; i < arr.length; i += 4){
        ctx.moveTo(arr[i], arr[i + 1]);
        ctx.lineTo(arr[i + 2], arr[i + 3]);
      }
      ctx.stroke();
    };

    stroke(far,  'rgba(241,236,245,0.08)', 1);
    stroke(near, 'rgba(226,169,178,0.34)', 1.2);
  }
})();

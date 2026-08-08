/* ============================================================
   about.js

   The board in this section used to be a random walk. It now
   solves an actual knight's tour with Warnsdorff's heuristic —
   64 squares, every one visited exactly once — and traces it.
   Which is a better fit for the sentence it sits next to.
   ============================================================ */

(function(){
  'use strict';

  const head = document.getElementById('aboutHead');
  if(head){
    head.addEventListener('tj:reveal', () => {
      TJ.scramble(document.getElementById('aboutEyebrow'), 'about', 400);
      TJ.scramble(document.getElementById('aboutHeading'), 'a bit more about me', 680);
    });
  }

  /* ---- allocation bars: reveal individually ------------------ */
  document.querySelectorAll('.alloc-row').forEach((row, i) => {
    row.style.setProperty('--bar-delay', (i * 140) + 'ms');
    row.addEventListener('tj:reveal', () => row.classList.add('is-in'));
  });

  /* ============================================================
     The knight's tour
     ============================================================ */
  const canvas = document.getElementById('knightCanvas');
  const capEl  = document.getElementById('knightCap');
  if(!canvas) return;

  const MOVES = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  /* Warnsdorff: always step to the square with the fewest onward
     options. Greedy, and from most starts it walks the whole board. */
  function solve(startR, startC){
    const seen = Array.from({ length: 8 }, () => Array(8).fill(false));
    const path = [[startR, startC]];
    seen[startR][startC] = true;

    let r = startR, c = startC;
    for(let step = 1; step < 64; step++){
      let best = null, bestDeg = 9;
      for(const [dr, dc] of MOVES){
        const nr = r + dr, nc = c + dc;
        if(!inside(nr, nc) || seen[nr][nc]) continue;
        let deg = 0;
        for(const [er, ec] of MOVES){
          const xr = nr + er, xc = nc + ec;
          if(inside(xr, xc) && !seen[xr][xc]) deg++;
        }
        if(deg < bestDeg){ bestDeg = deg; best = [nr, nc]; }
      }
      if(!best) return null;
      r = best[0]; c = best[1];
      seen[r][c] = true;
      path.push([r, c]);
    }
    return path;
  }

  function findTour(){
    // a few starts, in case the greedy walk paints itself into a corner
    for(const [r, c] of [[0,0],[0,1],[1,0],[2,2],[3,3],[0,7],[7,0]]){
      const p = solve(r, c);
      if(p && p.length === 64) return p;
    }
    return solve(0, 0) || [[0,0]];
  }

  let tour = findTour();
  let head_i = 0;      // how many squares are drawn
  let holdFor = 0;

  const rig = TJ.canvas(canvas, {
    measure: canvas.parentElement,
    init(){ head_i = 0; holdFor = 0; },
    still(r){ head_i = tour.length; draw(r, 0); },
    draw(r, t, dt){ step(dt); draw(r, t); }
  });

  function step(dt){
    if(holdFor > 0){
      holdFor -= dt;
      if(holdFor <= 0){
        tour = findTour();
        head_i = 0;
      }
      return;
    }
    head_i += dt * 7.5;
    if(head_i >= tour.length){
      head_i = tour.length;
      holdFor = 2.6;
    }
  }

  function draw(r, t){
    const { ctx, w, h } = r;
    const cell = Math.min(w, h) / 8;
    const cx = sq => sq[1] * cell + cell / 2;
    const cy = sq => sq[0] * cell + cell / 2;

    ctx.fillStyle = '#12101a';
    ctx.fillRect(0, 0, w, h);

    for(let row = 0; row < 8; row++){
      for(let col = 0; col < 8; col++){
        if((row + col) % 2) continue;
        ctx.fillStyle = 'rgba(181,129,198,.075)';
        ctx.fillRect(col * cell, row * cell, cell, cell);
      }
    }

    const drawn = Math.floor(head_i);

    // squares already visited
    for(let i = 0; i < drawn && i < tour.length; i++){
      ctx.fillStyle = `rgba(227,193,127,${(0.06 + (i / tour.length) * 0.14).toFixed(3)})`;
      ctx.fillRect(tour[i][1] * cell + 1, tour[i][0] * cell + 1, cell - 2, cell - 2);
    }

    // the path
    ctx.lineWidth = 1.3;
    ctx.lineJoin = 'round';
    for(let i = 1; i < drawn && i < tour.length; i++){
      const fade = 0.16 + (i / tour.length) * 0.6;
      ctx.strokeStyle = `rgba(226,169,178,${fade.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(cx(tour[i - 1]), cy(tour[i - 1]));
      ctx.lineTo(cx(tour[i]), cy(tour[i]));
      ctx.stroke();
    }

    // the knight itself, easing between squares
    const i = Math.min(Math.floor(head_i), tour.length - 1);
    const frac = head_i - Math.floor(head_i);
    const from = tour[Math.max(0, i - 1)] || tour[0];
    const to = tour[i];
    const e = frac * frac * (3 - 2 * frac);
    const kx = TJ.lerp(cx(from), cx(to), e);
    const ky = TJ.lerp(cy(from), cy(to), e);

    ctx.fillStyle = '#e3c17f';
    ctx.beginPath();
    ctx.arc(kx, ky, Math.max(2.4, cell * 0.17), 0, TJ.TAU);
    ctx.fill();

    if(holdFor <= 0){
      ctx.strokeStyle = `rgba(227,193,127,${(0.5 - frac * 0.4).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(kx, ky, cell * (0.2 + frac * 0.3), 0, TJ.TAU);
      ctx.stroke();
    }

    if(capEl){
      const n = Math.min(Math.floor(head_i) + 1, 64);
      capEl.innerHTML = n >= 64
        ? "knight's tour · <b>64/64</b>"
        : `knight's tour · <b>${n}/64</b>`;
    }
  }

  if(TJ.reduced && capEl) capEl.innerHTML = "knight's tour · <b>64/64</b>";
})();

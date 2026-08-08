/* ============================================================
   rigs.js

   The thesis of this site: no project is represented by a picture
   of itself. Each one loads a small working version of its own
   central idea, running live in the page.

   Every rig exports  create(mount, accent) -> { destroy() }
   Exactly one is alive at a time.
   ============================================================ */

window.RIGS = (function(){
  'use strict';

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if(cls) n.className = cls;
    if(html != null) n.innerHTML = html;
    return n;
  };

  const round = (n, d = 0) => {
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  };

  /* ============================================================
     1. Common Ground — the approval pipeline

     The thing that makes this project interesting is not the page,
     it's the plumbing: a form submission that has to survive a
     human approval step before it can reach a public calendar.
     So: press the button, watch a submission make the trip.
     ============================================================ */
  function pipeline(mount, accent){
    const canvas = el('canvas');
    mount.appendChild(canvas);

    const bar = el('div', 'rig-controls');
    const btn = el('button', 'rig-btn', 'submit an event');
    btn.type = 'button';
    const counter = el('span', 'rig-readout', '<b>0</b> published');
    bar.append(btn, counter);
    mount.appendChild(bar);

    const packets = [];
    let published = 0;
    let cal = new Array(28).fill(0);
    let autoTimer = null;

    function send(){
      if(packets.length > 5) return;
      packets.push({ t: 0, stage: 0, hold: 0, id: Math.random() });
    }

    btn.addEventListener('click', send);

    const rig = TJ.canvas(canvas, {
      measure: mount,
      init(){},
      draw(r, t, dt){
        const { ctx, w, h } = r;
        ctx.clearRect(0, 0, w, h);

        const pad = Math.max(16, w * 0.05);
        const midY = h * 0.38;
        const nodes = [
          { x: pad + w * 0.02,  label: 'FORM',     sub: 'google form' },
          { x: w * 0.42,        label: 'REVIEW',   sub: 'sheets gate' },
          { x: w - pad - w * 0.16, label: 'CALENDAR', sub: 'public' }
        ];
        const nw = Math.min(112, w * 0.2), nh = 52;

        // wires
        ctx.strokeStyle = 'rgba(255,255,255,.13)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = -t * 22;
        for(let i = 0; i < nodes.length - 1; i++){
          ctx.beginPath();
          ctx.moveTo(nodes[i].x + nw, midY);
          ctx.lineTo(nodes[i + 1].x, midY);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // nodes
        nodes.forEach((n, i) => {
          ctx.strokeStyle = 'rgba(255,255,255,.18)';
          ctx.fillStyle = 'rgba(255,255,255,.035)';
          ctx.lineWidth = 1;
          roundRect(ctx, n.x, midY - nh / 2, nw, nh, 7);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = i === 1 ? accent : 'rgba(241,236,245,.86)';
          ctx.font = '600 10px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x + nw / 2, midY - 4);
          ctx.fillStyle = 'rgba(241,236,245,.36)';
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillText(n.sub, n.x + nw / 2, midY + 11);
        });

        // mini calendar under the last node
        const cw = Math.min(nw + 30, w * 0.24);
        const cellW = cw / 7, cellH = 9;
        const cx0 = Math.min(nodes[2].x + nw / 2 - cw / 2, w - cw - 8);
        const cy0 = midY + nh / 2 + 18;
        for(let i = 0; i < 28; i++){
          const cxx = cx0 + (i % 7) * cellW;
          const cyy = cy0 + Math.floor(i / 7) * (cellH + 3);
          const v = cal[i];
          ctx.fillStyle = v > 0
            ? withAlpha(accent, 0.25 + Math.min(v, 3) * 0.22)
            : 'rgba(255,255,255,.05)';
          ctx.fillRect(cxx, cyy, cellW - 3, cellH);
        }

        // packets
        for(let i = packets.length - 1; i >= 0; i--){
          const p = packets[i];
          if(p.hold > 0){
            p.hold -= dt;
            const n = nodes[1];
            // the approval stamp
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            const prog = TJ.clamp(1 - p.hold / 0.55, 0, 1);
            ctx.beginPath();
            ctx.arc(n.x + nw / 2, midY - nh / 2 - 14, 8, -Math.PI / 2, -Math.PI / 2 + prog * TJ.TAU);
            ctx.stroke();
            if(prog > 0.85){
              ctx.beginPath();
              ctx.moveTo(n.x + nw / 2 - 3.5, midY - nh / 2 - 14);
              ctx.lineTo(n.x + nw / 2 - 1,   midY - nh / 2 - 11.5);
              ctx.lineTo(n.x + nw / 2 + 4,   midY - nh / 2 - 17);
              ctx.stroke();
            }
            drawPacket(ctx, n.x + nw / 2, midY, accent);
            continue;
          }

          p.t += dt * 0.62;
          if(p.t >= 1){
            p.t = 0;
            p.stage++;
            if(p.stage === 1){ p.hold = 0.55; }
            if(p.stage >= 2){
              published++;
              counter.innerHTML = `<b>${published}</b> published`;
              cal[(Math.random() * 28) | 0]++;
              packets.splice(i, 1);
              continue;
            }
          }

          const from = nodes[p.stage], to = nodes[p.stage + 1];
          if(!from || !to){ packets.splice(i, 1); continue; }
          const ease = p.t * p.t * (3 - 2 * p.t);
          const x = (from.x + nw) + ((to.x) - (from.x + nw)) * ease;
          drawPacket(ctx, x, midY, accent);
        }
      }
    });

    // keep it alive on its own so it reads as a pipeline, not a button
    autoTimer = setInterval(() => {
      if(!document.hidden && packets.length < 2) send();
    }, 3600);
    send();

    return {
      destroy(){
        clearInterval(autoTimer);
        rig && rig.destroy && rig.destroy();
      }
    };
  }

  function drawPacket(ctx, x, y, accent){
    ctx.fillStyle = accent;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  /* ============================================================
     2. Measured From Here — orders of magnitude

     Concentric decade rings. Drag and the whole scale runs
     outward through you. Every reference below is a real figure.
     ============================================================ */
  const SCALE_REFS = [
    [0,  '1 m',        'about an arm span'],
    [1,  '10 m',       'a city bus, roughly'],
    [2,  '100 m',      'a football field'],
    [3,  '1 km',       'a fifteen minute walk'],
    [4,  '10 km',      'cruising altitude'],
    [5,  '100 km',     'the Kármán line — space starts here'],
    [6,  '1,000 km',   'the length of California'],
    [7,  '10,000 km',  "Earth's diameter is 12,742 km"],
    [8,  '100,000 km', 'a quarter of the way to the Moon'],
    [9,  '1 Gm',       "the Sun's diameter, 1.39 Gm"],
    [10, '10 Gm',      'well inside Mercury\u2019s orbit'],
    [11, '100 Gm',     'Earth to Sun is 150 Gm'],
    [12, '1 Tm',       "past Saturn's orbit"],
    [13, '10 Tm',      'the edge of the heliosphere'],
    [14, '100 Tm',     'still nowhere near another star'],
    [15, '1 Pm',       'a light year is 9.46 Pm'],
    [16, '10 Pm',      'Proxima Centauri, 40 Pm'],
    [17, '100 Pm',     'a neighbourhood of stars'],
    [18, '1 Em',       'about 100 light years'],
    [19, '10 Em',      'a thousand light years'],
    [20, '100 Em',     'a slice of the galactic disc'],
    [21, '1 Zm',       'the Milky Way is about 950 Zm across'],
    [22, '10 Zm',      'Andromeda is 24 Zm away'],
    [23, '100 Zm',     'the Local Group'],
    [24, '1 Ym',       'the Laniakea supercluster'],
    [25, '10 Ym',      'the cosmic web'],
    [26, '100 Ym',     'the observable universe, 880 Ym across']
  ];

  function scale(mount, accent){
    const canvas = el('canvas');
    mount.appendChild(canvas);

    const bar = el('div', 'rig-controls');
    const input = el('input');
    input.type = 'range';
    input.min = '0'; input.max = '26'; input.step = '0.01'; input.value = '0';
    input.className = 'rig-range';
    input.setAttribute('aria-label', 'Order of magnitude, in metres');
    const readout = el('div', 'rig-scale-readout');
    bar.append(input, readout);
    mount.appendChild(readout);
    mount.appendChild(bar);

    let target = 0, current = 0;

    function label(){
      const i = TJ.clamp(Math.round(current), 0, 26);
      const ref = SCALE_REFS[i];
      readout.innerHTML =
        `<span class="exp">10<sup>${ref[0]}</sup> m</span>` +
        `<span class="big">${ref[1]}</span>` +
        `<span class="note">${ref[2]}</span>`;
    }
    label();

    input.addEventListener('input', () => { target = parseFloat(input.value); });

    // drag anywhere on the stage
    let dragging = false, lastX = 0;
    const down = e => {
      if(e.target === input) return;
      dragging = true; lastX = e.clientX;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    };
    const move = e => {
      if(!dragging) return;
      target = TJ.clamp(target + (e.clientX - lastX) * 0.035, 0, 26);
      input.value = String(target);
      lastX = e.clientX;
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    const rig = TJ.canvas(canvas, {
      measure: mount,
      draw(r, t, dt){
        const { ctx, w, h } = r;
        current += (target - current) * TJ.clamp(dt * 6, 0, 1);
        ctx.clearRect(0, 0, w, h);

        const cx = w / 2, cy = h * 0.52;
        const step = Math.min(w, h) * 0.115;

        ctx.lineWidth = 1;
        for(let d = 0; d <= 26; d++){
          const rr = (d - current + 1.4) * step;
          if(rr < 2 || rr > Math.hypot(w, h) * 0.62) continue;
          const near = Math.abs(d - current);
          const isActive = near < 0.5;
          const alpha = TJ.clamp(1 - near / 7, 0.05, 1);

          ctx.strokeStyle = isActive ? accent : `rgba(148,166,208,${(alpha * 0.4).toFixed(3)})`;
          ctx.lineWidth = isActive ? 1.8 : 1;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, TJ.TAU);
          ctx.stroke();

          if(rr > 26 && (d % 2 === 0 || isActive)){
            ctx.fillStyle = isActive ? accent : `rgba(241,236,245,${(alpha * 0.5).toFixed(3)})`;
            ctx.font = `${isActive ? '600 ' : ''}9px ui-monospace, monospace`;
            ctx.textAlign = 'center';
            ctx.fillText('10^' + d, cx, cy - rr - 5);
          }
        }

        // you, at the centre, always the same size
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, TJ.TAU);
        ctx.fill();
        ctx.strokeStyle = withAlpha(accent, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 3 + (Math.sin(t * 2) * 0.5 + 0.5) * 9, 0, TJ.TAU);
        ctx.stroke();

        if(Math.abs(target - current) > 0.004) label();
      }
    });

    return {
      destroy(){
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        rig && rig.destroy && rig.destroy();
      }
    };
  }

  /* ============================================================
     3. Runway — the natural-language quick-add

     This is the real parser logic from the idea, running here.
     Type a sentence, watch it become a scheduled task.
     ============================================================ */
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  function parseTask(raw){
    let s = ' ' + raw.toLowerCase().trim() + ' ';
    const out = { title: raw.trim(), date: null, time: null, repeat: null, tag: null, priority: 0 };
    const eat = re => { const m = s.match(re); if(m){ s = s.replace(m[0], ' '); } return m; };

    // priority
    let m = eat(/\s(!{1,3})(\s|$)/);
    if(m) out.priority = m[1].length;

    // tag
    m = eat(/\s#([a-z0-9\-_]+)/);
    if(m) out.tag = m[1];

    // recurrence
    m = eat(/\severy\s+(day|week|weekday|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if(m) out.repeat = 'every ' + m[1];
    else if(eat(/\s(daily)\s/))  out.repeat = 'every day';
    else if(eat(/\s(weekly)\s/)) out.repeat = 'every week';

    // relative days
    const now = new Date();
    const mk = offset => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return d;
    };

    if(eat(/\stoday\s/))            out.date = mk(0);
    else if(eat(/\stonight\s/))   { out.date = mk(0); out.time = out.time || '20:00'; }
    else if(eat(/\stomorrow\s/))    out.date = mk(1);
    else{
      m = eat(/\s(next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(day|sday|nesday|rsday|urday)?\s/);
      if(m){
        const stub = m[2];
        const idx = DAYS.findIndex(d => d.startsWith(stub.slice(0, 3)));
        if(idx >= 0){
          let delta = (idx - now.getDay() + 7) % 7;
          if(delta === 0) delta = 7;
          if(m[1]) delta += (delta <= 7 ? 0 : 0);
          out.date = mk(delta);
        }
      }else{
        m = eat(/\sin\s+(\d+)\s*(d|day|days|w|week|weeks)\s/);
        if(m) out.date = mk(parseInt(m[1], 10) * (/w/.test(m[2]) ? 7 : 1));
      }
    }

    // time
    m = eat(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s/);
    if(m){
      let hh = parseInt(m[1], 10) % 12;
      if(m[3] === 'pm') hh += 12;
      out.time = String(hh).padStart(2, '0') + ':' + (m[2] || '00');
    }else{
      m = eat(/\s(?:at\s+)?(\d{1,2}):(\d{2})\s/);
      if(m) out.time = String(parseInt(m[1], 10)).padStart(2, '0') + ':' + m[2];
    }

    // duration
    m = eat(/\sfor\s+(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours)\s/);
    if(m) out.duration = /^h/.test(m[2]) ? parseInt(m[1], 10) * 60 : parseInt(m[1], 10);

    out.title = s.replace(/\s+/g, ' ').trim().replace(/^(with|the|a)\s+/, '$1 ') || 'untitled';
    out.title = out.title.charAt(0).toUpperCase() + out.title.slice(1);
    return out;
  }

  const fmtDate = d => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = t => {
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'pm' : 'am';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return hh + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
  };

  function quickadd(mount, accent){
    const wrap = el('div', 'rig-pad');
    wrap.innerHTML = `
      <label class="rig-field">
        <span class="rig-prompt">+</span>
        <input class="rig-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="try: gym friday 6pm every week #health"
               aria-label="Quick add a task in plain English">
      </label>
      <div class="rig-out" aria-live="polite"></div>
      <div class="rig-examples"></div>
    `;
    mount.appendChild(wrap);

    const input = wrap.querySelector('.rig-input');
    const out   = wrap.querySelector('.rig-out');
    const exWrap = wrap.querySelector('.rig-examples');

    const EXAMPLES = [
      'gym friday 6pm every week #health',
      'call mom tomorrow at 7:30pm',
      'ship runway v2 in 3 days !!',
      'standup every weekday at 9am'
    ];
    EXAMPLES.forEach(text => {
      const b = el('button', 'rig-chip', text);
      b.type = 'button';
      b.addEventListener('click', () => { typeOut(text); });
      exWrap.appendChild(b);
    });

    function render(raw){
      if(!raw.trim()){ out.innerHTML = '<div class="rig-empty">nothing parsed yet</div>'; return; }
      const p = parseTask(raw);
      const bits = [];
      if(p.date)   bits.push(`<span class="rig-tok date">${fmtDate(p.date)}</span>`);
      if(p.time)   bits.push(`<span class="rig-tok time">${fmtTime(p.time)}</span>`);
      if(p.duration) bits.push(`<span class="rig-tok">${p.duration}m</span>`);
      if(p.repeat) bits.push(`<span class="rig-tok repeat">↻ ${p.repeat}</span>`);
      if(p.tag)    bits.push(`<span class="rig-tok tag">#${p.tag}</span>`);
      if(p.priority) bits.push(`<span class="rig-tok pri">${'!'.repeat(p.priority)}</span>`);

      out.innerHTML = `
        <div class="rig-task">
          <span class="rig-box"></span>
          <div class="rig-task-main">
            <div class="rig-task-title">${escapeHtml(p.title)}</div>
            <div class="rig-task-meta">${bits.join('') || '<span class="rig-tok muted">no date found</span>'}</div>
          </div>
        </div>`;
    }

    let typer = null;
    function typeOut(text){
      clearInterval(typer);
      input.value = '';
      let i = 0;
      typer = setInterval(() => {
        input.value = text.slice(0, ++i);
        render(input.value);
        if(i >= text.length) clearInterval(typer);
      }, TJ.reduced ? 0 : 26);
      if(TJ.reduced){ clearInterval(typer); input.value = text; render(text); }
    }

    input.addEventListener('input', () => { clearInterval(typer); render(input.value); });
    render('');
    setTimeout(() => { if(mount.isConnected) typeOut(EXAMPLES[0]); }, 620);

    return { destroy(){ clearInterval(typer); wrap.remove(); } };
  }

  /* ============================================================
     4. Billiards — actual physics

     Drag back from the cue ball, let go. Elastic collisions,
     cushions, friction, pockets. The bracket software is the
     project; the table is why he was in the room.
     ============================================================ */
  function pool(mount, accent){
    const canvas = el('canvas');
    mount.appendChild(canvas);

    const bar = el('div', 'rig-controls');
    const btn = el('button', 'rig-btn', 'rack');
    btn.type = 'button';
    const readout = el('span', 'rig-readout', '<b>0</b> potted');
    bar.append(btn, readout);
    mount.appendChild(bar);

    const COLORS = ['#e3c17f', '#e2a9b2', '#94a6d0', '#b581c6', '#8fd0b6', '#d4737e'];
    let balls = [], potted = 0, aim = null, R = 8;
    const pockets = [];

    function rack(r){
      const { w, h } = r;
      R = Math.max(5, Math.min(w, h) * 0.028);
      balls = [];
      potted = 0;
      readout.innerHTML = '<b>0</b> potted';

      // cue ball
      balls.push({ x: w * 0.24, y: h / 2, vx: 0, vy: 0, r: R, cue: true, color: '#f6f3ec' });

      // a small triangle
      const ox = w * 0.66, oy = h / 2, gap = R * 2.06;
      let n = 0;
      for(let row = 0; row < 3; row++){
        for(let i = 0; i <= row; i++){
          balls.push({
            x: ox + row * gap * 0.88,
            y: oy + (i - row / 2) * gap,
            vx: 0, vy: 0, r: R, color: COLORS[n % COLORS.length]
          });
          n++;
        }
      }

      pockets.length = 0;
      const pr = R * 1.75;
      [[0,0],[0.5,0],[1,0],[0,1],[0.5,1],[1,1]].forEach(([fx, fy]) => {
        pockets.push({ x: fx * w, y: fy * h, r: pr });
      });
    }

    function pointerPos(e, r){
      const box = canvas.getBoundingClientRect();
      return { x: (e.clientX - box.left) * (r.w / box.width), y: (e.clientY - box.top) * (r.h / box.height) };
    }

    let rig = null;

    const down = e => {
      if(!rig) return;
      const cue = balls[0];
      if(!cue || moving()) return;
      const p = pointerPos(e, rig);
      if(Math.hypot(p.x - cue.x, p.y - cue.y) > R * 5) return;
      aim = p;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    };
    const move = e => { if(aim && rig) aim = pointerPos(e, rig); };
    const up = () => {
      if(!aim || !rig) return;
      const cue = balls[0];
      const dx = cue.x - aim.x, dy = cue.y - aim.y;
      const power = Math.min(Math.hypot(dx, dy), R * 12) * 5.2;
      const a = Math.atan2(dy, dx);
      cue.vx = Math.cos(a) * power;
      cue.vy = Math.sin(a) * power;
      aim = null;
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { aim = null; });

    const moving = () => balls.some(b => Math.hypot(b.vx, b.vy) > 3);

    btn.addEventListener('click', () => { if(rig) rack(rig); });

    rig = TJ.canvas(canvas, {
      measure: mount,
      init(r){ rack(r); },
      draw(r, t, dt){
        const { ctx, w, h } = r;
        const step = Math.min(dt, 1 / 40);

        // felt
        ctx.fillStyle = '#1a2a24';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,.09)';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);

        for(const p of pockets){
          ctx.fillStyle = '#0d1512';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TJ.TAU); ctx.fill();
        }

        // integrate
        for(const b of balls){
          b.x += b.vx * step;
          b.y += b.vy * step;
          const damp = Math.pow(0.28, step);
          b.vx *= damp; b.vy *= damp;
          if(Math.hypot(b.vx, b.vy) < 2){ b.vx = 0; b.vy = 0; }

          if(b.x < b.r){ b.x = b.r; b.vx = -b.vx * 0.86; }
          if(b.x > w - b.r){ b.x = w - b.r; b.vx = -b.vx * 0.86; }
          if(b.y < b.r){ b.y = b.r; b.vy = -b.vy * 0.86; }
          if(b.y > h - b.r){ b.y = h - b.r; b.vy = -b.vy * 0.86; }
        }

        // pairwise elastic collisions, equal mass
        for(let i = 0; i < balls.length; i++){
          for(let j = i + 1; j < balls.length; j++){
            const a = balls[i], b = balls[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d = Math.hypot(dx, dy);
            const min = a.r + b.r;
            if(d === 0){ dx = 0.01; d = 0.01; }
            if(d >= min) continue;

            const nx = dx / d, ny = dy / d;
            const overlap = (min - d) / 2;
            a.x -= nx * overlap; a.y -= ny * overlap;
            b.x += nx * overlap; b.y += ny * overlap;

            const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
            const sep = rvx * nx + rvy * ny;
            if(sep > 0) continue;
            const imp = -(1.92) * sep / 2;
            a.vx -= imp * nx; a.vy -= imp * ny;
            b.vx += imp * nx; b.vy += imp * ny;
          }
        }

        // pocketing
        for(let i = balls.length - 1; i >= 0; i--){
          const b = balls[i];
          for(const p of pockets){
            if(Math.hypot(b.x - p.x, b.y - p.y) < p.r * 0.86){
              if(b.cue){
                b.x = w * 0.24; b.y = h / 2; b.vx = b.vy = 0;
              }else{
                balls.splice(i, 1);
                potted++;
                readout.innerHTML = `<b>${potted}</b> potted`;
              }
              break;
            }
          }
        }

        // aim guide
        const cue = balls[0];
        if(aim && cue){
          const dx = cue.x - aim.x, dy = cue.y - aim.y;
          const power = Math.min(Math.hypot(dx, dy), R * 12);
          const a = Math.atan2(dy, dx);
          ctx.strokeStyle = withAlpha(accent, 0.75);
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(cue.x, cue.y);
          ctx.lineTo(cue.x + Math.cos(a) * 210, cue.y + Math.sin(a) * 210);
          ctx.stroke();
          ctx.setLineDash([]);
          // power bar behind the cue ball
          ctx.strokeStyle = accent;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(cue.x - Math.cos(a) * 6, cue.y - Math.sin(a) * 6);
          ctx.lineTo(cue.x - Math.cos(a) * (6 + power), cue.y - Math.sin(a) * (6 + power));
          ctx.stroke();
        }

        // balls
        for(const b of balls){
          ctx.fillStyle = 'rgba(0,0,0,.35)';
          ctx.beginPath(); ctx.arc(b.x + 1.5, b.y + 2.5, b.r, 0, TJ.TAU); ctx.fill();
          const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.35, b.color);
          g.addColorStop(1, shade(b.color, -40));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TJ.TAU); ctx.fill();
        }

        if(balls.length === 1){
          ctx.fillStyle = accent;
          ctx.font = '600 12px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('table cleared', w / 2, h / 2 - 4);
        }
      }
    });

    return {
      destroy(){
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        rig && rig.destroy && rig.destroy();
      }
    };
  }

  /* ============================================================
     5. A real site, loaded on demand.
     ============================================================ */
  function live(mount, accent, opts){
    const url = opts && opts.url;
    const wrap = el('div', 'rig-live');
    wrap.innerHTML = `
      <div class="rig-live-chrome">
        <span class="rig-live-dots"><i></i><i></i><i></i></span>
        <span class="rig-live-url">${escapeHtml((url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span>
      </div>
      <div class="rig-live-body">
        <button class="rig-live-load" type="button">load the live site</button>
        <p class="rig-live-fallback">If nothing appears, the site blocks embedding.
          <a href="${url}" target="_blank" rel="noopener noreferrer">Open it in a new tab ↗</a></p>
      </div>`;
    mount.appendChild(wrap);

    const body = wrap.querySelector('.rig-live-body');
    const load = wrap.querySelector('.rig-live-load');

    load.addEventListener('click', () => {
      load.disabled = true;
      load.textContent = 'loading…';
      const frame = el('iframe', 'rig-live-frame');
      frame.src = url;
      frame.title = (opts.title || 'Live site') + ' preview';
      frame.loading = 'lazy';
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.addEventListener('load', () => {
        load.remove();
        frame.classList.add('is-ready');
      });
      body.appendChild(frame);
      setTimeout(() => { if(load.isConnected) load.textContent = 'still loading…'; }, 4200);
    });

    return { destroy(){ wrap.remove(); } };
  }

  /* ============================================================
     6. The ebike — a working model, not a spec sheet

     Sliders are inputs. The numbers are what the inputs imply.
     The pack itself is still being chosen, and the copy says so.
     ============================================================ */
  function circuit(mount, accent){
    const canvas = el('canvas');
    mount.appendChild(canvas);

    const bar = el('div', 'rig-controls rig-controls-stack');
    bar.innerHTML = `
      <label class="rig-slider">
        <span>pack</span>
        <input type="range" class="rig-range" id="rigVolts" min="24" max="72" step="12" value="48"
               aria-label="Pack voltage">
        <b id="rigVoltsOut">48 V</b>
      </label>
      <label class="rig-slider">
        <span>throttle</span>
        <input type="range" class="rig-range" id="rigThrottle" min="0" max="100" step="1" value="35"
               aria-label="Throttle position">
        <b id="rigThrottleOut">35%</b>
      </label>`;
    mount.appendChild(bar);

    const readout = el('div', 'rig-circuit-readout');
    mount.appendChild(readout);

    const vIn = bar.querySelector('#rigVolts');
    const tIn = bar.querySelector('#rigThrottle');
    const vOut = bar.querySelector('#rigVoltsOut');
    const tOut = bar.querySelector('#rigThrottleOut');

    const MAX_A = 25;
    let phase = 0;

    function update(){
      const V = parseFloat(vIn.value);
      const th = parseFloat(tIn.value) / 100;
      const A = MAX_A * th;
      const W = V * A;
      vOut.textContent = V + ' V';
      tOut.textContent = Math.round(th * 100) + '%';
      readout.innerHTML =
        `<span><b>${round(A, 1)}</b> A</span>` +
        `<span><b>${Math.round(W)}</b> W</span>` +
        `<span><b>${round(W / 745.7, 2)}</b> hp</span>`;
      return { V, th, A, W };
    }
    vIn.addEventListener('input', update);
    tIn.addEventListener('input', update);
    let vals = update();

    const rig = TJ.canvas(canvas, {
      measure: mount,
      draw(r, t, dt){
        const { ctx, w, h } = r;
        vals = { V: parseFloat(vIn.value), th: parseFloat(tIn.value) / 100 };
        vals.A = MAX_A * vals.th;
        vals.W = vals.V * vals.A;

        ctx.clearRect(0, 0, w, h);
        const y = h * 0.45;
        const boxW = Math.min(94, w * 0.2), boxH = 46;
        const xs = [w * 0.06, w * 0.5 - boxW / 2, w * 0.94 - boxW];
        const labels = ['BATTERY', 'CONTROLLER', 'MOTOR'];

        // wires with current flowing along them
        phase += dt * (0.4 + vals.th * 5.5);
        ctx.lineWidth = 1 + vals.th * 2.2;
        ctx.strokeStyle = vals.th > 0.02 ? withAlpha(accent, 0.35 + vals.th * 0.6) : 'rgba(255,255,255,.12)';
        ctx.setLineDash([6, 9]);
        ctx.lineDashOffset = -phase * 30;
        for(let i = 0; i < 2; i++){
          ctx.beginPath();
          ctx.moveTo(xs[i] + boxW, y);
          ctx.lineTo(xs[i + 1], y);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // boxes
        for(let i = 0; i < 3; i++){
          ctx.strokeStyle = 'rgba(255,255,255,.2)';
          ctx.fillStyle = 'rgba(255,255,255,.04)';
          roundRect(ctx, xs[i], y - boxH / 2, boxW, boxH, 6);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(241,236,245,.8)';
          ctx.font = '600 9px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(labels[i], xs[i] + boxW / 2, y + 3);
        }

        // battery cells
        const cells = Math.round(vals.V / 12);
        for(let i = 0; i < cells; i++){
          ctx.fillStyle = withAlpha(accent, 0.75);
          ctx.fillRect(xs[0] + 8 + i * 7, y + boxH / 2 + 8, 4, 10);
        }

        // rotor
        const mx = xs[2] + boxW / 2, my = y - boxH / 2 - 30;
        const spin = phase * 2.2;
        ctx.strokeStyle = withAlpha(accent, 0.28 + vals.th * 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mx, my, 15, 0, TJ.TAU); ctx.stroke();
        for(let i = 0; i < 3; i++){
          const a = spin + i * (TJ.TAU / 3);
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(mx + Math.cos(a) * 13, my + Math.sin(a) * 13);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(241,236,245,.34)';
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('rotor', mx, my + 28);
      }
    });

    return {
      destroy(){
        rig && rig.destroy && rig.destroy();
        bar.remove(); readout.remove();
      }
    };
  }

  /* ---- little helpers -------------------------------------- */
  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function withAlpha(hex, a){
    const c = hex.trim();
    if(c.startsWith('rgb')) return c;
    const n = parseInt(c.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function shade(hex, amt){
    const n = parseInt(hex.slice(1), 16);
    const r = TJ.clamp(((n >> 16) & 255) + amt, 0, 255);
    const g = TJ.clamp(((n >> 8) & 255) + amt, 0, 255);
    const b = TJ.clamp((n & 255) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  return { pipeline, scale, quickadd, pool, live, circuit, parseTask };
})();

/* ============================================================
   work.js — the bench

   Builds the rail and the panel, and owns the rig lifecycle:
   exactly one rig is alive at a time. The old build created six
   canvases, six ResizeObservers and six rAF loops up front and
   left them all running.
   ============================================================ */

(function(){
  'use strict';

  const PROJECTS = [
    {
      slug: 'common-ground',
      title: 'Common Ground',
      status: 'live',
      accent: 'slate',
      blurb: 'A hub that centralises legal, healthcare and community resources for people who need them. The interesting part is not the page, it is the plumbing behind it: a Google Form submission has to clear a human approval step in Sheets before it can appear on a public calendar.',
      note: ['gate', 'Anyone can submit. Nothing reaches the public calendar until a person approves it. The rig on the left is that pipeline, running.'],
      tags: ['JavaScript', 'Google Apps Script', 'Calendar API'],
      link: 'https://tjblech.github.io/Common-Ground/',
      rig: 'pipeline',
      hint: 'press submit'
    },
    {
      slug: 'measured-from-here',
      title: 'Measured From Here',
      status: 'live',
      accent: 'plum',
      blurb: 'Two scroll experiences spanning sixty orders of magnitude: one from eye level out to the observable universe, one from now back to the Planck time. A custom collision solver keeps every content card from overlapping at any viewport size, backed by 516 passing test assertions.',
      note: ['hard part', 'Placing cards on a logarithmic axis means they bunch up unpredictably as the viewport changes. The solver resolves that at every size.'],
      tags: ['JavaScript', 'Testing', 'No dependencies'],
      link: 'https://tjblech.github.io/Measured-From-Here/',
      rig: 'scale',
      hint: 'drag left and right'
    },
    {
      slug: 'runway',
      title: 'Runway',
      status: 'live',
      accent: 'gold',
      blurb: 'A single-file personal planner: a natural-language quick-add box, a command palette, drag-to-reschedule, and a 14-day view that shows the shape of your workload at a glance. Syncs across devices through Supabase with built-in conflict resolution.',
      note: ['try it', 'The box on the left is the quick-add parser. Type a sentence the way you would say it and watch it come apart into a date, a time and a repeat rule.'],
      tags: ['JavaScript', 'Supabase', 'Local-first'],
      link: 'https://tjblech.github.io/Runway/',
      rig: 'quickadd',
      hint: 'type a sentence'
    },
    {
      slug: 'billiards',
      title: 'Billiards Tournament Manager',
      status: 'live',
      accent: 'rose',
      blurb: 'A bracket manager built for pool leagues: live queueing across two tables, single and double elimination, and a public bracket view players can pull up from a QR code. Deployed through GitHub Actions.',
      note: ['why', 'I run the weekly tournaments at my club. Paper brackets fall apart the moment two tables run at different speeds, so I built the thing I needed.'],
      tags: ['React', 'TypeScript', 'Supabase', 'GitHub Actions'],
      link: 'https://tjblech.github.io/Billiards/',
      rig: 'pool',
      hint: 'drag back from the cue ball'
    },
    {
      slug: 'jack-cadman-campaign',
      title: 'Jack Cadman Campaign',
      status: 'live',
      accent: 'slate',
      blurb: 'A full site for a local school committee campaign: priorities, biography and volunteer sign-up in a mobile-first layout. I owned the visual direction, the information architecture and the deployment end to end.',
      note: ['scope', 'A real candidate, a real deadline, and an audience that mostly arrives on a phone from a Facebook link.'],
      tags: ['Next.js', 'TypeScript', 'Tailwind CSS'],
      link: 'https://jacklcadman.com/',
      rig: 'live',
      rigOpts: { url: 'https://jacklcadman.com/', title: 'Jack Cadman Campaign' },
      hint: 'load the real site'
    },
    {
      slug: 'ebike',
      title: 'Mountain Bike → Ebike',
      status: 'in progress',
      accent: 'gold',
      blurb: 'Converting my mountain bike into an ebike, working through motor, battery and controller integration. Software is forgiving. A battery pack is not, which is most of why I wanted to do it.',
      note: ['note', 'The rig is a working model, not a spec sheet. Move the sliders and the numbers follow. The actual pack is still being chosen.'],
      tags: ['Hardware', 'DIY', 'In progress'],
      link: null,
      rig: 'circuit',
      hint: 'move the throttle'
    }
  ];

  const rail    = document.getElementById('benchRail');
  const panel   = document.getElementById('benchPanel');
  const section = document.getElementById('work');
  if(!rail || !panel) return;

  const stage   = document.getElementById('rigStage');
  const cmdEl   = document.getElementById('benchCmd');
  const bodyEl  = document.getElementById('benchBody');
  const titleEl = document.getElementById('benchTitle');
  const blurbEl = document.getElementById('benchBlurb');
  const noteEl  = document.getElementById('benchNote');
  const tagsEl  = document.getElementById('benchTags');
  const linksEl = document.getElementById('benchLinks');
  const countEl = document.getElementById('benchCount');
  const hintEl  = document.getElementById('rigHint');

  const ACCENT_VAR = { rose:'--rose', gold:'--gold', slate:'--slate', plum:'--plum' };
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  countEl && (countEl.textContent = PROJECTS.length + ' projects');

  /* ---- rail -------------------------------------------------- */
  const tabs = PROJECTS.map((p, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail-item';
    btn.id = 'railTab' + i;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-controls', 'benchPanel');
    btn.tabIndex = -1;
    btn.style.setProperty('--rail-accent', `var(${ACCENT_VAR[p.accent]})`);
    btn.innerHTML =
      `<span class="num">${String(i + 1).padStart(2, '0')}</span>` +
      `<span class="name">${p.slug}</span>` +
      `<span class="status">${p.status}</span>`;
    btn.addEventListener('click', () => select(i, false));
    rail.appendChild(btn);
    return btn;
  });

  /* ---- rig lifecycle ---------------------------------------- */
  let liveRig = null;
  let current = -1;
  let typeRun = 0;
  let onScreen = false;

  function killRig(){
    if(liveRig && liveRig.destroy) liveRig.destroy();
    liveRig = null;
    stage.innerHTML = '';
  }

  function mountRig(p){
    killRig();
    const factory = window.RIGS && window.RIGS[p.rig];
    if(!factory) return;
    const accent = cssVar(ACCENT_VAR[p.accent]) || '#e2a9b2';
    try{
      liveRig = factory(stage, accent, p.rigOpts || {});
    }catch(err){
      console.error('[rig]', p.slug, err);
    }
    hintEl.classList.remove('is-done');
    hintEl.querySelector('span').textContent = p.hint;
  }

  const markTouched = () => hintEl.classList.add('is-done');
  stage.addEventListener('pointerdown', markTouched);
  stage.addEventListener('keydown', markTouched);
  stage.addEventListener('input', markTouched);

  /* ---- typing the command ----------------------------------- */
  function typeCmd(text){
    const run = ++typeRun;
    cmdEl.innerHTML = '';
    const prompt = document.createElement('span');
    prompt.className = 'prompt';
    prompt.textContent = '$ ';
    const body = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'caret';
    cmdEl.append(prompt, body, caret);

    if(TJ.reduced){ body.textContent = text; return Promise.resolve(); }

    return new Promise(resolve => {
      let i = 0;
      (function step(){
        if(run !== typeRun) return;
        body.textContent = text.slice(0, i);
        if(i++ < text.length) setTimeout(step, 17);
        else resolve();
      })();
    });
  }

  /* ---- select ------------------------------------------------ */
  function select(i, silent){
    if(i === current) return;
    const p = PROJECTS[i];

    if(current >= 0){
      tabs[current].setAttribute('aria-selected', 'false');
      tabs[current].tabIndex = -1;
    }
    current = i;
    tabs[i].setAttribute('aria-selected', 'true');
    tabs[i].tabIndex = 0;
    if(!silent) tabs[i].focus();

    // the whole bench takes this project's colour
    section.classList.remove('accent-rose', 'accent-gold', 'accent-slate', 'accent-plum');
    section.classList.add('accent-' + p.accent);

    stage.classList.remove('is-live');
    bodyEl.classList.remove('is-live');

    titleEl.textContent = p.title;
    blurbEl.textContent = p.blurb;
    noteEl.innerHTML = `<span class="k">${p.note[0]}</span><span>${p.note[1]}</span>`;
    tagsEl.innerHTML = p.tags.map(t => `<span class="chip">${t}</span>`).join('');
    linksEl.innerHTML = p.link
      ? `<a class="ulink" href="${p.link}" target="_blank" rel="noopener noreferrer">visit the live site <span class="arrow">↗</span></a>`
      : `<span class="panel-status">still in the garage</span>`;

    typeCmd(`run ${p.slug} --demo`).then(() => {
      if(current !== i) return;
      stage.classList.add('is-live');
      bodyEl.classList.add('is-live');
      TJ.scramble(titleEl, p.title, 480);
      if(onScreen) mountRig(p);
      else pending = p;
    });
  }

  let pending = null;

  /* ---- keyboard on the rail ---------------------------------- */
  rail.addEventListener('keydown', e => {
    const keys = { ArrowDown:1, ArrowRight:1, ArrowUp:-1, ArrowLeft:-1 };
    if(keys[e.key]){
      e.preventDefault();
      select((current + keys[e.key] + tabs.length) % tabs.length, false);
    }else if(e.key === 'Home'){ e.preventDefault(); select(0, false); }
    else if(e.key === 'End'){ e.preventDefault(); select(tabs.length - 1, false); }
  });

  /* ---- only run a rig while the bench is actually on screen --- */
  TJ.onVisible(section, on => {
    onScreen = on;
    if(on){
      if(pending){ mountRig(pending); pending = null; }
      else if(current >= 0 && !liveRig) mountRig(PROJECTS[current]);
    }else{
      killRig();
      if(current >= 0) pending = PROJECTS[current];
    }
  });

  /* ---- header scramble + first selection --------------------- */
  const head = document.getElementById('workHead');
  if(head){
    head.addEventListener('tj:reveal', () => {
      TJ.scramble(document.getElementById('workEyebrow'), 'selected work', 420);
      TJ.scramble(document.getElementById('workHeading'), "things i\u2019ve built", 700);
    });
  }

  const bench = document.getElementById('bench');
  if(bench){
    bench.addEventListener('tj:reveal', () => select(0, true), { once: true });
  }else{
    select(0, true);
  }

  /* ---- external selection (used by the command palette) ------ */
  window.addEventListener('tj:select-project', e => {
    const i = PROJECTS.findIndex(p => p.slug === (e.detail && e.detail.slug));
    if(i < 0) return;
    select(i, true);
    section.scrollIntoView({ behavior: TJ.reduced ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => tabs[i].focus({ preventScroll: true }), TJ.reduced ? 0 : 700);
  });

  window.TJ_PROJECTS = PROJECTS;
})();

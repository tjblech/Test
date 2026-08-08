/* ============================================================
   shell.js — navigation, progress, and the command palette.

   Everything the old site-shell.js did by patching the DOM after
   the fact (rewriting the tagline through a MutationObserver,
   deleting hero links that had just been created, injecting
   project URLs that belonged in the project data) now lives in
   the source it belongs to. What is left here is genuinely
   shell-level: chrome that spans the whole page.
   ============================================================ */

(function(){
  'use strict';

  /* ---- year -------------------------------------------------- */
  const year = document.getElementById('footYear');
  if(year) year.textContent = String(new Date().getFullYear());

  /* ---- reading progress -------------------------------------- */
  const fill = document.getElementById('progressFill');
  if(fill){
    let queued = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? TJ.clamp(window.scrollY / max, 0, 1) : 0;
      fill.style.transform = `scaleX(${pct.toFixed(4)})`;
      fill.style.width = '100%';
      queued = false;
    };
    window.addEventListener('scroll', () => {
      if(!queued){ queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---- nav --------------------------------------------------- */
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');
  const links = nav ? Array.from(nav.querySelectorAll('.nav-link[data-section]')) : [];

  if(nav && hero){
    new IntersectionObserver(([entry]) => {
      nav.classList.toggle('is-up', !entry.isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: 0 }).observe(hero);
  }else if(nav){
    nav.classList.add('is-up');
  }

  const ACCENTS = { work: 'slate', about: 'gold', contact: 'rose' };
  const sections = links.map(l => document.getElementById(l.dataset.section)).filter(Boolean);

  if(sections.length){
    const io = new IntersectionObserver(entries => {
      const best = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if(!best) return;
      const id = best.target.id;
      links.forEach(l => {
        const on = l.dataset.section === id;
        l.classList.toggle('is-active', on);
        if(on) l.setAttribute('aria-current', 'true');
        else l.removeAttribute('aria-current');
      });
      // the nav borrows the colour of wherever you are
      nav && nav.classList.remove('accent-rose', 'accent-gold', 'accent-slate', 'accent-plum');
      nav && nav.classList.add('accent-' + (ACCENTS[id] || 'rose'));
    }, { rootMargin: '-26% 0px -56% 0px', threshold: [0, .12, .3, .6] });
    sections.forEach(s => io.observe(s));
  }

  /* ============================================================
     Command palette — ⌘K / Ctrl-K / "/"
     A nod to the command palette in Runway, and the fastest way
     around this page if you would rather not scroll.
     ============================================================ */
  const palette = document.getElementById('palette');
  if(!palette) return;

  const input   = document.getElementById('paletteInput');
  const listEl  = document.getElementById('paletteList');
  const openBtn = document.getElementById('paletteOpen');

  const goto = id => {
    const el = document.getElementById(id);
    if(el) el.scrollIntoView({ behavior: TJ.reduced ? 'auto' : 'smooth', block: 'start' });
  };

  const COMMANDS = [
    { kind: 'go',      ico: '§', label: 'Work',    run: () => goto('work') },
    { kind: 'go',      ico: '§', label: 'About',   run: () => goto('about') },
    { kind: 'go',      ico: '§', label: 'Contact', run: () => goto('contact') },
    { kind: 'go',      ico: '§', label: 'Top',     run: () => goto('hero') },
    { kind: 'open',    ico: '↗', label: 'Resume',   run: () => window.open('resume.html', '_blank', 'noopener') },
    { kind: 'open',    ico: '↗', label: 'GitHub',   run: () => window.open('https://github.com/tjblech', '_blank', 'noopener') },
    { kind: 'open',    ico: '↗', label: 'LinkedIn', run: () => window.open('https://www.linkedin.com/in/tj-blechman', '_blank', 'noopener') },
    { kind: 'action',  ico: '✉', label: 'Email me', run: () => { window.location.href = 'mailto:tjblech@gmail.com'; } },
    { kind: 'action',  ico: '♞', label: 'Play chess', run: () => {
        goto('hero');
        setTimeout(() => window.dispatchEvent(new CustomEvent('tj:chess-open')), TJ.reduced ? 0 : 520);
      } }
  ];

  function allItems(){
    const projects = (window.TJ_PROJECTS || []).map(p => ({
      kind: 'project', ico: '▸', label: p.title,
      run: () => window.dispatchEvent(new CustomEvent('tj:select-project', { detail: { slug: p.slug } }))
    }));
    return projects.concat(COMMANDS);
  }

  let results = [];
  let cursor = 0;
  let lastFocus = null;

  /* forgiving subsequence match, so "mfh" finds Measured From Here */
  function score(query, text){
    if(!query) return 1;
    const q = query.toLowerCase(), t = text.toLowerCase();
    if(t.includes(q)) return 100 - t.indexOf(q);
    let i = 0, hits = 0;
    for(const ch of t){
      if(ch === q[i]){ i++; hits++; }
      if(i >= q.length) break;
    }
    return i >= q.length ? hits : 0;
  }

  function render(){
    const q = input.value.trim();
    results = allItems()
      .map(it => ({ it, s: score(q, it.label + ' ' + it.kind) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(r => r.it);

    cursor = 0;
    listEl.innerHTML = '';
    if(!results.length){
      listEl.innerHTML = '<li class="palette-empty">nothing matches that</li>';
      return;
    }
    results.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'palette-item';
      li.id = 'paletteItem' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      li.innerHTML = `<span class="ico">${it.ico}</span><span>${it.label}</span><span class="kind">${it.kind}</span>`;
      li.addEventListener('click', () => choose(i));
      li.addEventListener('pointermove', () => move(i));
      listEl.appendChild(li);
    });
    input.setAttribute('aria-activedescendant', 'paletteItem0');
  }

  function move(i){
    if(!results.length) return;
    cursor = (i + results.length) % results.length;
    Array.from(listEl.children).forEach((li, n) => {
      li.setAttribute('aria-selected', n === cursor ? 'true' : 'false');
      if(n === cursor) li.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', 'paletteItem' + cursor);
  }

  function choose(i){
    const item = results[i != null ? i : cursor];
    close();
    if(item) setTimeout(() => item.run(), 60);
  }

  function open(){
    lastFocus = document.activeElement;
    palette.classList.add('is-open');
    palette.removeAttribute('inert');
    input.value = '';
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close(){
    palette.classList.remove('is-open');
    palette.setAttribute('inert', '');
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  palette.setAttribute('inert', '');
  openBtn && openBtn.addEventListener('click', open);
  palette.addEventListener('click', e => { if(e.target === palette) close(); });
  input.addEventListener('input', render);

  input.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); move(cursor + 1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); move(cursor - 1); }
    else if(e.key === 'Enter'){ e.preventDefault(); choose(); }
    else if(e.key === 'Escape'){ e.preventDefault(); close(); }
  });

  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
                || document.activeElement.isContentEditable;
    const isOpen = palette.classList.contains('is-open');

    if((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)){
      e.preventDefault();
      isOpen ? close() : open();
      return;
    }
    if(e.key === '/' && !typing && !isOpen){
      e.preventDefault();
      open();
    }
  });

  /* Only Macs reliably have the ⌘ glyph, and only Macs use it.
     Everyone else gets "/" or "Ctrl K", both of which work. */
  const navKey = document.getElementById('navKey');
  if(navKey){
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    navKey.textContent = isMac ? '\u2318K' : '/';
    const btn = navKey.closest('.nav-key');
    if(btn) btn.setAttribute('aria-label',
      'Open the jump menu (' + (isMac ? 'Command K' : 'slash or Control K') + ')');
  }

  /* ---- structured data --------------------------------------- */
  const schema = document.createElement('script');
  schema.type = 'application/ld+json';
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'TJ Blechman',
    alternateName: 'Tory Blechman',
    url: 'https://tjblech.github.io/',
    image: 'https://tjblech.github.io/og-image.png',
    email: 'mailto:tjblech@gmail.com',
    jobTitle: 'Computer Science and Business Student',
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Northeastern University' },
    knowsAbout: ['Software Engineering', 'Startups', 'Web Development', 'Embedded Hardware'],
    sameAs: ['https://github.com/tjblech', 'https://www.linkedin.com/in/tj-blechman']
  });
  document.head.appendChild(schema);
})();

/* Kick off the reveal system last, so every section has already
   registered its tj:reveal listeners. */
TJ.reveal();

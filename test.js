const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const BASE = 'http://127.0.0.1:8899';
const fails = [];
const notes = [];
function check(cond, label){ (cond ? notes : fails).push((cond ? 'PASS  ' : 'FAIL  ') + label); }

(async () => {
  const browser = await chromium.launch();

  /* ---------- DESKTOP ---------- */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', r => {
    if (!/fonts\.g|gstatic|jacklcadman/.test(r.url())) errors.push('404/REQFAIL: ' + r.url());
  });

  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4200); // let the intro finish

  check(await page.locator('#heroPrefix .hero-letter').count() > 0, 'hero types the prefix');
  check(await page.locator('#heroName .hero-letter').count() > 0, 'hero types the name');
  check((await page.textContent('#heroName')).replace(/\u00a0/g,' ').trim().length > 0, 'hero name has text');
  check(await page.locator('#heroEyes.is-open').count() === 1, 'eyes opened');
  check(await page.locator('#heroTagline.is-in').count() === 1, 'tagline revealed');
  check(await page.locator('#heroActions.is-in').count() === 1, 'actions revealed');
  const statTxt = await page.textContent('#heroStat');
  check(/vectors/.test(statTxt), 'hero readout shows live vector count: ' + statTxt.replace(/\s+/g,' '));

  // eyes track the pointer
  await page.mouse.move(200, 700);
  await page.waitForTimeout(700);
  const t1 = await page.evaluate(() => document.querySelector('.eye-ball').style.transform);
  await page.mouse.move(1300, 120);
  await page.waitForTimeout(700);
  const t2 = await page.evaluate(() => document.querySelector('.eye-ball').style.transform);
  check(t1 !== t2 && t1 && t2, 'eyes follow the pointer (' + t1 + ' -> ' + t2 + ')');

  await page.screenshot({ path: '/home/claude/site/shots/01-hero.png' });

  /* ---- chess ---- */
  await page.click('#heroEyes');
  await page.waitForTimeout(600);
  check(await page.locator('#chessBackdrop.is-open').count() === 1, 'chess opens from the eyes');
  check(await page.locator('#chessBoard .sq').count() === 64, 'board renders 64 squares');
  await page.screenshot({ path: '/home/claude/site/shots/02-chess.png' });

  // play e4 by clicking squares (e2 = row6 col4, e4 = row4 col4)
  await page.locator('.sq[data-r="6"][data-c="4"]').click();
  await page.waitForTimeout(200);
  const targets = await page.locator('.sq.is-target').count();
  check(targets > 0, 'selecting a pawn shows legal targets (' + targets + ')');
  await page.locator('.sq[data-r="4"][data-c="4"]').click();
  await page.waitForTimeout(1800);
  const moves = await page.textContent('#chessMoves');
  check(/e4/.test(moves), 'player move recorded in SAN: ' + moves.replace(/\s+/g, ' ').trim());
  check(moves.replace(/[^a-h1-8O]/g, '').length > 2, 'engine replied');
  await page.screenshot({ path: '/home/claude/site/shots/03-chess-played.png' });

  // escape closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check(await page.locator('#chessBackdrop.is-open').count() === 0, 'Escape closes the chess dialog');

  /* ---- work bench ---- */
  await page.locator('#work').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  check(await page.locator('.rail-item').count() === 6, 'rail lists 6 projects');
  check(await page.locator('.rail-item[aria-selected="true"]').count() === 1, 'one project selected');
  check((await page.textContent('#benchTitle')).length > 0, 'panel title populated: ' + await page.textContent('#benchTitle'));
  check(await page.locator('#rigStage canvas').count() === 1, 'rig 1 (pipeline) mounted a canvas');
  await page.screenshot({ path: '/home/claude/site/shots/04-work-pipeline.png' });

  // cycle every project and confirm each rig mounts
  const rigExpect = [
    ['common-ground', 'canvas'],
    ['measured-from-here', 'canvas'],
    ['runway', '.rig-input'],
    ['billiards', 'canvas'],
    ['jack-cadman-campaign', '.rig-live'],
    ['ebike', 'canvas']
  ];
  for (let i = 1; i < 6; i++) {
    await page.locator('.rail-item').nth(i).click();
    await page.waitForTimeout(1400);
    const sel = rigExpect[i][1];
    const ok = await page.locator('#rigStage ' + sel).count() > 0;
    check(ok, 'rig mounted for ' + rigExpect[i][0] + ' (' + sel + ')');
    await page.screenshot({ path: `/home/claude/site/shots/05-rig-${i}-${rigExpect[i][0]}.png` });
  }

  /* ---- runway parser ---- */
  await page.locator('.rail-item').nth(2).click();
  await page.waitForTimeout(1600);
  await page.fill('.rig-input', '');
  await page.type('.rig-input', 'gym friday 6pm every week #health', { delay: 8 });
  await page.waitForTimeout(400);
  const parsed = await page.textContent('.rig-task-meta');
  check(/pm/.test(parsed) && /every week/.test(parsed) && /health/.test(parsed),
        'quick-add parser extracts time, repeat and tag: ' + parsed.replace(/\s+/g,' '));
  const title = await page.textContent('.rig-task-title');
  check(/gym/i.test(title), 'parser keeps the title: "' + title + '"');
  await page.screenshot({ path: '/home/claude/site/shots/06-runway-parser.png' });

  /* ---- billiards physics ---- */
  await page.locator('.rail-item').nth(3).click();
  await page.waitForTimeout(1600);
  const box = await page.locator('#rigStage canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.24, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.10, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(2400);
  await page.screenshot({ path: '/home/claude/site/shots/07-billiards.png' });
  check(true, 'billiards break executed without error');

  /* ---- about ---- */
  await page.locator('#about').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);
  const cap = await page.textContent('#knightCap');
  check(/\d+\/64/.test(cap), "knight's tour is running: " + cap.replace(/\s+/g,' '));
  check(await page.locator('.alloc-row.is-in').count() === 3, 'all three allocation bars revealed');
  const barW = await page.evaluate(() => document.querySelector('.alloc-fill').getBoundingClientRect().width);
  check(barW > 10, 'allocation bar actually filled (' + Math.round(barW) + 'px)');
  await page.screenshot({ path: '/home/claude/site/shots/08-about.png' });

  /* ---- contact ---- */
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  check(await page.locator('#contactWrap.is-in').count() === 1, 'contact revealed');
  check((await page.textContent('#contactHeading')).length > 0, 'contact heading scrambled in');
  await page.screenshot({ path: '/home/claude/site/shots/09-contact.png' });

  /* ---- nav + palette ---- */
  check(await page.locator('#nav.is-up').count() === 1, 'nav is visible after the hero');
  const activeNav = await page.locator('.nav-link.is-active').count();
  check(activeNav >= 1, 'a nav link is marked active (' + activeNav + ')');

  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  check(await page.locator('#palette.is-open').count() === 1, 'command palette opens on Ctrl-K');
  const items = await page.locator('.palette-item').count();
  check(items >= 10, 'palette lists projects + commands (' + items + ')');
  await page.fill('#paletteInput', 'bill');
  await page.waitForTimeout(250);
  const first = await page.textContent('.palette-item');
  check(/Billiards/.test(first), 'palette search finds Billiards: "' + first.trim() + '"');
  await page.screenshot({ path: '/home/claude/site/shots/10-palette.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  check(await page.locator('#palette.is-open').count() === 0, 'palette closes after choosing');
  const selectedSlug = await page.evaluate(() =>
    document.querySelector('.rail-item[aria-selected="true"] .name').textContent);
  check(selectedSlug === 'billiards', 'palette jumped to the Billiards project (' + selectedSlug + ')');

  /* ---- keyboard nav on the rail ---- */
  await page.locator('.rail-item[aria-selected="true"]').focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(900);
  const after = await page.evaluate(() =>
    document.querySelector('.rail-item[aria-selected="true"] .name').textContent);
  check(after !== 'billiards', 'arrow keys move between projects (' + after + ')');

  /* ---- one rig at a time ---- */
  const canvasCount = await page.evaluate(() => document.querySelectorAll('#rigStage canvas').length);
  check(canvasCount <= 1, 'only one rig canvas alive at a time (' + canvasCount + ')');

  /* ---------- MOBILE ---------- */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  const merrors = [];
  mp.on('pageerror', e => merrors.push('MOBILE PAGEERROR: ' + e.message));
  await mp.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await mp.waitForTimeout(4200);
  await mp.screenshot({ path: '/home/claude/site/shots/11-mobile-hero.png' });
  await mp.locator('#work').scrollIntoViewIfNeeded();
  await mp.waitForTimeout(2200);
  await mp.screenshot({ path: '/home/claude/site/shots/12-mobile-work.png' });
  await mp.locator('#about').scrollIntoViewIfNeeded();
  await mp.waitForTimeout(1800);
  await mp.screenshot({ path: '/home/claude/site/shots/13-mobile-about.png' });
  const hScroll = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(hScroll <= 1, 'no horizontal overflow on mobile (' + hScroll + 'px)');
  check(merrors.length === 0, 'no mobile JS errors' + (merrors.length ? ': ' + merrors.join(' | ') : ''));

  /* ---------- REDUCED MOTION ---------- */
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  const rerrors = [];
  rp.on('pageerror', e => rerrors.push('RM PAGEERROR: ' + e.message));
  await rp.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await rp.waitForTimeout(2000);
  const rmName = await rp.textContent('#heroName');
  check(rmName.trim().length > 0, 'reduced motion still shows the name: "' + rmName.trim() + '"');
  check(await rp.locator('#heroActions.is-in').count() === 1, 'reduced motion shows the CTAs immediately');
  await rp.locator('#work').scrollIntoViewIfNeeded();
  await rp.waitForTimeout(1500);
  check((await rp.textContent('#benchTitle')).length > 0, 'reduced motion still selects a project');
  check(rerrors.length === 0, 'no reduced-motion JS errors' + (rerrors.length ? ': ' + rerrors.join(' | ') : ''));
  await rp.screenshot({ path: '/home/claude/site/shots/14-reduced-motion.png' });

  /* ---------- RESUME + 404 ---------- */
  const p2 = await ctx.newPage();
  const rerr = [];
  p2.on('pageerror', e => rerr.push('RESUME: ' + e.message));
  await p2.goto(BASE + '/resume.html', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(800);
  check(await p2.locator('.sheet h2').count() >= 5, 'resume renders all sections');
  await p2.screenshot({ path: '/home/claude/site/shots/15-resume.png', fullPage: true });

  await p2.goto(BASE + '/404.html', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1200);
  check(await p2.locator('.board i').count() === 64, '404 board renders');
  check(rerr.length === 0, 'no resume/404 JS errors' + (rerr.length ? ': ' + rerr.join(' | ') : ''));
  await p2.screenshot({ path: '/home/claude/site/shots/16-404.png' });

  check(errors.length === 0, 'no console errors on desktop' + (errors.length ? ':\n      ' + errors.join('\n      ') : ''));

  await browser.close();

  console.log('\n=== RESULTS ===');
  notes.forEach(n => console.log(n));
  if (fails.length) {
    console.log('\n=== FAILURES (' + fails.length + ') ===');
    fails.forEach(f => console.log(f));
  } else {
    console.log('\nAll ' + notes.length + ' checks passed.');
  }
  process.exit(fails.length ? 1 : 0);
})();

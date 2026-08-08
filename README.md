# tjblech.github.io

My personal site. Hand-written HTML, CSS and JavaScript, no framework, no build
step, no dependencies. Clone it and open `index.html` and it runs.

**Live:** https://tjblech.github.io

---

## The idea

Most portfolios describe projects. This one runs them.

Every project in the Work section loads a small working version of its own
central idea, live in the page. Not a screenshot, not a video, not an iframe of
something else. If a project's interesting part is a parser, you can type into
the parser. If it's physics, you can hit the ball.

| Project | What loads on the page |
|---|---|
| Common Ground | The Form → Sheets approval → Calendar pipeline, with events moving through it |
| Measured From Here | A logarithmic scale you drag through 27 decades of real distance references |
| Runway | The natural-language quick-add parser. Type `gym friday 6pm every week #health` |
| Billiards Tournament Manager | A pool table with real elastic collisions. Drag back from the cue ball |
| Jack Cadman Campaign | The actual deployed site, loaded on demand |
| Mountain Bike → Ebike | A battery/controller/motor model with live V, A and W readouts |

Only one rig is alive at a time. It is created when its project is selected and
destroyed when you pick another or scroll the section off screen.

---

## Things worth finding

- Click the eyes in the hero. There's a full chess game behind them: castling,
  en passant, promotion, the fifty-move rule, algebraic notation, undo, and an
  alpha-beta engine with iterative deepening. Playable entirely from the
  keyboard (arrows to move, enter to select, esc to close).
- Press `/` or `⌘K` anywhere for a command palette that jumps to any project or
  section. It's a nod to the command palette in Runway.
- Move the pointer around the hero. The vector field bends toward it. Click the
  eyes and the whole field snaps into rank and file.
- The board in the About section is solving a real knight's tour with
  Warnsdorff's rule: 64 squares, each visited exactly once, then it starts over
  from a new square.

---

## Layout

```
index.html          the whole site, one page
resume.html         standalone, screen and print
404.html
css/
  fonts.css         self-hosted @font-face
  tokens.css        the design system: colour, type scale, spacing, motion
  base.css          reset, typography, shared section primitives, reveals
  shell.css         progress bar, nav, command palette
  hero.css          chess.css   work.css   rigs.css   about.css   contact.css
js/
  core.js           shared runtime — read this first
  hero.js           vector field, eyes, typed intro
  chess.js          engine + accessible dialog
  work.js           project data and the rig lifecycle
  rigs.js           the six live demos
  about.js          knight's tour
  contact.js        converging field
  shell.js          nav, progress, command palette, structured data
fonts/              three variable woff2 files, latin subset, ~125 KB total
```

Scripts load in dependency order at the end of `<body>`. `core.js` must come
first; `shell.js` must come last, because it calls `TJ.reveal()` once every
section has registered its listeners.

---

## core.js

Everything animated on this site goes through three shared primitives, because
the alternative is what this repo used to have: six `requestAnimationFrame`
loops, four IntersectionObservers and three copies of the same scramble
function.

**One ticker.** `TJ.tick(fn)` registers an animation. There is exactly one rAF
loop for the whole page. Anything off screen or in a background tab is not
called at all, and when nothing is animating the loop stops rather than idling.

**One canvas helper.** `TJ.canvas(el, { init, draw, still })` handles device
pixel ratio, resizing, and caches width and height so draw loops never call
`getBoundingClientRect()`. It registers with the ticker and gates itself on
visibility automatically. Under `prefers-reduced-motion` it paints `still()`
once and never animates.

**One pointer, one reveal observer.** `TJ.pointer` is a single smoothed
listener. `TJ.reveal()` drives every `[data-reveal]` element on the page and
fires a `tj:reveal` event so sections can hook their own entrance behaviour.

Also there: `TJ.scramble`, `TJ.reduced`, `TJ.onVisible`, `TJ.wait`, and the
usual `clamp` / `lerp` / `rand`.

---

## Adding a project

Add an entry to `PROJECTS` in `js/work.js`:

```js
{
  slug: 'thing',              // shown in the rail, used by the palette
  title: 'The Thing',
  status: 'live',             // or 'in progress'
  accent: 'gold',             // rose | gold | slate | plum
  blurb: '…',
  note: ['label', 'one sentence about the hard part'],
  tags: ['JavaScript'],
  link: 'https://…',          // null renders "still in the garage"
  rig: 'pipeline',            // a key in window.RIGS
  hint: 'press submit'        // the affordance shown above the stage
}
```

The accent re-points the `--accent` custom property on the whole Work section,
so the rail, the note border, the links and the rig's canvas colours all follow
without any per-project CSS.

To add a new kind of rig, export `create(mount, accentColour, opts)` from
`js/rigs.js` returning `{ destroy() }`. Use `TJ.canvas` for anything drawn, and
clean up your own listeners in `destroy()`.

---

## Accessibility

- Full keyboard path through everything, including the chess board (roving
  tabindex over the grid) and the project rail (arrow keys, Home, End).
- The chess dialog and the command palette trap focus, close on Escape, mark
  themselves `inert` when closed, and restore focus to whatever opened them.
- `prefers-reduced-motion` is honoured in both CSS and JS. Canvases paint one
  static frame; the typed intro resolves immediately; the name stops cycling.
- Decorative canvases are `aria-hidden`. Scrambling headings carry an
  unscrambled `.sr-only` copy so screen readers never read the noise.
- One visible focus ring, defined once, in the current section's accent colour.

## Performance

- The hero field is roughly 1,500 segments batched into four stroke calls per
  frame. Per-column and per-row trig is computed once per frame rather than per
  cell.
- Nothing off screen animates. Scroll past the bench and its rig is destroyed;
  scroll back and it is rebuilt.
- Fonts are self-hosted variable woff2, latin subset, about 125 KB for all
  three families, with the two used above the fold preloaded. No third-party
  font request, so no render-blocking round trip to another origin.

## Tests

`test.js` at the repo root drives a real headless Chromium over the built site:
intro sequence, eye tracking, chess play, every rig mounting, the parser, the
palette, mobile layout, reduced motion, the resume and the 404. The chess rules
and engine have their own unit tests covering castling, en passant, pins,
promotion, mate, stalemate and the search time budget.

---

## Licence

MIT for the code. The writing, the résumé content and the project descriptions
are mine.

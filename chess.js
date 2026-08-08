/* ============================================================
   chess.js

   The easter egg behind the eyes. Rewritten from the original,
   which was a legal-move generator missing castling, en passant
   and the fifty-move rule, searching one ply.

   This one plays full rules, searches with alpha-beta and
   iterative deepening inside a time budget so it never freezes
   the page, and is completely playable from the keyboard.
   ============================================================ */

(function(){
  'use strict';

  const backdrop  = document.getElementById('chessBackdrop');
  const boardEl   = document.getElementById('chessBoard');
  const statusEl  = document.getElementById('chessStatus');
  const movesEl   = document.getElementById('chessMoves');
  const closeBtn  = document.getElementById('chessClose');
  const resetBtn  = document.getElementById('chessReset');
  const undoBtn   = document.getElementById('chessUndo');
  if(!backdrop || !boardEl) return;

  const W = 'w', B = 'b';
  const other = c => c === W ? B : W;
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  /* ---- position -------------------------------------------- */
  function startPosition(){
    const back = ['r','n','b','q','k','b','n','r'];
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for(let c = 0; c < 8; c++){
      board[0][c] = { t: back[c], c: B };
      board[1][c] = { t: 'p', c: B };
      board[6][c] = { t: 'p', c: W };
      board[7][c] = { t: back[c], c: W };
    }
    return {
      board,
      turn: W,
      castle: { wk: true, wq: true, bk: true, bq: true },
      ep: null,          // [r,c] square behind a pawn that just double-stepped
      half: 0,           // halfmove clock, for the fifty-move rule
      full: 1
    };
  }

  const clone = p => ({
    board: p.board.map(row => row.map(sq => sq ? { t: sq.t, c: sq.c } : null)),
    turn: p.turn,
    castle: { ...p.castle },
    ep: p.ep ? [p.ep[0], p.ep[1]] : null,
    half: p.half,
    full: p.full
  });

  /* ---- attacks --------------------------------------------- */
  const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const DIAG   = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const ORTHO  = [[-1,0],[1,0],[0,-1],[0,1]];

  function attacks(board, r, c, out){
    const p = board[r][c];
    out.length = 0;
    if(!p) return out;
    const { t, c: col } = p;

    if(t === 'p'){
      const d = col === W ? -1 : 1;
      if(inside(r+d, c-1)) out.push(r+d, c-1);
      if(inside(r+d, c+1)) out.push(r+d, c+1);
    }else if(t === 'n'){
      for(const [dr,dc] of KNIGHT) if(inside(r+dr, c+dc)) out.push(r+dr, c+dc);
    }else if(t === 'k'){
      for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++){
        if((dr || dc) && inside(r+dr, c+dc)) out.push(r+dr, c+dc);
      }
    }else{
      const dirs = t === 'b' ? DIAG : t === 'r' ? ORTHO : DIAG.concat(ORTHO);
      for(const [dr,dc] of dirs){
        let rr = r+dr, cc = c+dc;
        while(inside(rr, cc)){
          out.push(rr, cc);
          if(board[rr][cc]) break;
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  const scratch = [];
  function attacked(board, r, c, by){
    for(let rr = 0; rr < 8; rr++){
      for(let cc = 0; cc < 8; cc++){
        const p = board[rr][cc];
        if(!p || p.c !== by) continue;
        attacks(board, rr, cc, scratch);
        for(let i = 0; i < scratch.length; i += 2){
          if(scratch[i] === r && scratch[i+1] === c) return true;
        }
      }
    }
    return false;
  }

  function kingSquare(board, col){
    for(let r = 0; r < 8; r++) for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(p && p.t === 'k' && p.c === col) return [r, c];
    }
    return null;
  }

  const inCheck = (pos, col) => {
    const k = kingSquare(pos.board, col);
    return k ? attacked(pos.board, k[0], k[1], other(col)) : false;
  };

  /* ---- move generation ------------------------------------- */
  function pseudoMoves(pos, col){
    const { board } = pos;
    const moves = [];
    const push = (fr,fc,tr,tc,flag) => moves.push({ fr, fc, tr, tc, flag: flag || 0 });

    for(let r = 0; r < 8; r++) for(let c = 0; c < 8; c++){
      const p = board[r][c];
      if(!p || p.c !== col) continue;

      if(p.t === 'p'){
        const d = col === W ? -1 : 1;
        const home = col === W ? 6 : 1;
        const last = col === W ? 0 : 7;
        if(inside(r+d, c) && !board[r+d][c]){
          push(r, c, r+d, c, r+d === last ? 'promo' : 0);
          if(r === home && !board[r+2*d][c]) push(r, c, r+2*d, c, 'double');
        }
        for(const cc of [c-1, c+1]){
          if(!inside(r+d, cc)) continue;
          const target = board[r+d][cc];
          if(target && target.c !== col) push(r, c, r+d, cc, r+d === last ? 'promo' : 0);
          else if(!target && pos.ep && pos.ep[0] === r+d && pos.ep[1] === cc) push(r, c, r+d, cc, 'ep');
        }
      }else{
        attacks(board, r, c, scratch);
        for(let i = 0; i < scratch.length; i += 2){
          const tr = scratch[i], tc = scratch[i+1];
          const target = board[tr][tc];
          if(!target || target.c !== col) push(r, c, tr, tc);
        }
      }
    }

    // castling
    const rank = col === W ? 7 : 0;
    const rights = pos.castle;
    const kingSide  = col === W ? rights.wk : rights.bk;
    const queenSide = col === W ? rights.wq : rights.bq;
    const king = board[rank][4];
    if(king && king.t === 'k' && king.c === col && !attacked(board, rank, 4, other(col))){
      if(kingSide && !board[rank][5] && !board[rank][6]){
        const rook = board[rank][7];
        if(rook && rook.t === 'r' && rook.c === col &&
           !attacked(board, rank, 5, other(col)) && !attacked(board, rank, 6, other(col))){
          push(rank, 4, rank, 6, 'castleK');
        }
      }
      if(queenSide && !board[rank][3] && !board[rank][2] && !board[rank][1]){
        const rook = board[rank][0];
        if(rook && rook.t === 'r' && rook.c === col &&
           !attacked(board, rank, 3, other(col)) && !attacked(board, rank, 2, other(col))){
          push(rank, 4, rank, 2, 'castleQ');
        }
      }
    }
    return moves;
  }

  function apply(pos, m){
    const next = clone(pos);
    const b = next.board;
    const piece = b[m.fr][m.fc];
    const captured = b[m.tr][m.tc];

    next.half = (piece.t === 'p' || captured) ? 0 : next.half + 1;
    next.ep = null;

    b[m.tr][m.tc] = piece;
    b[m.fr][m.fc] = null;

    if(m.flag === 'ep'){
      const dir = piece.c === W ? 1 : -1;
      b[m.tr + dir][m.tc] = null;
    }
    if(m.flag === 'double'){
      next.ep = [(m.fr + m.tr) / 2, m.fc];
    }
    if(m.flag === 'promo'){
      piece.t = m.promo || 'q';
    }
    if(m.flag === 'castleK'){
      b[m.tr][5] = b[m.tr][7];
      b[m.tr][7] = null;
    }
    if(m.flag === 'castleQ'){
      b[m.tr][3] = b[m.tr][0];
      b[m.tr][0] = null;
    }

    // castling rights
    if(piece.t === 'k'){
      if(piece.c === W){ next.castle.wk = next.castle.wq = false; }
      else { next.castle.bk = next.castle.bq = false; }
    }
    if(piece.t === 'r'){
      if(m.fr === 7 && m.fc === 0) next.castle.wq = false;
      if(m.fr === 7 && m.fc === 7) next.castle.wk = false;
      if(m.fr === 0 && m.fc === 0) next.castle.bq = false;
      if(m.fr === 0 && m.fc === 7) next.castle.bk = false;
    }
    if(m.tr === 7 && m.tc === 0) next.castle.wq = false;
    if(m.tr === 7 && m.tc === 7) next.castle.wk = false;
    if(m.tr === 0 && m.tc === 0) next.castle.bq = false;
    if(m.tr === 0 && m.tc === 7) next.castle.bk = false;

    if(piece.c === B) next.full++;
    next.turn = other(pos.turn);
    return next;
  }

  function legalMoves(pos, col){
    col = col || pos.turn;
    const out = [];
    for(const m of pseudoMoves(pos, col)){
      const after = apply(pos, m);
      const k = kingSquare(after.board, col);
      if(k && !attacked(after.board, k[0], k[1], other(col))) out.push(m);
    }
    return out;
  }

  /* ---- evaluation ------------------------------------------ */
  const VAL = { p: 100, n: 320, b: 335, r: 500, q: 950, k: 0 };

  // Piece-square tables, from White's point of view.
  const PST = {
    p: [ 0,0,0,0,0,0,0,0,  50,50,50,50,50,50,50,50,  10,10,20,30,30,20,10,10,
         5,5,10,27,27,10,5,5,  0,0,0,25,25,0,0,0,  5,-5,-10,0,0,-10,-5,5,
         5,10,10,-25,-25,10,10,5,  0,0,0,0,0,0,0,0 ],
    n: [ -50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
         -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
         -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
         -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50 ],
    b: [ -20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10,
         -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
         -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
         -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20 ],
    r: [ 0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
         -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0 ],
    q: [ -20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10,
         -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5,
         -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20 ],
    k: [ -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
         -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
         -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
         20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20 ]
  };

  function evaluate(pos){
    const b = pos.board;
    let score = 0;
    for(let r = 0; r < 8; r++) for(let c = 0; c < 8; c++){
      const p = b[r][c];
      if(!p) continue;
      const idx = p.c === W ? r * 8 + c : (7 - r) * 8 + c;
      const v = VAL[p.t] + (PST[p.t] ? PST[p.t][idx] : 0);
      score += p.c === W ? v : -v;
    }
    return score;
  }

  const MVV = { p:1, n:3, b:3, r:5, q:9, k:0 };
  function order(pos, moves){
    const b = pos.board;
    for(const m of moves){
      const victim = b[m.tr][m.tc];
      const mover  = b[m.fr][m.fc];
      m.score = victim ? 10 * MVV[victim.t] - MVV[mover.t] : 0;
      if(m.flag === 'promo') m.score += 90;
    }
    moves.sort((a, z) => z.score - a.score);
    return moves;
  }

  /* Negamax with alpha-beta, from the side-to-move's perspective. */
  function negamax(pos, depth, alpha, beta, deadline){
    if(performance.now() > deadline) return null;

    const col = pos.turn;
    const moves = legalMoves(pos, col);

    if(!moves.length){
      return inCheck(pos, col) ? -90000 - depth : 0;
    }
    if(pos.half >= 100) return 0;
    if(depth === 0){
      const s = evaluate(pos);
      return col === W ? s : -s;
    }

    order(pos, moves);
    let best = -Infinity;
    for(const m of moves){
      const v = negamax(apply(pos, m), depth - 1, -beta, -alpha, deadline);
      if(v === null) return null;
      const score = -v;
      if(score > best) best = score;
      if(best > alpha) alpha = best;
      if(alpha >= beta) break;
    }
    return best;
  }

  /* Iterative deepening inside a strict time budget. The board
     never locks up, no matter how sharp the position is. */
  function think(pos, budgetMs = 280){
    const deadline = performance.now() + budgetMs;
    let root = order(pos, legalMoves(pos, pos.turn));
    if(!root.length) return null;

    let best = root[0];
    let bestEval = 0;
    let scored = [{ move: root[0], eval: 0 }];

    for(let depth = 1; depth <= 4; depth++){
      const pass = [];
      let completed = true;

      for(const m of root){
        const v = negamax(apply(pos, m), depth - 1, -Infinity, Infinity, deadline);
        if(v === null){ completed = false; break; }
        pass.push({ move: m, eval: -v });
      }

      // A pass that ran out of time is thrown away whole. Half of it
      // would mix scores from two different depths, which is how you
      // end up preferring a mate in three over a mate in one.
      if(!completed || !pass.length) break;

      pass.sort((a, z) => z.eval - a.eval);
      scored   = pass;
      best     = pass[0].move;
      bestEval = pass[0].eval;
      root     = pass.map(e => e.move);   // best move first at the next depth

      if(Math.abs(bestEval) > 50000) break;   // forced mate found, stop
    }

    // Among genuinely equal replies, vary the choice so repeat games
    // differ. Never do this when a mate is on the board: mate scores
    // at neighbouring depths sit within the tolerance below.
    if(Math.abs(bestEval) > 50000) return best;
    const peers = scored.filter(e => Math.abs(e.eval - bestEval) <= 18);
    return peers.length ? peers[(Math.random() * peers.length) | 0].move : best;
  }

  /* ---- notation -------------------------------------------- */
  const FILES = 'abcdefgh';
  const sqName = (r, c) => FILES[c] + (8 - r);

  function toSAN(pos, m){
    const p = pos.board[m.fr][m.fc];
    if(m.flag === 'castleK') return 'O-O';
    if(m.flag === 'castleQ') return 'O-O-O';
    const capture = pos.board[m.tr][m.tc] || m.flag === 'ep';
    let s = '';
    if(p.t === 'p'){
      if(capture) s += FILES[m.fc] + 'x';
    }else{
      s += p.t.toUpperCase();
      // disambiguate when another same-type piece could also go there
      const rivals = legalMoves(pos, p.c).filter(o =>
        o.tr === m.tr && o.tc === m.tc &&
        !(o.fr === m.fr && o.fc === m.fc) &&
        pos.board[o.fr][o.fc].t === p.t);
      if(rivals.length){
        s += rivals.every(o => o.fc !== m.fc) ? FILES[m.fc] : String(8 - m.fr);
      }
      if(capture) s += 'x';
    }
    s += sqName(m.tr, m.tc);
    if(m.flag === 'promo') s += '=Q';
    const after = apply(pos, m);
    if(inCheck(after, after.turn)){
      s += legalMoves(after, after.turn).length ? '+' : '#';
    }
    return s;
  }

  /* ============================================================
     UI
     ============================================================ */
  const GLYPH = {
    w: { p:'♙', n:'♘', b:'♗', r:'♖', q:'♕', k:'♔' },
    b: { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' }
  };

  let pos, history, selected, cursor, thinking, over, squares, sanList;

  function build(){
    boardEl.innerHTML = '';
    squares = [];
    for(let r = 0; r < 8; r++){
      for(let c = 0; c < 8; c++){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
        btn.dataset.r = r; btn.dataset.c = c;
        btn.tabIndex = -1;
        btn.addEventListener('click', () => { cursor = [r, c]; pick(r, c); });
        boardEl.appendChild(btn);
        squares.push(btn);
      }
    }
  }

  const at = (r, c) => squares[r * 8 + c];

  function render(){
    const legal = over ? [] : legalMoves(pos, pos.turn);
    const targets = selected
      ? legal.filter(m => m.fr === selected[0] && m.fc === selected[1])
      : [];

    const checkSq = inCheck(pos, pos.turn) ? kingSquare(pos.board, pos.turn) : null;

    for(let r = 0; r < 8; r++) for(let c = 0; c < 8; c++){
      const el = at(r, c);
      const p = pos.board[r][c];
      const move = targets.find(m => m.tr === r && m.tc === c);

      el.textContent = p ? GLYPH[p.c][p.t] : '';
      el.classList.toggle('is-white', !!p && p.c === W);
      el.classList.toggle('is-black', !!p && p.c === B);
      el.classList.toggle('is-selected', !!selected && selected[0] === r && selected[1] === c);
      el.classList.toggle('is-target', !!move && !pos.board[r][c] && move.flag !== 'ep');
      el.classList.toggle('is-capture', !!move && (!!pos.board[r][c] || move.flag === 'ep'));
      el.classList.toggle('is-check', !!checkSq && checkSq[0] === r && checkSq[1] === c);
      el.classList.toggle('is-cursor', cursor[0] === r && cursor[1] === c);
      el.tabIndex = (cursor[0] === r && cursor[1] === c) ? 0 : -1;

      const name = sqName(r, c);
      const who = p ? `${p.c === W ? 'white' : 'black'} ${({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'})[p.t]}` : 'empty';
      el.setAttribute('aria-label', `${name}, ${who}${move ? ', legal move' : ''}`);
    }

    movesEl.innerHTML = '';
    for(let i = 0; i < sanList.length; i += 2){
      const row = document.createElement('li');
      row.innerHTML = `<span class="n">${i / 2 + 1}.</span>` +
                      `<span class="m">${sanList[i] || ''}</span>` +
                      `<span class="m">${sanList[i + 1] || ''}</span>`;
      movesEl.appendChild(row);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
    undoBtn.disabled = history.length < 2 || thinking;
  }

  function say(text){ statusEl.textContent = text; }

  function status(){
    const legal = legalMoves(pos, pos.turn);
    if(!legal.length){
      over = true;
      if(inCheck(pos, pos.turn)) say(pos.turn === W ? 'checkmate. the engine got you.' : 'checkmate. you got it.');
      else say('stalemate. drawn.');
      return true;
    }
    if(pos.half >= 100){ over = true; say('draw by the fifty-move rule.'); return true; }
    if(inCheck(pos, pos.turn)) say(pos.turn === W ? 'you are in check.' : 'engine is in check.');
    else say(pos.turn === W ? 'your move.' : 'thinking…');
    return false;
  }

  function commit(m){
    sanList.push(toSAN(pos, m));
    pos = apply(pos, m);
    history.push(clone(pos));
    selected = null;
    render();
    if(status()) return;
    if(pos.turn === B) engineTurn();
  }

  function engineTurn(){
    thinking = true;
    render();
    // Yield twice so the player's move paints before we search.
    requestAnimationFrame(() => setTimeout(() => {
      const m = think(pos, 280);
      thinking = false;
      if(!m){ status(); return; }
      commit(m);
    }, 220));
  }

  function pick(r, c){
    if(over || thinking || pos.turn !== W) return;
    const legal = legalMoves(pos, W);

    if(selected){
      const m = legal.find(x => x.fr === selected[0] && x.fc === selected[1] && x.tr === r && x.tc === c);
      if(m){ commit(m); return; }
      const p = pos.board[r][c];
      selected = (p && p.c === W) ? [r, c] : null;
      render();
      return;
    }
    const p = pos.board[r][c];
    if(p && p.c === W){ selected = [r, c]; render(); }
  }

  function reset(){
    pos = startPosition();
    history = [clone(pos)];
    sanList = [];
    selected = null;
    cursor = [6, 4];
    thinking = false;
    over = false;
    say('you are white. your move.');
    render();
  }

  function undo(){
    if(history.length < 2 || thinking) return;
    // step back a full move so it stays the player's turn
    history.pop();
    if(history.length > 1 && history[history.length - 1].turn !== W) history.pop();
    pos = clone(history[history.length - 1]);
    sanList = sanList.slice(0, (history.length - 1));
    over = false;
    selected = null;
    status();
    render();
  }

  /* ---- keyboard: roving cursor over the grid ---------------- */
  boardEl.addEventListener('keydown', e => {
    const map = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
    if(map[e.key]){
      e.preventDefault();
      cursor = [
        TJ.clamp(cursor[0] + map[e.key][0], 0, 7),
        TJ.clamp(cursor[1] + map[e.key][1], 0, 7)
      ];
      render();
      at(cursor[0], cursor[1]).focus();
      return;
    }
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      pick(cursor[0], cursor[1]);
      at(cursor[0], cursor[1]).focus();
    }
    if(e.key === 'Escape' && selected){
      e.preventDefault();
      selected = null;
      render();
    }
  });

  /* ---- modal ----------------------------------------------- */
  let lastFocus = null;
  let built = false;

  function open(){
    lastFocus = document.activeElement;
    backdrop.classList.add('is-open');
    backdrop.removeAttribute('inert');
    document.body.style.overflow = 'hidden';
    if(!built){ build(); reset(); built = true; }
    requestAnimationFrame(() => at(cursor[0], cursor[1]).focus());
  }

  function close(){
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('inert', '');
    document.body.style.overflow = '';
    window.dispatchEvent(new CustomEvent('tj:chess-close'));
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  window.addEventListener('tj:chess-open', open);
  closeBtn.addEventListener('click', close);
  resetBtn.addEventListener('click', () => { reset(); at(cursor[0], cursor[1]).focus(); });
  undoBtn.addEventListener('click', () => { undo(); at(cursor[0], cursor[1]).focus(); });

  backdrop.addEventListener('click', e => { if(e.target === backdrop) close(); });

  // Escape closes; Tab is trapped inside the dialog.
  backdrop.addEventListener('keydown', e => {
    if(e.key === 'Escape' && !selected){ e.preventDefault(); close(); return; }
    if(e.key !== 'Tab') return;
    const focusable = backdrop.querySelectorAll(
      'button:not([disabled]):not([tabindex="-1"]), [href], [tabindex="0"]'
    );
    if(!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });

  backdrop.setAttribute('inert', '');
})();

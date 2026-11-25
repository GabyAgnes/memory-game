(function () {
  'use strict';

  var PEOPLE = window.PEOPLE || [];
  var STORE_KEY = 'memory-game-quem-e-quem-v1';
  var byId = {};
  PEOPLE.forEach(function (p) { byId[p.id] = p; });

  var board = document.getElementById('board');
  var boardWrap = document.getElementById('board-wrap');
  var hint = document.getElementById('hint');
  var el = function (id) { return document.getElementById(id); };

  var state = null;     // { mode, order:[{id,kind}], matched:[ids], tries, elapsed, started }
  var up = [];          // índices das cartas abertas/selecionadas (máx. 2)
  var locked = false;   // aguardando "virar de volta"
  var timer = null;
  var lastMatchId = null;

  /* ---------- utilidades ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento */ }
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s && s.order && s.order.length === PEOPLE.length * 2 &&
          s.order.every(function (c) { return byId[c.id]; })) return s;
    } catch (e) { /* ignora */ }
    return null;
  }
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function cardHTML(p, kind) {
    if (kind === 'pessoa') return p.frontImg ? '<img class="card-img" src="' + p.frontImg + '" alt="">' : p.front;
    return p.backImg ? '<img class="card-img" src="' + p.backImg + '" alt="">' : p.back;
  }
  function label(c) {
    return c.kind === 'pessoa' ? 'Carta da pessoa' : 'Carta de perfil profissional';
  }

  var BACK_SVG =
    '<svg viewBox="0 0 120 120" aria-hidden="true" fill="none">' +
    '<circle cx="60" cy="60" r="56" stroke="#A78BFA" stroke-opacity=".25"/>' +
    '<circle cx="60" cy="60" r="42" stroke="#A78BFA" stroke-opacity=".4"/>' +
    '<circle cx="60" cy="60" r="28" stroke="#A78BFA" stroke-opacity=".6"/>' +
    '<path d="M60 60 L22 34 A46 46 0 0 0 16 58 Z" fill="#8B5CF6" fill-opacity=".35"/>' +
    '<line x1="60" y1="60" x2="22" y2="34" stroke="#C4B5FD" stroke-width="1.5"/>' +
    '<circle cx="60" cy="60" r="4" fill="#A78BFA"/>' +
    '<circle cx="38" cy="46" r="2.5" fill="#C4B5FD"/>' +
    '</svg>';

  /* ---------- montagem ---------- */
  function newGame(mode) {
    var order = [];
    PEOPLE.forEach(function (p) {
      order.push({ id: p.id, kind: 'pessoa' });
      order.push({ id: p.id, kind: 'perfil' });
    });
    state = { mode: mode || (state && state.mode) || 'classico', order: shuffle(order), matched: [], tries: 0, elapsed: 0, started: false };
    up = []; locked = false;
    save();
    render();
  }

  function render() {
    board.innerHTML = '';
    board.className = 'board mode-' + state.mode;
    state.order.forEach(function (c, i) {
      var p = byId[c.id];
      var card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = i;
      card.dataset.badge = p.first;
      card.innerHTML =
        '<div class="card-inner">' +
          '<div class="card-back">' + BACK_SVG +
            '<span class="back-label">MEMORY<br>GAME</span><span class="back-q">QUEM É QUEM?</span></div>' +
          '<div class="card-face"><div class="stage">' + cardHTML(p, c.kind) + '</div></div>' +
        '</div>' +
        '<button type="button" class="card-hit" aria-label="' + label(c) + '"></button>' +
        '<button type="button" class="zoom-btn" aria-label="Ampliar carta">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5M11 8v6M8 11h6"/></svg>' +
        '</button>';
      board.appendChild(card);
    });
    syncCards();
    updateStats();
    updateModeButtons();
    layout();
  }

  function cardEl(i) { return board.children[i]; }

  function syncCards() {
    state.order.forEach(function (c, i) {
      var node = cardEl(i);
      var matched = state.matched.indexOf(c.id) !== -1;
      var isUp = state.mode === 'aberto' || matched || up.indexOf(i) !== -1;
      node.classList.toggle('is-up', isUp);
      node.classList.toggle('is-matched', matched);
      node.classList.toggle('is-selected', state.mode === 'aberto' && up.indexOf(i) !== -1);
      var hit = node.querySelector('.card-hit');
      if (matched) hit.setAttribute('aria-label', label(c) + ' de ' + byId[c.id].name + ' (par encontrado)');
      else hit.setAttribute('aria-label', isUp ? label(c) + ' (aberta)' : 'Carta virada para baixo');
    });
  }

  /* ---------- layout: maior carta que cabe na tela ---------- */
  function layout() {
    var n = state.order.length;
    var cs = getComputedStyle(boardWrap);
    var W = boardWrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = boardWrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 12;
    var gap = W < 700 ? 8 : 14;
    var best = { w: 0, cols: 4 };
    for (var cols = 3; cols <= 14; cols++) {
      var rows = Math.ceil(n / cols);
      var w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 690 / 960);
      if (w > best.w) best = { w: w, cols: cols };
    }
    var w = Math.max(best.w, W < 700 ? 90 : 70);
    if (W < 700) { // celular: rolagem vertical, 4 colunas
      best.cols = 4; w = (W - gap * 3) / 4;
    }
    document.documentElement.style.setProperty('--s', (w / 690).toFixed(4));
    document.documentElement.style.setProperty('--gap', gap + 'px');
    board.style.gridTemplateColumns = 'repeat(' + best.cols + ', ' + w.toFixed(1) + 'px)';
  }

  /* ---------- placar ---------- */
  function updateStats() {
    el('stat-pairs').textContent = state.matched.length + '/' + PEOPLE.length;
    el('stat-tries').textContent = state.tries;
    el('stat-time').textContent = fmt(state.elapsed);
  }
  function startTimer() {
    if (timer) return;
    state.started = true;
    timer = setInterval(function () {
      state.elapsed++;
      el('stat-time').textContent = fmt(state.elapsed);
      if (state.elapsed % 5 === 0) save();
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }

  function updateModeButtons() {
    document.querySelectorAll('.seg').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
    });
  }

  /* ---------- dicas ---------- */
  var hintTimer = null;
  function showHint(text, action) {
    clearTimeout(hintTimer);
    hint.innerHTML = '';
    var span = document.createElement('span'); span.textContent = text; hint.appendChild(span);
    if (action) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn primary'; b.textContent = action.label;
      b.addEventListener('click', action.fn);
      hint.appendChild(b);
    } else {
      hintTimer = setTimeout(hideHint, 2600);
    }
    hint.classList.add('show');
  }
  function hideHint() { hint.classList.remove('show'); }

  /* ---------- jogada ---------- */
  function flipBack() {
    up = []; locked = false; hideHint(); syncCards();
  }

  function onCard(i) {
    var c = state.order[i];
    if (state.matched.indexOf(c.id) !== -1) { openMatch(c.id); return; }
    if (locked) { flipBack(); if (state.mode === 'aberto') return; }
    if (up.indexOf(i) !== -1) {
      if (state.mode === 'aberto') { up = []; syncCards(); }
      return;
    }
    startTimer();
    up.push(i);
    syncCards();
    if (up.length < 2) return;

    state.tries++;
    var a = state.order[up[0]], b = state.order[up[1]];
    if (a.id === b.id) {
      state.matched.push(a.id);
      up = [];
      updateStats(); save(); syncCards();
      setTimeout(function () { openMatch(a.id); }, state.mode === 'aberto' ? 250 : 650);
    } else {
      updateStats(); save();
      locked = true;
      var msg = a.kind === b.kind
        ? (a.kind === 'pessoa' ? 'Duas cartas de pessoa. Procurem uma pessoa e um perfil.' : 'Dois perfis. Procurem uma pessoa e um perfil.')
        : 'Não formam um par. O que levou vocês a essa escolha?';
      up.forEach(function (k) {
        var n = cardEl(k); n.classList.remove('is-wrong'); void n.offsetWidth; n.classList.add('is-wrong');
      });
      if (state.mode === 'aberto') {
        showHint(msg);
        setTimeout(flipBack, 1100);
      } else {
        showHint(msg, { label: 'Virar de volta', fn: flipBack });
      }
    }
  }

  /* ---------- par encontrado ---------- */
  function bigCard(p, kind) {
    return '<div class="big-card"><div class="stage">' + cardHTML(p, kind) + '</div></div>';
  }
  function fitZoom(cardsPerRow) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var stacked = vw < 760 && cardsPerRow > 1;
    var per = stacked ? 1 : cardsPerRow;
    var availW = (Math.min(vw * 0.96, 1240) - 56 - 24 * (per - 1)) / per;
    var availH = (stacked ? (vh - 220) / 2 : vh - (cardsPerRow > 1 ? 250 : 120));
    var s = Math.max(0.2, Math.min(availW / 690, availH / 960));
    document.documentElement.style.setProperty('--zs', s.toFixed(4));
  }
  function openMatch(id) {
    var p = byId[id];
    lastMatchId = id;
    el('match-title').textContent = p.name;
    el('match-sub').textContent = 'Agora é com você, ' + p.first + ': apresente o seu perfil e conte o que a carta não mostra.';
    el('match-cards').innerHTML = bigCard(p, 'pessoa') + bigCard(p, 'perfil');
    fitZoom(2);
    showOverlay('match');
    el('btn-match-done').focus();
  }
  function closeMatch() {
    hideOverlay('match');
    if (state.matched.length === PEOPLE.length) finish();
  }

  function openZoom(i) {
    var c = state.order[i];
    el('zoom-card').innerHTML = bigCard(byId[c.id], c.kind);
    fitZoom(1);
    showOverlay('zoom');
    el('btn-zoom-close').focus();
  }

  function finish() {
    stopTimer();
    el('end-summary').textContent = 'O time encontrou os ' + PEOPLE.length + ' pares em ' + state.tries +
      ' tentativas e ' + fmt(state.elapsed) + '. Obrigado a cada pessoa por apresentar o próprio perfil.';
    showOverlay('end');
  }

  /* ---------- sobreposições ---------- */
  var lastFocus = null;
  function showOverlay(id) { lastFocus = document.activeElement; el(id).hidden = false; }
  function hideOverlay(id) { el(id).hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  /* ---------- eventos ---------- */
  board.addEventListener('click', function (e) {
    var card = e.target.closest('.card'); if (!card) return;
    var i = +card.dataset.index;
    if (e.target.closest('.zoom-btn')) { openZoom(i); return; }
    if (e.target.closest('.card-hit')) onCard(i);
  });

  document.querySelectorAll('.seg').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.mode === state.mode) return;
      state.mode = b.dataset.mode; up = []; locked = false; hideHint();
      save(); render();
    });
  });

  el('btn-shuffle').addEventListener('click', function () {
    if (state.matched.length && !confirmReset()) return;
    stopTimer(); newGame(state.mode); hideHint();
  });
  function confirmReset() {
    return window.confirm('Embaralhar e começar de novo? Os pares encontrados serão desfeitos.');
  }
  el('btn-rules').addEventListener('click', function () { showOverlay('intro'); });
  document.querySelectorAll('[data-start]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.start !== state.mode) { state.mode = b.dataset.start; up = []; locked = false; save(); render(); }
      hideOverlay('intro');
    });
  });
  el('btn-match-done').addEventListener('click', closeMatch);
  el('btn-zoom-close').addEventListener('click', function () { hideOverlay('zoom'); });
  el('btn-again').addEventListener('click', function () { hideOverlay('end'); stopTimer(); newGame(state.mode); });
  el('btn-gallery').addEventListener('click', function () { hideOverlay('end'); });
  el('btn-fullscreen').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });

  ['zoom', 'match'].forEach(function (id) {
    el(id).addEventListener('click', function (e) {
      if (e.target === el(id)) { id === 'match' ? closeMatch() : hideOverlay(id); }
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!el('zoom').hidden) hideOverlay('zoom');
    else if (!el('match').hidden) closeMatch();
    else if (!el('intro').hidden) hideOverlay('intro');
    else if (locked) flipBack();
  });

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      layout();
      if (!el('match').hidden) fitZoom(2);
      if (!el('zoom').hidden) fitZoom(1);
    }, 80);
  });

  /* ---------- início ---------- */
  state = load();
  if (state) {
    up = []; render();
    if (state.started && state.matched.length < PEOPLE.length) startTimer();
  } else {
    newGame('classico');
    showOverlay('intro');
  }
})();

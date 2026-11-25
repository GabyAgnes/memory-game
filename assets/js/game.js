(function () {
  'use strict';

  var PEOPLE = window.PEOPLE || [];
  var STORE_KEY = 'memory-game-quem-e-quem-v2';
  var byId = {};
  PEOPLE.forEach(function (p) { byId[p.id] = p; });

  var board = document.getElementById('board');
  var boardWrap = document.getElementById('board-wrap');
  var hint = document.getElementById('hint');
  var el = function (id) { return document.getElementById(id); };

  // state: { secs, order:[personId x2], matched:[ids], tries, elapsed, phase:'preview'|'play'|'end' }
  var state = null;
  var up = [];          // índices das cartas viradas na jogada atual (máx. 2)
  var busy = false;     // aguardando cartas erradas virarem de volta
  var timer = null, cdTimer = null, backTimer = null;

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
          s.order.every(function (id) { return byId[id]; })) return s;
    } catch (e) { /* ignora */ }
    return null;
  }
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function sheetHTML(p) {
    if (p.cardImg) return '<img class="card-img" src="' + p.cardImg + '" alt="">';
    return '<div class="sheet">' + p.front + p.back + '</div>';
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
  function newGame() {
    var order = [];
    PEOPLE.forEach(function (p) { order.push(p.id, p.id); });
    var secs = state ? state.secs : 10;
    state = { secs: secs, order: shuffle(order), matched: [], tries: 0, elapsed: 0, phase: 'preview' };
    up = []; busy = false;
    stopTimer(); hideHint();
    save();
    render();
    startPreview();
  }

  function render() {
    board.innerHTML = '';
    state.order.forEach(function (id, i) {
      var p = byId[id];
      var card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = i;
      card.dataset.badge = p.first;
      card.innerHTML =
        '<div class="card-inner">' +
          '<div class="card-back">' + BACK_SVG +
            '<span class="back-label">MEMORY<br>GAME<span class="back-q">QUEM É QUEM?</span></span></div>' +
          '<div class="card-face"><div class="stage">' + sheetHTML(p) + '</div></div>' +
        '</div>' +
        '<button type="button" class="card-hit"></button>';
      board.appendChild(card);
    });
    syncCards();
    updateStats();
    updateSecsButtons();
    layout();
  }

  function cardEl(i) { return board.children[i]; }

  function syncCards() {
    var preview = state.phase === 'preview';
    board.classList.toggle('is-locked', preview);
    state.order.forEach(function (id, i) {
      var node = cardEl(i);
      var matched = state.matched.indexOf(id) !== -1;
      var isUp = preview || matched || up.indexOf(i) !== -1;
      node.classList.toggle('is-up', isUp);
      node.classList.toggle('is-matched', matched);
      var hit = node.querySelector('.card-hit');
      var name = byId[id].name;
      hit.setAttribute('aria-label',
        matched ? 'Carta de ' + name + ' (par encontrado)' :
        isUp ? 'Carta de ' + name : 'Carta virada para baixo');
    });
  }

  /* ---------- layout: maior carta que cabe na tela ---------- */
  function layout() {
    var n = state.order.length;
    var cs = getComputedStyle(boardWrap);
    var W = boardWrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var H = boardWrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 12;
    var gap = W < 700 ? 8 : 14;
    var ratio = 1024 / 1536;
    var best = { w: 0, cols: 4 };
    for (var cols = 2; cols <= 12; cols++) {
      var rows = Math.ceil(n / cols);
      var w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) / ratio);
      if (w > best.w) best = { w: w, cols: cols };
    }
    var w = best.w;
    if (W < 700) { best.cols = 2; w = (W - gap) / 2; } // celular: 2 colunas com rolagem
    document.documentElement.style.setProperty('--s', (w / 1536).toFixed(4));
    document.documentElement.style.setProperty('--gap', gap + 'px');
    board.style.gridTemplateColumns = 'repeat(' + best.cols + ', ' + w.toFixed(1) + 'px)';
  }

  /* ---------- placar e tempo ---------- */
  function updateStats() {
    el('stat-pairs').textContent = state.matched.length + '/' + PEOPLE.length;
    el('stat-tries').textContent = state.tries;
    el('stat-time').textContent = fmt(state.elapsed);
  }
  function startTimer() {
    if (timer) return;
    timer = setInterval(function () {
      state.elapsed++;
      el('stat-time').textContent = fmt(state.elapsed);
      if (state.elapsed % 5 === 0) save();
    }, 1000);
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function updateSecsButtons() {
    document.querySelectorAll('.seg[data-secs]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(+b.dataset.secs === state.secs));
    });
  }

  /* ---------- memorização ---------- */
  function startPreview() {
    clearInterval(cdTimer);
    var left = state.secs;
    el('cd-num').textContent = left;
    el('countdown').hidden = false;
    cdTimer = setInterval(function () {
      left--;
      el('cd-num').textContent = left;
      if (left <= 0) endPreview();
    }, 1000);
  }
  function endPreview() {
    clearInterval(cdTimer);
    el('countdown').hidden = true;
    state.phase = 'play';
    save();
    syncCards();
    startTimer();
  }

  /* ---------- dicas ---------- */
  var hintTimer = null;
  function showHint(text) {
    clearTimeout(hintTimer);
    hint.textContent = text;
    hint.classList.add('show');
    hintTimer = setTimeout(hideHint, 2200);
  }
  function hideHint() { hint.classList.remove('show'); }

  /* ---------- jogada ---------- */
  function flipBack() {
    clearTimeout(backTimer);
    up = []; busy = false;
    syncCards();
  }

  function onCard(i) {
    if (state.phase === 'preview') return;
    var id = state.order[i];
    if (state.matched.indexOf(id) !== -1) { openMatch(id); return; }
    if (busy) flipBack();                 // clicar durante o erro já vira de volta
    if (up.indexOf(i) !== -1) return;
    up.push(i);
    syncCards();
    if (up.length < 2) return;

    state.tries++;
    var a = state.order[up[0]], b = state.order[up[1]];
    if (a === b) {
      state.matched.push(a);
      up = [];
      updateStats(); save(); syncCards();
      setTimeout(function () { openMatch(a); }, 700);
    } else {
      updateStats(); save();
      busy = true;
      showHint('Não é par. Tentem de novo!');
      backTimer = setTimeout(flipBack, 1600);
    }
  }

  /* ---------- par encontrado ---------- */
  function fitZoom() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var availW = Math.min(vw * 0.96, 1500) - 56;
    var availH = vh - 250;
    var s = Math.max(0.2, Math.min(availW / 1536, availH / 1024));
    document.documentElement.style.setProperty('--zs', s.toFixed(4));
  }
  function openMatch(id) {
    var p = byId[id];
    el('match-title').textContent = p.name;
    el('match-sub').textContent = 'Agora é com você, ' + p.first + ': apresente-se para o time e conte o que a carta não mostra.';
    el('match-cards').innerHTML = '<div class="big-card"><div class="stage">' + sheetHTML(p) + '</div></div>';
    fitZoom();
    showOverlay('match');
    el('btn-match-done').focus();
  }
  function closeMatch() {
    hideOverlay('match');
    if (state.matched.length === PEOPLE.length && state.phase !== 'end') finish();
  }

  function finish() {
    stopTimer();
    state.phase = 'end'; save();
    el('end-summary').textContent = 'O time encontrou os ' + PEOPLE.length + ' pares em ' + state.tries +
      ' tentativas e ' + fmt(state.elapsed) + '. Obrigado a cada pessoa por se apresentar.';
    showOverlay('end');
  }

  /* ---------- sobreposições ---------- */
  var lastFocus = null;
  function showOverlay(id) { lastFocus = document.activeElement; el(id).hidden = false; }
  function hideOverlay(id) { el(id).hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }

  /* ---------- eventos ---------- */
  board.addEventListener('click', function (e) {
    var card = e.target.closest('.card'); if (!card) return;
    if (e.target.closest('.card-hit')) onCard(+card.dataset.index);
  });

  document.querySelectorAll('.seg[data-secs]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.secs = +b.dataset.secs; save(); updateSecsButtons();
    });
  });

  el('btn-shuffle').addEventListener('click', function () {
    if (state.matched.length && state.phase !== 'end' &&
        !window.confirm('Começar um novo jogo? Os pares encontrados serão desfeitos.')) return;
    newGame();
  });
  el('btn-rules').addEventListener('click', function () { showOverlay('intro'); });
  el('btn-start').addEventListener('click', function () {
    hideOverlay('intro');
    if (state.phase === 'preview' || (state.matched.length === 0 && state.tries === 0)) newGame();
  });
  el('btn-skip').addEventListener('click', endPreview);
  el('btn-match-done').addEventListener('click', closeMatch);
  el('btn-again').addEventListener('click', function () { hideOverlay('end'); newGame(); });
  el('btn-fullscreen').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });

  el('match').addEventListener('click', function (e) { if (e.target === el('match')) closeMatch(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!el('match').hidden) closeMatch();
    else if (!el('intro').hidden) hideOverlay('intro');
  });

  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { layout(); if (!el('match').hidden) fitZoom(); }, 80);
  });

  /* ---------- início ---------- */
  state = load();
  if (state && state.phase === 'play') {
    render(); startTimer();
  } else if (state && state.phase === 'end') {
    render();
  } else {
    // primeira visita (ou memorização interrompida): mostra as regras com o tabuleiro aberto atrás
    var secs = state ? state.secs : 10;
    var order = [];
    PEOPLE.forEach(function (p) { order.push(p.id, p.id); });
    state = { secs: secs, order: shuffle(order), matched: [], tries: 0, elapsed: 0, phase: 'preview' };
    render();
    showOverlay('intro');
  }
})();

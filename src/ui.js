/**
 * ui.js — Interface gráfica (GUI) do jogo "Miscigenação: Linha do Tempo".
 *
 * Liga o motor de regras (engine.js) ao DOM. Roda no navegador como módulo
 * ES (type="module"), apoiado no servidor estático server.js.
 */
import { MiscigenacaoGame, PHASES, createPlayers } from './engine.js';
import { BOARD, ERAS, PAWNS, PAWN_KEYS, SPACE_TYPE_INFO, eraById } from './data.js';

/* ------------------------------------------------------------------ */
/* Utilidades DOM                                                      */
/* ------------------------------------------------------------------ */
const $ = (sel) => document.querySelector(sel);

/* Elementos fixos */
const els = {
  screenSetup: $('#screen-setup'),
  screenGame: $('#screen-game'),
  playerCount: $('#player-count'),
  seedInput: $('#seed-input'),
  playerFields: $('#player-fields'),
  btnStart: $('#btn-start'),
  timelineList: $('#timeline-list'),
  board: $('#board'),
  eraTitle: $('#era-title'),
  eraPeriod: $('#era-period'),
  currentPlayer: $('#current-player'),
  btnRoll: $('#btn-roll'),
  die: $('#die-display'),
  scoreList: $('#score-list'),
  logList: $('#log-list'),
  questionModal: $('#question-modal'),
  questionText: $('#question-text'),
  questionOptions: $('#question-options'),
  cardModal: $('#card-modal'),
  cardBox: $('#card-box'),
  cardBadge: $('#card-badge'),
  cardTitle: $('#card-title'),
  cardText: $('#card-text'),
  btnCardOk: $('#btn-card-ok'),
  rulesModal: $('#rules-modal'),
  btnRules: $('#btn-rules'),
  btnRulesClose: $('#btn-rules-close'),
  winnerModal: $('#winner-modal'),
  winnerName: $('#winner-name'),
  rankingList: $('#ranking-list'),
  btnAgain: $('#btn-again'),
  btnWinnerClose: $('#btn-winner-close'),
  btnNew: $('#btn-new'),
  // mesa de cartas (parte inferior)
  trayDecks: {
    sorte: $('#deck-sorte'),
    reverse: $('#deck-reverse'),
    pergunta: $('#deck-pergunta'),
  },
  trayCounts: {
    sorte: $('#count-sorte'),
    reverse: $('#count-reverse'),
    pergunta: $('#count-pergunta'),
  },
  drawnCard: $('#drawn-card'),
  drawnText: $('#drawn-text'),
};

/** Estado da interface */
const ui = {
  game: null,
  busy: false,
  /** Última carta/pergunta que veio para a mesa: { kind, title, text }. */
  drawn: null,
};

/**
 * Parâmetros de animação/tempo. Exportado para permitir testes headless
 * (que rodam com animação desligada).
 */
export const uiConfig = {
  animTicks: 10,
  animIntervalMs: 55,
  answerDelayMs: 950,
};

/* ------------------------------------------------------------------ */
/* Tela de setup                                                       */
/* ------------------------------------------------------------------ */
function renderTimeline() {
  els.timelineList.innerHTML = ERAS.map(
    (era) =>
      `<li style="border-left-color:${era.color}">
         <span>${era.emoji}</span>
         <span><strong>${era.title}</strong></span>
         <span class="tl-period">${era.period}</span>
       </li>`,
  ).join('');
}

function renderPlayerFields() {
  const count = Number(els.playerCount.value);
  els.playerFields.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const row = document.createElement('div');
    row.className = 'player-row';
    const defaultPawn = PAWN_KEYS[i % PAWN_KEYS.length];

    const preview = document.createElement('span');
    preview.className = 'pawn-preview';
    preview.textContent = PAWNS[defaultPawn].emoji;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = `Jogador ${i + 1}`;
    nameInput.setAttribute('aria-label', `Nome do jogador ${i + 1}`);

    const pawnSelect = document.createElement('select');
    pawnSelect.setAttribute('aria-label', `Peão do jogador ${i + 1}`);
    PAWN_KEYS.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${PAWNS[key].emoji} ${PAWNS[key].label}`;
      pawnSelect.append(opt);
    });
    pawnSelect.value = defaultPawn;
    pawnSelect.addEventListener('change', () => {
      preview.textContent = PAWNS[pawnSelect.value].emoji;
    });

    row.append(preview, nameInput, pawnSelect);
    els.playerFields.append(row);
  }
}

/* ------------------------------------------------------------------ */
/* Início da partida                                                   */
/* ------------------------------------------------------------------ */
function startGame() {
  const rows = [...els.playerFields.querySelectorAll('.player-row')];
  const specs = rows.map((row) => ({
    name: row.querySelector("input[type='text']").value,
    pawn: row.querySelector('select').value,
  }));

  const seedRaw = els.seedInput.value.trim();
  const seed = seedRaw === '' ? Math.floor(Math.random() * 100000) : Number(seedRaw);

  ui.game = new MiscigenacaoGame({ players: createPlayers(specs), seed });
  ui.busy = false;
  ui.drawn = null;

  els.screenSetup.classList.remove('active');
  els.screenGame.classList.add('active');
  els.winnerModal.hidden = true;

  renderBoard();
  refresh();
}

/* ------------------------------------------------------------------ */
/* Tabuleiro — organizado em faixas por era (linha do tempo)           */
/* ------------------------------------------------------------------ */
/** Cada casa do tabuleiro: número da casa, ícone do tipo, nome e o espaço dos peões. */
function buildTile(space) {
  const info = SPACE_TYPE_INFO[space.type];

  const tile = document.createElement('div');
  tile.className = `tile type-${space.type}`;
  tile.dataset.index = space.index;
  tile.style.setProperty('--era-color', space.color);

  const head = document.createElement('div');
  head.className = 'tile-head';

  const num = document.createElement('span');
  num.className = 'tile-index';
  num.textContent = space.index;

  const icon = document.createElement('span');
  icon.className = 'tile-icon';
  icon.textContent = info.icon || '';

  head.append(num, icon);

  const name = document.createElement('div');
  name.className = 'tile-name';
  name.textContent = space.name;

  const kind = document.createElement('div');
  kind.className = 'tile-kind';
  kind.textContent = space.type === 'normal' ? '' : info.label;

  const tokens = document.createElement('div');
  tokens.className = 'tile-tokens';
  tokens.dataset.tokens = space.index;

  tile.append(head, name, kind, tokens);
  return tile;
}

/** Tabuleiro: cada era é uma faixa lida sempre da esquerda para a direita. */
function renderBoard() {
  els.board.innerHTML = '';

  const groups = [
    { title: 'Partida', emoji: '🚩', period: 'origens', color: '#6b5a45', spaces: BOARD.filter((s) => s.type === 'start') },
    ...ERAS.map((era) => ({
      title: era.title,
      emoji: era.emoji,
      period: era.period,
      color: era.color,
      spaces: BOARD.filter((s) => s.era === era.id),
    })),
    { title: 'Chegada', emoji: '🏁', period: 'hoje', color: '#b8860b', spaces: BOARD.filter((s) => s.type === 'finish') },
  ];

  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'era-group';

    const label = document.createElement('div');
    label.className = 'era-label';
    label.style.setProperty('--era-color', group.color);

    const emoji = document.createElement('span');
    emoji.className = 'era-emoji';
    emoji.textContent = group.emoji;

    const title = document.createElement('span');
    title.className = 'era-name';
    title.textContent = group.title;

    const period = document.createElement('span');
    period.className = 'era-period';
    period.textContent = group.period || '';

    // As casas seguem em ordem crescente, da esquerda para a direita.
    const flow = document.createElement('span');
    flow.className = 'era-flow';
    flow.textContent = '→';

    label.append(emoji, title, period, flow);

    const track = document.createElement('div');
    track.className = 'era-track';
    for (const space of group.spaces) track.append(buildTile(space));

    section.append(label, track);
    els.board.append(section);
  }
}

function renderTokens(game) {
  document.querySelectorAll('[data-tokens]').forEach((el) => (el.innerHTML = ''));

  game.players.forEach((player, i) => {
    const slot = document.querySelector(`[data-tokens="${player.position}"]`);
    if (!slot) return;
    const pawn = PAWNS[player.pawn];
    const token = document.createElement('span');
    token.className = 'token';
    if (i === game.currentPlayerIndex && !game.isFinished) token.classList.add('active');
    token.style.setProperty('--pawn-color', pawn.color);
    token.textContent = pawn.emoji;
    token.title = `${player.name} — casa ${player.position} · ${player.points} pts`;
    slot.append(token);
  });

  // Destaca a casa do jogador da vez.
  document.querySelectorAll('.tile.highlight').forEach((t) => t.classList.remove('highlight'));
  if (!game.isFinished) {
    const tile = document.querySelector(`.tile[data-index="${game.currentPlayer.position}"]`);
    if (tile) tile.classList.add('highlight');
  }
}

/** Desenha a face do dado (pontos) via atributo data-face. */
function renderDie(value) {
  const face = Number(value) || 0;
  els.die.dataset.face = String(face);
  els.die.setAttribute('aria-label', face ? `Dado: ${face}` : 'Dado ainda não rolado');
}

/* ------------------------------------------------------------------ */
/* Painéis (placar, log, etapa atual)                                  */
/* ------------------------------------------------------------------ */
function renderScore(game) {
  els.currentPlayer.innerHTML = game.isFinished
    ? '<span class="cp-name">🏁 Fim de jogo</span>'
    : `<span class="cp-pawn">${PAWNS[game.currentPlayer.pawn].emoji}</span>` +
      `<span class="cp-name">Vez de ${game.currentPlayer.name}</span>`;

  els.scoreList.innerHTML = game.players
    .map((p, i) => {
      const cls = i === game.currentPlayerIndex && !game.isFinished ? 'current' : '';
      const pawn = PAWNS[p.pawn];
      const skip = p.skipTurns > 0 ? ` · refletindo (${p.skipTurns})` : '';
      return `<li class="${cls}">
        <span class="sc-pawn" style="background:${pawn.color}">${pawn.emoji}</span>
        <span>
          <span class="sc-name">${p.name}</span>
          <span class="sc-pos">${pawn.label} · casa ${p.position}${skip}</span>
        </span>
        <span class="sc-points">${p.points} pts</span>
      </li>`;
    })
    .join('');
}

function renderLog(game) {
  const items = game.log.slice(-40);
  els.logList.innerHTML = items
    .map((entry) => `<li class="k-${entry.kind}">${entry.text}</li>`)
    .join('');
  els.logList.scrollTop = els.logList.scrollHeight;
}

function renderGameHeader(game) {
  const player = game.currentPlayer;
  const space = BOARD[player.position];
  const era = eraById(space.era);
  els.eraTitle.textContent = era ? `${era.emoji} ${era.title}` : space.eraTitle;
  els.eraPeriod.textContent = era ? era.period : '';
}

function refresh() {
  const game = ui.game;
  renderTokens(game);
  renderScore(game);
  renderLog(game);
  renderGameHeader(game);
  renderTray(game);
  els.btnRoll.disabled = game.isFinished || ui.busy || game.phase !== PHASES.AWAITING_ROLL;
}

/* ------------------------------------------------------------------ */
/* Mesa de cartas (parte inferior da tela)                             */
/* ------------------------------------------------------------------ */
const TRAY_KINDS = {
  sorte: { icon: '🍀', label: 'Sorte' },
  reverse: { icon: '🔄', label: 'Reverse' },
  pergunta: { icon: '❓', label: 'Perguntas' },
};

function renderTray(game) {
  if (!game) return;
  const decks = game.getDeckInfo();

  for (const kind of Object.keys(TRAY_KINDS)) {
    const info = decks[kind];
    const count = els.trayCounts[kind];
    if (count) count.textContent = `${info.remaining}/${info.total}`;

    const deck = els.trayDecks[kind];
    if (deck) {
      deck.classList.toggle('empty', info.remaining === 0);
      deck.title = `${TRAY_KINDS[kind].label}: ${info.remaining} de ${info.total} cartas restantes`;
    }
  }

  // Carta em jogo (a última puxada na partida)
  if (ui.drawn) {
    const meta = TRAY_KINDS[ui.drawn.kind] || TRAY_KINDS.pergunta;
    els.drawnCard.className = `drawn-card drawn-${ui.drawn.kind}`;
    els.drawnCard.hidden = false;
    els.drawnText.innerHTML =
      `<span class="drawn-kind">${meta.icon} ${ui.drawn.title}</span>` +
      `<span class="drawn-body">${ui.drawn.text}</span>`;
  } else {
    els.drawnCard.className = 'drawn-card drawn-empty';
    els.drawnText.textContent = 'As cartas que você puxar aparecem aqui.';
  }
}

/* ------------------------------------------------------------------ */
/* Dado e turno                                                        */
/* ------------------------------------------------------------------ */
function animateDie(finalValue, done) {
  const settle = () => {
    renderDie(finalValue);
    els.die.classList.remove('rolling');
    done();
  };

  // Em testes headless a animação é desligada (uiConfig.animTicks = 1).
  if (uiConfig.animTicks <= 1) {
    settle();
    return;
  }

  els.die.classList.add('rolling');
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    renderDie(1 + Math.floor(Math.random() * 6));
    if (ticks >= uiConfig.animTicks) {
      clearInterval(timer);
      settle();
    }
  }, uiConfig.animIntervalMs);
}

function handleRoll() {
  const game = ui.game;
  if (!game || game.isFinished || ui.busy || game.phase !== PHASES.AWAITING_ROLL) return;

  ui.busy = true;
  els.btnRoll.disabled = true;

  const events = game.roll();
  const rollEvent = events.find((e) => e.type === 'roll');

  animateDie(rollEvent ? rollEvent.value : 1, () => {
    ui.busy = false;
    presentEvents(events);
  });
}

/** Mostra os modais correspondentes aos eventos e atualiza a mesa. */
function presentEvents(events) {
  const question = events.find((e) => e.type === 'question');
  const card = events.find((e) => e.type === 'card');
  const finished = events.find((e) => e.type === 'finish');

  // A carta/pergunta puxada vai para a mesa de cartas (parte inferior).
  if (question) {
    ui.drawn = { kind: 'pergunta', title: 'Pergunta', text: question.question.prompt };
  } else if (card) {
    ui.drawn = { kind: card.cardType, title: card.card.title, text: card.card.text };
  }

  refresh();

  if (question) {
    showQuestion(question.question);
    return;
  }
  if (card) {
    showCard(card);
    return;
  }
  if (finished) {
    showWinner();
  }
}

/* ------------------------------------------------------------------ */
/* Modal de pergunta                                                   */
/* ------------------------------------------------------------------ */
function showQuestion(question) {
  els.questionText.textContent = question.prompt;
  els.questionOptions.innerHTML = '';

  question.options.forEach((text, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.dataset.index = String(i);
    button.innerHTML = `<span class="opt-key">${i + 1}</span><span>${text}</span>`;
    button.addEventListener('click', () => answerQuestion(i));
    els.questionOptions.append(button);
  });

  els.questionModal.hidden = false;
}

function answerQuestion(index) {
  const game = ui.game;
  if (!game || game.phase !== PHASES.AWAITING_ANSWER) return;

  const buttons = [...els.questionOptions.querySelectorAll('.option')];
  const correctIndex = game.pendingQuestion.correctIndex;
  buttons.forEach((b) => {
    b.disabled = true;
  });
  if (index === correctIndex) {
    buttons[index].classList.add('correct');
  } else {
    buttons[index].classList.add('wrong');
    buttons[correctIndex].classList.add('correct');
  }

  setTimeout(() => {
    const events = game.answer(index);
    els.questionModal.hidden = true;
    refresh();
    if (events.some((e) => e.type === 'finish')) showWinner();
  }, uiConfig.answerDelayMs);
}

/* ------------------------------------------------------------------ */
/* Modal de carta                                                      */
/* ------------------------------------------------------------------ */
function showCard(cardEvent) {
  const card = cardEvent.card;
  const isSorte = card.type === 'sorte';
  els.cardBox.className = `modal card ${isSorte ? 'card-sorte' : 'card-reverse'}`;
  els.cardBadge.textContent = isSorte ? '🍀 Carta de Sorte' : '🔄 Carta Reverse';
  els.cardTitle.textContent = card.title;
  els.cardText.textContent = card.text;
  els.cardModal.hidden = false;
}

function closeCard() {
  if (els.cardModal.hidden) return;
  els.cardModal.hidden = true;
  if (ui.game.isFinished) showWinner();
  else refresh();
}

/* ------------------------------------------------------------------ */
/* Fim de jogo                                                         */
/* ------------------------------------------------------------------ */
function showWinner() {
  const game = ui.game;
  const champion = game.players[game.winnerIndex];
  els.winnerName.textContent = `${PAWNS[champion.pawn].emoji} ${champion.name} venceu!`;

  els.rankingList.innerHTML = game.rankings
    .map((r, i) => {
      const medal = ['🥇', '🥈', '🥉', '🎖️'][i] || '•';
      return `<li>
        <span class="rk-medal">${medal}</span>
        <span class="rk-name">${PAWNS[r.pawn].emoji} ${r.name}</span>
        <span class="rk-meta">casa ${r.position} · ${r.points} pts</span>
      </li>`;
    })
    .join('');

  els.winnerModal.hidden = false;
  refresh();
}

/* ------------------------------------------------------------------ */
/* Navegação entre telas                                               */
/* ------------------------------------------------------------------ */
function backToSetup() {
  els.winnerModal.hidden = true;
  els.cardModal.hidden = true;
  els.questionModal.hidden = true;
  els.rulesModal.hidden = true;
  els.screenGame.classList.remove('active');
  els.screenSetup.classList.add('active');
  renderPlayerFields();
}

/* ------------------------------------------------------------------ */
/* Bootstrap                                                           */
/* ------------------------------------------------------------------ */
function init() {
  renderTimeline();
  renderPlayerFields();

  // Monta o dado: 9 "casas" para os pontos; o CSS revela conforme data-face.
  els.die.innerHTML = '';
  for (let i = 0; i < 9; i += 1) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    els.die.append(pip);
  }
  renderDie(0);

  els.playerCount.addEventListener('change', renderPlayerFields);
  els.btnStart.addEventListener('click', startGame);
  els.btnRoll.addEventListener('click', handleRoll);
  els.btnCardOk.addEventListener('click', closeCard);
  els.btnNew.addEventListener('click', backToSetup);
  els.btnAgain.addEventListener('click', backToSetup);
  els.btnWinnerClose.addEventListener('click', () => {
    els.winnerModal.hidden = true;
  });
  els.btnRules.addEventListener('click', () => {
    els.rulesModal.hidden = false;
  });
  els.btnRulesClose.addEventListener('click', () => {
    els.rulesModal.hidden = true;
  });

  // Fecha modais informativos clicando fora (a pergunta exige uma escolha).
  [els.cardModal, els.rulesModal, els.winnerModal].forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.hidden = true;
    });
  });

  // Atalhos de teclado: espaço/Enter rolam o dado; 1-4 respondem.
  document.addEventListener('keydown', (event) => {
    if (!els.questionModal.hidden) {
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= 4) {
        const button = els.questionOptions.querySelector(`.option[data-index="${n - 1}"]`);
        if (button && !button.disabled) button.click();
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const onGameScreen = els.screenGame.classList.contains('active');
      if (onGameScreen && !els.btnRoll.disabled) {
        event.preventDefault();
        handleRoll();
      }
    }
  });
}

init();

/* ------------------------------------------------------------------ */
/* Aviso: módulos ES exigem http:// (não funcionam via file://)        */
/* ------------------------------------------------------------------ */
if (typeof location !== 'undefined' && location.protocol === 'file:') {
  const aviso = document.createElement('div');
  aviso.className = 'card';
  aviso.style.margin = '1rem';
  aviso.innerHTML =
    '<h3>⚠️ Abra o jogo pelo servidor local</h3>' +
    '<p>Este jogo usa módulos JavaScript, que o navegador bloqueia ao abrir o arquivo diretamente (file://). ' +
    'No terminal, dentro da pasta do projeto, rode:</p>' +
    '<p><code>npm start</code> &nbsp;ou&nbsp; <code>node server.js</code></p>' +
    '<p>e acesse <code>http://localhost:5173</code>.</p>';
  document.body.prepend(aviso);
}
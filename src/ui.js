/**
 * ui.js — camada de interface do jogo.
 *
 * O tabuleiro é um MUNDO HORIZONTAL: o mundo anda (transform), a câmera
 * desliza com lerp e nada fica em painel fixo ocupando a tela.
 *
 *   - roda do mouse / arrastar / setas  → olham o percurso
 *   - espaço                            → volta o foco para a peça da vez
 *   - dado                              → é lançado NO MAPA, perto da peça
 *   - peças                             → andam casa a casa pelo mesmo caminho
 *   - cartas                            → viram na tela (flip) e o efeito acontece
 *   - pergunta                          → depois da resposta, mostra o "você sabia?"
 */
import { MiscigenacaoGame, PHASES, createPlayers } from './engine.js';
import { PAWNS, PAWN_KEYS, ERAS, FACTS } from './data.js';
import {
  buildLayout,
  worldWidth,
  pathD,
  silhouettePath,
  profileFor,
  pointAtS,
  Camera,
  clamp,
} from './world.js';

/* ------------------------------------------------------------------ */
/* Parâmetros de tempo (os testes desligam a animação)                 */
/* ------------------------------------------------------------------ */
export const uiConfig = {
  instant: false,
  stepMs: 210,
  hopPauseMs: 40,
  dieTicks: 9,
  dieTickMs: 55,
  /** Só para testes: força o valor do dado (null = sorteia de verdade). */
  forcedRoll: null,
};

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** Peão desenhado (SVG) — nada de emoji. */
function pawnSvg(color) {
  return (
    '<svg viewBox="0 0 24 32" aria-hidden="true">' +
    `<g fill="${color}" stroke="#21201c" stroke-width="2.2" stroke-linejoin="round">` +
    '<circle cx="12" cy="7" r="5"/>' +
    '<path d="M12 13c4.4 0 7.6 3.2 8.1 7.4l.6 7.1c0 .8-.6 1.5-1.4 1.5H4.7c-.8 0-1.4-.7-1.4-1.5l.6-7.1C4.4 16.2 7.6 13 12 13Z"/>' +
    '</g></svg>'
  );
}

/* ------------------------------------------------------------------ */
/* Elementos                                                           */
/* ------------------------------------------------------------------ */
let el = {};

function collectElements() {
  el = {
    setup: $('screen-setup'),
    playerCount: $('player-count'),
    seedInput: $('seed-input'),
    playerFields: $('player-fields'),
    btnStart: $('btn-start'),
    btnRules: $('btn-rules'),
    btnHelpToggle: $('btn-help-toggle'),
    timelineList: $('timeline-list'),
    game: $('screen-game'),
    stage: $('stage'),
    world: $('world'),
    sky: $('px-sky'),
    far: $('px-far'),
    fore: $('px-fore'),
    trail: $('trail'),
    trailShadow: $('trail-shadow'),
    trailPath: $('trail-path'),
    trailDots: $('trail-dots'),
    houses: $('houses'),
    pawns: $('pawns'),
    die: $('die'),
    turnPawn: $('turn-pawn'),
    turnText: $('turn-text'),
    chips: $('chips'),
    decks: $('decks'),
    minimap: $('minimap'),
    drawer: $('drawer'),
    logList: $('log-list'),
    btnLog: $('btn-log'),
    btnDrawerClose: $('btn-drawer-close'),
    btnRecenter: $('btn-recenter'),
    btnNew: $('btn-new'),
    cardStage: $('card-stage'),
    cardFlip: $('card-flip'),
    cardFront: $('card-front'),
    cardBadge: $('card-badge'),
    cardTitle: $('card-title'),
    cardText: $('card-text'),
    btnCardOk: $('btn-card-ok'),
    questionModal: $('question-modal'),
    questionText: $('question-text'),
    questionOptions: $('question-options'),
    questionFact: $('question-fact'),
    factText: $('fact-text'),
    questionNote: $('question-note'),
    btnQuestionOk: $('btn-question-ok'),
    rulesModal: $('rules-modal'),
    btnRulesClose: $('btn-rules-close'),
    winnerModal: $('winner-modal'),
    winnerName: $('winner-name'),
    rankingList: $('ranking-list'),
    btnAgain: $('btn-again'),
    btnWinnerClose: $('btn-winner-close'),
  };
  return el;
}

/* ------------------------------------------------------------------ */
/* Estado                                                             */
/* ------------------------------------------------------------------ */
const ui = {
  game: null,
  layout: null,
  camera: new Camera(),
  busy: false,
  pendingWinner: false,
  /** Posição visual de cada peão (a REGRA vive no motor; aqui é a animação). */
  pos: [],
  pawnEls: [],
  deckEls: {},
  houseEls: [],
  dragging: false,
  dragX: 0,
  paused: false,
};

/* ------------------------------------------------------------------ */
/* Tela de setup                                                       */
/* ------------------------------------------------------------------ */
function renderTimeline() {
  el.timelineList.innerHTML = ERAS.map(
    (era) =>
      `<li style="border-left-color:${era.color}">
         <span><strong>${era.title}</strong></span>
         <span class="tl-period">${era.period}</span>
       </li>`,
  ).join('');
}

function renderPlayerFields() {
  const count = clamp(Number(el.playerCount.value) || 1, 1, 4);
  el.playerFields.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const row = document.createElement('div');
    row.className = 'player-row';

    const preview = document.createElement('span');
    preview.className = 'pawn-preview';
    preview.innerHTML = pawnSvg(PAWNS[PAWN_KEYS[i % PAWN_KEYS.length]].color);

    const name = document.createElement('input');
    name.type = 'text';
    name.value = `Jogador ${i + 1}`;
    name.setAttribute('aria-label', `Nome do jogador ${i + 1}`);

    const cor = document.createElement('select');
    cor.setAttribute('aria-label', `Cor do peão ${i + 1}`);
    PAWN_KEYS.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = PAWNS[key].label;
      cor.append(opt);
    });
    cor.value = PAWN_KEYS[i % PAWN_KEYS.length];
    cor.addEventListener('change', () => {
      preview.innerHTML = pawnSvg(PAWNS[cor.value].color);
    });

    row.append(preview, name, cor);
    el.playerFields.append(row);
  }
}

function startGame() {
  const rows = [...el.playerFields.querySelectorAll('.player-row')];
  const specs = rows.map((row) => ({
    name: row.querySelector('input').value,
    pawn: row.querySelector('select').value,
  }));
  const seedRaw = el.seedInput.value.trim();
  const seed = seedRaw === '' ? Math.floor(Math.random() * 100000) : Number(seedRaw);

  ui.game = new MiscigenacaoGame({ players: createPlayers(specs), seed });
  ui.busy = false;
  ui.pendingWinner = false;
  ui.paused = false;

  el.setup.classList.remove('active');
  el.game.classList.add('active');
  el.winnerModal.hidden = true;
  el.drawer.hidden = true;

  buildWorld();
  refreshAll();
}
/* ------------------------------------------------------------------ */
/* O MUNDO                                                             */
/* ------------------------------------------------------------------ */
function buildWorld() {
  const game = ui.game;
  const h = Math.max(520, el.stage.clientHeight || 800);
  const w = Math.max(900, el.stage.clientWidth || 1200);

  const layout = buildLayout({ height: h });
  ui.layout = layout;

  const worldW = worldWidth();
  el.world.style.width = `${worldW}px`;

  el.trail.setAttribute('width', String(worldW));
  el.trail.setAttribute('height', String(h));
  el.trail.setAttribute('viewBox', `0 0 ${worldW} ${h}`);
  const d = pathD(layout, { step: 14 });
  el.trailShadow.setAttribute('d', d);
  el.trailPath.setAttribute('d', d);
  el.trailDots.setAttribute('d', d);

  renderSky(layout, worldW);
  renderSilhouettes(layout, worldW);
  renderHouses(layout);
  renderPawns(game);
  renderDecks();
  renderMinimap();

  ui.camera.setBounds(w, worldW);
  ui.camera.setAnchor(housePoint(ui.pos[game.currentPlayerIndex]).x);
  ui.camera.jump();
  applyCamera();
}

function renderSky(layout, worldW) {
  el.sky.style.width = `${worldW}px`;
  el.sky.innerHTML = '';
  layout.segments.forEach((seg) => {
    const slice = document.createElement('div');
    slice.className = 'sky-slice';
    slice.style.left = `${seg.x0}px`;
    slice.style.width = `${seg.x1 - seg.x0}px`;
    const [a, b] = seg.scene.sky;
    slice.style.background = `linear-gradient(180deg, ${a}, ${b})`;
    el.sky.append(slice);
  });
}

function renderSilhouettes(layout, worldW) {
  const draw = (offsetFactor, base, amp) =>
    layout.segments
      .map((seg, i) => {
        const w = seg.x1 - seg.x0;
        const p = silhouettePath(profileFor(seg.id, i + offsetFactor), w, { base, amp });
        return (
          `<svg viewBox="0 0 ${w} 100" preserveAspectRatio="none" ` +
          `style="position:absolute;left:${seg.x0}px;top:0;width:${w}px;height:100%">` +
          `<path d="${p}" fill="${seg.scene.far}"/></svg>`
        );
      })
      .join('');

  el.far.style.width = `${worldW}px`;
  el.far.innerHTML = draw(0, 62, 30);
  el.fore.style.width = `${worldW}px`;
  el.fore.innerHTML = draw(5, 90, 14);
}

function renderHouses(layout) {
  el.houses.innerHTML = '';
  ui.houseEls = layout.houses.map((h) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `house house--${h.type}`;
    node.style.left = `${h.x}px`;
    node.style.top = `${h.y}px`;
    node.style.setProperty('--era', h.color);
    node.title = h.name;

    const sym =
      h.type === 'sorte' ? '✦'
        : h.type === 'reverse' ? '↺'
          : h.type === 'pergunta' ? '?'
            : h.type === 'finish' ? '★'
              : h.type === 'start' ? '◆' : '';
    node.innerHTML =
      `<span class="house-disc"><span class="house-num">${h.index}</span>${sym}</span>` +
      `<span class="house-name">${h.name}</span>`;
    node.addEventListener('click', () => focusHouse(h.index, false));
    el.houses.append(node);
    return node;
  });
}

function renderPawns(game) {
  el.pawns.innerHTML = '';
  ui.pos = game.players.map((p) => p.position);
  ui.pawnEls = game.players.map((p, i) => {
    const node = document.createElement('div');
    node.className = 'pawn';
    node.dataset.player = String(i);
    node.innerHTML = pawnSvg(PAWNS[p.pawn].color);
    el.pawns.append(node);
    return node;
  });
  layoutPawns();
}

function layoutPawns() {
  const game = ui.game;
  if (!ui.layout || !game) return;
  ui.pawnEls.forEach((node, i) => {
    const at = housePoint(ui.pos[i]);
    const spread = (i - (game.players.length - 1) / 2) * 13;
    node.style.left = `${at.x + spread}px`;
    node.style.top = `${at.y}px`;
    node.classList.toggle('is-turn', i === game.currentPlayerIndex && !game.isFinished);
  });
  markHere();
}

/** Ponto (x,y) de uma casa na geometria do mundo. */
function housePoint(index) {
  const hit = ui.layout.houses.find((h) => h.index === index);
  return hit || pointAtS(ui.layout, index > 0 ? 1 : 0);
}

function markHere() {
  const game = ui.game;
  if (!game || !ui.layout) return;
  const here = game.currentPlayer.position;
  ui.houseEls.forEach((node, i) => {
    node.classList.toggle('is-here', ui.layout.houses[i].index === here && !game.isFinished);
  });
}

/* ------------------------------------------------------------------ */
/* Câmera                                                              */
/* ------------------------------------------------------------------ */
function applyCamera() {
  const c = ui.camera;
  const layers = Camera.layers();
  el.world.style.transform = `translate3d(${-c.x.toFixed(2)}px,0,0)`;
  el.sky.style.transform = `translate3d(${(c.x * (1 - layers.sky)).toFixed(1)}px,0,0)`;
  el.far.style.transform = `translate3d(${(c.x * (1 - layers.far)).toFixed(1)}px,0,0)`;
  el.fore.style.transform = `translate3d(${(c.x * (1 - layers.fore)).toFixed(1)}px,0,0)`;
  positionDie();
  positionMinimapMarks();
}

/** O dado é lançado NO MAPA: fica ao lado da peça da vez. */
function positionDie() {
  const game = ui.game;
  if (!game || !ui.layout) return;
  const at = housePoint(ui.pos[game.currentPlayerIndex]);
  el.die.style.left = `${at.x + 48}px`;
  el.die.style.top = `${at.y - 118}px`;
}

function focusHouse(index, smooth = true) {
  const game = ui.game;
  if (!game) return;
  ui.camera.recenter();
  ui.camera.setAnchor(housePoint(index).x);
  if (!smooth) {
    ui.camera.jump();
    applyCamera();
  }
}

let last = 0;
function tick(t) {
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
  last = t;
  const before = ui.camera.x;
  ui.camera.update(dt);
  if (Math.abs(ui.camera.x - before) > 0.05) applyCamera();
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ */
/* Rolagem: roda do mouse, arrastar e setas movem a CÂMERA             */
/* ------------------------------------------------------------------ */
function bindCamera() {
  el.stage.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      ui.camera.lookBy(ev.deltaX !== 0 ? ev.deltaX : ev.deltaY);
    },
    { passive: false },
  );

  let pointerId = null;
  el.stage.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('button')) return;
    pointerId = ev.pointerId;
    ui.dragging = true;
    ui.dragX = ev.clientX;
    el.stage.classList.add('dragging');
    el.stage.setPointerCapture(pointerId);
  });
  el.stage.addEventListener('pointermove', (ev) => {
    if (!ui.dragging || ev.pointerId !== pointerId) return;
    const dx = ev.clientX - ui.dragX;
    ui.dragX = ev.clientX;
    ui.camera.lookBy(-dx);
  });
  const endDrag = (ev) => {
    if (ev.pointerId !== pointerId) return;
    ui.dragging = false;
    pointerId = null;
    el.stage.classList.remove('dragging');
  };
  el.stage.addEventListener('pointerup', endDrag);
  el.stage.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', (ev) => {
    if (!el.game.classList.contains('active')) return;
    if (ev.target.matches('input, select, textarea')) return;
    if (ev.key === 'ArrowRight') { ui.camera.lookBy(180); ev.preventDefault(); }
    else if (ev.key === 'ArrowLeft') { ui.camera.lookBy(-180); ev.preventDefault(); }
    else if (ev.key === ' ') { ui.camera.recenter(); ev.preventDefault(); }
    else if (ev.key >= '1' && ev.key <= '4' && !el.questionModal.hidden) {
      const opt = el.questionOptions.querySelector(`.option[data-i="${Number(ev.key) - 1}"]`);
      if (opt && !opt.disabled) opt.click();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Dado (lançado no mapa com um "tum" simples)                         */
/* ------------------------------------------------------------------ */
function buildDie() {
  el.die.innerHTML = '';
  for (let i = 0; i < 9; i += 1) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    el.die.append(pip);
  }
  el.die.dataset.face = '0';
}

function setDieFace(v) {
  el.die.dataset.face = String(v);
  el.die.setAttribute('aria-label', v ? `Dado: ${v}` : 'Rolar o dado');
}

async function startRoll() {
  const game = ui.game;
  if (!game || ui.busy || game.isFinished || game.phase !== PHASES.AWAITING_ROLL) return;

  ui.busy = true;
  el.die.classList.add('rolling');
  if (!uiConfig.instant) {
    for (let i = 0; i < uiConfig.dieTicks; i += 1) {
      setDieFace(1 + Math.floor(Math.random() * 6));
      await sleep(uiConfig.dieTickMs);
    }
  }

  const events = game.roll(uiConfig.forcedRoll);
  const roll = events.find((e) => e.type === 'roll');
  el.die.classList.remove('rolling');
  setDieFace(roll ? roll.value : 1);
  bumpDeck(null);

  await playEvents(events);
  ui.busy = false;
  if (ui.pendingWinner) flushWinner();
}

/** Um "tum" no baralho que foi puxado. */
function bumpDeck(kind) {
  if (kind && ui.deckEls[kind]) {
    const node = ui.deckEls[kind];
    node.classList.remove('draw');
    void node.offsetWidth;
    node.classList.add('draw');
  }
}
/* ------------------------------------------------------------------ */
/* Peças andando casa a casa pelo MESMO caminho                        */
/* ------------------------------------------------------------------ */
async function walkPawn(playerIndex, to) {
  const from = ui.pos[playerIndex];
  if (from === to) return;

  const dir = to > from ? 1 : -1;
  const total = Math.abs(to - from);
  // Passos menores quando o dado manda andar muito, para a viagem não ficar longa.
  const stepMs = uiConfig.instant
    ? 0
    : Math.max(1, Math.min(uiConfig.stepMs, 1400 / Math.max(1, total)));

  for (let i = 1; i <= total; i += 1) {
    const casa = from + dir * i;
    ui.pos[playerIndex] = casa;
    layoutPawns();
    positionMinimapMarks();
    if (!ui.dragging) ui.camera.setAnchor(housePoint(casa).x);
    applyCamera();
    if (stepMs > 0) await sleep(stepMs);
  }
}

/* ------------------------------------------------------------------ */
/* Eventos do motor → tela                                             */
/* ------------------------------------------------------------------ */
async function playEvents(events) {
  for (const ev of events) {
    if (ev.type === 'move') {
      await walkPawn(ev.playerIndex, ev.to);
      refreshChips();
    } else if (ev.type === 'swap') {
      // troca de lugar: as duas peças caminham pelo percurso
      for (const [idx, dest] of Object.entries(ev.positions)) {
        await walkPawn(Number(idx), dest);
      }
      refreshChips();
    } else if (ev.type === 'question') {
      await askQuestion(ev.question, ev.playerIndex);
    } else if (ev.type === 'card') {
      bumpDeck(ev.cardType);
      await showCard(ev.card);
    } else if (ev.type === 'finish') {
      ui.pendingWinner = true;
    } else if (ev.type === 'skip' || ev.type === 'skip_turn') {
      refreshChips();
    }
  }
  refreshAll();
}

/* ------------------------------------------------------------------ */
/* Pergunta + "você sabia?"                                            */
/* ------------------------------------------------------------------ */
function askQuestion(question, playerIndex) {
  return new Promise((resolve) => {
    const game = ui.game;
    let chosen = null;

    el.questionText.textContent = question.prompt;
    el.questionOptions.innerHTML = '';
    el.questionFact.hidden = true;
    el.questionNote.hidden = false;
    el.btnQuestionOk.hidden = true;

    question.options.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option';
      b.dataset.i = String(i);
      b.innerHTML = `<span class="option-key">${i + 1}</span><span>${text}</span>`;
      b.addEventListener('click', () => choose(i));
      el.questionOptions.append(b);
    });

    el.questionModal.hidden = false;

    function choose(i) {
      if (chosen !== null) return;
      chosen = i;
      const buttons = [...el.questionOptions.querySelectorAll('.option')];
      buttons.forEach((b) => { b.disabled = true; });
      const correct = game.pendingQuestion.correctIndex;
      buttons[i].classList.add(i === correct ? 'is-correct' : 'is-wrong');
      if (i !== correct) buttons[correct].classList.add('is-correct');

      // O "você sabia?" vem DEPOIS da resposta — é aqui que se aprende.
      const id = game.pendingQuestion.id;
      el.factText.textContent = FACTS[id] || '';
      el.questionFact.hidden = !FACTS[id];
      el.questionNote.hidden = true;

      if (uiConfig.instant) {
        finish();
        return;
      }
      el.btnQuestionOk.hidden = false;
      el.btnQuestionOk.onclick = finish;
    }

    async function finish() {
      el.btnQuestionOk.onclick = null;
      const events = game.answer(chosen ?? 0);
      el.questionModal.hidden = true;
      const moves = events.filter((e) => e.type === 'move' || e.type === 'finish');
      await playEvents(moves);
      resolve();
    }
  });
}
/* ------------------------------------------------------------------ */
/* Carta: voa do baralho, vira na tela, efeito acontece                */
/* ------------------------------------------------------------------ */
function showCard(card) {
  return new Promise((resolve) => {
    const isSorte = card.type === 'sorte';
    el.cardFront.classList.toggle('is-reverse', !isSorte);
    el.cardBadge.textContent = isSorte ? 'Carta de sorte' : 'Carta reverse';
    el.cardTitle.textContent = card.title;
    el.cardText.textContent = card.text;

    el.cardStage.hidden = false;
    el.cardStage.classList.remove('revealed');
    setTimeout(() => el.cardStage.classList.add('revealed'), uiConfig.instant ? 0 : 180);

    el.btnCardOk.onclick = () => {
      el.btnCardOk.onclick = null;
      el.cardStage.hidden = true;
      resolve();
    };
  });
}

/* ------------------------------------------------------------------ */
/* HUD: fichas, baralhos, minimapa, diário                             */
/* ------------------------------------------------------------------ */
const DECK_META = {
  sorte: { sym: '✦', label: 'Sorte' },
  reverse: { sym: '↺', label: 'Reverse' },
  pergunta: { sym: '?', label: 'Perguntas' },
};

function renderDecks() {
  el.decks.innerHTML = '';
  ui.deckEls = {};
  Object.entries(DECK_META).forEach(([kind, meta]) => {
    const node = document.createElement('div');
    node.className = `deck deck-${kind}`;

    const sym = document.createElement('span');
    sym.className = 'deck-sym';
    sym.textContent = meta.sym;

    const label = document.createElement('span');
    label.className = 'deck-label';
    label.textContent = meta.label;

    const count = document.createElement('span');
    count.className = 'deck-count';
    count.dataset.count = kind;
    count.textContent = '–';

    node.append(sym, label, count);
    el.decks.append(node);
    ui.deckEls[kind] = node;
  });
}

function renderMinimap() {
  el.minimap.innerHTML = '';
  const layout = ui.layout;
  const worldW = worldWidth();
  layout.segments.forEach((seg) => {
    const band = document.createElement('span');
    band.className = 'minimap-seg';
    band.style.left = `${(seg.x0 / worldW) * 100}%`;
    band.style.width = `${((seg.x1 - seg.x0) / worldW) * 100}%`;
    band.style.background = seg.scene.far;
    el.minimap.append(band);
  });
  ui.game.players.forEach((p, i) => {
    const mark = document.createElement('span');
    mark.className = 'minimap-mark';
    mark.dataset.player = String(i);
    mark.style.background = PAWNS[p.pawn].color;
    el.minimap.append(mark);
  });
}
function refreshChips() {
  const game = ui.game;
  if (!game) return;

  el.chips.innerHTML = '';
  game.players.forEach((p, i) => {
    const chip = document.createElement('li');
    chip.className = 'chip';
    chip.dataset.player = String(i);
    if (i === game.currentPlayerIndex && !game.isFinished) chip.classList.add('is-turn');

    const pawn = document.createElement('span');
    pawn.className = 'chip-pawn';
    pawn.innerHTML = pawnSvg(PAWNS[p.pawn].color);

    const info = document.createElement('span');
    const nome = document.createElement('span');
    nome.className = 'chip-name';
    nome.textContent = p.name;
    const meta = document.createElement('span');
    meta.className = 'chip-meta';
    const skip = p.skipTurns > 0 ? ` · estudando (${p.skipTurns})` : '';
    meta.textContent = `casa ${p.position}${skip}`;
    info.append(nome, meta);

    const pts = document.createElement('span');
    pts.className = 'chip-pts';
    pts.textContent = String(p.points);

    chip.append(pawn, info, pts);
    el.chips.append(chip);
  });

  const cur = game.players[game.currentPlayerIndex];
  el.turnPawn.innerHTML = pawnSvg(PAWNS[cur.pawn].color);
  el.turnText.textContent = game.isFinished
    ? 'fim da viagem'
    : `${cur.name} · casa ${cur.position}`;
}

function refreshDecks() {
  const info = ui.game.getDeckInfo();
  Object.keys(DECK_META).forEach((kind) => {
    const node = el.decks.querySelector(`[data-count="${kind}"]`);
    if (node) node.textContent = `${info[kind].remaining}/${info[kind].total}`;
    const deck = ui.deckEls[kind];
    if (deck) deck.classList.toggle('is-empty', info[kind].remaining === 0);
  });
}

function refreshLog() {
  el.logList.innerHTML = '';
  ui.game.log.slice(-60).forEach((e) => {
    const li = document.createElement('li');
    li.className = `k-${e.kind}`;
    li.textContent = e.text;
    el.logList.append(li);
  });
  el.logList.scrollTop = el.logList.scrollHeight;
}

function refreshDieState() {
  const game = ui.game;
  const pode = !game.isFinished && !ui.busy && game.phase === PHASES.AWAITING_ROLL;
  el.die.classList.toggle('is-off', !pode);
  el.die.tabIndex = pode ? 0 : -1;
}

function refreshAll() {
  const game = ui.game;
  if (!game) return;
  layoutPawns();
  refreshChips();
  refreshDecks();
  refreshLog();
  positionMinimapMarks();
  positionDie();
  applyCamera();
  refreshDieState();
}

/* ------------------------------------------------------------------ */
/* Fim de jogo                                                         */
/* ------------------------------------------------------------------ */
function flushWinner() {
  if (!ui.pendingWinner || !ui.game.isFinished) return;
  ui.pendingWinner = false;
  const game = ui.game;
  const champ = game.players[game.winnerIndex];
  el.winnerName.textContent = `${champ.name} venceu!`;
  el.rankingList.innerHTML = '';
  game.rankings.forEach((r, i) => {
    const li = document.createElement('li');

    const pos = document.createElement('span');
    pos.className = 'rk-pos';
    pos.textContent = `${i + 1}º`;

    const nome = document.createElement('span');
    nome.className = 'rk-name';
    nome.textContent = r.name;

    const meta = document.createElement('span');
    meta.className = 'rk-meta';
    meta.textContent = `casa ${r.position} · ${r.points} pts`;

    li.append(pos, nome, meta);
    el.rankingList.append(li);
  });
  el.winnerModal.hidden = false;
  refreshAll();
}

/* ------------------------------------------------------------------ */
/* Navegação                                                           */
/* ------------------------------------------------------------------ */
function backToSetup() {
  el.winnerModal.hidden = true;
  el.questionModal.hidden = true;
  el.rulesModal.hidden = true;
  el.drawer.hidden = true;
  el.cardStage.hidden = true;
  el.game.classList.remove('active');
  el.setup.classList.add('active');
  renderPlayerFields();
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
function init() {
  collectElements();
  renderTimeline();
  renderPlayerFields();
  buildDie();

  el.playerCount.addEventListener('change', renderPlayerFields);
  el.btnStart.addEventListener('click', startGame);
  el.btnRecenter.addEventListener('click', () => {
    ui.camera.recenter();
    focusHouse(ui.pos[ui.game.currentPlayerIndex]);
  });
  el.btnNew.addEventListener('click', backToSetup);
  el.btnAgain.addEventListener('click', backToSetup);
  el.btnWinnerClose.addEventListener('click', () => { el.winnerModal.hidden = true; });
  el.die.addEventListener('click', startRoll);
  el.die.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      startRoll();
    }
  });
  el.btnRules.addEventListener('click', () => { el.rulesModal.hidden = false; });
  el.btnRulesClose.addEventListener('click', () => { el.rulesModal.hidden = true; });
  el.btnLog.addEventListener('click', () => { el.drawer.hidden = !el.drawer.hidden; });
  el.btnDrawerClose.addEventListener('click', () => { el.drawer.hidden = true; });
  el.btnHelpToggle.addEventListener('click', () => {
    const aberto = !el.timelineList.hidden;
    el.timelineList.hidden = aberto;
    el.btnHelpToggle.textContent = aberto
      ? 'ver as 7 eras do percurso ↓'
      : 'esconder as eras ↑';
  });

  window.addEventListener('resize', () => {
    if (!ui.game) return;
    buildWorld();
    refreshAll();
  });

  bindCamera();
  requestAnimationFrame(tick);
  // rede de segurança: mantém a câmera em dia se algo externo mudar o estado
  const safety = setInterval(() => {
    if (ui.game && !ui.busy) applyCamera();
  }, 200);
  safety.unref?.();
}

/**
 * Reinicia a interface para o `document` atual.
 * Usado pelos testes headless: módulos ES são cacheados, então o import
 * não roda de novo — aqui remontamos os elementos e o HUD.
 */
export function mountApp() {
  init();
  return ui;
}

/* ------------------------------------------------------------------ */
/* Utilitário do HUD (definido depois de init, mas só é chamado no uso) */
/* ------------------------------------------------------------------ */
function positionMinimapMarks() {
  if (!ui.layout || !ui.game) return;
  const worldW = worldWidth();
  el.minimap.querySelectorAll('.minimap-mark').forEach((node) => {
    const i = Number(node.dataset.player);
    const at = housePoint(ui.pos[i]);
    node.style.left = `${clamp(at.x / worldW, 0, 1) * 100}%`;
    node.classList.toggle('is-turn', i === ui.game.currentPlayerIndex && !ui.game.isFinished);
  });
}

init();

/* ------------------------------------------------------------------ */
/* Aviso: módulos ES exigem http:// (não funcionam via file://)        */
/* ------------------------------------------------------------------ */
if (typeof location !== 'undefined' && location.protocol === 'file:') {
  const aviso = document.createElement('div');
  aviso.style.cssText =
    'position:fixed;inset:auto 0 0 0;z-index:99;padding:1rem;background:#21201c;color:#f2e8d5;' +
    'font-family:system-ui,sans-serif;font-size:.9rem;line-height:1.5;text-align:center';
  aviso.innerHTML =
    '<strong>Abra o jogo pelo servidor local.</strong> ' +
    'Módulos JavaScript são bloqueados em <code>file://</code>. ' +
    'No terminal, dentro da pasta do projeto, rode <code>npm start</code> ' +
    'e acesse <code>http://localhost:5173</code>.';
  document.body.append(aviso);
}
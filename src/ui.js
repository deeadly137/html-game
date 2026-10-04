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
  scenerySvg,
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
  /** Efeitos sonoros sintetizados (nos testes fica desligado). */
  sound: true,
  /** Tempo que o dado fica no mapa antes de voltar para a caixa. */
  recallMs: 420,
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
    dieCube: $('die-cube'),
    dieTray: $('dice-tray'),
    dieLabel: $('die-label'),
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
    btnSound: $('btn-sound'),
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
  /** Casas por onde cada peão passou, em ordem — usado nos testes e no rastro. */
  trail: [],
  /** Promessa da rolagem em andamento (os testes esperam por ela). */
  rolling: null,
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
  ui.trail = [];
  ui.rolling = null;

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
  renderScenery(layout);
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

  // Transição entre eras: em vez de um corte seco, uma faixa em degradê
  // sobreposto na divisa (o céu de uma era dissolvendo no da seguinte).
  for (let i = 0; i < layout.segments.length - 1; i += 1) {
    const atual = layout.segments[i];
    const proximo = layout.segments[i + 1];
    const blend = document.createElement('div');
    blend.className = 'sky-slice sky-blend';
    const largura = 260;
    blend.style.left = `${atual.x1 - largura / 2}px`;
    blend.style.width = `${largura}px`;
    blend.style.background = `linear-gradient(90deg, ${atual.scene.sky[1]}, ${proximo.scene.sky[0]})`;
    el.sky.append(blend);
  }
}

function renderScenery(layout) {
  const altura = layout.height;
  // Cada trecho é um SVG com viewBox do tamanho exato do elemento:
  // nenhum eixo é esticado, então os desenhos mantêm a proporção.
  el.far.innerHTML = layout.segments.map((seg, i) => scenerySvg(seg, i, altura)).join('');
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
  const n = game.players.length;
  ui.pawnEls.forEach((node, i) => {
    const at = housePoint(ui.pos[i]);
    // Espaçamento suficiente para as peças não se cobrirem na mesma casa
    // (largura do corpo do peão ~30px), com um leve escalonamento em altura.
    const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 32;
    const camada = n === 1 ? 0 : i * -5;
    node.style.left = `${at.x + spread}px`;
    node.style.top = `${at.y + camada}px`;
    node.style.zIndex = String(10 - i);
    node.classList.toggle('is-turn', i === game.currentPlayerIndex && !game.isFinished);
  });
  markHere();
}

/** Ponto (x,y) de uma casa na geometria do mundo. */
function housePoint(index) {
  const hit = ui.layout.houses.find((h) => h.index === index);
  if (hit) return hit;
  const casas = ui.layout.houses;
  return index <= 0 ? casas[0] : casas[casas.length - 1];
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
  positionMinimapMarks();
}

/** Onde o dado deve pousar: perto da peça, mas sempre dentro da tela. */
function throwOffset() {
  const caixa = el.dieTray.getBoundingClientRect?.();
  if (!caixa || !ui.layout || !ui.game) return { dx: 0, dy: 0 };

  const at = housePoint(ui.pos[ui.game.currentPlayerIndex]);
  const telaX = at.x - ui.camera.x;
  const telaY = at.y;
  const vw = window.innerWidth || 1200;
  const vh = window.innerHeight || 800;

  const alvoX = clamp(telaX + 74, 90, vw - 90);
  const alvoY = clamp(telaY - 150, 90, vh - 170);

  return {
    dx: alvoX - (caixa.left + caixa.width / 2),
    dy: alvoY - (caixa.top + caixa.height / 2),
  };
}

/** Joga o dado da caixa até o mapa, com um arco. */
function throwDie() {
  const { dx, dy } = throwOffset();
  ui.throwDx = dx;
  ui.throwDy = dy;
  el.die.classList.add('thrown');
  el.die.style.transition = 'transform 0.42s cubic-bezier(0.25, -0.35, 0.55, 1)';
  el.die.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  el.die.style.pointerEvents = 'none';
}

/** Traz o dado de volta para a caixa, mostrando o último número jogado. */
function recallDie() {
  el.die.style.transition = 'transform 0.34s cubic-bezier(0.5, 0, 0.7, 0.4)';
  el.die.style.transform = '';
  el.die.classList.remove('thrown');
  setTimeout(() => {
    el.die.style.pointerEvents = '';
    el.die.style.transition = '';
  }, 340);
}

/** Agenda a volta do dado, sem travar o turno seguinte. */
let recallTimer = null;
function agendarRecolhimento() {
  if (recallTimer) clearTimeout(recallTimer);
  recallTimer = setTimeout(() => {
    recallTimer = null;
    recallDie();
  }, uiConfig.instant ? 0 : uiConfig.recallMs);
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
  let pressX = 0;
  let arrastando = false;

  el.stage.addEventListener('pointerdown', (ev) => {
    // O dado e os botões têm os próprios cliques: não podem ser capturados
    // pelo palco (senão o clique é redirecionado e rolar não funciona).
    if (ev.target.closest('button, #die, .deck, .chip, .minimap')) return;
    pointerId = ev.pointerId;
    pressX = ev.clientX;
    ui.dragX = ev.clientX;
    arrastando = false;
    // Sem captura ainda: só vira arrasto depois de um movimento mínimo.
  });

  el.stage.addEventListener('pointermove', (ev) => {
    if (pointerId === null || ev.pointerId !== pointerId) return;
    const dx = ev.clientX - ui.dragX;

    if (!arrastando) {
      // Arrasto só começa depois de 5px: um clique curto não mexe a câmera.
      if (Math.abs(ev.clientX - pressX) < 5) return;
      arrastando = true;
      ui.dragging = true;
      ui.dragX = ev.clientX;
      el.stage.classList.add('dragging');
      el.stage.setPointerCapture(pointerId);
      return;
    }

    ui.dragX = ev.clientX;
    ui.camera.panBy(-dx);
  });
  const endDrag = (ev) => {
    if (pointerId === null || ev.pointerId !== pointerId) return;
    ui.dragging = false;
    arrastando = false;
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
  // Cubo de verdade: 6 faces, cada uma com a sua quantidade de pontos.
  el.dieCube.innerHTML = '';
  for (let v = 1; v <= 6; v += 1) {
    const face = document.createElement('div');
    face.className = `die-face face-${v}`;
    face.dataset.v = String(v);
    for (let i = 0; i < 9; i += 1) {
      const pip = document.createElement('span');
      pip.className = 'pip';
      face.append(pip);
    }
    el.dieCube.append(face);
  }
  setDieFace(0, { silent: true });
}

/** Rotação do cubo que traz cada face para a frente. */
const DIE_ROTATION = {
  1: [0, 0],
  2: [90, 0], // face de baixo
  3: [0, -90], // face da direita
  4: [0, 90], // face da esquerda
  5: [-90, 0], // face de cima
  6: [0, 180], // face de trás
};

function setDieFace(v, { silent = false } = {}) {
  const valor = Number(v) || 0;
  el.die.dataset.face = String(valor);

  if (!valor) {
    // Ainda não rolou: cubo apoiado de lado, mostrando um "?".
    el.dieCube.style.transform = 'rotateX(-22deg) rotateY(28deg)';
    el.die.dataset.blank = 'true';
    if (!silent) el.die.setAttribute('aria-label', 'Rolar o dado');
    return;
  }

  el.die.dataset.blank = 'false';
  const [rx, ry] = DIE_ROTATION[valor] || [0, 0];
  el.dieCube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  if (!silent) el.die.setAttribute('aria-label', `Dado: ${valor}`);
}

async function startRoll() {
  const game = ui.game;
  if (!game || ui.busy || game.isFinished || game.phase !== PHASES.AWAITING_ROLL) return;

  // Guardamos a promessa: os testes (e o botão) podem esperar o turno acabar.
  ui.rolling = (async () => {
    ui.busy = true;
    if (recallTimer) {
      clearTimeout(recallTimer);
      recallTimer = null;
    }
    setDieFace(0);
    el.die.classList.add('rolling');
    playShake();
    // O dado é lançado da caixa até perto da peça.
    if (uiConfig.instant) el.die.classList.add('thrown');
    else throwDie();

    if (!uiConfig.instant) {
      for (let i = 0; i < uiConfig.dieTicks; i += 1) {
        setDieFace(1 + Math.floor(Math.random() * 6));
        await sleep(uiConfig.dieTickMs);
      }
    }

    const events = game.roll(uiConfig.forcedRoll);
    const roll = events.find((e) => e.type === 'roll');

    // Pouso: transição mais longa com um leve "quique" ao mostrar o resultado.
    el.die.classList.remove('rolling');
    el.die.classList.add('settling');
    setDieFace(roll ? roll.value : 1);
    playClack();
    setTimeout(() => el.die.classList.remove('settling'), 500);

    // O dado fica no mapa durante a jogada (mostrando o número) e só volta
    // para a caixa quando o turno termina — a peça não espera por ele.
    await playEvents(events);
    ui.busy = false;
    ui.rolling = null;
    refreshDieState();
    agendarRecolhimento();
    if (ui.pendingWinner) flushWinner();
  })();

  return ui.rolling;
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
/* Som — sintetizado na hora (sem arquivo, sem dependência)            */
/* ------------------------------------------------------------------ */
/**
 * Cada efeito é um blip curtinho criado com osciladores. Nada de MP3:
 * o jogo continua sem arquivos externos e sem biblioteca de áudio.
 * O contexto só nasce no primeiro gesto do usuário (exigência dos navegadores).
 */
let audioCtx = null;

function audio() {
  if (!uiConfig.sound) return null;
  if (audioCtx) return audioCtx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** Toca um tom curto. */
function blip({ freq = 440, dur = 0.08, type = 'triangle', gain = 0.14, slide = 0 } = {}) {
  const ctx = audio();
  if (!ctx) return;
  // um "retomar" silencioso: o navegador pausa o contexto até haver gesto
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
  vol.gain.setValueAtTime(0.0001, now);
  vol.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  vol.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(vol).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

/** O dado sacudindo na mão. */
function playShake() {
  blip({ freq: 180, dur: 0.06, type: 'square', gain: 0.05 });
  setTimeout(() => blip({ freq: 150, dur: 0.05, type: 'square', gain: 0.04 }), 90);
}

/** O dado batendo na mesa. */
function playClack() {
  blip({ freq: 320, dur: 0.09, type: 'square', gain: 0.13, slide: -160 });
}

/** Um passo da peça no tabuleiro. */
function playStep() {
  blip({ freq: 620, dur: 0.04, type: 'sine', gain: 0.05 });
}

/** Acerto / erro / carta. */
function playRight() {
  blip({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.12 });
  setTimeout(() => blip({ freq: 880, dur: 0.14, type: 'triangle', gain: 0.12 }), 110);
}
function playWrong() {
  blip({ freq: 300, dur: 0.18, type: 'sawtooth', gain: 0.1, slide: -120 });
}
function playCard() {
  blip({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.1, slide: 240 });
}
function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => {
    setTimeout(() => blip({ freq: f, dur: 0.16, type: 'triangle', gain: 0.12 }), i * 130);
  });
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
    if (!ui.trail[playerIndex]) ui.trail[playerIndex] = [];
    ui.trail[playerIndex].push(casa);
    layoutPawns();
    positionMinimapMarks();
    if (!ui.dragging) ui.camera.setAnchor(housePoint(casa).x);
    applyCamera();
    if (stepMs > 0) {
      playStep();
      await sleep(stepMs);
    }
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
    } else if (ev.type === 'turn') {
      // A câmera vai atrás de quem vai jogar agora — senão o dado do próximo
      // pode ficar fora da tela quando os jogadores estão distantes.
      followPlayer(ev.playerIndex);
    } else if (ev.type === 'skip' || ev.type === 'skip_turn') {
      refreshChips();
    } else if (ev.type === 'hop') {
      // só animação: o movimento já foi desenhado
    }
  }
  refreshAll();
}

/** Leva a câmera (e o foco) para o jogador da vez. */
function followPlayer(index) {
  const at = housePoint(ui.pos[index]);
  ui.camera.recenter();
  ui.camera.setAnchor(at.x);
  applyCamera();
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
      const acertou = i === correct;
      buttons[i].classList.add(acertou ? 'is-correct' : 'is-wrong');
      if (!acertou) buttons[correct].classList.add('is-correct');
      if (acertou) playRight();
      else playWrong();

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
    playCard();
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
  el.dieTray.classList.toggle('is-off', !pode);

  const dono = game.players[game.currentPlayerIndex];
  el.dieLabel.textContent = game.isFinished
    ? 'Fim da viagem'
    : pode
      ? `${dono.name}: clique para rolar`
      : 'Aguarde…';
  if (game.isFinished) el.dieLabel.textContent = 'Fim da viagem';
}

function refreshAll() {
  const game = ui.game;
  if (!game) return;
  layoutPawns();
  refreshChips();
  refreshDecks();
  refreshLog();
  positionMinimapMarks();
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
  playWin();
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
  // A caixa inteira é área de clique: alvo grande, difícil errar.
  el.dieTray.addEventListener('click', (ev) => {
    if (ev.target === el.die) return; // já tratado pelo próprio dado
    startRoll();
  });
  el.btnRules.addEventListener('click', () => { el.rulesModal.hidden = false; });
  el.btnRulesClose.addEventListener('click', () => { el.rulesModal.hidden = true; });
  el.btnSound.addEventListener('click', () => {
    uiConfig.sound = !uiConfig.sound;
    el.btnSound.setAttribute('aria-pressed', String(uiConfig.sound));
    el.btnSound.textContent = uiConfig.sound ? 'Som' : 'Som off';
    if (uiConfig.sound) blip({ freq: 700, dur: 0.08, type: 'triangle', gain: 0.1 });
  });
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
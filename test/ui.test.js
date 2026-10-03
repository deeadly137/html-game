/**
 * ui.test.js — teste de fumaça da interface, rodando sem navegador
 * com um DOM mínimo (tools/fake-dom.js).
 *
 * O que se verifica aqui é o que o jogador vê: o mundo horizontal com a
 * trilha curva, o dado lançado no mapa, a peça andando casa a casa, a carta
 * virando na tela, o "você sabia?" depois da resposta e o HUD enxuto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFakeDocument, parseHtmlIds, installGlobals } from '../tools/fake-dom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const flush = (ms = 2) => new Promise((r) => setTimeout(r, ms));

/** Monta um documento novo, importa a interface e remonta o app nele. */
async function boot(count = 2) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const entries = parseHtmlIds(html);
  assert.ok(entries.length > 20, 'index.html deve conter os elementos da interface');

  const doc = createFakeDocument(entries);
  installGlobals(doc);
  doc.byId.get('player-count').value = String(count);

  const api = await import('../src/ui.js');
  api.uiConfig.instant = true; // sem animação: o teste é determinístico
  api.uiConfig.forcedRoll = null;
  const state = api.mountApp();

  const get = (id) => doc.byId.get(id);
  const start = async () => {
    get('btn-start').click();
    await flush();
  };

  return { doc, api, state, get, start, html };
}

/* ------------------------------------------------------------------ */
/* O mundo                                                             */
/* ------------------------------------------------------------------ */
test('GUI: o mundo é uma tira horizontal com trilha curva e 30 casas', async () => {
  const { state, get, start } = await boot(3);
  const { worldWidth } = await import('../src/world.js');

  assert.ok(get('screen-setup').classList.contains('active'), 'começa no setup');
  assert.equal(get('player-fields').querySelectorAll('.player-row').length, 3);

  await start();

  assert.equal(get('screen-setup').classList.contains('active'), false);
  assert.equal(get('screen-game').classList.contains('active'), true);

  // O mundo é largo (não é uma página com scroll vertical).
  const largura = Number(get('world').style.width.replace('px', ''));
  assert.ok(largura > 8000, `o mundo deve ser largo (recebi ${largura}px)`);
  assert.ok(worldWidth() > 8000, 'a largura vem da geometria do percurso');

  // A trilha é um caminho SVG amostrado ao longo do percurso.
  const d = get('trail-path').getAttribute('d');
  assert.ok(d.startsWith('M'), 'a trilha tem um caminho SVG');
  assert.ok((d.match(/L/g) || []).length > 50, 'o caminho é amostrado, não reto');

  // 30 casas avançando para a direita e com relevo (sobe e desce).
  const casas = get('houses').querySelectorAll('.house');
  assert.equal(casas.length, 30, '30 casas no mapa');
  const xs = casas.map((c) => Number(c.style.left.replace('px', '')));
  const ys = casas.map((c) => Number(c.style.top.replace('px', '')));
  assert.ok(xs.every((x, i) => i === 0 || x > xs[i - 1]), 'as casas avançam para a direita');
  assert.ok(Math.max(...ys) - Math.min(...ys) > 40, 'o percurso tem relevo, não é uma linha reta');

  // Cada era tem um trecho de cenário próprio (comprimentos diferentes).
  const segmentos = state.layout.segments;
  assert.equal(segmentos.length, 9, 'nove trechos');
  assert.ok(new Set(segmentos.map((s) => s.scene.length)).size > 3, 'os trechos têm comprimentos diferentes');
  assert.equal(get('px-sky').querySelectorAll('.sky-slice').length, 9, 'o céu muda a cada era');
  assert.ok(get('px-far').innerHTML.includes('<svg'), 'há silhuetas de cenário no fundo');

  // Nada de painel lateral: o HUD é só fichas, baralhos e minimapa.
  assert.equal(get('screen-game').querySelectorAll('.panel').length, 0, 'nenhum painel fixo aberto');
  assert.equal(get('chips').querySelectorAll('.chip').length, 3, 'uma ficha por jogador');
  assert.equal(get('decks').querySelectorAll('.deck').length, 3, 'três baralhos');
  assert.equal(get('minimap').querySelectorAll('.minimap-mark').length, 3, 'três marcas no minimapa');
  assert.equal(get('minimap').querySelectorAll('.minimap-seg').length, 9, 'nove trechos no minimapa');
});

test('GUI: os peões são desenhados, sem emoji e sem estereótipo', async () => {
  const { get, start } = await boot(2);
  await start();

  const peoes = get('pawns').querySelectorAll('.pawn');
  assert.equal(peoes.length, 2);
  assert.ok(peoes[0].innerHTML.includes('<svg'), 'o peão é um desenho, não um emoji');
  assert.doesNotMatch(peoes[0].innerHTML, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'sem emoji no peão');

  const { PAWNS } = await import('../src/data.js');
  for (const p of Object.values(PAWNS)) {
    assert.doesNotMatch(p.label, /indígena|africano|europeu|asiático/i, 'o peão não é uma "raiz cultural"');
    assert.match(p.color, /^#[0-9a-f]{6}$/i);
  }
});
/* ------------------------------------------------------------------ */
/* O dado no mapa                                                      */
/* ------------------------------------------------------------------ */
test('GUI: o dado é lançado NO MAPA, ao lado da peça da vez', async () => {
  const { api, get, start } = await boot(2);
  await start();

  const die = get('die');
  assert.ok(die.style.left, 'o dado tem posição no mapa');
  assert.equal(die.querySelectorAll('.pip').length, 9, 'dado montado com 9 pontos');
  assert.equal(die.dataset.face, '0', 'ainda não rolou');

  const peao0 = get('pawns').querySelectorAll('.pawn')[0];
  const dx = Math.abs(Number(die.style.left.replace('px', '')) - Number(peao0.style.left.replace('px', '')));
  const dy = Math.abs(Number(die.style.top.replace('px', '')) - Number(peao0.style.top.replace('px', '')));
  assert.ok(dx < 90 && dy < 190, 'o dado fica junto da peça, não num painel lateral');

  // Rolar muda a face do dado.
  api.uiConfig.forcedRoll = 4;
  get('die').click();
  await flush(40);
  assert.equal(die.dataset.face, '4', 'o dado mostra a face sorteada');
});

/* ------------------------------------------------------------------ */
/* Peça andando casa a casa                                            */
/* ------------------------------------------------------------------ */
test('GUI: a peça ANDA casa a casa pelo percurso (não teletransporta)', async () => {
  const { api, state, get, start } = await boot(2);
  await start();

  // Passos rápidos, mas observáveis: dá para ver a peça casa a casa.
  api.uiConfig.instant = false;
  api.uiConfig.stepMs = 6;
  api.uiConfig.dieTicks = 0;
  api.uiConfig.forcedRoll = 4;

  const peao = get('pawns').querySelectorAll('.pawn')[0];
  const visitadas = new Set();
  const espiao = setInterval(() => visitadas.add(state.pos[0]), 1);

  get('die').click();
  await flush(220);
  clearInterval(espiao);

  assert.equal(state.game.players[0].position, 4, 'andou as 4 casas do dado');

  // Passou por TODAS as casas do trajeto, uma a uma — sem pulo.
  for (let c = 1; c <= 4; c += 1) {
    assert.ok(visitadas.has(c), `a peça passou pela casa ${c}`);
  }

  // E parou exatamente na casa sorteada, no ponto do caminho.
  const alvo = state.layout.houses.find((h) => h.index === 4);
/* ------------------------------------------------------------------ */
/* Carta e pergunta                                                    */
/* ------------------------------------------------------------------ */
test('GUI: a carta é puxada, vira na tela e o efeito acontece', async () => {
  const { api, state, get, start } = await boot(2);
  await start();

  // Da casa 2 com um 1 no dado, cai exatamente na casa 3 (Sorte).
  state.game.players[0].position = 2;
  state.pos[0] = 2;
  api.uiConfig.forcedRoll = 1;
  // Carta sem movimento (só pontos): a posição final é previsível.
  const carta = state.game.sorteDeck.items.find((c) => c.id === 's02');
  state.game.sorteDeck.pile = [carta];
  const antesSorte = state.game.getDeckInfo().sorte.remaining;

  get('die').click();
  await flush(60);

  assert.equal(state.game.players[0].position, 3, 'parou na casa de Sorte');
  assert.ok(state.game.log.filter((e) => e.kind === 'card').length >= 1, 'a carta foi aplicada de fato');
  assert.ok(state.game.getDeckInfo().sorte.remaining < antesSorte, 'o baralho foi consumido');

  // A carta aparece virada diante do jogador.
  assert.equal(get('card-stage').hidden, false, 'a carta é mostrada');
  assert.ok(get('card-title').textContent.length > 0, 'com título');
  assert.ok(get('card-text').textContent.length > 20, 'e o texto do efeito');

  get('btn-card-ok').click();
  await flush(10);
  assert.equal(get('card-stage').hidden, true, 'a carta sai de cena');
  assert.equal(state.game.currentPlayerIndex, 1, 'o turno passou');
});

test('GUI: depois de responder, aparece o "você sabia?"', async () => {
  const { api, state, get, start } = await boot(2);
  await start();

  // Da casa 1 com um 4 no dado, cai na casa 5 (Pergunta).
  state.game.players[0].position = 1;
  state.pos[0] = 1;
  api.uiConfig.forcedRoll = 4;
  state.game.questionDeck.pile = [state.game.questionDeck.items[0]];

  get('die').click();
  await flush(60);

  assert.equal(get('question-modal').hidden, false, 'a pergunta apareceu');
  assert.equal(get('question-options').querySelectorAll('.option').length, 4, 'quatro alternativas');
  assert.equal(get('question-fact').hidden, true, 'o fato ainda está escondido');

  // Responde: o "você sabia?" aparece — é aqui que o jogo ensina.
  get('question-options').querySelectorAll('.option')[0].click();
  await flush(20);

  assert.equal(get('question-fact').hidden, false, 'o "você sabia?" veio depois da resposta');
  assert.ok(get('fact-text').textContent.length > 40, 'com um fato histórico de verdade');
  assert.equal(get('question-modal').hidden, true, 'a pergunta se resolveu');
});

test('GUI: cada pergunta tem um "você sabia?" e as cartas Reverse não punem a vítima', async () => {
  const { FACTS, QUESTIONS, REVERSE_CARDS } = await import('../src/data.js');

  const semFato = QUESTIONS.filter((q) => !FACTS[q.id]);
  assert.deepEqual(semFato, [], 'toda pergunta tem um fato educativo');

  for (const card of REVERSE_CARDS) {
    const avanco = card.effects.reduce((acc, e) => acc + (e.move || 0), 0);
    assert.ok(avanco >= 0, `"${card.title}" não deve fazer a vítima recuar`);
  }
});

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */
test('GUI: baralhos no canto e diário como gaveta sob demanda', async () => {
  const { get, start } = await boot(2);
  await start();

  const decks = get('decks').querySelectorAll('.deck');
  assert.equal(decks.length, 3, 'três baralhos físicos no canto');
  assert.ok(get('decks').querySelector('[data-count="sorte"]').textContent.includes('/'), 'mostra a contagem');

  assert.equal(get('drawer').hidden, true, 'diário fechado no início');
  get('btn-log').click();
  assert.equal(get('drawer').hidden, false, 'o diário abre no botão');
  get('btn-drawer-close').click();
  assert.equal(get('drawer').hidden, true, 'e fecha de novo');
});

test('GUI: a câmera pode ser afastada da peça e voltar ao foco', async () => {
  const { state, get, start } = await boot(2);
  await start();

  const cam = state.camera;
  const foco = cam.targetX();
  cam.lookBy(600);
  assert.notEqual(cam.targetX(), foco, 'o jogador pode olhar à frente');
  cam.recenter();
  assert.equal(cam.targetX(), foco, 'recentrar volta o foco para a peça');

  get('btn-recenter').click();
  assert.equal(cam.look, 0);
});

/* ------------------------------------------------------------------ */
/* Partida inteira                                                     */
/* ------------------------------------------------------------------ */
test('GUI: uma partida completa é jogável até o vencedor', async () => {
  const { api, state, get, start } = await boot(2);
  await start();

  api.uiConfig.instant = false;
  api.uiConfig.stepMs = 1;
  api.uiConfig.dieTicks = 0;

  let passos = 0;
  while (get('winner-modal').hidden && passos < 4000) {
    passos += 1;

    // Fecha a carta, se houver uma na mesa.
    if (!get('card-stage').hidden) {
      get('btn-card-ok').click();
      await flush(6);
      continue;
    }

    // Responde a pergunta, se estiver aberta (e depois lê o "você sabia?").
    if (!get('question-modal').hidden) {
      const opt = get('question-options').querySelectorAll('.option');
      if (opt.length && !opt[0].disabled) {
        opt[passos % opt.length].click();
        await flush(6);
        continue;
      }
      if (!get('btn-question-ok').hidden) {
        get('btn-question-ok').click();
        await flush(6);
        continue;
      }
    }

    // Rola o dado.
    get('die').click();
    await flush(8);
  }

  assert.ok(passos < 4000, 'a partida terminou em número razoável de passos');
  assert.equal(get('winner-modal').hidden, false, 'a tela de vencedor apareceu');
  assert.ok(get('winner-name').textContent.includes('venceu'), 'anuncia o vencedor');
  assert.equal(get('ranking-list').querySelectorAll('li').length, 2, 'ranking com os dois jogadores');
  assert.equal(state.game.isFinished, true, 'o motor fechou a partida');

  // O peão do vencedor chegou ao fim do percurso.
  const fim = state.layout.houses.find((h) => h.index === state.game.finishIndex);
  const peao = get('pawns').querySelectorAll('.pawn')[state.game.winnerIndex];
  assert.ok(Math.abs(Number(peao.style.left.replace('px', '')) - fim.x) < 20, 'o vencedor está na chegada');
});
  assert.ok(Math.abs(Number(peao.style.left.replace('px', '')) - alvo.x) < 15, 'parou na casa certa');
  assert.ok(Math.abs(Number(peao.style.top.replace('px', '')) - alvo.y) < 1, 'no ponto do percurso');
});
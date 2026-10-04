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

/** Espera uma promessa, mas nunca deixa o teste pendurado para sempre. */
function settle(promise, ms = 3000) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, rej) => setTimeout(() => rej(new Error('a ação não terminou a tempo')), ms)),
  ]);
}

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

  // O céu muda a cada era, com uma faixa de degradê nas divisas (nada de corte seco).
  const ceu = get('px-sky').querySelectorAll('.sky-slice');
  assert.equal(ceu.length, 17, '9 faixas de céu + 8 transições');
  assert.equal(get('px-sky').querySelectorAll('.sky-blend').length, 8, 'uma transição por divisa');

  // O cenário é desenhado: SVGs com viewBox do tamanho real do trecho
  // (sem preserveAspectRatio="none", que era o que esticava as formas).
  const cenario = get('px-far').innerHTML;
  assert.ok(cenario.includes('<svg'), 'há cenário desenhado no fundo');
  assert.doesNotMatch(cenario, /preserveAspectRatio/, 'nada de eixo esticado');

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
  const faces = get('die-cube').querySelectorAll('.die-face');
  assert.equal(faces.length, 6, 'o dado é um cubo de 6 faces');
  assert.equal(die.dataset.face, '0', 'ainda não rolou');
  // Cada face desenha a sua quantidade de pontos.
  assert.equal(faces[0].querySelectorAll('.pip').length, 9, 'cada face tem a grade de 9 posições');

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

  // Passos rápidos, mas ainda animados.
  api.uiConfig.instant = false;
  api.uiConfig.stepMs = 2;
  api.uiConfig.dieTicks = 0;
  api.uiConfig.forcedRoll = 4;

  const peao = get('pawns').querySelectorAll('.pawn')[0];
  const clique = get('die').click();
  void clique;
  await settle(state.rolling);

  assert.equal(state.game.players[0].position, 4, 'andou as 4 casas do dado');

  // O RASTRO prova que passou por cada casa, em ordem — sem pular nenhuma.
  // (Antes isto era medido com timer e dava resultado instável.)
  assert.deepEqual(state.trail[0], [1, 2, 3, 4], 'o trajeto foi casa a casa, em ordem');

  // E parou exatamente na casa sorteada, no ponto do caminho
  // (o peão tem um deslocamento lateral para não cobrir o companheiro).
  const alvo = state.layout.houses.find((h) => h.index === 4);
  const deslocamento = (0 - (state.game.players.length - 1) / 2) * 32;
  assert.ok(
    Math.abs(Number(peao.style.left.replace('px', '')) - (alvo.x + deslocamento)) < 2,
    'parou na casa certa',
  );
  assert.ok(
    Math.abs(Number(peao.style.top.replace('px', '')) - alvo.y) < 6,
    'no ponto do percurso',
  );
});

test('GUI: errar a pergunta faz a peça VOLTAR casa a casa', async () => {
  const { api, state, get, start } = await boot(2);
  await start();

  api.uiConfig.stepMs = 2;
  api.uiConfig.dieTicks = 0;
  api.uiConfig.instant = false;

  // Da casa 6 com um 3 no dado, cai na casa 9 (Pergunta).
  state.game.players[0].position = 6;
  state.pos[0] = 6;
  state.trail[0] = [];
  state.game.questionDeck.pile = [state.game.questionDeck.items[0]];
  api.uiConfig.forcedRoll = 3;

  get('die').click();
  await flush(80); // o peão caminha até a casa 9 e a pergunta abre

  assert.equal(get('question-modal').hidden, false, 'a pergunta abriu');
  assert.deepEqual(state.trail[0], [7, 8, 9], 'foi casa a casa até a pergunta');

  // Responde ERRADO: volta para a casa onde estava antes de rolar (6).
  const q = state.game.pendingQuestion;
  const errada = (q.correctIndex + 1) % q.options.length;
  get('question-options').querySelectorAll('.option')[errada].click();
  await flush(20);
  get('btn-question-ok').click(); // com animação, o fato espera o "Continuar"
  await settle(state.rolling);

  assert.equal(state.game.players[0].position, 6, 'voltou para a casa 6');
  assert.deepEqual(
    state.trail[0],
    [7, 8, 9, 8, 7, 6],
    'a volta também foi casa a casa, na ordem inversa',
  );
});

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

/* ------------------------------------------------------------------ */
/* Regressões dos bugs relatados ao jogar no navegador                 */
/* ------------------------------------------------------------------ */
test('BUG: clicar no dado rola o dado (o palco não rouba o clique)', async () => {
  const { api, state, get, start } = await boot(2);
  await start();
  api.uiConfig.forcedRoll = 2; // casa comum: sem pergunta nem carta

  const die = get('die');
  const palco = get('stage');

  // Reproduz o gesto real: pointerdown no dado, e então o click.
  palco.dispatchEvent('pointerdown', {
    target: die,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  palco.dispatchEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 100 });
  die.click();

  await settle(state.rolling);

  assert.equal(state.game.players[0].position, 2, 'o dado rolou e o peão andou 2 casas');
  assert.equal(die.dataset.face, '2', 'a face do dado foi atualizada');
});

test('BUG: um clique curto no palco não é tratado como arrasto', async () => {
  const { state, get, start } = await boot(2);
  await start();

  const palco = get('stage');
  // Ancora no meio do mundo: no início a câmera está no limite e não
  // teria para onde se mexer.
  const meio = state.layout.houses.find((h) => h.index === 15).x;
  state.camera.setAnchor(meio);
  const antes = state.camera.targetX();

  palco.dispatchEvent('pointerdown', { target: palco, pointerId: 7, clientX: 300, clientY: 200 });
  palco.dispatchEvent('pointermove', { pointerId: 7, clientX: 302, clientY: 200 }); // 2px
  palco.dispatchEvent('pointerup', { pointerId: 7, clientX: 302, clientY: 200 });

  assert.equal(state.camera.targetX(), antes, 'clique sem arrasto não move a câmera');

  // Já um arrasto de verdade move.
  palco.dispatchEvent('pointerdown', { target: palco, pointerId: 8, clientX: 300, clientY: 200 });
  palco.dispatchEvent('pointermove', { pointerId: 8, clientX: 340, clientY: 200 }); // inicia o arrasto
  palco.dispatchEvent('pointermove', { pointerId: 8, clientX: 380, clientY: 200 }); // desloca de fato
  palco.dispatchEvent('pointerup', { pointerId: 8, clientX: 380, clientY: 200 });
  assert.notEqual(state.camera.targetX(), antes, 'arrastar move a câmera');
});

test('BUG: o diário nasce fechado (hidden vence o display:flex)', async () => {
  const css = readFileSync(join(root, 'style.css'), 'utf8');
  assert.match(
    css,
    /\.drawer\[hidden\]\s*\{\s*display:\s*none/,
    'o CSS precisa de .drawer[hidden] { display: none }',
  );

  // Todas as caixas que usam display fora do padrão precisam da mesma trava.
  for (const seletor of ['.overlay', '.card-stage', '.fact', '.drawer']) {
    assert.match(css, new RegExp(`\\${seletor}\\[hidden\\]`), `${seletor} precisa de [hidden]`);
  }
});

test('BUG: a câmera segue o próximo jogador na troca de turno', async () => {
  const { api, state, get, start } = await boot(2);
  await start();

  api.uiConfig.instant = true;
  api.uiConfig.forcedRoll = 2; // casa 2 + 2 = casa 4, uma casa comum

  // Deixa os dois bem distantes, como acontece no meio da partida.
  state.game.players[0].position = 2;
  state.pos[0] = 2;
  state.game.players[1].position = 22;
  state.pos[1] = 22;

  const alvo1 = state.layout.houses.find((h) => h.index === 22).x;

  // O jogador 0 rola e passa a vez: a câmera precisa ir para o jogador 1.
  state.game.currentPlayerIndex = 0;
  state.game.phase = 'awaiting_roll';
  get('die').click();
  await settle(state.rolling);

  assert.equal(state.game.currentPlayerIndex, 1, 'o turno passou para o jogador 1');
  assert.equal(state.camera.anchorX, alvo1, 'a câmera foi para o peão do próximo jogador');
});

test('BUG: os peões não se cobrem na mesma casa', async () => {
  const { state, get, start } = await boot(4);
  await start();

  const peoes = get('pawns').querySelectorAll('.pawn');
  const xs = peoes.map((p) => Number(p.style.left.replace('px', '')));

  // Todos começam na casa 0: precisam estar visivelmente separados.
  for (let i = 1; i < xs.length; i += 1) {
    assert.ok(
      Math.abs(xs[i] - xs[i - 1]) >= 30,
      `os peões ${i - 1} e ${i} estão separados (${Math.abs(xs[i] - xs[i - 1]).toFixed(0)}px)`,
    );
  }
  assert.equal(state.pos.every((p) => p === 0), true, 'todos na casa de partida');
});

test('GUI: a câmera pode ser afastada da peça e voltar ao foco', async () => {
  const { state, get, start } = await boot(2);
  await start();

  const cam = state.camera;
  const neutro = cam.targetX();

  cam.panBy(600);
  assert.notEqual(cam.targetX(), neutro, 'o jogador pode olhar à frente');

  cam.recenter();
  assert.equal(cam.targetX(), neutro, 'recentrar volta o foco para a peça');

  get('btn-recenter').click();
  assert.equal(cam.targetX(), neutro, 'o botão também volta o foco');
});

test('GUI: a roda do mouse não tem zona morta (o deslocamento é limitado)', async () => {
  const { state, start } = await boot(2);
  await start();

  const cam = state.camera;

  // Rolagem muito além do fim do mundo: o deslocamento para no limite.
  for (let i = 0; i < 60; i += 1) cam.panBy(400);
  const noLimite = cam.targetX();
  assert.equal(noLimite, cam.maxX, 'a câmera para no fim do mundo');

  // E o primeiro movimento de volta responde NA HORA (era o bug: precisava
  // desfazer 10.000px antes de a câmera se mexer).
  cam.panBy(-100);
  assert.equal(cam.targetX(), cam.maxX - 100, 'voltar um pouco já move a câmera');

  for (let i = 0; i < 60; i += 1) cam.panBy(-400);
  assert.equal(cam.targetX(), 0, 'a câmera para no começo do mundo');

  cam.panBy(100);
  assert.equal(cam.targetX(), 100, 'e volta sem zona morta');
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
  const deslocVencedor = (state.game.winnerIndex - (state.game.players.length - 1) / 2) * 32;
  assert.ok(
    Math.abs(Number(peao.style.left.replace('px', '')) - (fim.x + deslocVencedor)) < 20,
    'o vencedor está na chegada',
  );
});
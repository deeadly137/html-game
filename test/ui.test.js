/**
 * ui.test.js — Teste de fumaça da GUI (src/ui.js) rodando sem navegador,
 * com um DOM mínimo (tools/fake-dom.js).
 *
 * Valida a cadeia completa: montagem da tela de setup -> início da partida ->
 * renderização do tabuleiro -> rolagens -> respostas -> tela de vencedor.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFakeDocument, parseHtmlIds } from '../tools/fake-dom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const flush = () => new Promise((resolve) => setTimeout(resolve, 1));

test('GUI: fluxo completo do jogo até a tela de vencedor', async () => {
  // 1) Monta um "documento" com todos os ids declarados no index.html.
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const entries = parseHtmlIds(html);
  assert.ok(entries.length > 20, 'index.html deve conter os elementos da interface');

  const doc = createFakeDocument(entries);
  globalThis.document = doc;
  doc.byId.get('player-count').value = '2';

  // 2) Importa a interface (init() roda no carregamento do módulo).
  const ui = await import('../src/ui.js');
  ui.uiConfig.animTicks = 1; // sem animação do dado
  ui.uiConfig.answerDelayMs = 0; // sem espera após responder

  const get = (id) => doc.byId.get(id);

  assert.ok(get('screen-setup').classList.contains('active'), 'tela de setup visível ao iniciar');
  assert.equal(get('player-fields').querySelectorAll('.player-row').length, 2, '2 campos de jogador');

  // 3) Trocar o número de jogadores recria os campos.
  get('player-count').value = '4';
  get('player-count').dispatchEvent('change');
  assert.equal(get('player-fields').querySelectorAll('.player-row').length, 4);

  get('player-count').value = '2';
  get('player-count').dispatchEvent('change');
  const rows = get('player-fields').querySelectorAll('.player-row');
  assert.equal(rows.length, 2);
  rows[0].querySelector("input[type='text']").value = 'Ana';
  rows[1].querySelector("input[type='text']").value = 'Bia';
  get('seed-input').value = '4242';

  // 4) Regras abrem e fecham.
  get('btn-rules').click();
  assert.equal(get('rules-modal').hidden, false);
  get('btn-rules-close').click();
  assert.equal(get('rules-modal').hidden, true);

  // 5) Inicia a partida.
  get('btn-start').click();
  assert.equal(get('screen-setup').classList.contains('active'), false);
  assert.equal(get('screen-game').classList.contains('active'), true);
  assert.equal(get('board').querySelectorAll('.tile').length, 30, 'tabuleiro com 30 casas');
  assert.equal(get('board').querySelectorAll('.era-group').length, 9, '9 faixas: partida + 7 eras + chegada');
  assert.ok(get('board').querySelectorAll('.era-label').length === 9, 'cada faixa tem seu rótulo de era');
  assert.equal(get('board').querySelectorAll('.era-group.reverse').length, 0, 'nenhuma faixa invertida');
  assert.equal(get('board').querySelectorAll('.tile.type-sorte').length, 5, '5 casas de Sorte');
  assert.equal(get('board').querySelectorAll('.tile.type-reverse').length, 5, '5 casas Reverse');
  assert.equal(get('board').querySelectorAll('.tile.type-pergunta').length, 7, '7 casas de Pergunta');

  // A trilha não pode quebrar linha: cada era é UMA faixa com suas casas.
  const casasPorEra = get('board').querySelectorAll('.era-group').map((g) => g.querySelectorAll('.tile').length);
  assert.deepEqual(
    casasPorEra,
    [1, 4, 4, 4, 4, 4, 4, 4, 1],
    'Partida (1) + 7 eras (4 casas cada) + Chegada (1)',
  );

  // A ordem das casas é crescente, da esquerda para a direita, faixa por faixa.
  for (const grupo of get('board').querySelectorAll('.era-group')) {
    const casas = grupo.querySelectorAll('.tile').map((t) => Number(t.dataset.index));
    const crescente = casas.every((n, i) => i === 0 || n === casas[i - 1] + 1);
    assert.ok(crescente, `a faixa deve ler em ordem crescente: [${casas.join(' ')}]`);
  }

  // Detalhes visuais de jogo
  const die = get('die-display');
  assert.equal(die.querySelectorAll('.pip').length, 9, 'dado montado com 9 pontos');
  assert.equal(die.dataset.face, '0', 'dado começa mostrando "?"');

  // Mesa de cartas na parte inferior: 3 baralhos + a carta em jogo.
  const tray = get('deck-sorte').parentNode;
  assert.equal(tray.querySelectorAll('.deck').length, 3, 'a mesa tem os 3 baralhos');
  assert.equal(get('count-sorte').textContent, '12/12', 'baralho de Sorte começa com 12 cartas');
  assert.equal(get('count-reverse').textContent, '12/12', 'baralho de Reverse começa com 12 cartas');
  assert.equal(get('count-pergunta').textContent, '21/21', 'baralho de Perguntas começa com 21 cartas');
  assert.ok(get('drawn-card').classList.contains('drawn-empty'), 'mesa começa vazia');
  assert.ok(get('drawn-text').textContent.includes('puxar'), 'mesa explica o que aparece ali');

  assert.ok(get('score-list').innerHTML.includes('Ana'), 'placar mostra a Ana');
  assert.ok(get('score-list').innerHTML.includes('Bia'), 'placar mostra a Bia');
  // No início da partida, só a casa do jogador da vez fica destacada.
  assert.equal(doc.querySelectorAll('.tile.highlight').length, 1, 'casa do jogador da vez destacada');
  assert.equal(doc.querySelectorAll('.tile.highlight')[0].dataset.index, '0', 'destaque na casa de partida');

  // 6) Joga sozinho até o fim, interagindo pelos mesmos botões da GUI.
  const btnRoll = get('btn-roll');
  const questionOptions = get('question-options');
  const winnerModal = get('winner-modal');

  let steps = 0;
  while (winnerModal.hidden && steps < 3000) {
    steps += 1;
    if (!get('question-modal').hidden) {
      const option = questionOptions.querySelector('.option');
      assert.ok(option, 'a pergunta deve exibir alternativas');
      assert.equal(option.disabled, false, 'alternativas clicáveis');
      option.click();
      await flush();
      continue;
    }
    if (!btnRoll.disabled) {
      btnRoll.click();
      await flush();
      assert.ok(
        ['1', '2', '3', '4', '5', '6'].includes(die.dataset.face),
        `o dado deve mostrar a face sorteada (data-face=${die.dataset.face})`,
      );
      continue;
    }
    await flush();
  }

  assert.equal(winnerModal.hidden, false, 'a tela de vencedor deve aparecer');
  assert.ok(steps < 3000, 'a partida deve terminar em número razoável de passos');
  assert.ok(get('winner-name').textContent.includes('venceu'), 'anuncia o vencedor');
  assert.ok(get('ranking-list').innerHTML.includes('pts'), 'mostra o ranking final');
  assert.ok(get('log-list').innerHTML.includes('Fim de jogo'), 'diário registra o fim');

  // 7) Peões aparecem no tabuleiro, com a cor da raiz cultural.
  const tokens = doc.querySelectorAll('[data-tokens]').flatMap((tile) => tile.children);
  assert.equal(tokens.length, 2, 'os dois peões estão posicionados no tabuleiro');
  for (const token of tokens) {
    const cor = token.style.getPropertyValue('--pawn-color');
    assert.match(cor, /^#[0-9a-f]{6}$/i, 'cada peão recebe a cor da sua raiz cultural');
  }
  // Ao fim do jogo o destaque da vez desaparece.
  assert.equal(doc.querySelectorAll('.tile.highlight').length, 0, 'sem destaque após o fim');

  // A mesa de cartas guarda a última carta/pergunta em jogo.
  assert.equal(get('drawn-card').classList.contains('drawn-empty'), false, 'mesa mostra a última carta');
  assert.ok(get('drawn-text').innerHTML.includes('drawn-kind'), 'a carta na mesa tem tipo/título');
  assert.ok(get('drawn-text').innerHTML.includes('drawn-body'), 'a carta na mesa tem o texto');
  // 8) "Jogar de novo" volta para o setup com os campos recriados.
  get('btn-again').click();
  assert.equal(get('screen-setup').classList.contains('active'), true);
  assert.equal(get('player-fields').querySelectorAll('.player-row').length, 2);
});

/* ------------------------------------------------------------------ */
/* Regressão: a trilha do tabuleiro não pode quebrar em duas linhas.   */
/* (Era o bug em que a era aparecia como "3 2 1 / - - 4".)             */
/* ------------------------------------------------------------------ */
test('CSS: a trilha do tabuleiro fica em uma única faixa (sem quebra de linha)', () => {
  const css = readFileSync(join(root, 'style.css'), 'utf8');

  // Varre TODAS as regras que miram .era-track (inclusive dentro de media queries).
  const regras = [...css.matchAll(/([^{}]*\.era-track[^{}]*)\{([^}]*)\}/g)];
  assert.ok(regras.length > 0, 'style.css deve definir .era-track');

  for (const [, seletor, corpo] of regras) {
    const nome = seletor.trim();
    assert.doesNotMatch(corpo, /auto-fit|auto-fill/, `${nome}: auto-fit/auto-fill quebra a faixa`);
    assert.doesNotMatch(corpo, /grid-template-columns/, `${nome}: não deve usar grid (a trilha é flex)`);
    assert.doesNotMatch(corpo, /flex-wrap:\s*wrap/, `${nome}: wrap quebraria a era em duas linhas`);
  }

  const principal = css.match(/\.era-track\s*\{([^}]*)\}/)[1];
  assert.match(principal, /display:\s*flex/, '.era-track deve usar flex');

  // As casas precisam poder encolher para caber na faixa.
  const casas = css.match(/\.era-track\s*>\s*\.tile\s*\{([^}]*)\}/);
  assert.ok(casas, '.era-track > .tile deve ter regra própria');
  assert.match(casas[1], /min-width:\s*0/, 'as casas precisam de min-width: 0 para encolher');
  assert.match(casas[1], /flex:\s*1 1 0/, 'as casas dividem a faixa igualmente');
});
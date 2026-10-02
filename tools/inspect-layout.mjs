import { readFileSync } from 'node:fs';
import { createFakeDocument, parseHtmlIds } from '../tools/fake-dom.js';

const html = readFileSync('index.html', 'utf8');

/* ---------- 1) Estrutura do layout (estática, no HTML) ---------- */
console.log('=== ESTRUTURA (index.html) ===');

// Recorta o painel esquerdo para verificar a ordem placar -> cartas.
const leftStart = html.indexOf('class="panel panel-left"');
const leftEnd = html.indexOf('</aside>', leftStart);
const leftHtml = html.slice(leftStart, leftEnd);
const posScore = leftHtml.indexOf('id="score-list"');
const posDeck = leftHtml.indexOf('id="deck-sorte"');

console.log('tabuleiro no centro .......', html.includes('class="board-panel"'));
console.log('painel esquerdo ...........', leftStart !== -1);
console.log('  placar dentro dele ......', posScore !== -1);
console.log('  mesa de cartas dentro ...', posDeck !== -1);
console.log('  cartas ABAIXO do placar .', posScore !== -1 && posDeck > posScore);
console.log('dado + diario na direita ..', html.includes('class="panel panel-right"'));
console.log('baralhos na mesa ..........', (leftHtml.match(/class="deck /g) || []).length);
console.log('carta em jogo .............', leftHtml.includes('id="drawn-card"'));

/* ---------- 2) Grade de layout (CSS) ---------- */
const css = readFileSync('style.css', 'utf8');
console.log('\n=== GRADE DE LAYOUT (CSS) ===');
const areaBlock = (css.match(/grid-template-areas:\s*((?:'[^']*'\s*)+);/) || [])[1] || '';
(areaBlock.match(/'[^']*'/g) || []).forEach((row) => console.log('  ' + row.replace(/'/g, '')));

/* ---------- 2) Comportamento em tempo de execução ---------- */
const doc = createFakeDocument(parseHtmlIds(html));
globalThis.document = doc;
doc.byId.get('player-count').value = '2';

const ui = await import('../src/ui.js');
ui.uiConfig.animTicks = 1;
ui.uiConfig.answerDelayMs = 0;

doc.byId.get('seed-input').value = '11';
doc.byId.get('btn-start').click();

const get = (id) => doc.byId.get(id);
const flush = () => new Promise((r) => setTimeout(r, 1));
const counts = () => ['sorte', 'reverse', 'pergunta'].map((k) => `${k}=${get('count-' + k).textContent}`).join('  ');

console.log('\n=== BARALHOS (início) ===');
console.log('  ' + counts());
console.log('  mesa vazia ..............', get('drawn-card').classList.contains('drawn-empty'));
console.log('  texto de espera .........', JSON.stringify(get('drawn-text').textContent));

const roll = get('btn-roll');
let rolls = 0;
while (rolls < 15 && get('winner-modal').hidden) {
  if (!get('question-modal').hidden) {
    get('question-options').querySelector('.option').click();
    await flush();
    continue;
  }
  if (!roll.disabled) {
    roll.click();
    await flush();
    rolls += 1;
    continue;
  }
  await flush();
}

console.log(`\n=== MESA APÓS ${rolls} ROLAGENS ===`);
console.log('  ' + counts());
console.log('  classe da carta ........', get('drawn-card').className);
console.log('  conteúdo ...............', get('drawn-text').innerHTML.replace(/<[^>]+>/g, ' › ').trim().slice(0, 110));

/* ---------- 3) Ordem das casas, faixa por faixa ---------- */
console.log('\n=== ORDEM DAS CASAS (faixa por faixa) ===');
const casasPorFaixa = doc.byId.get('board').querySelectorAll('.era-group').map((g) => ({
  nome: g.querySelector('.era-label').querySelector('.era-name').textContent,
  casas: g.querySelectorAll('.tile').map((t) => Number(t.dataset.index)),
}));
for (const { nome, casas } of casasPorFaixa) {
  const crescente = casas.every((n, i) => i === 0 || n === casas[i - 1] + 1);
  console.log('  ' + (crescente ? 'ok  ' : 'ERRO') + '[' + casas.join(' ').padEnd(12) + '] ' + nome);
}
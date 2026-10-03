/**
 * inspect-world.mjs — imprime a geometria do mundo horizontal.
 *
 * Ferramenta de apoio: mostra como o percurso fica (comprimentos, níveis,
 * pontos das casas) sem precisar abrir o navegador.
 *
 *   node tools/inspect-world.mjs
 */
import { SCENES, SEGMENTS, BOARD, WORLD } from '../src/data.js';
import { buildLayout, worldWidth, pointAtS, Camera } from '../src/world.js';

const ALTURA = 800;
const layout = buildLayout({ height: ALTURA });
const total = worldWidth();

const linha = (s) => console.log(s);
const barra = (v, max, largura = 28) => '█'.repeat(Math.max(1, Math.round((v / max) * largura)));

linha('MUNDO HORIZONTAL');
linha(`  largura total ....... ${total}px`);
linha(`  altura de referência  ${ALTURA}px`);
linha(`  trechos ............. ${layout.segments.length}`);
linha(`  casas ............... ${layout.houses.length}`);
linha(`  respiro nas pontas .. ${WORLD.pad}px de cada lado\n`);

const maior = Math.max(...layout.segments.map((s) => s.scene.length));
linha('TRECHOS (o caminho sobe e desce entre os níveis)');
linha('  #  era              comprimento  nível entrada → saída   casas');
layout.segments.forEach((seg) => {
  const n0 = (seg.y0 / ALTURA).toFixed(2);
  const n1 = (seg.y1 / ALTURA).toFixed(2);
  const casas = seg.houses.map((h) => h.index).join(',') || '-';
  linha(
    `  ${String(seg.segIndex).padStart(1)}  ${seg.id.padEnd(16)} ` +
      `${String(seg.scene.length).padStart(6)}px   ${barra(seg.scene.length, maior)}  ` +
      `${n0} → ${n1}     [${casas}]`,
  );
});

linha('\nCASAS (posição no mundo)');
layout.houses.forEach((h) => {
  linha(
    `  casa ${String(h.index).padStart(2)}  x=${String(Math.round(h.x)).padStart(5)}  ` +
      `y=${String(Math.round(h.y)).padStart(4)}  ${String(h.type).padEnd(9)} ${h.name}`,
  );
});

linha('\nCONTÍNUO? as casas avançam para a direita, sem voltar');
const xs = layout.houses.map((h) => h.x);
linha(`  ${xs.every((x, i) => i === 0 || x > xs[i - 1]) ? 'sim' : 'NÃO'}`);

linha('\nCÂMERA (a peça fica a 38% da tela; a câmera desliza com lerp)');
const cam = new Camera();
cam.setBounds(1280, total);
[0, 0.25, 0.5, 0.75, 1].forEach((s) => {
  const p = pointAtS(layout, s);
  cam.setAnchor(p.x);
  cam.jump();
  linha(`  ${String(Math.round(s * 100)).padStart(3)}% do percurso → x=${String(Math.round(p.x)).padStart(5)}  câmera em ${Math.round(cam.x)}`);
});
linha(`  limite máximo da câmera: ${Math.round(cam.maxX)}`);

linha('\nOBSERVAÇÃO: cada trecho tem um comprimento próprio, então as eras');
linha('não ocupam o mesmo espaço — a duração da escravidão é o trecho mais longo.');
linha(`  mais longo: ${SEGMENTS.map((s) => SCENES[s.id].length).indexOf(maior) + 1}º trecho, com ${maior}px`);
linha(`  casas por trecho: ${layout.segments.map((s) => s.houses.length).join(', ')}`);
linha(`  total de casas no BOARD: ${BOARD.length}`);
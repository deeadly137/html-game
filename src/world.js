/**
 * world.js — geometria do mundo horizontal e a câmera.
 *
 * Módulo PURO (sem DOM): a mesma matemática que gera o `d` do caminho SVG
 * também posiciona as casas e faz as peças andarem pelo percurso, então dá
 * para testar tudo no Node.
 *
 * O percurso é uma onda contínua: cada trecho (era) sai do nível onde o
 * anterior chegou, seguindo meia onda de cosseno — o que deixa a curva
 * suave e sem bicos nas junções.
 */
import { BOARD, SCENES, SEGMENTS, LEVELS, WORLD, PROFILES } from './data.js';

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * Posição dentro de um trecho.
 * @param seg  { x0, x1, y0, y1 }
 * @param u    0 = entrada do trecho, 1 = saída
 * @param height altura da tela (px)
 */
export function pointInSegment(seg, u, height) {
  const t = clamp(u, 0, 1);
  const x = seg.x0 + (seg.x1 - seg.x0) * t;
  // meia onda de cosseno: y'(0) = y'(1) = 0 (sem bicos entre as eras)
  const base = seg.y0 + (seg.y1 - seg.y0) * (1 - Math.cos(Math.PI * t)) / 2;
  // ondulação interna que morre nas pontas
  const ripple =
    Math.sin(Math.PI * t) * (WORLD.ripple * height) * Math.sin(2 * Math.PI * WORLD.rippleBumps * t);
  return { x, y: base + ripple };
}

/** Largura total do mundo em px (trechos + respiro das pontas). */
export function worldWidth() {
  return WORLD.pad * 2 + SEGMENTS.reduce((sum, s) => sum + SCENES[s.id].length, 0);
}

/** Monta o percurso: trechos com posição/nível e as casas ao longo deles. */
export function buildLayout({ height = 800 } = {}) {
  const total = SEGMENTS.reduce((sum, s) => sum + SCENES[s.id].length, 0);

  let cursor = 0;
  let acc = 0;

  const segments = SEGMENTS.map((seg, i) => {
    const scene = SCENES[seg.id];
    const x0 = cursor;
    const x1 = cursor + scene.length;
    const y0 = LEVELS[i] * height;
    const y1 = LEVELS[i + 1] * height;
    const sBefore = acc / total;

    const spaces = BOARD.filter((sp) =>
      seg.era === 'start' ? sp.type === 'start' : seg.era === 'finish' ? sp.type === 'finish' : sp.era === seg.era,
    );

    const n = spaces.length;
    const houses = spaces.map((space, j) => {
      const u = n === 1 ? 0.5 : WORLD.edge + (j / (n - 1)) * (1 - 2 * WORLD.edge);
      const pt = pointInSegment({ x0, x1, y0, y1 }, u, height);
      return {
        index: space.index,
        name: space.name,
        type: space.type,
        era: space.era,
        color: space.color,
        segIndex: i,
        segId: seg.id,
        u,
        x: pt.x,
        y: pt.y,
        s: sBefore + (u * scene.length) / total,
      };
    });

    cursor = x1;
    acc += scene.length;

    return { id: seg.id, segIndex: i, x0, x1, y0, y1, scene, houses, s0: sBefore, s1: acc / total };
  });

  const houses = segments.flatMap((s) => s.houses).sort((a, b) => a.index - b.index);
  return { width: WORLD.pad * 2 + total, height, segments, houses, pad: WORLD.pad };
}

/** Posição no percurso a partir do parâmetro global s (0..1). */
export function pointAtS(layout, s) {
  const t = clamp(s, 0, 1);
  const seg =
    layout.segments.find((x) => t >= x.s0 && t <= x.s1) || layout.segments[layout.segments.length - 1];
  const span = seg.s1 - seg.s0 || 1;
  return pointInSegment(seg, (t - seg.s0) / span, layout.height);
}

/** Caminho SVG (polilinha amostrada) que desenha o percurso. */
export function pathD(layout, { step = 10 } = {}) {
  const n = Math.max(2, Math.round(layout.width / step));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const p = pointAtS(layout, i / n);
    pts.push(`${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  return pts.join(' ');
}

/**
 * Silhueta de cenário: perfil de alturas 0..1 vira um caminho fechado.
 * O espaço vertical é 0..100 e o SVG estica com preserveAspectRatio="none",
 * por isso o preenchimento não distorce.
 */
export function silhouettePath(profile, width, { base = 64, amp = 26 } = {}) {
  const n = profile.length;
  const pts = profile.map((v, i) => {
    const x = (i / (n - 1)) * width;
    const y = base - v * amp;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `${pts.join(' ')} L${width} 100 L0 100 Z`;
}

/** Perfil de silhueta de um trecho (com deslocamento para variar entre eras). */
export function profileFor(segId, offset = 0) {
  const nome = SCENES[segId] ? SCENES[segId].profile : 'campo';
  const base = PROFILES[nome] || PROFILES.campo;
  if (!offset) return base;
  const n = base.length;
  return base.map((_, i) => base[(i + offset) % n]);
}

/* ------------------------------------------------------------------ */
/* Cenários desenhados                                                */
/* ------------------------------------------------------------------ */
/* Paleta fechada, de xilogravura: papel, tinta, ocre, terracota,     */
/* azul e verde. Cada peça é preenchimento chapado + contorno preto.  */
export const PAL = Object.freeze({
  paper: '#f2e8d5',
  ink: '#1c1a17',
  ocre: '#e0a03a',
  terra: '#c0492f',
  azul: '#2b4a6f',
  verde: '#2f7d4f',
  areia: '#e8d3a8',
  madeira: '#6b4a2c',
});

const ST =
  'stroke="#1c1a17" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

/* ---- peças soltas (coordenadas reais, base no chão) ---- */
const PROPS = {
  /** Oca: parede + telhado de palha. */
  oca: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-34 0 L-34 -30 L34 -30 L34 0 Z" fill="${c.wall}" ${ST}/>` +
    `<path d="M-42 -28 L0 -66 L42 -28 Z" fill="${PAL.ocre}" ${ST}/>` +
    `<rect x="-9" y="-20" width="18" height="20" fill="${PAL.ink}"/>` +
    `</g>`,

  /** Árvore: tronco + copa em três camadas. */
  arvore: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect x="-6" y="-46" width="12" height="46" fill="${PAL.madeira}" ${ST}/>` +
    `<circle cx="0" cy="-62" r="30" fill="${c.far}" ${ST}/>` +
    `<circle cx="-22" cy="-44" r="20" fill="${c.far}" ${ST}/>` +
    `<circle cx="22" cy="-44" r="20" fill="${c.far}" ${ST}/>` +
    `</g>`,

  /** Canavial: moita de folhas altas. */
  cana: (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="none" ${ST}>` +
    `<path d="M0 0 C-4 -34 -2 -60 4 -84"/>` +
    `<path d="M-14 0 C-18 -28 -22 -46 -30 -62"/>` +
    `<path d="M14 0 C18 -28 22 -46 30 -62"/>` +
    `<path d="M0 -30 C-16 -40 -24 -44 -32 -44"/>` +
    `<path d="M2 -50 C18 -60 26 -64 34 -64"/>` +
    `</g>`,

  /** Caravela: casco, mastro e duas velas. */
  caravela: (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-46 0 C-40 16 40 16 46 0 Z" fill="${PAL.madeira}" ${ST}/>` +
    `<rect x="-2" y="-86" width="4" height="86" fill="${PAL.madeira}" ${ST}/>` +
    `<path d="M4 -84 C40 -68 40 -40 4 -30 Z" fill="${PAL.paper}" ${ST}/>` +
    `<path d="M-4 -74 C-34 -60 -34 -36 -4 -28 Z" fill="${PAL.paper}" ${ST}/>` +
    `<path d="M-2 -86 L20 -86 L2 -78 Z" fill="${PAL.terra}" ${ST}/>` +
    `</g>`,

  /** Casa colonial: fachada com porta e duas janelas. */
  casa: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect x="-40" y="-56" width="80" height="56" fill="${c.wall}" ${ST}/>` +
    `<path d="M-48 -54 L0 -80 L48 -54 Z" fill="${PAL.terra}" ${ST}/>` +
    `<rect x="-11" y="-30" width="22" height="30" fill="${PAL.madeira}" ${ST}/>` +
    `<rect x="-32" y="-44" width="14" height="14" fill="${PAL.azul}" ${ST}/>` +
    `<rect x="18" y="-44" width="14" height="14" fill="${PAL.azul}" ${ST}/>` +
    `</g>`,

  /** Igreja: torre com cruz. */
  igreja: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect x="-30" y="-74" width="60" height="74" fill="${c.wall}" ${ST}/>` +
    `<rect x="-14" y="-112" width="28" height="40" fill="${c.wall}" ${ST}/>` +
    `<path d="M-20 -110 L0 -136 L20 -110 Z" fill="${PAL.terra}" ${ST}/>` +
    `<path d="M0 -136 L0 -152 M-8 -144 L8 -144" ${ST} fill="none"/>` +
    `<rect x="-8" y="-58" width="16" height="24" fill="${PAL.azul}" ${ST}/>` +
    `</g>`,

  /** Engenho: roda d'água e chaminé. */
  engenho: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect x="-46" y="-50" width="92" height="50" fill="${c.wall}" ${ST}/>` +
    `<path d="M-52 -48 L0 -74 L52 -48 Z" fill="${PAL.terra}" ${ST}/>` +
    `<circle cx="-60" cy="-16" r="16" fill="none" ${ST}/>` +
    `<path d="M-60 -32 L-60 0 M-76 -16 L-44 -16 M-71 -27 L-49 -5 M-49 -27 L-71 -5" ${ST} fill="none"/>` +
    `<rect x="30" y="-96" width="16" height="46" fill="${PAL.terra}" ${ST}/>` +
    `</g>`,

  /** Porto: galpão com guindaste. */
  porto: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect x="-50" y="-44" width="86" height="44" fill="${c.wall}" ${ST}/>` +
    `<path d="M-56 -42 L-7 -66 L42 -42 Z" fill="${PAL.azul}" ${ST}/>` +
    `<rect x="46" y="-92" width="5" height="92" fill="${PAL.ink}"/>` +
    `<path d="M48 -92 L92 -92 L92 -74" ${ST} fill="none"/>` +
    `<rect x="80" y="-74" width="24" height="20" fill="${PAL.madeira}" ${ST}/>` +
    `</g>`,

  /** Navio a vapor. */
  vapor: (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M-52 0 C-46 18 46 18 52 0 Z" fill="${PAL.azul}" ${ST}/>` +
    `<rect x="-30" y="-24" width="60" height="24" fill="${PAL.paper}" ${ST}/>` +
    `<rect x="-10" y="-52" width="24" height="28" fill="${PAL.paper}" ${ST}/>` +
    `<rect x="4" y="-82" width="12" height="30" fill="${PAL.terra}" ${ST}/>` +
    `<circle cx="10" cy="-90" r="9" fill="${PAL.paper}" ${ST}/>` +
    `</g>`,

  /** Prédio moderno com janelas. */
  predio: (x, y, s, c) => {
    const janelas = [-78, -54, -30]
      .map((yy) => [-16, 4].map((xx) => `<rect x="${xx}" y="${yy}" width="12" height="14"/>`).join(''))
      .join('');
    return (
      `<g transform="translate(${x} ${y}) scale(${s})">` +
      `<rect x="-28" y="-104" width="56" height="104" fill="${c.wall}" ${ST}/>` +
      `<g fill="${PAL.ocre}">${janelas}</g>` +
      `<rect x="-6" y="-18" width="12" height="18" fill="${PAL.ink}"/>` +
      `</g>`
    );
  },

  /** Arbusto pequeno (cidade). */
  arbusto: (x, y, s, c) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<rect x="-4" y="-26" width="8" height="26" fill="${PAL.madeira}" ${ST}/>` +
    `<circle cx="0" cy="-34" r="18" fill="${c.far}" ${ST}/>` +
    `</g>`,

  /** Sol / lua. */
  sol: (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><circle r="26" fill="${PAL.ocre}" ${ST}/></g>`,

  /** Bando de aves. */
  aves: (x, y, s) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${PAL.ink}" stroke-width="2.6" stroke-linecap="round">` +
    `<path d="M-18 0 C-12 -7 -6 -7 0 0 C6 -7 12 -7 18 0"/>` +
    `<path d="M24 -16 C29 -21 34 -21 39 -16"/>` +
    `</g>`,
};

/** Que peças aparecem em cada cenário, em ordem. */
const SCENE_KINDS = {
  campo: ['arvore', 'aves', 'arvore'],
  mata: ['arvore', 'oca', 'arvore', 'aves', 'arvore'],
  mar: ['caravela', 'aves', 'caravela'],
  canavial: ['cana', 'engenho', 'cana', 'arvore'],
  casario: ['casa', 'igreja', 'casa', 'arvore'],
  porto: ['porto', 'vapor', 'aves', 'porto'],
  cidade: ['predio', 'arbusto', 'predio', 'predio', 'arvore'],
  mosaico: ['casa', 'arvore', 'predio', 'cana', 'aves', 'igreja'],
};

/** Cor de parede por cenário (o resto vem da paleta). */
const WALLS = {
  campo: PAL.paper,
  mata: '#d9c9a6',
  mar: PAL.paper,
  canavial: PAL.paper,
  casario: PAL.paper,
  porto: PAL.areia,
  cidade: '#cdd6dd',
  mosaico: PAL.paper,
};

/**
 * Desenha o cenário de um trecho em coordenadas REAIS (o viewBox tem o
 * tamanho exato do elemento), então nada fica esticado — o problema do
 * `preserveAspectRatio="none"` que virava triângulos grosseiros.
 */
export function scenerySvg(seg, index, height) {
  const w = Math.max(1, Math.round(seg.x1 - seg.x0));
  const kinds = SCENE_KINDS[seg.scene.profile] || SCENE_KINDS.campo;
  const ctx = { far: seg.scene.far, wall: WALLS[seg.scene.profile] || PAL.paper };
  const partes = [];

  // O chão acompanha o nível do caminho naquele trecho.
  const y0 = Math.round(seg.y0 + height * 0.05);
  const y1 = Math.round(seg.y1 + height * 0.05);
  partes.push(
    `<path d="M0 ${y0} C${w * 0.5} ${y0 - 12} ${w * 0.5} ${y1 - 12} ${w} ${y1} ` +
      `L${w} ${height} L0 ${height} Z" fill="${seg.scene.ground}"/>`,
  );

  // As peças, distribuídas com uma variação FIXA (a cena é sempre a mesma).
  const passo = 165;
  const n = Math.max(2, Math.floor(w / passo));
  for (let k = 0; k < n; k += 1) {
    const x = Math.round(((k + 0.5) / n) * w);
    const kind = kinds[(k + index) % kinds.length];
    const jitter = ((k * 37 + index * 13) % 44) - 22;
    const escala = 0.82 + ((k * 53 + index * 17) % 26) / 100;
    const baseY = Math.round(seg.y0 + (seg.y1 - seg.y0) * ((k + 0.5) / n) + height * 0.06);
    partes.push(PROPS[kind](x + jitter, baseY, escala, ctx));
  }

  // Sol atrás de tudo, nas eras de campo.
  if (seg.scene.profile === 'campo' || seg.scene.profile === 'canavial') {
    partes.unshift(PROPS.sol(Math.round(w * 0.22), Math.round(height * 0.2), 1));
  }

  return (
    `<svg viewBox="0 0 ${w} ${height}" width="${w}" height="${height}" ` +
    `style="position:absolute;left:${seg.x0}px;top:0" aria-hidden="true">` +
    partes.join('') +
    '</svg>'
  );
}

/* ------------------------------------------------------------------ */
/* Câmera                                                             */
/* ------------------------------------------------------------------ */
/**
 * A câmera não move a peça: ela desliza o mundo. O alvo é a peça da vez,
 * com um deslocamento (`look`) que o jogador controla para olhar à frente
 * ou atrás; a barra de espaço volta o foco para a peça.
 */
export class Camera {
  constructor({ ratio = 0.38, speed = 5.5 } = {}) {
    this.x = 0;
    this.anchorX = 0;
    this.look = 0;
    this.viewport = 0;
    this.width = 0;
    this.ratio = ratio;
    this.speed = speed;
  }

  setBounds(viewport, worldW) {
    this.viewport = Math.max(1, viewport);
    this.width = Math.max(1, worldW);
    this.x = clamp(this.x, 0, this.maxX);
    this._clampLook();
  }

  get maxX() {
    return Math.max(0, this.width - this.viewport);
  }

  setAnchor(x) {
    this.anchorX = x;
    // O "olhar" é sempre limitado ao que a câmera consegue alcançar,
    // senão acumula sem fim e cria uma zona morta na roda do mouse.
    this._clampLook();
  }

  /** Posição da câmera "neutra": a peça fica a `ratio` da tela. */
  get baseX() {
    return this.anchorX - this.viewport * this.ratio;
  }

  /** Mantém o look dentro do alcance real do mundo. */
  _clampLook() {
    const base = this.baseX;
    this.look = clamp(base + this.look, 0, this.maxX) - base;
  }

  /**
   * Move a câmera em `delta` px.
   * Limita a POSIÇÃO resultante (não o acumulado), então não há zona morta:
   * ao voltar o movimento responde na hora.
   */
  panBy(delta) {
    const base = this.baseX;
    this.look = clamp(base + this.look + delta, 0, this.maxX) - base;
    return this.look;
  }

  /** Compatibilidade: mesmo que panBy (movimento relativo). */
  lookBy(dx) {
    return this.panBy(dx);
  }

  recenter() {
    this.look = 0;
  }

  /** Quanto ainda dá para olhar para a direita (para a interface limitar). */
  get lookRange() {
    const base = this.baseX;
    return { min: -clamp(base, 0, this.maxX), max: this.maxX - clamp(base, 0, this.maxX) };
  }

  targetX() {
    return clamp(this.baseX + this.look, 0, this.maxX);
  }

  /** Avança a suavização (lerp) e devolve a posição atual da câmera. */
  update(dt) {
    const alvo = this.targetX();
    const k = 1 - Math.exp(-this.speed * Math.max(0, dt));
    this.x += (alvo - this.x) * k;
    if (Math.abs(alvo - this.x) < 0.2) this.x = alvo;
    return this.x;
  }

  jump() {
    this.x = this.targetX();
    return this.x;
  }

  /** Fatores de parallax das camadas (do fundo para a frente). */
  static layers() {
    return { sky: 0.06, far: 0.28, path: 1, fore: 0.82 };
  }
}
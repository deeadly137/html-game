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
  }

  get maxX() {
    return Math.max(0, this.width - this.viewport);
  }

  setAnchor(x) {
    this.anchorX = x;
  }

  lookBy(dx) {
    this.look += dx;
  }

  recenter() {
    this.look = 0;
  }

  targetX() {
    return clamp(this.anchorX - this.viewport * this.ratio + this.look, 0, this.maxX);
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
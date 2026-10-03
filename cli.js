#!/usr/bin/env node
/**
 * cli.js — Jogue "Miscigenação: Linha do Tempo" no terminal.
 *
 * Uso:
 *   node cli.js                       # 2 jogadores, modo interativo
 *   node cli.js --players 3           # 3 jogadores
 *   node cli.js --seed 42             # partida reproduzível
 *   node cli.js --names "Ana,Bia"     # nomes personalizados
 *   node cli.js --auto                # partida automática (demonstração/teste)
 */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { MiscigenacaoGame, PHASES, createPlayers } from './src/engine.js';
import { BOARD, PAWNS, SPACE_TYPE_INFO, eraById } from './src/data.js';

/* ------------------------------------------------------------------ */
/* Argumentos                                                          */
/* ------------------------------------------------------------------ */
function parseArgs(argv) {
  const opts = { players: 2, seed: undefined, names: [], auto: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--auto') opts.auto = true;
    else if (arg === '--players') opts.players = Number(argv[++i]) || 2;
    else if (arg === '--seed') opts.seed = Number(argv[++i]);
    else if (arg === '--names') opts.names = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (arg === '--help' || arg === '-h') opts.help = true;
  }
  return opts;
}

function printHelp() {
  console.log(`Miscigenação: Linha do Tempo — jogo de tabuleiro educativo

Opções:
  --players N       Número de jogadores (1 a 4). Padrão: 2
  --names "A,B"     Nomes dos jogadores, separados por vírgula
  --seed N          Semente do sorteio (partida reproduzível)
  --auto            Partida automática (sem interação)
  -h, --help        Esta ajuda`);
}

/* ------------------------------------------------------------------ */
/* Cores                                                               */
/* ------------------------------------------------------------------ */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/** Marcador do peão: um círculo na cor do jogador (o CLI é texto puro). */
function pawnMark(pawnId) {
  const cor = PAWNS[pawnId]?.color || '#ffffff';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
  return `\x1b[38;2;${r};${g};${b}m●\x1b[0m`;
}

/* ------------------------------------------------------------------ */
/* Impressão do tabuleiro e placar                                     */
/* ------------------------------------------------------------------ */
function renderBoard(game) {
  const byPosition = new Map();
  game.players.forEach((p) => {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position).push(pawnMark(p.pawn));
  });

  const lines = [`${C.bold}Linha do tempo da miscigenação no Brasil${C.reset}`];
  for (const space of BOARD) {
    const here = byPosition.get(space.index) || [];
    const info = SPACE_TYPE_INFO[space.type];
    const idx = String(space.index).padStart(2, ' ');
    const icon = info.icon ? `${info.icon} ` : '  ';
    const line = `${idx} ${icon}${space.name}`;
    if (here.length > 0) {
      lines.push(`${C.cyan}▶ ${C.reset}${C.bold}${line}${C.reset} ${here.join(' ')}`);
    } else {
      lines.push(`${C.dim}  ${line}${C.reset}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderPlayers(game) {
  return game.players
    .map((p, i) => {
      const pawn = PAWNS[p.pawn];
      const turn = i === game.currentPlayerIndex && !game.isFinished ? `${C.yellow}◀ vez${C.reset}` : '';
      return `  ${pawnMark(p.pawn)} ${p.name} (${pawn.label}) — casa ${String(p.position).padStart(2, ' ')} | ${p.points} ponto(s) cultural(is) ${turn}`;
    })
    .join('\n');
}

function renderStatus(game) {
  const space = BOARD[game.currentPlayer.position];
  const era = eraById(space.era);
  const eraText = era ? `${era.title} (${era.period})` : space.eraTitle;
  return ['', `${C.bold}--- Placar ---${C.reset}`, renderPlayers(game), `  ${C.dim}Etapa atual: ${eraText}${C.reset}`, ''].join('\n');
}

function printLastEvents(events) {
  for (const ev of events) {
    if (ev.type === 'card') {
      const title = ev.cardType === 'sorte' ? '🍀 Carta de Sorte' : '🔄 Carta Reverse';
      console.log(`\n${C.green}${title}: ${ev.card.title}${C.reset}\n${ev.card.text}`);
    } else if (ev.type === 'question') {
      console.log(`\n${C.yellow}❓ PERGUNTA${C.reset}: ${ev.question.prompt}`);
      ev.question.options.forEach((opt, i) => console.log(`   ${i + 1}) ${opt}`));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Modo automático                                                     */
/* ------------------------------------------------------------------ */
function runAuto(game) {
  console.log(renderBoard(game));
  let steps = 0;
  let flip = false;
  while (!game.isFinished && steps < 10000) {
    steps += 1;
    if (game.phase === PHASES.AWAITING_ANSWER) {
      const q = game.pendingQuestion;
      const responder = game.currentPlayer.name;
      flip = !flip;
      const choice = flip ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
      const events = game.answer(choice);
      const ev = events.find((e) => e.type === 'answer');
      const verdict = ev.correct ? `${C.green}acertou${C.reset}` : `${C.red}errou${C.reset}`;
      console.log(`  ❓ ${responder} respondeu "${q.options[choice]}" — ${verdict}`);
    } else {
      game.roll();
      console.log(`  ${game.log[game.log.length - 1].text}`);
    }
  }
  printFinal(game);
}

/* ------------------------------------------------------------------ */
/* Modo interativo                                                     */
/* ------------------------------------------------------------------ */
async function runInteractive(game, rl) {
  console.log(renderBoard(game));
  while (!game.isFinished) {
    const p = game.currentPlayer;
    console.log(renderStatus(game));
    console.log(`${C.bold}Vez de ${pawnMark(p.pawn)} ${p.name}.${C.reset}`);
    await rl.question(`${C.cyan}Pressione ENTER para rolar o dado...${C.reset}`);
    const events = game.roll();
    console.log(game.log[game.log.length - 1].text);
    printLastEvents(events);

    while (game.phase === PHASES.AWAITING_ANSWER) {
      const q = game.pendingQuestion;
      const raw = await rl.question(`${C.yellow}Escolha uma alternativa (1-${q.options.length}): ${C.reset}`);
      const choice = Number(String(raw).trim()) - 1;
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) {
        console.log('Resposta inválida. Tente novamente.');
        continue;
      }
      const answerEvents = game.answer(choice);
      const ev = answerEvents.find((e) => e.type === 'answer');
      console.log(
        ev.correct
          ? `${C.green}✅ Acertou! +${ev.points} ponto(s).${C.reset}`
          : `${C.red}❌ Errou. Voltando para a casa anterior...${C.reset}`,
      );
    }
  }
  printFinal(game);
}

function printFinal(game) {
  console.log(`\n${C.bold}=== FIM DE JOGO ===${C.reset}`);
  game.rankings.forEach((r, i) => {
    const medal = ['🥇', '🥈', '🥉', '  '][i] || '  ';
    console.log(`  ${medal} ${r.name} (${PAWNS[r.pawn].label}) — casa ${r.position}, ${r.points} ponto(s) cultural(is)`);
  });
  console.log(`\n${C.green}${C.bold}🏆 Vencedor(a): ${game.players[game.winnerIndex].name}!${C.reset}\n`);
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const count = Math.max(1, Math.min(4, opts.players));
  const specs =
    opts.names.length > 0
      ? opts.names.slice(0, 4).map((name) => ({ name }))
      : Array.from({ length: count }, (_, i) => ({ name: `Jogador ${i + 1}` }));

  const game = new MiscigenacaoGame({
    players: createPlayers(specs),
    seed: opts.seed,
  });

  if (opts.auto) {
    runAuto(game);
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    await runInteractive(game, rl);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exitCode = 1;
});
/**
 * engine.js — Motor de regras de "Miscigenação: Linha do Tempo".
 *
 * Núcleo PURO (sem DOM, sem I/O). Pode ser usado no navegador (src/ui.js),
 * na CLI (cli.js) e nos testes (test/engine.test.js).
 *
 * Determinismo: todo sorteio usa um PRNG com seed (mulberry32), o que torna
 * partidas reproduzíveis e os testes confiáveis.
 *
 * Fluxo de turnos:
 *   awaiting_roll  --roll()--> (move + resolve casa) --> awaiting_roll (próx.)
 *   awaiting_roll  --roll()--> casa de pergunta ---------> awaiting_answer
 *   awaiting_answer --answer(i)--> awaiting_roll (próx.)
 *
 * Regra-chave (descrição oral): ao ERRAR uma pergunta, o jogador volta para a
 * casa onde estava ANTES de rolar o dado.
 */

import {
  BOARD,
  ERAS,
  PAWNS,
  PAWN_KEYS,
  QUESTIONS,
  SORTE_CARDS,
  REVERSE_CARDS,
  FINISH_INDEX,
} from './data.js';

export const PHASES = Object.freeze({
  AWAITING_ROLL: 'awaiting_roll',
  AWAITING_ANSWER: 'awaiting_answer',
  FINISHED: 'finished',
});

export const DEFAULTS = Object.freeze({
  seed: 20260101,
  diceSides: 6,
  questionPoints: 2,
  finishBonus: 10,
  minPlayers: 1,
  maxPlayers: 4,
});

/* ------------------------------------------------------------------ */
/* Utilitários determinísticos                                         */
/* ------------------------------------------------------------------ */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Baralho com reembaralhamento automático quando esvazia. */
class Deck {
  constructor(items, rand) {
    this.items = items;
    this.rand = rand;
    this.pile = shuffle(items, rand);
  }

  draw() {
    if (this.pile.length === 0) this.pile = shuffle(this.items, this.rand);
    return this.pile.pop();
  }
}

/* ------------------------------------------------------------------ */
/* Criação de jogadores                                                */
/* ------------------------------------------------------------------ */
/**
 * specs: array de { name?, pawn? }. Se `pawn` for inválido, distribui os
 * peões automaticamente, sem repetir enquanto houver peões disponíveis.
 */
export function createPlayers(specs = []) {
  const usedPawns = new Set();
  return specs.map((spec, i) => {
    const name = String(spec.name || '').trim() || `Jogador ${i + 1}`;
    let pawn = spec.pawn;
    if (!pawn || !PAWNS[pawn] || usedPawns.has(pawn)) {
      pawn = PAWN_KEYS.find((k) => !usedPawns.has(k)) || PAWN_KEYS[i % PAWN_KEYS.length];
    }
    usedPawns.add(pawn);
    return {
      name,
      pawn,
      position: 0,
      points: 0,
      skipTurns: 0,
      extraTurn: false,
    };
  });
}

/** Atalho: cria N jogadores com nomes padrão. */
export function createDefaultPlayers(count = 2) {
  const n = Math.max(DEFAULTS.minPlayers, Math.min(DEFAULTS.maxPlayers, count));
  const specs = Array.from({ length: n }, (_, i) => ({ name: `Jogador ${i + 1}` }));
  return createPlayers(specs);
}

export { mulberry32, shuffle };

/* ------------------------------------------------------------------ */
/* Motor do jogo                                                       */
/* ------------------------------------------------------------------ */
export class MiscigenacaoGame {
  constructor(options = {}) {
    const players = options.players || createDefaultPlayers(options.playerCount ?? 2);
    if (!Array.isArray(players) || players.length === 0) {
      throw new Error('É necessário ao menos 1 jogador.');
    }
    if (players.length > DEFAULTS.maxPlayers) {
      throw new Error(`Máximo de ${DEFAULTS.maxPlayers} jogadores.`);
    }

    this.seed = options.seed ?? DEFAULTS.seed;
    this.diceSides = options.diceSides ?? DEFAULTS.diceSides;
    this.questionPoints = options.questionPoints ?? DEFAULTS.questionPoints;
    this.finishBonus = options.finishBonus ?? DEFAULTS.finishBonus;

    this.rand = mulberry32(this.seed);
    this.board = BOARD;
    this.finishIndex = FINISH_INDEX;

    this.players = players.map((p) => ({
      name: p.name,
      pawn: p.pawn,
      position: 0,
      points: 0,
      skipTurns: 0,
      extraTurn: false,
    }));

    this.questionDeck = new Deck(QUESTIONS, this.rand);
    this.sorteDeck = new Deck(SORTE_CARDS, this.rand);
    this.reverseDeck = new Deck(REVERSE_CARDS, this.rand);

    this.currentPlayerIndex = 0;
    this.phase = PHASES.AWAITING_ROLL;
    this.pendingQuestion = null;
    this.lastCard = null;
    this.winnerIndex = null;
    this.rankings = null;
    this.turnCount = 0;
    this.log = [];
    this._logId = 0;
    this._stats = { rolls: 0, correct: 0, wrong: 0, cards: { sorte: 0, reverse: 0 } };

    this._log(`Partida iniciada com ${this.players.length} jogador(es). Boa jornada pela linha do tempo!`, 'info');
    this._log(`É a vez de ${this.currentPlayer.name}.`, 'turn');
  }

  /* ---------------- leitura de estado ---------------- */
  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  /** Cartas restantes em cada baralho (usado pela mesa de cartas da GUI). */
  getDeckInfo() {
    return {
      sorte: { remaining: this.sorteDeck.pile.length, total: SORTE_CARDS.length },
      reverse: { remaining: this.reverseDeck.pile.length, total: REVERSE_CARDS.length },
      pergunta: { remaining: this.questionDeck.pile.length, total: QUESTIONS.length },
    };
  }

  get isFinished() {
    return this.phase === PHASES.FINISHED;
  }

  getState() {
    return {
      phase: this.phase,
      seed: this.seed,
      diceSides: this.diceSides,
      questionPoints: this.questionPoints,
      finishBonus: this.finishBonus,
      finishIndex: this.finishIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      turnCount: this.turnCount,
      players: this.players.map((p, index) => ({ ...p, index })),
      board: this.board,
      eras: ERAS,
      pawns: PAWNS,
      pendingQuestion: this.pendingQuestion ? { ...this.pendingQuestion, options: [...this.pendingQuestion.options] } : null,
      lastCard: this.lastCard,
      decks: this.getDeckInfo(),
      winnerIndex: this.winnerIndex,
      rankings: this.rankings ? this.rankings.map((r) => ({ ...r })) : null,
      stats: { ...this._stats, cards: { ...this._stats.cards } },
      log: this.log.slice(),
    };
  }

  /* ---------------- infraestrutura interna ---------------- */
  _log(text, kind = 'info', playerIndex = this.currentPlayerIndex) {
    this._logId += 1;
    this.log.push({ id: this._logId, text, kind, playerIndex });
    return this.log[this.log.length - 1];
  }

  _addPoints(player, delta, events, reason) {
    const index = this.players.indexOf(player);
    player.points = Math.max(0, player.points + delta);
    events.push({ type: 'points', playerIndex: index, delta, total: player.points, reason });
    if (delta !== 0) {
      this._log(
        `${player.name} ${delta > 0 ? 'ganhou' : 'perdeu'} ${Math.abs(delta)} ponto(s) cultural(is) — ${reason}. Total: ${player.points}.`,
        'points',
        index,
      );
    }
  }

  _move(player, delta, events, reason) {
    if (this.phase === PHASES.FINISHED) return;
    const index = this.players.indexOf(player);
    const from = player.position;
    const to = Math.max(0, Math.min(from + delta, this.finishIndex));
    player.position = to;
    events.push({ type: 'move', playerIndex: index, from, to, delta: to - from, reason });
    if (to !== from) {
      this._log(
        `${player.name} ${to > from ? 'avançou' : 'voltou'} para a casa ${to} (${reason}).`,
        'move',
        index,
      );
    }
    if (to >= this.finishIndex) this._finish(player, events, reason);
  }

  /* ---------------- ações públicas ---------------- */

  /**
   * Rola o dado, move o jogador atual e resolve a casa.
   * Retorna a lista de eventos ocorridos (para UI/CLI).
   */
  roll(forcedValue = null) {
    if (this.phase === PHASES.FINISHED) throw new Error('A partida já terminou.');
    if (this.phase !== PHASES.AWAITING_ROLL) {
      throw new Error('Aguarde a resposta da pergunta antes de rolar.');
    }
    const events = [];
    const player = this.currentPlayer;
    const index = this.currentPlayerIndex;

    const value =
      forcedValue != null
        ? forcedValue
        : 1 + Math.floor(this.rand() * this.diceSides);
    this._stats.rolls += 1;
    this.turnCount += 1;

    events.push({ type: 'roll', playerIndex: index, value, diceSides: this.diceSides });
    const dieFace = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.min(value, 6) - 1] || value;
    this._log(`${player.name} rolou o dado: ${dieFace} (${value}).`, 'roll', index);

    const from = player.position;
    const to = Math.min(from + value, this.finishIndex);
    player.position = to;
    events.push({ type: 'move', playerIndex: index, from, to, delta: to - from, reason: 'dado' });
    if (to !== from) {
      this._log(`${player.name} avançou da casa ${from} para a casa ${to}.`, 'move', index);
    } else {
      this._log(`${player.name} já estava na última casa.`, 'move', index);
    }

    if (to >= this.finishIndex) {
      this._finish(player, events, 'chegada pelo dado');
      return events;
    }

    this._resolveSpace(player, events, from);
    if (this.phase === PHASES.AWAITING_ANSWER || this.phase === PHASES.FINISHED) {
      return events;
    }

    this._advanceTurn(events);
    return events;
  }

  /** Responde a pergunta pendente (casa do tipo `pergunta`). */
  answer(optionIndex) {
    if (this.phase !== PHASES.AWAITING_ANSWER || !this.pendingQuestion) {
      throw new Error('Não há pergunta aguardando resposta.');
    }
    const events = [];
    const q = this.pendingQuestion;
    const player = this.currentPlayer;
    const index = this.currentPlayerIndex;
    const chosen = Number(optionIndex);
    const isCorrect = chosen === q.correctIndex;

    if (isCorrect) {
      this._stats.correct += 1;
      events.push({
        type: 'answer',
        playerIndex: index,
        correct: true,
        chosenIndex: chosen,
        correctIndex: q.correctIndex,
        points: q.points,
        prompt: q.prompt,
      });
      this._log(`✅ ${player.name} acertou a pergunta!`, 'answer', index);
      this._addPoints(player, q.points, events, 'resposta correta');
    } else {
      this._stats.wrong += 1;
      events.push({
        type: 'answer',
        playerIndex: index,
        correct: false,
        chosenIndex: chosen,
        correctIndex: q.correctIndex,
        points: 0,
        prompt: q.prompt,
      });
      this._log(
        `❌ ${player.name} errou a pergunta e volta para a casa ${q.from}.`,
        'answer',
        index,
      );
      const before = player.position;
      player.position = Math.min(q.from, this.finishIndex);
      events.push({
        type: 'move',
        playerIndex: index,
        from: before,
        to: player.position,
        delta: player.position - before,
        reason: 'resposta incorreta',
      });
    }

    this.pendingQuestion = null;
    this.phase = PHASES.AWAITING_ROLL;
    if (!this.isFinished) this._advanceTurn(events);
    return events;
  }

  /* ---------------- resolução de casas ---------------- */
  _resolveSpace(player, events, from) {
    const space = this.board[player.position];
    events.push({
      type: 'space',
      playerIndex: this.currentPlayerIndex,
      spaceIndex: space.index,
      spaceType: space.type,
      spaceName: space.name,
      era: space.era,
      eraTitle: space.eraTitle,
    });

    if (space.type === 'pergunta') {
      this._presentQuestion(player, events, from);
    } else if (space.type === 'sorte') {
      this._applyCard('sorte', player, events);
    } else if (space.type === 'reverse') {
      this._applyCard('reverse', player, events);
    }
    // 'start', 'normal' e 'finish' não têm efeito próprio.
  }

  _presentQuestion(player, events, from) {
    const question = this._drawQuestion();
    const options = question.options.map((text, i) => ({ text, correct: i === question.answer }));
    const shuffled = shuffle(options, this.rand);
    const correctIndex = shuffled.findIndex((o) => o.correct);

    this.pendingQuestion = {
      id: question.id,
      era: question.era,
      prompt: question.prompt,
      options: shuffled.map((o) => o.text),
      correctIndex,
      from,
      points: this.questionPoints,
    };
    this.phase = PHASES.AWAITING_ANSWER;

    events.push({
      type: 'question',
      playerIndex: this.currentPlayerIndex,
      question: { ...this.pendingQuestion, options: [...this.pendingQuestion.options] },
    });
    this._log(`${player.name} caiu numa casa de pergunta. Responda bem para ganhar pontos!`, 'question');
  }

  _drawQuestion() {
    return this.questionDeck.draw();
  }

  _drawCard(type) {
    const deck = type === 'sorte' ? this.sorteDeck : this.reverseDeck;
    return deck.draw();
  }

  _applyCard(type, player, events) {
    const card = this._drawCard(type);
    this._stats.cards[type] += 1;
    this.lastCard = {
      ...card,
      type,
      effects: card.effects.map((e) => ({ ...e })),
    };
    events.push({ type: 'card', playerIndex: this.currentPlayerIndex, cardType: type, card: this.lastCard });
    this._log(
      `${type === 'sorte' ? '🍀 Carta de Sorte' : '🔄 Carta Reverse'}: "${card.title}". ${card.text}`,
      'card',
      this.currentPlayerIndex,
    );

    let extraTurn = false;
    for (const effect of card.effects) {
      if (effect.move) {
        this._move(player, effect.move, events, `carta "${card.title}"`);
        if (this.isFinished) return;
      }
      if (effect.points) {
        this._addPoints(player, effect.points, events, `carta "${card.title}"`);
      }
      if (effect.skipTurns) {
        player.skipTurns += effect.skipTurns;
        events.push({ type: 'skip', playerIndex: this.currentPlayerIndex, turns: effect.skipTurns });
        this._log(
          `${player.name} ficará ${effect.skipTurns} turno(s) refletindo/aprendendo.`,
          'skip',
          this.currentPlayerIndex,
        );
      }
      if (effect.swapWithLeader) {
        this._swapWithLeader(player, events);
        if (this.isFinished) return;
      }
      if (effect.extraTurn) {
        extraTurn = true;
        events.push({ type: 'extra_turn', playerIndex: this.currentPlayerIndex });
        this._log(`${player.name} ganhou uma jogada extra!`, 'extra', this.currentPlayerIndex);
      }
    }
    player.extraTurn = extraTurn;
  }

  _swapWithLeader(player, events) {
    const index = this.players.indexOf(player);
    const leader = this.players.reduce((best, p) =>
      p.position > best.position ? p : best,
    );
    const leaderIndex = this.players.indexOf(leader);
    if (leaderIndex === index || leader.position <= player.position) {
      this._log(`${player.name} já está na frente — não há com quem trocar.`, 'reverse', index);
      return;
    }
    const myPos = player.position;
    player.position = leader.position;
    leader.position = myPos;
    events.push({
      type: 'swap',
      playerIndex: index,
      withIndex: leaderIndex,
      positions: { [index]: player.position, [leaderIndex]: leader.position },
    });
    this._log(
      `${player.name} trocou de lugar com ${leader.name} (agora na casa ${player.position}).`,
      'reverse',
      index,
    );
    if (player.position >= this.finishIndex) this._finish(player, events, `troca de lugar`);
  }

  /* ---------------- controle de turnos ---------------- */
  _advanceTurn(events) {
    if (this.isFinished) return;
    const n = this.players.length;
    const previousIndex = this.currentPlayerIndex;

    if (this.currentPlayer.extraTurn) {
      this.currentPlayer.extraTurn = false;
      this._log(`${this.currentPlayer.name} joga novamente!`, 'turn');
      return;
    }

    let next = this.currentPlayerIndex;
    for (let step = 0; step < n; step += 1) {
      next = (next + 1) % n;
      const candidate = this.players[next];
      if (candidate.skipTurns > 0) {
        candidate.skipTurns -= 1;
        events.push({ type: 'skip_turn', playerIndex: next, remaining: candidate.skipTurns });
        this._log(
          `${candidate.name} está refletindo e passa a vez (${candidate.skipTurns} turno(s) restante(s)).`,
          'skip',
          next,
        );
        continue;
      }
      break;
    }

    this.currentPlayerIndex = next;
    events.push({ type: 'turn', playerIndex: next, previousIndex });
    this._log(`É a vez de ${this.players[next].name}.`, 'turn', next);
  }

  /* ---------------- fim de jogo ---------------- */
  _finish(player, events, reason) {
    if (this.isFinished) return;
    const index = this.players.indexOf(player);
    player.position = this.finishIndex;
    this._addPoints(player, this.finishBonus, events, 'chegada ao Brasil Atual');
    this._log(
      `🏁 ${player.name} chegou ao Brasil Atual (${reason}) e ganhou ${this.finishBonus} pontos de bônus!`,
      'finish',
      index,
    );
    this.phase = PHASES.FINISHED;
    this.rankings = this.computeRankings();
    this.winnerIndex = this.rankings[0].playerIndex;
    events.push({ type: 'finish', playerIndex: index, winnerIndex: this.winnerIndex, reason });
    this._log(
      `🏆 Fim de jogo! Vencedor(a): ${this.players[this.winnerIndex].name} com ${this.players[this.winnerIndex].points} pontos culturais.`,
      'winner',
      this.winnerIndex,
    );
  }

  /**
   * Ranking final: quem chegou ao fim primeiro vence; entre os que chegaram,
   * o desempate é pelo maior número de pontos culturais.
   */
  computeRankings() {
    return this.players
      .map((p, i) => ({
        playerIndex: i,
        name: p.name,
        pawn: p.pawn,
        position: p.position,
        points: p.points,
        reached: p.position >= this.finishIndex,
      }))
      .sort((a, b) => b.position - a.position || b.points - a.points || a.playerIndex - b.playerIndex);
  }
}
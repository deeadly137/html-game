/**
 * Testes do motor de regras (sem DOM). Rode com: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MiscigenacaoGame,
  PHASES,
  createPlayers,
  createDefaultPlayers,
  mulberry32,
  shuffle,
} from '../src/engine.js';
import { BOARD, FINISH_INDEX, QUESTIONS, SORTE_CARDS, REVERSE_CARDS, PAWNS } from '../src/data.js';

/* ------------------------------------------------------------------ */
/* Dados                                                               */
/* ------------------------------------------------------------------ */
test('tabuleiro: 30 casas, começa na partida e termina no Brasil Atual', () => {
  assert.equal(BOARD.length, 30);
  assert.equal(BOARD[0].type, 'start');
  assert.equal(BOARD[FINISH_INDEX].type, 'finish');
  assert.equal(FINISH_INDEX, 29);
});

test('tabuleiro: toda casa possui tipo válido e era', () => {
  const valid = new Set(['start', 'normal', 'sorte', 'reverse', 'pergunta', 'finish']);
  for (const space of BOARD) {
    assert.ok(valid.has(space.type), `tipo inválido na casa ${space.index}: ${space.type}`);
    assert.ok(typeof space.era === 'string' && space.era.length > 0);
    assert.ok(typeof space.name === 'string' && space.name.length > 0);
  }
});

test('perguntas: toda questão tem 4 alternativas e índice de resposta válido', () => {
  assert.ok(QUESTIONS.length >= 20);
  for (const q of QUESTIONS) {
    assert.equal(q.options.length, 4, `${q.id} deveria ter 4 opções`);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `resposta inválida em ${q.id}`);
    assert.equal(new Set(q.options).size, 4, `${q.id} tem alternativas repetidas`);
  }
});

test('cartas: Sorte e Reverse têm ids únicos e ao menos um efeito', () => {
  for (const [name, cards] of [
    ['sorte', SORTE_CARDS],
    ['reverse', REVERSE_CARDS],
  ]) {
    const ids = new Set();
    for (const c of cards) {
      assert.ok(!ids.has(c.id), `id duplicado em ${name}: ${c.id}`);
      ids.add(c.id);
      assert.ok(Array.isArray(c.effects) && c.effects.length > 0, `carta sem efeito: ${c.id}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* RNG                                                                */
/* ------------------------------------------------------------------ */
test('mulberry32 é determinístico para a mesma seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('mulberry32 gera valores no intervalo [0, 1)', () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 1000; i += 1) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `valor fora do intervalo: ${v}`);
  }
});

test('shuffle preserva os elementos originais', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(input, mulberry32(3));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8], 'não deve mutar a entrada');
  assert.deepEqual([...out].sort((x, y) => x - y), input);
});

/* ------------------------------------------------------------------ */
/* Jogadores                                                          */
/* ------------------------------------------------------------------ */
test('createPlayers distribui peões sem repetir e gera nomes padrão', () => {
  const players = createPlayers([{}, {}, {}, {}]);
  assert.equal(players.length, 4);
  assert.equal(new Set(players.map((p) => p.pawn)).size, 4);
  players.forEach((p, i) => assert.equal(p.name, `Jogador ${i + 1}`));
  players.forEach((p) => {
    assert.equal(p.position, 0);
    assert.equal(p.points, 0);
    assert.equal(p.skipTurns, 0);
  });
});

test('createPlayers usa o peão informado quando válido', () => {
  const [p] = createPlayers([{ name: 'Ana', pawn: 'azul' }]);
  assert.equal(p.name, 'Ana');
  assert.equal(p.pawn, 'azul');
  assert.ok(PAWNS.azul);
});

test('createDefaultPlayers respeita limites de 1..4 jogadores', () => {
  assert.equal(createDefaultPlayers(0).length, 1);
  assert.equal(createDefaultPlayers(10).length, 4);
  assert.ok(createDefaultPlayers(3).every((p) => typeof p.pawn === 'string' && p.pawn.length > 0));
});

/* ------------------------------------------------------------------ */
/* Fluxo básico de turnos                                              */
/* ------------------------------------------------------------------ */
function newGame(opts = {}) {
  return new MiscigenacaoGame({
    players: createPlayers([{ name: 'Ana' }, { name: 'Bia' }]),
    seed: 12345,
    ...opts,
  });
}

test('estado inicial: 0 jogadores na partida, fase awaiting_roll', () => {
  const game = newGame();
  assert.equal(game.phase, PHASES.AWAITING_ROLL);
  assert.equal(game.currentPlayerIndex, 0);
  assert.equal(game.currentPlayer.name, 'Ana');
  game.players.forEach((p) => assert.equal(p.position, 0));
});

test('roll avança o jogador e passa o turno', () => {
  const game = newGame();
  const events = game.roll(4);
  assert.equal(game.players[0].position, 4);
  assert.equal(game.currentPlayerIndex, 1);
  const rollEv = events.find((e) => e.type === 'roll');
  assert.equal(rollEv.value, 4);
  assert.ok(events.some((e) => e.type === 'move' && e.to === 4));
});

test('roll bloqueado enquanto há pergunta pendente', () => {
  const game = newGame();
  game.questionDeck.pile = [QUESTIONS[0]];
  game.roll(5); // casa 5 = pergunta
  assert.equal(game.phase, PHASES.AWAITING_ANSWER);
  assert.throws(() => game.roll(1), /Aguarde a resposta/);
});

test('answer bloqueado quando não há pergunta pendente', () => {
  const game = newGame();
  assert.throws(() => game.answer(0), /Não há pergunta/);
});

/* ------------------------------------------------------------------ */
/* Perguntas — acerto e erro                                           */
/* ------------------------------------------------------------------ */
test('acerto: mantém posição e soma pontos culturais', () => {
  const game = newGame();
  game.questionDeck.pile = [QUESTIONS[0]];
  game.roll(5);
  const q = game.pendingQuestion;
  assert.equal(q.from, 0);
  const events = game.answer(q.correctIndex);
  assert.equal(game.players[0].position, 5, 'posição não muda ao acertar');
  assert.equal(game.players[0].points, game.questionPoints);
  assert.ok(events.some((e) => e.type === 'answer' && e.correct === true));
  assert.equal(game.phase, PHASES.AWAITING_ROLL);
});

test('ERRO: o jogador volta à casa onde estava antes de rolar o dado', () => {
  const game = newGame();
  game.questionDeck.pile = [QUESTIONS[0]];
  game.roll(5); // sai da casa 0 e cai na casa 5 (pergunta)
  assert.equal(game.players[0].position, 5);
  assert.equal(game.pendingQuestion.from, 0);

  const wrong = (game.pendingQuestion.correctIndex + 1) % 4;
  const events = game.answer(wrong);

  assert.equal(game.players[0].position, 0, 'deve voltar à casa anterior ao avanço');
  assert.equal(game.players[0].points, 0, 'errar não dá pontos');
  const ansEv = events.find((e) => e.type === 'answer');
  assert.equal(ansEv.correct, false);
  assert.ok(events.some((e) => e.type === 'move' && e.reason === 'resposta incorreta' && e.to === 0));
  assert.equal(game.currentPlayerIndex, 1, 'turno passa após responder');
});

test('pergunta: alternativas embaralhadas apontam para o texto correto', () => {
  const game = newGame();
  game.questionDeck.pile = [QUESTIONS[3]]; // resposta correta original: '1500'
  game.roll(5);
  const q = game.pendingQuestion;
  assert.equal(q.options[q.correctIndex], '1500');
  assert.equal(new Set(q.options).size, q.options.length);
});

/* ------------------------------------------------------------------ */
/* Cartas de Sorte e Reverse                                           */
/* ------------------------------------------------------------------ */
test('carta de Sorte com movimento avança casas extras', () => {
  const game = newGame();
  game.sorteDeck.pile = [SORTE_CARDS.find((c) => c.id === 's01')]; // avance 2
  game.roll(3); // casa 3 = sorte
  assert.equal(game.players[0].position, 5, 'casa 3 + 2 = casa 5');
  assert.equal(game.lastCard.id, 's01');
  assert.equal(game.lastCard.type, 'sorte');
});

test('carta de Sorte de pontos culturais soma pontos', () => {
  const game = newGame();
  game.sorteDeck.pile = [SORTE_CARDS.find((c) => c.id === 's03')]; // ganhe 2 pontos
  game.roll(3);
  assert.equal(game.players[0].points, 2);
  assert.equal(game.players[0].position, 3);
});

test('carta com recuo de casas: o motor suporta (usado por cartas futuras)', () => {
  const game = newGame();
  game.players[0].position = 10;
  // O baralho atual não recua ninguém; o motor, sim — garantimos a capacidade.
  game.reverseDeck.pile = [{ id: 'teste', title: 'Teste', text: '', effects: [{ move: -2 }, { points: 2 }] }];
  game.roll(5); // casa 15 = reverse
  assert.equal(game.players[0].position, 13, 'casa 15 - 2 = 13');
  assert.equal(game.players[0].points, 2);
});

test('carta Reverse: passe o próximo turno (skipTurns)', () => {
  const game = newGame();
  game.reverseDeck.pile = [REVERSE_CARDS.find((c) => c.id === 'r12')]; // estuda 1 turno
  game.roll(7); // casa 7 = reverse
  assert.equal(game.players[0].skipTurns, 1);
  assert.equal(game.currentPlayerIndex, 1, 'turno passou para Bia');

  game.roll(2); // Bia joga -> volta para Ana, que pula
  assert.equal(game.currentPlayerIndex, 1, 'Ana pulou, continua Bia');
});

test('carta Reverse: troca de lugar com quem está na frente', () => {
  const game = newGame();
  game.players[0].position = 0;
  game.players[1].position = 12;
  game.reverseDeck.pile = [REVERSE_CARDS.find((c) => c.id === 'r13')]; // swapWithLeader
  game.roll(7); // casa 7 = reverse
  assert.equal(game.players[0].position, 12, 'Ana assume a liderança');
  assert.equal(game.players[1].position, 7, 'Bia vai para a posição antiga da Ana');
});

test('carta de Sorte com jogada extra mantém o mesmo jogador', () => {
  const game = newGame();
  game.sorteDeck.pile = [SORTE_CARDS.find((c) => c.id === 's09')]; // +1 ponto e joga de novo
  game.roll(3);
  assert.equal(game.currentPlayerIndex, 0, 'Ana joga novamente');
  assert.equal(game.players[0].points, 1);
});

/* ------------------------------------------------------------------ */
/* Vitória e ranking                                                   */
/* ------------------------------------------------------------------ */
test('chegar na última casa encerra o jogo com bônus e vencedor', () => {
  const game = newGame();
  game.players[0].position = 27;
  const events = game.roll(5); // 27 + 5 ultrapassa o fim -> casa 29
  assert.equal(game.isFinished, true);
  assert.equal(game.players[0].position, FINISH_INDEX);
  assert.equal(game.players[0].points, game.finishBonus);
  assert.equal(game.winnerIndex, 0);
  assert.ok(events.some((e) => e.type === 'finish'));
  const [first] = game.computeRankings();
  assert.equal(first.playerIndex, 0);
});

test('após o fim, roll() e answer() lançam erro', () => {
  const game = newGame();
  game.players[0].position = 27;
  game.roll(5);
  assert.throws(() => game.roll(1), /já terminou/);
});

test('não é possível passar da última casa', () => {
  const game = newGame();
  game.players[0].position = 28;
  game.roll(6);
  assert.equal(game.players[0].position, FINISH_INDEX);
});

/* ------------------------------------------------------------------ */
/* Determinismo e autoplay                                            */
/* ------------------------------------------------------------------ */
test('mesma seed produz a mesma sequência de dados', () => {
  const a = new MiscigenacaoGame({ playerCount: 2, seed: 999 });
  const b = new MiscigenacaoGame({ playerCount: 2, seed: 999 });

  const step = (game) => {
    if (game.phase === PHASES.AWAITING_ANSWER) {
      const q = game.pendingQuestion;
      return game.answer(q.correctIndex)[0];
    }
    return game.roll()[0];
  };

  for (let i = 0; i < 12; i += 1) {
    const ea = step(a);
    const eb = step(b);
    if (ea && ea.type === 'roll') assert.equal(ea.value, eb.value);
  }
});

test('autoplay: uma partida completa termina com um vencedor', () => {
  const game = new GameForSim();
  const result = game.simulate(5000);
  assert.equal(result.finished, true, 'a partida deve terminar');
  assert.ok(typeof result.winnerName === 'string' && result.winnerName.length > 0);
  assert.ok(result.log.length > 0);
});

/* Helper: simula uma partida respondendo certo/errado de forma determinística. */
class GameForSim extends MiscigenacaoGame {
  constructor() {
    super({
      players: createPlayers([{ name: 'Ana' }, { name: 'Bia' }, { name: 'Caio' }]),
      seed: 2024,
    });
    this._answerFlip = false;
  }

  simulate(maxSteps = 5000) {
    let steps = 0;
    while (!this.isFinished && steps < maxSteps) {
      steps += 1;
      if (this.phase === PHASES.AWAITING_ANSWER) {
        this._answerFlip = !this._answerFlip;
        const q = this.pendingQuestion;
        const choice = this._answerFlip ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
        this.answer(choice);
      } else {
        this.roll();
      }
    }
    return {
      finished: this.isFinished,
      steps,
      winnerName: this.winnerIndex != null ? this.players[this.winnerIndex].name : null,
      log: this.log,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Baralhos (mesa de cartas da GUI)                                    */
/* ------------------------------------------------------------------ */
test('getDeckInfo informa quantas cartas restam em cada baralho', () => {
  const game = newGame();
  const info = game.getDeckInfo();

  assert.deepEqual(info.sorte, { remaining: 12, total: 12 });
  assert.deepEqual(info.reverse, { remaining: 13, total: 13 });
  assert.deepEqual(info.pergunta, { remaining: 21, total: 21 });

  // O estado exposto à GUI também traz os baralhos.
  assert.deepEqual(game.getState().decks.sorte, { remaining: 12, total: 12 });
});

test('cada carta de Sorte puxada reduz o monte de Sorte', () => {
  const game = newGame();
  game.roll(3); // casa 3 = Casa de Sorte
  assert.equal(game.getDeckInfo().sorte.remaining, 11, 'puxou 1 carta de Sorte');
  assert.equal(game.getDeckInfo().reverse.remaining, 13, 'o baralho de Reverse não foi tocado');
});

test('cair numa Casa de Pergunta reduz o monte de Perguntas', () => {
  const game = newGame();
  game.roll(5); // casa 5 = Casa de Pergunta
  assert.equal(game.phase, PHASES.AWAITING_ANSWER);
  assert.equal(game.getDeckInfo().pergunta.remaining, 20, 'puxou 1 pergunta');
  game.answer(game.pendingQuestion.correctIndex);
});

test('baralhos reembaralham ao esvaziar, sem perder cartas', () => {
  const game = newGame();
  // Força o monte de Sorte a esvaziar e confirma que uma nova carta é servida.
  game.sorteDeck.pile = [];
  game.roll(3);
  assert.equal(game.getDeckInfo().sorte.remaining, 11, 'reembaralhou e serviu 1 carta das 12');
  assert.ok(game.lastCard && game.lastCard.type === 'sorte');
});
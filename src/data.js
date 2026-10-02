/**
 * data.js — Conteúdo do jogo "Miscigenação: Linha do Tempo".
 *
 * Aqui ficam os DADOS puros (sem regra nenhuma):
 *   - PAWNS        : peões (raízes culturais)
 *   - ERAS         : as 7 etapas da linha do tempo
 *   - BOARD        : as casas do tabuleiro
 *   - SORTE_CARDS  : cartas de Sorte (positivas)
 *   - REVERSE_CARDS: cartas Reverse (desafios + inversão de perspectiva)
 *   - QUESTIONS    : banco de perguntas (múltipla escolha)
 *
 * IMPORTANTE: o motor nunca confia na ordem das alternativas. Em runtime as
 * opções são embaralhadas (ver engine.js), então `answer` aqui é só o índice
 * original da alternativa correta.
 */

/* ------------------------------------------------------------------ */
/* Peões — cada jogador escolhe uma raiz cultural                      */
/* ------------------------------------------------------------------ */
export const PAWNS = Object.freeze({
  indigena: { id: 'indigena', label: 'Indígena', emoji: '🪶', color: '#2f6b3f' },
  africano: { id: 'africano', label: 'Africano', emoji: '🥁', color: '#8a4b1f' },
  europeu: { id: 'europeu', label: 'Europeu', emoji: '🏰', color: '#2b4a7d' },
  asiatico: { id: 'asiatico', label: 'Asiático', emoji: '🏮', color: '#b8302e' },
});

export const PAWN_KEYS = Object.keys(PAWNS);

/* ------------------------------------------------------------------ */
/* Eras — a linha do tempo                                             */
/* ------------------------------------------------------------------ */
export const ERAS = Object.freeze([
  {
    id: 'indigena',
    title: 'Período Indígena',
    period: 'antes da colonização',
    color: '#2f6b3f',
    emoji: '🪶',
    range: [1, 4],
  },
  {
    id: 'portugueses',
    title: 'Chegada dos Portugueses',
    period: '1500 – século XVI',
    color: '#2b4a7d',
    emoji: '⛵',
    range: [5, 8],
  },
  {
    id: 'africanos',
    title: 'Tráfico de Africanos Escravizados',
    period: 'século XVI – XIX',
    color: '#8a4b1f',
    emoji: '⛓️',
    range: [9, 12],
  },
  {
    id: 'mesticagem',
    title: 'Mestiçagem no Brasil Colônia',
    period: 'século XVII – XVIII',
    color: '#6b3f6e',
    emoji: '🎨',
    range: [13, 16],
  },
  {
    id: 'abolicao',
    title: 'Abolição da Escravidão',
    period: '1871 – 1888',
    color: '#9c2f2f',
    emoji: '🕊️',
    range: [17, 20],
  },
  {
    id: 'imigracao',
    title: 'Imigração Europeia e Asiática',
    period: 'século XIX – XX',
    color: '#a8760f',
    emoji: '🚢',
    range: [21, 24],
  },
  {
    id: 'moderno',
    title: 'Brasil Moderno e Diverso',
    period: 'século XX – XXI',
    color: '#1f6f63',
    emoji: '🌎',
    range: [25, 28],
  },
]);

const ERA_BY_ID = Object.fromEntries(ERAS.map((e) => [e.id, e]));

/* ------------------------------------------------------------------ */
/* Tabuleiro — cada casa pertence a uma era                            */
/* Tipos: start | normal | sorte | reverse | pergunta | finish          */
/* ------------------------------------------------------------------ */
const SPACE_TABLE = [
  /* 00 */ { name: 'Ponto de partida', type: 'start' },
  /* 01 */ { name: 'Florestas e Aldeias', type: 'pergunta' },
  /* 02 */ { name: 'Saberes da Terra', type: 'normal' },
  /* 03 */ { name: 'Culturas Originárias', type: 'sorte' },
  /* 04 */ { name: 'Diversidade de Povos', type: 'normal' },
  /* 05 */ { name: 'Chegada de Cabral (1500)', type: 'pergunta' },
  /* 06 */ { name: 'Encontro de Mundos', type: 'normal' },
  /* 07 */ { name: 'Colonização e Missões', type: 'reverse' },
  /* 08 */ { name: 'Cruzamentos Iniciais', type: 'normal' },
  /* 09 */ { name: 'Travessia do Atlântico', type: 'pergunta' },
  /* 10 */ { name: 'Trabalho e Resistência', type: 'normal' },
  /* 11 */ { name: 'Culturas Afro-Brasileiras', type: 'sorte' },
  /* 12 */ { name: 'Quilombos', type: 'normal' },
  /* 13 */ { name: 'Cruzamentos e Culturas', type: 'pergunta' },
  /* 14 */ { name: 'Cozinha Mestiça', type: 'normal' },
  /* 15 */ { name: 'Sincretismo Religioso', type: 'reverse' },
  /* 16 */ { name: 'Sociedade Colonial', type: 'normal' },
  /* 17 */ { name: 'Lei do Ventre Livre (1871)', type: 'pergunta' },
  /* 18 */ { name: 'Lei dos Sexagenários (1885)', type: 'sorte' },
  /* 19 */ { name: 'Lei Áurea (1888)', type: 'reverse' },
  /* 20 */ { name: 'Pós-Abolição', type: 'normal' },
  /* 21 */ { name: 'Italianos e Alemães', type: 'pergunta' },
  /* 22 */ { name: 'Japoneses (1908)', type: 'reverse' },
  /* 23 */ { name: 'Outras Migrações', type: 'normal' },
  /* 24 */ { name: 'Bairros e Colônias', type: 'sorte' },
  /* 25 */ { name: 'Urbanização', type: 'pergunta' },
  /* 26 */ { name: 'Direitos e Igualdade', type: 'normal' },
  /* 27 */ { name: 'Combate ao Preconceito', type: 'reverse' },
  /* 28 */ { name: 'Consciência Negra', type: 'sorte' },
  /* 29 */ { name: 'Brasil Atual — Diverso e Miscigenado', type: 'finish' },
];

const LAST_INDEX = SPACE_TABLE.length - 1;

function eraIdForIndex(i) {
  if (i === 0) return 'start';
  if (i === LAST_INDEX) return 'finish';
  return ERAS[Math.floor((i - 1) / 4)].id;
}

export const BOARD = Object.freeze(
  SPACE_TABLE.map((space, index) => {
    const eraId = eraIdForIndex(index);
    const era = ERA_BY_ID[eraId];
    return Object.freeze({
      index,
      name: space.name,
      type: space.type,
      era: eraId,
      eraTitle: era ? era.title : index === 0 ? 'Partida' : 'Chegada',
      color: era ? era.color : index === 0 ? '#6b5a45' : '#b8860b',
    });
  }),
);

export const FINISH_INDEX = LAST_INDEX;

/** Rótulo legível de uma casa (usado na UI e na CLI). */
export function describeSpace(index) {
  const space = BOARD[Math.max(0, Math.min(index, LAST_INDEX))];
  return `Casa ${space.index} — ${space.name} (${space.eraTitle})`;
}

/* ------------------------------------------------------------------ */
/* Cartas                                                              */
/* Efeitos suportados (engine.js):                                     */
/*   { move: n }             avança/recua n casas (n pode ser negativo)*/
/*   { points: n }           ganha/perde n pontos culturais            */
/*   { skipTurns: n }        fica n turnos sem jogar ("refletindo")    */
/*   { swapWithLeader: true} troca de lugar com quem está na frente    */
/*   { extraTurn: true }     joga novamente antes de passar a vez      */
/* ------------------------------------------------------------------ */
export const SORTE_CARDS = Object.freeze([
  {
    id: 's01',
    title: 'Técnicas agrícolas',
    text: 'Você aprendeu com os indígenas técnicas agrícolas. Avance 2 casas.',
    effects: [{ move: 2 }],
  },
  {
    id: 's02',
    title: 'Ritmos e religiões',
    text: 'A cultura africana trouxe novos ritmos e religiões. Ganhe 1 ponto cultural.',
    effects: [{ points: 1 }],
  },
  {
    id: 's03',
    title: 'Feira cultural',
    text: 'Uma feira cultural celebra a diversidade do país. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 's04',
    title: 'Visita a um quilombo',
    text: 'Você visitou um quilombo e conheceu sua história de resistência. Avance 1 casa e ganhe 1 ponto cultural.',
    effects: [{ move: 1 }, { points: 1 }],
  },
  {
    id: 's05',
    title: 'Exposição de museu',
    text: 'Um museu abre uma exposição sobre a miscigenação. Ganhe 1 ponto cultural e avance 1 casa.',
    effects: [{ points: 1 }, { move: 1 }],
  },
  {
    id: 's06',
    title: 'Origem da feijoada',
    text: 'Você provou a feijoada e aprendeu sua origem mestiça. Avance 3 casas.',
    effects: [{ move: 3 }],
  },
  {
    id: 's07',
    title: 'Roda de capoeira',
    text: 'Um mestre de capoeira te ensinou história e respeito. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 's08',
    title: 'Aula de tupi',
    text: 'Você aprendeu palavras de origem tupi com uma anciã. Avance 2 casas.',
    effects: [{ move: 2 }],
  },
  {
    id: 's09',
    title: 'Jornada de estudos',
    text: 'Sua jornada de estudos sobre os povos originários rendeu frutos. Ganhe 1 ponto cultural e jogue novamente.',
    effects: [{ points: 1 }, { extraTurn: true }],
  },
  {
    id: 's10',
    title: 'Sincretismo em festa',
    text: 'O sincretismo religioso uniu celebrações de várias origens. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 's11',
    title: 'Cozinha afro-indígena',
    text: 'Você aprendeu receitas que misturam dendê e mandioca. Avance 1 casa e ganhe 1 ponto cultural.',
    effects: [{ move: 1 }, { points: 1 }],
  },
  {
    id: 's12',
    title: 'Amizade entre culturas',
    text: 'Uma nova amizade te mostrou o valor dos encontros entre culturas. Ganhe 1 ponto cultural e avance 1 casa.',
    effects: [{ points: 1 }, { move: 1 }],
  },
]);

export const REVERSE_CARDS = Object.freeze([
  {
    id: 'r01',
    title: 'Discriminação',
    text: 'Você sofreu discriminação. Reverse: devolva ao preconceituoso a necessidade de aprender. Passe o próximo turno refletindo.',
    effects: [{ skipTurns: 1 }],
  },
  {
    id: 'r02',
    title: 'Estereótipos',
    text: 'Estereótipos te atrapalham. Reverse: combata-os com conhecimento. Volte 1 casa, mas ganhe 1 ponto cultural.',
    effects: [{ move: -1 }, { points: 1 }],
  },
  {
    id: 'r03',
    title: 'Sua história questionada',
    text: 'Alguém duvidou da sua história. Reverse: mostre que a história é de todos. Volte 1 casa.',
    effects: [{ move: -1 }],
  },
  {
    id: 'r04',
    title: 'Piada preconceituosa',
    text: 'Você ouviu uma piada preconceituosa. Reverse: chame a conversa para a reflexão. Avance 1 casa como quem ensina pelo exemplo.',
    effects: [{ move: 1 }],
  },
  {
    id: 'r05',
    title: 'Troca de lugar',
    text: 'Um obstáculo tentou te barrar. Reverse: a diversidade é mais forte que a barreira. Troque de lugar com quem está na frente.',
    effects: [{ swapWithLeader: true }],
  },
  {
    id: 'r06',
    title: 'Falta de informação',
    text: 'A falta de informação gerou um conflito. Reverse: informe-se e inspire outros. Passe o próximo turno estudando.',
    effects: [{ skipTurns: 1 }],
  },
  {
    id: 'r07',
    title: 'Intolerância religiosa',
    text: 'Havia intolerância religiosa no bairro. Reverse: promova o diálogo. Volte 2 casas, mas ganhe 2 pontos culturais.',
    effects: [{ move: -2 }, { points: 2 }],
  },
  {
    id: 'r08',
    title: 'Racismo estrutural',
    text: 'O racismo estrutural dificultou seu caminho. Reverse: a luta por igualdade avança. Ganhe 1 ponto cultural.',
    effects: [{ points: 1 }],
  },
  {
    id: 'r09',
    title: 'Subestimaram você',
    text: 'Você foi subestimado por causa da sua origem. Reverse: prove seu valor. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 'r10',
    title: 'Apelido ofensivo',
    text: 'Um apelido ofensivo te incomodou. Reverse: eduque quem o disse. Avance 1 casa como quem transforma dor em aprendizado.',
    effects: [{ move: 1 }],
  },
  {
    id: 'r11',
    title: 'Portas fechadas',
    text: 'Portas se fecharam por causa do preconceito. Reverse: abra caminho pela educação. Volte 1 casa, mas ganhe 2 pontos culturais.',
    effects: [{ move: -1 }, { points: 2 }],
  },
  {
    id: 'r12',
    title: 'Silenciamento',
    text: 'Tentaram silenciar sua voz. Reverse: fale e escute. Ganhe 1 ponto cultural e avance 1 casa.',
    effects: [{ points: 1 }, { move: 1 }],
  },
]);

/* ------------------------------------------------------------------ */
/* Banco de perguntas                                                  */
/* answer = índice da alternativa CORRETA na ordem original            */
/* ------------------------------------------------------------------ */
export const QUESTIONS = Object.freeze([
  /* --- Período Indígena --- */
  {
    id: 'q01',
    era: 'indigena',
    prompt: 'Quais povos já viviam no Brasil antes da chegada dos europeus?',
    options: ['Povos indígenas', 'Povos vikings', 'Povos romanos', 'Povos astecas'],
    answer: 0,
  },
  {
    id: 'q02',
    era: 'indigena',
    prompt: "Palavras como 'mandioca', 'caju' e 'pipoca' vêm de qual língua?",
    options: ['Árabe', 'Tupi', 'Latim', 'Japonês'],
    answer: 1,
  },
  {
    id: 'q03',
    era: 'indigena',
    prompt: 'Qual destes é um alimento e uma técnica agrícola legados pelos povos indígenas?',
    options: ['Trigo e moinho de vento', 'Arroz e chá', 'Mandioca e o cultivo de roças', 'Uva e vinho'],
    answer: 2,
  },
  /* --- Chegada dos Portugueses --- */
  {
    id: 'q04',
    era: 'portugueses',
    prompt: 'Em que ano a expedição de Pedro Álvares Cabral chegou ao Brasil?',
    options: ['1492', '1600', '1822', '1500'],
    answer: 3,
  },
  {
    id: 'q05',
    era: 'portugueses',
    prompt: 'Qual foi a primeira capital do Brasil colonial?',
    options: ['Salvador', 'Rio de Janeiro', 'São Paulo', 'Recife'],
    answer: 0,
  },
  {
    id: 'q06',
    era: 'portugueses',
    prompt: 'A mistura entre portugueses e povos indígenas no período colonial é um exemplo de...',
    options: ['segregação', 'isolamento', 'miscigenação', 'monocultura'],
    answer: 2,
  },
  /* --- Tráfico de Africanos Escravizados --- */
  {
    id: 'q07',
    era: 'africanos',
    prompt: 'De onde vieram as pessoas africanas escravizadas trazidas ao Brasil?',
    options: ['De diversas regiões da África', 'Somente do Egito', 'Da Oceania', 'Da Ásia'],
    answer: 0,
  },
  {
    id: 'q08',
    era: 'africanos',
    prompt: 'Como se chamavam as comunidades formadas por pessoas que fugiam da escravidão?',
    options: ['Feitorias', 'Quilombos', 'Capitanias', 'Aldeias'],
    answer: 1,
  },
  {
    id: 'q09',
    era: 'africanos',
    prompt: 'Quem foi o líder mais conhecido do Quilombo dos Palmares?',
    options: ['Dom Pedro I', 'Tiradentes', 'Princesa Isabel', 'Zumbi'],
    answer: 3,
  },
  /* --- Mestiçagem no Brasil Colônia --- */
  {
    id: 'q10',
    era: 'mesticagem',
    prompt: 'O que significa miscigenação?',
    options: [
      'Separação entre povos',
      'Proibição de casamentos',
      'Isolamento de grupos',
      'Mistura de povos, etnias e culturas',
    ],
    answer: 3,
  },
  {
    id: 'q11',
    era: 'mesticagem',
    prompt: 'Por que a feijoada é considerada um prato tipicamente brasileiro?',
    options: [
      'Por misturar influências indígena, africana e portuguesa',
      'Porque veio pronta de Portugal',
      'Porque é originária da Ásia',
      'Porque foi inventada no século XXI',
    ],
    answer: 0,
  },
  {
    id: 'q12',
    era: 'mesticagem',
    prompt: 'O sincretismo religioso no Brasil resultou da mistura de...',
    options: [
      'religiões nórdicas e romanas',
      'apenas religiões europeias',
      'religiões africanas, indígenas e do catolicismo',
      'apenas religiões indígenas',
    ],
    answer: 2,
  },
  /* --- Abolição da Escravidão --- */
  {
    id: 'q13',
    era: 'abolicao',
    prompt: 'Em que ano foi assinada a Lei Áurea?',
    options: ['1822', '1871', '1888', '1908'],
    answer: 2,
  },
  {
    id: 'q14',
    era: 'abolicao',
    prompt: 'Quem assinou a Lei Áurea, em 1888?',
    options: ['Princesa Isabel', 'Dom Pedro II', 'Zumbi', 'Tiradentes'],
    answer: 0,
  },
  {
    id: 'q15',
    era: 'abolicao',
    prompt: 'A Lei do Ventre Livre (1871) determinava que...',
    options: [
      'o tráfico transatlântico seria ampliado',
      'filhos de mulheres escravizadas nasceriam livres',
      'a escravidão acabaria de imediato',
      'as pessoas escravizadas ganhariam terras',
    ],
    answer: 1,
  },
  /* --- Imigração Europeia e Asiática --- */
  {
    id: 'q16',
    era: 'imigracao',
    prompt: 'Em que ano chegou ao Brasil o primeiro grupo de imigrantes japoneses?',
    options: ['1888', '1500', '1908', '1922'],
    answer: 2,
  },
  {
    id: 'q17',
    era: 'imigracao',
    prompt: 'A imigração alemã no século XIX concentrou-se principalmente em qual região?',
    options: ['Nordeste', 'Região Sul', 'Amazônia', 'Ceará'],
    answer: 1,
  },
  {
    id: 'q18',
    era: 'imigracao',
    prompt: 'A maioria dos imigrantes europeus e asiáticos veio ao Brasil para...',
    options: [
      'construir pirâmides',
      'praticar capoeira',
      'fundar quilombos',
      'trabalhar na lavoura e povoar o país',
    ],
    answer: 3,
  },
  /* --- Brasil Moderno e Diverso --- */
  {
    id: 'q19',
    era: 'moderno',
    prompt: 'O Dia da Consciência Negra, em 20 de novembro, homenageia...',
    options: ['Cabral', 'Dom Pedro I', 'Zumbi dos Palmares', 'Princesa Isabel'],
    answer: 2,
  },
  {
    id: 'q20',
    era: 'moderno',
    prompt: 'Quantos povos indígenas são reconhecidos atualmente no Brasil?',
    options: ['Apenas 5 povos', 'Nenhum', 'Apenas 10 povos', 'Mais de 250 povos'],
    answer: 3,
  },
  {
    id: 'q21',
    era: 'moderno',
    prompt: 'A diversidade cultural brasileira de hoje é resultado de...',
    options: [
      'um único povo',
      'séculos de encontros e misturas entre muitas culturas',
      'ausência de imigração',
      'uma cultura isolada',
    ],
    answer: 1,
  },
]);

/* ------------------------------------------------------------------ */
/* Rótulos auxiliares para a interface                                 */
/* ------------------------------------------------------------------ */
export const SPACE_TYPE_INFO = Object.freeze({
  start: { icon: '🚩', label: 'Partida' },
  normal: { icon: '·', label: 'Caminho' },
  sorte: { icon: '🍀', label: 'Carta de Sorte' },
  reverse: { icon: '🔄', label: 'Carta Reverse' },
  pergunta: { icon: '❓', label: 'Pergunta' },
  finish: { icon: '🏁', label: 'Brasil Atual' },
});

export function eraById(id) {
  return ERA_BY_ID[id] || null;
}
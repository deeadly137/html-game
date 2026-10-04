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
  verde: { id: 'verde', label: 'Verde', color: '#2f7d4f' },
  vinho: { id: 'vinho', label: 'Vinho', color: '#9c2f2f' },
  azul: { id: 'azul', label: 'Azul', color: '#2b5f9e' },
  ambar: { id: 'ambar', label: 'Âmbar', color: '#c9873a' },
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
    range: [1, 4],
  },
  {
    id: 'portugueses',
    title: 'Chegada dos Portugueses',
    period: '1500 – século XVI',
    color: '#2b4a7d',
    range: [5, 8],
  },
  {
    id: 'africanos',
    title: 'Tráfico de Africanos Escravizados',
    period: 'século XVI – XIX',
    color: '#8a4b1f',
    range: [9, 12],
  },
  {
    id: 'mesticagem',
    title: 'Mestiçagem no Brasil Colônia',
    period: 'século XVII – XVIII',
    color: '#6b3f6e',
    range: [13, 16],
  },
  {
    id: 'abolicao',
    title: 'Abolição da Escravidão',
    period: '1871 – 1888',
    color: '#9c2f2f',
    range: [17, 20],
  },
  {
    id: 'imigracao',
    title: 'Imigração Europeia e Asiática',
    period: 'século XIX – XX',
    color: '#a8760f',
    range: [21, 24],
  },
  {
    id: 'moderno',
    title: 'Brasil Moderno e Diverso',
    period: 'século XX – XXI',
    color: '#1f6f63',
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
    title: 'Discriminação presenciada',
    text: 'Você viu alguém ser discriminado. Reverse: não fique em silêncio — fale, explique, chame a conversa para a reflexão. Avance 2 casas.',
    effects: [{ move: 2 }],
  },
  {
    id: 'r02',
    title: 'Piada racista',
    text: 'Alguém contou uma piada racista. Reverse: não ria. Mostre por que não tem graça. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 'r03',
    title: 'Sua origem questionada',
    text: 'Colocaram em dúvida a sua origem. Reverse: responda com conhecimento, não com raiva. Avance 1 casa e ganhe 1 ponto cultural.',
    effects: [{ move: 1 }, { points: 1 }],
  },
  {
    id: 'r04',
    title: 'Estereótipo no material',
    text: 'Um livro traz um estereótipo sobre um povo. Reverse: aponte o erro e proponha a correção. Ganhe 2 pontos culturais e avance 1 casa.',
    effects: [{ points: 2 }, { move: 1 }],
  },
  {
    id: 'r05',
    title: 'Intolerância religiosa',
    text: 'Uma casa de religião de matriz africana foi atacada. Reverse: junte as comunidades e promova o diálogo. Avance 2 casas.',
    effects: [{ move: 2 }],
  },
  {
    id: 'r06',
    title: 'Apelido ofensivo',
    text: 'Usaram um apelido ofensivo com um colega. Reverse: converse com quem falou, sem constranger quem sofreu. Ganhe 1 ponto cultural.',
    effects: [{ points: 1 }],
  },
  {
    id: 'r07',
    title: '"Cotas são privilégio?"',
    text: 'Alguém disse que cotas são privilégio. Reverse: explique o que é reparação histórica. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 'r08',
    title: 'Comentário preconceituoso',
    text: 'Soltaram um comentário preconceituoso na sua frente. Reverse: não passe pano — interrompa e explique. Avance 1 casa.',
    effects: [{ move: 1 }],
  },
  {
    id: 'r09',
    title: 'Alguém foi excluído',
    text: 'Um colega foi deixado de fora da festa por causa da origem. Reverse: convide e inclua. Avance 2 casas.',
    effects: [{ move: 2 }],
  },
  {
    id: 'r10',
    title: 'Barrado no trabalho',
    text: 'Uma pessoa foi recusada numa vaga por causa do cabelo. Reverse: apoie quem foi barrado e denuncie. Ganhe 2 pontos culturais.',
    effects: [{ points: 2 }],
  },
  {
    id: 'r11',
    title: 'Cultura tratada como exótica',
    text: 'Chamaram a sua cultura de exótica. Reverse: mostre que a norma também é sua. Ganhe 1 ponto cultural e avance 1 casa.',
    effects: [{ points: 1 }, { move: 1 }],
  },
  {
    id: 'r12',
    title: 'Você ficou em silêncio',
    text: 'Você viu o preconceito acontecer e não disse nada. Reverse: pare, estude e volte para falar. Passe o próximo turno estudando e ganhe 2 pontos culturais.',
    effects: [{ skipTurns: 1 }, { points: 2 }],
  },
  {
    id: 'r13',
    title: 'Sua voz ganhou espaço',
    text: 'Depois de tanto explicar, a roda finalmente te escutou. Reverse: a conversa mudou de lugar — troque de posição com quem está na frente.',
    effects: [{ swapWithLeader: true }],
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
  start: { icon: '◆', label: 'Partida' },
  normal: { icon: '', label: 'Caminho' },
  sorte: { icon: '✦', label: 'Sorte' },
  reverse: { icon: '↺', label: 'Reverse' },
  pergunta: { icon: '?', label: 'Pergunta' },
  finish: { icon: '★', label: 'Brasil Atual' },
});

export function eraById(id) {
  return ERA_BY_ID[id] || null;
}

/* ------------------------------------------------------------------ */
/* "Você sabia?" — curiosidade mostrada DEPOIS de responder            */
/* É o que transforma o acerto/erro em aprendizado.                    */
/* ------------------------------------------------------------------ */
export const FACTS = Object.freeze({
  q01: 'Mais de 250 povos indígenas vivem hoje no Brasil, falando cerca de 170 línguas. Eles já estavam aqui há milhares de anos antes de 1500.',
  q02: "'Mandioca', 'caju', 'pipoca', 'abacaxi' e 'tapioca' vêm do tupi. 'Ipanema', 'Ipiranga' e 'Copacabana' também são nomes de origem indígena.",
  q03: 'A mandioca é cultivada há mais de 4 mil anos na Amazônia. O Brasil é um dos centros de origem da planta, que hoje alimenta o mundo inteiro.',
  q04: 'A frota de Cabral tinha 13 embarcações e cerca de 1.500 pessoas. Era uma expedição rumo às Índias que aportou na atual Bahia em 22 de abril de 1500.',
  q05: 'Salvador foi capital de 1549 a 1763. Depois a capital passou ao Rio de Janeiro e, em 1960, a Brasília.',
  q06: 'A mistura no Brasil começou de forma violenta, imposta pela colonização — e ao mesmo tempo criou línguas, comidas e religiões que não existiam antes.',
  q07: "Povos como banto, iorubá e fon foram trazidos à força. Suas línguas moldaram o português do Brasil: 'dendê', 'caçamba', 'moleque' e 'samba' vêm do africano.",
  q08: 'Quilombo era comunidade de pessoas que fugiam da escravidão. O dos Palmares resistiu quase 100 anos e chegou a reunir milhares de pessoas.',
  q09: 'Zumbi nasceu livre em Palmares, foi capturado na infância e conseguiu voltar. Morreu em 20 de novembro de 1695 — data do Dia da Consciência Negra.',
  q10: "A palavra vem do latim 'miscere' (misturar). Aqui a mistura se deu entre povos indígenas, africanos, europeus, asiáticos e também árabes.",
  q11: 'A feijoada junta o feijão (América), a carne suína (Europa) e técnicas africanas. O prato conta a história do país em uma única travessa.',
  q12: 'No sincretismo, santos católicos foram associados a orixás — como Iemanjá e Nossa Senhora dos Navegantes — para manter tradições africanas sob perseguição.',
  q13: 'A Lei Áurea foi assinada em 13 de maio de 1888. O Brasil foi o último país das Américas a abolir a escravidão.',
  q14: 'A lei não previu terra, escola nem indenização. Sem reparação, a população negra foi deixada à margem — e esse efeito chega até hoje.',
  q15: 'A Lei do Ventre Livre (1871) libertou os filhos, mas não as mães. Foi uma abolição lenta, feita "para inglês ver".',
  q16: 'O navio Kasato Maru chegou em 18 de junho de 1908, com 165 famílias japonesas. Hoje o Brasil tem a maior comunidade japonesa fora do Japão.',
  q17: 'Alemães chegaram desde 1824, no Rio Grande do Sul, e italianos desde 1875. Muitas cidades do Sul têm nomes e festas dessas origens.',
  q18: 'A imigração foi financiada para substituir a mão de obra escravizada depois de 1850. Os imigrantes também enfrentaram contratos muito duros.',
  q19: 'O 20 de novembro é feriado nacional desde 2023. O dia lembra Zumbi dos Palmares e é celebrado pelo movimento negro desde 1971.',
  q20: 'São mais de 250 povos e cerca de 170 línguas indígenas, segundo o IBGE. Reconhecer essa diversidade é parte do que este jogo propõe.',
  q21: 'A diversidade brasileira nasceu de encontros, mas também das desigualdades deixadas pela colonização. Entender os dois lados é entender o país.',
});

/* ------------------------------------------------------------------ */
/* MUNDO HORIZONTAL                                                    */
/* Cada era tem comprimento próprio e um cenário com 3 camadas.        */
/* Paleta fechada, inspirada em xilogravura de cordel.                 */
/* ------------------------------------------------------------------ */
export const WORLD = Object.freeze({
  pad: 540, // respiro antes da partida e depois da chegada, em px
  top: 0.30, // faixa vertical do caminho (fração da altura da tela)
  bottom: 0.74,
  ripple: 0.032, // ondulação interna de cada era
  rippleBumps: 2,
  edge: 0.09, // margem das casas nas pontas de cada era (fração do comprimento)
});

/** Nível vertical (fração da altura) em cada divisa entre eras. */
export const LEVELS = Object.freeze([0.6, 0.5, 0.63, 0.49, 0.62, 0.51, 0.64, 0.5, 0.6, 0.56]);

/** Silhuetas provisórias: alturas 0..1 ao longo da faixa. */
export const PROFILES = Object.freeze({
  campo: [0.18, 0.24, 0.16, 0.27, 0.2, 0.3, 0.17, 0.25, 0.19, 0.28, 0.16, 0.23, 0.2, 0.26],
  mata: [0.55, 1.0, 0.42, 0.92, 0.5, 1.0, 0.38, 0.88, 0.6, 0.96, 0.45, 1.0, 0.52, 0.9],
  mar: [0.3, 0.42, 0.26, 0.5, 0.32, 0.44, 0.24, 0.58, 0.3, 0.46, 0.28, 0.52, 0.34, 0.4],
  canavial: [0.5, 0.7, 0.46, 0.74, 0.52, 0.68, 0.44, 0.76, 0.48, 0.72, 0.5, 0.7, 0.46, 0.74],
  casario: [0.4, 0.62, 0.38, 0.7, 0.42, 0.58, 0.36, 0.66, 0.44, 0.6, 0.4, 0.68, 0.38, 0.64],
  porto: [0.24, 0.55, 0.3, 0.8, 0.26, 0.62, 0.32, 0.74, 0.28, 0.66, 0.24, 0.78, 0.3, 0.6],
  cidade: [0.66, 0.44, 0.82, 0.4, 0.72, 0.5, 0.88, 0.42, 0.7, 0.48, 0.8, 0.46, 0.68, 0.52],
  mosaico: [0.5, 0.66, 0.42, 0.78, 0.54, 0.7, 0.4, 0.82, 0.48, 0.72, 0.56, 0.68, 0.44, 0.76],
});

/**
 * Um cenário por trecho do percurso.
 *  length  — quanto o trecho ocupa no mundo (px)
 *  sky     — gradiente do céu (2 paradas)
 *  far     — cor das silhuetas do fundo
 *  ink     — cor do contorno/primeiro plano
 *  profile — silhueta de PROFILES
 */
export const SCENES = Object.freeze({
  partida: { length: 560, sky: ['#fdf3dc', '#f0dcb4'], far: '#c2a878', ground: '#dcc79c', ink: '#2a2118', profile: 'campo' },
  indigena: { length: 1200, sky: ['#f6e6c4', '#dcc296'], far: '#8fae74', ground: '#c8b483', ink: '#241d14', profile: 'mata' },
  portugueses: { length: 1150, sky: ['#dceaf2', '#9dc0d6'], far: '#5c7a94', ground: '#cbbf9c', ink: '#22262b', profile: 'mar' },
  africanos: { length: 1600, sky: ['#f8dfb4', '#e0b070'], far: '#a8763c', ground: '#cdb078', ink: '#2b2013', profile: 'canavial' },
  mesticagem: { length: 1150, sky: ['#fbe9cd', '#e2c69c'], far: '#a58f6b', ground: '#d6c39c', ink: '#2a2318', profile: 'casario' },
  abolicao: { length: 1150, sky: ['#fde5cd', '#e6bda0'], far: '#c08468', ground: '#d5bb98', ink: '#2c1f19', profile: 'campo' },
  imigracao: { length: 1250, sky: ['#e6e1f0', '#b3a9c8'], far: '#7a6f96', ground: '#c9c0d4', ink: '#241f2e', profile: 'porto' },
  moderno: { length: 1200, sky: ['#e6eef4', '#aebecd'], far: '#7d93a6', ground: '#c3ccd4', ink: '#1f2429', profile: 'cidade' },
  chegada: { length: 640, sky: ['#fdeed2', '#efd4a4'], far: '#c08a3a', ground: '#dcc79c', ink: '#2a2118', profile: 'mosaico' },
});

/** Trechos do percurso, na ordem. `era` casa com os ids de ERAS. */
export const SEGMENTS = Object.freeze([
  { id: 'partida', era: 'start' },
  { id: 'indigena', era: 'indigena' },
  { id: 'portugueses', era: 'portugueses' },
  { id: 'africanos', era: 'africanos' },
  { id: 'mesticagem', era: 'mesticagem' },
  { id: 'abolicao', era: 'abolicao' },
  { id: 'imigracao', era: 'imigracao' },
  { id: 'moderno', era: 'moderno' },
  { id: 'chegada', era: 'finish' },
]);
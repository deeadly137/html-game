# 🎲 Miscigenação: Linha do Tempo

Jogo de tabuleiro **educativo e visual** sobre a miscigenação no Brasil. Percorra a
linha do tempo do período indígena ao Brasil atual, jogue o dado, responda perguntas
e colecione **pontos culturais**.

O tabuleiro é um **mundo horizontal**: o mundo anda, a câmera desliza, a peça caminha
casa a casa e o dado é lançado no mapa — nada de painéis fixos ocupando a tela.

**▶️ Jogar: <https://deeadly137.github.io/html-game/>**

---

## ▶️ Como rodar

Requisito: **Node.js 18+**. Não há nenhuma dependência para instalar.

```bash
npm start          # ou: node server.js
```

Depois abra **http://localhost:5173**. Para outra porta: `node server.js 8080`.

> ⚠️ Abrir o `index.html` com duplo clique **não funciona**: os módulos ES são
> bloqueados em `file://`. O próprio jogo mostra um aviso ensinando a iniciar o servidor.

---

## 🕹️ Como se navega

| Ação | O que faz |
| --- | --- |
| **Roda do mouse / arrastar / ← →** | Olham o percurso. A câmera desliza suavemente (lerp), não a peça. |
| **Espaço** ou **Focar peça** | Volta o foco para o peão da vez. |
| **Clicar no dado** (ou `Enter`) | Rola o dado, que fica **no mapa**, ao lado da peça. |
| **1–4** | Respondem a pergunta quando a casa é de pergunta. |
| **Diário** | Abre a gaveta com o registro da partida. |

---

## 📜 Regras

1. **Jogar o dado** e avançar o número de casas. O peão anda **casa a casa** pelo caminho.
2. Casar em **❓ Pergunta**: responder dá pontos culturais. **Errar faz voltar para a
   casa onde estava antes de rolar.**
3. Casar em **✦ Sorte** ou **↺ Reverse**: a carta é puxada, vira na tela e o efeito
   acontece de fato.
4. Depois de cada resposta aparece um **“você sabia?”** com um fato histórico — é aqui
   que o jogo ensina, e não só pontua.
5. Vence quem chega ao **Brasil Atual** com mais pontos culturais.

### As sete eras (cada uma com seu cenário e comprimento)

| # | Era | Período |
| --- | --- | --- |
| 1 | Período Indígena | antes da colonização |
| 2 | Chegada dos Portugueses | 1500 – século XVI |
| 3 | Tráfico de Africanos Escravizados | século XVI – XIX |
| 4 | Mestiçagem no Brasil Colônia | século XVII – XVIII |
| 5 | Abolição da Escravidão | 1871 – 1888 |
| 6 | Imigração Europeia e Asiática | século XIX – XX |
| 7 | Brasil Moderno e Diverso | século XX – XXI |

Cada trecho tem **comprimento próprio** — a era da escravidão é o trecho mais longo do
percurso — e um cenário com céu e silhuetas que mudam (mata, mar, canavial, casario,
porto, cidade).

---

## 🧭 Sobre a lógica das cartas Reverse

As cartas Reverse **não punem quem sofre o preconceito**. A regra é:

- quem **enfrenta** o preconceito (fala, explica, denuncia) **avança ou ganha pontos**;
- quem **fica em silêncio** perde tempo estudando — mas ganha conhecimento.

Não existe carta em que a vítima recua. Isso é verificado por teste automatizado.

---

## 🗂️ Estrutura

```
lic/
├── index.html            # Interface: mundo, HUD, modais
├── style.css             # Xilogravura de cordel: papel, tinta, cores chapadas
├── src/
│   ├── data.js           # Conteúdo: tabuleiro, eras, perguntas, fatos, cartas, cenários
│   ├── engine.js         # Motor de regras puro (dado, turnos, pontos, vitória)
│   ├── world.js          # Geometria do mundo: percurso curvo, casas, câmera
│   ├── ui.js             # Liga o motor ao DOM: câmera, animações, modais
│   └── README.md         # Este arquivo
├── server.js             # Servidor estático sem dependências
├── cli.js                # Versão de terminal (opcional)
├── tools/
│   ├── fake-dom.js       # DOM mínimo para testar a interface sem navegador
│   └── inspect-world.mjs # Imprime a geometria do mundo (apoio ao desenvolvimento)
└── test/
    ├── engine.test.js    # Testes das regras e do conteúdo
    └── ui.test.js        # Testes da interface (mundo, dado, caminhada, cartas, fatos)
```

### Decisões técnicas

- **A geometria é pura.** `world.js` calcula o percurso com matemática (meia onda de
  cosseno + ondulação) e a **mesma** função usada para desenhar o `d` do caminho SVG
  posiciona as casas e move os peões. Por isso dá para testar tudo no Node.
- **Determinismo por semente.** Todo sorteio passa por um PRNG `mulberry32`, então a
  mesma semente reproduz a partida inteira.
- **Alternativas embaralhadas** em tempo de execução: a resposta certa não fica sempre
  na mesma posição.
- **Sem emoji e sem dependência externa.** Os peões, as silhuetas e o dado são
  desenhados (SVG/CSS). Nenhuma biblioteca, nenhuma fonte remota, nenhuma imagem.

---

## 🧪 Testes

```bash
npm test
```

42 testes: regras do motor, conteúdo (toda pergunta tem um fato, nenhuma carta puniu a
vítima) e a interface rodando com um DOM mínimo — incluindo um teste que **joga uma
partida inteira** até o vencedor e outro que prova que o peão **passa por cada casa**
do trajeto, sem pular.

Apoio ao desenvolvimento:

```bash
node tools/inspect-world.mjs   # geometria do percurso, casas e câmera
node cli.js --auto             # partida completa no terminal
```

---

## ✏️ Personalizando

Todo o conteúdo está em **`src/data.js`**:

- **Pergunta** — `QUESTIONS` (com `answer` = índice da correta na ordem original);
- **Fato do "você sabia?"** — `FACTS`, chaveado pelo id da pergunta;
- **Carta** — `SORTE_CARDS` / `REVERSE_CARDS`. Efeitos: `{ move }`, `{ points }`,
  `{ skipTurns }`, `{ swapWithLeader }`, `{ extraTurn }` (combináveis);
- **Cenário de uma era** — `SCENES`: `length` (comprimento no mundo), `sky` (gradiente),
  `far` (cor das silhuetas), `ink` e `profile` (formato do relevo);
- **Formato do mundo** — `WORLD` (respiro, faixa vertical, ondulação) e `LEVELS`
  (nível do caminho em cada divisa).

Regras numéricas (lados do dado, pontos por acerto, bônus de chegada) ficam em
`DEFAULTS`, em `src/engine.js`.

---

## 📄 Licença

MIT.

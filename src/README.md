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
| **Roda do mouse / arrastar / ← →** | Olham o percurso. A câmera desliza suavemente (lerp), não a peça. O deslocamento é **posição absoluta limitada ao mundo**: sem zona morta. |
| **Espaço** ou **Focar peça** | Volta a seguir o peão da vez. |
| **Clicar no dado** (ou `Enter`) | O dado é lançado da **caixa do rodapé** até o mapa, rola, mostra o resultado e volta para a caixa. |
| **1–4** | Respondem a pergunta quando a casa é de pergunta. |
| **Diário** | Abre a gaveta com o registro da partida. |
| **Som** | Liga/desliga os efeitos (dado, passos, carta, acerto). São sintetizados na hora, sem arquivo. |

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
  posiciona as casas e move os peões. Por isso dá para testar tudo no Node. O percurso
  começa e termina com `WORLD.pad` de respiro, para a partida não encostar na borda.
- **A câmera guarda POSIÇÃO ABSOLUTA, não deslocamento acumulado.** `want === null`
  significa "seguindo a peça"; ao arrastar, `want` fixa a posição. Limitar a posição
  (e não o acumulado) é o que elimina a zona morta da roda — e faz a ordem entre
  `setBounds` e `setAnchor` deixar de importar.
- **Cenário desenhado em coordenadas reais.** Cada trecho é um SVG com `viewBox` do
  tamanho exato do elemento — nada de `preserveAspectRatio="none"`, que esticava as
  formas em triângulos. As peças (oca, caravela, engenho, casario, porto, cidade) são
  compostas de primitivas na mesma paleta fechada, e as divisas entre eras têm uma
  faixa de degradê em vez de um corte seco.
- **Dado de verdade, numa caixa.** Um cubo 3D em CSS com as 6 faces mora numa caixa no
  rodapé; ao clicar, é lançado até o mapa por `transform`, rola, assenta o resultado e
  volta para a caixa. Como a caixa fica no HUD, o dado **sempre** está visível e
  clicável — não depende de onde a câmera está.
- **Som sintetizado.** Os efeitos nascem de osciladores na hora, via Web Audio — sem
  arquivo de áudio, sem biblioteca. O contexto só é criado no primeiro gesto, como os
  navegadores exigem.
- **Determinismo por semente.** Todo sorteio passa por um PRNG `mulberry32`, então a
  mesma semente reproduz a partida inteira.
- **Alternativas embaralhadas** em tempo de execução: a resposta certa não fica sempre
  na mesma posição.
- **Sem emoji e sem dependência externa.** Peões, cenários e dado são desenhados
  (SVG/CSS). Nenhuma biblioteca, nenhuma fonte remota, nenhuma imagem.

---

## 🧪 Testes

```bash
npm test
```

51 testes: regras do motor, conteúdo (toda pergunta tem um fato, nenhuma carta puniu a
vítima) e a interface rodando com um DOM mínimo. Entre eles:

- uma **partida inteira** jogada até o vencedor;
- o **rastro** do peão provando que ele passa por cada casa, em ordem, na ida e na volta;
- o dado disponível em **6 turnos seguidos**, alternando os jogadores;
- o enquadramento inicial: o peão aparece a 38% da tela, sem colar na borda;
- travas de regressão para os bugs encontrados jogando no navegador: o clique no dado
  não pode ser capturado pelo palco, um clique curto não pode virar arrasto, o diário
  precisa nascer fechado, a câmera precisa seguir o próximo jogador e os peões não
  podem se cobrir na mesma casa.

> **Sobre o DOM falso:** ele já mascarou um bug — `classList.toggle(nome, force)`
> ignorava o segundo argumento, então `toggle('is-off', false)` *adicionava* a classe.
> O shim hoje respeita o `force`, como o DOM real.

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

# 🎲 Miscigenação: Linha do Tempo

Jogo de tabuleiro **educativo e visual** sobre a miscigenação no Brasil: percorra a
linha do tempo do período indígena até o Brasil atual, jogue o dado, responda
perguntas, encare cartas de **Sorte** e **Reverse** e acumule **pontos culturais**.

> **Objetivo:** percorrer a linha do tempo da miscigenação no Brasil, do período
> colonial até os dias atuais, entendendo os desafios e conquistas das diferentes
> etnias que formaram nossa sociedade.

---

## ▶️ Como jogar (interface gráfica)

Requisito: **Node.js 18+**. Não há nenhuma dependência para instalar.

```bash
cd lic
npm start          # ou: node server.js
```

Depois abra **http://localhost:5173** no navegador. Para usar outra porta:

```bash
node server.js 8080   # http://localhost:8080
```

> ⚠️ Abrir o arquivo `index.html` com duplo clique **não funciona** (o navegador
> bloqueia módulos ES em `file://`). Se isso acontecer, o próprio jogo mostra um
> aviso explicando como iniciar o servidor.

### O que a interface oferece

Tela disposta como uma mesa de jogo: **tabuleiro no centro**, e nas laterais os
painéis de apoio — à **esquerda o placar com a mesa de cartas logo abaixo** e à
direita o dado e o diário.

```
┌──────────────────┬───────────────────────┬───────────┐
│ PLACAR           │      TABULEIRO        │   DADO    │
│  🪶 Ana   casa 12│   (linha do tempo)    │  🎲 ⚄     │
│  🥁 Bia   casa 18│                       │  DIÁRIO   │
├──────────────────┤                       │   ...     │
│ MESA DE CARTAS   │                       │           │
│  🍀 Sorte  12/12 │                       │           │
│  🔄 Reverse 12/12│                       │           │
│  ❓ Perguntas 21 │                       │           │
│ ┌ carta em jogo┐ │                       │           │
└─┴──────────────┴─┴───────────────────────┴───────────┘
```

| Área | Descrição |
| --- | --- |
| **Tela de configuração** | Escolha de 1 a 4 jogadores, nome e peão de cada um, e uma semente opcional (para partidas reproduzíveis). |
| **Tabuleiro (centro)** | Folha de papel com as 30 casas organizadas em 9 faixas (Partida + 7 eras + Chegada). Cada faixa é lida **da esquerda para a direita**, em ordem crescente, e traz à sua esquerda uma placa com o nome e o período da era. |
| **Casas** | Quadrados de papel com a cor da era no topo; Sorte 🍀 (verde), Reverse 🔄 (roxo) e Pergunta ❓ (azul) se destacam à primeira vista. A casa do jogador da vez sobe e ganha moldura dourada. |
| **Peões** | Peões redondos na cor da raiz cultural: 🪶 indígena, 🥁 africano, 🏰 europeu, 🏮 asiático. O peão da vez pulsa na casa atual. |
| **Placar (esquerda, topo)** | Fichas de jogador com posição, pontos culturais e status ("refletindo") em tempo real. |
| **Mesa de cartas (esquerda, embaixo do placar)** | Os três baralhos empilhados com a contagem de cartas restantes (`12/12`, `21/21`…) e, logo abaixo, **a carta/pergunta que está em jogo** naquele momento, com borda na cor do tipo. |
| **Dado e diário (direita)** | Botão "Rolar o dado" com dado de 6 faces em pontos (ou tecla `Espaço` / `Enter`), e o registro de tudo o que acontece na partida. |
| **Modais** | Perguntas com alternativas em relevo (atalhos `1`–`4`), cartas de Sorte/Reverse e a tela de vencedor com o ranking final. |

> **Observação:** as cartas da bandeja são informativas — ao cair numa casa especial
> o efeito da carta continua sendo aplicado automaticamente, como sempre.

---

## 📜 Regras

1. **Escolha do peão:** cada jogador assume uma raiz cultural (indígena, africano, europeu ou asiático).
2. **Jogar o dado:** avance o número de casas sorteado (dado de 6 faces).
3. **Casas especiais:**
   - ❓ **Pergunta** — responda uma questão de múltipla escolha sobre a miscigenação.
   - 🍀 **Sorte** — puxe uma carta positiva (avançar casas, ganhar pontos, jogar de novo…).
   - 🔄 **Reverse** — puxe uma carta de desafio/preconceito que pede **inversão de perspectiva**
     (voltar casas, passar o turno refletindo, trocar de lugar com quem está na frente…).
4. **Erro:** se errar a pergunta, você **volta para a casa onde estava antes de rolar o dado**.
5. **Pontos culturais:** acerto de pergunta e boas cartas rendem pontos. Chegar ao fim dá bônus.
6. **Vitória:** o jogo termina quando alguém alcança **Brasil Atual**; vence quem chega
   com o **maior número de pontos culturais**.

### A linha do tempo (30 casas, 7 eras)

1. 🪶 **Período Indígena** — antes da colonização
2. ⛵ **Chegada dos Portugueses** — 1500 – século XVI
3. ⛓️ **Tráfico de Africanos Escravizados** — século XVI – XIX
4. 🎨 **Mestiçagem no Brasil Colônia** — século XVII – XVIII
5. 🕊️ **Abolição da Escravidão** — 1871 – 1888
6. 🚢 **Imigração Europeia e Asiática** — século XIX – XX
7. 🌎 **Brasil Moderno e Diverso** — século XX – XXI → 🏁 **Brasil Atual**

---

## 🗂️ Estrutura do projeto

O **motor de regras é separado da interface**, então o mesmo jogo roda no
navegador, no terminal e nos testes automatizados.

```
lic/
├── index.html            # Interface gráfica do jogo (GUI)
├── style.css             # Estilos do tabuleiro, cartas, modais e animações
├── src/
│   ├── data.js           # Conteúdo: tabuleiro, eras, peões, cartas e perguntas
│   ├── engine.js         # Motor de regras puro (dado, turnos, pontos, vitória)
│   └── ui.js             # Ligação entre o motor e o DOM
├── server.js             # Servidor estático sem dependências (npm start)
├── cli.js                # Versão opcional para terminal
├── tools/fake-dom.js     # DOM mínimo para testar a GUI sem navegador
├── test/
│   ├── engine.test.js    # Testes das regras do jogo
│   └── ui.test.js        # Teste de fumaça da interface gráfica
└── package.json
```

### Detalhes de implementação

- **Determinismo:** todos os sorteios usam um PRNG com *seed* (`mulberry32`), então
  uma partida com a mesma semente acontece exatamente igual — ótimo para testar e
  para reproduzir partidas em sala de aula.
- **Alternativas embaralhadas:** as opções de cada pergunta são embaralhadas em
  tempo de execução, evitando que a resposta correta fique sempre na mesma posição.
- **Zero dependências:** nenhuma biblioteca externa; apenas a biblioteca padrão do
  Node (para o servidor e os testes) e JavaScript puro no navegador.

---

## 🧪 Testes

```bash
npm test
```

Cobrem o motor (movimentação, acerto/erro, efeitos das cartas, turnos pulados,
troca de lugar, vitória/ranking, determinismo e uma partida completa simulada) e
a interface gráfica (início da partida, tabuleiro com 30 casas, modais de pergunta,
tela de vencedor e reinício) — esta última rodando com um DOM mínimo, sem navegador.

---

## 💻 Jogar no terminal (opcional)

A GUI é a forma principal de jogar, mas há uma versão de terminal:

```bash
node cli.js                        # partida interativa com 2 jogadores
node cli.js --players 3            # 3 jogadores
node cli.js --names "Ana,Bia"      # nomes personalizados
node cli.js --seed 42              # partida reproduzível
node cli.js --auto                 # partida automática (demonstração)
```

---

## ✏️ Personalizando o conteúdo

Todo o conteúdo educativo está em **`src/data.js`**:

- **Adicionar pergunta** — inclua um objeto em `QUESTIONS`:
  ```js
  {
    id: 'q22',
    era: 'moderno',
    prompt: 'Sua pergunta aqui?',
    options: ['Correta', 'Errada 1', 'Errada 2', 'Errada 3'],
    answer: 0, // índice da correta na ordem original
  }
  ```
- **Adicionar carta** — inclua um objeto em `SORTE_CARDS` ou `REVERSE_CARDS`.
  Os efeitos disponíveis são `{ move: n }`, `{ points: n }`, `{ skipTurns: n }`,
  `{ swapWithLeader: true }` e `{ extraTurn: true }` (podem ser combinados).
- **Mudar casas/eras** — edite `SPACE_TABLE` e `ERAS` no mesmo arquivo
  (as eras usam 4 casas cada, e a última casa é sempre a de chegada).

Regras numéricas (lados do dado, pontos por acerto, bônus de chegada) ficam em
`DEFAULTS`, no topo de `src/engine.js`.

---

## 📄 Licença

MIT.

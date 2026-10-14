# FinBrain · V0

Landing page e sistema do **FinBrain**: dados de mercado, simulações e um
agente que informa (sem recomendar). Páginas estáticas, sem build, com
dados ilustrativos (mock) gerados no navegador.

## Estrutura

```
index.html                      Landing page
assets/
  css/base.css                  Design system: paleta (tokens) e componentes comuns
  css/landing.css               Estilos só da landing
  img/                          Logos e imagem de fundo
  js/landing.js                 Interações da landing
app/
  index.html                    Tela central do sistema, com as abas
  app.css                       Casca: barra superior, abas, painéis, responsividade
  app.js                        Inicialização
  core/                         Peças compartilhadas pelas abas
    format.js                   Números, datas e moeda em pt-BR
    market-data.js              Séries ilustrativas e estatísticas
    simulation-engine.js        Monte Carlo do aporte mensal
    charts.js                   Gráficos SVG (candles, sparkline, leque)
    state.js                    Estado compartilhado e eventos entre as abas
    layout.js                   Detecção de celular (até 720 px)
    tabs.js                     Navegação por abas (hash na URL e teclado)
    topbar.js                   Indicadores e busca de ativo
    tooltip.js                  Dica dos gráficos
  screens/                      Uma pasta por funcionalidade (JS + CSS)
    dashboards/                 Watchlist, macro Brasil e gráfico de candles
    brain/                      Conversa com o agente e contexto em uso
      brain-engine.js           Lógica de resposta (pura, testável)
    simulacoes/                 Simulador de aporte mensal
    transparencia/              Trilha das chamadas de ferramenta
tests/                          Testes (node:test + jsdom)
```

## Tela central e abas

O sistema tem uma tela só, com quatro abas: **Dashboards**, **Brain**,
**Simulações** e **Transparência**. A aba ativa fica no endereço
(`app/#brain`, `app/#simulacoes`...), então os cartões da landing abrem a
funcionalidade certa e o botão voltar do navegador funciona. As abas
conversam entre si:

- escolher um ativo nos Dashboards atualiza as sugestões e o contexto do Brain;
- pedir uma simulação ao Brain atualiza a aba Simulações;
- cada consulta do Brain entra na Transparência (o número aparece na aba);
- Dashboards e Simulações têm atalhos que levam a pergunta ao Brain.

## Cores

Todas as cores estão em `assets/css/base.css`, no bloco `:root`, agrupadas
por uso (superfícies escuras, teal da marca, texto em fundo escuro,
superfícies claras, sinais de alta/queda). O resto do código usa só
`var(--token)`; transparências usam `color-mix()` sobre os mesmos tokens.
O teste `tests/colors.test.js` falha se aparecer uma cor fora da paleta.

## Responsividade

| Largura | Comportamento |
|---------|---------------|
| acima de 1180 px | Layout em colunas (painel lateral ao lado do conteúdo) |
| 721 a 1180 px | Uma coluna; painéis laterais lado a lado; contexto do Brain em 2 colunas |
| até 720 px | Busca em linha própria; 4 abas fixas no topo com ícone e nome; gráficos com geometria compacta (sem rolagem lateral); gráfico antes da watchlist; sugestões do Brain em uma linha rolável; trilha em cartões |
| telas de toque | Alvos de toque maiores e campos com 16 px (sem zoom automático no iOS) |

Os gráficos são redesenhados quando a tela cruza 720 px (por exemplo, ao
girar o celular).

## Rodar e testar

```bash
npm install
npm run serve      # http://localhost:5500 (a página também abre direto do disco)
npm test           # 36 testes
```

Os testes cobrem: formatação, dados e simulação; respostas do Brain;
paleta de cores; validade de todos os arquivos JS e referências das
páginas; e a landing e o sistema carregados num navegador simulado
(jsdom), incluindo troca de abas, integração entre abas e layout de celular.

## CI

`.github/workflows/ci.yml` roda `npm ci` e `npm test` em Node 20 e 22 a
cada pull request e a cada push na `main`. Para bloquear merges sem os
testes passando, marque o check **Testes (Node 22)** como obrigatório em
*Settings → Branches → Branch protection rules* da `main`.

## Deploy

Vercel, sem build (framework preset *Other*). `index.html` é a landing e
`app/` é o sistema. O `.vercelignore` deixa testes e arquivos de
desenvolvimento fora do deploy.

# vendure-contract-suite

[![CI](https://github.com/FabioNandes/vendure-contract-suite/actions/workflows/ci.yml/badge.svg)](https://github.com/FabioNandes/vendure-contract-suite/actions/workflows/ci.yml)
[![Relatório](https://img.shields.io/badge/relat%C3%B3rio-ao%20vivo-2ea44f)](https://FabioNandes.github.io/vendure-contract-suite/)
[![TypeScript](https://img.shields.io/github/package-json/dependency-version/FabioNandes/vendure-contract-suite/dev/typescript?logo=typescript&logoColor=white&color=3178c6)](tsconfig.json)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)

> **Estado: Fase 0 — fundação.** Lint, typecheck e publicação do relatório estão configurados.
> As camadas descritas abaixo são o escopo planejado e **ainda não estão implementadas** —
> a seção [Progresso](#progresso) mostra exatamente o que já existe.

## Problema

A maior parte das suítes trata uma API GraphQL como se fosse REST: confere o status HTTP e segue.
Em GraphQL, um erro chega com **HTTP 200** e o campo `errors` preenchido; uma resposta pode ser
**parcial**; um campo da Admin API pode **vazar** pela Shop API. E quase ninguém responde à
pergunta: _quanto da superfície pública da API a suíte realmente toca?_

## Escopo

Sistema alvo: [Vendure](https://github.com/vendure-ecommerce/vendure) — commerce headless em
TypeScript, NestJS e GraphQL, com Shop API, Admin API e Admin UI.

| Camada        | O que cobre                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- |
| 0 — Contrato  | Snapshot do schema, diff bloqueante no CI, tipos gerados por `graphql-codegen`                  |
| 1 — API       | Erro com HTTP 200, resposta parcial, autorização por campo entre Shop e Admin, limites de query |
| 2 — Interface | Funcional magra + portão de regressão visual + portão de acessibilidade WCAG 2.2 AA             |
| 3 — BDD       | Gherkin apenas onde existe regra de negócio: promoções, estoque, cancelamento, frete            |

**Fora do escopo, por decisão:** Gherkin em testes de contrato, visuais ou de acessibilidade;
login pela interface em setup de teste; massa criada pela UI.

## O que este repositório demonstra

- **Cobertura de contrato, não de linha:** percentual das operações do schema efetivamente
  exercitadas, com as lacunas priorizadas por risco.
- Testes que entendem a **semântica de erro** do GraphQL, em vez de confiar no status code.
- Uma camada de UI pequena **por decisão de arquitetura**: o risco de interface é tratado por um
  portão automatizado de regressão visual e acessibilidade sobre a jornada crítica.

## Progresso

- [x] ESLint, Prettier e TypeScript estrito
- [x] Ambiente Vendure 3.8 com um comando (server, worker, Postgres): cerca de 640 MiB medidos
      ([docs/ambiente.md](docs/ambiente.md))
- [x] Fatia vertical carrinho → pedido: contrato → API → banco → worker → UI, 10 execuções
      completas seguidas sem falha
- [x] Fábrica de massa via API, com limpeza determinística
- [x] Matriz de autenticação por `storageState` (guest, customer, admin), sem login pela UI
- [x] CI com o ambiente completo e relatório de execução publicado no GitHub Pages
- [x] `quality-exports/` (`manifest.json`, `scenarios.json`), regenerados pelo CI no `main`
- [ ] Sharding, com tempo antes e depois medido
- [ ] Camada de API ampliada para os fluxos de maior risco
- [ ] Relatório de cobertura de schema
- [ ] Portões visual e de acessibilidade

## Como a suíte está organizada

Os projetos do Playwright seguem a ordem do pipeline, e uma camada só roda se a anterior passou:

| Projeto          | O quê                                                               |
| ---------------- | ------------------------------------------------------------------- |
| `contract`       | Schema vivo × snapshot versionado (`contracts/*.snapshot.graphql`)  |
| `auth`           | Sessão admin criada pela Admin API e salva como `storageState`      |
| `reference-data` | País, zona, imposto, frete e pagamento, criados via API se faltarem |
| `api`            | Camada de volume, via `request` do Playwright                       |
| `ui`             | Funcional magra, com o Dashboard já autenticado pelo `storageState` |

- **Contrato tipado.** As operações da suíte ficam em `contracts/operations/` e os tipos são
  gerados a partir do snapshot (`npm run codegen`). Se o contrato muda, o teste que depende do
  campo afetado deixa de compilar.
- **Erro com HTTP 200.** As mutations do Vendure devolvem uniões (`Order | ErrorResult`). O
  cliente da suíte falha em qualquer `errors` e obriga cada teste a estreitar a união.
- **Massa via API, nunca pela UI.** Cada teste cria o que usa e desfaz ao final, em ordem
  inversa, mesmo se falhar. Pedidos ficam: o Vendure não os apaga, e nenhum teste depende de
  contagem global.
- **Perfis.** `guest` usa um contexto sem sessão. `customer` tem uma conta por worker paralelo,
  porque o carrinho ativo é estado da sessão. `admin` reaproveita a sessão salva pelo setup.

## Desenvolvimento

Requer Node 24 e Docker.

```sh
npm ci
npm run check                        # lint + formatação + typecheck

cp .env.example .env                 # preencha as senhas (qualquer valor local)
docker compose up -d --build --wait  # Vendure em http://localhost:3000
npx playwright install chromium
npm test                             # contrato → api → ui
```

Depois de uma mudança no Vendure, `npm run contract:snapshot` atualiza o snapshot e os tipos.
A mudança no snapshot é revisada como qualquer outra: é o contrato.

Endereços, consumo de memória e troubleshooting: [docs/ambiente.md](docs/ambiente.md).

## Relação com os outros repositórios

Este repositório publica dados normalizados em `quality-exports/`, consumidos pelo
[`quality-strategy-lab`](https://github.com/FabioNandes/quality-strategy-lab). Os IDs de
risco (`RSK-###`) pertencem àquele repositório; aqui eles são apenas referenciados.

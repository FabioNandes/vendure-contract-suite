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
- [x] Workflows de CI (lint + typecheck) e de publicação no GitHub Pages
- [ ] Ambiente Vendure com um comando, RAM medida
- [ ] Fatia vertical carrinho → pedido (contrato → API → banco → UI)
- [ ] Matriz de autenticação por `storageState` e sharding
- [ ] `quality-exports/` (`manifest.json`, `scenarios.json`)
- [ ] Relatório de cobertura de schema
- [ ] Portões visual e de acessibilidade

## Desenvolvimento

Requer Node 24.

```sh
npm ci
npm run check   # lint + formatação + typecheck
```

## Relação com os outros repositórios

Este repositório publica dados normalizados em `quality-exports/`, consumidos pelo
[`quality-strategy-lab`](https://github.com/FabioNandes/quality-strategy-lab). Os IDs de
risco (`RSK-###`) pertencem àquele repositório; aqui eles são apenas referenciados.

# Ambiente do sistema sob teste

O alvo é o **Vendure 3.8.0** sem customizações, em três contêineres:

| Serviço    | Imagem                                    | Papel                                             |
| ---------- | ----------------------------------------- | ------------------------------------------------- |
| `postgres` | `postgres:17-alpine`                      | Banco; exposto em `127.0.0.1:5432` para asserções |
| `server`   | `vendure-contract-suite/vendure:3.8.0`    | Shop API, Admin API, Dashboard, assets, mailbox   |
| `worker`   | mesma imagem, `node dist/index-worker.js` | Fila de jobs (busca, e-mail, coleções, sessões)   |

O código do alvo fica em [`app/`](../app). Ele saiu do template do `@vendure/create` 3.8.0, com
três mudanças: usa Postgres em vez de sqlite, lê as credenciais do ambiente e roda server e worker
a partir de uma única imagem. O alvo não tem plugins nem campos customizados, porque a suíte testa
o Vendure do jeito que ele é distribuído. `app/` fica fora do lint e do typecheck da suíte.

## Subir

```sh
cp .env.example .env              # preencha as três senhas (qualquer valor local)
docker compose up -d --build --wait
```

O `--wait` só retorna quando o Postgres e o server passam no healthcheck e o worker está rodando.
A ordem é garantida por `depends_on`. O server cria o schema do banco na inicialização
(`synchronize`) e só depois o worker sobe. O worker nunca altera o schema.

Os e-mails são gerados pelo worker, na fila `send-email`, e servidos pelo server em `/mailbox`.
Por isso os dois contêineres montam o mesmo volume, `mailbox`. Sem ele, o e-mail é gerado mas
nunca aparece para a suíte.

| Endereço                               | O quê                                     |
| -------------------------------------- | ----------------------------------------- |
| `http://localhost:3000/shop-api`       | Shop API (GraphQL)                        |
| `http://localhost:3000/admin-api`      | Admin API (GraphQL)                       |
| `http://localhost:3000/dashboard`      | Dashboard (React), login com o superadmin |
| `http://localhost:3000/graphiql/admin` | GraphiQL das duas APIs                    |
| `http://localhost:3000/mailbox`        | E-mails capturados (nenhum sai daqui)     |
| `http://localhost:3000/health`         | Healthcheck                               |

A interface administrativa do Vendure 3.8 é o Dashboard em React, servido em `/dashboard`. A
antiga Admin UI em Angular (`/admin`) não faz parte deste ambiente.

```sh
docker compose down      # para, mantém o banco
docker compose down -v   # para e descarta o banco: o próximo `up` começa vazio
```

## Consumo medido

Medição de 2026-10-17 no Docker Desktop 29.8.2 (WSL2, 16 CPUs e 9,6 GiB alocados para a VM), com
o banco **vazio** (só o superadmin, sem catálogo), usando `docker stats`:

| Serviço    | Ocioso, após o boot | Após 350 requisições GraphQL | Pico no boot a frio |
| ---------- | ------------------: | ---------------------------: | ------------------: |
| `server`   |             339 MiB |                      344 MiB |             355 MiB |
| `worker`   |             234 MiB |                      236 MiB |             234 MiB |
| `postgres` |              51 MiB |                       60 MiB |              72 MiB |
| **Total**  |         **624 MiB** |                  **640 MiB** |         **661 MiB** |

O plano previa cerca de 1,5 GB. O consumo real ficou em menos da metade disso.

**Medir de novo quando a massa de teste existir.** Com catálogo, índice de busca e a suíte rodando
em paralelo, o server e o Postgres crescem. Os números acima mostram o piso do ambiente, não o
consumo em uso.

| Tempo                                        | Medido |
| -------------------------------------------- | -----: |
| Build da imagem, sem cache                   |  147 s |
| `up --wait` com a imagem pronta, banco vazio |    9 s |

A imagem tem 1,34 GB. Quase todo esse tamanho vem das dependências de runtime do
`@vendure/core` e do `@vendure/dashboard`. Isso não afeta a RAM, mas pesa no tempo de CI.
Revisitar quando o ambiente entrar no pipeline (tarefa 1.2).

## Troubleshooting

**`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`**: o
Docker Desktop está fechado. Abra o aplicativo e espere o indicador ficar verde.

**`defina VENDURE_... no .env`**: o `.env` não existe ou falta alguma variável. O Compose
recusa subir sem as credenciais, e isso é proposital: nenhuma senha fica no repositório.

**Porta 3000 ou 5432 ocupada**: troque `POSTGRES_PORT` no `.env`. A porta 3000 é fixa porque as
URLs do `.env.example` dependem dela. Nunca suba este ambiente junto com o do `payments-async-lab`:
os dois usam o Postgres na 5432 e, somados, estouram o orçamento de memória do plano.

**Avisos `Insecure CORS configuration` e `Login CSRF is possible` no log do server**: esperados.
O ambiente roda com `APP_ENV=dev` e só escuta em `127.0.0.1`.

**`npm warn install-scripts ... not yet covered by allowScripts` no build**: aviso do npm 11
sobre scripts de instalação (`bcrypt`, `re2`, `esbuild`, `@apollo/protobufjs`). Os scripts rodam
e os módulos nativos carregam na imagem. Vai virar erro quando o npm passar a bloquear scripts
por padrão. Nesse momento, aprovar esses pacotes em `app/package.json`.

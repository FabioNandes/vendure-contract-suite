import { bootstrap } from '@vendure/core';
import { assertEnv, config } from './vendure-config';

assertEnv();

// O alvo é descartável e não tem campos customizados: o banco nasce vazio a cada
// `docker compose down -v`, então o server cria o schema a partir das entidades em vez de
// carregar migrations. Só o server sincroniza; o worker sobe depois dele (docker-compose.yml).
bootstrap({
  ...config,
  dbConnectionOptions: { ...config.dbConnectionOptions, synchronize: true },
}).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

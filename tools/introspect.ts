/**
 * Introspecciona as duas APIs do Vendure e grava o schema de cada uma em SDL.
 *
 *   npm run contract:snapshot      # atualiza contracts/*.snapshot.graphql e os tipos gerados
 *
 * O snapshot é o contrato versionado: a camada de contrato compara o schema vivo com ele, e o
 * codegen gera os tipos da suíte a partir dele (não do servidor) para que o typecheck rode sem
 * ambiente. Atualizar o snapshot é uma decisão revisada em PR, nunca um passo automático do CI.
 */
import { writeFile } from 'node:fs/promises';
import {
  buildClientSchema,
  getIntrospectionQuery,
  lexicographicSortSchema,
  printSchema,
  type GraphQLSchema,
  type IntrospectionQuery,
} from 'graphql';
import { requireEnv } from './env.ts';

export const APIS = {
  shop: 'VENDURE_SHOP_API_URL',
  admin: 'VENDURE_ADMIN_API_URL',
} as const;

export type ApiName = keyof typeof APIS;

export function snapshotPath(api: ApiName): URL {
  return new URL(`../contracts/${api}.snapshot.graphql`, import.meta.url);
}

export async function fetchLiveSchema(api: ApiName): Promise<GraphQLSchema> {
  const response = await fetch(requireEnv(APIS[api]), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });
  const body = (await response.json()) as { data?: IntrospectionQuery; errors?: unknown[] };
  if (!response.ok || body.data === undefined || body.errors !== undefined) {
    throw new Error(
      `Introspecção da API ${api} falhou (HTTP ${String(response.status)}): ` +
        JSON.stringify(body.errors ?? body),
    );
  }
  // Ordem lexicográfica: o diff do snapshot mostra mudança de contrato, não reordenação.
  return lexicographicSortSchema(buildClientSchema(body.data));
}

async function main(): Promise<void> {
  for (const api of Object.keys(APIS) as ApiName[]) {
    const sdl = printSchema(await fetchLiveSchema(api));
    await writeFile(snapshotPath(api), `${sdl}\n`);
    console.log(`contracts/${api}.snapshot.graphql: ${String(sdl.split('\n').length)} linhas`);
  }
}

if (import.meta.main) {
  await main();
}

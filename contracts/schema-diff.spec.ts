import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { buildSchema, findBreakingChanges, findDangerousChanges, printSchema } from 'graphql';
import { APIS, fetchLiveSchema, snapshotPath, type ApiName } from '../tools/introspect.ts';

/*
 * Camada 0 — contrato. O schema vivo é comparado com o snapshot versionado:
 *
 *   quebra (campo removido, tipo alterado, nullable → non-null, argumento obrigatório novo)
 *     → falha: um consumidor escrito contra o snapshot deixaria de funcionar;
 *   mudança perigosa (valor de enum novo, default alterado) → anotação no relatório;
 *   adição compatível → anotação pedindo `npm run contract:snapshot`.
 */
for (const api of Object.keys(APIS) as ApiName[]) {
  test(`${api} API: o schema vivo não quebra o contrato versionado`, async () => {
    const snapshot = buildSchema(await readFile(snapshotPath(api), 'utf8'));
    const live = await fetchLiveSchema(api);

    const dangerous = findDangerousChanges(snapshot, live);
    for (const change of dangerous) {
      test.info().annotations.push({ type: 'mudança perigosa', description: change.description });
    }
    if (printSchema(live) !== printSchema(snapshot) && dangerous.length === 0) {
      test.info().annotations.push({
        type: 'snapshot desatualizado',
        description: 'O schema vivo tem adições compatíveis. Rode `npm run contract:snapshot`.',
      });
    }

    const breaking = findBreakingChanges(snapshot, live).map((c) => `${c.type}: ${c.description}`);
    expect(breaking, `mudanças que quebram consumidores da ${api} API`).toEqual([]);
  });
}

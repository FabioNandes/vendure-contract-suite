import { mkdir } from 'node:fs/promises';
import { test as base, type APIRequestContext } from '@playwright/test';
import type pg from 'pg';
import {
  ActiveOrderDocument,
  RemoveAllOrderLinesDocument,
  ShopLoginDocument,
  TransitionOrderToStateDocument,
} from '../contracts/generated/shop.ts';
import { Cleanup } from './cleanup.ts';
import { createPool } from './db.ts';
import { ADMIN_STATE, STATES_DIR, env } from './env.ts';
import { CatalogFactory } from './factories/catalog.ts';
import { createCustomer, type CreatedCustomer } from './factories/customer.ts';
import { GraphQLClient, narrow } from './graphql.ts';

/*
 * Matriz de autenticação (docs-planejamento/01, seção 4). Nenhum perfil faz login pela UI:
 *
 *   guest     contexto novo, sem sessão                        → shopApi
 *   customer  conta criada pela Admin API, login pela Shop API → customerShop
 *   admin     sessão salva pelo projeto `auth` (auth/setup.ts) → adminApi e o `page` da UI
 *
 * O customer tem uma conta por worker, não uma única para a suíte: o carrinho ativo é estado da
 * sessão, e dois testes em paralelo com o mesmo cliente disputariam o mesmo carrinho.
 */

export interface CustomerSession {
  customer: CreatedCustomer;
  shop: GraphQLClient;
}

interface TestFixtures {
  /** Contexto admin e a limpeza que depende dele: a limpeza roda antes do contexto fechar. */
  adminSession: { api: GraphQLClient; cleanup: Cleanup };
  /** Desfaz, em ordem inversa, tudo o que as factories criaram no teste. */
  cleanup: Cleanup;
  adminApi: GraphQLClient;
  shopApi: GraphQLClient;
  customerShop: CustomerSession;
  catalog: CatalogFactory;
}

interface WorkerFixtures {
  db: pg.Pool;
  customerAccount: { customer: CreatedCustomer; statePath: string };
}

/** Garante que o carrinho da sessão está vazio e editável antes do teste. */
async function resetActiveOrder(shop: GraphQLClient): Promise<void> {
  const { activeOrder } = await shop.execute(ActiveOrderDocument);
  if (activeOrder === null) return;
  if (activeOrder.state !== 'AddingItems') {
    await shop.execute(TransitionOrderToStateDocument, { state: 'AddingItems' });
  }
  if (activeOrder.lines.length > 0) {
    narrow((await shop.execute(RemoveAllOrderLinesDocument)).removeAllOrderLines, 'Order');
  }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  adminSession: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ storageState: ADMIN_STATE });
    const cleanup = new Cleanup();
    await use({ api: new GraphQLClient(context, env.adminApiUrl), cleanup });
    await cleanup.run();
    await context.dispose();
  },

  adminApi: async ({ adminSession }, use) => {
    await use(adminSession.api);
  },

  cleanup: async ({ adminSession }, use) => {
    await use(adminSession.cleanup);
  },

  shopApi: async ({ playwright }, use) => {
    // Sessão vazia explícita: sem ela o contexto herda o storageState do projeto, e no projeto
    // `ui` o "convidado" sairia logado como admin.
    const context: APIRequestContext = await playwright.request.newContext({
      storageState: { cookies: [], origins: [] },
    });
    await use(new GraphQLClient(context, env.shopApiUrl));
    await context.dispose();
  },

  catalog: async ({ adminApi, cleanup }, use) => {
    await use(new CatalogFactory(adminApi, cleanup));
  },

  customerShop: async ({ playwright, customerAccount }, use) => {
    const context = await playwright.request.newContext({
      storageState: customerAccount.statePath,
    });
    const shop = new GraphQLClient(context, env.shopApiUrl);
    await resetActiveOrder(shop);
    await use({ customer: customerAccount.customer, shop });
    await context.dispose();
  },

  customerAccount: [
    async ({ playwright }, use, workerInfo) => {
      const adminContext = await playwright.request.newContext({ storageState: ADMIN_STATE });
      const admin = new GraphQLClient(adminContext, env.adminApiUrl);
      const cleanup = new Cleanup();
      const customer = await createCustomer(
        admin,
        cleanup,
        `cliente-w${String(workerInfo.parallelIndex)}`,
      );

      const shopContext = await playwright.request.newContext({
        storageState: { cookies: [], origins: [] },
      });
      const shop = new GraphQLClient(shopContext, env.shopApiUrl);
      narrow(
        (
          await shop.execute(ShopLoginDocument, {
            username: customer.emailAddress,
            password: customer.password,
          })
        ).login,
        'CurrentUser',
      );
      await mkdir(STATES_DIR, { recursive: true });
      const statePath = `${STATES_DIR}/customer-${String(workerInfo.parallelIndex)}.json`;
      await shopContext.storageState({ path: statePath });
      await shopContext.dispose();

      await use({ customer, statePath });

      await cleanup.run();
      await adminContext.dispose();
    },
    { scope: 'worker' },
  ],

  db: [
    async ({}, use) => {
      const pool = createPool();
      await use(pool);
      await pool.end();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';

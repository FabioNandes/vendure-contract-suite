import { mkdir } from 'node:fs/promises';
import { test as setup } from '@playwright/test';
import { AdminLoginDocument } from '../contracts/generated/admin.ts';
import { ADMIN_STATE, STATES_DIR, env } from '../fixtures/env.ts';
import { GraphQLClient, narrow } from '../fixtures/graphql.ts';

/*
 * Sessão do perfil admin, criada uma vez por execução pela Admin API e salva como storageState.
 * A mesma sessão (cookie) serve à Admin API e ao Dashboard: a UI abre já autenticada, sem login
 * pela interface.
 */
setup('admin: sessão criada pela Admin API', async ({ playwright }) => {
  const context = await playwright.request.newContext();
  const admin = new GraphQLClient(context, env.adminApiUrl);
  narrow((await admin.execute(AdminLoginDocument, env.superadmin)).login, 'CurrentUser');
  await mkdir(STATES_DIR, { recursive: true });
  await context.storageState({ path: ADMIN_STATE });
  await context.dispose();
});

import { test as setup } from '@playwright/test';
import { ADMIN_STATE, env } from './env.ts';
import { ensureReferenceData } from './factories/reference-data.ts';
import { GraphQLClient } from './graphql.ts';

setup('dados de referência do checkout', async ({ playwright }) => {
  const context = await playwright.request.newContext({ storageState: ADMIN_STATE });
  await ensureReferenceData(new GraphQLClient(context, env.adminApiUrl));
  await context.dispose();
});

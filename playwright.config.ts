import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STATE, env } from './fixtures/env.ts';

try {
  process.loadEnvFile('.env');
} catch {
  // Sem .env: as variáveis vêm do ambiente do processo.
}

const CI = Boolean(process.env['CI']);

/*
 * Os projetos seguem a ordem do pipeline do plano: contrato → api → ui. Uma camada só roda se a
 * anterior passou — não faz sentido testar a UI contra um contrato quebrado.
 *
 *   contract        schema vivo × snapshot, sem sessão e sem massa
 *   auth            sessão admin salva em storageState (matriz de autenticação)
 *   reference-data  país, zona, imposto, frete e pagamento, criados via API se faltarem
 *   api             camada de volume, via request do Playwright
 *   ui              funcional magra, com a sessão admin já aberta
 */
export default defineConfig({
  forbidOnly: CI,
  // Sem retry: teste instável aparece como falha, não como "flaky" que passou na segunda.
  retries: 0,
  fullyParallel: true,
  ...(CI ? { workers: 2 } : {}),
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    // Fonte do quality-exports/scenarios.json (tools/export-scenarios.ts).
    ['json', { outputFile: 'reports/playwright-results.json' }],
  ],
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'contract', testMatch: 'contracts/**/*.spec.ts' },
    { name: 'auth', testMatch: 'auth/setup.ts' },
    {
      name: 'reference-data',
      testMatch: 'fixtures/reference-data.setup.ts',
      dependencies: ['auth'],
    },
    {
      name: 'api',
      testMatch: 'api/**/*.spec.ts',
      dependencies: ['contract', 'reference-data'],
    },
    {
      name: 'ui',
      testMatch: 'ui/functional/**/*.spec.ts',
      dependencies: ['api'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: env.serverOrigin,
        storageState: ADMIN_STATE,
      },
    },
  ],
});

// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const NO_SLEEP =
  'Proibido espera fixa. Use polling com timeout (expect.poll ou o helper único de poll).';

export default defineConfig(
  {
    // app/ é o sistema sob teste: tem dependências e tsconfig próprios e roda só no contêiner.
    ignores: [
      'node_modules/',
      'dist/',
      'playwright-report/',
      'test-results/',
      'blob-report/',
      'app/',
      // Tipos gerados pelo codegen a partir do snapshot.
      'contracts/generated/',
      'reports/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Regra do portfólio: zero `sleep` fixo. O único ponto autorizado a esperar
    // é o helper de polling, com eslint-disable explícito e justificado.
    rules: {
      'no-restricted-globals': ['error', { name: 'setTimeout', message: NO_SLEEP }],
      'no-restricted-properties': ['error', { property: 'waitForTimeout', message: NO_SLEEP }],
      'no-restricted-imports': ['error', { name: 'node:timers/promises', message: NO_SLEEP }],
    },
  },
  {
    // Fixtures do Playwright sem dependência são declaradas como `async ({}, use) => ...`:
    // o Playwright lê a desestruturação do primeiro parâmetro para resolver dependências.
    rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
  },
  { files: ['**/*.{js,mjs,cjs}'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);

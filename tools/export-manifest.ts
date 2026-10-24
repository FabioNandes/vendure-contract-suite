/**
 * quality-exports/manifest.json — cabeçalho do contrato de dado com o quality-strategy-lab.
 *
 * O `schemaVersion` é o que permite ao repo 3 falhar com mensagem clara, em vez de gerar um
 * relatório silenciosamente errado, quando o formato dos exports mudar.
 */
import { execFileSync } from 'node:child_process';
import { access, writeFile } from 'node:fs/promises';
import { SCHEMA_VERSION } from './export-scenarios.ts';

const REPO = 'vendure-contract-suite';
const REPORT_URL = 'https://fabionandes.github.io/vendure-contract-suite/';

/** Exports que este repo sabe produzir, na ordem do plano. Só entram os que existem em disco. */
const KNOWN_EXPORTS = ['scenarios', 'schema-coverage', 'a11y-report'] as const;

function commit(): string {
  const sha = process.env['GITHUB_SHA'];
  if (sha !== undefined && sha !== '') return sha.slice(0, 7);
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
}

function runUrl(): string | null {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  if (GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID) {
    return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  }
  // Execução local: não há run a apontar.
  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const exportsPresent: string[] = [];
  for (const name of KNOWN_EXPORTS) {
    if (await exists(`quality-exports/${name}.json`)) exportsPresent.push(name);
  }
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    repo: REPO,
    generatedAt: new Date().toISOString(),
    commit: commit(),
    runUrl: runUrl(),
    reportUrl: REPORT_URL,
    exports: exportsPresent,
  };
  await writeFile('quality-exports/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`quality-exports/manifest.json: ${exportsPresent.join(', ')}`);
}

if (import.meta.main) {
  await main();
}

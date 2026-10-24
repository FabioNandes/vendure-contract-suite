/**
 * reports/playwright-results.json → quality-exports/scenarios.json
 *
 * Contrato de dado com o quality-strategy-lab (docs-planejamento/00, seção 5.1). O repo 3 nunca
 * lê testes daqui: lê este arquivo. Por isso a convenção de tags é interpretada aqui — se o
 * prefixo de `RSK-` ou `F-` mudar, muda só neste arquivo.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export const SCHEMA_VERSION = 1;

/** Projetos de infraestrutura (sessão, dados de referência): não são cenários de teste. */
const SETUP_PROJECTS = new Set(['auth', 'reference-data']);

export type ScenarioStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface Scenario {
  id: string;
  title: string;
  tags: string[];
  riskIds: string[];
  faultIds: string[];
  layer: string;
  status: ScenarioStatus;
  durationMs: number;
}

interface JsonResult {
  duration: number;
}
interface JsonTest {
  projectName: string;
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: JsonResult[];
}
interface JsonSpec {
  title: string;
  file: string;
  line: number;
  tags: string[];
  tests: JsonTest[];
}
interface JsonSuite {
  title: string;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
interface JsonReport {
  suites: JsonSuite[];
}

const STATUS: Record<JsonTest['status'], ScenarioStatus> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
};

export function extractRiskIds(tags: readonly string[]): string[] {
  return tags.filter((t) => /^RSK-\d+$/.test(t));
}

export function extractFaultIds(tags: readonly string[]): string[] {
  return tags.filter((t) => /^F-\d+$/.test(t));
}

function* walk(
  suite: JsonSuite,
  titles: string[],
): Generator<{ spec: JsonSpec; titles: string[] }> {
  for (const spec of suite.specs ?? []) yield { spec, titles };
  for (const child of suite.suites ?? []) yield* walk(child, [...titles, child.title]);
}

export function toScenarios(report: JsonReport): Scenario[] {
  const scenarios: Scenario[] = [];
  for (const root of report.suites) {
    for (const { spec, titles } of walk(root, [])) {
      for (const test of spec.tests) {
        if (SETUP_PROJECTS.has(test.projectName)) continue;
        const tags = spec.tags.map((t) => t.replace(/^@/, ''));
        scenarios.push({
          id: `${spec.file}:${String(spec.line)}`,
          title: [...titles, spec.title].join(' › '),
          tags,
          riskIds: extractRiskIds(tags),
          faultIds: extractFaultIds(tags),
          layer: test.projectName,
          status: STATUS[test.status],
          durationMs: test.results.reduce((total, r) => total + r.duration, 0),
        });
      }
    }
  }
  return disambiguate(scenarios).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * O id é `arquivo:linha`. Testes gerados num laço (ex.: um por API) compartilham a linha; só
 * nesse caso o título entra no id, para que ele continue sendo chave única no repo 3.
 */
function disambiguate(scenarios: Scenario[]): Scenario[] {
  const count = new Map<string, number>();
  for (const s of scenarios) count.set(s.id, (count.get(s.id) ?? 0) + 1);
  return scenarios.map((s) =>
    (count.get(s.id) ?? 0) > 1 ? { ...s, id: `${s.id} ${s.title}` } : s,
  );
}

async function main(): Promise<void> {
  const report = JSON.parse(
    await readFile('reports/playwright-results.json', 'utf8'),
  ) as JsonReport;
  const scenarios = toScenarios(report);
  await mkdir('quality-exports', { recursive: true });
  await writeFile(
    'quality-exports/scenarios.json',
    `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, scenarios }, null, 2)}\n`,
  );
  console.log(`quality-exports/scenarios.json: ${String(scenarios.length)} cenários`);
}

if (import.meta.main) {
  await main();
}

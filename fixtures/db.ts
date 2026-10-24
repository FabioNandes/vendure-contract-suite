import pg from 'pg';
import { env } from './env.ts';

/**
 * Acesso direto ao Postgres do Vendure, só para leitura: asserções sobre o que a API não expõe
 * (movimentação de estoque, estado persistido do pagamento). A massa nunca é criada por aqui.
 */
export function createPool(): pg.Pool {
  return new pg.Pool({ ...env.database, max: 2 });
}

export async function queryRows<TRow extends pg.QueryResultRow>(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<TRow[]> {
  const result = await pool.query<TRow>(sql, params);
  return result.rows;
}

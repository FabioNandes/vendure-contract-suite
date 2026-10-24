import { requireEnv } from '../tools/env.ts';

/** Endereços e credenciais lidos do `.env` (ver `.env.example`). */
export const env = {
  get shopApiUrl(): string {
    return requireEnv('VENDURE_SHOP_API_URL');
  },
  get adminApiUrl(): string {
    return requireEnv('VENDURE_ADMIN_API_URL');
  },
  /** Origem do servidor (http://localhost:3000), derivada da URL da Shop API. */
  get serverOrigin(): string {
    return new URL(requireEnv('VENDURE_SHOP_API_URL')).origin;
  },
  get superadmin(): { username: string; password: string } {
    return {
      username: requireEnv('VENDURE_SUPERADMIN_USERNAME'),
      password: requireEnv('VENDURE_SUPERADMIN_PASSWORD'),
    };
  },
  get database(): {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  } {
    return {
      host: process.env['POSTGRES_HOST'] ?? 'localhost',
      port: Number(process.env['POSTGRES_PORT'] ?? '5432'),
      database: requireEnv('POSTGRES_DB'),
      user: requireEnv('POSTGRES_USER'),
      password: requireEnv('POSTGRES_PASSWORD'),
    };
  },
};

/** Onde cada perfil da matriz de autenticação guarda a sessão (gitignored). */
export const STATES_DIR = 'auth/.states';
export const ADMIN_STATE = `${STATES_DIR}/admin.json`;

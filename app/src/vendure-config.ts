import {
  dummyPaymentHandler,
  DefaultJobQueuePlugin,
  DefaultSchedulerPlugin,
  DefaultSearchPlugin,
  VendureConfig,
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import path from 'path';

/*
 * Sistema sob teste. Derivado do template do `@vendure/create` 3.8.0, com três mudanças:
 * Postgres no lugar de sqlite, credenciais lidas do ambiente (docker-compose.yml) e nenhum
 * plugin ou campo customizado — a suíte testa o Vendure como ele é distribuído.
 */

const REQUIRED_ENV = [
  'COOKIE_SECRET',
  'SUPERADMIN_USERNAME',
  'SUPERADMIN_PASSWORD',
  'DB_HOST',
  'DB_NAME',
  'DB_USERNAME',
  'DB_PASSWORD',
] as const;

/**
 * Chamado em index.ts e index-worker.ts, e não no carregamento deste arquivo: o build do
 * dashboard importa esta configuração sem ter o ambiente de execução.
 */
export function assertEnv(): void {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  }
}

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +process.env.VENDURE_SERVER_PORT || 3000;

export const config: VendureConfig = {
  apiOptions: {
    port: serverPort,
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
    trustProxy: IS_DEV ? false : 1,
    cors: {
      origin: IS_DEV
        ? true
        : (process.env.CORS_ORIGINS?.split(',')
            .map((o) => o.trim())
            .filter(Boolean) ?? []),
      credentials: true,
    },
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
    superadminCredentials: {
      identifier: process.env.SUPERADMIN_USERNAME,
      password: process.env.SUPERADMIN_PASSWORD,
    },
    cookieOptions: {
      secret: process.env.COOKIE_SECRET,
    },
  },
  dbConnectionOptions: {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    // O schema é criado pelo server na inicialização (ver index.ts); o worker nunca o altera.
    synchronize: false,
    logging: false,
  },
  paymentOptions: {
    paymentMethodHandlers: [dummyPaymentHandler],
  },
  customFields: {},
  plugins: [
    GraphiqlPlugin.init(),
    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: path.join(__dirname, '../static/assets'),
    }),
    DefaultSchedulerPlugin.init(),
    DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
    DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
    EmailPlugin.init({
      // Modo dev: nenhum e-mail sai do contêiner. As mensagens ficam em /mailbox, onde a
      // suíte pode inspecioná-las.
      devMode: true,
      outputPath: path.join(__dirname, '../static/email/test-emails'),
      route: 'mailbox',
      handlers: defaultEmailHandlers,
      templateLoader: new FileBasedTemplateLoader(
        path.join(__dirname, '../static/email/templates'),
      ),
      globalTemplateVars: {
        fromAddress: '"vendure-contract-suite" <noreply@example.com>',
        verifyEmailAddressUrl: 'http://localhost:3001/verify',
        passwordResetUrl: 'http://localhost:3001/reset-password',
        changeEmailAddressUrl: 'http://localhost:3001/account/verify-email',
        adminPasswordResetUrl: `http://localhost:${serverPort}/dashboard/reset-password`,
      },
    }),
    DashboardPlugin.init({
      route: 'dashboard',
      appDir: path.join(__dirname, 'dashboard'),
    }),
  ],
};

import type { APIRequestContext } from '@playwright/test';
import { env } from './env.ts';

/**
 * E-mails capturados pelo EmailPlugin em modo dev (`/mailbox`). Quem gera o e-mail é o worker,
 * pela fila `send-email`: a chegada aqui é a evidência de que o processamento assíncrono
 * aconteceu. Ler sempre com `expect.poll`, nunca com espera fixa.
 */
export interface MailboxEntry {
  fileName: string;
  date: string;
  subject: string;
  recipient: string;
}

export async function listMailbox(request: APIRequestContext): Promise<MailboxEntry[]> {
  const response = await request.get(`${env.serverOrigin}/mailbox/list`);
  if (!response.ok()) {
    throw new Error(`/mailbox/list respondeu ${String(response.status())}`);
  }
  return (await response.json()) as MailboxEntry[];
}

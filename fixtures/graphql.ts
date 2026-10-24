import type { APIRequestContext } from '@playwright/test';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { getOperationAST, print, type GraphQLFormattedError } from 'graphql';

export interface GraphQLResponse<TData> {
  status: number;
  data: TData | null | undefined;
  errors: readonly GraphQLFormattedError[] | undefined;
}

const printed = new WeakMap<object, string>();

function printDocument(document: TypedDocumentNode<unknown, never>): string {
  let text = printed.get(document);
  if (text === undefined) {
    text = print(document);
    printed.set(document, text);
  }
  return text;
}

function operationName(document: TypedDocumentNode<unknown, never>): string {
  return getOperationAST(document)?.name?.value ?? 'operação anônima';
}

/**
 * Cliente GraphQL sobre o `request` do Playwright. A sessão (cookie) é a do contexto recebido:
 * o perfil — guest, customer ou admin — é decidido por quem cria o contexto, não aqui.
 */
export class GraphQLClient {
  readonly #request: APIRequestContext;
  readonly #endpoint: string;

  constructor(request: APIRequestContext, endpoint: string) {
    this.#request = request;
    this.#endpoint = endpoint;
  }

  /**
   * Resposta crua: status HTTP, `data` e `errors` como vieram. Para os testes que assertam a
   * semântica de erro do GraphQL — erro com HTTP 200, resposta parcial.
   */
  async raw<TData, TVariables>(
    document: TypedDocumentNode<TData, TVariables>,
    variables?: TVariables,
  ): Promise<GraphQLResponse<TData>> {
    const response = await this.#request.post(this.#endpoint, {
      data: { query: printDocument(document), variables: variables ?? {} },
    });
    const body = (await response.json()) as {
      data?: TData | null;
      errors?: GraphQLFormattedError[];
    };
    return { status: response.status(), data: body.data, errors: body.errors };
  }

  /**
   * Executa e devolve `data`, falhando se houver qualquer `errors` — mesmo com HTTP 200.
   * Erros de negócio do Vendure chegam em `data` como `ErrorResult` e são tratados com `narrow`.
   */
  async execute<TData, TVariables>(
    document: TypedDocumentNode<TData, TVariables>,
    variables?: TVariables,
  ): Promise<TData> {
    const { status, data, errors } = await this.raw(document, variables);
    if (status !== 200 || errors !== undefined || data === null || data === undefined) {
      throw new Error(
        `${operationName(document)} falhou (HTTP ${String(status)}): ` +
          JSON.stringify(errors ?? data),
      );
    }
    return data;
  }
}

type Typed = { __typename: string };

/**
 * Estreita uma união do Vendure (ex.: `Order | InsufficientStockError`) para o tipo esperado.
 * Se vier outro membro, a mensagem traz o `errorCode` e a `message` do erro de negócio.
 */
export function narrow<T extends Typed, K extends T['__typename']>(
  value: T,
  typename: K,
): Extract<T, { __typename: K }> {
  if (value.__typename !== typename) {
    throw new Error(`Esperado ${typename}, veio ${value.__typename}: ${JSON.stringify(value)}`);
  }
  return value as Extract<T, { __typename: K }>;
}

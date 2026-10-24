import type { CodegenConfig } from '@graphql-codegen/cli';

/*
 * Tipos da suíte gerados a partir dos snapshots versionados, não do servidor vivo: o typecheck
 * roda sem ambiente, e uma mudança de contrato aparece como erro de compilação no teste que
 * depende do campo afetado.
 *
 *   npm run codegen
 */

const output = {
  plugins: ['typescript-operations', 'typed-document-node'],
  // O typescript-operations gera só os tipos que as operações usam (inputs e enums incluídos);
  // o schema completo fica no snapshot.
  config: {
    // Uniões de string em vez de `enum`: a suíte roda com `erasableSyntaxOnly`.
    enumsAsTypes: true,
    useTypeImports: true,
    scalars: {
      DateTime: 'string',
      JSON: 'unknown',
      Money: 'number',
      Upload: 'unknown',
    },
  },
};

const config: CodegenConfig = {
  overwrite: true,
  generates: {
    'contracts/generated/shop.ts': {
      schema: 'contracts/shop.snapshot.graphql',
      documents: 'contracts/operations/shop/*.graphql',
      ...output,
    },
    'contracts/generated/admin.ts': {
      schema: 'contracts/admin.snapshot.graphql',
      documents: 'contracts/operations/admin/*.graphql',
      ...output,
    },
  },
};

export default config;

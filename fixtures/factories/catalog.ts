import { randomUUID } from 'node:crypto';
import {
  CreateProductDocument,
  CreateProductVariantsDocument,
  DeleteProductDocument,
} from '../../contracts/generated/admin.ts';
import type { Cleanup } from '../cleanup.ts';
import type { GraphQLClient } from '../graphql.ts';

export interface ProductOptions {
  /** Preço unitário em centavos, sem imposto. */
  priceCents?: number;
  stockOnHand?: number;
}

export interface CreatedProduct {
  productId: string;
  variantId: string;
  sku: string;
  priceCents: number;
  /** Preço unitário com imposto, como o Vendure calcula (arredondado por unidade). */
  priceWithTaxCents: number;
}

/** Sufixo único por chamada: testes paralelos nunca disputam slug ou SKU. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export class CatalogFactory {
  readonly #admin: GraphQLClient;
  readonly #cleanup: Cleanup;

  constructor(admin: GraphQLClient, cleanup: Cleanup) {
    this.#admin = admin;
    this.#cleanup = cleanup;
  }

  /** Produto com uma variante, estoque rastreado e preço na moeda padrão do canal. */
  async product({
    priceCents = 1990,
    stockOnHand = 100,
  }: ProductOptions = {}): Promise<CreatedProduct> {
    const suffix = uniqueSuffix();
    const { createProduct } = await this.#admin.execute(CreateProductDocument, {
      input: {
        enabled: true,
        translations: [
          {
            languageCode: 'en',
            name: `Produto de teste ${suffix}`,
            slug: `produto-teste-${suffix}`,
            description: 'Criado pela fábrica de massa da suíte.',
          },
        ],
      },
    });
    this.#cleanup.add(`produto ${createProduct.id}`, async () => {
      await this.#admin.execute(DeleteProductDocument, { id: createProduct.id });
    });

    const { createProductVariants } = await this.#admin.execute(CreateProductVariantsDocument, {
      input: [
        {
          productId: createProduct.id,
          sku: `SKU-${suffix}`,
          price: priceCents,
          stockOnHand,
          trackInventory: 'TRUE',
          translations: [{ languageCode: 'en', name: `Variante ${suffix}` }],
        },
      ],
    });
    const variant = createProductVariants[0];
    if (variant === null || variant === undefined) {
      throw new Error(
        `createProductVariants não devolveu a variante do produto ${createProduct.id}`,
      );
    }
    return {
      productId: createProduct.id,
      variantId: variant.id,
      sku: variant.sku,
      priceCents: variant.price,
      priceWithTaxCents: variant.priceWithTax,
    };
  }
}

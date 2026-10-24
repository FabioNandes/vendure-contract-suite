import {
  CreateCountryDocument,
  CreatePaymentMethodDocument,
  CreateShippingMethodDocument,
  CreateTaxCategoryDocument,
  CreateTaxRateDocument,
  CreateZoneDocument,
  ReferenceDataStateDocument,
  SetChannelDefaultZonesDocument,
} from '../../contracts/generated/admin.ts';
import { narrow, type GraphQLClient } from '../graphql.ts';

/**
 * O que o checkout exige e um Vendure recém-criado não tem: país, zona padrão de imposto e de
 * frete, alíquota, método de entrega e meio de pagamento. Os valores são fixos e conhecidos
 * pelos testes, que calculam o total esperado a partir deles.
 */
export const REFERENCE = {
  currency: 'BRL',
  countryCode: 'BR',
  zoneName: 'Brasil',
  taxCategoryName: 'Padrão',
  taxRateName: 'Brasil — alíquota padrão',
  taxRatePercent: 10,
  shippingMethodCode: 'entrega-padrao',
  /** Frete fixo, em centavos, sem imposto. */
  shippingCents: 500,
  /** Meio de pagamento de teste do Vendure (`dummy-payment-handler`) com liquidação automática. */
  paymentMethodCode: 'pagamento-teste',
} as const;

/**
 * Garante os dados de referência, criando só o que falta. Idempotente: roda no setup de toda
 * execução, contra um banco novo ou já usado. Não há limpeza — é configuração do ambiente, não
 * massa de um teste; o banco inteiro é descartado com `docker compose down -v`.
 */
export async function ensureReferenceData(admin: GraphQLClient): Promise<void> {
  const state = await admin.execute(ReferenceDataStateDocument, {
    countryCode: REFERENCE.countryCode,
    zoneName: REFERENCE.zoneName,
    taxCategoryName: REFERENCE.taxCategoryName,
    taxRateName: REFERENCE.taxRateName,
    shippingMethodCode: REFERENCE.shippingMethodCode,
    paymentMethodCode: REFERENCE.paymentMethodCode,
  });

  const countryId =
    state.countries.items[0]?.id ??
    (
      await admin.execute(CreateCountryDocument, {
        input: {
          code: REFERENCE.countryCode,
          enabled: true,
          translations: [{ languageCode: 'en', name: 'Brasil' }],
        },
      })
    ).createCountry.id;

  const zoneId =
    state.zones.items[0]?.id ??
    (
      await admin.execute(CreateZoneDocument, {
        input: { name: REFERENCE.zoneName, memberIds: [countryId] },
      })
    ).createZone.id;

  const channel = state.activeChannel;
  if (
    channel.defaultTaxZone?.id !== zoneId ||
    channel.defaultShippingZone?.id !== zoneId ||
    channel.defaultCurrencyCode !== REFERENCE.currency
  ) {
    const { updateChannel } = await admin.execute(SetChannelDefaultZonesDocument, {
      input: {
        id: channel.id,
        defaultTaxZoneId: zoneId,
        defaultShippingZoneId: zoneId,
        availableCurrencyCodes: [REFERENCE.currency],
        defaultCurrencyCode: REFERENCE.currency,
      },
    });
    narrow(updateChannel, 'Channel');
  }

  const taxCategoryId =
    state.taxCategories.items[0]?.id ??
    (
      await admin.execute(CreateTaxCategoryDocument, {
        input: { name: REFERENCE.taxCategoryName, isDefault: true },
      })
    ).createTaxCategory.id;

  if (state.taxRates.items.length === 0) {
    await admin.execute(CreateTaxRateDocument, {
      input: {
        name: REFERENCE.taxRateName,
        enabled: true,
        value: REFERENCE.taxRatePercent,
        categoryId: taxCategoryId,
        zoneId,
      },
    });
  }

  if (state.shippingMethods.items.length === 0) {
    await admin.execute(CreateShippingMethodDocument, {
      input: {
        code: REFERENCE.shippingMethodCode,
        fulfillmentHandler: 'manual-fulfillment',
        checker: {
          code: 'default-shipping-eligibility-checker',
          arguments: [{ name: 'orderMinimum', value: '0' }],
        },
        calculator: {
          code: 'default-shipping-calculator',
          arguments: [
            { name: 'rate', value: String(REFERENCE.shippingCents) },
            { name: 'includesTax', value: 'exclude' },
            { name: 'taxRate', value: '0' },
          ],
        },
        translations: [{ languageCode: 'en', name: 'Entrega padrão', description: '' }],
      },
    });
  }

  if (state.paymentMethods.items.length === 0) {
    await admin.execute(CreatePaymentMethodDocument, {
      input: {
        code: REFERENCE.paymentMethodCode,
        enabled: true,
        handler: {
          code: 'dummy-payment-handler',
          arguments: [{ name: 'automaticSettle', value: 'true' }],
        },
        translations: [{ languageCode: 'en', name: 'Pagamento de teste' }],
      },
    });
  }
}

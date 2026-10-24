import {
  AddItemToOrderDocument,
  AddPaymentToOrderDocument,
  EligibleShippingMethodsDocument,
  SetCustomerForOrderDocument,
  SetOrderShippingAddressDocument,
  SetOrderShippingMethodDocument,
  TransitionOrderToStateDocument,
} from '../../contracts/generated/shop.ts';
import { narrow, type GraphQLClient } from '../graphql.ts';
import { uniqueSuffix, type CreatedProduct } from './catalog.ts';
import { REFERENCE } from './reference-data.ts';

export const SHIPPING_ADDRESS = {
  fullName: 'Cliente Teste',
  streetLine1: 'Av. Paulista, 1000',
  city: 'São Paulo',
  province: 'SP',
  postalCode: '01310-100',
  countryCode: REFERENCE.countryCode,
} as const;

export interface PlacedOrder {
  id: string;
  code: string;
  state: string;
  totalWithTax: number;
  emailAddress: string;
}

/**
 * Pedido pago de um cliente convidado, para os testes que precisam de um pedido existente e não
 * testam o checkout em si. A jornada passo a passo, com asserções em cada etapa, está em
 * api/shop/checkout.spec.ts.
 *
 * `shop` precisa ser um contexto novo (sem sessão): o pedido fica preso ao cookie dele.
 */
export async function placeGuestOrder(
  shop: GraphQLClient,
  product: CreatedProduct,
  quantity = 1,
): Promise<PlacedOrder> {
  narrow(
    (await shop.execute(AddItemToOrderDocument, { productVariantId: product.variantId, quantity }))
      .addItemToOrder,
    'Order',
  );
  const emailAddress = `convidado-${uniqueSuffix()}@example.com`;
  narrow(
    (
      await shop.execute(SetCustomerForOrderDocument, {
        input: { emailAddress, firstName: 'Convidado', lastName: 'Teste' },
      })
    ).setCustomerForOrder,
    'Order',
  );
  narrow(
    (await shop.execute(SetOrderShippingAddressDocument, { input: SHIPPING_ADDRESS }))
      .setOrderShippingAddress,
    'Order',
  );
  const { eligibleShippingMethods } = await shop.execute(EligibleShippingMethodsDocument);
  const shipping = eligibleShippingMethods.find((m) => m.code === REFERENCE.shippingMethodCode);
  if (shipping === undefined) {
    throw new Error(`Método de entrega ${REFERENCE.shippingMethodCode} não está elegível`);
  }
  narrow(
    (await shop.execute(SetOrderShippingMethodDocument, { shippingMethodId: [shipping.id] }))
      .setOrderShippingMethod,
    'Order',
  );
  const { transitionOrderToState } = await shop.execute(TransitionOrderToStateDocument, {
    state: 'ArrangingPayment',
  });
  if (transitionOrderToState === null) {
    throw new Error('transitionOrderToState devolveu null: não há pedido ativo');
  }
  narrow(transitionOrderToState, 'Order');
  const order = narrow(
    (
      await shop.execute(AddPaymentToOrderDocument, {
        input: { method: REFERENCE.paymentMethodCode, metadata: {} },
      })
    ).addPaymentToOrder,
    'Order',
  );
  return {
    id: order.id,
    code: order.code,
    state: order.state,
    totalWithTax: order.totalWithTax,
    emailAddress,
  };
}

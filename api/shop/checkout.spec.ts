import {
  AddItemToOrderDocument,
  AddPaymentToOrderDocument,
  EligibleShippingMethodsDocument,
  SetOrderShippingAddressDocument,
  SetOrderShippingMethodDocument,
  TransitionOrderToStateDocument,
} from '../../contracts/generated/shop.ts';
import { queryRows } from '../../fixtures/db.ts';
import { SHIPPING_ADDRESS } from '../../fixtures/factories/order.ts';
import { REFERENCE } from '../../fixtures/factories/reference-data.ts';
import { narrow } from '../../fixtures/graphql.ts';
import { listMailbox } from '../../fixtures/mailbox.ts';
import { expect, test } from '../../fixtures/test.ts';

/*
 * Fatia vertical (tarefa 1.1): carrinho → pedido pela Shop API, com o perfil customer.
 * Atravessa a API (cada etapa do checkout), o banco (o que a API não expõe) e o worker (o
 * e-mail de confirmação, gerado de forma assíncrona). A asserção de UI da fatia está em
 * ui/functional/pedido-no-dashboard.spec.ts.
 */
test('cliente fecha o pedido: pagamento liquidado, estoque reservado e confirmação por e-mail', async ({
  catalog,
  customerShop,
  db,
  request,
}) => {
  const { shop, customer } = customerShop;
  const product = await catalog.product({ priceCents: 1990, stockOnHand: 10 });
  const quantity = 2;
  const subTotalWithTax = product.priceWithTaxCents * quantity;

  await test.step('carrinho: item adicionado com o preço e o imposto do canal', async () => {
    const order = narrow(
      (
        await shop.execute(AddItemToOrderDocument, {
          productVariantId: product.variantId,
          quantity,
        })
      ).addItemToOrder,
      'Order',
    );
    expect(product.priceWithTaxCents).toBe(
      Math.round(product.priceCents * (1 + REFERENCE.taxRatePercent / 100)),
    );
    expect(order.lines).toEqual([
      expect.objectContaining({
        quantity,
        productVariant: { id: product.variantId, sku: product.sku },
      }),
    ]);
    expect(order.subTotalWithTax).toBe(subTotalWithTax);
    expect(order.currencyCode).toBe(REFERENCE.currency);
  });

  await test.step('entrega: endereço e método elegível', async () => {
    narrow(
      (await shop.execute(SetOrderShippingAddressDocument, { input: SHIPPING_ADDRESS }))
        .setOrderShippingAddress,
      'Order',
    );
    const { eligibleShippingMethods } = await shop.execute(EligibleShippingMethodsDocument);
    const shipping = eligibleShippingMethods.find((m) => m.code === REFERENCE.shippingMethodCode);
    expect(shipping?.priceWithTax).toBe(REFERENCE.shippingCents);
    narrow(
      (
        await shop.execute(SetOrderShippingMethodDocument, {
          shippingMethodId: [shipping?.id ?? ''],
        })
      ).setOrderShippingMethod,
      'Order',
    );
  });

  const order = await test.step('pagamento: pedido liquidado com o total esperado', async () => {
    const transition = (
      await shop.execute(TransitionOrderToStateDocument, { state: 'ArrangingPayment' })
    ).transitionOrderToState;
    expect(transition).toEqual({ __typename: 'Order', state: 'ArrangingPayment' });

    const paid = narrow(
      (
        await shop.execute(AddPaymentToOrderDocument, {
          input: { method: REFERENCE.paymentMethodCode, metadata: {} },
        })
      ).addPaymentToOrder,
      'Order',
    );
    expect(paid.state).toBe('PaymentSettled');
    expect(paid.active).toBe(false);
    expect(paid.totalWithTax).toBe(subTotalWithTax + REFERENCE.shippingCents);
    expect(paid.payments).toEqual([
      expect.objectContaining({
        method: REFERENCE.paymentMethodCode,
        state: 'Settled',
        amount: paid.totalWithTax,
      }),
    ]);
    return paid;
  });

  await test.step('banco: estoque alocado e pagamento persistido', async () => {
    // A Shop API não expõe movimentação de estoque: a reserva só é visível no banco.
    const stock = await queryRows<{ stockOnHand: number; stockAllocated: number }>(
      db,
      'select "stockOnHand", "stockAllocated" from stock_level where "productVariantId" = $1',
      [product.variantId],
    );
    expect(stock).toEqual([{ stockOnHand: 10, stockAllocated: quantity }]);

    const movements = await queryRows<{ type: string; quantity: number }>(
      db,
      `select type, quantity from stock_movement
        where "productVariantId" = $1 and type <> 'ADJUSTMENT'`,
      [product.variantId],
    );
    expect(movements).toEqual([{ type: 'ALLOCATION', quantity }]);

    const payments = await queryRows<{ state: string; amount: number }>(
      db,
      'select p.state, p.amount from payment p join "order" o on o.id = p."orderId" where o.code = $1',
      [order.code],
    );
    expect(payments).toEqual([{ state: 'Settled', amount: order.totalWithTax }]);
  });

  await test.step('worker: e-mail de confirmação na caixa do cliente', async () => {
    await expect
      .poll(
        async () =>
          (await listMailbox(request)).filter(
            (mail) => mail.recipient === customer.emailAddress && mail.subject.includes(order.code),
          ).length,
        {
          message: `e-mail de confirmação do pedido ${order.code} para ${customer.emailAddress}`,
          timeout: 15_000,
        },
      )
      .toBe(1);
  });
});

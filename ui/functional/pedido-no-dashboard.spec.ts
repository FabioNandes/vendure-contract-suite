import { placeGuestOrder } from '../../fixtures/factories/order.ts';
import { expect, test } from '../../fixtures/test.ts';

/*
 * Asserção de UI da fatia vertical. Justificativa para estar na camada de UI (regra do plano):
 * o risco aqui é de renderização — o pedido existe na API, mas o operador só o enxerga se o
 * Dashboard o listar e exibir com o código e o estado corretos.
 *
 * Massa via API (pedido de convidado), sessão admin via storageState: nenhum clique é setup.
 */
test('pedido pago aparece no Dashboard com código e estado', async ({ page, catalog, shopApi }) => {
  const product = await catalog.product();
  const order = await placeGuestOrder(shopApi, product);

  await page.goto(`/dashboard/orders/${order.id}`);

  await expect(page.getByRole('heading', { name: order.code })).toBeVisible();
  await expect(page.getByText('Payment settled', { exact: true }).first()).toBeVisible();
});

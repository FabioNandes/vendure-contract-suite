/**
 * Limpeza determinística: cada factory registra aqui como desfazer o que criou, e o teardown
 * do teste desfaz tudo em ordem inversa — mesmo que o teste tenha falhado no meio.
 *
 * Pedidos não entram: o Vendure não apaga pedido pela API (é histórico contábil), nem o cliente
 * convidado que ele cria junto com o pedido em `setCustomerForOrder`. Por isso nenhum teste
 * depende de contagem global de pedidos ou clientes; cada um encontra o seu pelo código ou e-mail.
 */
export class Cleanup {
  readonly #undo: { label: string; run: () => Promise<void> }[] = [];

  add(label: string, run: () => Promise<void>): void {
    this.#undo.push({ label, run });
  }

  async run(): Promise<void> {
    const failures: string[] = [];
    for (const { label, run } of this.#undo.reverse()) {
      try {
        await run();
      } catch (error) {
        failures.push(`${label}: ${String(error)}`);
      }
    }
    this.#undo.length = 0;
    if (failures.length > 0) {
      throw new Error(`Limpeza incompleta:\n${failures.join('\n')}`);
    }
  }
}

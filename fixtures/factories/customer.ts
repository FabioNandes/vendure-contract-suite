import { randomBytes } from 'node:crypto';
import { CreateCustomerDocument, DeleteCustomerDocument } from '../../contracts/generated/admin.ts';
import type { Cleanup } from '../cleanup.ts';
import { narrow, type GraphQLClient } from '../graphql.ts';
import { uniqueSuffix } from './catalog.ts';

export interface CreatedCustomer {
  id: string;
  emailAddress: string;
  password: string;
}

/**
 * Cliente criado pela Admin API já com senha — e, portanto, verificado: pode fazer login na
 * Shop API sem passar pelo e-mail de verificação.
 */
export async function createCustomer(
  admin: GraphQLClient,
  cleanup: Cleanup,
  label = 'cliente',
): Promise<CreatedCustomer> {
  const suffix = uniqueSuffix();
  const emailAddress = `${label}-${suffix}@example.com`;
  const password = randomBytes(12).toString('hex');
  const { createCustomer: result } = await admin.execute(CreateCustomerDocument, {
    input: { emailAddress, firstName: 'Cliente', lastName: `Teste ${suffix}` },
    password,
  });
  const customer = narrow(result, 'Customer');
  cleanup.add(`cliente ${customer.id}`, async () => {
    await admin.execute(DeleteCustomerDocument, { id: customer.id });
  });
  return { id: customer.id, emailAddress, password };
}

import { createWallet, AncoreClient } from '../src';
import { Keypair } from '@stellar/stellar-sdk';
import * as assert from 'assert';

async function run() {
  console.log('Running Session Key Lifecycle Example...');

  // 1. Create a wallet
  const wallet = await createWallet({ password: 'secure-password' });
  console.log('Created wallet for owner:', wallet.publicKey);
  console.log('Smart contract account ID:', wallet.contractId);

  // 2. Instantiate AncoreClient
  const client = new AncoreClient({ accountContractId: wallet.contractId });

  // 3. Add a session key
  const sessionPublicKey = Keypair.random().publicKey();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const permissions = [0]; // SEND_PAYMENT

  console.log('Generating invocation to add session key:', sessionPublicKey);
  const addInvocation = client.addSessionKey({
    publicKey: sessionPublicKey,
    permissions,
    expiresAt,
  });

  assert.equal(addInvocation.method, 'add_session_key');
  console.log('Successfully generated add_session_key invocation args!');

  // 4. Revoke a session key
  console.log('Generating invocation to revoke session key...');
  const revokeInvocation = client.revokeSessionKey({
    publicKey: sessionPublicKey,
  });

  assert.equal(revokeInvocation.method, 'revoke_session_key');
  console.log('Successfully generated revoke_session_key invocation args!');

  console.log('All session key lifecycle steps verified!');
}

run().catch((err) => {
  console.error('Example failed:', err);
  process.exit(1);
});

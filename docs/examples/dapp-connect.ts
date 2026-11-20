import { AccountTransactionBuilder } from '@ancore/core-sdk';
import { Account, Networks, rpc } from '@stellar/stellar-sdk';
import {
  connect,
  getAddress,
  isConnected,
  signTransaction,
  WalletApiError,
} from '@ancore/wallet-api';

const networkPassphrase = Networks.TESTNET;
const rpcUrl = 'https://soroban-testnet.stellar.org';

async function connectAndSign(): Promise<void> {
  if (!(await isConnected())) {
    // connect() requests access and returns the smart account C-address.
    await connect();
  }

  const { smartAccountId, ownerPublicKey } = await getAddress();
  if (!ownerPublicKey) {
    throw new Error('The connected wallet did not provide its owner public key.');
  }

  const sessionKeyPublicKey = window.prompt('Session key G-address to revoke');
  if (!sessionKeyPublicKey) return;

  const server = new rpc.Server(rpcUrl);
  const ownerAccount = await server.getAccount(ownerPublicKey);
  const builder = new AccountTransactionBuilder(
    new Account(ownerAccount.accountId(), ownerAccount.sequenceNumber()),
    {
      server,
      accountContractId: smartAccountId,
      networkPassphrase,
      fee: '100',
    }
  );

  builder.revokeSessionKey(sessionKeyPublicKey);

  const transaction = await builder.build();
  const { signedXdr } = await signTransaction({
    xdr: transaction.toXDR(),
    networkPassphrase,
  });

  console.log('Signed transaction XDR:', signedXdr);
}

void connectAndSign().catch((error: unknown) => {
  if (error instanceof WalletApiError && error.message === 'User rejected the sign request') {
    console.info('The user declined the signature request.');
    return;
  }

  console.error('Unable to connect or sign with Ancore Wallet:', error);
});

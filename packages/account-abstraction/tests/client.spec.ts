import { Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import {
  AccountAbstractionClient,
  createSmartAccount,
  deriveAccountContractId,
  ACCOUNT_CONTRACT_SALT,
} from '../src/index';

describe('createSmartAccount factory & AccountAbstractionClient', () => {
  const mockOwner = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';
  const mockServer = {
    getAccount: jest.fn(),
    simulateTransaction: jest.fn(),
    sendTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deriveAccountContractId', () => {
    it('deterministically derives a valid C... contract ID for a public key', () => {
      const contractId = deriveAccountContractId(mockOwner, 'testnet');
      expect(contractId).toMatch(/^C[A-Z0-9]{55}$/);
      expect(StrKey.isValidContract(contractId)).toBe(true);

      // Verify determinism
      const secondCall = deriveAccountContractId(mockOwner, 'testnet');
      expect(secondCall).toBe(contractId);
    });

    it('derives different contract IDs on testnet vs mainnet', () => {
      const testnetId = deriveAccountContractId(mockOwner, 'testnet');
      const mainnetId = deriveAccountContractId(mockOwner, 'mainnet');
      expect(testnetId).not.toBe(mainnetId);
    });

    it('uses a constant 32-byte salt', () => {
      expect(ACCOUNT_CONTRACT_SALT).toBeInstanceOf(Buffer);
      expect(ACCOUNT_CONTRACT_SALT.length).toBe(32);
      expect(ACCOUNT_CONTRACT_SALT.every((b) => b === 0)).toBe(true);
    });
  });

  describe('createSmartAccount factory function', () => {
    it('creates an initialized client from public key and server (one-liner)', () => {
      const client = createSmartAccount(mockOwner, mockServer);

      expect(client).toBeInstanceOf(AccountAbstractionClient);
      expect(client.contractId).toMatch(/^C[A-Z0-9]{55}$/);
      expect(client.ownerPublicKey).toBe(mockOwner);
      expect(client.server).toBe(mockServer);
    });

    it('supports options object signature', () => {
      const client = createSmartAccount({
        publicKey: mockOwner,
        server: mockServer,
        network: 'testnet',
        retryOptions: { maxRetries: 5 },
      });

      expect(client).toBeInstanceOf(AccountAbstractionClient);
      expect(client.ownerPublicKey).toBe(mockOwner);
      expect(client.retryOptions.maxRetries).toBe(5);
    });

    it('preserves explicit C... contract ID if provided', () => {
      const explicitContractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
      const client = createSmartAccount({
        publicKey: mockOwner,
        server: mockServer,
        contractId: explicitContractId,
      });

      expect(client.contractId).toBe(explicitContractId);
    });

    it('accepts contract ID as publicKey parameter', () => {
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
      const client = createSmartAccount(contractId, mockServer);

      expect(client.contractId).toBe(contractId);
    });
  });

  describe('AccountAbstractionClient.createSmartAccount static factory', () => {
    it('creates client instance via static method', () => {
      const client = AccountAbstractionClient.createSmartAccount(mockOwner, mockServer);

      expect(client).toBeInstanceOf(AccountAbstractionClient);
      expect(client.contractId).toMatch(/^C[A-Z0-9]{55}$/);
      expect(client.ownerPublicKey).toBe(mockOwner);
    });

    it('creates client instance via options object', () => {
      const client = AccountAbstractionClient.createSmartAccount({
        publicKey: mockOwner,
        server: mockServer,
      });

      expect(client).toBeInstanceOf(AccountAbstractionClient);
      expect(client.contractId).toMatch(/^C[A-Z0-9]{55}$/);
    });
  });

  describe('Smart Account invocation & execution methods', () => {
    it('builds initialize invocation using client owner', () => {
      const client = createSmartAccount(mockOwner, mockServer);
      const invocation = client.initialize();

      expect(invocation.method).toBe('initialize');
      expect(invocation.args).toBeDefined();
      expect(invocation.args.length).toBe(1);
    });

    it('builds execute invocation with expected nonce', () => {
      const client = createSmartAccount(mockOwner, mockServer);
      const targetContract = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
      const invocation = client.execute(targetContract, 'transfer', [xdr.ScVal.scvU32(100)], 0);

      expect(invocation.method).toBe('execute');
      expect(invocation.args.length).toBe(6);
    });

    it('builds addSessionKey and revokeSessionKey invocations', () => {
      const client = createSmartAccount(mockOwner, mockServer);
      const sessionPub = Keypair.random().publicKey();

      const addInvocation = client.addSessionKey(sessionPub, [0], 1800000000);
      expect(addInvocation.method).toBe('add_session_key');

      const revokeInvocation = client.revokeSessionKey(sessionPub);
      expect(revokeInvocation.method).toBe('revoke_session_key');
    });

    it('builds invoke operation for Stellar transaction', () => {
      const client = createSmartAccount(mockOwner, mockServer);
      const invocation = client.initialize();
      const op = client.buildInvokeOperation(invocation);

      expect(op).toBeDefined();
    });

    it('fetches getOwner using default owner/contract address without explicit sourceAccount', async () => {
      const client = createSmartAccount(mockOwner, mockServer);

      jest.spyOn(client.accountContract, 'getOwner').mockResolvedValueOnce(mockOwner);

      const owner = await client.getOwner();
      expect(owner).toBe(mockOwner);
      expect(client.accountContract.getOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceAccount: mockOwner,
        })
      );
    });

    it('fetches getNonce using default owner/contract address', async () => {
      const client = createSmartAccount(mockOwner, mockServer);

      jest.spyOn(client.accountContract, 'getNonce').mockResolvedValueOnce(7);

      const nonce = await client.getNonce();
      expect(nonce).toBe(7);
      expect(client.accountContract.getNonce).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceAccount: mockOwner,
        })
      );
    });
  });
});

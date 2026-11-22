import { Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import {
  AccountAbstractionClient,
  AccountContractError,
  createSmartAccount,
  deriveAccountContractId,
  ACCOUNT_CONTRACT_SALT,
  NotInitializedError,
  SessionKeyExpiredError,
  SessionKeyNotFoundError,
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

  describe('isAccountDeployed helper', () => {
    it('returns true when contract data entry exists via getContractData', async () => {
      const server = {
        ...mockServer,
        getContractData: jest.fn().mockResolvedValue({ val: 'contract-instance' }),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(true);
      expect(server.getContractData).toHaveBeenCalled();
    });

    it('returns false when getContractData throws not found / 404', async () => {
      const notFoundErr = new Error('Entry not found: 404');
      (notFoundErr as any).status = 404;
      const server = {
        ...mockServer,
        getContractData: jest.fn().mockRejectedValue(notFoundErr),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(false);
    });

    it('returns true when contract entry exists via getLedgerEntries', async () => {
      const server = {
        ...mockServer,
        getLedgerEntries: jest.fn().mockResolvedValue({ entries: [{ xdr: 'instance-entry' }] }),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(true);
      expect(server.getLedgerEntries).toHaveBeenCalled();
    });

    it('returns false when getLedgerEntries returns empty entries', async () => {
      const server = {
        ...mockServer,
        getLedgerEntries: jest.fn().mockResolvedValue({ entries: [] }),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(false);
    });

    it('returns false when getLedgerEntries throws not found', async () => {
      const notFoundErr = new Error('entry not found');
      const server = {
        ...mockServer,
        getLedgerEntries: jest.fn().mockRejectedValue(notFoundErr),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(false);
    });

    it('falls back to getAccount when neither getContractData nor getLedgerEntries exists', async () => {
      const server = {
        getAccount: jest.fn().mockResolvedValue({ id: 'C...', sequence: '0' }),
        simulateTransaction: jest.fn(),
        sendTransaction: jest.fn(),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(true);
    });

    it('handles explicit contractId override', async () => {
      const customContract = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
      const server = {
        ...mockServer,
        getContractData: jest.fn().mockResolvedValue({ val: 'ok' }),
      };
      const client = createSmartAccount(mockOwner, server);
      const deployed = await client.isAccountDeployed(customContract);
      expect(deployed).toBe(true);
      expect(server.getContractData).toHaveBeenCalledWith(
        customContract,
        expect.anything(),
        expect.anything()
      );
    });

    it('throws NetworkError when Soroban RPC request times out', async () => {
      const timeoutErr = new Error('ETIMEDOUT: Connection timed out');
      (timeoutErr as any).code = 'ETIMEDOUT';
      const server = {
        ...mockServer,
        getContractData: jest.fn().mockRejectedValue(timeoutErr),
      };
      const client = createSmartAccount(mockOwner, server, {
        retryOptions: { maxRetries: 0 },
      });
      await expect(client.isAccountDeployed()).rejects.toThrow('Network timeout or failure');
    });
  });

  describe('refreshSessionKeyTtl edge cases (#1458)', () => {
    const fixedNowMs = 1_750_000_000_000;
    const fixedNowSec = Math.floor(fixedNowMs / 1000);
    const activeExpiresAt = fixedNowSec + 3600;

    it('rejects expired session keys during preflight and when on-chain key is expired', async () => {
      const sessionPub = Keypair.random().publicKey();
      const client = createSmartAccount(mockOwner, mockServer, {
        retryOptions: { maxRetries: 0 },
      });

      await expect(
        client.refreshSessionKeyTtl(sessionPub, {
          expiresAt: fixedNowSec - 10,
          nowMs: fixedNowMs,
        })
      ).rejects.toBeInstanceOf(SessionKeyExpiredError);

      jest.spyOn(client, 'getSessionKey').mockResolvedValueOnce({
        publicKey: sessionPub,
        permissions: [0],
        expiresAt: fixedNowSec - 1,
      });

      await expect(
        client.refreshSessionKeyTtl(sessionPub, { nowMs: fixedNowMs })
      ).rejects.toBeInstanceOf(SessionKeyExpiredError);
      expect(mockServer.simulateTransaction).not.toHaveBeenCalled();
    });

    it('rejects invalid contract addresses with INVALID_CONTRACT_ADDRESS', async () => {
      const sessionPub = Keypair.random().publicKey();
      const client = createSmartAccount(mockOwner, mockServer);

      await expect(
        client.refreshSessionKeyTtl(sessionPub, {
          contractId: 'INVALID_CONTRACT_ADDRESS',
          expiresAt: activeExpiresAt,
          nowMs: fixedNowMs,
        })
      ).rejects.toThrow(AccountContractError);
    });

    it('rejects when smart account vault is missing/undeployed or session key is missing on-chain', async () => {
      const sessionPub = Keypair.random().publicKey();
      const undeployedServer = {
        ...mockServer,
        getContractData: jest.fn().mockRejectedValue({ status: 404, message: 'Entry not found' }),
      };
      const undeployedClient = createSmartAccount(mockOwner, undeployedServer, {
        retryOptions: { maxRetries: 0 },
      });

      await expect(
        undeployedClient.refreshSessionKeyTtl(sessionPub, {
          expiresAt: activeExpiresAt,
          nowMs: fixedNowMs,
        })
      ).rejects.toBeInstanceOf(NotInitializedError);

      const client = createSmartAccount(mockOwner, mockServer, {
        retryOptions: { maxRetries: 0 },
      });
      jest.spyOn(client, 'getSessionKey').mockResolvedValueOnce(null);

      await expect(
        client.refreshSessionKeyTtl(sessionPub, { nowMs: fixedNowMs })
      ).rejects.toBeInstanceOf(SessionKeyNotFoundError);
    });

    it('coalesces concurrent refreshes for the same session key and runs distinct keys independently', async () => {
      const sessionPubA = Keypair.random().publicKey();
      const sessionPubB = Keypair.random().publicKey();
      mockServer.getAccount.mockResolvedValue({ id: mockOwner, sequence: '100' });
      mockServer.simulateTransaction.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ result: { retval: xdr.ScVal.scvVoid() } }), 20)
          )
      );

      const client = createSmartAccount(mockOwner, mockServer, {
        retryOptions: { maxRetries: 0 },
      });

      const [resA1, resA2, resB] = await Promise.all([
        client.refreshSessionKeyTtl(sessionPubA, {
          expiresAt: activeExpiresAt,
          nowMs: fixedNowMs,
        }),
        client.refreshSessionKeyTtl(sessionPubA, {
          expiresAt: activeExpiresAt,
          nowMs: fixedNowMs,
        }),
        client.refreshSessionKeyTtl(sessionPubB, {
          expiresAt: activeExpiresAt,
          nowMs: fixedNowMs,
        }),
      ]);

      expect(resA1).toEqual(resA2);
      expect(resA1.publicKey).toBe(sessionPubA);
      expect(resB.publicKey).toBe(sessionPubB);
      // Two unique session keys => only 2 simulation calls despite 3 concurrent invocations
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(2);
    });

    it('successfully simulates refresh_session_key_ttl and returns invocation and operation', async () => {
      const sessionPub = Keypair.random().publicKey();
      mockServer.getAccount.mockResolvedValueOnce({ id: mockOwner, sequence: '42' });
      mockServer.simulateTransaction.mockResolvedValueOnce({
        result: { retval: xdr.ScVal.scvVoid() },
      });

      const client = createSmartAccount(mockOwner, mockServer, {
        retryOptions: { maxRetries: 0 },
      });
      jest.spyOn(client, 'getSessionKey').mockResolvedValueOnce({
        publicKey: sessionPub,
        permissions: [0],
        expiresAt: activeExpiresAt,
      });

      const result = await client.refreshSessionKeyTtl(sessionPub, {
        nowMs: fixedNowMs,
      });

      expect(result.invocation.method).toBe('refresh_session_key_ttl');
      expect(result.publicKey).toBe(sessionPub);
      expect(result.expiresAt).toBe(activeExpiresAt);
      expect(result.operation).toBeDefined();
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
    });
  });
});

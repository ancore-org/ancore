import { createStellarRpcHandlers, handleStellarRpcRequest } from '../stellar-handlers';
import { SessionTypes } from '@walletconnect/types';

// Mock sign service
const mockSignService = {
  signTransaction: jest.fn().mockResolvedValue({ signedXdr: 'signed-xdr' }),
  submitTransaction: jest.fn().mockResolvedValue({ txHash: 'tx-hash-123' }),
  signMessage: jest.fn().mockResolvedValue({ signature: 'signature-abc' }),
  signAuthEntry: jest.fn().mockResolvedValue({ signedAuthEntry: 'signed-auth-entry' }),
};

const mockSession: SessionTypes.Struct = {
  topic: 'test-topic',
  peer: { metadata: { name: 'Test dApp' } },
  namespaces: {},
} as any;

describe('Stellar RPC Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStellarRpcHandlers', () => {
    it('should handle stellar_signXDR', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handlers.handleStellarSignXDR({ xdr: 'test-xdr' }, mockSession);

      expect(mockSignService.signTransaction).toHaveBeenCalledWith('test-xdr');
      expect(result).toEqual({ signedXdr: 'signed-xdr' });
    });

    it('should throw error when xdr is missing for stellar_signXDR', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      await expect(
        handlers.handleStellarSignXDR({} as { xdr: string }, mockSession)
      ).rejects.toThrow('Missing xdr parameter');
    });

    it('should handle stellar_signAndSubmitXDR', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handlers.handleStellarSignAndSubmitXDR({ xdr: 'test-xdr' }, mockSession);

      expect(mockSignService.signTransaction).toHaveBeenCalledWith('test-xdr');
      expect(mockSignService.submitTransaction).toHaveBeenCalledWith('signed-xdr');
      expect(result).toEqual({
        signedXdr: 'signed-xdr',
        txHash: 'tx-hash-123',
      });
    });

    it('should throw error when xdr is missing for stellar_signAndSubmitXDR', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      await expect(
        handlers.handleStellarSignAndSubmitXDR({} as { xdr: string }, mockSession)
      ).rejects.toThrow('Missing xdr parameter');
    });

    it('should handle stellar_signMessage', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handlers.handleStellarSignMessage(
        { message: 'test-message' },
        mockSession
      );

      expect(mockSignService.signMessage).toHaveBeenCalledWith('test-message');
      expect(result).toEqual({ signature: 'signature-abc' });
    });

    it('should throw error when message is missing for stellar_signMessage', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      await expect(
        handlers.handleStellarSignMessage({} as { message: string }, mockSession)
      ).rejects.toThrow('Missing message parameter');
    });

    it('should handle stellar_signAuthEntry', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handlers.handleStellarSignAuthEntry(
        { authEntry: 'test-auth-entry' },
        mockSession
      );

      expect(mockSignService.signAuthEntry).toHaveBeenCalledWith('test-auth-entry');
      expect(result).toEqual({ signedAuthEntry: 'signed-auth-entry' });
    });

    it('should throw error when authEntry is missing for stellar_signAuthEntry', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      await expect(
        handlers.handleStellarSignAuthEntry({} as { authEntry: string }, mockSession)
      ).rejects.toThrow('Missing authEntry parameter');
    });
  });

  describe('handleStellarRpcRequest', () => {
    it('should route stellar_signXDR to correct handler', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handleStellarRpcRequest(
        'stellar_signXDR',
        { xdr: 'test-xdr' },
        mockSession,
        handlers
      );

      expect(result).toEqual({ signedXdr: 'signed-xdr' });
    });

    it('should route stellar_signAndSubmitXDR to correct handler', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handleStellarRpcRequest(
        'stellar_signAndSubmitXDR',
        { xdr: 'test-xdr' },
        mockSession,
        handlers
      );

      expect(result).toEqual({
        signedXdr: 'signed-xdr',
        txHash: 'tx-hash-123',
      });
    });

    it('should route stellar_signMessage to correct handler', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handleStellarRpcRequest(
        'stellar_signMessage',
        { message: 'test-message' },
        mockSession,
        handlers
      );

      expect(result).toEqual({ signature: 'signature-abc' });
    });

    it('should route stellar_signAuthEntry to correct handler', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      const result = await handleStellarRpcRequest(
        'stellar_signAuthEntry',
        { authEntry: 'test-auth-entry' },
        mockSession,
        handlers
      );

      expect(result).toEqual({ signedAuthEntry: 'signed-auth-entry' });
    });

    it('should throw error for unknown method', async () => {
      const handlers = createStellarRpcHandlers(mockSignService as any);

      await expect(
        handleStellarRpcRequest('unknown_method', {}, mockSession, handlers)
      ).rejects.toThrow('Unknown Stellar RPC method: unknown_method');
    });
  });
});

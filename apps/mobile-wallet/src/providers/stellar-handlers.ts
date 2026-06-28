import { SessionTypes } from '@walletconnect/types';

// Sign service interface - to be implemented with actual sign service from #785
interface SignService {
  signTransaction(_xdr: string): Promise<{ signedXdr: string }>;
  submitTransaction(xdr: string): Promise<{ txHash: string }>;
  signMessage(_message: string): Promise<{ signature: string }>;
  signAuthEntry(authEntry: string): Promise<{ signedAuthEntry: string }>;
}

// Mock sign service for testing - will be replaced by real service
const mockSignService: SignService = {
  signTransaction: async (_xdr: string) => ({
    signedXdr: 'mock-signed-xdr', // Mock: return same XDR for now
  }),
  submitTransaction: async (_xdr: string) => ({
    txHash: 'mock-tx-hash',
  }),
  signMessage: async (_message: string) => ({
    signature: 'mock-signature',
  }),
  signAuthEntry: async (authEntry: string) => ({
    signedAuthEntry: authEntry,
  }),
};

export interface StellarRpcHandlers {
  handleStellarSignXDR: (
    params: { xdr: string },
    _session: SessionTypes.Struct
  ) => Promise<{ signedXdr: string }>;
  handleStellarSignAndSubmitXDR: (
    params: { xdr: string },
    _session: SessionTypes.Struct
  ) => Promise<{ signedXdr: string; txHash: string }>;
  handleStellarSignMessage: (
    params: { message: string },
    _session: SessionTypes.Struct
  ) => Promise<{ signature: string }>;
  handleStellarSignAuthEntry: (
    params: { authEntry: string },
    _session: SessionTypes.Struct
  ) => Promise<{ signedAuthEntry: string }>;
}

export const createStellarRpcHandlers = (
  signService: SignService = mockSignService
): StellarRpcHandlers => ({
  handleStellarSignXDR: async (params: { xdr: string }, _session: SessionTypes.Struct) => {
    const { xdr } = params;

    if (!xdr) {
      throw new Error('Missing xdr parameter');
    }

    try {
      const result = await signService.signTransaction(xdr);
      return result;
    } catch (error) {
      console.error('Failed to sign XDR:', error);
      throw error;
    }
  },

  handleStellarSignAndSubmitXDR: async (params: { xdr: string }, _session: SessionTypes.Struct) => {
    const { xdr } = params;

    if (!xdr) {
      throw new Error('Missing xdr parameter');
    }

    try {
      // First sign the transaction
      const { signedXdr } = await signService.signTransaction(xdr);

      // Then submit it
      const result = await signService.submitTransaction(signedXdr);

      return {
        signedXdr,
        txHash: result.txHash,
      };
    } catch (error) {
      console.error('Failed to sign and submit XDR:', error);
      throw error;
    }
  },

  handleStellarSignMessage: async (params: { message: string }, _session: SessionTypes.Struct) => {
    const { message } = params;

    if (!message) {
      throw new Error('Missing message parameter');
    }

    try {
      const result = await signService.signMessage(message);
      return result;
    } catch (error) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  },

  handleStellarSignAuthEntry: async (
    params: { authEntry: string },
    _session: SessionTypes.Struct
  ) => {
    const { authEntry } = params;

    if (!authEntry) {
      throw new Error('Missing authEntry parameter');
    }

    try {
      const result = await signService.signAuthEntry(authEntry);
      return result;
    } catch (error) {
      console.error('Failed to sign auth entry:', error);
      throw error;
    }
  },
});

// Helper to route RPC method calls to appropriate handler
export const handleStellarRpcRequest = (
  method: string,
  params: unknown,
  session: SessionTypes.Struct,
  handlers: StellarRpcHandlers
): Promise<unknown> => {
  switch (method) {
    case 'stellar_signXDR':
      return handlers.handleStellarSignXDR(params as { xdr: string }, session);
    case 'stellar_signAndSubmitXDR':
      return handlers.handleStellarSignAndSubmitXDR(params as { xdr: string }, session);
    case 'stellar_signMessage':
      return handlers.handleStellarSignMessage(params as { message: string }, session);
    case 'stellar_signAuthEntry':
      return handlers.handleStellarSignAuthEntry(params as { authEntry: string }, session);
    default:
      return Promise.reject(new Error(`Unknown Stellar RPC method: ${method}`));
  }
};

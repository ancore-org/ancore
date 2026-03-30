/**
 * Unit tests for sendPayment — mocks builder, signer, and stellar client.
 */

import { Account, Asset, Networks, Operation } from '@stellar/stellar-sdk';
import { sendPayment, type SendPaymentParams, type SendPaymentDeps, type PaymentSigner } from '../send-payment';
import {
  BuilderValidationError,
  TransactionSubmissionError,
  SimulationFailedError,
} from '../errors';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../account-transaction-builder', () => {
  const mockBuild = jest.fn();
  const mockAddOperation = jest.fn();
  const MockBuilder = jest.fn().mockImplementation(() => ({
    addOperation: mockAddOperation.mockReturnThis(),
    build: mockBuild,
  }));
  return {
    AccountTransactionBuilder: MockBuilder,
    __mocks: { MockBuilder, mockBuild, mockAddOperation },
  };
});

jest.mock('@ancore/stellar', () => {
  const mockSubmit = jest.fn();
  const MockStellarClient = jest.fn().mockImplementation(() => ({
    submitTransaction: mockSubmit,
  }));
  const TransactionError = class extends Error {
    resultXdr?: string;
    constructor(msg: string, opts?: { resultXdr?: string }) {
      super(msg);
      this.name = 'TransactionError';
      this.resultXdr = opts?.resultXdr;
    }
  };
  const NetworkError = class extends Error {
    constructor(msg: string) { super(msg); this.name = 'NetworkError'; }
  };
  return {
    StellarClient: MockStellarClient,
    TransactionError,
    NetworkError,
    __mocks: { MockStellarClient, mockSubmit },
  };
});

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    TransactionBuilder: {
      ...actual.TransactionBuilder,
      fromXDR: jest.fn().mockReturnValue({ toXDR: () => 'signed-xdr' }),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { __mocks: builderMocks } = jest.requireMock('../account-transaction-builder') as any;
const { __mocks: stellarMocks } = jest.requireMock('@ancore/stellar') as any;

const DEST = 'GDQERENWDDSQZS7R7WKHZI3BSOYMV3FSWR7TFUYFTKQ447PIX6NREOJM';
const SOURCE = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

function makeDeps(): SendPaymentDeps {
  const sourceAccount = new Account(SOURCE, '100');
  return {
    sourceAccount,
    builderOptions: {
      server: {} as any,
      accountContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
      networkPassphrase: Networks.TESTNET,
    },
    stellarClient: new (jest.requireMock('@ancore/stellar').StellarClient)(),
  };
}

function makeSigner(xdr = 'signed-xdr'): PaymentSigner {
  return { sign: jest.fn().mockResolvedValue(xdr) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    builderMocks.mockBuild.mockResolvedValue({ toXDR: () => 'raw-xdr' });
    stellarMocks.mockSubmit.mockResolvedValue({ hash: 'abc123', ledger: 42 });
  });

  describe('happy path', () => {
    it('returns a success TransactionResult', async () => {
      const params: SendPaymentParams = {
        to: DEST,
        amount: '10',
        signer: makeSigner(),
      };

      const result = await sendPayment(params, makeDeps());

      expect(result.status).toBe('success');
      expect(result.hash).toBe('abc123');
      expect(result.ledger).toBe(42);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('calls addOperation with a payment op', async () => {
      const params: SendPaymentParams = { to: DEST, amount: '5', signer: makeSigner() };
      await sendPayment(params, makeDeps());
      expect(builderMocks.mockAddOperation).toHaveBeenCalledTimes(1);
    });

    it('calls signer.sign with the built transaction XDR', async () => {
      const signer = makeSigner();
      await sendPayment({ to: DEST, amount: '1', signer }, makeDeps());
      expect(signer.sign).toHaveBeenCalledWith('raw-xdr');
    });

    it('calls stellarClient.submitTransaction', async () => {
      await sendPayment({ to: DEST, amount: '1', signer: makeSigner() }, makeDeps());
      expect(stellarMocks.mockSubmit).toHaveBeenCalledTimes(1);
    });

    it('uses native XLM by default', async () => {
      const params: SendPaymentParams = { to: DEST, amount: '1', signer: makeSigner() };
      await sendPayment(params, makeDeps());
      // addOperation was called — asset resolution is internal; just verify no throw
      expect(builderMocks.mockAddOperation).toHaveBeenCalled();
    });

    it('accepts a non-native asset', async () => {
      const params: SendPaymentParams = {
        to: DEST,
        amount: '1',
        asset: { code: 'USDC', issuer: DEST },
        signer: makeSigner(),
      };
      await sendPayment(params, makeDeps());
      expect(builderMocks.mockAddOperation).toHaveBeenCalled();
    });
  });

  describe('validation errors', () => {
    it('throws BuilderValidationError for empty "to"', async () => {
      await expect(
        sendPayment({ to: '', amount: '1', signer: makeSigner() }, makeDeps())
      ).rejects.toThrow(BuilderValidationError);
    });

    it('throws BuilderValidationError for zero amount', async () => {
      await expect(
        sendPayment({ to: DEST, amount: '0', signer: makeSigner() }, makeDeps())
      ).rejects.toThrow(BuilderValidationError);
    });

    it('throws BuilderValidationError for negative amount', async () => {
      await expect(
        sendPayment({ to: DEST, amount: '-5', signer: makeSigner() }, makeDeps())
      ).rejects.toThrow(BuilderValidationError);
    });

    it('throws BuilderValidationError for non-numeric amount', async () => {
      await expect(
        sendPayment({ to: DEST, amount: 'abc', signer: makeSigner() }, makeDeps())
      ).rejects.toThrow(BuilderValidationError);
    });

    it('throws BuilderValidationError when signer is missing', async () => {
      await expect(
        sendPayment({ to: DEST, amount: '1', signer: null as any }, makeDeps())
      ).rejects.toThrow(BuilderValidationError);
    });
  });

  describe('error mapping', () => {
    it('re-throws SimulationFailedError from builder', async () => {
      builderMocks.mockBuild.mockRejectedValue(new SimulationFailedError('contract revert'));
      await expect(
        sendPayment({ to: DEST, amount: '1', signer: makeSigner() }, makeDeps())
      ).rejects.toThrow(SimulationFailedError);
    });

    it('wraps signer errors as TransactionSubmissionError', async () => {
      const signer: PaymentSigner = { sign: jest.fn().mockRejectedValue(new Error('key locked')) };
      builderMocks.mockBuild.mockResolvedValue({ toXDR: () => 'raw-xdr' });
      await expect(
        sendPayment({ to: DEST, amount: '1', signer }, makeDeps())
      ).rejects.toThrow(TransactionSubmissionError);
    });

    it('wraps network submission errors as TransactionSubmissionError', async () => {
      const { TransactionError } = jest.requireMock('@ancore/stellar');
      stellarMocks.mockSubmit.mockRejectedValue(new TransactionError('tx_bad_seq'));
      await expect(
        sendPayment({ to: DEST, amount: '1', signer: makeSigner() }, makeDeps())
      ).rejects.toThrow(TransactionSubmissionError);
    });
  });
});

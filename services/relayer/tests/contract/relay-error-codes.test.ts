import request from 'supertest';
import { NetworkError } from '@ancore/stellar';
import { createApp } from '../../src/server';
import { RelayErrorCodes } from '../../src/types/errorCodes';
import type {
  AuthServiceContract,
  SignatureServiceContract,
  TransactionSubmitterContract,
} from '../../src/types';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);

const validBody = {
  sessionKey: VALID_KEY,
  operation: 'relay_execute',
  parameters: { signedTransactionXdr: 'AAAA-xdr' },
  signature: VALID_SIG,
  nonce: 1,
};

const KNOWN_CODES = Object.values(RelayErrorCodes);

function makeApp(
  sigValid: boolean,
  transactionSubmitter?: TransactionSubmitterContract,
  relayOptions?: { useMockSubmission?: boolean; startScheduler?: boolean }
) {
  const authService: AuthServiceContract = {
    verifyToken: jest.fn().mockResolvedValue({ callerId: 'test-caller' }),
  };
  const signatureService: SignatureServiceContract = {
    verify: jest.fn().mockReturnValue(sigValid),
  };
  return createApp(authService, signatureService, undefined, transactionSubmitter, {
    startScheduler: false,
    ...relayOptions,
  });
}

describe('relay error codes contract (issue #1064)', () => {
  it('INVALID_SIGNATURE on /relay/execute when verification fails', async () => {
    const app = makeApp(false, undefined, { useMockSubmission: true });
    const res = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('RPC_DOWN on /relay/execute when the RPC submitter is unreachable', async () => {
    const submitter: TransactionSubmitterContract = {
      simulateAndAssembleTransaction: jest
        .fn()
        .mockRejectedValue(new NetworkError('Soroban RPC unreachable')),
      submitSignedTransaction: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue({ healthy: false, latencyMs: 1 }),
    };
    const app = makeApp(true, submitter);
    const res = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('RPC_DOWN');
  });

  it('INTERNAL_ERROR on /relay/execute for unexpected submitter failures', async () => {
    const submitter: TransactionSubmitterContract = {
      simulateAndAssembleTransaction: jest.fn().mockRejectedValue(new Error('unexpected boom')),
      submitSignedTransaction: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
    };
    const app = makeApp(true, submitter);
    const res = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('every error code on the wire is a member of RelayErrorCodes', async () => {
    const app = makeApp(false, undefined, { useMockSubmission: true });
    const res = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(KNOWN_CODES).toContain(res.body.error.code);
  });
});

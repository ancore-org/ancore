import { describe, expect, it, vi } from 'vitest';

import {
  createRelayerPayoutSubmitter,
  executeBulkPayoutBatch,
  parseBulkPayoutCsv,
} from '../bulk-payouts';

const VALID_RECIPIENT = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

describe('bulk payout CSV parsing', () => {
  it('parses valid recipient and amount rows with a deterministic total', () => {
    const result = parseBulkPayoutCsv(
      `recipient,amount\n${VALID_RECIPIENT},10.5\n${VALID_RECIPIENT},0.0000001`
    );

    expect(result.rows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows).toHaveLength(2);
    expect(result.totalAmount).toBe('10.5000001');
  });

  it('surfaces actionable validation errors for invalid rows', () => {
    const badChecksum = `${VALID_RECIPIENT.slice(0, -1)}B`;
    const result = parseBulkPayoutCsv(`recipient,amount\n${badChecksum},1.12345678\n,0`);

    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(2);
    expect(result.rows[0].errors).toEqual([
      'Recipient must be a valid Stellar G... public key',
      'Amount must be a positive decimal with up to 7 fractional digits',
    ]);
    expect(result.rows[1].errors).toEqual([
      'Recipient is required',
      'Amount must be greater than zero',
    ]);
  });

  it('accepts quoted CSV fields and recipient header aliases', () => {
    const result = parseBulkPayoutCsv(`to,amount,signed_xdr\n"${VALID_RECIPIENT}","25","xdr-1"`);

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      recipient: VALID_RECIPIENT,
      amount: '25',
      signedTransactionXdr: 'xdr-1',
    });
  });

  it('reports missing required headers as an invalid preview row', () => {
    const result = parseBulkPayoutCsv('recipient,memo\nGABC,payroll');

    expect(result.rows).toHaveLength(1);
    expect(result.invalidRows[0].errors).toEqual(['Missing required column: amount']);
  });

  it('rejects amounts above the Stellar int64 asset limit', () => {
    const result = parseBulkPayoutCsv(`recipient,amount\n${VALID_RECIPIENT},922337203685.4775808`);

    expect(result.invalidRows[0].errors).toEqual([
      'Amount exceeds the Stellar maximum asset amount',
    ]);
  });
});

describe('bulk payout execution queue', () => {
  it('executes rows sequentially and reports failed rows', async () => {
    const parsed = parseBulkPayoutCsv(
      `recipient,amount\n${VALID_RECIPIENT},1\n${VALID_RECIPIENT},2`
    );
    const submitPayout = vi.fn(async ({ amount }: { amount: string }) => {
      if (amount === '2') {
        throw new Error('insufficient balance');
      }
    });

    const summary = await executeBulkPayoutBatch(parsed.validRows, submitPayout);

    expect(submitPayout).toHaveBeenCalledTimes(2);
    expect(summary.successful).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.results[1]).toMatchObject({
      status: 'failed',
      error: 'insufficient balance',
    });
  });

  it('submits payouts to the relayer with idempotency and surfaces relay failures', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Missing required parameter: signedTransactionXdr' },
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
    );
    const submitPayout = createRelayerPayoutSubmitter({
      baseUrl: 'https://relayer.test/',
      getAuthToken: () => 'token-1',
      fetchImpl,
      buildRelayRequest: (submission) => ({
        sessionKey: 'a'.repeat(64),
        operation: 'relay_execute',
        parameters: { to: submission.recipient, amount: submission.amount, asset: 'XLM' },
        signature: 'b'.repeat(128),
        nonce: 1,
      }),
    });

    await expect(
      submitPayout({
        recipient: VALID_RECIPIENT,
        amount: '10',
        idempotencyKey: 'bulk-payout-row-1',
      })
    ).rejects.toThrow('Missing required parameter: signedTransactionXdr');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://relayer.test/relay/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-1',
          'Idempotency-Key': 'bulk-payout-row-1',
        }),
      })
    );
  });
});

import {
  DEFAULT_PAYMENT_REQUEST_TTL_SECONDS,
  MAX_PAYMENT_REQUEST_TTL_SECONDS,
  PaymentRequestPayloadSchema,
  PaymentRequestSchema,
  createPaymentRequestSchema,
} from '../payment-request';

const VALID_ADDRESS = `G${'A'.repeat(55)}`;

describe('createPaymentRequestSchema', () => {
  const validInput = {
    requesterAddress: VALID_ADDRESS,
    amount: '25.5',
    assetCode: 'USDC',
  };

  it('accepts a minimal valid input', () => {
    const parsed = createPaymentRequestSchema.parse(validInput);
    expect(parsed.requesterAddress).toBe(VALID_ADDRESS);
    expect(parsed.amount).toBe('25.5');
    expect(parsed.ttlSeconds).toBeUndefined();
  });

  it('rejects a requesterAddress that is not a Stellar public key', () => {
    expect(() =>
      createPaymentRequestSchema.parse({ ...validInput, requesterAddress: 'not-an-address' })
    ).toThrow(/valid Stellar public key/);
  });

  it('rejects a contract (C...) address in requesterAddress', () => {
    expect(() =>
      createPaymentRequestSchema.parse({ ...validInput, requesterAddress: `C${'A'.repeat(55)}` })
    ).toThrow(/valid Stellar public key/);
  });

  it.each(['0', '-5', 'abc', '', '1.2.3', '1e5'])('rejects the invalid amount %p', (amount) => {
    expect(() => createPaymentRequestSchema.parse({ ...validInput, amount })).toThrow();
  });

  it('rejects a non-alphanumeric asset code', () => {
    expect(() => createPaymentRequestSchema.parse({ ...validInput, assetCode: 'US DC' })).toThrow(
      /alphanumeric/
    );
  });

  it('rejects an asset code longer than 12 characters', () => {
    expect(() =>
      createPaymentRequestSchema.parse({ ...validInput, assetCode: 'A'.repeat(13) })
    ).toThrow(/12 characters/);
  });

  it('rejects a note longer than 200 characters', () => {
    expect(() =>
      createPaymentRequestSchema.parse({ ...validInput, note: 'x'.repeat(201) })
    ).toThrow(/200 characters/);
  });

  it('accepts a ttlSeconds at the maximum bound', () => {
    const parsed = createPaymentRequestSchema.parse({
      ...validInput,
      ttlSeconds: MAX_PAYMENT_REQUEST_TTL_SECONDS,
    });
    expect(parsed.ttlSeconds).toBe(MAX_PAYMENT_REQUEST_TTL_SECONDS);
  });

  it('rejects a ttlSeconds beyond the maximum bound', () => {
    expect(() =>
      createPaymentRequestSchema.parse({
        ...validInput,
        ttlSeconds: MAX_PAYMENT_REQUEST_TTL_SECONDS + 1,
      })
    ).toThrow(/at most 30 days/);
  });

  it.each([0, -1, 1.5])('rejects the non-positive-integer ttlSeconds %p', (ttlSeconds) => {
    expect(() => createPaymentRequestSchema.parse({ ...validInput, ttlSeconds })).toThrow();
  });

  it('exposes a 24 h default TTL constant', () => {
    expect(DEFAULT_PAYMENT_REQUEST_TTL_SECONDS).toBe(86_400);
  });
});

describe('PaymentRequestSchema', () => {
  const validRequest = {
    id: 'req_1',
    requesterAddress: VALID_ADDRESS,
    amount: '10',
    assetCode: 'XLM',
    expiresAt: 1_700_086_400,
    createdAt: 1_700_000_000,
  };

  it('accepts a valid request', () => {
    expect(PaymentRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('rejects an empty id', () => {
    expect(() => PaymentRequestSchema.parse({ ...validRequest, id: '' })).toThrow();
  });

  it.each(['expiresAt', 'createdAt'] as const)('rejects a non-positive-integer %s', (field) => {
    expect(() => PaymentRequestSchema.parse({ ...validRequest, [field]: -1 })).toThrow();
    expect(() => PaymentRequestSchema.parse({ ...validRequest, [field]: 1.5 })).toThrow();
  });
});

describe('PaymentRequestPayloadSchema', () => {
  const validPayload = {
    id: 'req_1',
    to: VALID_ADDRESS,
    amount: '10',
    asset: 'XLM',
    exp: 1_700_086_400,
  };

  it('accepts a valid payload', () => {
    expect(PaymentRequestPayloadSchema.parse(validPayload)).toEqual(validPayload);
  });

  it('rejects a payload whose decoded address is malformed', () => {
    expect(() => PaymentRequestPayloadSchema.parse({ ...validPayload, to: 'GABC' })).toThrow(
      /valid Stellar public key/
    );
  });

  it('rejects a payload with a zero amount', () => {
    expect(() => PaymentRequestPayloadSchema.parse({ ...validPayload, amount: '0' })).toThrow();
  });
});

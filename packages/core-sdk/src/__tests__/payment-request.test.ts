import { parsePaymentRequest } from '../payment-request';
import { PaymentRequestValidationError } from '../errors';

const VALID_ADDRESS = 'GDQERENWDDSQZS7R7WKHZI3BSOYMV3FSWR7TFUYFTKQ447PIX6NREOJM';
const VALID_ISSUER = 'GDQERENWDDSQZS7R7WKHZI3BSOYMV3FSWR7TFUYFTKQ447PIX6NREOJM';

describe('PaymentRequest Parser', () => {
  describe('parsePaymentRequest', () => {
    it('successfully parses a valid minimal payload', () => {
      const payload = {
        destination: VALID_ADDRESS,
        amount: '10.5',
      };

      const result = parsePaymentRequest(payload);

      expect(result.destination).toBe(VALID_ADDRESS);
      expect(result.amount).toBe('10.5');
      expect(result.asset).toBe('native');
    });

    it('successfully parses a valid full payload', () => {
      const payload = {
        destination: VALID_ADDRESS,
        amount: '100',
        asset: {
          code: 'USDC',
          issuer: VALID_ISSUER,
        },
        memo: 'Order #123',
        memoType: 'text',
        label: 'My Shop',
        message: 'Thanks for your purchase!',
        callbackUrl: 'https://example.com/callback',
        extra: {
          orderId: 'abc-123',
        },
      };

      const result = parsePaymentRequest(payload);

      expect(result).toEqual({
        destination: VALID_ADDRESS,
        amount: '100',
        asset: {
          code: 'USDC',
          issuer: VALID_ISSUER,
        },
        memo: 'Order #123',
        memoType: 'text',
        label: 'My Shop',
        message: 'Thanks for your purchase!',
        callbackUrl: 'https://example.com/callback',
        extra: {
          orderId: 'abc-123',
        },
      });
    });

    it('normalizes asset: "native"', () => {
      const payload = {
        destination: VALID_ADDRESS,
        amount: '10',
        asset: 'native',
      };

      const result = parsePaymentRequest(payload);
      expect(result.asset).toBe('native');
    });

    it('throws when payload is not an object', () => {
      expect(() => parsePaymentRequest(null)).toThrow(PaymentRequestValidationError);
      expect(() => parsePaymentRequest('string')).toThrow(PaymentRequestValidationError);
    });

    it('throws when destination is missing or invalid', () => {
      expect(() => parsePaymentRequest({ amount: '10' })).toThrow(
        'destination is required and must be a valid Stellar public key.'
      );
      expect(() => parsePaymentRequest({ destination: 'invalid', amount: '10' })).toThrow(
        PaymentRequestValidationError
      );
    });

    it('throws when amount is missing or invalid', () => {
      expect(() => parsePaymentRequest({ destination: VALID_ADDRESS })).toThrow(
        'amount is required and must be a non-empty string.'
      );
      expect(() => parsePaymentRequest({ destination: VALID_ADDRESS, amount: '' })).toThrow(
        PaymentRequestValidationError
      );
      expect(() => parsePaymentRequest({ destination: VALID_ADDRESS, amount: 'abc' })).toThrow(
        'amount must be a positive numeric string.'
      );
      expect(() => parsePaymentRequest({ destination: VALID_ADDRESS, amount: '-1' })).toThrow(
        PaymentRequestValidationError
      );
    });

    it('throws when asset object is malformed', () => {
      expect(() =>
        parsePaymentRequest({
          destination: VALID_ADDRESS,
          amount: '10',
          asset: { code: 'USDC' },
        })
      ).toThrow('Asset object must contain "code" and "issuer" strings.');

      expect(() =>
        parsePaymentRequest({
          destination: VALID_ADDRESS,
          amount: '10',
          asset: { code: 'USDC', issuer: 'invalid' },
        })
      ).toThrow('Asset issuer must be a valid Stellar public key.');
    });

    it('throws when memoType is invalid', () => {
      expect(() =>
        parsePaymentRequest({
          destination: VALID_ADDRESS,
          amount: '10',
          memo: 'test',
          memoType: 'invalid',
        })
      ).toThrow('memoType must be one of: text, id, hash, return.');
    });

    it('ignores non-string label/message/callbackUrl', () => {
      const payload = {
        destination: VALID_ADDRESS,
        amount: '10',
        label: 123,
        message: true,
        callbackUrl: {},
      };

      const result = parsePaymentRequest(payload);
      expect(result.label).toBeUndefined();
      expect(result.message).toBeUndefined();
      expect(result.callbackUrl).toBeUndefined();
    });
  });
});

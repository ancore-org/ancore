import { describe, expect, it } from 'vitest';

import { mapMerchantMetadata, normalizeMerchantVerificationStatus } from './merchant-metadata';

describe('merchant metadata mapping', () => {
  it('normalizes Horizon/indexer verification states', () => {
    expect(normalizeMerchantVerificationStatus('verified')).toBe('verified');
    expect(normalizeMerchantVerificationStatus('pending_review')).toBe('pending');
    expect(normalizeMerchantVerificationStatus('not_verified')).toBe('unverified');
    expect(normalizeMerchantVerificationStatus('mystery')).toBe('unknown');
  });

  it('maps merchant metadata into dashboard badge props', () => {
    expect(
      mapMerchantMetadata({
        merchant_name: 'Acme Treasury',
        merchant_verification_status: 'verified',
      })
    ).toEqual({ name: 'Acme Treasury', verificationStatus: 'verified' });
  });
});

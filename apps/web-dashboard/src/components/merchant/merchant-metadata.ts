import type { MerchantBadgeStatus } from '@ancore/ui-kit';

export interface MerchantMetadataSource {
  merchant?: {
    name?: string | null;
    verificationStatus?: string | null;
  } | null;
  merchant_name?: string | null;
  merchant_verification_status?: string | null;
  verification_status?: string | null;
}

export interface MerchantMetadata {
  name: string;
  verificationStatus: MerchantBadgeStatus;
}

export function normalizeMerchantVerificationStatus(value?: string | null): MerchantBadgeStatus {
  const normalized = value?.toLowerCase().replace(/[-\s]/g, '_');

  if (normalized === 'verified') {
    return 'verified';
  }
  if (normalized === 'pending' || normalized === 'pending_review') {
    return 'pending';
  }
  if (normalized === 'unverified' || normalized === 'not_verified') {
    return 'unverified';
  }
  return 'unknown';
}

export function mapMerchantMetadata(source: MerchantMetadataSource): MerchantMetadata | null {
  const name = source.merchant?.name ?? source.merchant_name ?? null;

  if (!name) {
    return null;
  }

  return {
    name,
    verificationStatus: normalizeMerchantVerificationStatus(
      source.merchant?.verificationStatus ??
        source.merchant_verification_status ??
        source.verification_status ??
        null
    ),
  };
}

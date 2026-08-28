/**
 * Unit tests for ancore:// deep link routing (#1058)
 *
 * Covers wc (WalletConnect pairing), pay (Stellar payment URI),
 * and navigate paths — independently of full WalletConnect e2e.
 */

import {
  ANCORE_DEEP_LINK_PREFIX,
  getWalletConnectNavigationState,
  mobileWalletDeepLinking,
} from '../deepLinkConfig';
import { parseWalletConnectDeepLink, isWalletConnectDeepLink } from '../walletconnect';
import { parsePaymentUri } from '../paymentUri';

const VALID_DEST = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

// ── ancore://wc ────────────────────────────────────────────────────────────

describe('ancore://wc deep links', () => {
  it('parses a simple wc pairing URI', () => {
    const url = `${ANCORE_DEEP_LINK_PREFIX}wc?uri=wc:abc123`;
    expect(parseWalletConnectDeepLink(url)).toEqual({ uri: 'wc:abc123' });
  });

  it('parses a v2 pairing URI with nested query params', () => {
    const url = `${ANCORE_DEEP_LINK_PREFIX}wc?uri=wc:abc@2?relay-protocol=irn&symKey=xyz`;
    expect(parseWalletConnectDeepLink(url)).toEqual({
      uri: 'wc:abc@2?relay-protocol=irn&symKey=xyz',
    });
  });

  it('returns null when uri param is missing', () => {
    expect(parseWalletConnectDeepLink(`${ANCORE_DEEP_LINK_PREFIX}wc?other=value`)).toBeNull();
  });

  it('returns null when URI value is not a wc: URI', () => {
    expect(
      parseWalletConnectDeepLink(`${ANCORE_DEEP_LINK_PREFIX}wc?uri=https://evil.example`)
    ).toBeNull();
  });

  it('returns null for completely unrelated URLs', () => {
    expect(parseWalletConnectDeepLink('https://example.com')).toBeNull();
    expect(parseWalletConnectDeepLink('')).toBeNull();
  });

  it('isWalletConnectDeepLink detects wc paths', () => {
    expect(isWalletConnectDeepLink(`${ANCORE_DEEP_LINK_PREFIX}wc?uri=wc:x`)).toBe(true);
    expect(isWalletConnectDeepLink(`${ANCORE_DEEP_LINK_PREFIX}pay?destination=${VALID_DEST}`)).toBe(
      false
    );
  });

  it('resolves navigation state for wc deep link', () => {
    const url = `${ANCORE_DEEP_LINK_PREFIX}wc?uri=wc:abc123`;
    expect(getWalletConnectNavigationState(url)).toEqual({
      routes: [{ name: 'WCPairing', params: { uri: 'wc:abc123' } }],
    });
  });

  it('getStateFromPath resolves path-only wc link', () => {
    expect(mobileWalletDeepLinking.getStateFromPath('wc?uri=wc:abc123')).toEqual({
      routes: [{ name: 'WCPairing', params: { uri: 'wc:abc123' } }],
    });
  });
});

// ── ancore://pay (Stellar payment URI) ────────────────────────────────────

describe('ancore://pay — Stellar payment URI paths', () => {
  it('parses stellar:pay with destination and amount', () => {
    expect(parsePaymentUri(`stellar:pay?destination=${VALID_DEST}&amount=10`)).toEqual({
      dest: VALID_DEST,
      amount: '10',
    });
  });

  it('parses web+stellar:pay without amount', () => {
    expect(parsePaymentUri(`web+stellar:pay?destination=${VALID_DEST}`)).toEqual({
      dest: VALID_DEST,
    });
  });

  it('accepts fractional amounts up to 7 decimal places', () => {
    expect(
      parsePaymentUri(`stellar:pay?destination=${VALID_DEST}&amount=0.0000001`)
    ).not.toBeNull();
  });

  it('rejects zero amount', () => {
    expect(parsePaymentUri(`stellar:pay?destination=${VALID_DEST}&amount=0`)).toBeNull();
  });

  it('rejects amount with more than 7 decimal places', () => {
    expect(parsePaymentUri(`stellar:pay?destination=${VALID_DEST}&amount=1.123456789`)).toBeNull();
  });

  it('rejects missing destination', () => {
    expect(parsePaymentUri('stellar:pay?amount=10')).toBeNull();
  });

  it('rejects invalid destination checksum', () => {
    // Last char changed so checksum is wrong
    expect(
      parsePaymentUri(
        'stellar:pay?destination=GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W39'
      )
    ).toBeNull();
  });

  it('rejects non-pay stellar actions', () => {
    expect(parsePaymentUri(`stellar:tx?destination=${VALID_DEST}`)).toBeNull();
  });

  it('rejects unsupported schemes', () => {
    expect(parsePaymentUri(`ancore:pay?destination=${VALID_DEST}`)).toBeNull();
    expect(parsePaymentUri('not a uri')).toBeNull();
  });
});

// ── ancore://navigate (unhandled paths) ───────────────────────────────────

describe('ancore://navigate — unrecognised paths', () => {
  it('getStateFromPath returns undefined for unknown paths', () => {
    expect(mobileWalletDeepLinking.getStateFromPath('navigate?screen=Home')).toBeUndefined();
    expect(mobileWalletDeepLinking.getStateFromPath('settings')).toBeUndefined();
    expect(mobileWalletDeepLinking.getStateFromPath('')).toBeUndefined();
  });

  it('getWalletConnectNavigationState returns undefined for non-wc URLs', () => {
    expect(
      getWalletConnectNavigationState(`${ANCORE_DEEP_LINK_PREFIX}navigate?screen=Home`)
    ).toBeUndefined();
    expect(
      getWalletConnectNavigationState(`${ANCORE_DEEP_LINK_PREFIX}pay?destination=${VALID_DEST}`)
    ).toBeUndefined();
  });
});

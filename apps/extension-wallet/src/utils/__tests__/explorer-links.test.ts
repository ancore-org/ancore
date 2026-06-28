import { describe, it, expect } from 'vitest';
import { getTransactionExplorerLink, type StellarNetwork } from '@/utils/explorer-links';

describe('getTransactionExplorerLink', () => {
  it('generates correct mainnet explorer URL', () => {
    const hash = 'ABC123XYZ789';
    const expectedUrl = 'https://stellar.expert/explorer/public/tx/ABC123XYZ789';
    const result = getTransactionExplorerLink(hash, 'mainnet');
    expect(result).toBe(expectedUrl);
  });

  it('generates correct testnet explorer URL', () => {
    const hash = 'DEF456UVW012';
    const expectedUrl = 'https://stellar.expert/explorer/testnet/tx/DEF456UVW012';
    const result = getTransactionExplorerLink(hash, 'testnet');
    expect(result).toBe(expectedUrl);
  });

  it('generates correct futurenet explorer URL', () => {
    const hash = 'GHI789RST345';
    const expectedUrl = 'https://stellar.expert/explorer/futurenet/tx/GHI789RST345';
    const result = getTransactionExplorerLink(hash, 'futurenet');
    expect(result).toBe(expectedUrl);
  });

  it('defaults to mainnet when network is not specified', () => {
    const hash = 'JKL012MNO678';
    const expectedUrl = 'https://stellar.expert/explorer/public/tx/JKL012MNO678';
    const result = getTransactionExplorerLink(hash);
    expect(result).toBe(expectedUrl);
  });

  it('properly URL-encodes transaction hash', () => {
    const hash = 'HASH/WITH/SPECIAL/CHARS';
    const expectedUrl = 'https://stellar.expert/explorer/public/tx/HASH%2FWITH%2FSPECIAL%2FCHARS';
    const result = getTransactionExplorerLink(hash, 'mainnet');
    expect(result).toBe(expectedUrl);
  });

  it('handles all supported network types', () => {
    const hash = 'TESTHASH123';
    const networks: StellarNetwork[] = ['mainnet', 'testnet', 'futurenet'];
    const expectedUrls = [
      'https://stellar.expert/explorer/public/tx/TESTHASH123',
      'https://stellar.expert/explorer/testnet/tx/TESTHASH123',
      'https://stellar.expert/explorer/futurenet/tx/TESTHASH123',
    ];

    networks.forEach((network, index) => {
      const result = getTransactionExplorerLink(hash, network);
      expect(result).toBe(expectedUrls[index]);
    });
  });

  it('handles empty hash string', () => {
    const hash = '';
    const expectedUrl = 'https://stellar.expert/explorer/public/tx/';
    const result = getTransactionExplorerLink(hash, 'mainnet');
    expect(result).toBe(expectedUrl);
  });

  it('handles hash with special characters that need encoding', () => {
    const hash = 'a+b=c&d[e]';
    const expectedUrl = 'https://stellar.expert/explorer/testnet/tx/a%2Bb%3Dc%26d%5Be%5D';
    const result = getTransactionExplorerLink(hash, 'testnet');
    expect(result).toBe(expectedUrl);
  });
});

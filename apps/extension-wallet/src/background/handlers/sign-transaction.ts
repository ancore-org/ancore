import { BlockaidClient } from '@blockaid/client';

export async function handleSignTransaction(xdr: string) {
  const client = new BlockaidClient({ apiKey: 'mock-key' });
  const risk = await client.scanStellarTransaction(xdr);

  if (risk.verdict === 'Malicious') {
    throw new Error('Malicious transaction detected');
  }

  return { riskVerdict: risk.verdict, xdr };
}

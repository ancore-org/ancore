import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import StellarApp from '@ledgerhq/hw-app-str';

/**
 * Minimal WebHID-based signer for the Ledger Stellar app.
 *
 * This is a stub adapter, not a production-ready integration — it has no
 * transport lifecycle management, retry, or user-facing error mapping. See
 * "LedgerSigningAdapter" in the core-sdk README for supported app versions,
 * the hardcoded BIP44 path, error cases, and required browser permissions,
 * and https://github.com/ancore-org/ancore/issues/872 for the full-UX
 * follow-up (transport reuse, path selection, blind-signing detection).
 */
export class LedgerSigningAdapter {
  async sign(xdr: string): Promise<string> {
    const transport = await TransportWebHID.create();
    const app = new StellarApp(transport);
    const path = "44'/148'/0'";
    const result = await app.signTransaction(path, Buffer.from(xdr, 'base64'));
    return result.signature.toString('base64');
  }
}

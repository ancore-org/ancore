import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import StellarApp from '@ledgerhq/hw-app-str';

export class LedgerSigningAdapter {
  async sign(xdr: string): Promise<string> {
    const transport = await TransportWebHID.create();
    const app = new StellarApp(transport);
    const path = "44'/148'/0'";
    const result = await app.signTransaction(path, Buffer.from(xdr, 'base64'));
    return result.signature.toString('base64');
  }
}

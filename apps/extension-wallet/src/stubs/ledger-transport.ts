/** Browser-dev stub — real Ledger needs extension permissions + WebHID. */
export default class TransportWebHID {
  static async isSupported() {
    return false;
  }
  static async list() {
    return [];
  }
  static async create() {
    throw new Error('Ledger transport is not available in browser-dev preview');
  }
}

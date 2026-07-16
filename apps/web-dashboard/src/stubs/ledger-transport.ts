/** Browser stub for Ledger WebHID transport (not used in dashboard preview). */
export default class TransportWebHID {
  static async isSupported() {
    return false;
  }
  static async list() {
    return [];
  }
  static async create() {
    throw new Error('Ledger transport is not available in web dashboard preview');
  }
}

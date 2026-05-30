import { relayPayloadV1 } from '@ancore/test-fixtures';

describe('Cross-package Canonical Relay Payload (account-abstraction)', () => {
  it('should match the canonical test fixture structure', () => {
    expect(relayPayloadV1).toBeDefined();
    expect(typeof relayPayloadV1.sessionKey).toBe('string');
    expect(relayPayloadV1.sessionKey).toHaveLength(64);
    expect(relayPayloadV1.operation).toBe('relay_execute');
    expect(relayPayloadV1.parameters).toBeDefined();
    expect(relayPayloadV1.parameters.to).toBe(
      'GBHHL5543KUJHAWEBZZZIJHQP2EMYY3YPZS2WRJDQ7X6G5HC77625CW7'
    );
    expect(relayPayloadV1.parameters.amount).toBe('100');
    expect(relayPayloadV1.parameters.asset).toBe('XLM');
    expect(typeof relayPayloadV1.signature).toBe('string');
    expect(relayPayloadV1.signature).toHaveLength(128);
    expect(typeof relayPayloadV1.nonce).toBe('number');
    expect(relayPayloadV1.nonce).toBe(42);
  });
});

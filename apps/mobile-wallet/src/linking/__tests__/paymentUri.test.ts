import { parsePaymentUri } from '../paymentUri';

const DESTINATION = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

describe('parsePaymentUri', () => {
  it('parses stellar pay URIs with destination and amount', () => {
    expect(parsePaymentUri(`stellar:pay?destination=${DESTINATION}&amount=12.5`)).toEqual({
      dest: DESTINATION,
      amount: '12.5',
    });
  });

  it('parses web+stellar pay URIs without an amount', () => {
    expect(parsePaymentUri(`web+stellar:pay?destination=${DESTINATION}`)).toEqual({
      dest: DESTINATION,
    });
  });

  it('returns null for unsupported actions, missing destination, and invalid amounts', () => {
    expect(parsePaymentUri(`stellar:tx?destination=${DESTINATION}`)).toBeNull();
    expect(parsePaymentUri('stellar:pay?amount=1')).toBeNull();
    expect(parsePaymentUri(`stellar:pay?destination=${DESTINATION}&amount=0`)).toBeNull();
    expect(parsePaymentUri(`stellar:pay?destination=${DESTINATION}&amount=1.123456789`)).toBeNull();
    expect(
      parsePaymentUri(
        'stellar:pay?destination=GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W39'
      )
    ).toBeNull();
    expect(parsePaymentUri('not a uri')).toBeNull();
  });
});

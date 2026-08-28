import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import {
  LedgerSigningAdapter,
  LedgerErrorCode,
  LedgerSigningError,
  mapLedgerError,
  stellarBip44Path,
  type LedgerStellarAppLike,
  type LedgerTransportLike,
} from '../ledger-adapter';

function buildUnsignedPaymentXdr(source: Keypair): string {
  const account = new Account(source.publicKey(), '1');
  return new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: '1',
      })
    )
    .setTimeout(30)
    .build()
    .toXDR();
}

function createMockTransport(): LedgerTransportLike & { closed: boolean } {
  const transport = {
    closed: false,
    async close() {
      transport.closed = true;
    },
  };
  return transport;
}

describe('stellarBip44Path', () => {
  it("builds m/44'/148'/n' paths", () => {
    expect(stellarBip44Path(0)).toBe("44'/148'/0'");
    expect(stellarBip44Path(3)).toBe("44'/148'/3'");
  });

  it('rejects negative indexes', () => {
    expect(() => stellarBip44Path(-1)).toThrow(/Invalid Stellar BIP-44/);
  });
});

describe('mapLedgerError', () => {
  it('maps user rejection status codes', () => {
    const mapped = mapLedgerError({ statusCode: 0x6985, message: 'deny' });
    expect(mapped).toBeInstanceOf(LedgerSigningError);
    expect(mapped.code).toBe(LedgerErrorCode.USER_REJECTED);
  });

  it('maps locked device', () => {
    expect(mapLedgerError(new Error('Locked device')).code).toBe(LedgerErrorCode.LOCKED);
  });

  it('maps app-not-open hints', () => {
    expect(mapLedgerError(new Error('app does not seem to be open')).code).toBe(
      LedgerErrorCode.APP_NOT_OPEN
    );
  });
});

describe('LedgerSigningAdapter', () => {
  const deviceKey = Keypair.random();
  let transport: ReturnType<typeof createMockTransport>;
  let app: jest.Mocked<LedgerStellarAppLike>;
  let adapter: LedgerSigningAdapter;

  beforeEach(() => {
    transport = createMockTransport();
    app = {
      getAppConfiguration: jest.fn().mockResolvedValue({
        version: '5.0.0',
        hashSigningEnabled: false,
      }),
      getPublicKey: jest.fn().mockResolvedValue({
        rawPublicKey: Buffer.from(deviceKey.rawPublicKey()),
      }),
      signTransaction: jest
        .fn()
        .mockImplementation(async (_path: string, signatureBase: Buffer) => {
          const signature = deviceKey.sign(signatureBase);
          return { signature };
        }),
      signSorobanAuthorization: jest.fn().mockResolvedValue({
        signature: Buffer.alloc(64, 1),
      }),
    };

    adapter = new LedgerSigningAdapter({
      accountIndex: 2,
      transportFactory: {
        isSupported: async () => true,
        create: async () => transport,
      },
      createApp: () => app,
    });
  });

  afterEach(async () => {
    await adapter.disconnect();
  });

  it('connects, reads app info, and disconnects', async () => {
    const info = await adapter.connect();
    expect(info.version).toBe('5.0.0');
    expect(adapter.isConnected).toBe(true);
    expect(adapter.path).toBe("44'/148'/2'");

    await adapter.disconnect();
    expect(adapter.isConnected).toBe(false);
    expect(transport.closed).toBe(true);
  });

  it('returns a G-address from getPublicKey', async () => {
    await adapter.connect();
    const result = await adapter.getPublicKey();
    expect(result.publicKey).toBe(deviceKey.publicKey());
    expect(result.path).toBe("44'/148'/2'");
    expect(app.getPublicKey).toHaveBeenCalledWith("44'/148'/2'", false);
  });

  it('signs a transaction envelope and returns signed XDR', async () => {
    await adapter.connect();
    const unsigned = buildUnsignedPaymentXdr(deviceKey);
    const signedXdr = await adapter.sign(unsigned, Networks.TESTNET);

    const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    expect(signed.signatures).toHaveLength(1);
    expect(app.signTransaction).toHaveBeenCalled();
  });

  it('signs a Soroban auth entry when supported', async () => {
    await adapter.connect();
    const sig = await adapter.signAuthEntry(Buffer.alloc(32).toString('base64'));
    expect(sig).toBe(Buffer.alloc(64, 1).toString('base64'));
  });

  it('maps device rejection during sign', async () => {
    await adapter.connect();
    app.signTransaction.mockRejectedValueOnce({ statusCode: 0x6985, message: 'User refused' });
    await expect(
      adapter.sign(buildUnsignedPaymentXdr(deviceKey), Networks.TESTNET)
    ).rejects.toMatchObject({ code: LedgerErrorCode.USER_REJECTED });
  });

  it('fails connect when WebHID is unsupported', async () => {
    const unsupported = new LedgerSigningAdapter({
      transportFactory: {
        isSupported: async () => false,
        create: async () => transport,
      },
      createApp: () => app,
    });

    await expect(unsupported.connect()).rejects.toMatchObject({
      code: LedgerErrorCode.UNSUPPORTED,
    });
  });
});

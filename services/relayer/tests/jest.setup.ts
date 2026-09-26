jest.mock('@ancore/account-abstraction', () => ({
  getSessionKey: jest.fn().mockResolvedValue({
    publicKey: 'a'.repeat(64),
    permissions: [1],
    expiresAt: Date.now() + 60_000,
  }),
}));

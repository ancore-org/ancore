import { isDeviceCompromised } from '../jailbreak';

// Mock jail-monkey before importing the module under test
jest.mock('jail-monkey', () => ({
  isJailBroken: jest.fn(),
  isRooted: jest.fn(),
}));

describe('isDeviceCompromised', () => {
  let JailMonkey: { isJailBroken: jest.Mock; isRooted: jest.Mock };

  beforeEach(() => {
    jest.resetAllMocks();
    // Get fresh mock references
    JailMonkey = jest.requireMock('jail-monkey') as typeof JailMonkey;
  });

  it('returns false on a clean device', () => {
    JailMonkey.isJailBroken.mockReturnValue(false);
    JailMonkey.isRooted.mockReturnValue(false);

    expect(isDeviceCompromised()).toBe(false);
  });

  it('returns true when iOS device is jailbroken', () => {
    JailMonkey.isJailBroken.mockReturnValue(true);
    JailMonkey.isRooted.mockReturnValue(false);

    expect(isDeviceCompromised()).toBe(true);
  });

  it('returns true when Android device is rooted', () => {
    JailMonkey.isJailBroken.mockReturnValue(false);
    JailMonkey.isRooted.mockReturnValue(true);

    expect(isDeviceCompromised()).toBe(true);
  });

  it('returns true when device is both jailbroken and rooted', () => {
    JailMonkey.isJailBroken.mockReturnValue(true);
    JailMonkey.isRooted.mockReturnValue(true);

    expect(isDeviceCompromised()).toBe(true);
  });

  it('returns false when jail-monkey module is not installed', () => {
    // Simulate jail-monkey not being available by mocking the require to throw.
    jest.resetModules();
    jest.doMock('jail-monkey', () => {
      throw new Error('Native module not available');
    });

    // Re-import the module to pick up the new mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isDeviceCompromised: check } = require('../jailbreak');
    expect(check()).toBe(false);

    jest.resetModules();
  });
});

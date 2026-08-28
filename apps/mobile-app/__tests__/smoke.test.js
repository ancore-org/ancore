describe('@ancore/mobile-app scaffold', () => {
  it('package is present and test harness runs', () => {
    // Component-level RN tests are blocked on a full Jest/RN babel setup
    // (see open issue for host-app test harness). Package identity is enough for CI.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../package.json');
    expect(pkg.name).toBe('@ancore/mobile-app');
  });
});

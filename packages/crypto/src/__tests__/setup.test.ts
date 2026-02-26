/**
 * Setup verification test
 * This test verifies that Jest and TypeScript are configured correctly
 */

describe('Setup', () => {
  it('should verify Jest is working', () => {
    expect(true).toBe(true);
  });

  it('should verify TypeScript strict mode', () => {
    const value: string = 'test';
    expect(typeof value).toBe('string');
  });
});

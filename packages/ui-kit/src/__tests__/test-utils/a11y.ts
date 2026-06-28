import axe from 'axe-core';
import type { AxeResults, RunOptions } from 'axe-core';
import { expect } from 'vitest';

const defaultOptions: RunOptions = {
  rules: {
    'color-contrast': { enabled: false },
  },
};

function mergeOptions(options?: RunOptions): RunOptions {
  return {
    ...defaultOptions,
    ...options,
    rules: {
      ...defaultOptions.rules,
      ...options?.rules,
    },
  };
}

export async function runA11yCheck(
  container: Element | Document = document,
  options?: RunOptions
): Promise<AxeResults> {
  return axe.run(container, mergeOptions(options));
}

export async function expectNoA11yViolations(
  container: Element | Document = document,
  options?: RunOptions
): Promise<void> {
  const results = await runA11yCheck(container, options);
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target),
  }));

  expect(violations).toEqual([]);
}

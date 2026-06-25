import { ensureWebCrypto } from '../../../ensure-webcrypto';
import '@testing-library/jest-dom';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  ensureWebCrypto();
});

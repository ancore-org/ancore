import { beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('qrcode', () => ({
  default: {
    toCanvas: (
      _canvas: HTMLCanvasElement,
      _data: string,
      _opts: unknown,
      cb: (err: unknown) => void
    ) => cb(null),
  },
  toCanvas: (
    _canvas: HTMLCanvasElement,
    _data: string,
    _opts: unknown,
    cb: (err: unknown) => void
  ) => cb(null),
}));

import downloadQrPng from '../export-qr';

// Mock Canvas/Blob APIs
class FakeBlob {}

function createMockCanvas() {
  const canvas: Record<string, unknown> = {
    width: 1,
    height: 1,
    getContext: () => ({
      fillStyle: '',
      fillRect: () => {},
      drawImage: () => {},
      fillText: () => {},
    }),
    toBlob: (cb: (b: Blob | null) => void) => cb(new FakeBlob() as unknown as Blob),
  };
  return canvas;
}

describe('downloadQrPng', () => {
  beforeAll(() => {
    // @ts-expect-error jsdom canvas mock
    global.document.createElement = (tag: string) => {
      if (tag === 'canvas') return createMockCanvas();
      const el: Record<string, unknown> = {
        style: {},
        setAttribute: () => {},
        appendChild: () => {},
        click: () => {},
      };
      return el;
    };
    global.URL.createObjectURL = vi.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = vi.fn();
  });

  test('calls toBlob and resolves', async () => {
    await expect(
      downloadQrPng('GTESTADDRESS', { filename: 'foo.png', scale: 2 })
    ).resolves.toBeUndefined();
  });
});

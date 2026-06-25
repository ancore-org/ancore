import downloadQrPng from '../export-qr';

// Mock Canvas/Blob APIs
class FakeBlob {}

function createMockCanvas() {
  const canvas: any = {
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
    // @ts-ignore
    global.document.createElement = (tag: string) => {
      if (tag === 'canvas') return createMockCanvas();
      const el: any = { style: {}, setAttribute: () => {}, appendChild: () => {} };
      return el;
    };
    // Mock dynamic import of 'qrcode'
    // @ts-ignore
    jest.mock('qrcode', () => ({
      toCanvas: (_canvas: HTMLCanvasElement, _data: string, _opts: any, cb: any) => cb(null),
    }));
  });

  test('calls toBlob and resolves', async () => {
    await expect(downloadQrPng('GTESTADDRESS', { filename: 'foo.png', scale: 2 })).resolves.toBeUndefined();
  });
});

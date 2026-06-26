export type DownloadQrOptions = {
  filename?: string;
  scale?: number; // device pixel ratio multiplier (2 or 3)
  logo?: HTMLImageElement | string; // Image element or URL to draw as footer/brand
};

async function dynamicImportQRCode() {
  try {
    // Try dynamic import of 'qrcode' if available in the environment
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const QR = await import('qrcode');
    return QR;
  } catch {
    throw new Error('QR generation library not available');
  }
}

export async function downloadQrPng(value: string, opts: DownloadQrOptions = {}): Promise<void> {
  const { filename = `ancore-${value.slice(0, 8)}.png`, scale = 2, logo } = opts;

  const QR = await dynamicImportQRCode();

  const size = 256;
  const canvas = document.createElement('canvas');
  const scaled = Math.max(1, Math.floor(scale));
  canvas.width = size * scaled;
  canvas.height = (size + 48) * scaled; // reserve footer space
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw QR into an offscreen canvas using the qrcode library
  await new Promise<void>((resolve, reject) => {
    // QR.toCanvas accepts canvas and options
    QR.toCanvas(
      canvas,
      value,
      {
        width: size * scaled,
        margin: 1 * scaled,
        color: { dark: '#000000', light: '#ffffff' },
      },
      (err: unknown) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

  // Draw footer (wordmark or text)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, size * scaled, canvas.width, 48 * scaled);
  ctx.fillStyle = '#111827';
  ctx.font = `${14 * scaled}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const footerText = 'Ancore';
  ctx.fillText(footerText, canvas.width / 2, (size + 24) * scaled);

  // Optional logo drawing: if provided as URL, create Image
  if (logo) {
    await new Promise<void>((resolve, reject) => {
      const img = typeof logo === 'string' ? new Image() : (logo as HTMLImageElement);
      if (typeof logo === 'string') img.src = logo;
      img.onload = () => {
        const h = 24 * scaled;
        const w = (img.width / img.height) * h;
        ctx.drawImage(img, 8 * scaled, size * scaled + (48 * scaled - h) / 2, w, h);
        resolve();
      };
      img.onerror = () => resolve();
      // If pre-supplied Image element is already complete
      if (img.complete && img.naturalWidth) resolve();
    });
  }

  // Convert to blob and trigger download
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export default downloadQrPng;

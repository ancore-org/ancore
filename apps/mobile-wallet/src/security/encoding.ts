export class EncodingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncodingError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncodingError);
    }
  }
}

export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';

  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  try {
    return globalThis.btoa(binary);
  } catch (error) {
    throw new EncodingError('Failed to generate base64 string from source bytes.');
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  const sanitized = base64.trim();

  if (!base64Regex.test(sanitized) || sanitized.length % 4 !== 0) {
    throw new EncodingError('invalid base64');
  }

  let binary: string;

  try {
    binary = globalThis.atob(sanitized);
  } catch (rawError) {
    throw new EncodingError('invalid base64');
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function toBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(bytes);
}

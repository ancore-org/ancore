import { useState, useCallback } from 'react';
import type {
  PaymentRequest,
  CreatePaymentRequestInput,
  PaymentRequestPayload,
} from '@ancore/types';

function generateId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function encodeRequestToUrl(req: PaymentRequest, baseUrl: string): string {
  const payload: PaymentRequestPayload = {
    id: req.id,
    to: req.requesterAddress,
    amount: req.amount,
    asset: req.assetCode,
    note: req.note,
    exp: req.expiresAt,
  };
  const encoded = btoa(JSON.stringify(payload));
  return `${baseUrl}?req=${encodeURIComponent(encoded)}`;
}

function decodeRequestFromUrl(url: string): PaymentRequest | null {
  try {
    const params = new URL(url).searchParams;
    const encoded = params.get('req');
    if (!encoded) return null;
    const payload: PaymentRequestPayload = JSON.parse(atob(decodeURIComponent(encoded)));
    return {
      id: payload.id,
      requesterAddress: payload.to,
      amount: payload.amount,
      assetCode: payload.asset,
      note: payload.note,
      expiresAt: payload.exp,
      createdAt: 0,
    };
  } catch {
    return null;
  }
}

function isExpired(req: PaymentRequest): boolean {
  return Math.floor(Date.now() / 1000) > req.expiresAt;
}

export interface UsePaymentRequestReturn {
  requests: PaymentRequest[];
  createRequest: (input: CreatePaymentRequestInput) => PaymentRequest;
  getShareUrl: (req: PaymentRequest) => string;
  decodeFromUrl: (url: string) => PaymentRequest | null;
  isExpired: (req: PaymentRequest) => boolean;
  clearRequests: () => void;
}

export function usePaymentRequest(baseUrl?: string): UsePaymentRequestReturn {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  const createRequest = useCallback((input: CreatePaymentRequestInput): PaymentRequest => {
    const now = Math.floor(Date.now() / 1000);
    const req: PaymentRequest = {
      id: generateId(),
      requesterAddress: input.requesterAddress,
      amount: input.amount,
      assetCode: input.assetCode,
      note: input.note,
      expiresAt: now + (input.ttlSeconds ?? 86400),
      createdAt: now,
    };
    setRequests((prev) => [req, ...prev]);
    return req;
  }, []);

  const getShareUrl = useCallback(
    (req: PaymentRequest): string => {
      const base = baseUrl ?? window.location.origin;
      return encodeRequestToUrl(req, base);
    },
    [baseUrl]
  );

  const clearRequests = useCallback(() => setRequests([]), []);

  return {
    requests,
    createRequest,
    getShareUrl,
    decodeFromUrl: decodeRequestFromUrl,
    isExpired,
    clearRequests,
  };
}

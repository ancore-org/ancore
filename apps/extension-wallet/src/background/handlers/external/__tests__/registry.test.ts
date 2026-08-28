/**
 * Unit tests for external handler registry
 */

import {
  registerExternalHandler,
  unregisterExternalHandler,
  getExternalHandler,
  hasExternalHandler,
  getRegisteredMethods,
  dispatchExternalRequest,
  clearExternalHandlers,
} from '../registry';
import type { ExternalHandlerContext } from '@ancore/types';

describe('external handler registry', () => {
  beforeEach(() => {
    clearExternalHandlers();
  });

  describe('registerExternalHandler', () => {
    it('registers a handler', () => {
      const handler = async () => ({ result: 'test' });
      registerExternalHandler('requestAccess' as any, handler);

      expect(hasExternalHandler('requestAccess' as any)).toBe(true);
    });

    it('replaces existing handler', () => {
      const handler1 = async () => ({ result: 'test1' });
      const handler2 = async () => ({ result: 'test2' });

      registerExternalHandler('requestAccess' as any, handler1);
      registerExternalHandler('requestAccess' as any, handler2);

      const registered = getExternalHandler('requestAccess' as any);
      expect(registered).toBe(handler2);
    });
  });

  describe('unregisterExternalHandler', () => {
    it('unregisters a handler', () => {
      const handler = async () => ({ result: 'test' });
      registerExternalHandler('requestAccess' as any, handler);
      unregisterExternalHandler('requestAccess' as any);

      expect(hasExternalHandler('requestAccess' as any)).toBe(false);
    });

    it('handles unregistering non-existent handler', () => {
      expect(() => unregisterExternalHandler('requestAccess' as any)).not.toThrow();
    });
  });

  describe('getExternalHandler', () => {
    it('returns registered handler', () => {
      const handler = async () => ({ result: 'test' });
      registerExternalHandler('requestAccess' as any, handler);

      const result = getExternalHandler('requestAccess' as any);
      expect(result).toBe(handler);
    });

    it('returns undefined for non-existent handler', () => {
      const result = getExternalHandler('requestAccess' as any);
      expect(result).toBeUndefined();
    });
  });

  describe('hasExternalHandler', () => {
    it('returns true for registered handler', () => {
      const handler = async () => ({ result: 'test' });
      registerExternalHandler('requestAccess' as any, handler);

      expect(hasExternalHandler('requestAccess' as any)).toBe(true);
    });

    it('returns false for non-existent handler', () => {
      expect(hasExternalHandler('requestAccess' as any)).toBe(false);
    });
  });

  describe('getRegisteredMethods', () => {
    it('returns array of registered method names', () => {
      registerExternalHandler('requestAccess' as any, async () => ({}));
      registerExternalHandler('getAddress' as any, async () => ({}));

      const result = getRegisteredMethods();
      expect(result).toEqual(['requestAccess', 'getAddress']);
    });

    it('returns empty array when no handlers registered', () => {
      const result = getRegisteredMethods();
      expect(result).toEqual([]);
    });
  });

  describe('dispatchExternalRequest', () => {
    it('dispatches to registered handler', async () => {
      const handler = async (ctx: ExternalHandlerContext) => ({
        origin: ctx.origin,
      });
      registerExternalHandler('requestAccess' as any, handler);

      const ctx: ExternalHandlerContext = {
        origin: 'https://example.com',
        params: {},
        requestId: '123',
        sender: {},
      };

      const result = await dispatchExternalRequest('requestAccess' as any, ctx);
      expect(result).toEqual({ origin: 'https://example.com' });
    });

    it('throws error for unknown method', async () => {
      const ctx: ExternalHandlerContext = {
        origin: 'https://example.com',
        params: {},
        requestId: '123',
        sender: {},
      };

      await expect(dispatchExternalRequest('unknownMethod' as any, ctx)).rejects.toThrow(
        'Unknown external API method: unknownMethod'
      );
    });

    it('propagates handler errors', async () => {
      const handler = async () => {
        throw new Error('Handler error');
      };
      registerExternalHandler('requestAccess' as any, handler);

      const ctx: ExternalHandlerContext = {
        origin: 'https://example.com',
        params: {},
        requestId: '123',
        sender: {},
      };

      await expect(dispatchExternalRequest('requestAccess' as any, ctx)).rejects.toThrow(
        'Handler error'
      );
    });
  });

  describe('clearExternalHandlers', () => {
    it('clears all registered handlers', () => {
      registerExternalHandler('requestAccess' as any, async () => ({}));
      registerExternalHandler('getAddress' as any, async () => ({}));

      clearExternalHandlers();

      expect(getRegisteredMethods()).toEqual([]);
    });
  });
});

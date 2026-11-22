import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import {
  getFocusableElements,
  setupFocusTrap,
  createSkipLink,
  focusElement,
  isAccessible,
  checkKeyboardAccessibility,
} from '../accessibility';

describe('accessibility utilities', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('getFocusableElements', () => {
    it('returns buttons, links and inputs', () => {
      container.innerHTML = `
        <button id="btn">Button</button>
        <a id="link" href="#foo">Link</a>
        <input id="input" type="text" />
      `;

      const elements = getFocusableElements(container);

      expect(elements).toHaveLength(3);
      expect(elements.map((el) => el.id)).toEqual(['btn', 'link', 'input']);
    });

    it('skips disabled elements', () => {
      container.innerHTML = `
        <button id="enabled">Enabled</button>
        <button id="disabled" disabled>Disabled</button>
        <input id="disabled-input" type="text" disabled />
      `;

      const elements = getFocusableElements(container);

      expect(elements.map((el) => el.id)).toEqual(['enabled']);
    });

    it('skips elements with tabindex="-1"', () => {
      container.innerHTML = `
        <button id="focusable">Focusable</button>
        <button id="not-focusable" tabindex="-1">Not focusable</button>
      `;

      const elements = getFocusableElements(container);

      expect(elements.map((el) => el.id)).toEqual(['focusable']);
    });

    it('returns an empty array when there are no focusable elements', () => {
      container.innerHTML = `<div>No focusable content</div>`;

      const elements = getFocusableElements(container);

      expect(elements).toEqual([]);
    });
  });

  describe('setupFocusTrap', () => {
    it('wraps Tab from the last element to the first', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;

      const cleanup = setupFocusTrap(container);
      const first = container.querySelector<HTMLElement>('#first')!;
      const last = container.querySelector<HTMLElement>('#last')!;

      last.focus();
      expect(document.activeElement).toBe(last);

      fireEvent.keyDown(last, { key: 'Tab' });

      expect(document.activeElement).toBe(first);

      cleanup();
    });

    it('wraps Shift+Tab from the first element to the last', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;

      const cleanup = setupFocusTrap(container);
      const first = container.querySelector<HTMLElement>('#first')!;
      const last = container.querySelector<HTMLElement>('#last')!;

      first.focus();
      expect(document.activeElement).toBe(first);

      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

      expect(document.activeElement).toBe(last);

      cleanup();
    });

    it('removes the keydown listener on cleanup', () => {
      container.innerHTML = `
        <button id="first">First</button>
        <button id="last">Last</button>
      `;

      const cleanup = setupFocusTrap(container);
      const first = container.querySelector<HTMLElement>('#first')!;
      const last = container.querySelector<HTMLElement>('#last')!;

      cleanup();

      last.focus();
      expect(document.activeElement).toBe(last);

      fireEvent.keyDown(last, { key: 'Tab' });

      // After cleanup, Tab should not wrap focus back to the first element.
      expect(document.activeElement).toBe(last);
    });
  });

  describe('createSkipLink', () => {
    it('creates an anchor with the correct href and text', () => {
      const link = createSkipLink();

      expect(link.tagName).toBe('A');
      expect(link.getAttribute('href')).toBe('#main-content');
      expect(link.textContent).toBe('Skip to main content');
    });
  });

  describe('focusElement', () => {
    it('focuses the given element', () => {
      container.innerHTML = `<button id="target">Target</button>`;
      const target = container.querySelector<HTMLElement>('#target')!;

      focusElement(target);

      expect(document.activeElement).toBe(target);
    });

    it('does not throw when passed null', () => {
      expect(() => focusElement(null)).not.toThrow();
    });
  });

  describe('isAccessible', () => {
    it('returns true for an element with an accessible label', () => {
      container.innerHTML = `<button id="labeled">Save</button>`;
      const labeled = container.querySelector<HTMLElement>('#labeled')!;

      expect(isAccessible(labeled)).toBe(true);
    });

    it('returns false for an element without an accessible label', () => {
      container.innerHTML = `<button id="unlabeled"></button>`;
      const unlabeled = container.querySelector<HTMLElement>('#unlabeled')!;

      expect(isAccessible(unlabeled)).toBe(false);
    });
  });

  describe('checkKeyboardAccessibility', () => {
    it('reports keyboard-accessible elements', () => {
      container.innerHTML = `
        <button id="btn">Button</button>
        <a id="link" href="#foo">Link</a>
      `;

      const result = checkKeyboardAccessibility(container);

      expect(result).toBeDefined();
      expect(result.accessible).toBe(true);
    });

    it('reports non keyboard-accessible elements', () => {
      container.innerHTML = `
        <div id="clickable" onclick="void 0">Clickable</div>
      `;

      const result = checkKeyboardAccessibility(container);

      expect(result).toBeDefined();
      expect(result.accessible).toBe(false);
    });
  });
});
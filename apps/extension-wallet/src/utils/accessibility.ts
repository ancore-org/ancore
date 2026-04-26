/**
 * Accessibility Utilities
 *
 * Helper functions for WCAG 2.1 AA compliance:
 * - Focus management
 * - ARIA attributes
 * - Keyboard navigation
 * - Screen reader support
 */

/**
 * Focus an element safely with script-initiated focus
 * @param element - The element to focus
 */
export function focusElement(element: HTMLElement | null): void {
  if (!element) return;
  element.focus();
}

/**
 * Trap focus within a container (modal pattern)
 * @param container - Container element
 * @param onEscape - Callback when Escape is pressed
 */
export function setupFocusTrap(
  container: HTMLElement | null,
  onEscape?: () => void
): (() => void) | null {
  if (!container) return null;

  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  if (focusableElements.length === 0) return null;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && onEscape) {
      onEscape();
      return;
    }

    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  return () => container.removeEventListener('keydown', handleKeyDown);
}

/**
 * Announce message to screen readers
 * @param message - Message to announce
 * @param priority - ARIA live region priority (polite or assertive)
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Skip to main content link (visible on focus)
 * @returns HTML string for skip link
 */
export function createSkipLink(): HTMLElement {
  const link = document.createElement('a');
  link.href = '#main-content';
  link.textContent = 'Skip to main content';
  link.className = 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-2 focus:bg-cyan-400 focus:text-slate-950 focus:rounded';
  return link;
}

/**
 * Check if element is visible to screen readers
 * @param element - Element to check
 */
export function isAccessible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);

  // Check for visibility
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // Check for aria-hidden
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  return true;
}

/**
 * Get all keyboard-focusable elements in container
 * @param container - Container element
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(focusableElements).filter(isAccessible);
}

/**
 * Check keyboard navigation accessibility
 * Verifies that interactive elements are reachable via keyboard
 * @param container - Container to check
 */
export function checkKeyboardAccessibility(container: HTMLElement): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const focusableElements = getFocusableElements(container);

  if (focusableElements.length === 0) {
    issues.push('No keyboard-focusable elements found');
  }

  // Check for focus visible styles
  focusableElements.forEach((element) => {
    const style = window.getComputedStyle(element, ':focus-visible');
    if (!style.outline && !style.boxShadow && !style.borderColor) {
      issues.push(`No visible focus indicator on ${element.tagName.toLowerCase()}`);
    }
  });

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Attributes for interactive elements
 */
export const a11yAttrs = {
  /**
   * Focus visible styling class
   */
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-950',

  /**
   * Screen reader only text (visually hidden)
   */
  srOnly: 'sr-only',
};

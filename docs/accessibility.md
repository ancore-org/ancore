# Accessibility Guide

Ancore wallet extension follows WCAG 2.1 AA standards for accessibility. This guide covers implementation patterns, testing practices, and common pitfalls.

## Standards

- **WCAG 2.1 Level AA**: Minimum compliance target
- **Keyboard navigation**: All interactive elements accessible via keyboard
- **Screen reader support**: Proper ARIA labels and roles
- **Focus management**: Clear visible focus indicators
- **Color contrast**: 4.5:1 for normal text, 3:1 for large text

## Components

### Standardized State Components

Three reusable components provide consistent UX across screens:

#### ErrorState
Displays error messages with recovery actions.

```tsx
import { ErrorState } from '@/components/StateComponents';

<ErrorState
  title="Transaction Failed"
  message="Insufficient balance to complete transaction"
  actions={[
    { label: 'Try Again', onClick: handleRetry, variant: 'primary' },
    { label: 'View Details', onClick: handleDetails, variant: 'secondary' },
  ]}
  onDismiss={handleDismiss}
/>
```

Features:
- Alert role with aria-live="assertive"
- Accessible action buttons with focus indicators
- Optional dismiss functionality
- High contrast error styling

#### LoadingState
Indicates async operations in progress.

```tsx
import { LoadingState } from '@/components/StateComponents';

<LoadingState message="Processing transaction..." />
```

Features:
- Status role with aria-busy="true"
- Clear loading message
- Animated spinner (decorative, hidden from screen readers)
- Optional full-height layout

#### EmptyState
Displays when no data is available.

```tsx
import { EmptyState } from '@/components/StateComponents';

<EmptyState
  icon={InboxIcon}
  title="No Transactions"
  description="Your transaction history will appear here"
  action={{
    label: 'Send Token',
    onClick: handleSend,
  }}
/>
```

Features:
- Status role with aria-live="polite"
- Optional icon with aria-hidden
- Descriptive title and message
- Optional call-to-action button

## Keyboard Navigation

All screens must support full keyboard navigation:

1. **Tab order**: Follows logical reading order
2. **Focus visible**: Every element has visible focus indicator
3. **Escape key**: Closes modals and dialogs
4. **Enter key**: Submits forms
5. **Arrow keys**: Navigates lists and menus

### Utility Hooks

```tsx
import { setupFocusTrap, getFocusableElements, checkKeyboardAccessibility } from '@/utils/accessibility';

// Modal focus trap
useEffect(() => {
  const cleanup = setupFocusTrap(modalRef.current, onEscape);
  return cleanup;
}, []);

// Check accessibility
useEffect(() => {
  const result = checkKeyboardAccessibility(containerRef.current!);
  if (!result.passed) {
    console.warn('Accessibility issues:', result.issues);
  }
}, []);
```

## Screen Reader Support

### ARIA Attributes

Always include appropriate ARIA labels:

```tsx
// Error messages
<div role="alert" aria-live="assertive">
  Insufficient balance
</div>

// Loading states
<div role="status" aria-busy="true" aria-label="Loading transactions">
  <Spinner />
</div>

// Empty states
<div role="status" aria-live="polite" aria-label="No transactions available">
  Your transaction history will appear here
</div>

// Decorative elements
<svg aria-hidden="true">...</svg>

// Form fields
<input aria-label="Password" type="password" />
<input aria-describedby="pwd-hint" type="password" />
<p id="pwd-hint">8+ characters, numbers, and symbols</p>
```

### Announcements

Use `announceToScreenReader` for dynamic updates:

```tsx
import { announceToScreenReader } from '@/utils/accessibility';

// Announce success
announceToScreenReader('Transaction sent successfully', 'polite');

// Announce error
announceToScreenReader('Payment failed: insufficient balance', 'assertive');
```

## Focus Management

Manage focus during route transitions:

```tsx
import { useEffect, useRef } from 'react';
import { focusElement } from '@/utils/accessibility';

export function MyScreen() {
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus to main content after route transition
    focusElement(mainRef.current);
  }, []);

  return <main ref={mainRef} tabIndex={-1}>...</main>;
}
```

## Testing

### Accessibility Tests

Use `@testing-library/jest-dom` and `@testing-library/react` for a11y testing:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('button is keyboard accessible', async () => {
  const user = userEvent.setup();
  render(<button>Click me</button>);

  const btn = screen.getByRole('button');
  await user.tab();
  expect(btn).toHaveFocus();

  await user.keyboard('{Enter}');
  // Verify action
});

test('form has accessible labels', () => {
  render(
    <>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" />
    </>
  );

  expect(screen.getByLabelText('Email')).toBeInTheDocument();
});

test('error message announced to screen readers', () => {
  const { container } = render(<ErrorState message="Error" />);
  expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
});
```

### Manual Testing Checklist

- [ ] Keyboard only navigation (Tab, Shift+Tab, Enter, Escape)
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Color contrast (use WCAG contrast checker)
- [ ] Focus visible indicators
- [ ] No keyboard traps
- [ ] Proper heading hierarchy
- [ ] Image alt text
- [ ] Form field labels
- [ ] Error messages associated with fields
- [ ] Dynamic content announcements

## Common Patterns

### Form with Error States

```tsx
function PasswordForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitPassword(password);
      announceToScreenReader('Password updated successfully');
    } catch (err) {
      const errorMsg = 'Password is invalid';
      setError(errorMsg);
      announceToScreenReader(errorMsg, 'assertive');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="pwd">Password</label>
        <input
          id="pwd"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={error ? 'pwd-error' : undefined}
          className="focus:ring-2 focus:ring-cyan-400"
        />
        {error && (
          <div id="pwd-error" role="alert" className="text-red-500">
            {error}
          </div>
        )}
      </div>
    </form>
  );
}
```

### Modal Dialog

```tsx
function Modal({ title, isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Setup focus trap
    const cleanup = setupFocusTrap(modalRef.current, onClose);
    return cleanup;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true">
      <div
        ref={modalRef}
        className="rounded-lg bg-white p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title" className="text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/) - Browser extension for testing
- [Accessibility Checklist](https://www.a11yproject.com/checklist/)

## Next Steps

1. Run accessibility tests: `pnpm test --grep="a11y"`
2. Use axe DevTools in development
3. Manual keyboard navigation testing
4. Screen reader testing on key flows
5. Continuous accessibility monitoring in CI

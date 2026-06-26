import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Dialog, DialogContent } from './dialog';
import { expectNoA11yViolations } from '../../__tests__/test-utils/a11y';

describe('Dialog', () => {
  it('renders children when open', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <div data-testid="dialog-content">Test Content</div>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('has no axe violations when open', async () => {
    const { container } = render(
      <Dialog open={true}>
        <DialogContent>
          <h2>Accessible Dialog</h2>
          <p>This dialog should pass a11y checks.</p>
          <button>Close</button>
        </DialogContent>
      </Dialog>
    );

    await expectNoA11yViolations(container);
  });
});

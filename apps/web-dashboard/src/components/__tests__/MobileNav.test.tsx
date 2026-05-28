import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MobileNav } from '../MobileNav';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
];

const renderWithRouter = (ui: React.ReactElement) => {
  return render(ui, { wrapper: BrowserRouter });
};

describe('MobileNav', () => {
  it('should render the toggle button and be closed by default', () => {
    renderWithRouter(<MobileNav links={NAV_LINKS} />);

    expect(screen.getByLabelText('Toggle navigation menu')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should open the drawer when the toggle button is clicked', () => {
    renderWithRouter(<MobileNav links={NAV_LINKS} />);

    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('should close the drawer when the close button is clicked', () => {
    renderWithRouter(<MobileNav links={NAV_LINKS} />);

    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close navigation menu'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should close the drawer when pressing Escape', () => {
    renderWithRouter(<MobileNav links={NAV_LINKS} />);

    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should trap focus within the drawer when open', () => {
    renderWithRouter(<MobileNav links={NAV_LINKS} />);

    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));
    const drawer = screen.getByRole('dialog');
    const closeBtn = screen.getByLabelText('Close navigation menu');
    const firstLink = screen.getByText('Dashboard');
    const lastLink = screen.getByText('Transactions');

    // Focus last link
    lastLink.focus();
    expect(document.activeElement).toBe(lastLink);

    // Tab from last link should go to first link (close button in our case)
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab from first link should go to last link
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastLink);
  });

  it('should match visual snapshot when open', () => {
    const { asFragment } = renderWithRouter(<MobileNav links={NAV_LINKS} />);
    fireEvent.click(screen.getByLabelText('Toggle navigation menu'));

    expect(asFragment()).toMatchSnapshot();
  });
});

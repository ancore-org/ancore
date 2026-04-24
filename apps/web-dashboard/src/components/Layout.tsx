import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@ancore/ui-kit';

const NAV_LINKS = [
  { to: '/',             label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
];

export const Layout: React.FC = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b px-6 py-3 flex items-center gap-6">
      <span className="font-semibold text-lg">Ancore</span>
      <nav className="flex gap-4">
        {NAV_LINKS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('text-sm transition-colors hover:text-foreground',
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
    <main className="container mx-auto px-6 py-8">
      <Outlet />
    </main>
  </div>
);

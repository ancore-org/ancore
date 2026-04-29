import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@ancore/ui-kit';
import { useTableDensity } from '../contexts/TableDensityContext';
import { Settings, Rows } from 'lucide-react';
import { QuickActionBar } from './QuickActionBar';
import { MobileNav } from './MobileNav';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
];

const DensityToggle: React.FC = () => {
  const { density, toggleDensity } = useTableDensity();

  return (
    <button
      onClick={toggleDensity}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
      title={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} density`}
    >
      <Rows className="w-4 h-4" />
      <span className="capitalize">{density}</span>
    </button>
  );
};

export const Layout: React.FC = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="border-b px-6 py-3 flex items-center gap-6">
      <div className="lg:hidden">
        <MobileNav links={NAV_LINKS} />
      </div>
      <span className="font-semibold text-lg">Ancore</span>
      <nav className="hidden lg:flex gap-4">
        {NAV_LINKS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'text-sm transition-colors hover:text-foreground',
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 flex justify-center">
        <QuickActionBar />
      </div>
      <div className="flex items-center gap-2">
        <DensityToggle />
        <Settings className="w-4 h-4 text-muted-foreground" />
      </div>
    </header>
    <main className="container mx-auto px-6 py-8">
      <Outlet />
    </main>
  </div>
);

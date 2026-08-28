import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@ancore/ui-kit';
import { useTableDensity } from '../contexts/TableDensityContext';
import { Settings, Rows } from 'lucide-react';
import { QuickActionBar } from './QuickActionBar';
import { MobileNav } from './MobileNav';
import { AccountSelector } from './AccountSelector';
import { useAccountState } from '../hooks/useAccountState';

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/split-bill', label: 'Split Bill' },
];

const DensityToggle: React.FC = () => {
  const { density, toggleDensity } = useTableDensity();

  return (
    <button
      onClick={toggleDensity}
      className="flex h-10 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title={`Switch to ${density === 'comfortable' ? 'compact' : 'comfortable'} density`}
    >
      <Rows className="w-4 h-4" />
      <span className="capitalize">{density}</span>
    </button>
  );
};

export const Layout: React.FC = () => {
  const { accounts, currentAccount, setCurrentAccount, loading } = useAccountState();

  return (
    <div className="dashboard-shell">
      <header className="flex items-center gap-5 border-b border-border px-6 py-4">
        <div className="lg:hidden">
          <MobileNav links={NAV_LINKS} />
        </div>
        <span className="text-lg font-semibold tracking-tight">Ancore</span>
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
        <div className="flex flex-1 justify-center">
          <QuickActionBar />
        </div>
        <div className="flex items-center gap-2">
          {!loading && accounts.length > 0 && (
            <AccountSelector
              accounts={accounts}
              currentAccount={currentAccount}
              onAccountChange={setCurrentAccount}
            />
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Testnet
          </span>
          <DensityToggle />
          <Settings className="h-4 w-4 text-muted-foreground" />
        </div>
      </header>
      <main className="container mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
};

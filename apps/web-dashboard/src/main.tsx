import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';

import './lib/env'; // validates VITE_* variables at startup; throws in dev on bad config
import { DashboardApp } from './router';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { TableDensityProvider } from './contexts/TableDensityContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Above TableDensityProvider as well as the router: a provider that
        throws while initialising would otherwise escape the boundary
        DashboardApp installs internally (#1348). Nesting two boundaries is
        harmless — the innermost one that can catch does. */}
    <AppErrorBoundary>
      <TableDensityProvider>
        <DashboardApp />
      </TableDensityProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

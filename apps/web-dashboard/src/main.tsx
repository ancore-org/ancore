import React from 'react';
import ReactDOM from 'react-dom/client';

import { DashboardApp } from './router';
import { TableDensityProvider } from './contexts/TableDensityContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TableDensityProvider>
      <DashboardApp />
    </TableDensityProvider>
  </React.StrictMode>
);

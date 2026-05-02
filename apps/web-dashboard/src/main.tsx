import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TableDensityProvider } from './contexts/TableDensityContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TableDensityProvider>
      <App />
    </TableDensityProvider>
  </React.StrictMode>
);

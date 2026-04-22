import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExtensionRouter } from '../router';
import '../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExtensionRouter />
  </React.StrictMode>
);

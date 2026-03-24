import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsScreen } from './screens/Settings/SettingsScreen';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="w-[360px] min-h-screen bg-background mx-auto shadow-xl">
      <SettingsScreen />
    </div>
  </React.StrictMode>
);

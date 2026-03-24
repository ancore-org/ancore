import { jsx as _jsx } from 'react/jsx-runtime';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsScreen } from './screens/Settings/SettingsScreen';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  _jsx(React.StrictMode, {
    children: _jsx('div', {
      className: 'w-[360px] min-h-screen bg-background mx-auto shadow-xl',
      children: _jsx(SettingsScreen, {}),
    }),
  })
);
//# sourceMappingURL=main.js.map

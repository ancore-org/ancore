import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NotificationProvider } from '@ancore/ui-kit';
import { ReceiveScreen } from './screens/ReceiveScreen';
import { SettingsScreen } from './screens/Settings/SettingsScreen';
import './index.css';

function App() {
  const [view, setView] = useState<'receive' | 'settings'>('receive');
  const [network] = useState<'mainnet' | 'testnet' | 'futurenet'>('testnet');

  return (
    <div className="w-[360px] min-h-screen bg-background mx-auto shadow-xl flex flex-col items-center p-6 gap-4">
      {/* Simple Navigation for development */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('receive')}
          className="text-xs underline text-slate-500 hover:text-slate-900"
        >
          Receive
        </button>
        <button
          onClick={() => setView('settings')}
          className="text-xs underline text-slate-500 hover:text-slate-900"
        >
          Settings
        </button>
      </div>

      {view === 'receive' ? (
        <ReceiveScreen
          account={{
            publicKey: 'GD6SZQJNKL3ZYXPWLUVFXZNXUVXJTQPWMQHZMDMQHLS5VNLQBQNPFLM',
            name: 'My Stellar Wallet',
          }}
          network={network}
          onBack={() => setView('settings')}
        />
      ) : (
        <SettingsScreen />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { NotificationProvider } from '@ancore/ui-kit';
import { HomeScreen } from './screens/HomeScreen';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotificationProvider>
      <div className="w-[360px] min-h-screen bg-background mx-auto shadow-xl overflow-y-auto">
        <HomeScreen
          onSettingsClick={() => console.log('Settings clicked')}
          onSendClick={() => console.log('Send clicked')}
          onReceiveClick={() => console.log('Receive clicked')}
        />
      </div>
    </NotificationProvider>
  </React.StrictMode>
);

import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { TransactionList } from './components/TransactionList';
import { Account } from './pages/Account';
import { Dashboard } from './pages/Dashboard';

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/account/:address" element={<Account />} />
        <Route path="/transactions" element={<TransactionList transactions={[]} />} />
        <Route path="/send" element={<div className="p-8">Send Flow</div>} />
        <Route path="/request" element={<div className="p-8">Request Flow</div>} />
        <Route path="/scan" element={<div className="p-8">Scan Flow</div>} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;

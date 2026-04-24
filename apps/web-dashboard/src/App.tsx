import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Account } from './pages/Account';
import { TransactionList } from './components/TransactionList';

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/account/:address" element={<Account />} />
        <Route path="/transactions" element={<TransactionList transactions={[]} />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default App;

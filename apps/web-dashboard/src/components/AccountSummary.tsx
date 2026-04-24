import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, AddressDisplay } from '@ancore/ui-kit';
import type { AccountData } from '../types/dashboard';

interface AccountSummaryProps {
  account: AccountData;
}

export const AccountSummary: React.FC<AccountSummaryProps> = ({ account }) => (
  <Card>
    <CardHeader>
      <CardTitle>Account Summary</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Address</span>
        <AddressDisplay address={account.address} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Balance</span>
        <span className="font-medium">{account.balance.toFixed(2)} XLM</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
          {account.status}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Last Activity</span>
        <span className="text-sm">{account.lastActivity.toLocaleDateString()}</span>
      </div>
    </CardContent>
  </Card>
);

import React from 'react';
import { Wallet, Hash, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { MetricWidget } from './MetricWidget';
import { AccountStatus } from '../hooks/useAccountOverview';

interface WidgetProps {
  isLoading?: boolean;
  error?: Error | null;
}

export const BalanceWidget: React.FC<WidgetProps & { balance?: number }> = ({
  balance,
  isLoading,
  error,
}) => {
  const formattedBalance = balance !== undefined 
    ? new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(balance) + ' XLM'
    : undefined;

  return (
    <MetricWidget
      title="Total Balance"
      value={formattedBalance}
      icon={<Wallet className="h-4 w-4" />}
      isLoading={isLoading}
      error={error}
      description="Available on-chain balance"
    />
  );
};

export const NonceWidget: React.FC<WidgetProps & { nonce?: number }> = ({
  nonce,
  isLoading,
  error,
}) => {
  return (
    <MetricWidget
      title="Account Nonce"
      value={nonce}
      icon={<Hash className="h-4 w-4" />}
      isLoading={isLoading}
      error={error}
      description="Current sequence number"
    />
  );
};

export const AccountStatusWidget: React.FC<WidgetProps & { status?: AccountStatus }> = ({
  status,
  isLoading,
  error,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case 'locked':
        return <ShieldAlert className="h-4 w-4 text-amber-500" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const formattedStatus = status 
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : undefined;

  return (
    <MetricWidget
      title="Account Status"
      value={formattedStatus}
      icon={getStatusIcon()}
      isLoading={isLoading}
      error={error}
      description="Current security state"
    />
  );
};

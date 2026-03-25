import { useState } from 'react';
import { RefreshCw, Settings, Wallet, Network, ChevronRight } from 'lucide-react';
import { Button } from '@ancore/ui-kit';
import { Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { useAccountBalance } from '../hooks/useAccountBalance';
import AccountHeader from '../components/AccountHeader';
import BalanceCard from '../components/BalanceCard';
import QuickActions from '../components/QuickActions';

interface HomeScreenProps {
  onSettingsClick?: () => void;
  onSendClick?: () => void;
  onReceiveClick?: () => void;
}

export function HomeScreen({ onSettingsClick, onSendClick, onReceiveClick }: HomeScreenProps) {
  const { balance, isLoading, error, refreshBalance } = useAccountBalance();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accountAddress] = useState('GABC...123');
  const [network] = useState('Testnet');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBalance();
    // Simulate network delay for better UX
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText('GABC...123');
    // In a real app, you'd show a toast notification here
    console.log('Address copied to clipboard');
  };

  // Empty state for new accounts
  const isEmpty = balance === 0 && !isLoading && !error;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Ancore
            </h1>
            <p className="text-xs text-muted-foreground">Secure Stellar Wallet</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSettingsClick}
          className="rounded-full hover:bg-accent/50 transition-all duration-300 hover:scale-105"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </header>

      {/* Main Content */}
      <div className="space-y-8">
        {/* Account Header */}
        <AccountHeader
          address={accountAddress}
          network={network}
          onCopyAddress={handleCopyAddress}
        />

        {/* Balance Card */}
        <BalanceCard
          balance={balance}
          isLoading={isLoading}
          error={error}
          currency="XLM"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Quick Actions */}
        <QuickActions
          onSendClick={onSendClick}
          onReceiveClick={onReceiveClick}
          disabled={isEmpty || isLoading || !!error}
        />

        {/* Recent Activity Section (Placeholder) */}
        <Card className="border-border/50 shadow-lg overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isEmpty ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-2">No Activity Yet</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Send or receive XLM to see your transaction history here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Placeholder for transaction list */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-primary/20" />
                    </div>
                    <div>
                      <p className="font-medium">Received XLM</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">+50.25 XLM</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Status */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-background to-accent/5 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Network className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Network Status</p>
              <p className="text-sm text-muted-foreground">{network} • Connected</p>
            </div>
          </div>
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Pull-to-refresh indicator (simplified for extension) */}
      <div className="fixed top-0 left-0 right-0 flex justify-center pt-2 pointer-events-none">
        {isRefreshing && (
          <div className="bg-primary/10 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 animate-fade-in">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Updating balance...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeScreen;

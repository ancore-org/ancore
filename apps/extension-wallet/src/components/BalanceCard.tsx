import { RefreshCw, TrendingUp, AlertCircle, Coins } from 'lucide-react';
import { Button } from '@ancore/ui-kit';
import { Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';

interface BalanceCardProps {
  balance: number;
  isLoading: boolean;
  error: Error | null;
  currency: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function BalanceCard({
  balance,
  isLoading,
  error,
  currency,
  onRefresh,
  isRefreshing,
}: BalanceCardProps) {
  // Format balance with proper decimal places
  const formattedBalance = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(balance);

  // Calculate approximate USD value (placeholder - in real app, fetch from API)
  const usdRate = 0.12; // Example rate: 1 XLM = $0.12
  const usdValue = balance * usdRate;
  const formattedUsdValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdValue);

  return (
    <Card className="border-border/50 shadow-xl overflow-hidden relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      {/* Animated particles background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 7}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <Coins className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Total Balance</CardTitle>
                <p className="text-sm text-muted-foreground">Available to spend</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoading || isRefreshing}
              className="rounded-full hover:bg-accent/50 transition-all duration-300 hover:rotate-180 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh balance"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Unable to Load Balance</h3>
              <p className="text-muted-foreground mb-4">{error.message}</p>
              <Button
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Try Again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block relative">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Coins className="w-8 h-8 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-4 text-muted-foreground">Loading balance...</p>
            </div>
          ) : (
            <>
              {/* Main Balance Display */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    {formattedBalance}
                  </span>
                  <span className="text-2xl font-semibold text-primary">{currency}</span>
                </div>
                <p className="text-lg text-muted-foreground">{formattedUsdValue}</p>
              </div>

              {/* Balance Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-gradient-to-br from-background to-accent/5 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-sm font-medium">24h Change</span>
                  </div>
                  <p className="text-2xl font-bold text-green-500">+2.4%</p>
                  <p className="text-xs text-muted-foreground">+{usdValue * 0.024} USD</p>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-br from-background to-accent/5 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-medium">Total Assets</span>
                  </div>
                  <p className="text-2xl font-bold">1</p>
                  <p className="text-xs text-muted-foreground">Cryptocurrency</p>
                </div>
              </div>

              {/* Balance History (Placeholder) */}
              <div className="pt-4 border-t border-border/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Weekly Balance</h4>
                  <span className="text-xs text-muted-foreground">Last 7 days</span>
                </div>
                <div className="h-20 flex items-end gap-1">
                  {[40, 60, 30, 70, 50, 80, 65].map((height, index) => (
                    <div
                      key={index}
                      className="flex-1 bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all duration-300 hover:opacity-80"
                      style={{ height: `${height}%` }}
                      title={`Day ${index + 1}: ${(balance * (height / 100)).toFixed(2)} ${currency}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </div>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.2; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.5; }
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </Card>
  );
}

export default BalanceCard;

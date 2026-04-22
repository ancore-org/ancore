import {
  Send,
  Download,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@ancore/ui-kit';

interface QuickActionsProps {
  onSendClick?: () => void;
  onReceiveClick?: () => void;
  disabled?: boolean;
}

export function QuickActions({ onSendClick, onReceiveClick, disabled = false }: QuickActionsProps) {
  const actions = [
    {
      id: 'send',
      label: 'Send',
      icon: Send,
      color: 'from-red-500 to-orange-500',
      bgColor: 'bg-red-500/10',
      onClick: onSendClick,
      description: 'Transfer XLM',
    },
    {
      id: 'receive',
      label: 'Receive',
      icon: Download,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      onClick: onReceiveClick,
      description: 'Get XLM',
    },
    {
      id: 'qr',
      label: 'QR Code',
      icon: QrCode,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      onClick: () => console.log('QR Code clicked'),
      description: 'Show address',
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreVertical,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-500/10',
      onClick: () => console.log('More clicked'),
      description: 'Other actions',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quick Actions</h3>
          <p className="text-sm text-muted-foreground">Send, receive, or manage your XLM</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Ready</span>
        </div>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="outline"
            size="lg"
            onClick={action.onClick}
            disabled={disabled && (action.id === 'send' || action.id === 'receive')}
            className="h-auto p-4 rounded-xl border-border/50 hover:border-primary/30 hover:bg-accent/5 transition-all duration-300 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Background gradient effect on hover */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}
            />

            <div className="relative z-10 w-full">
              <div className="flex flex-col items-center gap-3">
                {/* Icon with gradient background */}
                <div
                  className={`w-14 h-14 rounded-full ${action.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                >
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}
                  >
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Label and description */}
                <div className="text-center">
                  <div className="font-semibold mb-1">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </div>
            </div>

            {/* Animated arrow for send/receive */}
            {(action.id === 'send' || action.id === 'receive') && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {action.id === 'send' ? (
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                ) : (
                  <ArrowDownLeft className="w-4 h-4 text-green-500" />
                )}
              </div>
            )}
          </Button>
        ))}
      </div>

      {/* Additional Actions Row */}
      <div className="pt-4 border-t border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium">Buy XLM</p>
              <p className="text-xs text-muted-foreground">Get more Stellar Lumens</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary/80"
            onClick={() => console.log('Buy XLM clicked')}
          >
            Explore
          </Button>
        </div>
      </div>

      {/* Action Status Indicator */}
      <div className="rounded-xl bg-gradient-to-r from-background to-accent/5 border border-border/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent animate-pulse" />
            </div>
            <div>
              <p className="font-medium">Transaction Ready</p>
              <p className="text-xs text-muted-foreground">Network fees: ~0.00001 XLM</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-green-500">Fast</p>
            <p className="text-xs text-muted-foreground">~3-5 seconds</p>
          </div>
        </div>

        {/* Speed indicator */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Slow</span>
            <span>Standard</span>
            <span>Fast</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
              style={{ width: '85%' }}
            />
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="rounded-xl bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/20 p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
            <div className="w-5 h-5 rounded-full bg-blue-500/40" />
          </div>
          <div>
            <p className="font-medium text-sm mb-1">Quick Tip</p>
            <p className="text-xs text-muted-foreground">
              Double-check addresses before sending. Stellar transactions are irreversible. Always
              send a test transaction first when dealing with large amounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickActions;

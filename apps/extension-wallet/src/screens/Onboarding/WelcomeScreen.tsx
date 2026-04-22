import { Shield, Zap, Key, Users, ChevronRight, Wallet } from 'lucide-react';

/**
 * Welcome screen props
 */
export interface WelcomeScreenProps {
  onNext: () => void;
  onBack?: () => void;
}

/**
 * WelcomeScreen - Introduction screen for first-time users
 *
 * Explains Ancore wallet and its key features before starting onboarding.
 */
export function WelcomeScreen({ onNext, onBack }: WelcomeScreenProps) {
  const features = [
    {
      icon: Shield,
      title: 'Secure',
      description: 'Your keys never leave this device',
    },
    {
      icon: Key,
      title: 'Smart Accounts',
      description: 'Account abstraction on Stellar network',
    },
    {
      icon: Zap,
      title: 'Fast',
      description: 'Quick transactions with low fees',
    },
    {
      icon: Users,
      title: 'Simple',
      description: 'Easy to use, hard to lose access',
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      {/* Header */}
      <div className="px-6 pt-12 pb-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-purple-700 flex items-center justify-center shadow-lg shadow-primary/25">
              <Wallet className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-400 border-2 border-background flex items-center justify-center">
              <span className="text-[10px] font-bold text-green-900">A</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-foreground mb-2">Welcome to Ancore</h1>
        <p className="text-sm text-muted-foreground text-center max-w-xs mx-auto">
          The smart wallet for the Stellar network. Create your account to get started.
        </p>
      </div>

      {/* Features */}
      <div className="flex-1 px-6">
        <div className="grid grid-cols-2 gap-3">
          {features.map((feature, index) => (
            <div key={index} className="bg-card rounded-xl p-4 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm text-foreground mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">💡</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Before you start</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You'll receive a 12-word recovery phrase. This is the ONLY way to recover your
                account. Write it down and keep it safe.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8">
        <button
          onClick={onNext}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98]"
        >
          Create New Wallet
          <ChevronRight className="w-5 h-5" />
        </button>

        {onBack && (
          <button
            onClick={onBack}
            className="w-full mt-3 py-3 px-6 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}

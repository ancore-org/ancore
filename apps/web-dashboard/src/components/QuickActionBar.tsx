import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowDownLeft, QrCode } from 'lucide-react';
import { cn } from '@ancore/ui-kit';

export const QuickActionBar: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    { icon: Send, label: 'Send', path: '/send' },
    { icon: ArrowDownLeft, label: 'Request', path: '/request' },
    { icon: QrCode, label: 'Scan', path: '/scan' },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {actions.map(({ icon: Icon, label, path }) => (
        <button
          key={label}
          onClick={() => navigate(path)}
          className={cn(
            'flex items-center gap-2 rounded-full px-3 py-2 transition-[background-color,color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]',
            'text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98]',
            'text-sm font-medium'
          )}
          aria-label={label}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowDownLeft, QrCode } from 'lucide-react';
import { cn } from '@ancore/ui-kit';

export const QuickActionBar: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    { icon: Send, label: 'Send', path: '/send', color: 'text-blue-500' },
    { icon: ArrowDownLeft, label: 'Request', path: '/request', color: 'text-green-500' },
    { icon: QrCode, label: 'Scan', path: '/scan', color: 'text-purple-500' },
  ];

  return (
    <div className="flex items-center gap-1.5 p-1 bg-muted/40 backdrop-blur-md border rounded-xl shadow-sm">
      {actions.map(({ icon: Icon, label, path, color }) => (
        <button
          key={label}
          onClick={() => navigate(path)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200",
            "hover:bg-accent hover:shadow-sm active:scale-95",
            "text-sm font-medium"
          )}
          aria-label={label}
        >
          <Icon className={cn("w-4 h-4", color)} />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};

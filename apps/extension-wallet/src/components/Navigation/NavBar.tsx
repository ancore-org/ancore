import { ArrowDownLeft, ArrowUpRight, History, Home, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/send', label: 'Send', icon: ArrowUpRight },
  { to: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function NavBar() {
  return (
    <nav
      aria-label="Primary navigation"
      className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-xl"
      data-testid="nav-bar"
    >
      <div className="grid grid-cols-5 gap-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            end
            to={to}
            className={({ isActive }) =>
              [
                'flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-[11px] font-medium transition-[background-color,color,transform] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98]',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              ].join(' ')
            }
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

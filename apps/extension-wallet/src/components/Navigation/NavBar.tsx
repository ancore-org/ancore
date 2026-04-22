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
      className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-2 py-2 backdrop-blur"
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
                'flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              ].join(' ')
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

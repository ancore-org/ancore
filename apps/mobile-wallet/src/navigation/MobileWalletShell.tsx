import type { ReactNode } from 'react';

export type MobileWalletRoute = 'account' | 'activity' | 'settings';

export interface NavigationItem {
  route: MobileWalletRoute;
  label: string;
}

interface Props {
  appName: string;
  activeRoute: MobileWalletRoute;
  children: ReactNode;
  items?: NavigationItem[];
  network?: string;
}

export const DEFAULT_MOBILE_WALLET_NAVIGATION: NavigationItem[] = [
  { route: 'account', label: 'Account' },
  { route: 'activity', label: 'Activity' },
  { route: 'settings', label: 'Settings' },
];

const NetworkBadge = ({ network }: { network: string }) => {
  const isMainnet = network === 'mainnet';
  const badgeColor = isMainnet ? 'bg-emerald-500' : 'bg-amber-500';
  
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${badgeColor}`}
    >
      {network}
    </span>
  );
};

export const MobileWalletShell = ({
  appName,
  activeRoute,
  children,
  items = DEFAULT_MOBILE_WALLET_NAVIGATION,
  network,
}: Props) => {
  return (
    <main aria-label={appName}>
      <header className="flex items-center justify-between">
        <h1>{appName}</h1>
        {network && <NetworkBadge network={network} />}
      </header>
      <nav aria-label="Mobile wallet navigation">
        <ul>
          {items.map((item) => (
            <li key={item.route} aria-current={item.route === activeRoute ? 'page' : undefined}>
              {item.label}
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </main>
  );
};

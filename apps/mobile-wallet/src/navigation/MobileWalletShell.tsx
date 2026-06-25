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
}

export const DEFAULT_MOBILE_WALLET_NAVIGATION: NavigationItem[] = [
  { route: 'account', label: 'Account' },
  { route: 'activity', label: 'Activity' },
  { route: 'settings', label: 'Settings' },
];

export const MobileWalletShell = ({
  appName,
  activeRoute,
  children,
  items = DEFAULT_MOBILE_WALLET_NAVIGATION,
}: Props) => {
  return (
    <main aria-label={appName}>
      <header>
        <h1>{appName}</h1>
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

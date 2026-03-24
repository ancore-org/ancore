import * as React from 'react';
interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}
export declare function SettingsGroup({
  title,
  children,
}: SettingsGroupProps): import('react/jsx-runtime').JSX.Element;
interface SettingItemProps {
  label: string;
  description?: string;
  value?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  rightSlot?: React.ReactNode;
  icon?: React.ReactNode;
}
export declare function SettingItem({
  label,
  description,
  value,
  onClick,
  danger,
  rightSlot,
  icon,
}: SettingItemProps): import('react/jsx-runtime').JSX.Element;
export {};
//# sourceMappingURL=SettingsGroup.d.ts.map

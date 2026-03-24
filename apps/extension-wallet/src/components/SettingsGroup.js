import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';
import { ChevronRight } from 'lucide-react';
export function SettingsGroup({ title, children }) {
  return _jsxs('section', {
    className: 'space-y-1.5',
    children: [
      _jsx('p', {
        className: 'px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground',
        children: title,
      }),
      _jsx('div', {
        className: 'rounded-xl border border-border bg-card overflow-hidden divide-y divide-border',
        children: children,
      }),
    ],
  });
}
export function SettingItem({
  label,
  description,
  value,
  onClick,
  danger = false,
  rightSlot,
  icon,
}) {
  const Tag = onClick ? 'button' : 'div';
  return _jsxs(Tag, {
    className: [
      'flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors',
      onClick ? 'cursor-pointer hover:bg-accent/50 active:bg-accent' : '',
      danger ? 'text-destructive' : 'text-foreground',
    ]
      .filter(Boolean)
      .join(' '),
    onClick: onClick,
    children: [
      icon &&
        _jsx('span', {
          className: `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`,
          children: icon,
        }),
      _jsxs('span', {
        className: 'flex-1 text-left',
        children: [
          _jsx('span', { className: 'block font-medium', children: label }),
          description &&
            _jsx('span', {
              className: 'block text-xs text-muted-foreground mt-0.5',
              children: description,
            }),
        ],
      }),
      rightSlot ??
        _jsxs(_Fragment, {
          children: [
            value !== undefined &&
              _jsx('span', { className: 'text-xs text-muted-foreground', children: value }),
            onClick &&
              _jsx(ChevronRight, { className: 'h-4 w-4 text-muted-foreground/50 shrink-0' }),
          ],
        }),
    ],
  });
}
//# sourceMappingURL=SettingsGroup.js.map

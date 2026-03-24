import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { ExternalLink, Github, MessageCircle, Bug, Heart } from 'lucide-react';
import { ScreenHeader } from './NetworkSettings';
const APP_VERSION = '0.1.0';
export function AboutScreen({ onBack }) {
  return _jsxs('div', {
    className: 'flex flex-col min-h-screen bg-background',
    children: [
      _jsx(ScreenHeader, { title: 'About', onBack: onBack }),
      _jsxs('div', {
        className: 'flex flex-col gap-5 p-4',
        children: [
          _jsxs('div', {
            className:
              'flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-100 border border-primary/20 p-6 text-center',
            children: [
              _jsx('div', {
                className:
                  'flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white text-2xl font-bold shadow-lg shadow-primary/30',
                children: 'A',
              }),
              _jsxs('div', {
                children: [
                  _jsx('p', { className: 'font-bold text-lg', children: 'Ancore Wallet' }),
                  _jsx('p', {
                    className: 'text-sm text-muted-foreground',
                    children: 'Account abstraction for Stellar',
                  }),
                ],
              }),
              _jsxs('span', {
                className:
                  'rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary',
                children: ['v', APP_VERSION],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'space-y-1.5',
            children: [
              _jsx('p', {
                className:
                  'px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground',
                children: 'Resources',
              }),
              _jsxs('div', {
                className:
                  'rounded-xl border border-border bg-card overflow-hidden divide-y divide-border',
                children: [
                  _jsx(LinkItem, {
                    icon: _jsx(Github, { className: 'h-4 w-4' }),
                    label: 'Documentation',
                    href: 'https://github.com/ancore-org/ancore',
                  }),
                  _jsx(LinkItem, {
                    icon: _jsx(MessageCircle, { className: 'h-4 w-4' }),
                    label: 'Telegram Community',
                    href: 'https://t.me/+OqlAx-gQx3M4YzJk',
                  }),
                  _jsx(LinkItem, {
                    icon: _jsx(Bug, { className: 'h-4 w-4' }),
                    label: 'Report a Bug',
                    href: 'https://github.com/ancore-org/ancore/issues',
                  }),
                ],
              }),
            ],
          }),
          _jsxs('div', {
            className: 'flex flex-col items-center gap-1.5 pt-2',
            children: [
              _jsxs('div', {
                className: 'flex items-center gap-1 text-xs text-muted-foreground',
                children: [
                  _jsx('span', { children: 'Built with' }),
                  _jsx(Heart, { className: 'h-3 w-3 text-red-400 fill-red-400' }),
                  _jsx('span', { children: 'on Stellar / Soroban' }),
                ],
              }),
              _jsx('p', {
                className: 'text-xs text-muted-foreground',
                children: 'Apache-2.0 OR MIT',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
function LinkItem({ icon, label, href }) {
  return _jsxs('a', {
    href: href,
    target: '_blank',
    rel: 'noopener noreferrer',
    className: 'flex items-center gap-3 px-4 py-3.5 text-sm hover:bg-accent/50 transition-colors',
    children: [
      _jsx('span', {
        className:
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
        children: icon,
      }),
      _jsx('span', { className: 'flex-1 font-medium', children: label }),
      _jsx(ExternalLink, { className: 'h-3.5 w-3.5 text-muted-foreground/50' }),
    ],
  });
}
//# sourceMappingURL=AboutScreen.js.map

/**
 * @ancore/ui-kit
 * Shared UI components for Ancore wallet applications
 */

export const UI_KIT_VERSION = '0.1.0';

// Core shadcn/ui components
export { Button, buttonVariants } from './components/ui/button';
export type { ButtonProps } from './components/ui/button';

export { Input } from './components/ui/input';
export type { InputProps } from './components/ui/input';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/ui/card';

export { Badge, badgeVariants } from './components/ui/badge';
export type { BadgeProps } from './components/ui/badge';

export { Separator } from './components/ui/separator';

// Custom wallet components
export { AmountInput } from './components/amount-input';
export type { AmountInputProps } from './components/amount-input';

export { AddressDisplay } from './components/address-display';
export type { AddressDisplayProps } from './components/address-display';

// Toast / Notifications
export { Toast } from './components/Toast/Toast';
export type { ToastProps } from './components/Toast/Toast';
export { NotificationProvider } from './components/Toast/NotificationProvider';
export type { Toast as ToastItem, ToastVariant } from './components/Toast/NotificationProvider';
export { useToast } from './components/Toast/useToast';

// Utility functions
export { cn } from './lib/utils';

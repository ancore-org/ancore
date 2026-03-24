import * as React from 'react';
export type TransactionStatusKind = 'confirmed' | 'pending' | 'failed' | 'cancelled';
export interface TransactionStatusProps extends React.HTMLAttributes<HTMLDivElement> {
  status: TransactionStatusKind;
}
export declare function TransactionStatus({
  status,
  className,
  ...props
}: TransactionStatusProps): import('react/jsx-runtime').JSX.Element;
//# sourceMappingURL=TransactionStatus.d.ts.map

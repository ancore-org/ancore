import { type TransactionStatusKind } from '@/components/TransactionStatus';
import { type StellarNetwork } from '@/utils/explorer-links';
export interface TransactionDetailData {
  id?: string;
  status: TransactionStatusKind;
  type: 'sent' | 'received' | 'swap' | 'payment';
  from: string;
  to: string;
  amount: string;
  assetCode?: string;
  fee: string;
  memo?: string | null;
  timestamp: string | Date;
  blockNumber?: number | string | null;
  hash: string;
  network?: StellarNetwork;
}
export interface TransactionDetailProps {
  transaction: TransactionDetailData;
  onBack?: () => void;
  className?: string;
}
declare function formatDateTime(value: string | Date): string;
declare function getHeadline(transaction: TransactionDetailData): string;
declare function getCounterpartyLabel(type: TransactionDetailData['type']): string;
declare function copyText(value: string): Promise<void>;
declare function truncateHash(hash: string): string;
export declare function TransactionDetail({
  transaction,
  onBack,
  className,
}: TransactionDetailProps): import('react/jsx-runtime').JSX.Element;
export { copyText, formatDateTime, getCounterpartyLabel, getHeadline, truncateHash };
//# sourceMappingURL=TransactionDetail.d.ts.map

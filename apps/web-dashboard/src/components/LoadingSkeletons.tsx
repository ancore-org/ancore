import React from 'react';
import { Card, CardContent, CardHeader } from '@ancore/ui-kit';
import { Skeleton } from '@ancore/ui-kit';

/**
 * Skeleton placeholder for the AccountOverview widget while data is loading.
 * Matches the layout of the real AccountOverview component.
 */
export const AccountOverviewSkeleton: React.FC<{ 'data-testid'?: string }> = ({
  'data-testid': testId = 'overview-skeleton',
}) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </CardContent>
  </Card>
);

/**
 * Skeleton placeholder for the TransactionList widget while data is loading.
 * Matches the layout of the real TransactionList component.
 */
export const TransactionListSkeleton: React.FC<{ 'data-testid'?: string }> = ({
  'data-testid': testId = 'transaction-list-skeleton',
}) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-3 w-14" />
    </CardHeader>
    <CardContent className="space-y-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between border-b py-2.5 last:border-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

/**
 * Skeleton placeholder for the BalanceChart widget while data is loading.
 * Matches the layout of the real BalanceChart component.
 */
export const BalanceChartSkeleton: React.FC<{ 'data-testid'?: string }> = ({
  'data-testid': testId = 'balance-chart-skeleton',
}) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-5 w-28" />
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-8 rounded-md" />
        ))}
      </div>
    </CardHeader>
    <CardContent>
      <div className="flex h-28 items-end gap-1.5 px-1">
        {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t rounded-b-none"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex justify-between">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-2.5 w-7" />
        ))}
      </div>
    </CardContent>
  </Card>
);

/**
 * Skeleton placeholder for the SessionKeys widget while data is loading.
 * Matches the layout of the real SessionKeys component.
 */
export const SessionKeysSkeleton: React.FC<{ 'data-testid'?: string }> = ({
  'data-testid': testId = 'session-keys-skeleton',
}) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-20 rounded-lg" />
    </CardHeader>
    <CardContent className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between border-b py-2.5 last:border-0">
          <div className="flex flex-1 items-center gap-2.5">
            <Skeleton className="h-2 w-2 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </CardContent>
  </Card>
);

/**
 * Skeleton placeholder for the MultiSig widget while data is loading.
 * Matches the layout of the real MultiSig component.
 */
export const MultiSigSkeleton: React.FC<{ 'data-testid'?: string }> = ({
  'data-testid': testId = 'multi-sig-skeleton',
}) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-3 w-10" />
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2.5 w-3/5" />
            </div>
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

/**
 * Skeleton placeholder for the InvoiceList widget while data is loading.
 * Matches the layout of the real InvoiceList component.
 */
export const InvoiceListSkeleton: React.FC<{ 'data-testid'?: string }> = ({
  'data-testid': testId = 'invoice-list-skeleton',
}) => (
  <Card data-testid={testId}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </CardHeader>
    <CardContent className="space-y-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between border-b py-3 last:border-0">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

/**
 * Full-page skeleton for Dashboard and Account pages.
 * Renders metric widget skeletons + all account widgets.
 */
export const DashboardPageSkeleton: React.FC = () => (
  <div className="space-y-6" data-testid="dashboard-skeleton">
    <Skeleton className="h-8 w-36" />
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-sm" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-1 h-8 w-32" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <AccountOverviewSkeleton />
      <BalanceChartSkeleton />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <TransactionListSkeleton />
      <div className="space-y-4">
        <SessionKeysSkeleton />
        <MultiSigSkeleton />
      </div>
    </div>
    <InvoiceListSkeleton />
  </div>
);

/**
 * @deprecated Use AccountOverviewSkeleton instead.
 * Preserved for backwards compatibility with existing tests and consumers.
 */
export const AccountSummarySkeleton = AccountOverviewSkeleton;

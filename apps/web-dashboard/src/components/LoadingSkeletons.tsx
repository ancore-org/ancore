import React from 'react';
import { Card, CardContent, CardHeader } from '@ancore/ui-kit';
import { Skeleton } from '@ancore/ui-kit';

/**
 * Skeleton placeholder for the AccountSummary card while data is loading.
 * Matches the layout of the real AccountSummary component.
 */
export const AccountSummarySkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-32" />
    </CardHeader>
    <CardContent className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </CardContent>
  </Card>
);

/**
 * Skeleton placeholder for the TransactionList card while data is loading.
 * Matches the layout of the real TransactionList component.
 */
export const TransactionListSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-40" />
    </CardHeader>
    <CardContent className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

/**
 * Full-page skeleton for Dashboard and Account pages.
 * Renders metric widget skeletons + account summary + transaction list.
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
            <Skeleton className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
    <AccountSummarySkeleton />
    <TransactionListSkeleton />
  </div>
);

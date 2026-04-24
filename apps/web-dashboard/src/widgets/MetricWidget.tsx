import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { Loader2, AlertCircle } from 'lucide-react';

export interface MetricWidgetProps {
  title: string;
  value?: string | number;
  icon?: React.ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  description?: string;
  className?: string;
}

/**
 * Reusable Metric Widget component for dashboard cards.
 * Handles loading and error states consistently.
 */
export const MetricWidget: React.FC<MetricWidgetProps> = ({
  title,
  value,
  icon,
  isLoading,
  error,
  description,
  className = '',
}) => {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-8 items-center" data-testid="metric-loading">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center space-x-2 text-destructive" data-testid="metric-error">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Error loading data</span>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold" data-testid="metric-value">
              {value ?? '—'}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricWidget;

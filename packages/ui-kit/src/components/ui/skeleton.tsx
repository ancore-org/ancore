import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional class names */
  className?: string;
}

/**
 * Skeleton placeholder for loading states.
 * Renders an animated pulse block that matches the shape of the content it replaces.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => (
  <div
    className={cn('animate-pulse rounded-md bg-muted', className)}
    aria-hidden="true"
    {...props}
  />
);

export default Skeleton;

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface IdenticonProps extends React.SVGAttributes<SVGSVGElement> {
  value: string;
  size?: number;
  label?: string;
}

function hashValue(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createMatrix(value: string): boolean[][] {
  const matrix: boolean[][] = [];
  let hash = hashValue(value);

  for (let row = 0; row < 5; row += 1) {
    const currentRow: boolean[] = [];

    for (let column = 0; column < 3; column += 1) {
      hash = Math.imul(hash ^ (row * 5 + column + 1), 16777619) >>> 0;
      currentRow.push((hash & 1) === 1);
    }

    matrix.push([...currentRow, currentRow[1], currentRow[0]]);
  }

  return matrix;
}

function getFill(value: string): string {
  const hue = hashValue(`${value}:color`) % 360;
  return `hsl(${hue} 65% 45%)`;
}

/**
 * Identicon renders a deterministic 5x5 mirrored SVG avatar from an address.
 */
export function Identicon({
  value,
  size = 40,
  label,
  className,
  ...props
}: IdenticonProps): React.JSX.Element {
  const matrix = React.useMemo(() => createMatrix(value), [value]);
  const fill = React.useMemo(() => getFill(value), [value]);
  const ariaLabel = label ?? `Identicon for address ${value}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      role="img"
      aria-label={ariaLabel}
      className={cn('overflow-hidden rounded-lg border border-slate-200 bg-slate-50', className)}
      {...props}
    >
      <rect x="0" y="0" width="5" height="5" fill="white" />
      {matrix.flatMap((row, rowIndex) =>
        row.map((enabled, columnIndex) =>
          enabled ? (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex}
              y={rowIndex}
              width="1"
              height="1"
              fill={fill}
            />
          ) : null
        )
      )}
    </svg>
  );
}

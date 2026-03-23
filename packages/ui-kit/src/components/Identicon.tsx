import React from 'react';

interface IdenticonProps {
  address: string;
  size?: number;
  ariaLabel?: string;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function intToColor(i: number): string {
  const c = (i & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

export const Identicon: React.FC<IdenticonProps> = ({ address, size = 40, ariaLabel }) => {
  const hash = hashCode(address);
  const color = intToColor(hash);
  const block = (n: number) => (hash >> n) & 1;
  const blocks = Array.from({ length: 5 * 5 }, (_, i) => block(i));

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      role="img"
      aria-label={ariaLabel || `Identicon for address ${address}`}
      tabIndex={0}
      style={{ display: 'inline-block', background: '#fff', borderRadius: 4 }}
    >
      {blocks.map((on, i) =>
        on ? (
          <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1} height={1} fill={color} />
        ) : null
      )}
    </svg>
  );
};

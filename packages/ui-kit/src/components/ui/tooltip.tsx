import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full z-50 mb-2 hidden w-max rounded border border-border bg-popover p-2 text-sm text-popover-foreground shadow-md group-hover:block group-focus-within:block">
        {content}
      </div>
    </div>
  );
};

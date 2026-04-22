import React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full mb-2 hidden w-max bg-gray-800 text-white text-sm rounded p-2 group-hover:block">
        {content}
      </div>
    </div>
  );
};

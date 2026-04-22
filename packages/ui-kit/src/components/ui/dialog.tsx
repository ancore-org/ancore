import React from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-4 rounded shadow-lg">
        {children}
        <button onClick={onClose} className="mt-4 text-red-500">
          Close
        </button>
      </div>
    </div>
  );
};

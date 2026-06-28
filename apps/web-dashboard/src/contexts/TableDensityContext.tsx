import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type TableDensity = 'comfortable' | 'compact';

interface TableDensityContextType {
  density: TableDensity;
  toggleDensity: () => void;
  setDensity: (density: TableDensity) => void;
}

const STORAGE_KEY = 'ancore-dashboard-table-density';

const getStoredDensity = (): TableDensity => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'comfortable' || stored === 'compact') {
      return stored;
    }
  } catch {
    // localStorage not available (SSR or disabled)
  }
  return 'comfortable';
};

const TableDensityContext = createContext<TableDensityContextType | undefined>(undefined);

export const TableDensityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [density, setDensityState] = useState<TableDensity>(getStoredDensity);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // localStorage not available
    }
  }, [density]);

  const toggleDensity = useCallback(() => {
    setDensityState((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  }, []);

  const setDensity = useCallback((newDensity: TableDensity) => {
    setDensityState(newDensity);
  }, []);

  return (
    <TableDensityContext.Provider value={{ density, toggleDensity, setDensity }}>
      {children}
    </TableDensityContext.Provider>
  );
};

export const useTableDensity = (): TableDensityContextType => {
  const context = useContext(TableDensityContext);
  if (!context) {
    throw new Error('useTableDensity must be used within a TableDensityProvider');
  }
  return context;
};

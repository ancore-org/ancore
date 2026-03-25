import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Toast } from './Toast';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface NotificationContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

export const NotificationContext = React.createContext<NotificationContextValue | null>(null);

type Action = { type: 'ADD'; toast: ToastItem } | { type: 'REMOVE'; id: string };

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case 'ADD':
      return [...state, action.toast];
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = React.useReducer(reducer, []);

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = 'info', duration = 4000) => {
      const id = `${Date.now()}-${Math.random()}`;
      dispatch({ type: 'ADD', toast: { id, message, variant } });
      setTimeout(() => dispatch({ type: 'REMOVE', id }), duration);
    },
    []
  );

  return (
    <NotificationContext.Provider value={{ toast }}>
      {children}
      {ReactDOM.createPortal(
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none"
        >
          {toasts.map((t) => (
            <Toast
              key={t.id}
              id={t.id}
              message={t.message}
              variant={t.variant}
              onDismiss={(id) => dispatch({ type: 'REMOVE', id })}
            />
          ))}
        </div>,
        document.body
      )}
    </NotificationContext.Provider>
  );
}

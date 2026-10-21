import React, { createContext, useContext, useState, useCallback } from 'react';

interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}

interface ToastContextType {
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        id="toasts"
        style={{
          position: 'fixed',
          right: '20px',
          bottom: '20px',
          zIndex: 9999,
          display: 'grid',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === 'error' ? 'var(--ter)' : 'var(--pri)',
              color: 'var(--pi)',
              padding: '11px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: 'var(--shh)',
              maxWidth: '360px',
              animation: 'rise var(--dc) var(--eo)',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

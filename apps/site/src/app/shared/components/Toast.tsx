import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ToastProviderProps } from '../../../types/platform-ui.types.ts';
import { ToastContext } from '../hooks/useToast.ts';

const TOAST_DURATION_MS = 3200;

/** Provê o toast da plataforma e o exibe por 3,2 s a cada mensagem nova. */
export function ToastProvider({ children }: Readonly<ToastProviderProps>) {
  const [message, setMessage] = useState('');
  const [serial, setSerial] = useState(0);

  const show = useCallback((text: string) => {
    setMessage(text);
    setSerial((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, serial]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={message ? 'fx-toast show' : 'fx-toast'} role="status" aria-live="polite">
        <span key={serial}>{message}</span>
      </div>
    </ToastContext.Provider>
  );
}

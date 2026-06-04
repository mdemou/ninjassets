import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Toast } from '~/components/Toast';
import type { Toast as ToastType } from '~/types';

const DEFAULT_TOAST_DURATION = 5000;

interface ErrorContextValue {
  toasts: ToastType[];
  addToast: (toast: Omit<ToastType, 'id' | 'duration'> & { id?: string; duration?: number }) => void;
  removeToast: (id: string) => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastType, 'id' | 'duration'> & { id?: string; duration?: number }) => {
    const id = toast.id ?? crypto.randomUUID();
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION;
    const newToast: ToastType = { ...toast, id, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        timers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timers.current.set(id, timer);
    }
  }, []);

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ErrorContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-6 right-6 z-1000 flex flex-col gap-2 max-w-[400px]">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={removeToast}
          />
        ))}
      </div>
    </ErrorContext.Provider>
  );
}

export function useError(): ErrorContextValue {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used within ErrorProvider');
  return ctx;
}

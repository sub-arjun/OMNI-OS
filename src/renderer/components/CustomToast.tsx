import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { mergeClasses } from '@fluentui/react-components';
import { Dismiss16Regular } from '@fluentui/react-icons';
import './CustomToast.css';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timeout?: number;
}

interface ToastContextType {
  showToast: (title: string, message: string, type: Toast['type']) => void;
  notifyError: (message: string) => void;
  notifyWarning: (message: string) => void;
  notifyInfo: (message: string) => void;
  notifySuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useCustomToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useCustomToast must be used within CustomToastProvider');
  }
  return context;
};

interface CustomToastProviderProps {
  children: React.ReactNode;
}

export function CustomToastProvider({ children }: CustomToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((title: string, message: string, type: Toast['type']) => {
    const id = `toast-${toastIdRef.current++}`;
    const timeout = 5000; // 5 seconds

    setToasts(prev => [...prev, { id, title, message, type, timeout }]);

    // Auto remove after timeout
    setTimeout(() => {
      removeToast(id);
    }, timeout);
  }, [removeToast]);

  const notifyError = useCallback((message: string) => {
    showToast('Error', message, 'error');
  }, [showToast]);

  const notifyWarning = useCallback((message: string) => {
    showToast('Warning', message, 'warning');
  }, [showToast]);

  const notifyInfo = useCallback((message: string) => {
    showToast('Info', message, 'info');
  }, [showToast]);

  const notifySuccess = useCallback((message: string) => {
    showToast('Success', message, 'success');
  }, [showToast]);

  const value: ToastContextType = {
    showToast,
    notifyError,
    notifyWarning,
    notifyInfo,
    notifySuccess,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="custom-toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={mergeClasses(
              'custom-toast',
              `custom-toast--${toast.type}`
            )}
          >
            <div className="custom-toast__content">
              <div className="custom-toast__title">{toast.title}</div>
              <div className="custom-toast__message">{toast.message}</div>
            </div>
            <button
              className="custom-toast__close"
              onClick={() => removeToast(toast.id)}
              aria-label="Close"
            >
              <Dismiss16Regular />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
} 
import React, { createContext, useCallback, useContext, useState } from 'react';
import { CustomAlert } from '~/components/CustomAlert';

export type AlertType = 'info' | 'success' | 'warning' | 'danger' | 'confirm';

export interface AlertConfig {
  type?: AlertType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextValue {
  showAlert: (config: AlertConfig) => void;
  confirm: (config: Omit<AlertConfig, 'type'>) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig({ type: 'info', ...cfg });
    setVisible(true);
  }, []);

  const confirm = useCallback((cfg: Omit<AlertConfig, 'type'>) => {
    setConfig({ type: 'confirm', ...cfg });
    setVisible(true);
  }, []);

  const handleConfirm = useCallback(() => {
    setVisible(false);
    const cb = config?.onConfirm;
    setTimeout(() => cb?.(), 250);
  }, [config]);

  const handleCancel = useCallback(() => {
    setVisible(false);
    const cb = config?.onCancel;
    setTimeout(() => cb?.(), 250);
  }, [config]);

  return (
    <AlertContext.Provider value={{ showAlert, confirm }}>
      {children}
      <CustomAlert
        visible={visible}
        config={config}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}

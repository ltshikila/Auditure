import React, { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { CustomAlert } from '@/components/CustomAlert';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: AlertButtonStyle;
}

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissingRef = useRef(false);

  const showAlert = useCallback((config: AlertConfig) => {
    dismissingRef.current = false;
    setAlertConfig(config);
    setVisible(true);
  }, []);

  const dismissAlert = useCallback((onPress?: () => void | Promise<void>) => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setVisible(false);
    // Wait for exit animation, then clear and fire callback
    setTimeout(() => {
      setAlertConfig(null);
      if (onPress) {
        // Use microtask so state settles before callback (which may call showAlert again)
        Promise.resolve().then(() => onPress());
      }
    }, 200);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alertConfig && (
        <CustomAlert
          config={alertConfig}
          visible={visible}
          onDismiss={dismissAlert}
        />
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

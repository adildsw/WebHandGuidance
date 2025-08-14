import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Config = {
  scaleFactor: number;
};

type ConfigContextType = {
  config: Config;
  setConfig: (newConfig: Partial<Config>) => void;
};

const defaultConfig: Config = {
  scaleFactor: 1,
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<Config>(() => {
    const stored = localStorage.getItem('appConfig');
    return stored ? JSON.parse(stored) : defaultConfig;
  });

  const setConfig = (newConfig: Partial<Config>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }));
  };

  useEffect(() => {
    localStorage.setItem('appConfig', JSON.stringify(config));
  }, [config]);

  return <ConfigContext.Provider value={{ config, setConfig }}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
}

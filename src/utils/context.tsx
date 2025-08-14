import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Config = {
  devicePPI: number;
  devicePixelRatio: number;
  calibrationMode: 'CREDIT' | 'RULER';
};

type ConfigContextType = {
  config: Config;
  setDevicePPI: (ppi: number) => void;
  setCalibrationMode: (mode: 'CREDIT' | 'RULER') => void;
};

const defaultConfig: Config = {
  devicePPI: 220,
  devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  calibrationMode: 'RULER',
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<Config>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('appConfig') : null;
    return stored ? JSON.parse(stored) : defaultConfig;
  });

  const setDevicePPI = (ppi: number) => {
    setConfigState((prev) => ({ ...prev, devicePPI: ppi }));
  };

  const setDevicePixelRatio = (dpr: number) => {
    setConfigState((prev) => ({ ...prev, devicePixelRatio: dpr }));
  };

  const setCalibrationMode = (mode: 'CREDIT' | 'RULER') => {
    setConfigState((prev) => ({ ...prev, calibrationMode: mode }));
  };

  useEffect(() => {
    localStorage.setItem('appConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    const update = () => setDevicePixelRatio(window.devicePixelRatio || 1);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const mqHandler = () => update();
    mq.addEventListener ? mq.addEventListener('change', mqHandler) : mq.addListener(mqHandler);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mq.removeEventListener ? mq.removeEventListener('change', mqHandler) : mq.removeListener(mqHandler);
    };
  }, []);

  return (
    <ConfigContext.Provider value={{ config, setDevicePPI, setCalibrationMode }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Config, ConfigContextType } from '../types/config';
import { Task } from '../types/task';
import { uid } from 'uid/single';

const defaultConfig: Config = {
  devicePPI: 256,
  devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  calibrationMode: 'RULER',
  markerDiameterMM: 5,
  testbedWidthMM: 160,
  testbedHeightMM: 100,
  defaultHand: 'right',
  defaultTrials: 3,
  defaultRepetitions: 5,
  defaultMoveThreshold: 15,
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  // localStorage.clear();

  const [config, setConfigState] = useState<Config>(() => {
    var stored = typeof window !== 'undefined' ? localStorage.getItem('appConfig') : null;
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

  const setMarkerDiameter = (diameter: number) => {
    setConfigState((prev) => ({ ...prev, markerDiameterMM: diameter }));
  };

  const setTestbedWidth = (width: number) => {
    setConfigState((prev) => ({ ...prev, testbedWidthMM: width }));
  };

  const setTestbedHeight = (height: number) => {
    setConfigState((prev) => ({ ...prev, testbedHeightMM: height }));
  };

  const setDefaultHand = (hand: 'right' | 'left') => {
    setConfigState((prev) => ({ ...prev, defaultHand: hand }));
  };

  const setDefaultTrials = (trials: number) => {
    setConfigState((prev) => ({ ...prev, defaultTrials: trials }));
  };

  const setDefaultRepetitions = (repetitions: number) => {
    setConfigState((prev) => ({ ...prev, defaultRepetitions: repetitions }));
  };

  const setDefaultMoveThreshold = (threshold: number) => {
    setConfigState((prev) => ({ ...prev, defaultMoveThreshold: threshold }));
  };

  const generateDefaultTask = (): Task => {
    return {
      tag: 'task-' + uid(5),
      hand: config.defaultHand,
      trials: config.defaultTrials,
      repetitions: config.defaultRepetitions,
      moveThreshold: config.defaultMoveThreshold,
      markers: [],
    };
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
    <ConfigContext.Provider
      value={{
        config,
        setDevicePPI,
        setCalibrationMode,
        setMarkerDiameter,
        setTestbedWidth,
        setTestbedHeight,
        setDefaultHand,
        setDefaultTrials,
        setDefaultRepetitions,
        setDefaultMoveThreshold,
        generateDefaultTask,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
}

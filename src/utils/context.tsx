import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CalibrationTools, Config, ConfigContextType } from '../types/config';
import type { Task } from '../types/task';
import { uid } from 'uid/single';
import { defaultConfig } from './constants';

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  // localStorage.clear();
  const [config, setConfigState] = useState<Config>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('appConfig') : null;
    const parsed = stored ? JSON.parse(stored) : {};
    return { ...defaultConfig, ...parsed };
  });

  const setDevicePPI = (ppi: number) => {
    setConfigState((prev) => ({ ...prev, devicePPI: ppi }));
  };

  const setWorldPPI = (ppi: number) => {
    setConfigState((prev) => ({ ...prev, worldPPI: ppi }));
  };

  const setDevicePixelRatio = (dpr: number) => {
    setConfigState((prev) => ({ ...prev, devicePixelRatio: dpr }));
  };

  const setCalibrationTool = (tool: CalibrationTools) => {
    setConfigState((prev) => ({ ...prev, calibrationTool: tool }));
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

  const setDefaultHand = (hand: 'Right' | 'Left') => {
    setConfigState((prev) => ({ ...prev, defaultHand: hand }));
  };

  const setDefaultTrials = (trials: number) => {
    setConfigState((prev) => ({ ...prev, defaultTrials: trials }));
  };

  const setDefaultRepetitions = (repetitions: number) => {
    setConfigState((prev) => ({ ...prev, defaultRepetitions: repetitions }));
  };

  const setDefaultDistanceThreshold = (threshold: number) => {
    setConfigState((prev) => ({ ...prev, defaultDistanceThreshold: threshold }));
  };

  const setDefaultHoldDuration = (duration: number) => {
    setConfigState((prev) => ({ ...prev, defaultHoldDuration: duration }));
  };

  const setDefaultTaskType = (type: 'MOVE' | 'HOLD') => {
    setConfigState((prev) => ({ ...prev, defaultTaskType: type }));
  };

  const setDefaultStartDuration = (duration: number) => {
    setConfigState((prev) => ({ ...prev, defaultStartDuration: duration }));
  };

  const generateDefaultTask = (type: 'MOVE' | 'HOLD' = config.defaultTaskType): Task => {
    return {
      tag: 'task-' + uid(5),
      hand: config.defaultHand,
      trials: type === 'MOVE' ? config.defaultTrials : 1,
      repetitions: type === 'MOVE' ? config.defaultRepetitions : 1,
      distanceThreshold: config.defaultDistanceThreshold,
      holdDuration: config.defaultHoldDuration,
      type: type,
      markers: [{ x: 0, y: 0 }],
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
    if (mq.addEventListener) {
      mq.addEventListener('change', mqHandler);
    } else {
      mq.addListener(mqHandler);
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (mq.removeEventListener) {
        mq.removeEventListener('change', mqHandler);
      } else {
        mq.removeListener(mqHandler);
      }
    };
  }, []);

  return (
    <ConfigContext.Provider
      value={{
        config,
        setDevicePPI,
        setCalibrationTool,
        setMarkerDiameter,
        setTestbedWidth,
        setTestbedHeight,
        setDefaultHand,
        setDefaultTrials,
        setDefaultRepetitions,
        setDefaultDistanceThreshold,
        setDefaultHoldDuration,
        setDefaultStartDuration,
        setDefaultTaskType,
        setWorldPPI,
        generateDefaultTask,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
}

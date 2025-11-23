import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { CalibrationTools, Config, ConfigContextType, RomCalibrationParams } from '../types/config';
import type { HoldTaskPayload, MediaTaskPayload, MoveTaskPayload, ROMHoldTaskPayload, ROMMoveTaskPayload, Task } from '../types/task';
import { uid } from 'uid/single';
import { defaultConfig, SYSTEM_VERSION } from './constants';

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  // localStorage.clear();
  const [config, setConfigState] = useState<Config>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('appConfig') : null;
    const parsed = stored ? JSON.parse(stored) : {};
    if ((parsed.version || "0.1") !== SYSTEM_VERSION) {
      console.log("Version mismatch detected, resetting app settings...");
      return { ...defaultConfig, version: SYSTEM_VERSION };
    } else console.log("App version:", parsed.version);
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

  const setDefaultTaskType = (type: 'MOVE' | 'HOLD' | 'ROM_HOLD' | 'ROM_MOVE' | 'MEDIA') => {
    setConfigState((prev) => ({ ...prev, defaultTaskType: type }));
  };

  const setDefaultStartDuration = (duration: number) => {
    setConfigState((prev) => ({ ...prev, defaultStartDuration: duration }));
  };

  const setMinVibrationThreshold = (threshold: number) => {
    setConfigState((prev) => ({ ...prev, minVibrationThresholdMM: threshold }));
  };

  const setMaxVibrationThreshold = (threshold: number) => {
    setConfigState((prev) => ({ ...prev, maxVibrationThresholdMM: threshold }));
  };

  const setSilParams = (params: { silY: number; silScaleX: number; silScaleY: number; silCalibrated: boolean }) => {
    setConfigState((prev) => ({ ...prev, silParams: params }));
  };

  const setRomCalibrationParams = (params: RomCalibrationParams | null) => {
    setConfigState((prev) => ({ ...prev, romCalibrationParams: params }));
  };

  const setRomSafeMargin = (margin: number) => {
    setConfigState((prev) => ({ ...prev, romSafeMargin: margin }));
  };

  const generateDefaultMoveTaskPayload = (): MoveTaskPayload => ({
    hand: config.defaultHand,
    repetitions: config.defaultRepetitions,
    trials: config.defaultTrials,
    markers: [{ x: 0, y: 0 }],
    distanceThreshold: config.defaultDistanceThreshold,
  });

  const generateDefaultHoldTaskPayload = (): HoldTaskPayload => ({
    hand: config.defaultHand,
    repetitions: 1,
    trials: 1,
    markers: [{ x: 0, y: 0 }],
    distanceThreshold: config.defaultDistanceThreshold,
    holdDuration: config.defaultHoldDuration,
  });

  const generateDefaultROMMoveTaskPayload = (): ROMMoveTaskPayload => ({
    hand: config.defaultHand,
    repetitions: config.defaultRepetitions,
    trials: config.defaultTrials,
    markers: [{ radius: 0, angle: 0 }],
    distanceThreshold: config.defaultDistanceThreshold,
  });

  const generateDefaultROMHoldTaskPayload = (): ROMHoldTaskPayload => ({
    hand: config.defaultHand,
    repetitions: 1,
    trials: 1,
    markers: [{ radius: 0, angle: 0 }],
    distanceThreshold: config.defaultDistanceThreshold,
    holdDuration: config.defaultHoldDuration,
  });

  const generateDefaultMediaPayload = (): MediaTaskPayload => ({
    mediaUrl: '',
    mediaTitle: '',
    mediaSubtitle: '',
  });
  // https://webhandguidance.b-cdn.net/task_video_1_demo_test.mp4

  const generateDefaultTask = (type: 'MOVE' | 'HOLD' | 'ROM_MOVE' | 'ROM_HOLD' | 'MEDIA' = config.defaultTaskType): Task => {
    return {
      tag: type === 'MEDIA' ? 'media-' + uid(5) : 'task-' + uid(5),
      type: type,
      movePayload: generateDefaultMoveTaskPayload(),
      holdPayload: generateDefaultHoldTaskPayload(),
      romMovePayload: generateDefaultROMMoveTaskPayload(),
      romHoldPayload: generateDefaultROMHoldTaskPayload(),
      mediaPayload: generateDefaultMediaPayload(),
    };
  };

  const setServerURL = (url: string) => {
    setConfigState((prev) => ({ ...prev, serverURL: url }));
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
        setMinVibrationThreshold,
        setMaxVibrationThreshold,
        setDefaultTaskType,
        setWorldPPI,
        generateDefaultTask,
        setSilParams,
        setRomCalibrationParams,
        setRomSafeMargin,
        setServerURL,
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

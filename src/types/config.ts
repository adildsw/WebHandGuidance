import type { Task } from './task';

export type CalibrationTools = 'CREDIT' | 'RULER' | 'DOLLAR';

export type SilhouetteParams = {
  silY: number;
  silScaleX: number;
  silScaleY: number;
  silCalibrated: boolean;
};

export type RomCalibrationParams = {
  leftRadius: number;
  rightRadius: number;
};

export type Config = {
  devicePPI: number;
  devicePixelRatio: number;
  worldPPI: number;
  calibrationTool: CalibrationTools;
  markerDiameterMM: number;
  testbedWidthMM: number;
  testbedHeightMM: number;
  defaultHand: 'Right' | 'Left';
  defaultTrials: number;
  defaultRepetitions: number;
  defaultDistanceThreshold: number;
  defaultHoldDuration: number;
  defaultStartDuration: number;
  minVibrationThresholdMM: number;
  maxVibrationThresholdMM: number;
  defaultTaskType: 'MOVE' | 'HOLD' | 'ROM_MOVE' | 'ROM_HOLD' | 'MEDIA';
  silParams: SilhouetteParams;
  romCalibrationParams: RomCalibrationParams | null;
  romSafeMargin: number;
  serverURL: string;
  version: string;
};

export type ConfigContextType = {
  config: Config;
  setDevicePPI: (ppi: number) => void;
  setWorldPPI: (ppi: number) => void;
  setCalibrationTool: (tool: CalibrationTools) => void;
  setMarkerDiameter: (diameter: number) => void;
  setTestbedWidth: (width: number) => void;
  setTestbedHeight: (height: number) => void;
  setDefaultHand: (hand: 'Right' | 'Left') => void;
  setDefaultTrials: (trials: number) => void;
  setDefaultRepetitions: (repetitions: number) => void;
  setDefaultDistanceThreshold: (threshold: number) => void;
  setDefaultHoldDuration: (duration: number) => void;
  setDefaultStartDuration: (duration: number) => void;
  setMinVibrationThreshold: (threshold: number) => void;
  setMaxVibrationThreshold: (threshold: number) => void;
  setDefaultTaskType: (type: 'MOVE' | 'HOLD' | 'ROM_MOVE' | 'ROM_HOLD' | 'MEDIA') => void;
  generateDefaultTask: (type?: 'MOVE' | 'HOLD' | 'ROM_MOVE' | 'ROM_HOLD' | 'MEDIA') => Task;
  setSilParams: (params: SilhouetteParams) => void;
  setRomCalibrationParams: (params: RomCalibrationParams | null) => void;
  setRomSafeMargin: (margin: number) => void;
  setServerURL: (url: string) => void;
};

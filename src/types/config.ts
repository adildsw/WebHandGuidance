import type { Task } from "./task";

export type CalibrationTools = 'CREDIT' | 'RULER' | 'DOLLAR';

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
  defaultTaskType: 'MOVE' | 'HOLD';
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
  setDefaultTaskType: (type: 'MOVE' | 'HOLD') => void;
  generateDefaultTask: (type?: 'MOVE' | 'HOLD') => Task;
};
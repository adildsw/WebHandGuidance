import { Task } from "./task";

export type CalibrationTools = 'CREDIT' | 'RULER' | 'DOLLAR';

export type Config = {
  devicePPI: number;
  devicePixelRatio: number;
  calibrationTool: CalibrationTools;
  markerDiameterMM: number;
  testbedWidthMM: number;
  testbedHeightMM: number;
  defaultHand: 'Right' | 'Left';
  defaultTrials: number;
  defaultRepetitions: number;
  defaultMoveThreshold: number;
};

export type ConfigContextType = {
  config: Config;
  setDevicePPI: (ppi: number) => void;
  setCalibrationTool: (tool: CalibrationTools) => void;
  setMarkerDiameter: (diameter: number) => void;
  setTestbedWidth: (width: number) => void;
  setTestbedHeight: (height: number) => void;
  setDefaultHand: (hand: 'Right' | 'Left') => void;
  setDefaultTrials: (trials: number) => void;
  setDefaultRepetitions: (repetitions: number) => void;
  setDefaultMoveThreshold: (threshold: number) => void;
  generateDefaultTask: () => Task;
};
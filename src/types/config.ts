import { Task } from "./task";

export type Config = {
  devicePPI: number;
  devicePixelRatio: number;
  calibrationMode: 'CREDIT' | 'RULER';
  markerDiameterMM: number;
  testbedWidthMM: number;
  testbedHeightMM: number;
  defaultHand: 'right' | 'left';
  defaultTrials: number;
  defaultRepetitions: number;
  defaultMoveThreshold: number;
};

export type ConfigContextType = {
  config: Config;
  setDevicePPI: (ppi: number) => void;
  setCalibrationMode: (mode: 'CREDIT' | 'RULER') => void;
  setMarkerDiameter: (diameter: number) => void;
  setTestbedWidth: (width: number) => void;
  setTestbedHeight: (height: number) => void;
  setDefaultHand: (hand: 'right' | 'left') => void;
  setDefaultTrials: (trials: number) => void;
  setDefaultRepetitions: (repetitions: number) => void;
  setDefaultMoveThreshold: (threshold: number) => void;
  generateDefaultTask: () => Task;
};
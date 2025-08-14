export type Config = {
  devicePPI: number;
  devicePixelRatio: number;
  calibrationMode: 'CREDIT' | 'RULER';
  markerDiameterMM: number;
  testbedWidthMM: number;
  testbedHeightMM: number;
};

export type ConfigContextType = {
  config: Config;
  setDevicePPI: (ppi: number) => void;
  setCalibrationMode: (mode: 'CREDIT' | 'RULER') => void;
  setMarkerDiameter: (diameter: number) => void;
  setTestbedWidth: (width: number) => void;
  setTestbedHeight: (height: number) => void;
};
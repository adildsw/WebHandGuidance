export type Pos = {
  x: number;
  y: number;
};

export type FingerTips = {
  index: Pos | null;
  middle: Pos | null;
  ring: Pos | null;
  pinky: Pos | null;
  thumb: Pos | null;
};

export type WristDetectionResult = {
  leftWrist: Pos | null;
  rightWrist: Pos | null;
};

export type HeadShoulderDetectionResult = {
  nose: Pos | null;
  leftShoulder: Pos | null;
  rightShoulder: Pos | null;
  noseShoulderDistance: number | null;
  interShoulderDistance: number | null;
  posErrorX: number | null;
  posErrorY: number | null;
  posErrorZ: number | null;
  guideOpacity: number;
  posMessage: string;
};

export type Marker = {
  id: number;
  corners: { x: number; y: number }[];
};

export type MarkerOperationResult = {
  replayMarker: Marker | null;
  isReplayMarkerVisible: boolean;
  calibrationMarker: Marker | null;
  isCalibrationMarkerVisible: boolean;
  continueMarker: Marker | null;
  isContinueMarkerVisible: boolean;
  calibrationMarkerDetectionTime: number | null;
  replayMarkerDetectionTime: number | null;
  continueMarkerDetectionTime: number | null;
  calibrationMarkerLength: number | null;
  allMarkers: Marker[];
}
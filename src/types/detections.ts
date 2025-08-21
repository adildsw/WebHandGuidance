export type Pos = {
  x: number;
  y: number;
}

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
}

export type PinchDetectionResult = {
  pinchPos: { left: Pos | null; right: Pos | null };
  indexPinch: { left: boolean; right: boolean };
  middlePinch: { left: boolean; right: boolean };
}
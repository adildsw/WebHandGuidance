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

export type FingertipDetectionResult = {
  leftFingerTips: FingerTips;
  rightFingerTips: FingerTips;
};
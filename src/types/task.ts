export type Pos = { x: number; y: number };

export type TaskType = 'MOVE' | 'HOLD' | 'ROM_MOVE' | 'ROM_HOLD' | 'MEDIA';

export type Handedness = 'Left' | 'Right';

export type PolarPos = {
  radius: number;
  angle: number;
};

export type MoveTaskPayload = {
  hand: Handedness;
  repetitions: number;
  trials: number;
  markers: Pos[];
  distanceThreshold: number;
};

export type HoldTaskPayload = {
  hand: Handedness;
  repetitions: number;
  trials: number;
  markers: Pos[];
  distanceThreshold: number;
  holdDuration: number;
};

export type ROMMoveTaskPayload = {
  hand: Handedness;
  repetitions: number;
  trials: number;
  markers: PolarPos[];
  distanceThreshold: number;
};

export type ROMHoldTaskPayload = {
  hand: Handedness;
  repetitions: number;
  trials: number;
  markers: PolarPos[];
  distanceThreshold: number;
  holdDuration: number;
};

export type MediaTaskPayload = {
  mediaUrl: string;
  mediaTitle: string;
  mediaSubtitle: string;
};

export type Task = {
  tag: string;
  type: TaskType;
  movePayload: MoveTaskPayload;
  holdPayload: HoldTaskPayload;
  romMovePayload: ROMMoveTaskPayload;
  romHoldPayload: ROMHoldTaskPayload;
  mediaPayload: MediaTaskPayload;
};

export type TaskTemplate = 'CUSTOM' | 'RANDOM' | 'LAT_RAISE' | 'ROUND_RAISE' | 'FULL_CIRCLE' | 'SHOULDER_PRESS' | 'ACROSS_CHEST';
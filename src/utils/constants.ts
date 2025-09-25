import type { Config } from '../types/config';
import type { FingerTips } from '../types/detections';

export const CREDIT_CARD_WIDTH_INCH = 3.37;
export const CREDIT_CARD_HEIGHT_INCH = 2.13;
export const CREDIT_CARD_ASPECT_RATIO = CREDIT_CARD_WIDTH_INCH / CREDIT_CARD_HEIGHT_INCH;

export const DOLLAR_BILL_WIDTH_INCH = 6.14;
export const DOLLAR_BILL_HEIGHT_INCH = 2.61;
export const DOLLAR_BILL_ASPECT_RATIO = DOLLAR_BILL_WIDTH_INCH / DOLLAR_BILL_HEIGHT_INCH;

export const LETTER_HEIGHT_INCH = 11;

export const MM_TO_INCH = 1 / 25.4;
export const INCH_TO_MM = 25.4;

export const defaultFingerTips: FingerTips = {
  index: null,
  middle: null,
  ring: null,
  pinky: null,
  thumb: null,
};

export const defaultConfig: Config = {
  devicePPI: 109,
  devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  calibrationTool: 'RULER',
  comPort: null,
  worldPPI: 24,
  markerDiameterMM: 5,
  testbedWidthMM: 160,
  testbedHeightMM: 100,
  defaultHand: 'Right',
  defaultTrials: 3,
  defaultRepetitions: 5,
  defaultDistanceThreshold: 50,
  defaultHoldDuration: 5000,
  defaultStartDuration: 3000,
  defaultTaskType: 'MOVE'
};

export const HAND_LANDMARKER_MODEL_PATH = './models/hand_landmarker.task';
export const POSE_LANDMARKER_MODEL_PATH = './models/pose_landmarker_lite.task';

export const VISION_TASKS_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
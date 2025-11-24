import type { Config } from '../types/config';
import type { FingerTips, HeadShoulderDetectionResult, WristDetectionResult } from '../types/detections';
import type { Task } from '../types/task';

export const SYSTEM_VERSION = '0.2.1';

export const CREDIT_CARD_WIDTH_INCH = 3.37;
export const CREDIT_CARD_HEIGHT_INCH = 2.13;
export const CREDIT_CARD_ASPECT_RATIO = CREDIT_CARD_WIDTH_INCH / CREDIT_CARD_HEIGHT_INCH;

export const DOLLAR_BILL_WIDTH_INCH = 6.14;
export const DOLLAR_BILL_HEIGHT_INCH = 2.61;
export const DOLLAR_BILL_ASPECT_RATIO = DOLLAR_BILL_WIDTH_INCH / DOLLAR_BILL_HEIGHT_INCH;

export const LETTER_HEIGHT_INCH = 11;

export const MM_TO_INCH = 1 / 25.4;
export const INCH_TO_MM = 25.4;

export const CALIBRATION_MARKER_ID = 0;
export const REPLAY_MARKER_ID = 10;
export const CONTINUE_MARKER_ID = 20;

// export const ARUCO_MARKER_SIZE_MM = 200;
export const ARUCO_MARKER_SIZE_INCH = 7.87402; // 200mm

export const defaultFingerTips: FingerTips = {
  index: null,
  middle: null,
  ring: null,
  pinky: null,
  thumb: null,
};

const isMacbook = typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent);

export const defaultConfig: Config = {
  devicePPI: isMacbook ? 256 : 109,
  devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  calibrationTool: 'CREDIT',
  worldPPI: 24,
  markerDiameterMM: 5,
  testbedWidthMM: 200,
  testbedHeightMM: 100,
  defaultHand: 'Right',
  defaultTrials: 3,
  defaultRepetitions: 5,
  defaultDistanceThreshold: 50,
  defaultHoldDuration: 5000,
  defaultStartDuration: 3000,
  minVibrationThresholdMM: 50,
  maxVibrationThresholdMM: 200,
  defaultTaskType: 'ROM_MOVE',
  silParams: { silY: 0, silScaleX: 1, silScaleY: 1, silCalibrated: false },
  romCalibrationParams: null,
  romSafeMargin: 0.85,
  serverURL: "https://xia9elgwbl.execute-api.us-east-2.amazonaws.com/",
  version: "0.1",
};

export const defaultHeadShoulderResult: HeadShoulderDetectionResult = {
  nose: null,
  leftShoulder: null,
  rightShoulder: null,
  noseShoulderDistance: null,
  interShoulderDistance: null,
  posErrorX: null,
  posErrorY: null,
  posErrorZ: null,
  guideOpacity: 1,
  posMessage: 'Uncalibrated',
};

export const defaultWristResult: WristDetectionResult = {
  leftWrist: null,
  rightWrist: null,
};

export const HAND_LANDMARKER_MODEL_PATH = './models/hand_landmarker.task';
export const POSE_LANDMARKER_MODEL_PATH = './models/pose_landmarker_lite.task';

export const VISION_TASKS_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// Silhouette Image Dimensions
export const SIL_IMG_WIDTH = 1154;
export const SIL_IMG_HEIGHT = 1043;

// Silhouette Landmark Offsets
export const NOSE_Y_OFFSET = -0.225;
export const SHOULDER_Y_OFFSET = -0.125;
export const SHOULDER_X_OFFSET = 0.065;

export const SAMPLE_TASK: Task[] = [{"tag":"task-am86t","type":"ROM_MOVE","movePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"x":0,"y":0}],"distanceThreshold":50},"holdPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"x":0,"y":0}],"distanceThreshold":50,"holdDuration":5000},"romMovePayload":{"hand":"Left","repetitions":5,"trials":3,"markers":[{"radius":0,"angle":0},{"radius":0.335,"angle":0},{"radius":0.67,"angle":3.141592653589793}],"distanceThreshold":50},"romHoldPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"radius":0,"angle":0}],"distanceThreshold":50,"holdDuration":5000},"mediaPayload":{"mediaUrl":"","mediaTitle":"","mediaSubtitle":""}},{"tag":"task-qfny5","type":"ROM_HOLD","movePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"x":0,"y":0}],"distanceThreshold":50},"holdPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"x":0,"y":0}],"distanceThreshold":50,"holdDuration":5000},"romMovePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"radius":0,"angle":0},{"radius":1,"angle":0},{"radius":0.5,"angle":1.57}],"distanceThreshold":50},"romHoldPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"angle":-2.3490746190712897,"radius":0.4503212935923291}],"distanceThreshold":50,"holdDuration":5000},"mediaPayload":{"mediaUrl":"","mediaTitle":"","mediaSubtitle":""}},{"tag":"task-an8uj","type":"MOVE","movePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"x":0,"y":0}],"distanceThreshold":50},"holdPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"x":0,"y":0}],"distanceThreshold":50,"holdDuration":5000},"romMovePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"radius":0,"angle":0},{"radius":1,"angle":0},{"radius":0.5,"angle":1.57}],"distanceThreshold":50},"romHoldPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"radius":0,"angle":0}],"distanceThreshold":50,"holdDuration":5000},"mediaPayload":{"mediaUrl":"","mediaTitle":"","mediaSubtitle":""}},{"tag":"task-yvhgi","type":"ROM_MOVE","movePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"x":0,"y":0}],"distanceThreshold":50},"holdPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"x":0,"y":0}],"distanceThreshold":50,"holdDuration":5000},"romMovePayload":{"hand":"Right","repetitions":5,"trials":3,"markers":[{"radius":0,"angle":0},{"radius":0.67,"angle":0},{"radius":0.67,"angle":1.2566370614359172},{"radius":0.67,"angle":2.5132741228718345},{"radius":0.67,"angle":3.7699111843077517},{"radius":0.67,"angle":5.026548245743669}],"distanceThreshold":50},"romHoldPayload":{"hand":"Right","repetitions":5,"trials":1,"markers":[{"radius":0,"angle":0}],"distanceThreshold":50,"holdDuration":5000},"mediaPayload":{"mediaUrl":"","mediaTitle":"","mediaSubtitle":""}}];
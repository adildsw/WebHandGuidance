import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { FingerTips, HeadShoulderDetectionResult, PinchDetectionResult, WristDetectionResult } from '../types/detections';
import {
  defaultFingerTips,
  HAND_LANDMARKER_MODEL_PATH,
  MM_TO_INCH,
  NOSE_Y_OFFSET,
  POSE_LANDMARKER_MODEL_PATH,
  SHOULDER_X_OFFSET,
  SHOULDER_Y_OFFSET,
  SIL_IMG_HEIGHT,
  SIL_IMG_WIDTH,
  VISION_TASKS_WASM_URL,
} from '../utils/constants';
import { distance, mapVideoToTestbed } from '../utils/math';
import { useConfig } from '../utils/context';
import type { SilhouetteParams } from '../types/config';

const INDEX_PINCH_THRESHOLD = 0.25;
const MIDDLE_PINCH_THRESHOLD = 0.25;
const PINCH_INDICES: Record<keyof FingerTips, number> = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const WRIST_INDICES = { wrist1: 0, wrist2: 5, wrist3: 17 };

const HEAD_SHOULDER_INDICES = { nose: 0, leftShoulder: 11, rightShoulder: 12 };

// |-------------------------
// | MODEL INITIALIZATIONS
// |-------------------------
const initDetectors = async () => {
  const vision = await FilesetResolver.forVisionTasks(VISION_TASKS_WASM_URL);
  const handDetector = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_LANDMARKER_MODEL_PATH,
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  const poseDetector = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_LANDMARKER_MODEL_PATH,
    },
    runningMode: 'VIDEO',
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return { handDetector, poseDetector };
};

// |-------------------------
// | MODEL DETECTIONS
// |-------------------------
const detectPinchAndWrist = (detector: HandLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number, factor: number) => {
  const leftFingerTips: FingerTips = { ...defaultFingerTips };
  const rightFingerTips: FingerTips = { ...defaultFingerTips };
  const pinch: PinchDetectionResult = {
    pinchPos: { left: null, right: null },
    indexPinch: { left: false, right: false },
    middlePinch: { left: false, right: false },
  };
  const wrist: WristDetectionResult = {
    leftWrist: null,
    rightWrist: null,
  };

  try {
    const detections = detector.detectForVideo(video, performance.now());
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const hands = detections.landmarks || [];

    for (let i = 0; i < hands.length; i++) {
      const handed = (detections.handedness?.[i]?.[0]?.categoryName || detections.handedness?.[i]?.[0]?.displayName || '').toLowerCase();
      const side = handed === 'left' ? 'left' : handed === 'right' ? 'right' : hands.length === 1 ? ((hands[i]?.[0]?.x ?? 0.5) < 0.5 ? 'left' : 'right') : null;
      if (!side) continue;
      for (const k of Object.keys(PINCH_INDICES) as (keyof FingerTips)[]) {
        const lm = hands[i]?.[PINCH_INDICES[k]];
        if (!lm) continue;
        const x = 1 - lm.x;
        const y = lm.y;
        const pt = mapVideoToTestbed(x * vw, y * vh, vw, vh, testbedWidth, testbedHeight);
        if (!pt) continue;
        if (side === 'left') leftFingerTips[k] = pt;
        else rightFingerTips[k] = pt;
      }

      const w1 = hands[i]?.[WRIST_INDICES.wrist1];
      const w2 = hands[i]?.[WRIST_INDICES.wrist2];
      const w3 = hands[i]?.[WRIST_INDICES.wrist3];
      if (w1 && w2 && w3) {
        const x = 1 - (w1.x + w2.x + w3.x) / 3;
        const y = (w1.y + w2.y + w3.y) / 3;
        const pt = mapVideoToTestbed(x * vw, y * vh, vw, vh, testbedWidth, testbedHeight);

        if (side === 'left') wrist.leftWrist = pt;
        else wrist.rightWrist = pt;
      }
    }

    pinch.pinchPos.left =
      leftFingerTips.index && leftFingerTips.thumb
        ? {
            x: (leftFingerTips.index.x + leftFingerTips.thumb.x) / 2,
            y: (leftFingerTips.index.y + leftFingerTips.thumb.y) / 2,
          }
        : null;

    pinch.pinchPos.right =
      rightFingerTips.index && rightFingerTips.thumb
        ? {
            x: (rightFingerTips.index.x + rightFingerTips.thumb.x) / 2,
            y: (rightFingerTips.index.y + rightFingerTips.thumb.y) / 2,
          }
        : null;

    pinch.indexPinch.left =
      leftFingerTips.index && leftFingerTips.thumb
        ? distance(leftFingerTips.index.x, leftFingerTips.index.y, leftFingerTips.thumb.x, leftFingerTips.thumb.y) / factor < INDEX_PINCH_THRESHOLD
        : false;
    pinch.indexPinch.right =
      rightFingerTips.index && rightFingerTips.thumb
        ? distance(rightFingerTips.index.x, rightFingerTips.index.y, rightFingerTips.thumb.x, rightFingerTips.thumb.y) / factor < INDEX_PINCH_THRESHOLD
        : false;
    pinch.middlePinch.left =
      leftFingerTips.middle && leftFingerTips.thumb && pinch.indexPinch.left
        ? distance(leftFingerTips.middle.x, leftFingerTips.middle.y, leftFingerTips.thumb.x, leftFingerTips.thumb.y) / factor < MIDDLE_PINCH_THRESHOLD
        : false;
    pinch.middlePinch.right =
      rightFingerTips.middle && rightFingerTips.thumb && pinch.indexPinch.right
        ? distance(rightFingerTips.middle.x, rightFingerTips.middle.y, rightFingerTips.thumb.x, rightFingerTips.thumb.y) / factor < MIDDLE_PINCH_THRESHOLD
        : false;
  } catch (err) {
    console.error('Error during hand detection:', err);
  }

  return { pinch, wrist };
};

const detectHeadAndShoulders = (detector: PoseLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number, silParams: SilhouetteParams) => {
  const headShoulderResult: HeadShoulderDetectionResult = {
    nose: null,
    leftShoulder: null,
    rightShoulder: null,
    noseShoulderDistance: null,
    interShoulderDistance: null,
    posErrorX: null,
    posErrorZ: null,
    posMessage: 'Uncalibrated',
  };

  try {
    const detections = detector.detectForVideo(video, performance.now());
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const nose = detections.landmarks?.[0]?.[HEAD_SHOULDER_INDICES.nose];
    const leftShoulder = detections.landmarks?.[0]?.[HEAD_SHOULDER_INDICES.leftShoulder];
    const rightShoulder = detections.landmarks?.[0]?.[HEAD_SHOULDER_INDICES.rightShoulder];

    if (!nose || !leftShoulder || !rightShoulder) return headShoulderResult;

    const nosePt = mapVideoToTestbed((1 - nose.x) * vw, nose.y * vh, vw, vh, testbedWidth, testbedHeight);
    const leftShoulderPt = mapVideoToTestbed((1 - leftShoulder.x) * vw, leftShoulder.y * vh, vw, vh, testbedWidth, testbedHeight);
    const rightShoulderPt = mapVideoToTestbed((1 - rightShoulder.x) * vw, rightShoulder.y * vh, vw, vh, testbedWidth, testbedHeight);
    const noseShoulderDistance = distance(nosePt.x, nosePt.y, nosePt.x, (leftShoulderPt.y + rightShoulderPt.y) / 2);
    const interShoulderDistance = distance(leftShoulderPt.x, leftShoulderPt.y, rightShoulderPt.x, rightShoulderPt.y);

    // |---------------------------------
    // | Position Error Calculation
    // |---------------------------------
    let posErrorX: number | null = null;
    let posErrorZ: number | null = null;
    let posMessage = 'Uncalibrated';
    if (silParams.silCalibrated) {
      const h = SIL_IMG_HEIGHT * silParams.silScaleY;
      const w = SIL_IMG_WIDTH * silParams.silScaleX;

      const noseY = silParams.silY + NOSE_Y_OFFSET * h;
      const shoulderY = silParams.silY + SHOULDER_Y_OFFSET * h;
      const leftShoulderX = SHOULDER_X_OFFSET * w;
      const rightShoulderX = -SHOULDER_X_OFFSET * w;

      // Calculate Average Error
      const noseShoulderDistanceError = Math.abs(noseShoulderDistance! - distance(0, noseY, 0, shoulderY));
      const interShoulderDistanceError = Math.abs(interShoulderDistance! - distance(leftShoulderX, shoulderY, rightShoulderX, shoulderY));
      const averageError = (noseShoulderDistanceError + interShoulderDistanceError) / 2;

      // Calculate Error as Percent of Average Distance from Silhouette
      const averageSilDistance = (distance(0, noseY, 0, shoulderY) + distance(leftShoulderX, shoulderY, rightShoulderX, shoulderY)) / 2;
      const signZ = noseShoulderDistance > distance(0, noseY, 0, shoulderY) ? 1 : -1;
      posErrorZ = (averageError / averageSilDistance) * signZ;

      // Calculate Horizontal Positional Error
      const noseXDistanceError = Math.abs(nosePt.x - 0);
      const signX = nosePt.x < 0 ? 1 : -1;
      posErrorX = (noseXDistanceError / (testbedWidth / 2)) * signX;

      posMessage = "You're in Position!";
      if (Math.abs(posErrorZ) > 0.15) posMessage = posErrorZ > 0 ? 'Move Further From Screen' : 'Move Closer To Screen';
      else if (Math.abs(posErrorX) > 0.15) posMessage = posErrorX > 0 ? 'Move Right' : 'Move Left';
    }

    return {
      nose: nosePt,
      leftShoulder: leftShoulderPt,
      rightShoulder: rightShoulderPt,
      noseShoulderDistance: noseShoulderDistance,
      interShoulderDistance: interShoulderDistance,
      posErrorX,
      posErrorZ,
      posMessage,
    };
  } catch (err) {
    console.error('Error during head and shoulders detection:', err);
    return headShoulderResult;
  }
};

const useDetection = (runOnStart: boolean = false) => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams } = config;
  const testbedHeight = useMemo(() => (testbedHeightMM * MM_TO_INCH * devicePPI) / devicePixelRatio, [testbedHeightMM, devicePPI, devicePixelRatio]);
  const testbedWidth = useMemo(() => (testbedWidthMM * MM_TO_INCH * devicePPI) / devicePixelRatio, [testbedWidthMM, devicePPI, devicePixelRatio]);

  const isDetecting = useRef<boolean>(runOnStart);
  const factor = devicePPI / devicePixelRatio;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ handDetector: HandLandmarker; poseDetector: PoseLandmarker } | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [pinchDetection, setPinchDetection] = useState<PinchDetectionResult>({
    pinchPos: { left: null, right: null },
    indexPinch: { left: false, right: false },
    middlePinch: { left: false, right: false },
  });
  const [wristDetection, setWristDetection] = useState<WristDetectionResult>({
    leftWrist: null,
    rightWrist: null,
  });
  const [headShoulderDetection, setHeadShoulderDetection] = useState<HeadShoulderDetectionResult>({
    nose: null,
    leftShoulder: null,
    rightShoulder: null,
    noseShoulderDistance: null,
    interShoulderDistance: null,
    posErrorX: null,
    posErrorZ: null,
    posMessage: 'Uncalibrated',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDetecting = useCallback(() => {
    console.log('[INFO] Starting Landmark Detection');
    isDetecting.current = true;
  }, []);

  const stopDetecting = useCallback(() => {
    isDetecting.current = false;
  }, []);

  const performDetectionLoop = useCallback(() => {
    if (!videoRef.current || !detectorRef.current) {
      animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      return;
    }
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      return;
    }

    if (isDetecting.current) {
      const { pinch, wrist } = detectPinchAndWrist(detector.handDetector, video, testbedWidth, testbedHeight, factor);
      const headShoulder = detectHeadAndShoulders(detector.poseDetector, video, testbedWidth, testbedHeight, silParams);
      setPinchDetection(pinch);
      setWristDetection(wrist);
      setHeadShoulderDetection(headShoulder);
    }

    animationFrameId.current = requestAnimationFrame(performDetectionLoop);
  }, [testbedHeight, testbedWidth, isDetecting, factor, silParams]);

  const startWebcam = useCallback(async () => {
    if (loading || error) return;
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      };
      streamRef.current = stream;
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError(err as string);
    }
  }, [loading, error, performDetectionLoop]);

  const stopWebcam = useCallback(() => {
    stopDetecting();
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [stopDetecting]);

  const initializeDetector = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      detectorRef.current = await initDetectors();
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize Object Detector:', err);
      setError(err as string);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeDetector();
  }, [initializeDetector]);

  useEffect(() => {
    const cleanup = () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;

      if (detectorRef.current) {
        detectorRef.current.poseDetector.close();
        detectorRef.current.handDetector.close();
        detectorRef.current = null;
      }
    };
    return cleanup;
  }, []);
  return { videoRef, pinchDetection, wristDetection, headShoulderDetection, loading, error, startWebcam, stopWebcam, startDetecting, stopDetecting };
};

export default useDetection;

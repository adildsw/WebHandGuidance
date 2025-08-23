// useMediaPipeObjectDetection.js

import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { FingerTips, PinchDetectionResult, WristDetectionResult } from '../types/detections';
import { defaultFingerTips, MM_TO_INCH } from '../utils/constants';
import { distance, mapVideoToTestbed } from '../utils/math';
import type { Pos } from '../types/task';
import { useConfig } from '../utils/context';

const INDEX_PINCH_THRESHOLD = 0.25;
const MIDDLE_PINCH_THRESHOLD = 0.15;

// |-------------------------
// | MODEL INITIALIZATIONS
// |-------------------------
const initHandDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
  const handDetector = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: './hand_landmarker.task',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return handDetector;
};

const initPoseDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
  const poseDetector = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: './pose_landmarker_lite.task',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return poseDetector;
};

// |-------------------------
// | MODEL DETECTIONS
// |-------------------------
const detectPinch = (detector: HandLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number, factor: number) => {
  const leftFingerTips: FingerTips = { ...defaultFingerTips };
  const rightFingerTips: FingerTips = { ...defaultFingerTips };
  const pinch: PinchDetectionResult = {
    pinchPos: { left: null, right: null },
    indexPinch: { left: false, right: false },
    middlePinch: { left: false, right: false },
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
      const indices: Record<keyof FingerTips, number> = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
      for (const k of Object.keys(indices) as (keyof FingerTips)[]) {
        const lm = hands[i]?.[indices[k]];
        if (!lm) continue;
        const x = 1 - lm.x;
        const y = lm.y;
        const pt = mapVideoToTestbed(x * vw, y * vh, vw, vh, testbedWidth, testbedHeight);
        if (!pt) continue;
        if (side === 'left') leftFingerTips[k] = pt;
        else rightFingerTips[k] = pt;
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

  return pinch;
};

const detectWrists = (detector: PoseLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number) => {
  let leftWrist: Pos | null = null;
  let rightWrist: Pos | null = null;

  try {
    const res = detector.detectForVideo(video, performance.now());
    const lm = res.landmarks?.[0] || [];
    if (lm.length >= 17) {
      const R = lm[16];
      const L = lm[15];
      if (L) L.x = 1 - L.x;
      if (R) R.x = 1 - R.x;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      leftWrist = L ? mapVideoToTestbed(L.x * vw, L.y * vh, vw, vh, testbedWidth, testbedHeight) : null;
      rightWrist = R ? mapVideoToTestbed(R.x * vw, R.y * vh, vw, vh, testbedWidth, testbedHeight) : null;
      if (!L?.visibility || L.visibility < 0.8) leftWrist = null;
      if (!R?.visibility || R.visibility < 0.8) rightWrist = null;
    }
  } catch (err) {
    console.error('Error during wrist detection:', err);
  }

  return { leftWrist, rightWrist };
};

const useDetection = (detectionMode: 'WRIST' | 'PINCH' | 'WRIST AND PINCH' | null = null, runOnStart: boolean = false) => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM } = config;
  const testbedHeight = useMemo(() => (testbedHeightMM * MM_TO_INCH * devicePPI) / devicePixelRatio, [testbedHeightMM, devicePPI, devicePixelRatio]);
  const testbedWidth = useMemo(() => (testbedWidthMM * MM_TO_INCH * devicePPI) / devicePixelRatio, [testbedWidthMM, devicePPI, devicePixelRatio]);

  const isDetecting = useRef<boolean>(runOnStart);
  const detectorType = useRef<'WRIST' | 'PINCH' | 'WRIST AND PINCH' | null>(detectionMode);
  const factor = devicePPI / devicePixelRatio;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wristDetectorRef = useRef<PoseLandmarker | null>(null);
  const pinchDetectorRef = useRef<HandLandmarker | null>(null);
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDetecting = useCallback(() => {
    console.log("[INFO] Starting Landmark Detection")
    isDetecting.current = true;
  }, []);

  const stopDetecting = useCallback(() => {
    isDetecting.current = false;
  }, []);

  const setDetectionMode = (mode: 'WRIST' | 'PINCH') => {
    if (detectorType.current !== mode) {
      detectorType.current = mode;
    }
  };

  const performDetectionLoop = useCallback(() => {
    if (!videoRef.current || !wristDetectorRef.current || !pinchDetectorRef.current) {
      animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      return;
    }
    const video = videoRef.current;
    const wristDetector = wristDetectorRef.current;
    const pinchDetector = pinchDetectorRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      return;
    }

    if (isDetecting.current) {
      if (detectorType.current === 'PINCH') {
        setPinchDetection(detectPinch(pinchDetector, video, testbedWidth, testbedHeight, factor));
      } else if (detectorType.current === 'WRIST') {
        setWristDetection(detectWrists(wristDetector, video, testbedWidth, testbedHeight));
      } else if (detectorType.current === 'WRIST AND PINCH') {
        setWristDetection(detectWrists(wristDetector, video, testbedWidth, testbedHeight));
        setPinchDetection(detectPinch(pinchDetector, video, testbedWidth, testbedHeight, factor));
      }
    }

    animationFrameId.current = requestAnimationFrame(performDetectionLoop);
  }, [detectorType, testbedHeight, testbedWidth, isDetecting, factor]);

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

  const initializeDetector = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      wristDetectorRef.current = await initPoseDetector();
      pinchDetectorRef.current = await initHandDetector();
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

      if (wristDetectorRef.current) {
        wristDetectorRef.current.close();
        wristDetectorRef.current = null;
      }
      if (pinchDetectorRef.current) {
        pinchDetectorRef.current.close();
        pinchDetectorRef.current = null;
      }
    };
    return cleanup;
  }, []);
  return { videoRef, pinchDetection, wristDetection, loading, error, startWebcam, startDetecting, stopDetecting, setDetectionMode };
};

export default useDetection;

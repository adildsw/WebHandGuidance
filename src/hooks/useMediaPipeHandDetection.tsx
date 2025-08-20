// useMediaPipeObjectDetection.js

import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { FingerTips } from '../types/detections';
import { defaultFingerTips, MM_TO_INCH } from '../utils/constants';
import { mapVideoToTestbed } from '../utils/math';
import type { Pos } from '../types/task';
import { useConfig } from '../utils/context';

// |-------------------------
// | MODEL INITIALIZATIONS
// |-------------------------
const initHandDetector = async () => {
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
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
const detectFingertips = (detector: HandLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number) => {
  const leftFingerTips: FingerTips = { ...defaultFingerTips };
  const rightFingerTips: FingerTips = { ...defaultFingerTips };

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
  } catch (err) {
    console.error('Error during hand detection:', err);
  }

  return { leftFingerTips, rightFingerTips };
};

const detectWrists = (detector: PoseLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number) => {
  let leftWrist: Pos | null = null;
  let rightWrist: Pos | null = null;

  try {
    const res = detector.detectForVideo(video, performance.now());
    const lm = res.landmarks?.[0] || [];
    if (lm.length >= 17) {
      const R = lm[15];
      const L = lm[16];
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

const useDetection = (detectorType: 'WRIST' | 'FINGERTIP') => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM } = config;
  const testbedHeight = useMemo(() => (testbedHeightMM * MM_TO_INCH * devicePPI) / devicePixelRatio, [testbedHeightMM, devicePPI, devicePixelRatio]);
  const testbedWidth = useMemo(() => (testbedWidthMM * MM_TO_INCH * devicePPI) / devicePixelRatio, [testbedWidthMM, devicePPI, devicePixelRatio]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const objectDetectorRef = useRef<HandLandmarker | PoseLandmarker | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [fingerDetection, setFingerDetection] = useState<{ leftFingerTips: FingerTips; rightFingerTips: FingerTips } | null>(null);
  const [wristDetection, setWristDetection] = useState<{ leftWrist: Pos | null; rightWrist: Pos | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const performDetectionLoop = useCallback(() => {
    if (!videoRef.current || !objectDetectorRef.current) {
      animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      return;
    }
    const video = videoRef.current;
    const detector = objectDetectorRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameId.current = requestAnimationFrame(performDetectionLoop);
      return;
    }

    if (detectorType === 'FINGERTIP' && detector instanceof HandLandmarker) {
      setFingerDetection(detectFingertips(detector, video, testbedWidth, testbedHeight));
    } else if (detectorType === 'WRIST' && detector instanceof PoseLandmarker) {
      setWristDetection(detectWrists(detector, video, testbedWidth, testbedHeight));
    }

    animationFrameId.current = requestAnimationFrame(performDetectionLoop);
  }, [detectorType, testbedHeight, testbedWidth]);

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
      const detector = detectorType === 'FINGERTIP' ? await initHandDetector() : await initPoseDetector();
      objectDetectorRef.current = detector;
      setLoading(false);
      console.log('Object Detector initialized!');
    } catch (err) {
      console.error('Failed to initialize Object Detector:', err);
      setError(err as string);
      setLoading(false);
    }
  }, [detectorType]);

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

      if (objectDetectorRef.current) {
        objectDetectorRef.current.close();
        objectDetectorRef.current = null;
      }
    };
    return cleanup;
  }, []);
  return { videoRef, fingerDetection, wristDetection, loading, error, startWebcam };
};

export default useDetection;

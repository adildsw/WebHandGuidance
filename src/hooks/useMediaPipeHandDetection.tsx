import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { AR } from 'js-aruco2';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { FingerTips, HeadShoulderDetectionResult, Marker, MarkerOperationResult, PinchDetectionResult, WristDetectionResult } from '../types/detections';
import {
  CALIBRATION_MARKER_ID,
  CONTINUE_MARKER_ID,
  defaultFingerTips,
  defaultHeadShoulderResult,
  defaultPinchResult,
  defaultWristResult,
  HAND_LANDMARKER_MODEL_PATH,
  MM_TO_INCH,
  NOSE_Y_OFFSET,
  POSE_LANDMARKER_MODEL_PATH,
  REPLAY_MARKER_ID,
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
  const pinch: PinchDetectionResult = { ...defaultPinchResult };
  const wrist: WristDetectionResult = { ...defaultWristResult };

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

const processHeadShoulderLandmarks = (detections: PoseLandmarkerResult, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number, silParams: SilhouetteParams) => {
  const headShoulderResult: HeadShoulderDetectionResult = { ...defaultHeadShoulderResult };

  const vh = video.videoHeight;
  const vw = video.videoWidth;

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
  let posErrorY: number | null = null;
  let posErrorZ: number | null = null;
  let guideOpacity: number = 1;
  let posMessage = 'Uncalibrated';
  if (silParams.silCalibrated) {
    const h = SIL_IMG_HEIGHT * silParams.silScaleY;
    const w = SIL_IMG_WIDTH * silParams.silScaleX;

    const noseY = silParams.silY + NOSE_Y_OFFSET * h;
    const shoulderY = silParams.silY + SHOULDER_Y_OFFSET * h;
    const leftShoulderX = -SHOULDER_X_OFFSET * w;
    const rightShoulderX = SHOULDER_X_OFFSET * w;

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

    // Calculate Vertical Positional Error
    const noseYDistanceError = Math.abs(nosePt.y - noseY);
    const signY = nosePt.y < noseY ? 1 : -1;
    posErrorY = (noseYDistanceError / (testbedHeight / 2)) * signY;

    posMessage = "You're in Position!";
    if (Math.abs(posErrorZ) > 0.15) posMessage = posErrorZ > 0 ? 'Move Further From Screen' : 'Move Closer To Screen';
    else if (Math.abs(posErrorX) > 0.1) posMessage = posErrorX > 0 ? 'Move Right' : 'Move Left';
    else if (Math.abs(posErrorY) > 0.1) posMessage = posErrorY > 0 ? 'Move Down' : 'Move Up';

    // Guide Opacity Calculation
    const maxError = 0.3;
    const totalError = Math.abs(posErrorX) + Math.abs(posErrorY) + Math.abs(posErrorZ);
    guideOpacity = Math.min(totalError / maxError, 1);
  }

  return {
    nose: nosePt,
    leftShoulder: leftShoulderPt,
    rightShoulder: rightShoulderPt,
    noseShoulderDistance: noseShoulderDistance,
    interShoulderDistance: interShoulderDistance,
    posErrorX,
    posErrorY,
    posErrorZ,
    guideOpacity,
    posMessage,
  };
};

const detectHeadAndShoulders = (detector: PoseLandmarker, video: HTMLVideoElement, testbedWidth: number, testbedHeight: number, silParams: SilhouetteParams) => {
  try {
    const detections = detector.detectForVideo(video, performance.now());
    return processHeadShoulderLandmarks(detections, video, testbedWidth, testbedHeight, silParams);
  } catch (err) {
    console.error('Error during head and shoulders detection:', err);
    return { ...defaultHeadShoulderResult };
  }
};

const detectMarkers = (detector: AR.Detector, video: HTMLVideoElement, canvas: HTMLCanvasElement, testbedWidth: number, testbedHeight: number, prevResults: MarkerOperationResult): MarkerOperationResult => {
  const result: MarkerOperationResult = {
    allMarkers: [],
    isCalibrationMarkerVisible: false,
    isReplayMarkerVisible: false,
    isContinueMarkerVisible: false,
    calibrationMarker: null,
    replayMarker: null,
    continueMarker: null,
    calibrationMarkerDetectionTime: null,
    replayMarkerDetectionTime: null,
    continueMarkerDetectionTime: null,
    calibrationMarkerLength: null,
  };
  
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return result;

  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return result;

  ctx.drawImage(video, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const detected = (detector.detect(imageData) || []) as Marker[];

  const converted = detected.map((m) => {
    const corners = m.corners
      .map((c) => {
        const xVideo = w - c.x;
        const yVideo = c.y;
        return mapVideoToTestbed(xVideo, yVideo, w, h, testbedWidth, testbedHeight);
      })
      .filter((pt): pt is { x: number; y: number } => !!pt);

    return { id: m.id, corners };
  });

  result.allMarkers = converted;
  result.isCalibrationMarkerVisible = converted.some((m) => m.id === CALIBRATION_MARKER_ID);
  result.isReplayMarkerVisible = converted.some((m) => m.id === REPLAY_MARKER_ID);
  result.isContinueMarkerVisible = converted.some((m) => m.id === CONTINUE_MARKER_ID);
  result.calibrationMarker = converted.find((m) => m.id === CALIBRATION_MARKER_ID) || null;
  result.replayMarker = converted.find((m) => m.id === REPLAY_MARKER_ID) || null;
  result.continueMarker = converted.find((m) => m.id === CONTINUE_MARKER_ID) || null;
  result.continueMarkerDetectionTime = result.isContinueMarkerVisible && !prevResults.isContinueMarkerVisible ? performance.now() : prevResults.continueMarkerDetectionTime;
  result.calibrationMarkerDetectionTime = result.isCalibrationMarkerVisible && !prevResults.isCalibrationMarkerVisible ? performance.now() : prevResults.calibrationMarkerDetectionTime;
  result.replayMarkerDetectionTime = result.isReplayMarkerVisible && !prevResults.isReplayMarkerVisible ? performance.now() : prevResults.replayMarkerDetectionTime;
  if (result.calibrationMarker && result.calibrationMarker.corners.length === 4) {
    const d1 = distance(
      result.calibrationMarker.corners[0].x,
      result.calibrationMarker.corners[0].y,
      result.calibrationMarker.corners[1].x,
      result.calibrationMarker.corners[1].y
    );
    const d2 = distance(
      result.calibrationMarker.corners[1].x,
      result.calibrationMarker.corners[1].y,
      result.calibrationMarker.corners[2].x,
      result.calibrationMarker.corners[2].y
    );
    const d3 = distance(
      result.calibrationMarker.corners[2].x,
      result.calibrationMarker.corners[2].y,
      result.calibrationMarker.corners[3].x,
      result.calibrationMarker.corners[3].y
    );
    const d4 = distance(
      result.calibrationMarker.corners[3].x,
      result.calibrationMarker.corners[3].y,
      result.calibrationMarker.corners[0].x,
      result.calibrationMarker.corners[0].y
    );
    result.calibrationMarkerLength = (d1 + d2 + d3 + d4) / 4;
  }

  return result;
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

  const arucoDetectorRef = useRef<AR.Detector | null>(null);
  const arucoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [markerOperationResults, setMarkerOperationResults] = useState<MarkerOperationResult>({ 
    allMarkers: [], 
    isCalibrationMarkerVisible: false, 
    isReplayMarkerVisible: false,
    isContinueMarkerVisible: false, 
    calibrationMarker: null, 
    replayMarker: null, 
    continueMarker: null ,
    calibrationMarkerDetectionTime: null,
    replayMarkerDetectionTime: null,
    continueMarkerDetectionTime: null,
    calibrationMarkerLength: null,
  });

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
    posErrorY: null,
    posErrorZ: null,
    guideOpacity: 0,
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

      if (arucoDetectorRef.current) {
        if (!arucoCanvasRef.current) {
          arucoCanvasRef.current = document.createElement('canvas');
        }
        const detectedMarkers = detectMarkers(arucoDetectorRef.current, video, arucoCanvasRef.current, testbedWidth, testbedHeight, markerOperationResults);
        setMarkerOperationResults(detectedMarkers);
      }
    }

    animationFrameId.current = requestAnimationFrame(performDetectionLoop);
  }, [testbedHeight, testbedWidth, isDetecting, factor, silParams, markerOperationResults]);

  const startWebcam = useCallback(async () => {
    if (loading || error) return;
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!videoRef.current) return;
      if (runOnStart) isDetecting.current = true;
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
  }, [loading, error, performDetectionLoop, runOnStart]);

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

      arucoDetectorRef.current = new AR.Detector({
        dictionaryName: 'ARUCO_MIP_36h12',
        maxHammingDistance: 5,
      });
      if (!arucoCanvasRef.current) {
        arucoCanvasRef.current = document.createElement('canvas');
      }

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

      arucoDetectorRef.current = null;
      arucoCanvasRef.current = null;
    };
    return cleanup;
  }, []);
  return { videoRef, pinchDetection, wristDetection, headShoulderDetection, detectedMarkers: markerOperationResults, loading, error, startWebcam, stopWebcam, startDetecting, stopDetecting };
};

export default useDetection;

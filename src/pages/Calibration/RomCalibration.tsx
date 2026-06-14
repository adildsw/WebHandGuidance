import { ReactP5Wrapper, type Sketch } from '@p5-wrapper/react';
import type p5 from 'p5';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeadShoulderDetectionResult, WristDetectionResult } from '../../types/detections';
import { type SilhouetteParams } from '../../types/config';
import { defaultConfig, MM_TO_INCH, NOSE_Y_OFFSET, SHOULDER_X_OFFSET, SHOULDER_Y_OFFSET, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../../utils/constants';
import type { PolarPos, Pos } from '../../types/task';
import { useConfig } from '../../utils/context';
import useDetection from '../../hooks/useMediaPipeHandDetection';
import { forceRoot } from '../../utils/navigation';
import { cartesianToPolar, polarToCartesian } from '../../utils/math';
import MediaPlayer from '../../components/MediaPlayer';
import ModelLoadingOverlay from '../../components/ModelLoadingOverlay';
import CameraSelector from '../../components/CameraSelector';
import { useNavigate, useSearchParams } from 'react-router-dom';

const CALIBRATION_TIMER_THRESHOLD = 10000;

type RomCalibrationStages = 'init' | 'leftStretch' | 'rightStretch' | 'leftRaised' | 'rightRaised' | 'done';

const CALIBRATION_MESSAGES: { [key in RomCalibrationStages]: string } = {
  init: 'Please get in position so that the silhouette matches your body.',
  leftStretch: 'Please stretch your left hand out to the side as far as possible and hold.',
  rightStretch: 'Please stretch your right hand out to the side as far as possible and hold.',
  leftRaised: 'Please raise your left hand above your head as high as possible and hold.',
  rightRaised: 'Please raise your right hand above your head as high as possible and hold.',
  done: 'Calibration complete!',
};

const sketch: Sketch = (p5) => {
  let width = 200;
  let height = 400;

  let f: p5.Font;
  let silImg: p5.Image;
  let silLeftStretchImg: p5.Image;
  let silRightStretchImg: p5.Image;
  let silLeftRaisedImg: p5.Image;
  let silRightRaisedImg: p5.Image;
  let silParams: SilhouetteParams = defaultConfig.silParams;

  let wristPos: WristDetectionResult = { leftWrist: null, rightWrist: null };
  let headShoulderDetection: HeadShoulderDetectionResult = {
    nose: null,
    leftShoulder: null,
    rightShoulder: null,
    interShoulderDistance: null,
    noseShoulderDistance: null,
    posErrorX: null,
    posErrorY: null,
    posErrorZ: null,
    guideOpacity: 1,
    posMessage: 'Uncalibrated',
  };

  // Calibration Params
  let calibrationStage: RomCalibrationStages = 'done';
  let leftStretchedRom: PolarPos | null = null;
  let rightStretchedRom: PolarPos | null = null;
  let leftRaisedRom: PolarPos | null = null;
  let rightRaisedRom: PolarPos | null = null;
  let romCalibrationParams: { leftRadius: number; rightRadius: number } | null = null;
  let romSafeMargin = 0.85;
  let calibrationProgress = 0;
  let isCalibrationPaused = false;

  // Silhouette Params
  let silH = SIL_IMG_HEIGHT * silParams.silScaleY;
  let silW = SIL_IMG_WIDTH * silParams.silScaleX;
  let noseY = silParams.silY + NOSE_Y_OFFSET * silH;
  let shoulderY = silParams.silY + SHOULDER_Y_OFFSET * silH;
  let leftShoulderX = SHOULDER_X_OFFSET * silW;
  let rightShoulderX = -SHOULDER_X_OFFSET * silW;
  let silOpacity = 255;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
    silImg = p5.loadImage('./assets/standing.png');
    silLeftStretchImg = p5.loadImage('./assets/hand_stretched_left.png');
    silRightStretchImg = p5.loadImage('./assets/hand_stretched_right.png');
    silLeftRaisedImg = p5.loadImage('./assets/hand_raised_left.png');
    silRightRaisedImg = p5.loadImage('./assets/hand_raised_right.png');
  };

  p5.setup = () => {
    p5.createCanvas(width, height, p5.WEBGL);
    p5.textFont(f);
  };

  p5.windowResized = () => {
    p5.resizeCanvas(width, height);
  };

  p5.updateWithProps = (props: {
    frameWidth?: number;
    frameHeight?: number;
    wristPos?: WristDetectionResult;
    headShoulderDetection?: HeadShoulderDetectionResult;
    silParams?: SilhouetteParams;
    calibrationStage?: RomCalibrationStages;
    leftStretchedRom?: PolarPos | null;
    rightStretchedRom?: PolarPos | null;
    leftRaisedRom?: PolarPos | null;
    rightRaisedRom?: PolarPos | null;
    romCalibrationParams?: { leftRadius: number; rightRadius: number } | null;
    romSafeMargin?: number;
    calibrationProgress?: number;
    isCalibrationPaused?: boolean;
  }) => {
    if (typeof props.frameWidth === 'number') width = props.frameWidth;
    if (typeof props.frameHeight === 'number') height = props.frameHeight;
    p5.resizeCanvas(width, height);

    wristPos = props.wristPos ?? { leftWrist: null, rightWrist: null };
    headShoulderDetection = props.headShoulderDetection ?? {
      nose: null,
      leftShoulder: null,
      rightShoulder: null,
      interShoulderDistance: null,
      noseShoulderDistance: null,
      posErrorX: null,
      posErrorY: null,
      posErrorZ: null,
      guideOpacity: 1,
      posMessage: 'Uncalibrated',
    };

    calibrationStage = props.calibrationStage ?? 'init';
    leftStretchedRom = props.leftStretchedRom ?? null;
    rightStretchedRom = props.rightStretchedRom ?? null;
    leftRaisedRom = props.leftRaisedRom ?? null;
    rightRaisedRom = props.rightRaisedRom ?? null;
    romCalibrationParams = props.romCalibrationParams ?? null;
    romSafeMargin = props.romSafeMargin ?? 0.85;
    calibrationProgress = props.calibrationProgress ?? 0;
    isCalibrationPaused = props.isCalibrationPaused ?? false;

    silParams = props.silParams ?? defaultConfig.silParams;
    silH = SIL_IMG_HEIGHT * silParams.silScaleY;
    silW = SIL_IMG_WIDTH * silParams.silScaleX;
    noseY = silParams.silY + NOSE_Y_OFFSET * silH;
    shoulderY = silParams.silY + SHOULDER_Y_OFFSET * silH;
    leftShoulderX = -SHOULDER_X_OFFSET * silW;
    rightShoulderX = SHOULDER_X_OFFSET * silW;
    silOpacity = p5.map(headShoulderDetection.guideOpacity, 0, 1, 0, 255, true);
  };

  const drawSilhouette = () => {
    p5.imageMode(p5.CENTER);
    p5.tint(255, silOpacity);
    p5.image(silImg, 0, silParams.silY, silW, silH);
  };

  const drawSilhouettePOIs = () => {
    p5.noFill();
    p5.stroke(255, 255, 255, silOpacity);
    p5.strokeWeight(1);
    p5.circle(0, noseY, 16);
    p5.circle(leftShoulderX, shoulderY, 16);
    p5.circle(rightShoulderX, shoulderY, 16);

    p5.fill(255, 255, 255);
    p5.textSize(12);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text('L', leftShoulderX, shoulderY);
    p5.text('R', rightShoulderX, shoulderY);
  };

  const drawUserPOIs = () => {
    if (!headShoulderDetection.nose || !headShoulderDetection.leftShoulder || !headShoulderDetection.rightShoulder) return;

    p5.noStroke();
    p5.fill(255, 255, 255, silOpacity);
    p5.circle(headShoulderDetection.nose.x, headShoulderDetection.nose.y, 8);
    p5.circle(headShoulderDetection.leftShoulder.x, headShoulderDetection.leftShoulder.y, 8);
    p5.circle(headShoulderDetection.rightShoulder.x, headShoulderDetection.rightShoulder.y, 8);

    // Draw Positional Error Text
    const msg = headShoulderDetection.posMessage;
    p5.textSize(36);
    p5.textAlign(p5.CENTER, p5.CENTER);
    const tw = p5.textWidth(msg);
    const th = p5.textAscent() + p5.textDescent();
    const pad = 10;
    const ty = -height / 2 + 40;
    p5.noStroke();
    p5.fill(0, 0, 0, 200);
    p5.rect(-tw / 2 - pad, ty - th / 2 - pad, tw + pad * 2, th + pad * 2, 6);
    p5.fill(255, 255, 255);
    p5.text(msg, 0, ty);
  };

  const drawUserWrist = () => {
    p5.noStroke();
    p5.fill(0, 0, 0, 255);
    if (wristPos.leftWrist) p5.circle(wristPos.leftWrist.x, wristPos.leftWrist.y, 12);
    if (wristPos.rightWrist) p5.circle(wristPos.rightWrist.x, wristPos.rightWrist.y, 12);

    p5.fill(255, 255, 255);
    p5.textSize(12);
    p5.textAlign(p5.CENTER, p5.CENTER);
    if (wristPos.leftWrist) p5.text('L', wristPos.leftWrist.x, wristPos.leftWrist.y);
    if (wristPos.rightWrist) p5.text('R', wristPos.rightWrist.x, wristPos.rightWrist.y);
  };

  const drawCalibrationSilhouette = (img: p5.Image) => {
    p5.imageMode(p5.CENTER);
    p5.tint(255, 255);
    p5.image(img, 0, silParams.silY, silW, silH);
  };

  const drawPolarPos = (polarPos: PolarPos, anchor: Pos) => {
    const pos = polarToCartesian(polarPos.radius, polarPos.angle, anchor);
    p5.circle(pos.x, pos.y, 24);
  };

  const drawRomIndicators = (leftAnchor: Pos | null, rightAnchor: Pos | null) => {
    p5.stroke(255);
    p5.strokeWeight(1);
    p5.fill(0, 0, 0, 128);

    if (leftStretchedRom && leftAnchor) drawPolarPos(leftStretchedRom, leftAnchor);
    if (rightStretchedRom && rightAnchor) drawPolarPos(rightStretchedRom, rightAnchor);
    if (leftRaisedRom && leftAnchor) drawPolarPos(leftRaisedRom, leftAnchor);
    if (rightRaisedRom && rightAnchor) drawPolarPos(rightRaisedRom, rightAnchor);
  };

  const drawRomIndicatorsOnUser = () => {
    if (!headShoulderDetection.leftShoulder || !headShoulderDetection.rightShoulder) return;
    drawRomIndicators(headShoulderDetection.leftShoulder, headShoulderDetection.rightShoulder);
  };

  const drawRomIndicatorsOnSilhouette = () => {
    const leftShoulderPos: Pos = { x: leftShoulderX, y: shoulderY };
    const rightShoulderPos: Pos = { x: rightShoulderX, y: shoulderY };
    drawRomIndicators(leftShoulderPos, rightShoulderPos);
  };

  const drawRomCircles = () => {
    if (!romCalibrationParams) return;
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(1);
    p5.circle(leftShoulderX, shoulderY, romCalibrationParams.leftRadius * 2);
    p5.circle(rightShoulderX, shoulderY, romCalibrationParams.rightRadius * 2);

    p5.fill(0, 255, 0, 32);
    p5.stroke(0);
    p5.circle(leftShoulderX, shoulderY, romCalibrationParams.leftRadius * 2 * romSafeMargin);
    p5.circle(rightShoulderX, shoulderY, romCalibrationParams.rightRadius * 2 * romSafeMargin);
  };

  const drawCalibrationProgress = () => {
    if (calibrationProgress <= 0 || calibrationStage === 'done' || isCalibrationPaused) return;
    p5.stroke(0, 255, 0, 192);
    p5.strokeWeight(16);
    p5.line(-width / 2 + 10, -height / 2 + 10, p5.lerp(-width / 2 + 10, width / 2 - 10, calibrationProgress), -height / 2 + 10);
  };

  p5.draw = () => {
    p5.clear();

    if (calibrationStage === 'init') {
      drawSilhouette();
      drawSilhouettePOIs();
      drawUserPOIs();
    } else if (calibrationStage === 'leftStretch') drawCalibrationSilhouette(silLeftStretchImg);
    else if (calibrationStage === 'rightStretch') drawCalibrationSilhouette(silRightStretchImg);
    else if (calibrationStage === 'leftRaised') drawCalibrationSilhouette(silLeftRaisedImg);
    else if (calibrationStage === 'rightRaised') drawCalibrationSilhouette(silRightRaisedImg);

    if (['leftStretch', 'rightStretch', 'leftRaised', 'rightRaised'].includes(calibrationStage)) drawRomIndicatorsOnUser();
    else if (calibrationStage === 'done') {
      drawSilhouette();
      drawRomIndicatorsOnSilhouette();
      drawRomCircles();
    }

    drawUserWrist();
    drawCalibrationProgress();
  };
};

const RomCalibration = () => {
  const { config, setRomCalibrationParams } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams, romCalibrationParams, romSafeMargin } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const homeEnabled = urlParams.get('homeEnabled') !== 'false';
  const participantId = urlParams.get('participantId') || '';
  const dataParam = urlParams.get('data') || '';

  const [areWeDone, setAreWeDone] = useState(false);
  const [isTutorialVisible, setIsTutorialVisible] = useState(true);

  const { videoRef, wristDetection, headShoulderDetection, modelsLoading, error, startWebcam, stopWebcam, detectedMarkers, availableCameras, selectedCameraId, selectCamera } = useDetection(true);
  const { isContinueMarkerVisible, isReplayMarkerVisible } = detectedMarkers;

  const isUserInPos = useMemo(() => {
    if (headShoulderDetection.posErrorX === null || headShoulderDetection.posErrorZ === null) return false;
    return Math.abs(headShoulderDetection.posErrorX) < 0.15 && Math.abs(headShoulderDetection.posErrorZ) < 0.15;
  }, [headShoulderDetection]);

  const [leftStretchedRom, setLeftStretchedRom] = useState<PolarPos | null>(null);
  const [leftRaisedRom, setLeftRaisedRom] = useState<PolarPos | null>(null);
  const [rightStretchedRom, setRightStretchedRom] = useState<PolarPos | null>(null);
  const [rightRaisedRom, setRightRaisedRom] = useState<PolarPos | null>(null);

  const leftRomRef = useRef<PolarPos | null>(null);
  const rightRomRef = useRef<PolarPos | null>(null);
  useEffect(() => {
    if (wristDetection.leftWrist && headShoulderDetection.leftShoulder) leftRomRef.current = cartesianToPolar(headShoulderDetection.leftShoulder, wristDetection.leftWrist);
    if (wristDetection.rightWrist && headShoulderDetection.rightShoulder) rightRomRef.current = cartesianToPolar(headShoulderDetection.rightShoulder, wristDetection.rightWrist);
  }, [wristDetection, headShoulderDetection]);

  const [calibrationStage, setCalibrationStage] = useState<RomCalibrationStages>('init');
  const [calibrationStartTime, setCalibrationStartTime] = useState<number | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isCalibrationPaused, setIsCalibrationPaused] = useState(false);
  const [elapsedBeforePause, setElapsedBeforePause] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Determine if the required hand is visible for current stage
  const isRequiredHandVisible = useMemo(() => {
    if (calibrationStage === 'leftStretch' || calibrationStage === 'leftRaised') {
      return wristDetection.leftWrist !== null;
    }
    if (calibrationStage === 'rightStretch' || calibrationStage === 'rightRaised') {
      return wristDetection.rightWrist !== null;
    }
    return true; // For 'init' and 'done' stages, no specific hand is required
  }, [calibrationStage, wristDetection.leftWrist, wristDetection.rightWrist]);

  const calibrationProgress = (() => {
    if (isCalibrated) return 1;
    if (isCalibrationPaused) return Math.min(elapsedBeforePause / CALIBRATION_TIMER_THRESHOLD, 1);
    if (!calibrationStartTime || !timerRef.current) return 0;
    const elapsed = Date.now() - calibrationStartTime + elapsedBeforePause;
    return Math.min(elapsed / CALIBRATION_TIMER_THRESHOLD, 1);
  })();

  // Handle pause/resume based on hand visibility during calibration stages
  useEffect(() => {
    // Only handle pause for active calibration stages (not init or done)
    if (!['leftStretch', 'leftRaised', 'rightStretch', 'rightRaised'].includes(calibrationStage)) {
      return;
    }

    if (!isRequiredHandVisible && !isCalibrationPaused && timerRef.current !== null) {
      // Hand lost - pause calibration
      const elapsed = calibrationStartTime ? Date.now() - calibrationStartTime : 0;
      setElapsedBeforePause((prev) => prev + elapsed);
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setCalibrationStartTime(null);
      setIsCalibrationPaused(true);
    } else if (isRequiredHandVisible && isCalibrationPaused) {
      // Hand regained - resume calibration
      setIsCalibrationPaused(false);
      // The main calibration effect will restart the timer
    }
  }, [isRequiredHandVisible, isCalibrationPaused, calibrationStage, calibrationStartTime]);

  const resetRomCalibration = () => {
    setRomCalibrationParams(null);
    setIsCalibrated(false);
    setIsCalibrationPaused(false);
    setElapsedBeforePause(0);
    setCalibrationStage('init');
    setLeftStretchedRom(null);
    setLeftRaisedRom(null);
    setRightStretchedRom(null);
    setRightRaisedRom(null);
    leftRomRef.current = null;
    rightRomRef.current = null;
  };

  // Reset calibration state when tutorial becomes visible
  useEffect(() => {
    if (isTutorialVisible) {
      // Clear any running timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Reset all calibration state
      setCalibrationStage('init');
      setCalibrationStartTime(null);
      setIsCalibrated(false);
      setIsCalibrationPaused(false);
      setElapsedBeforePause(0);
      setLeftStretchedRom(null);
      setLeftRaisedRom(null);
      setRightStretchedRom(null);
      setRightRaisedRom(null);
      leftRomRef.current = null;
      rightRomRef.current = null;
    }
  }, [isTutorialVisible]);

  useEffect(() => {
    // Don't run calibration logic when tutorial is visible or when paused
    if (isTutorialVisible) return;
    if (isCalibrationPaused) return;

    if (calibrationStage === 'done') {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setCalibrationStartTime(null);
      }
      return;
    }

    const remainingTime = CALIBRATION_TIMER_THRESHOLD - elapsedBeforePause;

    if (calibrationStage === 'init') {
      if (isUserInPos && timerRef.current === null) {
        setCalibrationStartTime(Date.now());
        timerRef.current = window.setTimeout(() => {
          setCalibrationStage('leftStretch');
          setCalibrationStartTime(null);
          setElapsedBeforePause(0);
          timerRef.current = null;
        }, CALIBRATION_TIMER_THRESHOLD);
      } else if (!isUserInPos && timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setCalibrationStartTime(null);
      }
    } else if (calibrationStage === 'leftStretch' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setLeftStretchedRom(leftRomRef.current);
        setCalibrationStage('leftRaised');
        setCalibrationStartTime(null);
        setElapsedBeforePause(0);
        timerRef.current = null;
      }, remainingTime);
    } else if (calibrationStage === 'rightStretch' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setRightStretchedRom(rightRomRef.current);
        setCalibrationStage('rightRaised');
        setCalibrationStartTime(null);
        setElapsedBeforePause(0);
        timerRef.current = null;
      }, remainingTime);
    } else if (calibrationStage === 'leftRaised' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setLeftRaisedRom(leftRomRef.current);
        setCalibrationStage('rightStretch');
        setCalibrationStartTime(null);
        setElapsedBeforePause(0);
        timerRef.current = null;
      }, remainingTime);
    } else if (calibrationStage === 'rightRaised' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setRightRaisedRom(rightRomRef.current);
        setCalibrationStage('done');
        setCalibrationStartTime(null);
        setElapsedBeforePause(0);
        timerRef.current = null;
      }, remainingTime);
    }
  }, [isTutorialVisible, calibrationStage, isUserInPos, isCalibrationPaused, elapsedBeforePause]);

  useEffect(() => {
    if (!isTutorialVisible && calibrationStage === 'done' && !isCalibrated) {
      console.log('Yes');
      const averageLeftRomRadius = leftStretchedRom && leftRaisedRom ? (leftStretchedRom.radius + leftRaisedRom.radius) / 2 : null;
      const averageRightRomRadius = rightStretchedRom && rightRaisedRom ? (rightStretchedRom.radius + rightRaisedRom.radius) / 2 : null;
      if (averageLeftRomRadius !== null && averageRightRomRadius !== null) setRomCalibrationParams({ leftRadius: averageLeftRomRadius, rightRadius: averageRightRomRadius });
      else setRomCalibrationParams(null);
      setIsCalibrated(true);
    }
  }, [isTutorialVisible, calibrationStage, leftStretchedRom, leftRaisedRom, rightStretchedRom, rightRaisedRom, setRomCalibrationParams, isCalibrated]);

  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, [startWebcam, stopWebcam]);

  useEffect(() => {
    if (calibrationStage === 'done' && participantId && dataParam) {
      const REDIRECT_TIMER = 1000;
      const redirectTimer = window.setTimeout(() => {
        stopWebcam();
        navigate(`/study?participantId=${participantId}&data=${dataParam}`);
      }, REDIRECT_TIMER);

      return () => {
        clearTimeout(redirectTimer);
      };
    }
  }, [calibrationStage, participantId, dataParam, navigate, stopWebcam]);

  return (
    <>
      {isTutorialVisible && (
        <MediaPlayer
          // mediaUrl="https://webhandguidance.b-cdn.net/rom_calibration_demo_test.mp4"
          mediaUrl="https://CHRB.b-cdn.net/Range%20of%20Motion%20Calibration.mp4"
          mediaTitle="Range of Motion Calibration Tutorial"
          mediaSubtitle="This video will demonstrate how to calibrate your range of motion."
          doneCallback={() => setIsTutorialVisible(false)}
          doneBtnTitle="Begin Calibration"
          showHomeBtn={homeEnabled}
          isContinueMarkerVisible={isContinueMarkerVisible}
          isReplayMarkerVisible={isReplayMarkerVisible}
        />
      )}
      <div className="w-screen min-h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
        {isCalibrated ? (
          <div className="w-full flex flex-col text-center gap-2">
            <h1 className="text-3xl font-bold">Calibration Complete</h1>

            <p className="text-gray-500 text-md italic">You can now return to the main screen.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col text-center gap-2">
            <h1 className="text-3xl font-bold">Calibrate Range of Motion</h1>

            <div className="flex flex-col">
              <p className="text-gray-500 text-md italic">
                Please press the <strong>Start Calibration</strong> button below to begin calibration, and <strong>follow the on-screen instructions</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Camera Feed */}
        <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
          <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
            {!error && (
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            )}
            <ModelLoadingOverlay visible={modelsLoading && !error} errorMessage={error} />
            <CameraSelector availableCameras={availableCameras} selectedCameraId={selectedCameraId} onSelectCamera={selectCamera} />
            {!areWeDone && (
              <div className="absolute inset-0">
                <ReactP5Wrapper
                  sketch={sketch}
                  wristPos={wristDetection}
                  frameWidth={testbedWidth}
                  frameHeight={testbedHeight}
                  headShoulderDetection={headShoulderDetection}
                  silParams={silParams}
                  isCalibrated={isCalibrated}
                  calibrationStage={calibrationStage}
                  leftStretchedRom={leftStretchedRom}
                  leftRaisedRom={leftRaisedRom}
                  rightStretchedRom={rightStretchedRom}
                  rightRaisedRom={rightRaisedRom}
                  romCalibrationParams={romCalibrationParams}
                  romSafeMargin={romSafeMargin}
                  calibrationProgress={calibrationProgress}
                  isCalibrationPaused={isCalibrationPaused}
                />

                {/* Hand tracking lost message */}
                {isCalibrationPaused && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span className="text-white text-3xl font-bold drop-shadow-lg">Hand Tracking Lost</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col text-center">
          <p className="text-gray-500 text-md">{CALIBRATION_MESSAGES[calibrationStage]}</p>
          {timerRef.current ? (
            <p className="text-red-500 text-md font-bold">Please hold steady for {Math.floor((CALIBRATION_TIMER_THRESHOLD - calibrationProgress * CALIBRATION_TIMER_THRESHOLD) / 1000)} seconds</p>
          ) : (
            <p className="text-red-500 text-md font-bold">{'⠀'}</p>
          )}
        </div>

        <div className="flex flex-row gap-2">
          <button
            className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => setIsTutorialVisible(true)}
          >
            Replay Video
          </button>

          <button
            className="absolute top-4 left-4 bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => resetRomCalibration()}
          >
            Reset
          </button>
          {homeEnabled && (
            <button
              className="bg-green-700 border border-green-800 text-white font-bold px-4 py-2 rounded hover:bg-green-800 hover:text-white cursor-pointer"
              onClick={() => {
                stopWebcam();
                setAreWeDone(true);
                forceRoot();
              }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default RomCalibration;

import { ReactP5Wrapper, type Sketch } from '@p5-wrapper/react';
import type p5 from 'p5';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeadShoulderDetectionResult } from '../types/detections';
import { type SilhouetteParams } from '../types/config';
import { defaultConfig, MM_TO_INCH, NOSE_Y_OFFSET, SHOULDER_X_OFFSET, SHOULDER_Y_OFFSET, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../utils/constants';
import type { PolarPos, Pos } from '../types/task';
import { useConfig } from '../utils/context';
import useDetection from '../hooks/useMediaPipeHandDetection';
import { go } from '../utils/navigation';
import { calculatePolar, polarToCartesian } from '../utils/math';
import MediaPlayer from './subpages/MediaPlayer';

type RomCalibrationStages = 'preinit' | 'init' | 'leftStretch' | 'rightStretch' | 'leftRaised' | 'rightRaised' | 'done';

const CALIBRATION_MESSAGES: { [key in RomCalibrationStages]: string } = {
  preinit: 'Press Start Calibration to begin.',
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

  let pinchPos: { left: Pos | null; right: Pos | null } = { left: null, right: null };
  let headShoulderDetection: HeadShoulderDetectionResult = {
    nose: null,
    leftShoulder: null,
    rightShoulder: null,
    interShoulderDistance: null,
    noseShoulderDistance: null,
    posErrorX: null,
    posErrorZ: null,
    posMessage: 'Uncalibrated',
  };

  let calibrationStage: RomCalibrationStages = 'done';

  let leftStretchedRom: PolarPos | null = null;
  let rightStretchedRom: PolarPos | null = null;
  let leftRaisedRom: PolarPos | null = null;
  let rightRaisedRom: PolarPos | null = null;

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
    pinchPos?: { left: Pos | null; right: Pos | null };
    headShoulderDetection?: HeadShoulderDetectionResult;
    silParams?: SilhouetteParams;
    calibrationStage?: RomCalibrationStages;
    leftStretchedRom?: PolarPos | null;
    rightStretchedRom?: PolarPos | null;
    leftRaisedRom?: PolarPos | null;
    rightRaisedRom?: PolarPos | null;
  }) => {
    if (typeof props.frameWidth === 'number') width = props.frameWidth;
    if (typeof props.frameHeight === 'number') height = props.frameHeight;
    p5.resizeCanvas(width, height);

    pinchPos = props.pinchPos ?? { left: null, right: null };
    headShoulderDetection = props.headShoulderDetection ?? {
      nose: null,
      leftShoulder: null,
      rightShoulder: null,
      interShoulderDistance: null,
      noseShoulderDistance: null,
      posErrorX: null,
      posErrorZ: null,
      posMessage: 'Uncalibrated',
    };
    silParams = props.silParams ?? defaultConfig.silParams;
    calibrationStage = props.calibrationStage ?? 'init';

    leftStretchedRom = props.leftStretchedRom ?? null;
    rightStretchedRom = props.rightStretchedRom ?? null;
    leftRaisedRom = props.leftRaisedRom ?? null;
    rightRaisedRom = props.rightRaisedRom ?? null;
  };

  const drawInitSilhouette = () => {
    if (
      !headShoulderDetection.nose ||
      !headShoulderDetection.leftShoulder ||
      !headShoulderDetection.rightShoulder ||
      !headShoulderDetection.noseShoulderDistance ||
      !headShoulderDetection.interShoulderDistance ||
      !headShoulderDetection.posErrorX ||
      !headShoulderDetection.posErrorZ
    )
      return;

    const h = SIL_IMG_HEIGHT * silParams.silScaleY;
    const w = SIL_IMG_WIDTH * silParams.silScaleX;

    const noseY = silParams.silY + NOSE_Y_OFFSET * h;
    const shoulderY = silParams.silY + SHOULDER_Y_OFFSET * h;
    const leftShoulderX = SHOULDER_X_OFFSET * w;
    const rightShoulderX = -SHOULDER_X_OFFSET * w;

    let imgOpacity = 64;
    if (Math.abs(headShoulderDetection.posErrorZ) > 0.15) {
      imgOpacity = p5.map(Math.abs(headShoulderDetection.posErrorZ), 0.15, 0.5, 64, 255, true);
    } else if (Math.abs(headShoulderDetection.posErrorX) > 0.15) {
      imgOpacity = p5.map(Math.abs(headShoulderDetection.posErrorX), 0.15, 0.5, 64, 255, true);
    }

    p5.fill(255, 255, 255);
    p5.textSize(32);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text(headShoulderDetection.posMessage, 0, -height / 2 + 40);

    // Draw Silhouette
    p5.imageMode(p5.CENTER);
    p5.tint(255, imgOpacity);
    p5.image(silImg, 0, silParams.silY, w, h);

    // Silhouette POIs
    p5.noFill();
    p5.stroke(255, 255, 255, imgOpacity);
    p5.strokeWeight(2);
    p5.circle(0, noseY, 16);
    p5.circle(leftShoulderX, shoulderY, 16);
    p5.circle(rightShoulderX, shoulderY, 16);

    // User POIs
    p5.noStroke();
    p5.fill(255, 255, 255, imgOpacity);
    p5.circle(headShoulderDetection.nose.x, headShoulderDetection.nose.y, 8);
    p5.circle(headShoulderDetection.leftShoulder.x, headShoulderDetection.leftShoulder.y, 8);
    p5.circle(headShoulderDetection.rightShoulder.x, headShoulderDetection.rightShoulder.y, 8);
  };

  const drawCalibrationSilhouette = (img: p5.Image) => {
    const h = SIL_IMG_HEIGHT * silParams.silScaleY;
    const w = SIL_IMG_WIDTH * silParams.silScaleX;

    p5.imageMode(p5.CENTER);
    p5.tint(255, 255);
    p5.image(img, 0, silParams.silY, w, h);
  };

  const drawRomIndicators = () => {
    p5.stroke(255);
    p5.strokeWeight(1);
    p5.fill(0, 0, 0, 128);

    if (leftStretchedRom && headShoulderDetection.leftShoulder) {
      const leftStretchedPos = polarToCartesian(leftStretchedRom.radius, leftStretchedRom.angle, headShoulderDetection.leftShoulder);
      p5.line(headShoulderDetection.leftShoulder.x, headShoulderDetection.leftShoulder.y, leftStretchedPos.x, leftStretchedPos.y);
      p5.circle(leftStretchedPos.x, leftStretchedPos.y, 24);
      p5.circle(headShoulderDetection.leftShoulder.x, headShoulderDetection.leftShoulder.y, 8);
    }
    if (rightStretchedRom && headShoulderDetection.rightShoulder) {
      const rightStretchedPos = polarToCartesian(rightStretchedRom.radius, rightStretchedRom.angle, headShoulderDetection.rightShoulder);
      p5.line(headShoulderDetection.rightShoulder.x, headShoulderDetection.rightShoulder.y, rightStretchedPos.x, rightStretchedPos.y);
      p5.circle(rightStretchedPos.x, rightStretchedPos.y, 24);
      p5.circle(headShoulderDetection.rightShoulder.x, headShoulderDetection.rightShoulder.y, 8);
    }
    if (leftRaisedRom && headShoulderDetection.leftShoulder) {
      const leftRaisedPos = polarToCartesian(leftRaisedRom.radius, leftRaisedRom.angle, headShoulderDetection.leftShoulder);
      p5.line(headShoulderDetection.leftShoulder.x, headShoulderDetection.leftShoulder.y, leftRaisedPos.x, leftRaisedPos.y);
      p5.circle(leftRaisedPos.x, leftRaisedPos.y, 24);
    }
    if (rightRaisedRom && headShoulderDetection.rightShoulder) {
      const rightRaisedPos = polarToCartesian(rightRaisedRom.radius, rightRaisedRom.angle, headShoulderDetection.rightShoulder);
      p5.line(headShoulderDetection.rightShoulder.x, headShoulderDetection.rightShoulder.y, rightRaisedPos.x, rightRaisedPos.y);
      p5.circle(rightRaisedPos.x, rightRaisedPos.y, 24);
    }
  };

  const drawFinalSilhouette = () => {
    const h = SIL_IMG_HEIGHT * silParams.silScaleY;
    const w = SIL_IMG_WIDTH * silParams.silScaleX;

    const shoulderY = silParams.silY + SHOULDER_Y_OFFSET * h;
    const leftShoulderX = -SHOULDER_X_OFFSET * w;
    const rightShoulderX = SHOULDER_X_OFFSET * w;

    // Draw Silhouette
    p5.imageMode(p5.CENTER);
    p5.tint(255, 255);
    p5.image(silImg, 0, silParams.silY, w, h);

    if (leftStretchedRom && rightStretchedRom && leftRaisedRom && rightRaisedRom) {
      p5.stroke(255);
      p5.strokeWeight(1);
      p5.fill(0, 0, 0, 128);

      const leftStretchedPos = polarToCartesian(leftStretchedRom.radius, leftStretchedRom.angle, { x: leftShoulderX, y: shoulderY });
      const leftRaisedPos = polarToCartesian(leftRaisedRom.radius, leftRaisedRom.angle, { x: leftShoulderX, y: shoulderY });
      p5.line(leftShoulderX, shoulderY, leftStretchedPos.x, leftStretchedPos.y);
      p5.line(leftShoulderX, shoulderY, leftRaisedPos.x, leftRaisedPos.y);
      p5.circle(leftStretchedPos.x, leftStretchedPos.y, 24);
      p5.circle(leftRaisedPos.x, leftRaisedPos.y, 24);

      const rightStretchedPos = polarToCartesian(rightStretchedRom.radius, rightStretchedRom.angle, { x: rightShoulderX, y: shoulderY });
      const rightRaisedPos = polarToCartesian(rightRaisedRom.radius, rightRaisedRom.angle, { x: rightShoulderX, y: shoulderY });
      p5.line(rightShoulderX, shoulderY, rightStretchedPos.x, rightStretchedPos.y);
      p5.line(rightShoulderX, shoulderY, rightRaisedPos.x, rightRaisedPos.y);
      p5.circle(rightStretchedPos.x, rightStretchedPos.y, 24);
      p5.circle(rightRaisedPos.x, rightRaisedPos.y, 24);

      const averageLeftRomRadius = (leftStretchedRom.radius + leftRaisedRom.radius) / 2;
      const averageRightRomRadius = (rightStretchedRom.radius + rightRaisedRom.radius) / 2;

      p5.fill(0, 0, 0, 48);
      p5.circle(leftShoulderX, shoulderY, averageLeftRomRadius * 2);
      p5.circle(rightShoulderX, shoulderY, averageRightRomRadius * 2);

      p5.fill(0, 255, 0, 64);
      p5.circle(leftShoulderX, shoulderY, averageLeftRomRadius * 2 * 0.8);
      p5.circle(rightShoulderX, shoulderY, averageRightRomRadius * 2 * 0.8);
    }
  };

  p5.draw = () => {
    p5.clear();

    if (calibrationStage === 'init') drawInitSilhouette();
    else if (calibrationStage === 'leftStretch') drawCalibrationSilhouette(silLeftStretchImg);
    else if (calibrationStage === 'rightStretch') drawCalibrationSilhouette(silRightStretchImg);
    else if (calibrationStage === 'leftRaised') drawCalibrationSilhouette(silLeftRaisedImg);
    else if (calibrationStage === 'rightRaised') drawCalibrationSilhouette(silRightRaisedImg);

    // if (calibrationStage !== 'done' ) drawRomIndicators();
    // else drawFinalSilhouette();
    if (calibrationStage === 'done') drawFinalSilhouette();
    else drawRomIndicators();

    p5.noStroke();
    p5.fill(0, 0, 0, 255);
    if (pinchPos.left) p5.circle(pinchPos.left.x, pinchPos.left.y, 12);
    if (pinchPos.right) p5.circle(pinchPos.right.x, pinchPos.right.y, 12);
  };
};

const RomCalibration = () => {
  const { config, setRomCalibrationParams } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const [isTutorialVisible, setIsTutorialVisible] = useState(true);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const { videoRef, pinchDetection, headShoulderDetection, loading, error, startWebcam, stopWebcam } = useDetection(true);
  const pinchPos = pinchDetection.pinchPos;

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
    if (!pinchPos.left || !headShoulderDetection.leftShoulder) leftRomRef.current = null;
    else leftRomRef.current = calculatePolar(headShoulderDetection.leftShoulder, pinchPos.left);

    if (!pinchPos.right || !headShoulderDetection.rightShoulder) rightRomRef.current = null;
    else rightRomRef.current = calculatePolar(headShoulderDetection.rightShoulder, pinchPos.right);
  }, [pinchPos, headShoulderDetection]);

  const [calibrationStage, setCalibrationStage] = useState<RomCalibrationStages>('preinit');
  const [calibrationStartTime, setCalibrationStartTime] = useState<number | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const timerRef = useRef<number | null>(null);
  const CALIBRATION_TIMER = config.defaultStartDuration;

  const calibrationProgress = (() => {
    if (isCalibrated) return 1;
    if (!calibrationStartTime || !timerRef.current) return 0;
    const elapsed = Date.now() - calibrationStartTime;
    return Math.min(elapsed / 5000, 1);
  })();

  useEffect(() => {
    if (calibrationStage === 'preinit' || calibrationStage === 'done') {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        setCalibrationStartTime(null);
      }
      return;
    }

    if (calibrationStage === 'init') {
      if (isUserInPos && timerRef.current === null) {
        setCalibrationStartTime(Date.now());
        timerRef.current = window.setTimeout(() => {
          setCalibrationStage('leftStretch');
          setCalibrationStartTime(null);
          timerRef.current = null;
        }, 5000);
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
        timerRef.current = null;
      }, 5000);
    } else if (calibrationStage === 'rightStretch' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setRightStretchedRom(rightRomRef.current);
        setCalibrationStage('rightRaised');
        setCalibrationStartTime(null);
        timerRef.current = null;
      }, 5000);
    } else if (calibrationStage === 'leftRaised' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setLeftRaisedRom(leftRomRef.current);
        setCalibrationStage('rightStretch');
        setCalibrationStartTime(null);
        timerRef.current = null;
      }, 5000);
    } else if (calibrationStage === 'rightRaised' && timerRef.current === null) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        setRightRaisedRom(rightRomRef.current);
        setIsCalibrated(true);
        setCalibrationStage('done');
        setCalibrationStartTime(null);
        timerRef.current = null;
      }, 5000);
    }
  }, [calibrationStage, isUserInPos]);

  useEffect(() => {
    if (calibrationStage === 'done') {
      setRomCalibrationParams({
        leftStretchedRom,
        leftRaisedRom,
        rightStretchedRom,
        rightRaisedRom,
      });
    }
  }, [calibrationStage, leftStretchedRom, leftRaisedRom, rightStretchedRom, rightRaisedRom, setRomCalibrationParams]);

  useEffect(() => {
    if (isTutorialVisible) stopWebcam();
    else startWebcam();
  }, [isTutorialVisible, startWebcam, stopWebcam]);

  if (isTutorialVisible)
    return (
      <MediaPlayer
        mediaUrl="https://webhandguidance.b-cdn.net/rom_calibration_demo_test.mp4"
        mediaTitle="Range of Motion Calibration Tutorial"
        mediaSubtitle="This video will demonstrate how to calibrate your range of motion."
        doneCallback={() => setIsTutorialVisible(false)}
        doneBtnTitle="Begin Calibration"
        showHomeBtn
      />
    );

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
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
        <div ref={overlayRef} className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
          {videoRef !== null && !loading && !error && (
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          )}
          <div className="absolute inset-0">
            <ReactP5Wrapper
              sketch={sketch}
              pinchPos={pinchPos}
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
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col text-center">
        <p className="text-gray-500 text-md">{CALIBRATION_MESSAGES[calibrationStage]}</p>
        {timerRef.current && (
          <p className="text-red-500 text-md font-bold">Please hold steady for {Math.floor((CALIBRATION_TIMER - calibrationProgress * CALIBRATION_TIMER) / 1000)} seconds</p>
        )}
      </div>

      <div className="flex flex-row gap-2">
        <button
          className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
          onClick={() => setIsTutorialVisible(true)}
        >
          Replay Video
        </button>
        {calibrationStage === 'preinit' ? (
          <button
            className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => setCalibrationStage('init')}
          >
            Start Calibration
          </button>
        ) : (
          <button
            className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => setCalibrationStage('preinit')}
          >
            Reset
          </button>
        )}
        <button
          className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
          onClick={() => {
            stopWebcam();
            go('/home');
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default RomCalibration;

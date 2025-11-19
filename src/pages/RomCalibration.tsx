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
import MediaPlayer from '../components/MediaPlayer';

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
    pinchPos?: { left: Pos | null; right: Pos | null };
    headShoulderDetection?: HeadShoulderDetectionResult;
    silParams?: SilhouetteParams;
    calibrationStage?: RomCalibrationStages;
    leftStretchedRom?: PolarPos | null;
    rightStretchedRom?: PolarPos | null;
    leftRaisedRom?: PolarPos | null;
    rightRaisedRom?: PolarPos | null;
    romCalibrationParams?: { leftRadius: number; rightRadius: number } | null;
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
    p5.fill(255, 255, 255);
    p5.textSize(32);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text(headShoulderDetection.posMessage, 0, -height / 2 + 40);
  };

  const drawUserPinch = () => {
    p5.noStroke();
    p5.fill(0, 0, 0, 255);
    if (pinchPos.left) p5.circle(pinchPos.left.x, pinchPos.left.y, 12);
    if (pinchPos.right) p5.circle(pinchPos.right.x, pinchPos.right.y, 12);

    p5.fill(255, 255, 255);
    p5.textSize(12);
    p5.textAlign(p5.CENTER, p5.CENTER);
    if (pinchPos.left) p5.text('L', pinchPos.left.x, pinchPos.left.y);
    if (pinchPos.right) p5.text('R', pinchPos.right.x, pinchPos.right.y);
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
    p5.circle(leftShoulderX, shoulderY, romCalibrationParams.leftRadius * 2 * 0.8);
    p5.circle(rightShoulderX, shoulderY, romCalibrationParams.rightRadius * 2 * 0.8);
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

    if (calibrationStage === 'preinit') {
      drawSilhouette();
      drawRomCircles();
    }

    drawUserPinch();
  };
};

const RomCalibration = () => {
  const { config, setRomCalibrationParams } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams, romCalibrationParams } = config;
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
    if (pinchPos.left && headShoulderDetection.leftShoulder) leftRomRef.current = calculatePolar(headShoulderDetection.leftShoulder, pinchPos.left);
    if (pinchPos.right && headShoulderDetection.rightShoulder) rightRomRef.current = calculatePolar(headShoulderDetection.rightShoulder, pinchPos.right);
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
      const averageLeftRomRadius = leftStretchedRom && leftRaisedRom ? (leftStretchedRom.radius + leftRaisedRom.radius) / 2 : null;
      const averageRightRomRadius = rightStretchedRom && rightRaisedRom ? (rightStretchedRom.radius + rightRaisedRom.radius) / 2 : null;
      if (averageLeftRomRadius !== null && averageRightRomRadius !== null) setRomCalibrationParams({ leftRadius: averageLeftRomRadius, rightRadius: averageRightRomRadius });
      else setRomCalibrationParams(null);
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
              romCalibrationParams={romCalibrationParams}
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

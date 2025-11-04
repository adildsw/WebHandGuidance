import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import { useConfig } from '../utils/context';
import { useCallback, useEffect, useRef, useState } from 'react';

import p5 from 'p5';
import { defaultConfig, LETTER_HEIGHT_INCH, MM_TO_INCH, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../utils/constants';
import { distance } from '../utils/math';
import useDetection from '../hooks/useMediaPipeHandDetection';
import type { Pos } from '../types/task';
import { go } from '../utils/navigation';
import type { HeadShoulderDetectionResult } from '../types/detections';
import type { SilhouetteParams } from '../types/config';

const NOSE_Y_OFFSET = -0.375;
const SHOULDER_Y_OFFSET = -0.265;
const SHOULDER_X_OFFSET = 0.06;

const sketch: Sketch = (p5) => {
  let width = 200;
  let height = 400;

  let pinchPos: { left: Pos | null; right: Pos | null } = { left: null, right: null };
  let pinchReady = { left: false, right: false };
  let calibrationReady = { left: false, right: false };
  let calibrationProgress = 0;
  let isCalibrated = false;

  let headShoulderDetection: HeadShoulderDetectionResult = { nose: null, leftShoulder: null, rightShoulder: null, interShoulderDistance: null, noseShoulderDistance: null };

  let f: p5.Font;
  let silImg: p5.Image;
  let silParams: SilhouetteParams = defaultConfig.silParams;
  // const silX = 0;
  // let silY = 0;
  // let silScaleX = 1;
  // let silScaleY = 1;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
    silImg = p5.loadImage('./assets/silhouette.png');
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
    pinchReady?: { left: boolean; right: boolean };
    calibrationReady?: { left: boolean; right: boolean };
    calibrationProgress?: number;
    headShoulderDetection?: HeadShoulderDetectionResult;
    silParams?: SilhouetteParams;
    isCalibrated?: boolean;
  }) => {
    if (typeof props.frameWidth === 'number') width = props.frameWidth;
    if (typeof props.frameHeight === 'number') height = props.frameHeight;
    p5.resizeCanvas(width, height);

    pinchPos = props.pinchPos ?? { left: null, right: null };
    pinchReady = props.pinchReady ?? { left: false, right: false };
    calibrationReady = props.calibrationReady ?? { left: false, right: false };
    calibrationProgress = props.calibrationProgress ?? 0;
    headShoulderDetection = props.headShoulderDetection ?? { nose: null, leftShoulder: null, rightShoulder: null, interShoulderDistance: null, noseShoulderDistance: null };
    silParams = props.silParams ?? defaultConfig.silParams;
    isCalibrated = props.isCalibrated ?? false;
  };

  const drawSilhouette = () => {
    if (!isCalibrated) return;
    if (!headShoulderDetection.nose || !headShoulderDetection.leftShoulder || !headShoulderDetection.rightShoulder || !headShoulderDetection.noseShoulderDistance || !headShoulderDetection.interShoulderDistance) return;

    const h = SIL_IMG_HEIGHT * silParams.silScaleY;
    const w = SIL_IMG_WIDTH * silParams.silScaleX;

    const noseY = silParams.silY + NOSE_Y_OFFSET * h;
    const shoulderY = silParams.silY + SHOULDER_Y_OFFSET * h;
    const leftShoulderX = SHOULDER_X_OFFSET * w;
    const rightShoulderX = -SHOULDER_X_OFFSET * w;

    let imgOpacity = 64;

    // Calculate Average Error 
    const noseShoulderDistanceError = Math.abs(headShoulderDetection.noseShoulderDistance! - distance(0, noseY, 0, shoulderY));
    const interShoulderDistanceError = Math.abs(headShoulderDetection.interShoulderDistance! - distance(leftShoulderX, shoulderY, rightShoulderX, shoulderY));
    const averageError = (noseShoulderDistanceError + interShoulderDistanceError) / 2;

    // Calculate Error as Percent of Average Distance from Silhouette
    const averageSilDistance = (distance(0, noseY, 0, shoulderY) + distance(leftShoulderX, shoulderY, rightShoulderX, shoulderY)) / 2;
    const errorPercent = (averageError / averageSilDistance) * 100;

    // Map Error to Image Opacity
    let text = "You're in Position!";
    if (errorPercent > 15) {
      text = 'Move Closer To Screen';
      if (headShoulderDetection.noseShoulderDistance > distance(0, noseY, 0, shoulderY)) text = 'Move Further From Screen';
      imgOpacity = p5.map(errorPercent, 10, 50, 64, 255, true);
    } else {
      const noseXDistanceError = Math.abs(headShoulderDetection.nose.x - 0);
      const noseXErrorPercent = (noseXDistanceError / (width / 2)) * 100;
      imgOpacity = p5.map(noseXErrorPercent, 15, 50, 64, 255, true);
      if (noseXErrorPercent > 10) {
        text = 'Move Left';
        if (headShoulderDetection.nose.x < 0) text = 'Move Right';
      }
    }
    
    p5.fill(255, 255, 255);
    p5.textSize(32);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text(text, 0, -height / 2 + 40);

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

  p5.draw = () => {
    p5.clear();

    if (isCalibrated) {
      drawSilhouette();
      return;
    }

    p5.noStroke();
    p5.fill(0, 0, 0, 128);

    if (pinchReady.left) p5.fill(0, 255, 0, 192);
    else p5.fill(0, 0, 0, 128);
    if (pinchPos.left) p5.circle(pinchPos.left.x, pinchPos.left.y, pinchReady.left ? 12 : 6);

    if (pinchReady.right) p5.fill(0, 255, 0, 192);
    else p5.fill(0, 0, 0, 128);
    if (pinchPos.right) p5.circle(pinchPos.right.x, pinchPos.right.y, pinchReady.right ? 12 : 6);

    p5.fill(0, 255, 0, 64);
    if (pinchPos.left && calibrationReady.left) p5.circle(pinchPos.left.x, pinchPos.left.y, 64);
    if (pinchPos.right && calibrationReady.right) p5.circle(pinchPos.right.x, pinchPos.right.y, 64);

    if (pinchPos.left && pinchPos.right && pinchReady.left && pinchReady.right) {
      p5.stroke(255, 255, 255);
      p5.strokeWeight(2);
      p5.line(pinchPos.left.x, pinchPos.left.y, pinchPos.right.x, pinchPos.right.y);

      const dist = distance(pinchPos.left.x, pinchPos.left.y, pinchPos.right.x, pinchPos.right.y);
      p5.fill(255);
      p5.textSize(12);
      p5.textAlign(p5.CENTER, p5.BOTTOM);
      p5.text(dist.toFixed(2) + ' px', (pinchPos.left.x + pinchPos.right.x) / 2, (pinchPos.left.y + pinchPos.right.y) / 2);

      p5.fill(0, 0, 0, 128);
      p5.textStyle(p5.BOLD);
      p5.textAlign(p5.CENTER, p5.TOP);
      p5.text(LETTER_HEIGHT_INCH + ' inches', (pinchPos.left.x + pinchPos.right.x) / 2, (pinchPos.left.y + pinchPos.right.y) / 2);

      if (calibrationProgress > 0) {
        p5.stroke(0, 255, 0, 192);
        p5.strokeWeight(4);
        const progressX = p5.lerp(pinchPos.left.x, pinchPos.right.x, calibrationProgress);
        const progressY = p5.lerp(pinchPos.left.y, pinchPos.right.y, calibrationProgress);
        p5.line(pinchPos.left.x, pinchPos.left.y, progressX, progressY);
      }
    }
  };
};

const CameraCalibration = () => {
  const { config, setWorldPPI, setSilParams } = useConfig();
  const { worldPPI, devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const { videoRef, pinchDetection, headShoulderDetection, loading, error, startWebcam } = useDetection(true);
  const [calibrationStartTime, setCalibrationStartTime] = useState<number | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const timerRef = useRef<number | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const pinchPos = pinchDetection.pinchPos;
  const latestPinchPos = useRef(pinchPos);

  const pinchReady = pinchDetection.indexPinch;
  const calibrationReady = pinchDetection.middlePinch;
  const CALIBRATION_TIMER = config.defaultStartDuration;

  const calibrationProgress = (() => {
    if (isCalibrated) return 1;
    if (!calibrationStartTime || !timerRef.current) return 0;
    const elapsed = Date.now() - calibrationStartTime;
    return Math.min(elapsed / CALIBRATION_TIMER, 1);
  })();

  const getCalculatedSilParams = useCallback((): SilhouetteParams => {
    const h = SIL_IMG_HEIGHT;
    const w = SIL_IMG_WIDTH;

    const noseY = NOSE_Y_OFFSET * h;
    const shoulderY = SHOULDER_Y_OFFSET * h;
    const leftShoulderX = SHOULDER_X_OFFSET * w;
    const rightShoulderX = -SHOULDER_X_OFFSET * w;

    if (!headShoulderDetection.interShoulderDistance || !headShoulderDetection.noseShoulderDistance) return silParams;
    const silInterShoulderDistance = distance(leftShoulderX, shoulderY, rightShoulderX, shoulderY);
    const silNoseShoulderDistance = distance(0, noseY, 0, shoulderY);

    const silScaleY = headShoulderDetection.noseShoulderDistance / silNoseShoulderDistance;
    const silScaleX = headShoulderDetection.interShoulderDistance / silInterShoulderDistance;
    const silY = headShoulderDetection.nose ? headShoulderDetection.nose.y - NOSE_Y_OFFSET * h * silScaleY : silParams.silY;

    return {
      silY,
      silScaleX,
      silScaleY,
      silCalibrated: true,
    };
  }, [headShoulderDetection, silParams]);

  useEffect(() => {
    latestPinchPos.current = pinchPos;
  }, [pinchPos]);

  useEffect(() => {
    const ready = calibrationReady.left && calibrationReady.right && pinchReady.left && pinchReady.right;
    if (ready && timerRef.current == null && !isCalibrated) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        const { left, right } = latestPinchPos.current;
        if (left && right) {
          const d = Math.round((distance(left.x, left.y, right.x, right.y) * 100) / LETTER_HEIGHT_INCH) / 100;
          setWorldPPI(d);
          setIsCalibrated(true);
          setSilParams(getCalculatedSilParams());
        }
        timerRef.current = null;
      }, 5000);
    } else if (!ready && timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [calibrationReady, setWorldPPI, pinchReady, isCalibrated, getCalculatedSilParams, setSilParams]);

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
      {isCalibrated ? (
        <div className="w-full flex flex-col text-center gap-2">
          <h1 className="text-3xl font-bold">Calibration Complete</h1>

          <p className="text-gray-500 text-md italic">You can now return to the main screen.</p>
        </div>
      ) : (
        <div className="w-full flex flex-col text-center gap-2">
          <h1 className="text-3xl font-bold">Calibrate Camera</h1>

          <div className="flex flex-col">
            <p className="text-gray-500 text-md italic">
              Please pinch-grab a letter-sized paper horizontally on the edges using your thumb and index finger, and stand 5 feet away from the camera.
            </p>
            <p className="text-gray-500 text-md italic">Once in position, please hold steady and also pinch using your middle finger.</p>
          </div>
        </div>
      )}

      {/* Camera Feed */}
      <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
        <div ref={overlayRef} className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
          {!loading && !error && <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />}
          <div className="absolute inset-0">
            <ReactP5Wrapper
              sketch={sketch}
              pinchPos={pinchPos}
              pinchReady={pinchReady}
              calibrationReady={calibrationReady}
              calibrationProgress={calibrationProgress}
              frameWidth={testbedWidth}
              frameHeight={testbedHeight}
              devicePPI={devicePPI}
              devicePixelRatio={devicePixelRatio}
              headShoulderDetection={headShoulderDetection}
              silParams={silParams}
              isCalibrated={isCalibrated}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col text-center">
        {!isCalibrated && (
          <div className="pb-2">
            {!pinchReady.left || !pinchReady.right ? (
              <p className="text-gray-500 text-md">Pinch paper horizontally using your thumb and index finger.</p>
            ) : !calibrationReady.left || !calibrationReady.right ? (
              <p className="text-gray-500 text-md">Pinch using your middle finger to begin calibration.</p>
            ) : (
              <p className="text-red-500 text-md font-bold">Please hold steady for {Math.floor((CALIBRATION_TIMER - calibrationProgress * CALIBRATION_TIMER) / 1000)} seconds</p>
            )}
          </div>
        )}
        <span className="text-gray-600 text-center">
          <b>World-Pixel Factor:</b>{' '}
          <input
            className="border-1 border-gray-300 rounded text-center w-16"
            value={Math.round(worldPPI)}
            inputMode="decimal"
            pattern="[0-9.]*"
            onChange={(e) => setWorldPPI(Number(e.target.value))}
            readOnly
          />{' '}
          pixels/inch <span className="text-gray-400">(at 5 feet away)</span>
        </span>
      </div>

      <div className="flex flex-row gap-2">
        <button
          className={
            `bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded` +
            (!isCalibrated ? ' opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 hover:text-white cursor-pointer')
          }
          onClick={() => setIsCalibrated(false)}
          disabled={!isCalibrated}
        >
          Recalibrate
        </button>
        <button className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer" onClick={() => go('#/')}>
          Done
        </button>
      </div>
    </div>
  );
};

export default CameraCalibration;

import { ReactP5Wrapper, type Sketch } from '@p5-wrapper/react';
import type p5 from 'p5';
import { useEffect, useRef, useState } from 'react';
import type { HeadShoulderDetectionResult } from '../types/detections';
import type { SilhouetteParams } from '../types/config';
import { defaultConfig, MM_TO_INCH, NOSE_Y_OFFSET, SHOULDER_X_OFFSET, SHOULDER_Y_OFFSET, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../utils/constants';
import type { Pos } from '../types/task';
import { useConfig } from '../utils/context';
import useDetection from '../hooks/useMediaPipeHandDetection';
import { go } from '../utils/navigation';

const sketch: Sketch = (p5) => {
  let width = 200;
  let height = 400;

  let f: p5.Font;
  let silImg: p5.Image;
  let silParams: SilhouetteParams = defaultConfig.silParams;

  let pinchPos: { left: Pos | null; right: Pos | null } = { left: null, right: null };
  let headShoulderDetection: HeadShoulderDetectionResult = { nose: null, leftShoulder: null, rightShoulder: null, interShoulderDistance: null, noseShoulderDistance: null, posErrorX: null, posErrorZ: null, posMessage: 'Uncalibrated' };
  let isCalibrated = false;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
    silImg = p5.loadImage('./assets/hand_raised_left.png');
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
    isCalibrated?: boolean;
  }) => {
    if (typeof props.frameWidth === 'number') width = props.frameWidth;
    if (typeof props.frameHeight === 'number') height = props.frameHeight;
    p5.resizeCanvas(width, height);

    pinchPos = props.pinchPos ?? { left: null, right: null };
    headShoulderDetection = props.headShoulderDetection ?? { nose: null, leftShoulder: null, rightShoulder: null, interShoulderDistance: null, noseShoulderDistance: null, posErrorX: null, posErrorZ: null, posMessage: 'Uncalibrated' };
    silParams = props.silParams ?? defaultConfig.silParams;
    isCalibrated = props.isCalibrated ?? false;
  };

  const drawSilhouette = () => {
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

  p5.draw = () => {
    p5.clear();
    if (isCalibrated) return;

    drawSilhouette();

    p5.noStroke();
    p5.fill(0, 0, 0, 128);

    if (pinchPos.left) p5.circle(pinchPos.left.x, pinchPos.left.y, 24);
    if (pinchPos.right) p5.circle(pinchPos.right.x, pinchPos.right.y, 24);
  };
};

const RomCalibration = () => {
  const { config, setWorldPPI } = useConfig();
  const { worldPPI, devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const { videoRef, pinchDetection, headShoulderDetection, loading, error, startWebcam } = useDetection(true);
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);

  const pinchPos = pinchDetection.pinchPos;

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
              frameWidth={testbedWidth}
              frameHeight={testbedHeight}
              headShoulderDetection={headShoulderDetection}
              silParams={silParams}
              isCalibrated={isCalibrated}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col text-center">
        {/* {!isCalibrated && (
          <div className="pb-2">
            {!pinchReady.left || !pinchReady.right ? (
              <p className="text-gray-500 text-md">Pinch paper horizontally using your thumb and index finger.</p>
            ) : !calibrationReady.left || !calibrationReady.right ? (
              <p className="text-gray-500 text-md">Pinch using your middle finger to begin calibration.</p>
            ) : (
              <p className="text-red-500 text-md font-bold">Please hold steady for {Math.floor((CALIBRATION_TIMER - calibrationProgress * CALIBRATION_TIMER) / 1000)} seconds</p>
            )}
          </div>
        )} */}
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
        <button className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer" onClick={() => go('/home')}>
          Done
        </button>
      </div>
    </div>
  );
};

export default RomCalibration;

import { ReactP5Wrapper, type Sketch } from '@p5-wrapper/react';
import type p5 from 'p5';
import { useEffect, useState } from 'react';
import type { HeadShoulderDetectionResult } from '../types/detections';
import { type RomCalibrationParams, type SilhouetteParams } from '../types/config';
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

  // Silhouette Params
  let silH = SIL_IMG_HEIGHT * silParams.silScaleY;
  let silW = SIL_IMG_WIDTH * silParams.silScaleX;
  let noseY = silParams.silY + NOSE_Y_OFFSET * silH;
  let shoulderY = silParams.silY + SHOULDER_Y_OFFSET * silH;
  let leftShoulderX = -SHOULDER_X_OFFSET * silW;
  let rightShoulderX = SHOULDER_X_OFFSET * silW;
  let silOpacity = 255;

  // ROM Params
  let romCalibrationParams: RomCalibrationParams | null = null;
  let isROMVisible = true;
  let isSilhouetteVisible = true;
  let romSafeMargin = 0.85;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
    silImg = p5.loadImage('./assets/standing.png');
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
    romCalibrationParams?: RomCalibrationParams | null;
    isSilhouetteVisible?: boolean;
    isROMVisible?: boolean;
    romSafeMargin?: number;
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
    silParams = props.silParams ?? defaultConfig.silParams;

    silH = SIL_IMG_HEIGHT * silParams.silScaleY;
    silW = SIL_IMG_WIDTH * silParams.silScaleX;
    noseY = silParams.silY + NOSE_Y_OFFSET * silH;
    shoulderY = silParams.silY + SHOULDER_Y_OFFSET * silH;
    leftShoulderX = -SHOULDER_X_OFFSET * silW;
    rightShoulderX = SHOULDER_X_OFFSET * silW;
    silOpacity = p5.map(headShoulderDetection.guideOpacity, 0, 1, 0, 255, true);

    // ROM Circles visibility
    romCalibrationParams = props.romCalibrationParams === undefined ? null : props.romCalibrationParams;
    isROMVisible = props.isROMVisible ?? false;
    isSilhouetteVisible = props.isSilhouetteVisible ?? true;
    romSafeMargin = props.romSafeMargin ?? 0.85;
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
  

  p5.draw = () => {
    p5.clear();

    if (isSilhouetteVisible) {
      drawSilhouette();
      drawSilhouettePOIs();
      drawUserPOIs();
    }

    if (isROMVisible) drawRomCircles();

    drawUserPinch();
  };
};

const SilhouetteVisualizer = () => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams, romCalibrationParams, romSafeMargin } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const { videoRef, pinchDetection, headShoulderDetection, loading, error, startWebcam, stopWebcam } = useDetection(true);
  const pinchPos = pinchDetection.pinchPos;

  const [isSilhouetteVisible, setIsSilhouetteVisible] = useState<boolean>(true);
  const [isROMVisible, setIsROMVisible] = useState<boolean>(false);

  useEffect(() => {
    startWebcam();
  }, [startWebcam, stopWebcam]);

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">

        <div className="w-full flex flex-col text-center gap-2">
          <h1 className="text-3xl font-bold">Silhouette/Calibration Visualizer</h1>

          <div className="flex flex-col">
            <p className="text-gray-500 text-md italic">
              Interface for inspecting the silhouette alignment and range of motion calibration.
            </p>
          </div>
        </div>

      {/* Camera Feed */}
      <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
        <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
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
              isSilhouetteVisible={isSilhouetteVisible}
              isROMVisible={isROMVisible}
              romCalibrationParams={romCalibrationParams}
              romSafeMargin={romSafeMargin}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-row gap-2">
        <button
          className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
          onClick={() => setIsSilhouetteVisible(!isSilhouetteVisible)}
        >
          Toggle Silhouette {isSilhouetteVisible ? 'Off' : 'On'}
        </button>

        <button
          className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
          onClick={() => setIsROMVisible(!isROMVisible)}
        >
          Toggle ROM Indicators {isROMVisible ? 'Off' : 'On'}
        </button>
        
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

export default SilhouetteVisualizer;

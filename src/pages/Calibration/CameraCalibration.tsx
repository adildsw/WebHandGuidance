import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import { useConfig } from '../../utils/context';
import { useCallback, useEffect, useRef, useState } from 'react';

import p5 from 'p5';
import { ARUCO_MARKER_SIZE_INCH, MM_TO_INCH, NOSE_Y_OFFSET, SHOULDER_X_OFFSET, SHOULDER_Y_OFFSET, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../../utils/constants';
import { distance } from '../../utils/math';
import useDetection from '../../hooks/useMediaPipeHandDetection';
import { forceRoot } from '../../utils/navigation';
import type { SilhouetteParams } from '../../types/config';
import MediaPlayer from '../../components/MediaPlayer';
import { type Marker, type MarkerOperationResult } from '../../types/detections';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate, useSearchParams } from 'react-router-dom';

const sketch: Sketch = (p5) => {
  let width = 200;
  let height = 400;

  let calibrationProgress = 0;
  let calibrationMarker: Marker | null = null;
  let redirectProgress = 0;

  let f: p5.Font;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
  };

  p5.setup = () => {
    p5.createCanvas(width, height, p5.WEBGL);
    p5.textFont(f);
  };

  p5.windowResized = () => {
    p5.resizeCanvas(width, height);
  };

  p5.updateWithProps = (props: { frameWidth?: number; frameHeight?: number; redirectProgress?: number; calibrationProgress?: number; calibrationMarker?: Marker | null }) => {
    if (typeof props.frameWidth === 'number') width = props.frameWidth;
    if (typeof props.frameHeight === 'number') height = props.frameHeight;
    p5.resizeCanvas(width, height);
    calibrationMarker = props.calibrationMarker ?? null;
    calibrationProgress = props.calibrationProgress ?? 0;
    redirectProgress = props.redirectProgress ?? 0;
  };

  p5.draw = () => {
    p5.clear();

    p5.noStroke();
    p5.fill(0, 0, 0, 128);

    if (calibrationProgress > 0) {
      p5.stroke(0, 255, 0, 192);
      p5.strokeWeight(4);

      p5.strokeWeight(16);
      p5.line(-width / 2 + 10, -height / 2 + 10, p5.lerp(-width / 2 + 10, width / 2 - 10, calibrationProgress), -height / 2 + 10);
    }

    if (redirectProgress > 0) {
      p5.stroke(255, 0, 0, 192);
      p5.strokeWeight(16);
      const remainingProgress = 1 - redirectProgress;
      p5.line(-width / 2 + 10, -height / 2 + 10, p5.lerp(-width / 2 + 10, width / 2 - 10, remainingProgress), -height / 2 + 10);
    }

    if (calibrationMarker) {
      p5.noFill();
      p5.stroke(0, 255, 0);
      p5.strokeWeight(4);
      p5.beginShape();
      calibrationMarker.corners.forEach((c) => {
        p5.vertex(c.x, c.y);
      });
      p5.endShape(p5.CLOSE);
    }
  };
};

const CameraCalibration = () => {
  const { config, setWorldPPI, setSilParams } = useConfig();
  const { worldPPI, devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM, silParams } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const homeEnabled = urlParams.get('homeEnabled') !== 'false';
  const participantId = urlParams.get('participantId') || '';
  const dataParam = urlParams.get('data') || '';

  const [isTutorialVisible, setIsTutorialVisible] = useState(true);

  const { videoRef, headShoulderDetection, loading, error, startWebcam, stopWebcam, detectedMarkers } = useDetection(true);

  const latestMarkerDetection = useRef<MarkerOperationResult>(detectedMarkers);
  // const { isCalibrationMarkerVisible, calibrationMarker, isContinueMarkerVisible, isReplayMarkerVisible } = detectedMarkers;
  const { continueMarker, isContinueMarkerVisible, isReplayMarkerVisible } = detectedMarkers;

  const [calibrationStartTime, setCalibrationStartTime] = useState<number | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const timerRef = useRef<number | null>(null);
  const CALIBRATION_TIMER = config.defaultStartDuration;

  // Redirect timer state
  const [redirectStartTime, setRedirectStartTime] = useState<number | null>(null);
  const redirectTimerRef = useRef<number | null>(null);
  const redirectIntervalRef = useRef<number | null>(null);
  const REDIRECT_TIMER = 5000; // 5 seconds
  const [, forceUpdate] = useState(0); // Force re-render for countdown

  const calibrationProgress = (() => {
    if (isCalibrated) return 1;
    if (!calibrationStartTime || !timerRef.current) return 0;
    const elapsed = Date.now() - calibrationStartTime;
    return Math.min(elapsed / CALIBRATION_TIMER, 1);
  })();

  const redirectProgress = (() => {
    if (!isCalibrated || !redirectStartTime) return 0;
    const elapsed = Date.now() - redirectStartTime;
    return Math.min(elapsed / REDIRECT_TIMER, 1);
  })();

  const redirectSecondsRemaining = Math.ceil((REDIRECT_TIMER - (redirectStartTime ? Date.now() - redirectStartTime : 0)) / 1000);

  const getCalculatedSilParams = useCallback((): SilhouetteParams => {
    const h = SIL_IMG_HEIGHT;
    const w = SIL_IMG_WIDTH;

    const noseY = NOSE_Y_OFFSET * h;
    const shoulderY = SHOULDER_Y_OFFSET * h;
    const leftShoulderX = -SHOULDER_X_OFFSET * w;
    const rightShoulderX = SHOULDER_X_OFFSET * w;

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

  const downloadMarkers = () => {
    const link = document.createElement('a');
    link.href = './assets/markers_usletter.zip';
    link.download = 'markers_usletter.zip';
    link.click();
  };

  useEffect(() => {
    latestMarkerDetection.current = detectedMarkers;
  }, [detectedMarkers]);

  useEffect(() => {
    if (!isTutorialVisible && isContinueMarkerVisible && timerRef.current == null && !isCalibrated) {
      setCalibrationStartTime(Date.now());
      timerRef.current = window.setTimeout(() => {
        const { calibrationMarkerLength } = latestMarkerDetection.current;
        if (calibrationMarkerLength !== null && calibrationMarkerLength > 0) {
          const d = Math.round((calibrationMarkerLength * 100) / ARUCO_MARKER_SIZE_INCH) / 100;
          setWorldPPI(d);
          setIsCalibrated(true);
          setSilParams(getCalculatedSilParams());
        }
        timerRef.current = null;
      }, CALIBRATION_TIMER);
    } else if (!isContinueMarkerVisible && timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [isTutorialVisible, isContinueMarkerVisible, setWorldPPI, isCalibrated, getCalculatedSilParams, setSilParams, CALIBRATION_TIMER]);

  // Clear redirect timer helper
  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    if (redirectIntervalRef.current) {
      clearInterval(redirectIntervalRef.current);
      redirectIntervalRef.current = null;
    }
    setRedirectStartTime(null);
  }, []);

  // Start redirect timer when calibration completes
  useEffect(() => {
    if (!isTutorialVisible && isCalibrated && !redirectTimerRef.current) {
      setRedirectStartTime(Date.now());

      // Update every 100ms for smooth progress bar
      redirectIntervalRef.current = window.setInterval(() => {
        forceUpdate((n) => n + 1);
      }, 100);

      // Navigate after REDIRECT_TIMER
      redirectTimerRef.current = window.setTimeout(() => {
        stopWebcam();
        if (participantId && dataParam) navigate(`/rom-calibration?participantId=${participantId}&data=${dataParam}&homeEnabled=${homeEnabled}`);
        else navigate('/rom-calibration?homeEnabled=' + homeEnabled);
      }, REDIRECT_TIMER);
    }

    return () => {
      // Cleanup on unmount
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      if (redirectIntervalRef.current) clearInterval(redirectIntervalRef.current);
    };
  }, [isTutorialVisible, isCalibrated, navigate, stopWebcam, REDIRECT_TIMER, dataParam, participantId, homeEnabled]);

  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, [startWebcam, stopWebcam]);

  return (
    <>
      {isTutorialVisible && (
        <MediaPlayer
          mediaUrl="https://webhandguidance.b-cdn.net/phase2_videos/ScreenCalibrationTutorial.mp4"
          mediaTitle="Camera Calibration Tutorial"
          mediaSubtitle="This video will demonstrate how to calibrate your camera."
          doneCallback={() => setIsTutorialVisible(false)}
          doneBtnTitle="Begin Calibration"
          showHomeBtn={homeEnabled}
          isContinueMarkerVisible={isContinueMarkerVisible}
          isReplayMarkerVisible={isReplayMarkerVisible}
        />
      )}
      <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
        <div className="w-full flex flex-col text-center gap-2 pb-4">
          {isCalibrated ? (
            <>
              <h1 className="text-3xl font-bold">
                Calibration #2: <span className="font-normal italic">Camera Calibration Complete</span>
              </h1>
              <p className="text-gray-500 text-md italic">
                Automatically redirecting to the last calibration step in {redirectSecondsRemaining} second{redirectSecondsRemaining !== 1 ? 's' : ''}...
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">
                Calibration #2: <span className="font-normal italic">Calibrate Camera</span>
              </h1>
              {isContinueMarkerVisible ? (
                <p className="text-red-500 text-xl font-bold">Please hold steady for {Math.floor((CALIBRATION_TIMER - calibrationProgress * CALIBRATION_TIMER) / 1000)} seconds</p>
              ) : (
                <p className="text-gray-600 text-md italic">Please stand 10 feet away from the screen and hold the calibration marker.</p>
              )}
            </>
          )}
        </div>

        {/* Camera Feed */}
        <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
          <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
            {!loading && !error && <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />}
            <div className="absolute inset-0">
              <ReactP5Wrapper
                sketch={sketch}
                calibrationMarker={continueMarker}
                calibrationProgress={calibrationProgress}
                frameWidth={testbedWidth}
                frameHeight={testbedHeight}
                redirectProgress={redirectProgress}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col text-center">
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
            pixels/inch <span className="text-gray-400">(at 10 feet away)</span>
          </span>
        </div>

        <div className="flex flex-row gap-2">
          <button
            className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => setIsTutorialVisible(true)}
          >
            Replay Video
          </button>
          <button
            className="absolute top-4 right-4 bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => downloadMarkers()}
          >
            Download Markers
          </button>
          <button
            className={
              `bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded` +
              (!isCalibrated ? ' opacity-50 cursor-not-allowed' : ' hover:bg-gray-800 hover:text-white cursor-pointer')
            }
            onClick={() => {
              clearRedirectTimer();
              setIsCalibrated(false);
            }}
            disabled={!isCalibrated}
          >
            Recalibrate
          </button>

          {homeEnabled && (
            <button
              className="absolute top-4 left-4 bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
              onClick={() => forceRoot()}
            >
              <FontAwesomeIcon icon="chevron-left" /> Home
            </button>
          )}

          <button
            className={
              `bg-slate-600 border border-slate-300 text-white font-bold px-4 py-2 rounded` +
              (!isCalibrated ? ' opacity-50 cursor-not-allowed' : ' hover:bg-slate-800 hover:text-white cursor-pointer')
            }
            disabled={!isCalibrated}
            onClick={() => {
              clearRedirectTimer();
              stopWebcam();
              navigate('/rom-calibration');
            }}
          >
            Continue to ROM Calibration
          </button>
        </div>
      </div>
    </>
  );
};

export default CameraCalibration;

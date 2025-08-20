import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import { useConfig } from '../utils/context';
import { useEffect, useRef, useState } from 'react';

import font from '../assets/sf-ui-display-bold.otf';
import p5 from 'p5';
import { MM_TO_INCH } from '../utils/constants';

import AR from "js-aruco";

const sketch: Sketch = (p5) => {
  let width = 200;
  let height = 400;

  p5.setup = () => {
    p5.createCanvas(width, height, p5.WEBGL);
    p5.loadFont(font, (loadedFont: p5.Font) => {
      p5.textFont(loadedFont);
    });
  };

  p5.windowResized = () => {
    p5.resizeCanvas(width, height);
  };

  p5.updateWithProps = (props: any) => {
    if (typeof props.frameWidth === 'number') width = props.frameWidth;
    if (typeof props.frameHeight === 'number') height = props.frameHeight;
    p5.resizeCanvas(width, height);
  };

  p5.draw = () => {
    p5.clear();

    p5.fill(250, 250, 250, 96);
    p5.stroke(200);
    p5.strokeWeight(1);
    p5.rect(-width / 2, -height / 2, width, height, 8);
  };
};

// const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12' });
const detector = new AR.Detector();

const CameraCalibration = () => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      var markers = detector.detect(v);
      console.log('Detected markers:', markers);
  }, []);

  const startStream = async () => {
    if (streamRef.current || isStreaming) return;
    try {
      setIsStreaming(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, []);

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
      <div className="w-full flex flex-col text-center gap-2">
        <h1 className="text-3xl font-bold">Calibrate Camera</h1>

        <div className="flex flex-col">
          <p className="text-gray-500 text-md italic">Instruction text goes here...</p>
        </div>
      </div>

      {/* Camera Feed */}
      <div
        className="md:col-span-3 rounded-lg shadow-lg bg-gray-100 overflow-hidden flex items-center justify-center relative"
        style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}
      >
        <div ref={overlayRef} className="absolute inset-0">
          <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div className="absolute inset-0">
            <ReactP5Wrapper sketch={sketch} frameWidth={testbedWidth} frameHeight={testbedHeight} devicePPI={devicePPI} devicePixelRatio={devicePixelRatio} />
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <span className="text-gray-600 text-center">
          <b>Focal Estimation:</b> {NaN}
        </span>
        {/* <div className="flex flex-row gap-2">
          <div className="bg-gray-200 px-2 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400">
            -
          </div>
          <input type="range" min="100" max="300" step="1" value={0} className="w-64" />
          <div className="bg-gray-200 px-2 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400">
            +
          </div>
        </div> */}
      </div>

      <button
        className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
        onClick={() => (window.location.hash = '#/')}
      >
        Done
      </button>
    </div>
  );
};

export default CameraCalibration;

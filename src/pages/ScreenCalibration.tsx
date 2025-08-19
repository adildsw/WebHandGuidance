import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import { useConfig } from '../utils/context';
import { useEffect, useRef, useState } from 'react';

import font from '../assets/sf-ui-display-bold.otf';
import { CREDIT_CARD_HEIGHT_INCH, CREDIT_CARD_WIDTH_INCH, DOLLAR_BILL_HEIGHT_INCH, DOLLAR_BILL_WIDTH_INCH, MM_TO_INCH } from '../utils/constants';
import p5 from 'p5';
import { CalibrationTools } from '../types/config';

const sketch: Sketch = (p5) => {
  let width = 200;
  let height = 400;

  let calibrationTool: CalibrationTools = 'RULER';
  let devicePPI = 96;
  let devicePixelRatio = 1;

  p5.setup = () => {
    console.log(height, width);
    p5.createCanvas(width, height, p5.WEBGL);
    p5.loadFont(font, (loadedFont: p5.Font) => {
      p5.textFont(loadedFont);
    });
  };

  p5.windowResized = () => {
    p5.resizeCanvas(width, height);
  };

  p5.updateWithProps = (props: any) => {
    if (typeof props.devicePPI === 'number') devicePPI = props.devicePPI;
    if (typeof props.devicePixelRatio === 'number') devicePixelRatio = props.devicePixelRatio;
    if (typeof props.calibrationTool === 'string') calibrationTool = props.calibrationTool;
    if (typeof props.size === 'object') {
      width = props.size.width;
      height = props.size.height;
      p5.resizeCanvas(width, height);
    }
  };

  p5.draw = () => {
    p5.clear();

    p5.fill(250, 250, 250, 96);
    p5.stroke(200);
    p5.strokeWeight(1);
    p5.rect(-width / 2, -height / 2, width, height, 8);

    if (calibrationTool === 'CREDIT') drawCreditCard();
    else if (calibrationTool === 'DOLLAR') drawDollarBill();
    else drawRuler();
  };

  const drawCreditCard = () => {
    const width = (CREDIT_CARD_WIDTH_INCH * devicePPI) / devicePixelRatio;
    const height = (CREDIT_CARD_HEIGHT_INCH * devicePPI) / devicePixelRatio;
    p5.fill(230);
    p5.stroke(212);
    p5.strokeWeight(2);
    p5.rect(-width / 2, -height / 2, width, height, 8);

    // Dimension Markers
    p5.stroke(0);
    p5.strokeWeight(1);
    p5.fill(0);
    p5.textSize(12);

    // Vertical Dimensions
    p5.line(-width / 2 - 10, -height / 2, -width / 2 - 10, height / 2);
    p5.line(-width / 2 - 15, -height / 2, -width / 2 - 10, -height / 2);
    p5.line(-width / 2 - 15, height / 2, -width / 2 - 10, height / 2);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.push();
    p5.translate(-width / 2 - 20, 0);
    p5.rotate(-p5.HALF_PI);
    p5.text('Should match 53.98 mm', 0, -15);
    p5.fill(200);
    p5.text(`${Math.round(height)} px`, 0, 0);
    p5.pop();

    // Horizontal Dimensions
    p5.fill(0);
    p5.line(-width / 2, height / 2 + 10, width / 2, height / 2 + 10);
    p5.line(-width / 2, height / 2 + 10, -width / 2, height / 2 + 15);
    p5.line(width / 2, height / 2 + 10, width / 2, height / 2 + 15);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text('Should match 85.6 mm', 0, height / 2 + 20);
    p5.fill(200);
    p5.text(`${Math.round(width)} px `, 0, height / 2 + 35);

    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text('Place an actual credit card on the screen here', 0, 0);
  };

  const drawRuler = () => {
    const totalMm = 100;
    const rulerLength = (totalMm * MM_TO_INCH * devicePPI) / devicePixelRatio;
    const rulerWidth = 50;

    p5.fill(230);
    p5.stroke(212);
    p5.strokeWeight(2);
    p5.rect(-rulerLength / 2, -rulerWidth / 2, rulerLength, rulerWidth, 2);

    p5.stroke(0);
    p5.strokeWeight(1);
    p5.fill(0);
    p5.textSize(12);

    for (let i = 0; i <= totalMm; i++) {
      const x = -rulerLength / 2 + (i * MM_TO_INCH * devicePPI) / devicePixelRatio;
      const len = i % 10 === 0 ? 12 : i % 5 === 0 ? 9 : 6;
      p5.line(x, -rulerWidth / 2, x, -rulerWidth / 2 + len);
      if (i % 20 === 0) {
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.text(`${i}mm`, x, -rulerWidth / 2 - 14);
      }
    }

    const totalInches = totalMm * MM_TO_INCH;
    const maxN = Math.round(totalInches * 16);
    for (let n = 0; n <= maxN; n++) {
      const inches = n / 16;
      const x = -rulerLength / 2 + (inches * devicePPI) / devicePixelRatio;
      let len = 5;
      if (n % 16 === 0) len = 12;
      else if (n % 8 === 0) len = 10;
      else if (n % 4 === 0) len = 8;
      else if (n % 2 === 0) len = 6;
      p5.line(x, rulerWidth / 2, x, rulerWidth / 2 - len);
      if (n % 16 === 0) {
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.text(`${inches.toFixed(0)}in`, x, rulerWidth / 2 + 14);
      }
    }
  };

  const drawDollarBill = () => {
    const width = (DOLLAR_BILL_WIDTH_INCH * devicePPI) / devicePixelRatio;
    const height = (DOLLAR_BILL_HEIGHT_INCH * devicePPI) / devicePixelRatio;
    p5.fill(230);
    p5.stroke(212);
    p5.strokeWeight(2);
    p5.rect(-width / 2, -height / 2, width, height, 8);

    // Dimension Markers
    p5.stroke(0);
    p5.strokeWeight(1);
    p5.fill(0);
    p5.textSize(12);

    // Vertical Dimensions
    p5.line(-width / 2 - 10, -height / 2, -width / 2 - 10, height / 2);
    p5.line(-width / 2 - 15, -height / 2, -width / 2 - 10, -height / 2);
    p5.line(-width / 2 - 15, height / 2, -width / 2 - 10, height / 2);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.push();
    p5.translate(-width / 2 - 20, 0);
    p5.rotate(-p5.HALF_PI);
    p5.text('Should match 66.42 mm', 0, -15);
    p5.fill(200);
    p5.text(`${Math.round(height)} px`, 0, 0);
    p5.pop();

    // Horizontal Dimensions
    p5.fill(0);
    p5.line(-width / 2, height / 2 + 10, width / 2, height / 2 + 10);
    p5.line(-width / 2, height / 2 + 10, -width / 2, height / 2 + 15);
    p5.line(width / 2, height / 2 + 10, width / 2, height / 2 + 15);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text('Should match 156 mm', 0, height / 2 + 20);
    p5.fill(200);
    p5.text(`${Math.round(width)} px `, 0, height / 2 + 35);

    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text('Place an actual dollar bill on the screen here', 0, 0);
  };
};

const ScreenCalibration = () => {
  const { config, setDevicePPI, setCalibrationTool } = useConfig();
  const { devicePPI, devicePixelRatio, calibrationTool } = config;

  const calibrationDivRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    if (!calibrationDivRef.current) return;
    const resize = () => {
      const { clientWidth, clientHeight } = calibrationDivRef.current!;
      setCanvasSize({ width: clientWidth, height: clientHeight });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  const increaseScale = () => {
    setDevicePPI(devicePPI + 1);
  };

  const decreaseScale = () => {
    setDevicePPI(devicePPI - 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+') {
        increaseScale();
      } else if (e.key === '-') {
        decreaseScale();
      } else if (e.key === 'Enter') {
        window.location.hash = '#/';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [config, setDevicePPI]);

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
      <div className="w-full flex flex-col text-center gap-2">
        <h1 className="text-3xl font-bold">Calibrate Display</h1>

        <div className="flex flex-row gap-2 justify-center items-center">
          <span className="text-sm font-bold">Select Calibration Tool:</span>
          <button
            className={`text-sm px-4 py-1 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400 ${
              calibrationTool === 'RULER' ? 'bg-gray-200' : 'border-1 border-gray-200'
            }`}
            onClick={() => setCalibrationTool('RULER')}
          >
            Ruler
          </button>
          <button
            className={`text-sm px-4 py-1 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400 ${
              calibrationTool === 'CREDIT' ? 'bg-gray-300' : 'border-1 border-gray-200'
            }`}
            onClick={() => setCalibrationTool('CREDIT')}
          >
            Credit Card
          </button>
          <button
            className={`text-sm px-4 py-1 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400 ${
              calibrationTool === 'DOLLAR' ? 'bg-gray-300' : 'border-1 border-gray-200'
            }`}
            onClick={() => setCalibrationTool('DOLLAR')}
          >
            Dollar Bill
          </button>
        </div>
        <div className="flex flex-col">
          <p className="text-gray-500 text-md italic">
            Please adjust the slider so that{' '}
            {calibrationTool === 'RULER'
              ? `the dimensions of the ruler on screen match the size of a standard ruler.`
              : calibrationTool === 'CREDIT'
              ? `the rectangle on the screen matches the size of a standard credit card.`
              : `the rectangle on the screen matches the size of a US dollar bill.`}
          </p>
          <p className="text-gray-500 text-md italic">
            You can also use the <kbd className="bg-gray-100 font-bold px-2 rounded">+</kbd> and <kbd className="bg-gray-100 font-bold px-2 rounded">-</kbd> keys to adjust the
            scale factor, and press <kbd className="bg-gray-100 font-bold px-2 rounded">↵</kbd> to complete the calibration.
          </p>
        </div>
      </div>

      <div ref={calibrationDivRef} className="flex flex-col w-full grow">
        <ReactP5Wrapper sketch={sketch} size={canvasSize} devicePPI={devicePPI} devicePixelRatio={devicePixelRatio} calibrationTool={calibrationTool} />
      </div>

      <div className="flex flex-col">
        <span className="text-gray-600 text-center">
          <b>Display PPI:</b> {devicePPI}
        </span>
        <div className="flex flex-row gap-2">
          <div className="bg-gray-200 px-2 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400" onClick={() => decreaseScale()}>
            -
          </div>
          <input type="range" min="100" max="300" step="1" value={devicePPI} className="w-64" onChange={(e) => setDevicePPI(parseFloat(e.target.value))} />
          <div className="bg-gray-200 px-2 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400" onClick={() => increaseScale()}>
            +
          </div>
        </div>
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

export default ScreenCalibration;

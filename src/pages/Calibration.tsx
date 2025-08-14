import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import { useConfig } from '../utils/context';
import { useEffect } from 'react';

const Calibration = () => {
  const { config, setConfig } = useConfig();

  const increaseScale = () => {
    setConfig({ ...config, scaleFactor: config.scaleFactor + 0.05 });
  };

  const decreaseScale = () => {
    setConfig({ ...config, scaleFactor: config.scaleFactor - 0.05 });
  };

  useEffect(() => {
    const adjustVal = 0.05;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '+') {
        increaseScale();
      } else if (e.key === '-') {
        decreaseScale();
      } else if (e.key === 'Enter') {
        window.location.href = '/';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [config, setConfig]);

  const sketch: Sketch = (p5) => {
    const aspectRatio = 1.5858; // universal credit card aspect ratio
    const base = 370; // rough estimate for average display PPIs

    const p5Width = base * 2.5;
    const p5Height = p5Width / aspectRatio;

    p5.setup = () => p5.createCanvas(p5Width, p5Height, p5.WEBGL);

    p5.draw = () => {
      p5.background(255);

      p5.fill(250);
      p5.stroke(200);
      p5.strokeWeight(1);
      p5.rect(-p5Width / 2, -p5Height / 2, p5Width, p5Height, 8);

      const width = base * config.scaleFactor;
      const height = width / aspectRatio;
      p5.fill(230);
      p5.stroke(212);
      p5.strokeWeight(2);
      p5.rect(-width / 2, -height / 2, width, height, 8);
    };
  };

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center">
      <div className="w-full flex flex-col text-center">
        <h1 className="text-3xl font-bold">Calibrate Display</h1>
        <p className="text-gray-600">Please adjust the slider so that the rectangle on the screen matches the size of a standard credit card.</p>
        <p className="text-gray-600">
          You can also use the <kbd className="bg-gray-100 font-bold px-2 rounded">+</kbd> and <kbd className="bg-gray-100 font-bold px-2 rounded">-</kbd> keys to adjust the scale
          factor, and press <kbd className="bg-gray-100 font-bold px-2 rounded">↵</kbd> to complete the calibration.
        </p>
      </div>

      <ReactP5Wrapper sketch={sketch} />

      <div className="flex flex-col">
        <span className="text-gray-600 text-center"><b>Scale Factor:</b> {config.scaleFactor.toFixed(2)}</span>
        <div className="flex flex-row gap-2">
          <div className="bg-gray-200 px-2 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400" onClick={() => decreaseScale()}>
            -
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.01"
            value={config.scaleFactor}
            className="w-64"
            onChange={(e) => setConfig({ ...config, scaleFactor: parseFloat(e.target.value) })}
          />
          <div className="bg-gray-200 px-2 rounded hover:bg-gray-300 cursor-pointer select-none font-bold active:bg-gray-400" onClick={() => increaseScale()}>
            +
          </div>
        </div>
      </div>

      <button className="bg-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-400 cursor-pointer" onClick={() => window.location.href = '/'}>
        Done
      </button>
    </div>
  );
};

export default Calibration;

import { useCallback } from 'react';
import { useConfig } from '../utils/context';

const Config = () => {
  const { config, setMarkerDiameter, setTestbedWidth, setTestbedHeight, setDefaultHand, setDefaultTrials, setDefaultRepetitions, setDefaultMoveThreshold } = useConfig();

  const toNumber = useCallback((s: string) => {
    const v = s.replace(/[^0-9.]/g, '');
    return v === '' ? 0 : Number(v);
  }, []);

  const goHome = () => {
    window.location.hash = '#/';
  };

  const resetParams = () => {
    if (confirm('Are you sure you want to reset all parameters to their default values?')) {
      setMarkerDiameter(5);
      setTestbedWidth(160);
      setTestbedHeight(100);
      setDefaultHand('right');
      setDefaultTrials(3);
      setDefaultRepetitions(5);
      setDefaultMoveThreshold(15);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center select-none">
      <div className="w-[360px] md:w-[420px] bg-white rounded-2xl shadow border border-gray-200 p-6 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurations</h1>

        <div className="w-full flex flex-col gap-5">
          <div>
            <div className="text-sm font-bold text-gray-600 mb-3">Testbed Parameters</div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">Testbed Width (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.testbedWidthMM)}
                onChange={(e) => setTestbedWidth(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">Testbed Height (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.testbedHeightMM)}
                onChange={(e) => setTestbedHeight(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Marker Diameter (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.markerDiameterMM)}
                onChange={(e) => setMarkerDiameter(toNumber(e.target.value))}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-bold text-gray-600 mb-3">Default Parameters</div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">Hand</label>
              <select className="w-28 px-2 py-1 rounded border border-gray-300" value={config.defaultHand} onChange={(e) => setDefaultHand(e.target.value as 'left' | 'right')}>
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">Trials</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultTrials)}
                onChange={(e) => setDefaultTrials(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600">Repetitions</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultRepetitions)}
                onChange={(e) => setDefaultRepetitions(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Move Threshold (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultMoveThreshold)}
                onChange={(e) => setDefaultMoveThreshold(toNumber(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <button onClick={resetParams} className="w-full px-4 py-3 rounded-lg bg-white-300 border border-gray-200 text-gray-900 hover:bg-red-400 cursor-pointer">
            Reset to Default
          </button>

          <button onClick={goHome} className="w-full px-4 py-3 rounded-lg bg-gray-300 text-gray-900 hover:bg-gray-400 cursor-pointer">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default Config;

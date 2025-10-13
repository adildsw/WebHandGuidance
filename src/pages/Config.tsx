import { useCallback } from 'react';
import { useConfig } from '../utils/context';
import { defaultConfig } from '../utils/constants';
import { go } from '../utils/navigation';

const Config = () => {
  const {
    config,
    setDevicePPI,
    setWorldPPI,
    setMarkerDiameter,
    setTestbedWidth,
    setTestbedHeight,
    setDefaultHand,
    setDefaultTrials,
    setDefaultRepetitions,
    setDefaultDistanceThreshold,
    setDefaultTaskType,
    setDefaultHoldDuration,
    setDefaultStartDuration,
  } = useConfig();

  const toNumber = useCallback((s: string) => {
    const v = s.replace(/[^0-9.]/g, '');
    return v === '' ? 0 : Number(v);
  }, []);

  const resetParams = () => {
    if (confirm('Are you sure you want to reset all parameters to their default values?')) {
      setDevicePPI(defaultConfig.devicePPI);
      setWorldPPI(defaultConfig.worldPPI);
      setMarkerDiameter(defaultConfig.markerDiameterMM);
      setTestbedWidth(defaultConfig.testbedWidthMM);
      setTestbedHeight(defaultConfig.testbedHeightMM);
      setDefaultHand(defaultConfig.defaultHand);
      setDefaultTrials(defaultConfig.defaultTrials);
      setDefaultRepetitions(defaultConfig.defaultRepetitions);
      setDefaultDistanceThreshold(defaultConfig.defaultDistanceThreshold);
      setDefaultTaskType(defaultConfig.defaultTaskType);
      setDefaultStartDuration(defaultConfig.defaultStartDuration);
      setDefaultHoldDuration(defaultConfig.defaultHoldDuration);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center select-none">
      <div className="w-[360px] md:w-[420px] max-h-[90vh] bg-white rounded-2xl shadow border border-gray-200 p-4 flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Configurations</h1>

        <div className="w-full border border-gray-100 rounded-xl bg-gray-50 p-2 max-h-[90vh] overflow-auto flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-gray-600 mb-1">Calibation Parameters</div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Display PPI</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.devicePPI)}
                onChange={(e) => setDevicePPI(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">World PPI (at 5 feet distance)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.worldPPI)}
                onChange={(e) => setWorldPPI(toNumber(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-gray-600 mb-1">Testbed Parameters</div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Testbed Width (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.testbedWidthMM)}
                onChange={(e) => setTestbedWidth(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Testbed Height (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.testbedHeightMM)}
                onChange={(e) => setTestbedHeight(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Marker Diameter (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="decimal"
                pattern="[0-9.]*"
                value={String(config.markerDiameterMM)}
                onChange={(e) => setMarkerDiameter(toNumber(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-gray-600 mb-1">Interaction Parameters</div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Pinch Activate Duration (s)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultStartDuration / 1000)}
                onChange={(e) => setDefaultStartDuration(toNumber(e.target.value) * 1000)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-gray-600 mb-1">Default Parameters</div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Hand</label>
              <select
                className="w-28 px-2 py-1 rounded border border-gray-300 bg-white"
                value={config.defaultHand}
                onChange={(e) => setDefaultHand(e.target.value as 'Left' | 'Right')}
              >
                <option value="Right">Right</option>
                <option value="Left">Left</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Trials</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultTrials)}
                onChange={(e) => setDefaultTrials(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Repetitions</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultRepetitions)}
                onChange={(e) => setDefaultRepetitions(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Distance Threshold (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultDistanceThreshold)}
                onChange={(e) => setDefaultDistanceThreshold(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Hold Duration (s)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.defaultHoldDuration / 1000)}
                onChange={(e) => setDefaultHoldDuration(toNumber(e.target.value) * 1000)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <button onClick={resetParams} className="w-full px-4 py-3 rounded-lg bg-white-300 border border-gray-200 text-gray-900 hover:bg-red-400 cursor-pointer">
            Reset to Default
          </button>

          <button
            onClick={() => go('#/')}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-800 hover:text-white font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default Config;

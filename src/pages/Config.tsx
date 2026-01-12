import { useCallback, useState } from 'react';
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
    setMinVibrationThreshold,
    setMaxVibrationThreshold,
    setSilParams,
    setRomCalibrationParams,
    setRomSafeMargin,
    setServerURL,
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
      setMinVibrationThreshold(defaultConfig.minVibrationThresholdMM);
      setMaxVibrationThreshold(defaultConfig.maxVibrationThresholdMM);
      setSilParams(defaultConfig.silParams);
      setRomCalibrationParams(defaultConfig.romCalibrationParams);
      setRomSafeMargin(defaultConfig.romSafeMargin);
      setServerURL(defaultConfig.serverURL);
    }
  };

  const downloadMarkers = () => {
    const link = document.createElement('a');
    link.href = './assets/markers_usletter.zip';
    link.download = 'markers_usletter.zip';
    link.click();
  };

  const [tempServerUrl, setTempServerURL] = useState<string>(config.serverURL);

  const testServerConnection = () => {
    fetch(tempServerUrl)
      .then((res) => {
        if (res.ok) {
          setServerURL(tempServerUrl);
          alert('Connection successful!');
        } else {
          setServerURL('');
          alert('Connection failed. Please check the server URL and try again.');
        }
      })
      .catch(() => {
        alert('Connection failed. Please check the server URL and try again.');
      });
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
            {/* <div className="text-sm font-bold text-gray-600 mb-1">Testbed Parameters</div>
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
            </div> */}

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

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Minimum Vibration Threshold (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.minVibrationThresholdMM)}
                onChange={(e) => setMinVibrationThreshold(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Maximum Vibration Threshold (mm)</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(config.maxVibrationThresholdMM)}
                onChange={(e) => setMaxVibrationThreshold(toNumber(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-600">ROM Safe Margin</label>
              {/* slider between 0 and 1 */}
              <input
                className="grow"
                type="range"
                min="0.5"
                max="1"
                step="0.01"
                value={String(config.romSafeMargin)}
                onChange={(e) => setRomSafeMargin(toNumber(e.target.value))}
              />
              <label className="text-right shrink text-sm text-gray-400">{(config.romSafeMargin * 100).toFixed(0)} % ROM</label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-gray-600 mb-1">Data Collection Parameters</div>

            <div className="flex items-center justify-between gap-2">
              <label className="text-sm text-gray-600">Server URL</label>
              <input
                className="px-2 py-1 text-center rounded border border-gray-300 bg-white"
                inputMode="text"
                value={String(tempServerUrl)}
                onChange={(e) => setTempServerURL(e.target.value)}
              />
              <button
                onClick={testServerConnection}
                className="px-3 py-1 rounded-lg border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-800 hover:text-white font-bold cursor-pointer"
              >
                Connect
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-bold text-gray-600 mb-1">Default Task Designer Parameters</div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Task Type</label>
              <select
                className="w-28 px-2 py-1 rounded border border-gray-300 bg-white"
                value={config.defaultTaskType}
                onChange={(e) => setDefaultTaskType(e.target.value as 'MOVE' | 'HOLD' | 'ROM_HOLD' | 'ROM_MOVE' | 'MEDIA')}
              >
                <option value="MOVE">Move</option>
                <option value="HOLD">Hold</option>
                <option value="ROM_HOLD">ROM Hold</option>
                <option value="ROM_MOVE">ROM Move</option>
                <option value="MEDIA">Media</option>
              </select>
            </div>

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
            
            <button
              onClick={() => downloadMarkers()}
              className="w-full px-4 py-3 mt-4 rounded-lg border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-800 hover:text-white font-bold cursor-pointer"
            >
              Download Markers
            </button>

            <button
              onClick={() => go('#/visualizer')}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-900 hover:bg-gray-800 hover:text-white font-bold cursor-pointer"
            >
              Silhouette Visualizer
            </button>
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

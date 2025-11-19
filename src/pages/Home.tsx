import { useRef } from 'react';
import { encodeBase64 } from '../utils/encoder';
import { go } from '../utils/navigation';
import { useConfig } from '../utils/context';

const Home = () => {
  const { config } = useConfig();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const openFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) return;
    const text = await file.text();
    const encoded = encodeBase64(text);
    console.log(encoded);

    const participantId = prompt('Enter Participant ID:');
    go(`#/study?participantId=${participantId}&data=${encoded}`);
  };

  const isCameraCalibrated = config.silParams.silCalibrated;
  const isROMCalibrated = config.romCalibrationParams !== null;

  console.log(isCameraCalibrated, isROMCalibrated);

  return (
    <div className="w-screen h-screen flex items-center justify-center select-none">
      <div className="w-[360px] md:w-[420px] bg-white rounded-2xl shadow border border-gray-200 p-6 flex flex-col items-center gap-6">
        <h1 className="text-3xl tracking-tight text-gray-900">
          <span className="font-light">Web</span>
          <span className="font-extrabold">HandGuidance</span>
        </h1>

        <div className="w-full flex flex-col gap-3">
          <button
            disabled={!isCameraCalibrated || !isROMCalibrated}
            onClick={openFile}
            className={
              `w-full px-4 py-3 rounded-lg text-gray-900` +
              (!isCameraCalibrated || !isROMCalibrated
                ? ' opacity-50 cursor-not-allowed hover:bg-gray-200 hover:text-gray-900 bg-gray-200'
                : ' hover:bg-gray-800 hover:text-white cursor-pointer bg-white border border-gray-300')
            }
          >
            Start Study
          </button>

          <button
            disabled={!isCameraCalibrated || !isROMCalibrated}
            onClick={() => go('#/create-study-tasks')}
            className={
              `w-full px-4 py-3 rounded-lg text-gray-900` +
              (!isCameraCalibrated || !isROMCalibrated
                ? ' opacity-50 cursor-not-allowed hover:bg-gray-200 hover:text-gray-900 bg-gray-200'
                : ' hover:bg-gray-800 hover:text-white cursor-pointer bg-white border border-gray-300')
            }
          >
            Create Tasks
          </button>

          <div className="flex flex-row gap-2 py-2">
            <div className="flex-grow border-t border-gray-300 my-2" />
            <span className="text-xs font-semibold text-center text-gray-600">Calibration</span>
            <div className="flex-grow border-t border-gray-300 my-2" />
          </div>

          <button onClick={() => go('#/screen-calibration')} className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer">
            Calibrate Screen
          </button>

          <button onClick={() => go('#/camera-calibration')} className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer">
            Calibrate Camera
          </button>

          <button
            disabled={!isCameraCalibrated}
            onClick={() => go('#/rom-calibration')}
            className={
              `w-full px-4 py-3 rounded-lg text-gray-900` +
              (!isCameraCalibrated
                ? ' opacity-50 cursor-not-allowed hover:bg-gray-200 hover:text-gray-900 bg-gray-200'
                : ' hover:bg-gray-800 hover:text-white cursor-pointer bg-white border border-gray-300')
            }
          >
            Calibrate ROM
          </button>

          <div className="flex flex-row gap-2 py-2">
            <div className="flex-grow border-t border-gray-300 my-2" />
            <span className="text-xs font-semibold text-center text-gray-600">System</span>
            <div className="flex-grow border-t border-gray-300 my-2" />
          </div>

          <button onClick={() => go('#/config')} className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer">
            Settings
          </button>
        </div>
        {!isCameraCalibrated && <span className="text-sm text-gray-400 text-center">Please calibrate the camera to proceed</span>}
        {!isROMCalibrated && isCameraCalibrated && <span className="text-sm text-gray-400 text-center">Please calibrate the ROM to proceed</span>}

        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFileChange} className="hidden" />
      </div>
    </div>
  );
};

export default Home;

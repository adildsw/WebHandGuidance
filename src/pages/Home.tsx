import { useRef } from 'react';
import { encodeBase64 } from '../utils/encoder';
import { go } from '../utils/navigation';

const Home = () => {
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

  return (
    <div className="w-screen h-screen flex items-center justify-center select-none">
      <div className="w-[360px] md:w-[420px] bg-white rounded-2xl shadow border border-gray-200 p-6 flex flex-col items-center gap-6">
        <h1 className="text-3xl tracking-tight text-gray-900">
          <span className="font-light">Web</span>
          <span className="font-extrabold">HandGuidance</span>
        </h1>

        <div className="w-full flex flex-col gap-3">
          <button onClick={openFile} className="w-full px-4 py-3 rounded-lg bg-gray-200 text-gray-900 font-bold hover:bg-gray-800 hover:text-white cursor-pointer">
            Start Study
          </button>

          <button onClick={() => go('#/create-study-tasks')} className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer">
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

          <div className="flex flex-row gap-2 py-2">
            <div className="flex-grow border-t border-gray-300 my-2" />
            <span className="text-xs font-semibold text-center text-gray-600">System</span>
            <div className="flex-grow border-t border-gray-300 my-2" />
          </div>

          <button onClick={() => go('#/config')} className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer">
            Settings
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFileChange} className="hidden" />
      </div>
    </div>
  );
};

export default Home;

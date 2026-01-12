import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { forceRoot, go } from '../../utils/navigation';
import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../../utils/context';
import { MM_TO_INCH } from '../../utils/constants';

const FrameCalibration = () => {
  const { setTestbedHeight, setTestbedWidth, config } = useConfig();
  const { devicePPI, devicePixelRatio } = config;

  const taskListRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const taskBarRef = useRef<HTMLDivElement>(null);
  const taskFormRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const tasks = [
    { type: '...', tag: '...' },
    { type: '...', tag: '...' },
    { type: '...', tag: '...' },
    { type: '...', tag: '...' },
  ];

  const [testbedDimensions, setTestbedDimensions] = useState<{ width: number; height: number }>({ width: window.innerWidth * 0.5, height: (window.innerWidth * 0.5) / (16 / 9) });
  const paddingThreshold = 0.75;

  // add timer value to show time remaining for calculation
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const TIME_COUNT = 3000; // 3 seconds

    useEffect(() => {
    const calculateAvailableDimensions = () => {
      const topBarHeight = topBarRef.current ? topBarRef.current.offsetHeight : 0;
      const taskBarHeight = taskBarRef.current ? taskBarRef.current.offsetHeight : 0;
      const taskFormHeight = taskFormRef.current ? taskFormRef.current.offsetHeight : 0;
      const footerHeight = footerRef.current ? footerRef.current.offsetHeight : 0;
      const taskListWidth = taskListRef.current ? taskListRef.current.offsetWidth : 0;

      const availableWidth = window.innerWidth - taskListWidth - 40;
      const availableHeight = window.innerHeight - topBarHeight - taskBarHeight - taskFormHeight - footerHeight - 40;

      const aspectRatio = 16 / 9;
      const widthBasedHeight = availableWidth / aspectRatio;
      const heightBasedWidth = availableHeight * aspectRatio;
      let w = heightBasedWidth;
      let h = widthBasedHeight;

      if (widthBasedHeight <= availableHeight) {
        w = availableWidth * paddingThreshold;
        h = widthBasedHeight * paddingThreshold;
      } else {
        w = heightBasedWidth * paddingThreshold;
        h = availableHeight * paddingThreshold;
      }
      setTestbedDimensions({ width: w, height: h });
      setTestbedWidth(Math.round((w * devicePixelRatio) / (MM_TO_INCH * devicePPI)));
      setTestbedHeight(Math.round((h * devicePixelRatio) / (MM_TO_INCH * devicePPI)));
    };

    const start = Date.now();
    setTimerStart(start);
    setNow(start);

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    const timeoutId = window.setTimeout(() => {
      calculateAvailableDimensions();
      setNow(Date.now());
      setTimerStart(null);
      forceRoot();
    }, TIME_COUNT);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [setTestbedHeight, setTestbedWidth, devicePPI, devicePixelRatio]);

  const remainingMs = timerStart === null ? 0 : Math.max(0, TIME_COUNT - (now - timerStart));
  const remainingS = Math.ceil(remainingMs / 1000);

  return (
    <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
      <div className="flex flex-row gap-4">
        {/* Task List Viewer */}
        <div ref={taskListRef} className="w-32 h-full fixed left-0 top-0 flex flex-col p-4">
          <div className="flex flex-col grow gap-2">
            <span className="p-1 py-2 items-center text-center text-xl font-bold bg-gray-800 text-white rounded-lg">███</span>

            {/* Task List */}
            <div className="flex flex-col grow border border-gray-200 rounded-lg gap-0 p-2">
              {tasks.map((task, i) => (
                <div key={i}>
                  <div className={'flex flex-col mb-2 rounded text-center font-semibold border border-gray-300 overflow-hidden bg-gray-600 text-white'}>
                    <div className="bg-gray-800 rounded-t flex flex-col gap-1">
                      <span className="text-white text-sm">...</span>
                    </div>
                    <span className="text-sm">{task.type}</span>
                    <span className="text-xs font-light overflow-hidden bg-gray-400 text-black">{task.tag}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Task List Rearrangement */}
            <div className="flex flex-row gap-2 justify-center">
              <button className={`grow py-1 bg-gray-300 rounded opacity-50`} disabled>
                <FontAwesomeIcon icon="square" />
              </button>
              <button className={`grow py-1 bg-gray-300 rounded opacity-50`} disabled>
                <FontAwesomeIcon icon="square" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2" style={{ width: `${testbedDimensions.width}px` }}>
          {/* Create Study Task Top Bar */}
          <div ref={topBarRef} className="w-full bg-gray-200 rounded-lg shadow flex items-center justify-between px-2 py-2">
            <div className="flex items-center px-1 gap-2">
              <span className="text-xl font-semibold">Frame Calibration</span>
            </div>
            <div className="flex flex-row gap-2">
              <input type="text" value={''} className=" rounded border border-gray-300 px-1 py-1 ml-2 text-sm italic shrink-1" disabled />

              <button title="Create New Study Task" className={`px-2 py-2 rounded text-lg bg-gray-300 items-center flex gap-1 font-bold`} disabled>
                <FontAwesomeIcon icon="square" />
              </button>
              <label title="Open Study Task" className="px-2 py-2 rounded text-lg bg-gray-300 items-center flex gap-1 font-bold">
                <FontAwesomeIcon icon="square" />
                <input type="file" accept=".json" className="hidden" disabled />
              </label>
              <button title="Copy Study Link" className={`px-3 py-2 rounded text-lg bg-gray-300 items-center flex gap-1 font-bold`} disabled>
                <FontAwesomeIcon icon="square" />
              </button>
              <button title="Save Study" className={`px-3 py-2 rounded text-lg bg-gray-300 items-center flex gap-1 font-bold`} disabled>
                <FontAwesomeIcon icon="square" />
              </button>
              <button title="Return To Home" className={`px-3 py-2 rounded text-lg bg-gray-300 items-center flex gap-1 font-bold`} onClick={() => go('#/')}>
                <FontAwesomeIcon icon="square" />
              </button>
            </div>
          </div>

          {/* Task Bar */}
          <div ref={taskBarRef} className="flex flex-col bg-white rounded-lg shadow border border-gray-100 ">
            {/* Task Navigator */}
            <div className="flex flex-row w-full justify-between items-center border-b border-gray-100 p-2 bg-gray-100">
              <button className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold opacity-50`} disabled>
                <FontAwesomeIcon icon="square" />
              </button>

              <span className="font-bold"></span>

              <div className="flex flex-row gap-2 items-center">
                <input className=" rounded border border-gray-300 px-1 py-1 ml-2 text-sm italic shrink-1" value={''} disabled />

                <div className="flex flex-col items-center justify-between">
                  <select className="text-center px-2 py-1 rounded border border-gray-300" value={''} disabled>
                    <option value=""></option>
                    <option value="HOLD">Hold</option>
                    <option value="ROM_MOVE">ROM Move</option>
                    <option value="ROM_HOLD">ROM Hold</option>
                    <option value="MEDIA">Media</option>
                  </select>
                </div>

                <button className={'px-2 py-2 rounded text-xs border border-gray-200 items-center flex gap-1 font-bold'} disabled>
                  <FontAwesomeIcon icon="square" />
                </button>
                <button className={`px-2 py-2 rounded text-xs border border-gray-200 items-center flex gap-1 font-bold opacity-50`} disabled>
                  <FontAwesomeIcon icon="square" />
                </button>
                <button className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold`} disabled>
                  <FontAwesomeIcon icon="square" />
                </button>
              </div>
            </div>
          </div>

          {/* Task Designer */}
          <div className="flex flex-col gap-2 items-center">
            {/* Task Form */}
            <div ref={taskFormRef} className="px-4 flex flex-row gap-2 overflow-auto p-2 bg-gray-100 rounded-lg w-full">
              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">████</label>
                <div className="flex flex-row gap-2">
                  <input className="w-48 px-2 py-1 rounded border border-gray-300 text-center" inputMode="text" value={''} disabled />

                  {/* Load Media Button */}
                  <button className={`w-16 px-2 py-1 text-white rounded bg-gray-600`} disabled>
                    <FontAwesomeIcon icon="square" />
                  </button>
                </div>
              </div>

              <div className="w-px bg-gray-300 mx-2" />

              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">████</label>
                <input className="w-48 px-2 py-1 rounded border border-gray-300 text-center" inputMode="text" value={''} disabled />
              </div>

              <div className="flex flex-col items-center justify-between grow">
                <label className="text-sm font-bold text-gray-600">████</label>
                <input className="flex w-full px-2 py-1 rounded border border-gray-300 text-center" inputMode="text" value={''} disabled />
              </div>
            </div>

            {/* Camera Feed */}
            <div
              className="md:col-span-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center relative"
              style={{ width: `${testbedDimensions.width}px`, height: `${testbedDimensions.height}px` }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200">
                <FontAwesomeIcon icon="spinner" spin className="text-6xl text-gray-400 mb-4" />
                <span className="text-gray-600 text-lg font-bold">Automatically Calibrating Frame</span>
                {/* <span className="text-gray-600">Please wait while the system automatically calibrates the frame dimension parameters.</span> */}
                {/* show countdown */}
                {timerStart !== null && <span className="text-gray-500 mt-2">{`Calculating in ${remainingS}s`}</span>}
              
              </div>
            </div>

            {/* Task Instructions */}
            <span ref={footerRef} className="w-full bg-gray-100 rounded-lg text-center text-sm text-gray-400 pt-2">
              <span className="font-bold rounded p-1">...</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrameCalibration;

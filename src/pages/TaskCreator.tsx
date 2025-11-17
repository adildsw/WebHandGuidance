import { useEffect, useState } from 'react';

import type { Task } from '../types/task';
import { useConfig } from '../utils/context';
import { MM_TO_INCH } from '../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import useDetection from '../hooks/useMediaPipeHandDetection';
import { go } from '../utils/navigation';
import toast from 'react-hot-toast';
import { encodeBase64 } from '../utils/encoder';
import MoveTaskDesigner from './subpages/MoveTaskDesigner';

const TaskCreator = () => {
  const { config, generateDefaultTask } = useConfig();
  const { devicePPI, devicePixelRatio, testbedWidthMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;

  const detection = useDetection(false);
  const { startWebcam } = detection;

  const [studyName, setStudyName] = useState<string>('unnamed_study');
  const [tasks, setTasks] = useState<Task[]>([generateDefaultTask()]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const newStudyTask = () => {
    setCurrentIndex(0);
    setTasks([generateDefaultTask()]);
  };

  const loadStudyTask = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result;
      if (typeof json === 'string') {
        const loadedTasks = JSON.parse(json);
        setTasks(loadedTasks);
      }
    };
    reader.readAsText(file);
  };

  const saveStudyTask = () => {
    const json = JSON.stringify(tasks);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = studyName + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const addTask = () => {
    const newTask = generateDefaultTask();
    setTasks((prev) => [...prev, newTask]);
    setCurrentIndex(tasks.length);
  };

  const resetTask = () => {
    const defaultTask = generateDefaultTask();
    setTasks((prev) => {
      const newTasks = [...prev];
      newTasks[currentIndex] = defaultTask;
      return newTasks;
    });
  };

  const deleteTask = () => {
    if (tasks.length === 0) return;
    const nextIndex = currentIndex === 0 ? 0 : currentIndex - 1;
    setCurrentIndex(nextIndex);
    setTasks((prev) => {
      const newTasks = [...prev];
      newTasks.splice(currentIndex, 1);
      return newTasks;
    });
  };

  const gotoPrevTask = () => {
    if (currentIndex <= 0) return;
    const idx = currentIndex - 1;
    setCurrentIndex(idx);
  };

  const gotoNextTask = () => {
    if (currentIndex >= tasks.length - 1) return;
    const idx = currentIndex + 1;
    setCurrentIndex(idx);
  };

  const getStudyLink = () => {
    const encoded = encodeBase64(JSON.stringify(tasks));
    const currentWebsiteBeforeHash = window.location.href.split('#')[0];
    return `${currentWebsiteBeforeHash}#/study?data=${encoded}`;
  };

  const copyStudyLink = () => {
    const encodedLink = getStudyLink();
    navigator.clipboard.writeText(encodedLink);
    toast.success('Study Link Copied to Clipboard!', {
      position: 'bottom-center',
      icon: '📋',
      style: {
        border: '1px solid #ccc',
      },
    });
  };

  const disablePrev = currentIndex <= 0;
  const atLast = currentIndex === tasks.length - 1 || tasks.length === 0;

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);

  const shiftTaskUp = (index: number) => {
    if (index <= 0) return;
    setTasks((prev) => {
      const newTasks = [...prev];
      const temp = newTasks[index];
      newTasks[index] = newTasks[index - 1];
      newTasks[index - 1] = temp;
      return newTasks;
    });
    setCurrentIndex(index - 1);
  };

  const shiftTaskDown = (index: number) => {
    if (index >= tasks.length - 1) return;
    setTasks((prev) => {
      const newTasks = [...prev];
      const temp = newTasks[index];
      newTasks[index] = newTasks[index + 1];
      newTasks[index + 1] = temp;
      return newTasks;
    });
    setCurrentIndex(index + 1);
  };

  return (
    <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
      <div className="flex flex-row gap-4">
        {/* Task List Viewer */}
        <div className="w-32 h-full fixed left-0 top-0 flex flex-col p-4">
          <div className="flex flex-col grow gap-2">
            <span className="p-1 py-2 items-center text-center text-xl font-bold bg-gray-800 text-white rounded-lg">Task List</span>

            {/* Task List */}
            <div className="flex flex-col grow border border-gray-200 rounded-lg gap-2 p-2">
              {tasks.map((task, index) => (
                <div
                  key={index}
                  className={
                    `flex flex-col py-2 rounded text-center font-semibold ` +
                    (index === currentIndex ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-400 cursor-pointer')
                  }
                  onClick={() => setCurrentIndex(index)}
                >
                  <span>{task.type}</span>
                  <span className="text-xs font-light">{task.tag}</span>
                </div>
              ))}
            </div>

            {/* Task List Rearrangement */}
            <div className="flex flex-row gap-2 justify-center">
              {/* two buttons or up and down */}
              <button
                onClick={() => shiftTaskUp(currentIndex)}
                className={`grow py-1 bg-gray-300 rounded hover:bg-gray-400 ` + (currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : '')}
                disabled={currentIndex === 0}
              >
                <FontAwesomeIcon icon="chevron-up" />
              </button>
              <button
                onClick={() => shiftTaskDown(currentIndex)}
                className={`grow py-1 bg-gray-300 rounded hover:bg-gray-400 ` + (currentIndex === tasks.length - 1 ? 'opacity-50 cursor-not-allowed' : '')}
                disabled={currentIndex === tasks.length - 1}
              >
                <FontAwesomeIcon icon="chevron-down" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2" style={{ width: `${testbedWidth}px` }}>
          {/* Create Study Task Top Bar */}
          <div className="w-full bg-gray-200 rounded-lg shadow flex items-center justify-between px-2 py-2">
            <div className="flex items-center px-1 gap-2">
              <span className="text-xl font-semibold">Study Task Designer</span>
            </div>
            <div className="flex flex-row gap-2">
              <input
                type="text"
                value={studyName}
                onChange={(e) => setStudyName(e.target.value)}
                className=" rounded border border-gray-300 px-1 py-1 ml-2 text-sm italic shrink-1"
              />

              <button
                title="Create New Study Task"
                className={`px-2 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`}
                onClick={newStudyTask}
              >
                <FontAwesomeIcon icon="file" />
              </button>
              <label title="Open Study Task" className="px-2 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold">
                <FontAwesomeIcon icon="folder-open" />
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      loadStudyTask(file);
                      setStudyName(file.name.replace('.json', ''));
                    }
                  }}
                  className="hidden"
                />
              </label>
              <button
                title="Copy Study Link"
                className={`px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`}
                onClick={copyStudyLink}
              >
                <FontAwesomeIcon icon="link" />
              </button>
              <button
                title="Save Study"
                className={`px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`}
                onClick={saveStudyTask}
              >
                <FontAwesomeIcon icon="save" />
              </button>
              <button
                title="Return To Home"
                className={`px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`}
                onClick={() => go('#/')}
              >
                <FontAwesomeIcon icon="home" />
              </button>
            </div>
          </div>

          {/* Task Bar */}
          <div className="flex flex-col bg-white rounded-lg shadow border border-gray-100 ">
            {/* Task Navigator */}
            <div className="flex flex-row w-full justify-between items-center border-b border-gray-100 p-2 bg-gray-100">
              <button
                className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold ${
                  disablePrev ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600 hover:text-white'
                }`}
                disabled={disablePrev}
                onClick={gotoPrevTask}
              >
                <FontAwesomeIcon icon="chevron-left" />
              </button>

              <span className="font-bold">Task #{currentIndex + 1}</span>

              <div className="flex flex-row gap-2 items-center">
                <input
                  className=" rounded border border-gray-300 px-1 py-1 ml-2 text-sm italic shrink-1"
                  value={tasks[currentIndex].tag}
                  onChange={(e) => {
                    const newTasks = [...tasks];
                    newTasks[currentIndex].tag = e.target.value;
                    setTasks(newTasks);
                  }}
                />

                <div className="flex flex-col items-center justify-between">
                  <select
                    className="text-center px-2 py-1 rounded border border-gray-300"
                    value={tasks[currentIndex].type}
                    onChange={(e) => {
                      setTasks((prev) => {
                        const newTasks = [...prev];
                        newTasks[currentIndex].type = e.target.value as 'MOVE' | 'HOLD' | 'ROM_MOVE' | 'ROM_HOLD' | 'MEDIA';
                        return newTasks;
                      });
                    }}
                  >
                    <option value="MOVE">Move</option>
                    <option value="HOLD">Hold</option>
                  </select>
                </div>

                <button
                  className={'px-2 py-2 rounded text-xs border border-gray-200 items-center flex gap-1 font-bold cursor-pointer hover:bg-gray-200'}
                  onClick={resetTask}
                  disabled={tasks.length === 0}
                >
                  <FontAwesomeIcon icon="redo" />
                </button>
                <button
                  className={`px-2 py-2 rounded text-xs border border-gray-200 items-center flex gap-1 font-bold ${
                    tasks.length <= 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-red-600 hover:text-white'
                  }`}
                  disabled={tasks.length <= 1}
                  onClick={deleteTask}
                >
                  <FontAwesomeIcon icon="trash" />
                </button>
                {atLast ? (
                  <button className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold cursor-pointer hover:bg-gray-600 hover:text-white`} onClick={addTask}>
                    <FontAwesomeIcon icon="plus" />
                  </button>
                ) : (
                  <button
                    className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold ${
                      atLast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600 hover:text-white'
                    }`}
                    disabled={atLast}
                    onClick={gotoNextTask}
                  >
                    <FontAwesomeIcon icon="chevron-right" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <MoveTaskDesigner currentIndex={currentIndex} tasks={tasks} setTasks={setTasks} detectionProp={detection} />
        </div>
      </div>
    </div>
  );
};

export default TaskCreator;

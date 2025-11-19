import { useEffect, useMemo, useState } from 'react';
import type { Task } from '../../types/task';
import { MM_TO_INCH } from '../../utils/constants';
import { useConfig } from '../../utils/context';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isValidMediaURL } from '../../utils/navigation';
type MediaTaskDesignerProps = {
  // tasks: Task[];
  task: Task;
  modifyTask: (newTask: Task) => void;
  // setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  // currentIndex: number;
};

const MediaTaskDesigner = ({ task, modifyTask }: MediaTaskDesignerProps) => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedWidthMM, testbedHeightMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;

  const taskType = task.type as 'MEDIA';
  const { mediaUrl, mediaTitle, mediaSubtitle } = useMemo(() => (task.mediaPayload), [task]);
  const isMediaVideo = mediaUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i);

  const [unloadedMediaUrl, setUnloadedMediaUrl] = useState<string>('');
  const [isMediaLoaded, setIsMediaLoaded] = useState<boolean>(false);

  const loadMedia = async () => {
    console.log('[MediaTaskDesigner] Loading media from URL:', unloadedMediaUrl);
    if (await isValidMediaURL(unloadedMediaUrl)) {
      const newTask = { ...task };
      newTask.mediaPayload.mediaUrl = unloadedMediaUrl;
      modifyTask(newTask);
      setIsMediaLoaded(true);
    } else {
      setIsMediaLoaded(false);
      alert('Invalid media URL. Please enter a valid URL.');
    }
  };

  useEffect(() => {
    const mediaOnLoad = async () => {
      const res = await isValidMediaURL(mediaUrl);
      if (res) {
        setIsMediaLoaded(true);
        setUnloadedMediaUrl(mediaUrl);
      } else {
        setIsMediaLoaded(false);
        setUnloadedMediaUrl('');
      }
    };
    mediaOnLoad();
  }, [mediaUrl]);

  useEffect(() => {
    if (mediaUrl !== unloadedMediaUrl) {
      setIsMediaLoaded(false);
    }
  }, [mediaUrl, unloadedMediaUrl]);

  if (taskType !== 'MEDIA') return <></>;

  return (
    <div className="flex flex-col gap-2 items-center">
      {/* Task Form */}
      <div className="px-4 flex flex-row gap-2 overflow-auto p-2 bg-gray-100 rounded-lg w-full">
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Media URL</label>
          <div className="flex flex-row gap-2">
            <input
              className="w-48 px-2 py-1 rounded border border-gray-300 text-center"
              inputMode="text"
              value={unloadedMediaUrl}
              placeholder='e.g., "https://example.com/media.mp4"'
              onChange={(e) => {
                setUnloadedMediaUrl(e.target.value);
              }}
            />

            {/* Load Media Button */}
            <button className={`w-16 px-2 py-1 text-white rounded` + (unloadedMediaUrl === mediaUrl && isMediaLoaded ? ' bg-green-700' : ' hover:bg-gray-800 cursor-pointer bg-gray-600')} onClick={loadMedia} disabled={unloadedMediaUrl === mediaUrl && isMediaLoaded}>
              {unloadedMediaUrl === mediaUrl && isMediaLoaded ? <FontAwesomeIcon icon="check" /> : <div>Load</div>}
            </button>
          </div>
        </div>

        <div className="w-px bg-gray-300 mx-2" />

        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Media Title</label>
          <input
            className="w-48 px-2 py-1 rounded border border-gray-300 text-center"
            inputMode="text"
            value={mediaTitle}
            placeholder='e.g., "Movement Task"'
            onChange={(e) => {
              const newTask = { ...task };
              newTask.mediaPayload.mediaTitle = e.target.value;
              modifyTask(newTask);
            }}
          />
        </div>

        <div className="flex flex-col items-center justify-between grow">
          <label className="text-sm font-bold text-gray-600">Media Subtitle</label>
          <input
            className="flex w-full px-2 py-1 rounded border border-gray-300 text-center"
            inputMode="text"
            value={mediaSubtitle}
            placeholder='e.g., "Please move your hand to the targets"'
            onChange={(e) => {
              // setTasks((prev) => {
              //   const newTasks = [...prev];
              //   newTasks[currentIndex].mediaPayload.mediaSubtitle = e.target.value;
              //   return newTasks;
              // });
              const newTask = { ...task };
              newTask.mediaPayload.mediaSubtitle = e.target.value;
              modifyTask(newTask);
            }}
          />
        </div>
      </div>

      {/* Camera Feed */}
      <div
        className="md:col-span-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center relative"
        style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}
      >
        {!isMediaLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200">
            <FontAwesomeIcon icon="file" className="text-6xl text-gray-400 mb-4" />
            <span className="text-gray-600 text-lg font-bold">No Media Loaded</span>
            <span className="text-gray-600">Please enter a valid media URL and click "Load"</span>
          </div>
        )}
        {isMediaVideo && isMediaLoaded ? (
          <video src={mediaUrl} className="w-full h-full object-cover" controls autoPlay />
        ) : (
          <img src={mediaUrl} alt={mediaTitle} className="w-full h-full object-contain" />
        )}
      </div>

      {/* Task Instructions */}
      <span className="text-center text-sm text-gray-400 pt-2">
        <span className="bg-gray-200 font-bold rounded p-1">Left Click</span> to Place Marker • <span className="bg-gray-200 font-bold rounded p-1">Left Click + Drag</span> to
        Reposition Marker • <span className="bg-gray-200 font-bold rounded p-1">Right Click</span> to Delete Marker
      </span>
    </div>
  );
};

export default MediaTaskDesigner;

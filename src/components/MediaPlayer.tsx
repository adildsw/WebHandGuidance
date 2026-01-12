import { useEffect, useRef, useState } from 'react';
import { MM_TO_INCH } from '../utils/constants';
import { useConfig } from '../utils/context';
import { forceRoot } from '../utils/navigation';

type MediaPlayerProps = {
  mediaUrl: string;
  mediaTitle: string;
  mediaSubtitle: string;
  doneCallback?: () => void;
  doneBtnTitle?: string;
  showHomeBtn?: boolean;
  isReplayMarkerVisible?: boolean;
  isContinueMarkerVisible?: boolean;
};

const MediaPlayer = ({
  mediaUrl,
  mediaTitle,
  mediaSubtitle,
  doneCallback,
  doneBtnTitle,
  showHomeBtn = false,
  isReplayMarkerVisible,
  isContinueMarkerVisible,
}: MediaPlayerProps) => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [actionStartTime, setActionStartTime] = useState<number | null>(null);
  // const timerRef = useRef<number | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const continueTimerRef = useRef<number | null>(null);
  const ACTION_TIMER = 2000;

  const isMediaVideo = mediaUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i);

  const actionProgress = (() => {
    if (!actionStartTime || (!replayTimerRef.current && !continueTimerRef.current)) return 0;
    const elapsed = Date.now() - actionStartTime;
    return Math.min(elapsed / ACTION_TIMER, 1);
  })();

  useEffect(() => {
    console.log(actionStartTime, replayTimerRef.current, continueTimerRef.current);
  }, [actionStartTime]);

  useEffect(() => {
    if (isReplayMarkerVisible && replayTimerRef.current === null) {
      console.log('Yes', ACTION_TIMER);
      setActionStartTime(Date.now());
      replayTimerRef.current = window.setTimeout(() => {
        replayVideo();
        replayTimerRef.current = null;
        setActionStartTime(null);
      }, ACTION_TIMER);
    } else if (!isReplayMarkerVisible && replayTimerRef.current != null) {
      console.log('STOPPED');
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
      setActionStartTime(null);
    }
  }, [isReplayMarkerVisible, ACTION_TIMER]);

  useEffect(() => {
    if (isContinueMarkerVisible && continueTimerRef.current === null && doneCallback) {
      setActionStartTime(Date.now());
      continueTimerRef.current = window.setTimeout(() => {
        if (doneCallback) doneCallback();
        continueTimerRef.current = null;
        setActionStartTime(null);
      }, ACTION_TIMER);
    } else if (!isContinueMarkerVisible && continueTimerRef.current != null) {
      clearTimeout(continueTimerRef.current);
      continueTimerRef.current = null;
      setActionStartTime(null);
    }
  }, [isContinueMarkerVisible, ACTION_TIMER, doneCallback]);

  const replayVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  };

  return (
    <div className="fixed top-0 left-0 bg-white z-99 w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
      <div className="w-full flex flex-col text-center gap-2">
        <h1 className="text-3xl font-bold">{mediaTitle}</h1>
        <p className="text-gray-500 text-md italic">{mediaSubtitle}</p>
      </div>

      {/* Media Feed */}
      <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
        <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg border border-gray-300 bg-black">
          {isMediaVideo ? (
            <video ref={videoRef} key={mediaUrl} src={mediaUrl} className="w-full h-full object-cover" autoPlay={true} playsInline controls loop />
          ) : (
            <img src={mediaUrl} alt={mediaTitle} className="w-full h-full object-contain" />
          )}
          <div className="absolute bottom-0 left-0 h-2 bg-blue-500 transition-all" style={{ width: `${actionProgress * 100}%`, transitionDuration: '100ms' }}></div>
        </div>
      </div>

      <div className="w-full flex flex-row justify-center gap-4">
        {isMediaVideo && (
          <button onClick={replayVideo} className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer">
            Replay Video
          </button>
        )}
        {doneCallback && (
          <button
            className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => doneCallback()}
          >
            {doneBtnTitle || 'Done'}
          </button>
        )}
        {showHomeBtn && (
          <button
            className="bg-gray-100 border border-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-800 hover:text-white cursor-pointer"
            onClick={() => forceRoot()}
          >
            Home
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaPlayer;
import { useRef } from 'react';
import { MM_TO_INCH } from '../utils/constants'; 
import { useConfig } from '../utils/context';
import { go } from '../utils/navigation';

type MediaPlayerProps = {
  mediaUrl: string;
  mediaTitle: string;
  mediaSubtitle: string;
  doneCallback?: () => void;
  doneBtnTitle?: string;
  showHomeBtn?: boolean;
};

const MediaPlayer = ({ mediaUrl, mediaTitle, mediaSubtitle, doneCallback, doneBtnTitle, showHomeBtn = false }: MediaPlayerProps) => {
  const { config } = useConfig();
  const { devicePPI, devicePixelRatio, testbedHeightMM, testbedWidthMM } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * MM_TO_INCH * factor;
  const testbedHeight = testbedHeightMM * MM_TO_INCH * factor;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isMediaVideo = mediaUrl.match(/\.(mp4|webm|ogg)(\?.*)?$/i);

  const replayVideo = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  };

  return (
    <div className="w-screen h-screen flex gap-4 flex-col items-center justify-center p-16 py-8">
      <div className="w-full flex flex-col text-center gap-2">
        <h1 className="text-3xl font-bold">{mediaTitle}</h1>
        <p className="text-gray-500 text-md italic">{mediaSubtitle}</p>
      </div>

      {/* Media Feed */}
      <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
        <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg border border-gray-300 bg-black">
          {isMediaVideo ? (
            <video ref={videoRef} key={mediaUrl} src={mediaUrl} className="w-full h-full object-cover" autoPlay playsInline controls />
          ) : (
            <img src={mediaUrl} alt={mediaTitle} className="w-full h-full object-contain" />
          )}
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
            onClick={() => go('/home')}
          >
            Home
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaPlayer;

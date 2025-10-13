import { useMemo, useState } from 'react';
import type { useWebSerial } from '../hooks/useWebSerial';

const SerialConnector = ({ webSerial }: { webSerial: ReturnType<typeof useWebSerial> }) => {
  const [isExapnded, setIsExpanded] = useState(false);
  const { connect, isConnected, isSupported, lastVibrationData } = webSerial;
  const imuVal = useMemo(() => webSerial.latestImuVal, [webSerial.latestImuVal]);

  if (!isConnected)
    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-row items-center">
        <span
          onClick={() => {
            if (isSupported) connect();
          }}
          className={`${!isSupported ? 'cursor-not-allowed' : 'cursor-pointer'} text-gray-400 text-sm font-bold p-1 border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-600 hover:border-gray-600`}
        >
          {isSupported ? 'Connect Device' : 'Web Serial Not Supported'}
        </span>
      </div>
    );

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExapnded ? (
        <div className="flex flex-col border border-green-600 rounded-lg">
          <div className="flex flex-row overflow-hidden">
            <span className="text-green-600 text-sm font-bold p-1">Device Connected</span>
            <span
              onClick={() => setIsExpanded(!isExapnded)}
              className="flex grow justify-center text-green-600 text-sm font-bold p-1 cursor-pointer border-l"
            >
              x
            </span>
          </div>
          <div className="text-green-600 text-sm font-mono p-1 border-t border-green-600">
            <div>ax: {imuVal.ax ? imuVal.ax.toFixed(2) : 'N/A'}</div>
            <div>ay: {imuVal.ay ? imuVal.ay.toFixed(2) : 'N/A'}</div>
            <div>az: {imuVal.az ? imuVal.az.toFixed(2) : 'N/A'}</div>
          </div>
          <div className="text-green-600 text-sm font-mono p-1 border-t border-green-600">
            <div>Up: {lastVibrationData.up}</div>
            <div>Down: {lastVibrationData.down}</div>
            <div>Left: {lastVibrationData.left}</div>
            <div>Right: {lastVibrationData.right}</div>
            {/* <div className="flex flex-col gap-4 border-r p-1">
              <span className="">Up</span>
              <span className="text-xs">{lastVibrationData.up}</span>
            </div>
            <span className="border-r p-1">Down</span>
            <span className="border-r p-1">Left</span>
            <span className="p-1">Right</span> */}
          </div>
        </div>
      ) : (
        <span
          onClick={() => setIsExpanded(!isExapnded)}
          className="bg-green-600 p-1 px-3 aspect-square rounded-full cursor-pointer hover:bg-green-800"
        >
        </span>
      )}
    </div>
  );
};

export default SerialConnector;

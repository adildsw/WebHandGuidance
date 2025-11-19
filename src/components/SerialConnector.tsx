import { useMemo, useState } from 'react';
import type useWebSerial from '../hooks/useWebSerial';
import type useBle from '../hooks/useBle';

const SerialConnector = ({ webSerial, ble }: { webSerial: ReturnType<typeof useWebSerial>; ble: ReturnType<typeof useBle> }) => {
  const [isExapnded, setIsExpanded] = useState(false);
  const { connect: webSerialConnect, isConnected: webSerialIsConnected, isSupported: webSerialIsSupported, lastVibrationData: webSerialLastVibrationData } = webSerial;
  const { connect: bleConnect, isConnected: bleIsConnected, isSupported: bleIsSupported, lastVibrationData: bleLastVibrationData } = ble;

  const imuVal = useMemo(() => {
    if (bleIsConnected) return ble.latestImuVal;
    else if (webSerialIsConnected) return webSerial.latestImuVal;
    else return { ax: null, ay: null, az: null };
  }, [webSerial.latestImuVal, ble.latestImuVal, webSerialIsConnected, bleIsConnected]);

  const lastVibrationData = useMemo(() => {
    if (bleIsConnected) return bleLastVibrationData;
    else if (webSerialIsConnected) return webSerialLastVibrationData;
    else return { up: 0, down: 0, left: 0, right: 0 };
  }, [webSerialLastVibrationData, bleLastVibrationData, webSerialIsConnected, bleIsConnected]);

  if (!webSerialIsConnected && !bleIsConnected)
    return (
      <div className='fixed bottom-4 right-4 z-50 flex flex-col gap-2 justify-end items-end'>
        <div className="flex flex-row items-center">
          <span
            onClick={() => {
              if (bleIsSupported) bleConnect();
            }}
            className={`${
              !bleIsSupported ? 'cursor-not-allowed' : 'cursor-pointer'
            } text-gray-400 text-md font-semibold p-1 border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-600 hover:border-gray-600`}
          >
            {bleIsSupported ? 'Connect BLE' : 'BLE Not Supported'}
          </span>
        </div>

        <div className="flex flex-row items-center">
          <span
            onClick={() => {
              if (webSerialIsSupported) webSerialConnect();
            }}
            className={`${
              !webSerialIsSupported ? 'cursor-not-allowed' : 'cursor-pointer'
            } text-gray-400 text-md font-semibold p-1 border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-600 hover:border-gray-600`}
          >
            {webSerialIsSupported ? 'Connect USB' : 'Web Serial Not Supported'}
          </span>
        </div>
      </div>
    );

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isExapnded ? (
        <div className="flex flex-col border border-green-600 rounded-lg">
          <div className="flex flex-row overflow-hidden">
            <span className="text-green-600 text-sm font-bold p-1">Device Connected</span>
            <span onClick={() => setIsExpanded(!isExapnded)} className="flex grow justify-center text-green-600 text-sm font-bold p-1 cursor-pointer border-l">
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
          </div>
        </div>
      ) : (
        <span onClick={() => setIsExpanded(!isExapnded)} className="bg-green-600 p-1 px-3 aspect-square rounded-full cursor-pointer hover:bg-green-800"></span>
      )}
    </div>
  );
};

export default SerialConnector;

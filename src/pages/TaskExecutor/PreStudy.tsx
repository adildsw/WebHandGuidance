import { useEffect, useRef, useState } from 'react';
import { decodeBase64 } from '../../utils/encoder';
import { uid } from 'uid/single';
import type useWebSerial from '../../hooks/useWebSerial';
import type useBle from '../../hooks/useBle';

const PreStudy = ({ webSerial, ble }: { webSerial: ReturnType<typeof useWebSerial>; ble: ReturnType<typeof useBle> }) => {
  const [participantId, setParticipantId] = useState<string>('');
  const [isTaskCorrupt, setIsTaskCorrupt] = useState(true);
  const [encodedData, setEncodedData] = useState<string>('');

  const [selectedDevice, setSelectedDevice] = useState<string>('None');
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (webSerial.isConnected) setSelectedDevice('USB Device');
    else if (ble.isConnected) setSelectedDevice('Bluetooth Device');
    else setSelectedDevice('None');
  }, [webSerial.isConnected, ble.isConnected]);

  // Play a short vibration on device connection
  useEffect(() => {
    const isConnected = webSerial.isConnected || ble.isConnected;
    const writeDirection = ble.isConnected ? ble.writeDirection : webSerial.writeDirection;

    if (isConnected && !wasConnectedRef.current) {
      // Device just connected - play 100ms vibration at 10%
      writeDirection(0.1, 0.1);
      setTimeout(() => writeDirection(0, 0), 200);
    }
    wasConnectedRef.current = isConnected;
  }, [webSerial.isConnected, ble.isConnected, webSerial.writeDirection, ble.writeDirection]);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const encoded = params.get('data');

    if (encoded) {
      try {
        const decoded = decodeBase64(encoded);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          // setTasks(parsed);
          setEncodedData(encoded);

          const pId = params.get('participantId');
          setParticipantId(pId || 'P-' + uid(5));

          // Initializing Task
          if (parsed.length === 0) setIsTaskCorrupt(true);
          setIsTaskCorrupt(false);
        }
      } catch {
        setIsTaskCorrupt(true);
      }
    }
  }, []);

  if (isTaskCorrupt)
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-4 gap-4">
        <div>
          <p className="text-red-600 font-bold text-center">ERROR: Unable to load tasks.</p>
          <p className="text-black italic text-center">Please ensure the task file is not corrupted and try again.</p>
        </div>

        <button onClick={() => window.location.replace('#/home')} className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100">
          Return to Home
        </button>
      </div>
    );

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-4 gap-4">
      <div className="w-128 flex flex-col gap-2">
        <span className="text-2xl font-bold">Welcome</span>
        <span className="text-lg text-gray-600 italic">
          <b>Step 1: </b> Enter your participant ID
        </span>
        <div className="grow flex flex-row gap-2 items-center pb-4">
          <label htmlFor="participantId" className="text-lg font-medium text-gray-700 ">
            Participant ID:
          </label>
          <input
            type="text"
            id="participantId"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            className="flex grow border border-gray-300 rounded-md p-2"
          />
        </div>

        {selectedDevice === 'None' ? (
          <>
            <span className="text-lg text-gray-600 italic">
              <b>Step 2: </b> No device connected. Select a device to connect:
            </span>
            <div className="w-128 flex flex-row gap-2 items-center pb-4">
              <button onClick={() => ble.connect()} className="grow px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer font-bold">
                Bluetooth Device
              </button>
              <button
                onClick={() => webSerial.connect()}
                className="grow px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-100 cursor-pointer font-bold"
              >
                USB Device
              </button>
            </div>
          </>
        ) : (
          <div className="w-128 flex flex-row gap-2 items-center pb-4">
            <span className="text-lg text-gray-600 italic"><b>Step 2: </b> {selectedDevice} Connected!</span>
          </div>
        )}

        <span className="text-lg text-gray-600 italic">
          <b>Step 3: </b> Start the study
        </span>
        <div className="w-128 flex flex-row gap-2 items-center pb-4">
          <button
            disabled={!participantId || selectedDevice === 'None'}
            onClick={() => window.location.replace(`#/camera-calibration?participantId=${participantId}&data=${encodedData}&homeEnabled=false`)}
            className={
              "grow px-4 py-2 text-white rounded-lg font-bold " + 
              (!participantId || selectedDevice === 'None'
                ? 'bg-gray-300 cursor-not-allowed'
                : 'border border-blue-700 bg-blue-600 hover:bg-blue-700 cursor-pointer') 
            }
          >
            Calibrate and Start Study
          </button>
          <button
            disabled={!participantId || selectedDevice === 'None'}
            onClick={() => window.location.replace(`#/study?participantId=${participantId}&data=${encodedData}`)}
            className={
              "grow px-4 py-2 text-white rounded-lg font-bold " + 
              (!participantId || selectedDevice === 'None'
                ? 'bg-gray-300 cursor-not-allowed'
                : 'border border-blue-700 bg-blue-600 hover:bg-blue-700 cursor-pointer') 
            }
          >
            Start Study
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreStudy;

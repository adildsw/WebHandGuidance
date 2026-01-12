import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { PolarPos, Pos, Task } from '../../types/task';
import { useConfig } from '../../utils/context';
import { INCH_TO_MM, MM_TO_INCH, SHOULDER_X_OFFSET, SHOULDER_Y_OFFSET, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { uid } from 'uid/single';
import useDetection from '../../hooks/useMediaPipeHandDetection';
import { decodeBase64 } from '../../utils/encoder';
import { closestPointOnLine, directionalMap, distance, polarToCartesian } from '../../utils/math';
import type { CollectedData, CollectedIMUData, CollectedRawData } from '../../types/datacollection';
import { forceRoot, go } from '../../utils/navigation';
import { downloadZip, toCSV } from '../../utils/datacollection';
import type useBle from '../../hooks/useBle';
import type useWebSerial from '../../hooks/useWebSerial';
import taskVisualizationSketch from './taskVisualizationSketch';
import MediaPlayer from '../../components/MediaPlayer';

const CLICK_SOUND = new Audio('./audio/click.mp3');
const BEEP_SOUND = new Audio('./audio/beep.mp3');

const Study = ({ webSerial, ble }: { webSerial: ReturnType<typeof useWebSerial>; ble: ReturnType<typeof useBle> }) => {
  const { config } = useConfig();
  const { devicePPI, worldPPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM, silParams, romCalibrationParams } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor * MM_TO_INCH;
  const testbedHeight = testbedHeightMM * factor * MM_TO_INCH;
  const markerDiameter = markerDiameterMM * factor * MM_TO_INCH;

  const silH = useMemo(() => SIL_IMG_HEIGHT * silParams.silScaleY, [silParams]);
  const silW = useMemo(() => SIL_IMG_WIDTH * silParams.silScaleX, [silParams]);
  const shoulderY = useMemo(() => silParams.silY + SHOULDER_Y_OFFSET * silH, [silParams, silH]);
  const leftShoulderX = useMemo(() => -SHOULDER_X_OFFSET * silW, [silW]);
  const rightShoulderX = useMemo(() => SHOULDER_X_OFFSET * silW, [silW]);

  // #region Handling Device Communication
  const { latestImuVal: webSerialLatestImuVal, writeDirection: webSerialWriteDirection, isConnected: webSerialIsConnected } = webSerial;
  const { latestImuVal: bleLatestImuVal, writeDirection: bleWriteDirection, isConnected: bleIsConnected } = ble;

  const latestImuVal = useMemo(() => {
    if (bleIsConnected) return bleLatestImuVal;
    else if (webSerialIsConnected) return webSerialLatestImuVal;
    else return { ax: null, ay: null, az: null };
  }, [bleLatestImuVal, webSerialLatestImuVal, bleIsConnected, webSerialIsConnected]);

  const writeDirection = useMemo(() => {
    if (bleIsConnected) return bleWriteDirection;
    else if (webSerialIsConnected) return webSerialWriteDirection;
    else return () => {};
  }, [bleWriteDirection, webSerialWriteDirection, bleIsConnected, webSerialIsConnected]);

  const isConnected = useMemo(() => {
    return webSerialIsConnected || bleIsConnected;
  }, [webSerialIsConnected, bleIsConnected]);
  // #endregion Handling Device Communication

  const { videoRef, error, loading, wristDetection, headShoulderDetection, startWebcam, detectedMarkers } = useDetection(true);
  const { leftWrist, rightWrist } = wristDetection;
  const { isReplayMarkerVisible, isContinueMarkerVisible } = detectedMarkers;

  const [participantId, setParticipantId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskCorrupt, setIsTaskCorrupt] = useState(false);

  const [currentTaskIndex, setCurrentTaskIndex] = useState<number | null>(null);
  const [currentTrial, setCurrentTrial] = useState<number | null>(null);
  const [currentRepetition, setCurrentRepetition] = useState<number | null>(null);

  //#region Derived Task Params
  const currentTask: Task | null = useMemo(() => (currentTaskIndex !== null && tasks.length > currentTaskIndex ? tasks[currentTaskIndex] : null), [tasks, currentTaskIndex]);

  const hand = useMemo<'Left' | 'Right'>(() => {
    if (currentTask === null || currentTask.type === 'MEDIA') return 'Right';
    if (currentTask.type === 'MOVE') return currentTask.movePayload.hand;
    if (currentTask.type === 'HOLD') return currentTask.holdPayload.hand;
    if (currentTask.type === 'ROM_MOVE') return currentTask.romMovePayload.hand;
    if (currentTask.type === 'ROM_HOLD') return currentTask.romHoldPayload.hand;
    return 'Right';
  }, [currentTask]);

  const distanceThreshold = useMemo<number>(() => {
    if (currentTask === null || currentTask.type === 'MEDIA') return 15;
    if (currentTask.type === 'MOVE') return currentTask.movePayload.distanceThreshold;
    if (currentTask.type === 'HOLD') return currentTask.holdPayload.distanceThreshold;
    if (currentTask.type === 'ROM_MOVE') return currentTask.romMovePayload.distanceThreshold;
    if (currentTask.type === 'ROM_HOLD') return currentTask.romHoldPayload.distanceThreshold;
    return 15;
  }, [currentTask]);

  const holdDuration = useMemo<number | null>(() => {
    if (currentTask === null) return null;
    if (currentTask.type === 'HOLD') return currentTask?.holdPayload.holdDuration || null;
    if (currentTask.type === 'ROM_HOLD') return currentTask?.romHoldPayload.holdDuration || null;
    return null;
  }, [currentTask]);

  const anchor = useMemo(() => {
    const anchor = hand === 'Left' ? { x: leftShoulderX, y: shoulderY } : { x: rightShoulderX, y: shoulderY };
    anchor.x = (anchor.x / worldPPI) * INCH_TO_MM;
    anchor.y = (anchor.y / worldPPI) * INCH_TO_MM;
    return anchor;
  }, [hand, leftShoulderX, rightShoulderX, shoulderY, worldPPI]);

  const repetitions = useMemo<number>(() => {
    if (currentTask === null || currentTask.type === 'MEDIA') return 1;
    if (currentTask.type === 'MOVE') return currentTask.movePayload.repetitions;
    if (currentTask.type === 'HOLD') return currentTask.holdPayload.repetitions;
    if (currentTask.type === 'ROM_MOVE') return currentTask.romMovePayload.repetitions;
    if (currentTask.type === 'ROM_HOLD') return currentTask.romHoldPayload.repetitions;
    return 1;
  }, [currentTask]);

  const trials = useMemo<number>(() => {
    if (currentTask === null || currentTask.type === 'MEDIA') return 1;
    if (currentTask.type === 'MOVE') return currentTask.movePayload.trials;
    if (currentTask.type === 'HOLD') return currentTask.holdPayload.trials;
    if (currentTask.type === 'ROM_MOVE') return currentTask.romMovePayload.trials;
    if (currentTask.type === 'ROM_HOLD') return currentTask.romHoldPayload.trials;
    return 1;
  }, [currentTask]);

  const markers = useMemo<Pos[]>(() => {
    if (currentTask === null) return [];
    if (currentTask.type === 'MEDIA') return [];
    if (currentTask.type === 'MOVE') return currentTask.movePayload.markers;
    if (currentTask.type === 'HOLD') return currentTask.holdPayload.markers;

    if (!romCalibrationParams) return [];
    const polarMarkers: PolarPos[] = currentTask.type === 'ROM_MOVE' ? currentTask.romMovePayload.markers : currentTask.romHoldPayload.markers;
    const maxRadius = hand === 'Left' ? romCalibrationParams.leftRadius : romCalibrationParams.rightRadius;
    console.log(polarMarkers);
    const m = polarMarkers.map((polar) => {
      const cartesian = polarToCartesian((polar.radius * maxRadius * INCH_TO_MM) / worldPPI, polar.angle, anchor);
      return { x: cartesian.x, y: cartesian.y };
    });
    console.log('Markers:', m);
    return m;
  }, [currentTask, anchor, hand, worldPPI, romCalibrationParams]);

  const isRepeating = useMemo<boolean>(() => {
    if (currentTask === null) return false;
    if (currentTask.type === 'MEDIA') return false;
    if (currentRepetition === null) return false;
    if (currentTask.type === 'MOVE' && currentRepetition < currentTask.movePayload.repetitions - 1) return true;
    if (currentTask.type === 'HOLD' && currentRepetition < currentTask.holdPayload.repetitions - 1) return true;
    if (currentTask.type === 'ROM_MOVE' && currentRepetition < currentTask.romMovePayload.repetitions - 1) return true;
    if (currentTask.type === 'ROM_HOLD' && currentRepetition < currentTask.romHoldPayload.repetitions - 1) return true;
    return false;
  }, [currentTask, currentRepetition]);
  //#endregion Derived Task Params

  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
  const [previousTarget, setPreviousTarget] = useState<number | null>(null);

  const activeWrist = useMemo<Pos | null>(() => {
    if (currentTask === null || currentTask.type === 'MEDIA') return null;
    if (hand === 'Left') return leftWrist;
    return rightWrist;
  }, [currentTask, hand, leftWrist, rightWrist]);

  const directionPoint = useMemo<Pos | null>(() => {
    if (currentTask === null || currentTask.type === 'MEDIA') return null;
    if (currentTarget === null) return null;
    if (currentTask.type === 'HOLD' || currentTask.type === 'ROM_HOLD') return markers[0];
    if (currentTarget === null || previousTarget === null) return null;
    if (activeWrist === null) return null;
    if (activeWrist.x === undefined || activeWrist.y === undefined) return null;

    const ax = (activeWrist.x * INCH_TO_MM) / worldPPI;
    const ay = (activeWrist.y * INCH_TO_MM) / worldPPI;
    const p1 = markers[previousTarget];
    const p2 = markers[currentTarget];
    return closestPointOnLine(ax, ay, p1.x, p1.y, p2.x, p2.y);
  }, [markers, currentTask, currentTarget, previousTarget, activeWrist, worldPPI]);

  const directionPointDistanceMM = useMemo<number>(() => {
    if (directionPoint === null || activeWrist === null) return 0;
    return distance(directionPoint.x, directionPoint.y, (activeWrist.x * INCH_TO_MM) / worldPPI, (activeWrist.y * INCH_TO_MM) / worldPPI);
  }, [directionPoint, activeWrist, worldPPI]);

  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const holdProgress = (() => {
    if (!taskStartTime) return 0;
    const elapsed = Date.now() - taskStartTime;
    const percent = Math.min(elapsed / (holdDuration || 1), 1);
    return percent;
  })();

  const isTaskRunning = useMemo<boolean>(() => {
    if (taskStartTime !== null) return true;
    return false;
  }, [taskStartTime]);
  const isStudyComplete = useMemo<boolean>(() => currentTaskIndex !== null && tasks !== null && currentTaskIndex === tasks.length, [currentTaskIndex, tasks]);

  const goHome = () => {
    if (window.confirm('Are you sure you want to return to the home page?')) go('#/');
  };

  //#region Data Collection
  const [isDataSent, setIsDataSent] = useState<boolean>(false);
  const [isDataSentSuccessfully, setIsDataSentSuccessfully] = useState<boolean>(false);

  const [collectedData, setCollectedData] = useState<CollectedData[]>([]);
  const [collectedRawData, setCollectedRawData] = useState<CollectedRawData[]>([]);
  const [collectedIMUData, setCollectedIMUData] = useState<CollectedIMUData[]>([]);

  const saveDataAsCSV = () => {
    if (collectedData.length === 0 || collectedRawData.length === 0) return;
    const dataCsv = toCSV<CollectedData>(collectedData, Object.keys(collectedData[0]) as (keyof CollectedData)[]);
    const rawDataCsv = toCSV<CollectedRawData>(collectedRawData, Object.keys(collectedRawData[0]) as (keyof CollectedRawData)[]);
    const imuDataCsv = collectedIMUData.length > 0 ? toCSV<CollectedIMUData>(collectedIMUData, Object.keys(collectedIMUData[0]) as (keyof CollectedIMUData)[]) : null;
    // const { dataCsv, rawDataCsv, imuDataCsv, task } = generateDataPackage()!;
    downloadZip('handguidance_' + (collectedIMUData.length > 0 ? 'imutrial_' : '') + participantId, dataCsv, rawDataCsv, imuDataCsv, JSON.stringify(tasks, null, 2));
  };

  useEffect(() => {
    if (!isStudyComplete || isDataSent || config.serverURL === '') return;
    const generateDataPackage = () => {
      if (collectedData.length === 0 || collectedRawData.length === 0) return null;
      return {
        dataCsv: toCSV<CollectedData>(collectedData, Object.keys(collectedData[0]) as (keyof CollectedData)[]),
        rawDataCsv: toCSV<CollectedRawData>(collectedRawData, Object.keys(collectedRawData[0]) as (keyof CollectedRawData)[]),
        imuDataCsv: collectedIMUData.length > 0 ? toCSV<CollectedIMUData>(collectedIMUData, Object.keys(collectedIMUData[0]) as (keyof CollectedIMUData)[]) : '',
        participantId,
        timestamp: new Date().toISOString(),
        task: JSON.stringify(tasks, null, 2),
      };
    };

    const dataPackage = generateDataPackage();
    if (dataPackage === null) return;

    fetch(config.serverURL + '/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataPackage),
    })
      .then((response) => {
        setIsDataSent(true);
        if (!response.ok) {
          setIsDataSentSuccessfully(false);
          console.error('Failed to send data');
        } else {
          setIsDataSentSuccessfully(true);
        }
      })
      .catch((error) => {
        setIsDataSent(true);
        console.error('Error sending data:', error);
      });
  }, [isStudyComplete, isDataSent, config.serverURL, collectedData, collectedRawData, collectedIMUData, participantId, tasks]);

  //#endregion Data Collection

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const encoded = params.get('data');

    if (encoded) {
      try {
        const decoded = decodeBase64(encoded);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          setTasks(parsed);

          let pId = params.get('participantId');
          if (!pId) pId = window.prompt('Enter Participant ID:');
          setParticipantId(pId || 'P-' + uid(5));

          // Initializing Task
          if (parsed.length === 0) setIsTaskCorrupt(true);
          else {
            setCurrentTaskIndex(0);
            setCurrentTrial(0);
            setCurrentRepetition(0);
            setIsTaskCorrupt(false);
          }
        }
      } catch {
        setIsTaskCorrupt(true);
      }
    }
  }, []);

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);

  // TASK INITIALIZER
  useEffect(() => {
    if (currentTaskIndex === null) return;
    if (isStudyComplete) return;
    setCurrentTarget(0);
    setPreviousTarget(null);
    setTaskStartTime(null);
  }, [tasks, currentTaskIndex, currentTrial, isStudyComplete]);

  const progressTask = useCallback(() => {
    console.log('Progressing Task...');
    if (currentTask === null) return;
    if (currentTarget === null) return;
    if (currentRepetition === null) return;
    if (currentTrial === null) return;
    if (currentTaskIndex === null) return;

    if (currentTarget < markers.length - 1) {
      setPreviousTarget(currentTarget);
      setCurrentTarget(currentTarget + 1);
      CLICK_SOUND.play();
    } else if (currentRepetition < repetitions - 1) {
      setCurrentRepetition(currentRepetition + 1);
      setPreviousTarget(currentTarget);
      setCurrentTarget(0);
      CLICK_SOUND.play();
    } else if (currentTrial < trials - 1) {
      setCurrentTrial(currentTrial + 1);
      setCurrentRepetition(0);
      setPreviousTarget(currentTarget);
      setCurrentTarget(0);
      BEEP_SOUND.play();
    } else {
      setCurrentTaskIndex(currentTaskIndex + 1);
      setCurrentTrial(0);
      setCurrentRepetition(0);
      setPreviousTarget(null);
      setCurrentTarget(0);
      BEEP_SOUND.play();
    }
  }, [currentTarget, currentRepetition, currentTrial, currentTaskIndex, currentTask, repetitions, trials, markers]);

  useEffect(() => {
    if (currentTaskIndex === null) return;
    if (currentTask === null) return;
    if (currentTask.type === 'MEDIA') return;
    if (currentTarget === null) return;
    if (currentRepetition === null) return;
    if (currentTrial === null) return;
    if (isStudyComplete) return;

    if (activeWrist === null) return;

    const ax = (activeWrist.x * INCH_TO_MM) / worldPPI;
    const ay = (activeWrist.y * INCH_TO_MM) / worldPPI;
    const cx = markers[currentTarget].x;
    const cy = markers[currentTarget].y;

    if (isConnected && directionPoint) {
      const px = directionPoint.x;
      const py = directionPoint.y;
      const dx = px - ax;
      const dy = py - ay;
      const vx = directionalMap(dx, config.minVibrationThresholdMM, config.maxVibrationThresholdMM);
      const vy = directionalMap(dy, config.minVibrationThresholdMM, config.maxVibrationThresholdMM);
      writeDirection(vx, vy);
    }

    const d = distance(ax, ay, cx, cy);
    if (taskStartTime !== null) {
      const unixTimestamp = Date.now();
      const elapsed = unixTimestamp - taskStartTime;
      const dataInstance: CollectedData = {
        unix_timestamp: unixTimestamp,
        time_sec: elapsed / 1000,
        participant_id: participantId,
        task_tag: currentTask.tag,
        task_type: currentTask.type,
        user_hand: hand,
        task_idx: currentTaskIndex,
        trial_idx: currentTrial,
        repetition_idx: currentRepetition,
        target_idx: currentTarget,
        target_x_mm: cx,
        target_y_mm: cy,
        target_threshold_mm: distanceThreshold,
        user_left_x_mm: ax,
        user_left_y_mm: ay,
        user_right_x_mm: ax,
        user_right_y_mm: ay,
        target_dist_mm: d,
      };
      const rawDataInstance: CollectedRawData = {
        unix_timestamp: unixTimestamp,
        time_sec: elapsed / 1000,
        participant_id: participantId,
        task_tag: currentTask.tag,
        task_type: currentTask.type,
        user_hand: hand,
        task_idx: currentTaskIndex,
        trial_idx: currentTrial,
        repetition_idx: currentRepetition,
        target_idx: currentTarget,
        target_x_px: cx * MM_TO_INCH * worldPPI,
        target_y_px: cy * MM_TO_INCH * worldPPI,
        target_threshold_px: distanceThreshold * MM_TO_INCH * worldPPI,
        user_left_x_px: ax * MM_TO_INCH * worldPPI,
        user_left_y_px: ay * MM_TO_INCH * worldPPI,
        user_right_x_px: ax * MM_TO_INCH * worldPPI,
        user_right_y_px: ay * MM_TO_INCH * worldPPI,
        target_dist_px: d * MM_TO_INCH * worldPPI,
        world_ppi: worldPPI,
        scaling_factor: MM_TO_INCH * worldPPI,
      };
      if (isConnected) {
        const imuDataInstance: CollectedIMUData = {
          unix_timestamp: unixTimestamp,
          time_sec: elapsed / 1000,
          participant_id: participantId,
          task_tag: currentTask.tag,
          task_type: currentTask.type,
          task_idx: currentTaskIndex,
          trial_idx: currentTrial,
          repetition_idx: currentRepetition,
          target_idx: currentTarget,
          ax: latestImuVal?.ax ?? null,
          ay: latestImuVal?.ay ?? null,
          az: latestImuVal?.az ?? null,
        };
        setCollectedIMUData((prev) => [...prev, imuDataInstance]);
      }
      setCollectedData((prev) => [...prev, dataInstance]);
      setCollectedRawData((prev) => [...prev, rawDataInstance]);
    }

    // Facilitating Task Progression
    if (d > distanceThreshold / 2) return;

    if (taskStartTime === null) {
      setTaskStartTime(Date.now());
      if (['HOLD', 'ROM_HOLD'].includes(currentTask.type) && holdDuration !== null) setTimeout(() => progressTask(), holdDuration);
    }
    if (['MOVE', 'ROM_MOVE'].includes(currentTask.type)) progressTask();
  }, [
    writeDirection,
    currentTask,
    currentTarget,
    activeWrist,
    currentTaskIndex,
    currentRepetition,
    currentTrial,
    worldPPI,
    taskStartTime,
    isStudyComplete,
    participantId,
    progressTask,
    latestImuVal,
    isConnected,
    config.minVibrationThresholdMM,
    config.maxVibrationThresholdMM,
    directionPoint,
    distanceThreshold,
    hand,
    markers,
    holdDuration,
  ]);

  if (participantId === '') {
    return (
      <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
        <p className="text-lg">Waiting for Participant ID...</p>
      </div>
    );
  }

  if (isStudyComplete)
    return (
      <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
        <div className="flex flex-col gap-2 items-center justify-center">
          <h1 className="text-2xl font-bold">Study Complete</h1>
          <p className="text-gray-600">Thank you for participating!</p>
          {isDataSent && !isDataSentSuccessfully && <p className="text-red-600 font-semibold">There was an error sending your data to the server.</p>}
          {isDataSent && isDataSentSuccessfully && <p className="text-green-600 font-semibold">Your data has been collected!</p>}
          <div className="flex flex-row gap-2">
            {collectedData.length !== 0 && collectedRawData.length !== 0 && (
              <button className="px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer" onClick={saveDataAsCSV}>
                <FontAwesomeIcon icon="download" className="mr-2" />
                Download Data
              </button>
            )}

            <button className="px-4 py-3 rounded-lg bg-gray-200 text-gray-900 font-bold hover:bg-gray-800 hover:text-white cursor-pointer" onClick={goHome}>
              <FontAwesomeIcon icon="home" className="mr-2" />
              Home
            </button>
          </div>
        </div>
      </div>
    );

  if (isTaskCorrupt)
    return (
      <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
        <p className="text-red-600 font-bold text-lg">[ERROR] Corrupt Task Data.</p>
      </div>
    );

  return (
    <>
      {currentTask && currentTask.type === 'MEDIA' && (
        <MediaPlayer
          mediaUrl={currentTask.mediaPayload.mediaUrl}
          mediaTitle={currentTask.mediaPayload.mediaTitle}
          mediaSubtitle={currentTask.mediaPayload.mediaSubtitle}
          showHomeBtn={false}
          doneBtnTitle="Continue"
          doneCallback={() => progressTask()}
          isReplayMarkerVisible={isReplayMarkerVisible}
          isContinueMarkerVisible={isContinueMarkerVisible}
        />
      )}
      <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
        {/* Task List Viewer */}
        <div className="w-32 h-full fixed left-0 top-0 flex flex-col p-4">
          <div className="flex flex-col grow gap-2">
            <span className="p-1 py-2 items-center text-center text-xl font-bold bg-gray-800 text-white rounded-lg">Task List</span>

            {/* Task List */}
            <div className="flex flex-col grow border border-gray-200 rounded-lg gap-0 p-2">
              {tasks.map((task, i) => (
                <div key={i}>
                  <div
                    className={
                      'flex flex-col mb-2 rounded text-center font-semibold border border-gray-300 overflow-hidden ' +
                      (i === currentTaskIndex ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800')
                    }
                  >
                    <div className="bg-gray-800 rounded-t flex flex-col gap-1">
                      <span className="text-white text-sm">Task #{i + 1}</span>
                    </div>
                    <span className="text-sm">{task.type}</span>
                    <span className="text-xs font-light overflow-hidden">{task.tag}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <button
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-800 cursor-pointer"
              onClick={() => {
                if (window.confirm('Are you sure you want to stop the study? All progress will be lost.')) {
                  forceRoot();
                }
              }}
            >
              <FontAwesomeIcon icon="stop" className="mr-2" />
              Stop Study
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2" style={{ width: `${testbedWidth}px` }}>
          {/* <div className="w-full bg-gray-200 rounded-lg shadow flex items-center justify-between px-2 py-2">
            <div className="flex items-center px-1 gap-2">
              <span className="text-xl font-semibold">Hand Guidance Study</span>
            </div>
            <div className="flex flex-row gap-2">
              <button className="px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold" onClick={goHome}>
                <FontAwesomeIcon icon="home" />
              </button>
            </div>
          </div> */}

          {/* <div className="flex flex-row gap-2">
            <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 justify-center">
              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">Status</label>
                <span className="w-42 px-2 py-1 text-center rounded font-semibold text-xl">{isTaskRunning ? 'Task Running' : 'Ready to Start'}</span>
              </div>
            </div>

            <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 ">
              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">User ID</label>
                <span className="px-2 py-1 text-center rounded font-semibold text-xl">{participantId}</span>
              </div>
            </div>

            <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 grow justify-between">
              <div className="flex flex-col h-full items-center justify-center grow">
                <label className="text-sm font-bold text-gray-600">Instruction</label>
                <span className="px-2 py-1 text-center rounded font-semibold text-lg">
                  {currentTask?.type === 'MOVE' ? (
                    <>
                      <span className="font-bold text-blue-800">Move</span> <span className="font-bold text-red-800 border p-1 rounded">{hand} Hand</span> to Target
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-blue-800">Hold</span> <span className="font-bold text-red-800 border p-1 rounded">{hand} Hand</span> Inside Target
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 ">
              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">Task</label>
                <span className="px-2 py-1 text-center rounded font-semibold text-xl">{currentTaskIndex !== null && currentTaskIndex + 1 + ' / ' + String(tasks.length)}</span>
              </div>
              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">Trials</label>
                <span className="px-2 py-1 text-center rounded font-semibold text-xl">
                  {currentTask && currentTrial !== null ? currentTrial + 1 + ' / ' + String(trials) : '-'}
                </span>
              </div>

              <div className="flex flex-col items-center justify-between">
                <label className="text-sm font-bold text-gray-600">Repetitions</label>
                <span className="px-2 py-1 text-center rounded font-semibold text-xl">
                  {currentTask && currentRepetition !== null ? currentRepetition + 1 + ' / ' + String(repetitions) : '-'}
                </span>
              </div>
            </div>
          </div> */}

          <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
            <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
              {!error && !loading && (
                <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover ${isTaskCorrupt && 'blur'}`} style={{ transform: 'scaleX(-1)' }} />
              )}
              <div className="absolute inset-0">
                <ReactP5Wrapper
                  sketch={taskVisualizationSketch}
                  frameWidth={testbedWidth}
                  frameHeight={testbedHeight}
                  markerDiameter={markerDiameter}
                  worldPPI={worldPPI}
                  type={currentTask?.type || 'MOVE'}
                  distanceThreshold={distanceThreshold}
                  markers={markers}
                  isRepeating={isRepeating}
                  hand={hand}
                  activeWristPos={activeWrist}
                  currentTarget={currentTarget}
                  currentRepetition={currentRepetition}
                  isTaskRunning={isTaskRunning}
                  holdProgress={holdProgress}
                  directionPoint={directionPoint}
                  directionPointDistanceMM={directionPointDistanceMM}
                  config={config}
                  headShoulderDetection={headShoulderDetection}
                  silParams={silParams}
                />

                {/* add trial number text in the bottom left */}
                <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-50 text-white px-3 py-1 rounded-lg text-4xl font-semibold border border-white">
                  {currentTask && currentTrial !== null && currentRepetition !== null && (
                    <>
                      Trial: {currentTrial + 1} / {trials}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <span className="text-center text-md text-gray-500">
            {!isTaskRunning && (
              <>
                <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">Move {hand} Hand</kbd> Inside the <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Red Circle</kbd>{' '}
                to Begin Task
              </>
            )}
            {isTaskRunning && ['MOVE', 'ROM_MOVE'].includes(currentTask?.type || '') && (
              <>
                Follow the <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Red Circle</kbd> with Your{' '}
                <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">{hand} Hand</kbd>
              </>
            )}
            {isTaskRunning && ['HOLD', 'ROM_HOLD'].includes(currentTask?.type || '') && (
              <>
                Keep Your <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">{hand} Hand</kbd> Steady Inside the{' '}
                <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Red Circle</kbd> for{' '}
                <span className="font-bold text-red-600">{Math.ceil(((1 - holdProgress) * (holdDuration || 1)) / 1000)} more seconds</span>
              </>
            )}
          </span>
        </div>
      </div>
    </>
  );
};

export default Study;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import JSZip from 'jszip';
import { downloadZip, toCSV } from '../../utils/datacollection';
import type useBle from '../../hooks/useBle';
import type useWebSerial from '../../hooks/useWebSerial';
import taskVisualizationSketch from './taskVisualizationSketch';
import MediaPlayer from '../../components/MediaPlayer';
import ModelLoadingOverlay from '../../components/ModelLoadingOverlay';
import CameraSelector from '../../components/CameraSelector';

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

  const { videoRef, error, modelsLoading, wristDetection, headShoulderDetection, startWebcam, detectedMarkers, availableCameras, selectedCameraId, selectCamera } = useDetection(true);
  const { leftWrist, rightWrist } = wristDetection;
  const { isReplayMarkerVisible, isContinueMarkerVisible } = detectedMarkers;

  const [participantId, setParticipantId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskCorrupt, setIsTaskCorrupt] = useState(false);

  const [currentTaskIndex, setCurrentTaskIndex] = useState<number | null>(null);
  const [currentTrial, setCurrentTrial] = useState<number | null>(null);
  const [currentRepetition, setCurrentRepetition] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isStopConfirmVisible, setIsStopConfirmVisible] = useState<boolean>(false);

  // Marker-based pause/resume
  const PAUSE_MARKER_DURATION = 6000; // 6 seconds
  const pauseMarkerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pauseMarkerStartTime, setPauseMarkerStartTime] = useState<number | null>(null);
  const [pauseMarkerProgress, setPauseMarkerProgress] = useState<number>(0);

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
    if (currentTask.type === 'HOLD' || currentTask.type === 'ROM_HOLD') return markers[0] ?? null;
    if (activeWrist === null) return null;
    if (activeWrist.x === undefined || activeWrist.y === undefined) return null;

    // For the first target (when previousTarget is null), guide directly to the target
    if (previousTarget === null) {
      return markers[currentTarget] ?? null;
    }

    const ax = (activeWrist.x * INCH_TO_MM) / worldPPI;
    const ay = (activeWrist.y * INCH_TO_MM) / worldPPI;
    const p1 = markers[previousTarget];
    const p2 = markers[currentTarget];
    if (!p1 || !p2) return null;
    return closestPointOnLine(ax, ay, p1.x, p1.y, p2.x, p2.y);
  }, [markers, currentTask, currentTarget, previousTarget, activeWrist, worldPPI]);

  const directionPointDistanceMM = useMemo<number>(() => {
    if (!directionPoint || !activeWrist) return 0;
    return distance(directionPoint.x, directionPoint.y, (activeWrist.x * INCH_TO_MM) / worldPPI, (activeWrist.y * INCH_TO_MM) / worldPPI);
  }, [directionPoint, activeWrist, worldPPI]);

  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdProgress = (() => {
    if (!taskStartTime) return 0;
    const elapsed = Date.now() - taskStartTime;
    const percent = Math.min(elapsed / (holdDuration || 1), 1);
    return percent;
  })();

  const isInsideTarget = activeWrist !== null && markers.length > 0 && currentTarget !== -1 && currentTarget !== null && markers[currentTarget] !== undefined &&
    distance((activeWrist.x * INCH_TO_MM) / worldPPI, (activeWrist.y * INCH_TO_MM) / worldPPI, markers[currentTarget].x, markers[currentTarget].y) < distanceThreshold / 2;

  const isTaskRunning = useMemo<boolean>(() => {
    if (taskStartTime !== null) return true;
    return false;
  }, [taskStartTime]);
  const isStudyComplete = useMemo<boolean>(() => currentTaskIndex !== null && tasks !== null && currentTaskIndex === tasks.length, [currentTaskIndex, tasks]);

  const goHome = () => {
    if (window.confirm('Are you sure you want to return to the home page?')) go('#/');
  };

  const togglePauseStudy = useCallback(() => {
    if (currentTask?.type === 'MEDIA') return;
    const unixTimestamp = Date.now();
    const taskTag = currentTask?.tag || (isPaused ? 'RESUMED' : 'PAUSED');
    const taskType = isPaused ? 'RESUMED' : 'PAUSED';

    // Create data entries
    const dataInstance: CollectedData = {
      unix_timestamp: unixTimestamp,
      time_sec: -1,
      participant_id: participantId,
      task_tag: taskTag,
      task_type: taskType,
      user_hand: hand,
      task_idx: currentTaskIndex ?? -1,
      trial_idx: currentTrial ?? -1,
      repetition_idx: currentRepetition ?? -1,
      target_idx: currentTarget ?? -1,
      target_x_mm: -1,
      target_y_mm: -1,
      target_threshold_mm: -1,
      user_left_x_mm: -1,
      user_left_y_mm: -1,
      user_right_x_mm: -1,
      user_right_y_mm: -1,
      target_dist_mm: -1,
      haptic: 0,
    };
    const rawDataInstance: CollectedRawData = {
      unix_timestamp: unixTimestamp,
      time_sec: -1,
      participant_id: participantId,
      task_tag: taskTag,
      task_type: taskType,
      user_hand: hand,
      task_idx: currentTaskIndex ?? -1,
      trial_idx: currentTrial ?? -1,
      repetition_idx: currentRepetition ?? -1,
      target_idx: currentTarget ?? -1,
      target_x_px: -1,
      target_y_px: -1,
      target_threshold_px: -1,
      user_left_x_px: -1,
      user_left_y_px: -1,
      user_right_x_px: -1,
      user_right_y_px: -1,
      target_dist_px: -1,
      world_ppi: worldPPI,
      scaling_factor: MM_TO_INCH * worldPPI,
      haptic: 0,
    };
    const imuDataInstance: CollectedIMUData = {
      unix_timestamp: unixTimestamp,
      time_sec: -1,
      participant_id: participantId,
      task_tag: taskTag,
      task_type: taskType,
      task_idx: currentTaskIndex ?? -1,
      trial_idx: currentTrial ?? -1,
      repetition_idx: currentRepetition ?? -1,
      target_idx: currentTarget ?? -1,
      ax: latestImuVal?.ax ?? null,
      ay: latestImuVal?.ay ?? null,
      az: latestImuVal?.az ?? null,
    };

    // Add to full study data
    setCollectedData((prev) => [...prev, dataInstance]);
    setCollectedRawData((prev) => [...prev, rawDataInstance]);
    setCollectedIMUData((prev) => [...prev, imuDataInstance]);
    // Add to current task data
    setCurrentTaskData((prev) => [...prev, dataInstance]);
    setCurrentTaskRawData((prev) => [...prev, rawDataInstance]);
    setCurrentTaskIMUData((prev) => [...prev, imuDataInstance]);

    if (isPaused) {
      // Resume: reset current repetition and target to start of task
      setCurrentRepetition(0);
      setCurrentTarget(0);
      setPreviousTarget(null);
      setTaskStartTime(null);
      setIsPaused(false);
    } else {
      // Cancel hold timer if running
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setIsPaused(true);
    }
  }, [currentTask?.tag, isPaused, participantId, hand, currentTaskIndex, currentTrial, currentRepetition, currentTarget, worldPPI, latestImuVal, currentTask?.type]);

  const showStopConfirmation = useCallback(() => {
    if (!isPaused) {
      togglePauseStudy(); // This will pause and stop haptic feedback
    }
    setIsStopConfirmVisible(true);
  }, [isPaused, togglePauseStudy]);

  const cancelStopConfirmation = useCallback(() => {
    setIsStopConfirmVisible(false);
    togglePauseStudy(); // Resume the study
  }, [togglePauseStudy]);

  const confirmStopStudy = useCallback(() => {
    forceRoot();
  }, []);

  // Handle continue marker for pause/resume toggle
  useEffect(() => {
    if (currentTask?.type === 'MEDIA') return;
    if (isContinueMarkerVisible && pauseMarkerTimerRef.current === null) {
      // Start the timer when marker becomes visible
      setPauseMarkerStartTime(Date.now());
      pauseMarkerTimerRef.current = setTimeout(() => {
        togglePauseStudy();
        pauseMarkerTimerRef.current = null;
        setPauseMarkerStartTime(null);
        setPauseMarkerProgress(0);
      }, PAUSE_MARKER_DURATION);
    } else if (!isContinueMarkerVisible && pauseMarkerTimerRef.current !== null) {
      // Cancel the timer when marker is no longer visible
      clearTimeout(pauseMarkerTimerRef.current);
      pauseMarkerTimerRef.current = null;
      setPauseMarkerStartTime(null);
      setPauseMarkerProgress(0);
    }
  }, [isContinueMarkerVisible, PAUSE_MARKER_DURATION, togglePauseStudy, currentTask?.type]);

  // Update progress bar animation
  useEffect(() => {
    if (pauseMarkerStartTime === null) return;

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - pauseMarkerStartTime;
      const progress = Math.min(elapsed / PAUSE_MARKER_DURATION, 1);
      setPauseMarkerProgress(progress);
    }, 50);

    return () => clearInterval(intervalId);
  }, [pauseMarkerStartTime, PAUSE_MARKER_DURATION]);

  //#region Data Collection
  const [isDataSent, setIsDataSent] = useState<boolean>(false);
  const [isDataSentSuccessfully, setIsDataSentSuccessfully] = useState<boolean>(false);

  // Full study data (accumulated across all tasks)
  const [collectedData, setCollectedData] = useState<CollectedData[]>([]);
  const [collectedRawData, setCollectedRawData] = useState<CollectedRawData[]>([]);
  const [collectedIMUData, setCollectedIMUData] = useState<CollectedIMUData[]>([]);

  // Current task data (reset after each task upload)
  const [currentTaskData, setCurrentTaskData] = useState<CollectedData[]>([]);
  const [currentTaskRawData, setCurrentTaskRawData] = useState<CollectedRawData[]>([]);
  const [currentTaskIMUData, setCurrentTaskIMUData] = useState<CollectedIMUData[]>([]);

  // Refs to always get latest task data (avoids stale closure in setTimeout)
  const currentTaskDataRef = useRef<CollectedData[]>([]);
  const currentTaskRawDataRef = useRef<CollectedRawData[]>([]);
  const currentTaskIMUDataRef = useRef<CollectedIMUData[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    currentTaskDataRef.current = currentTaskData;
  }, [currentTaskData]);
  useEffect(() => {
    currentTaskRawDataRef.current = currentTaskRawData;
  }, [currentTaskRawData]);
  useEffect(() => {
    currentTaskIMUDataRef.current = currentTaskIMUData;
  }, [currentTaskIMUData]);

  const uploadTaskData = useCallback(
    (taskIdx: number, taskTag: string, task: Task) => {
      if (config.serverURL === '') return;

      // Read from refs to get latest data (avoids stale closure issue)
      const taskData = currentTaskDataRef.current;
      const taskRawData = currentTaskRawDataRef.current;
      const taskIMUData = currentTaskIMUDataRef.current;

      if (taskData.length === 0 && taskRawData.length === 0) return;

      const dataCsv = taskData.length > 0 ? toCSV<CollectedData>(taskData, Object.keys(taskData[0]) as (keyof CollectedData)[]) : '';
      const rawDataCsv = taskRawData.length > 0 ? toCSV<CollectedRawData>(taskRawData, Object.keys(taskRawData[0]) as (keyof CollectedRawData)[]) : '';
      const imuDataCsv = taskIMUData.length > 0 ? toCSV<CollectedIMUData>(taskIMUData, Object.keys(taskIMUData[0]) as (keyof CollectedIMUData)[]) : '';
      const timestamp = new Date().toISOString();
      const taskStr = JSON.stringify(task, null, 2);

      const taskInfo = { participant_id: participantId, task_tag: taskTag, task_idx: taskIdx, timestamp };

      // 1. Get presigned URL from server
      fetch(config.serverURL + '/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, taskTag, taskIdx, timestamp }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to get upload URL');
          return res.json();
        })
        .then(async ({ uploadUrl }) => {
          // 2. Create zip client-side
          const zip = new JSZip();
          if (dataCsv.trim()) zip.file('data.csv', dataCsv);
          if (rawDataCsv.trim()) zip.file('rawData.csv', rawDataCsv);
          if (imuDataCsv.trim()) zip.file('imuData.csv', imuDataCsv);
          if (taskStr.trim()) zip.file('task.json', taskStr);
          zip.file('task_info.json', JSON.stringify(taskInfo));
          const blob = await zip.generateAsync({ type: 'blob' });

          // 3. Upload directly to S3 via presigned URL
          const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/zip' },
            body: blob,
          });
          if (!putRes.ok) throw new Error('S3 upload failed');
          console.log('Task data uploaded successfully for task:', taskTag);
        })
        .catch((error) => {
          console.error('Error uploading task data:', error);
        });

      // Reset current task data after upload
      setCurrentTaskData([]);
      setCurrentTaskRawData([]);
      setCurrentTaskIMUData([]);
      currentTaskDataRef.current = [];
      currentTaskRawDataRef.current = [];
      currentTaskIMUDataRef.current = [];
    },
    [config.serverURL, participantId],
  );

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
    if (collectedData.length === 0 || collectedRawData.length === 0) return;

    const dataCsv = toCSV<CollectedData>(collectedData, Object.keys(collectedData[0]) as (keyof CollectedData)[]);
    const rawDataCsv = toCSV<CollectedRawData>(collectedRawData, Object.keys(collectedRawData[0]) as (keyof CollectedRawData)[]);
    const imuDataCsv = collectedIMUData.length > 0 ? toCSV<CollectedIMUData>(collectedIMUData, Object.keys(collectedIMUData[0]) as (keyof CollectedIMUData)[]) : '';
    const timestamp = new Date().toISOString();
    const taskStr = JSON.stringify(tasks, null, 2);
    const taskTag = 'fulldata';
    const taskIdx = -1;

    const participationInfo = { participant_id: participantId, timestamp };

    fetch(config.serverURL + '/get-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, taskTag, taskIdx, timestamp }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to get upload URL');
        return res.json();
      })
      .then(async ({ uploadUrl }) => {
        const zip = new JSZip();
        zip.file('data.csv', dataCsv);
        zip.file('rawData.csv', rawDataCsv);
        if (imuDataCsv.trim()) zip.file('imuData.csv', imuDataCsv);
        zip.file('task.json', taskStr);
        zip.file('participation_info.json', JSON.stringify(participationInfo));
        const blob = await zip.generateAsync({ type: 'blob' });

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/zip' },
          body: blob,
        });
        if (!putRes.ok) throw new Error('S3 upload failed');

        setIsDataSent(true);
        setIsDataSentSuccessfully(true);
      })
      .catch((error) => {
        setIsDataSent(true);
        setIsDataSentSuccessfully(false);
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
      // Upload current task data before moving to next task
      if (currentTask.type !== 'MEDIA') {
        uploadTaskData(currentTaskIndex, currentTask.tag, currentTask);
      }
      setCurrentTaskIndex(currentTaskIndex + 1);
      setCurrentTrial(0);
      setCurrentRepetition(0);
      setPreviousTarget(null);
      setCurrentTarget(0);
      BEEP_SOUND.play();
    }
  }, [currentTarget, currentRepetition, currentTrial, currentTaskIndex, currentTask, repetitions, trials, markers, uploadTaskData]);

  useEffect(() => {
    if (
      currentTaskIndex === null ||
      currentTask === null ||
      currentTask.type === 'MEDIA' ||
      currentTarget === null ||
      currentRepetition === null ||
      currentTrial === null ||
      isStudyComplete ||
      isPaused ||
      activeWrist === null
    ) {
      if (isConnected) writeDirection(0, 0);
      return;
    }

    const targetMarker = markers[currentTarget];
    if (!targetMarker) {
      if (isConnected) writeDirection(0, 0);
      return;
    }
    const ax = (activeWrist.x * INCH_TO_MM) / worldPPI;
    const ay = (activeWrist.y * INCH_TO_MM) / worldPPI;
    const cx = targetMarker.x;
    const cy = targetMarker.y;

    let hapticActive: 0 | 1 = 0;
    if (isConnected && directionPoint && !isPaused) {
      const px = directionPoint.x;
      const py = directionPoint.y;
      const dx = px - ax;
      const dy = py - ay;
      const vx = directionalMap(dx, config.minVibrationThresholdMM, config.maxVibrationThresholdMM);
      const vy = directionalMap(dy, config.minVibrationThresholdMM, config.maxVibrationThresholdMM);
      writeDirection(vx, vy);
      hapticActive = (vx !== 0 || vy !== 0) ? 1 : 0;
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
        haptic: hapticActive,
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
        haptic: hapticActive,
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
        setCurrentTaskIMUData((prev) => [...prev, imuDataInstance]);
      }
      // Add to full study data
      setCollectedData((prev) => [...prev, dataInstance]);
      setCollectedRawData((prev) => [...prev, rawDataInstance]);
      // Add to current task data
      setCurrentTaskData((prev) => [...prev, dataInstance]);
      setCurrentTaskRawData((prev) => [...prev, rawDataInstance]);
    }

    // Facilitating Task Progression
    if (d > distanceThreshold / 2) return;

    if (taskStartTime === null) {
      setTaskStartTime(Date.now());
      if (['HOLD', 'ROM_HOLD'].includes(currentTask.type) && holdDuration !== null) {
        holdTimerRef.current = setTimeout(() => progressTask(), holdDuration);
      }
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
    isPaused,
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
        <div className="w-32 h-full fixed left-0 top-0 flex flex-col p-4 overflow-auto">
          <div className="flex flex-col grow gap-2 overflow-auto">
            <span className="p-1 py-2 items-center text-center text-xl font-bold bg-gray-800 text-white rounded-lg">Task List</span>

            {/* Task List */}
            <div className="flex flex-col grow border border-gray-200 rounded-lg gap-0 p-2 overflow-auto">
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
              disabled={currentTask?.type === 'MEDIA'}
              className={`flex flex-row gap-2 items-center justify-center px-4 py-2 rounded-lg font-bold ${
                currentTask?.type === 'MEDIA'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : isPaused
                    ? 'bg-green-600 text-white hover:bg-green-800 cursor-pointer'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer'
              }`}
              onClick={togglePauseStudy}
            >
              <FontAwesomeIcon icon={isPaused ? 'play' : 'pause'} className="mr-2" size='sm' />
              {isPaused ? 'Resume Study' : 'Pause Study'}
            </button>
            <button
              className="flex flex-row gap-2 items-center justify-center px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-800 cursor-pointer"
              onClick={showStopConfirmation}
            >
              <FontAwesomeIcon icon="stop" className="mr-2" size='sm' />
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
              <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover ${isTaskCorrupt && 'blur'}`} style={{ transform: 'scaleX(-1)' }} />
              <ModelLoadingOverlay visible={modelsLoading && !error} errorMessage={error} />
              <CameraSelector availableCameras={availableCameras} selectedCameraId={selectedCameraId} onSelectCamera={selectCamera} />
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

                {/* Trial Number */}
                <div className="absolute bottom-2 left-2 bg-gray-800 bg-opacity-50 text-white px-3 py-1 rounded-lg text-xl font-semibold border border-white">
                  {currentTask && currentTrial !== null && currentRepetition !== null && (
                    <>
                      Trial: {currentTrial + 1} / {trials}
                    </>
                  )}
                </div>

                {/* Pause overlay */}
                {isPaused && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-10">
                    {isStopConfirmVisible ? (
                      <div className="text-white text-4xl font-bold flex flex-col items-center gap-4">
                        <FontAwesomeIcon icon="stop" className="text-6xl text-red-500" />
                        <span>Stop Study?</span>
                        <span className="text-lg font-normal text-gray-300">All progress will be lost.</span>
                        <div className="flex flex-row gap-4 mt-4">
                          <button
                            className="px-6 py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 cursor-pointer text-xl"
                            onClick={cancelStopConfirmation}
                          >
                            <FontAwesomeIcon icon="play" className="mr-2" />
                            Continue Study
                          </button>
                          <button
                            className="px-6 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 cursor-pointer text-xl"
                            onClick={confirmStopStudy}
                          >
                            <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
                            Stop Study
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-white text-4xl font-bold flex flex-col items-center gap-4">
                        <FontAwesomeIcon icon="pause" className="text-6xl" />
                        <span>Study Paused</span>
                        {pauseMarkerStartTime !== null && (
                          <div className="flex flex-col items-center gap-2 mt-4">
                            <span className="text-lg font-normal">Resuming...</span>
                            <div className="w-48 h-3 bg-gray-600 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500 transition-all duration-50" style={{ width: `${pauseMarkerProgress * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Marker progress indicator (when not paused) */}
                {!isPaused && pauseMarkerStartTime !== null && (
                  <div className="absolute top-4 right-4 z-10 bg-black/70 rounded-lg px-4 py-3 flex flex-col items-center gap-2">
                    <span className="text-white text-sm font-semibold">Pausing...</span>
                    <div className="w-32 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 transition-all duration-50" style={{ width: `${pauseMarkerProgress * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <span className="text-center text-md text-gray-500">
            {!isTaskRunning && (
              <>
                <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">Move {hand} Hand</kbd> Inside the <kbd className="bg-red-200 py-1 font-bold px-2 rounded">{currentTask?.type === 'MOVE' || currentTask?.type === 'ROM_MOVE' ? 'Green' : 'Red'} Circle</kbd>{' '}
                to Begin Task
              </>
            )}
            {isTaskRunning && ['MOVE', 'ROM_MOVE'].includes(currentTask?.type || '') && (
              <>
                Follow the <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Green Circle</kbd> with Your{' '}
                <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">{hand} Hand</kbd>
              </>
            )}
            {isTaskRunning && ['HOLD', 'ROM_HOLD'].includes(currentTask?.type || '') && (
              <>
                Keep Your <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">{hand} Hand</kbd> Steady Inside the{' '}
                <kbd className={`${isInsideTarget ? 'bg-green-200' : 'bg-red-200'} py-1 font-bold px-2 rounded`}>{isInsideTarget ? 'Green' : 'Red'} Circle</kbd> for{' '}
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

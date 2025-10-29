import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import type { Pos, Task } from '../types/task';
import { useConfig } from '../utils/context';
import { defaultConfig, INCH_TO_MM, MM_TO_INCH } from '../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Font } from 'p5';
import { uid } from 'uid/single';
import useDetection from '../hooks/useMediaPipeHandDetection';
import { decodeBase64 } from '../utils/encoder';
import { closestPointOnLine, directionalMap, distance } from '../utils/math';
import type { CollectedData, CollectedIMUData, CollectedRawData } from '../types/datacollection';
import { go } from '../utils/navigation';
import { downloadZip, toCSV } from '../utils/datacollection';
import type { useWebSerial } from '../hooks/useWebSerial';
import type { Config } from '../types/config';

const CLICK_SOUND = new Audio('./audio/click.mp3');
const BEEP_SOUND = new Audio('./audio/beep.mp3');

const sketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let markerDiameter = 10;
  let worldPPI = 24;

  // let wristPos: { left: Pos | null; right: Pos | null } = { left: null, right: null };
  let activeWristPos: Pos | null = null;
  let directionPoint: Pos | null = null;
  let directionPointDistanceMM: number | null = null;

  let f: Font;

  let task: Task | null = null;
  let markers: Pos[] = [];
  let distanceThreshold = 15;

  let currentTarget: number = -1;
  let isRepeating: boolean = false;
  let isTaskRunning: boolean = false;
  let holdProgress: number = 0;

  let config: Config = defaultConfig;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
  };

  p5.setup = () => {
    p5.createCanvas(w, h, p5.WEBGL);
    p5.textFont(f);
    p5.drawingContext.antialias = true;
  };

  p5.updateWithProps = (props: {
    frameWidth?: number;
    frameHeight?: number;
    markerDiameter?: number;
    worldPPI?: number;
    task?: Task | null;
    currentTarget?: number | null;
    activeWristPos?: Pos | null;
    currentRepetition?: number | null;
    isTaskRunning?: boolean;
    holdProgress?: number;
    directionPoint?: Pos | null;
    directionPointDistanceMM?: number | null;
    config?: Config;
  }) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;
    if (typeof props.worldPPI === 'number') worldPPI = props.worldPPI;
    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);

    if (props.activeWristPos) activeWristPos = props.activeWristPos;

    if (props.task === null || props.task === undefined) {
      task = null;
      markers = [];
      distanceThreshold = 15;
      return;
    }

    task = props.task;
    markers = props.task.markers;
    distanceThreshold = props.task.distanceThreshold;
    currentTarget = typeof props.currentTarget === 'number' ? props.currentTarget : -1;
    isRepeating = typeof props.currentRepetition === 'number' ? props.currentRepetition < task.repetitions - 1 : false;
    isTaskRunning = typeof props.isTaskRunning === 'boolean' ? props.isTaskRunning : false;
    holdProgress = typeof props.holdProgress === 'number' ? props.holdProgress : 0;
    directionPoint = props.directionPoint || null;
    directionPointDistanceMM = props.directionPointDistanceMM || null;

    if (props.config) config = props.config;
  };

  p5.draw = () => {
    p5.clear();
    if (!task) return;

    if (task.type === 'MOVE') drawMarkers();
    else if (task.type === 'HOLD') drawHoldMarker();
    drawWrist();
  };

  const drawHoldMarker = () => {
    if (currentTarget === -1) return;
    if (task === null) return;

    const isInsideTarget =
      activeWristPos &&
      distance((activeWristPos.x * INCH_TO_MM) / worldPPI, (activeWristPos.y * INCH_TO_MM) / worldPPI, markers[currentTarget].x, markers[currentTarget].y) < distanceThreshold / 2;

    const cPos: Pos = { x: markers[currentTarget].x * MM_TO_INCH * worldPPI, y: markers[currentTarget].y * MM_TO_INCH * worldPPI };
    p5.noStroke();
    if (isInsideTarget) p5.fill(0, 255, 0, 128);
    else p5.fill(255, 0, 0, 128);
    p5.circle(cPos.x, cPos.y, markerDiameter);

    p5.strokeWeight(2);
    if (isInsideTarget) {
      p5.stroke(0, 255, 0);
      p5.fill(0, 255, 0, 32);
    } else {
      p5.stroke(255, 0, 0);
      p5.fill(255, 0, 0, 32);
    }
    p5.circle(cPos.x, cPos.y, distanceThreshold * MM_TO_INCH * worldPPI);

    // Draw arc to show progress around marker
    p5.noFill();
    p5.strokeWeight(4);
    p5.stroke(255);
    p5.arc(cPos.x, cPos.y, 1.2 * distanceThreshold * MM_TO_INCH * worldPPI, 1.2 * distanceThreshold * MM_TO_INCH * worldPPI, -p5.HALF_PI, -p5.HALF_PI + p5.TWO_PI * holdProgress);
  };

  const drawMarkers = () => {
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(2);

    // Current Target
    const cPos: Pos = { x: markers[currentTarget].x * MM_TO_INCH * worldPPI, y: markers[currentTarget].y * MM_TO_INCH * worldPPI };

    // Next Target
    let nPos: Pos | null = null;
    if (currentTarget < markers.length - 1) nPos = { x: markers[currentTarget + 1].x * MM_TO_INCH * worldPPI, y: markers[currentTarget + 1].y * MM_TO_INCH * worldPPI };
    else if (isRepeating) nPos = { x: markers[0].x * MM_TO_INCH * worldPPI, y: markers[0].y * MM_TO_INCH * worldPPI };

    // Previous Target
    let pPos: Pos | null = null;
    if (currentTarget > 0) pPos = { x: markers[currentTarget - 1].x * MM_TO_INCH * worldPPI, y: markers[currentTarget - 1].y * MM_TO_INCH * worldPPI };
    else if (isRepeating) pPos = { x: markers[markers.length - 1].x * MM_TO_INCH * worldPPI, y: markers[markers.length - 1].y * MM_TO_INCH * worldPPI };

    // Current Marker
    p5.noStroke();
    p5.fill(0, 255, 0, 200);
    p5.circle(cPos.x, cPos.y, markerDiameter);

    // Current Marker Threshold
    p5.noFill();
    p5.stroke(255, 0, 0);
    p5.strokeWeight(2);
    p5.circle(cPos.x, cPos.y, distanceThreshold * MM_TO_INCH * worldPPI);

    // Current Marker Label
    p5.fill(255);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textSize(12);
    p5.text(String(currentTarget + 1), cPos.x, cPos.y);

    [nPos, pPos].forEach((pos, idx) => {
      if (!pos) return;

      // Marker
      p5.noStroke();
      p5.fill(255, 255, 255, 64);
      p5.circle(pos.x, pos.y, markerDiameter);

      // Label
      p5.fill(255);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(12);
      if (idx == 0) p5.text(String(currentTarget + 1 + idx), pos.x, pos.y);
      else p5.text(String(currentTarget + 1 - 1), pos.x, pos.y);

      // Line
      p5.stroke(255, 255, 255, 64);
      p5.strokeWeight(2);
      p5.line(cPos.x, cPos.y, pos.x, pos.y);
    });
  };

  const drawWrist = () => {
    p5.noStroke();

    // Wrist Marker
    p5.fill(0, 0, 255, 128);
    if (activeWristPos) p5.circle(activeWristPos.x, activeWristPos.y, 12);

    // Wrist Label
    p5.fill(255);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textSize(6);
    if (activeWristPos) p5.text(task?.hand === 'Left' ? 'L' : 'R', activeWristPos.x, activeWristPos.y);

    // Wrist to Target Line
    if (!isTaskRunning) return;
    if (directionPointDistanceMM !== null && directionPoint && activeWristPos !== null) {
      const { x, y } = directionPoint;
      p5.fill(255, 255, 255);
      p5.noStroke();
      p5.circle(x * MM_TO_INCH * worldPPI, y * MM_TO_INCH * worldPPI, markerDiameter * 0.3);

      p5.textSize(10);
      p5.textAlign(p5.CENTER, p5.BOTTOM);
      p5.fill(255);
      p5.text(`${directionPointDistanceMM?.toFixed(1)} mm`, x * MM_TO_INCH * worldPPI, y * MM_TO_INCH * worldPPI);
    
      // p5.strokeWeight(2);
      // p5.stroke(255, 0, 0, 128);
      console.log('directionPointDistanceMM', directionPointDistanceMM, config.minVibrationThresholdMM, config.maxVibrationThresholdMM);
      if (directionPointDistanceMM < config.minVibrationThresholdMM) {
        const opacity = p5.map(directionPointDistanceMM, 0, config.minVibrationThresholdMM, 0, 128, true);
        const lineWidth = p5.map(directionPointDistanceMM, 0, config.minVibrationThresholdMM, 0, 1, true);
        p5.strokeWeight(lineWidth);
        p5.stroke(255, 255, 255, opacity);
      } else {
        const opacity = p5.map(directionPointDistanceMM, config.minVibrationThresholdMM, config.maxVibrationThresholdMM, 128, 255, true);
        const lineWidth = p5.map(directionPointDistanceMM, config.minVibrationThresholdMM, config.maxVibrationThresholdMM, 1, 2, true);
        p5.strokeWeight(lineWidth);
        p5.stroke(255, 0, 0, opacity);
      }
      p5.line(activeWristPos.x, activeWristPos.y, directionPoint.x * MM_TO_INCH * worldPPI, directionPoint.y * MM_TO_INCH * worldPPI);
    }
  };
};

const Study = ({ webSerial }: { webSerial: ReturnType<typeof useWebSerial> }) => {
  const { config } = useConfig();
  const { devicePPI, worldPPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = devicePPI / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor * MM_TO_INCH;
  const testbedHeight = testbedHeightMM * factor * MM_TO_INCH;
  const markerDiameter = markerDiameterMM * factor * MM_TO_INCH;

  const { latestImuVal } = webSerial;

  const { writeDirection, isConnected } = webSerial;

  const { videoRef, error, loading, wristDetection, startWebcam } = useDetection(true);
  const { leftWrist, rightWrist } = wristDetection;

  const [participantId, setParticipantId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskCorrupt, setIsTaskCorrupt] = useState(false);

  const [currentTaskIndex, setCurrentTaskIndex] = useState<number | null>(null);
  const [currentTrial, setCurrentTrial] = useState<number | null>(null);
  const [currentRepetition, setCurrentRepetition] = useState<number | null>(null);
  const currentTask: Task | null = useMemo(() => (currentTaskIndex !== null && tasks.length > currentTaskIndex ? tasks[currentTaskIndex] : null), [tasks, currentTaskIndex]);
  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
  const [previousTarget, setPreviousTarget] = useState<number | null>(null);

  const activeWrist = useMemo<Pos | null>(() => {
    if (currentTask === null) return null;
    if (currentTask.hand === 'Left') return leftWrist;
    return rightWrist;
  }, [currentTask, leftWrist, rightWrist]);

  const directionPoint = useMemo<Pos | null>(() => {
    if (currentTask === null) return null;
    if (currentTarget === null) return null;
    if (currentTask.type === 'HOLD') return currentTask.markers[0];
    if (currentTarget === null || previousTarget === null) return null;
    if (activeWrist === null) return null;
    if (activeWrist.x === undefined || activeWrist.y === undefined) return null;
    const ax = (activeWrist.x * INCH_TO_MM) / worldPPI;
    const ay = (activeWrist.y * INCH_TO_MM) / worldPPI;
    const p1 = currentTask.markers[previousTarget];
    const p2 = currentTask.markers[currentTarget];
    return closestPointOnLine(ax, ay, p1.x, p1.y, p2.x, p2.y);
  }, [currentTask, currentTarget, previousTarget, activeWrist, worldPPI]);

  const directionPointDistanceMM = useMemo<number>(() => {
    if (directionPoint === null || activeWrist === null) return 0;
    return distance(directionPoint.x, directionPoint.y, activeWrist.x * INCH_TO_MM / worldPPI, activeWrist.y * INCH_TO_MM / worldPPI);
  }, [directionPoint, activeWrist, worldPPI]);

  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const holdProgress = (() => {
    if (!taskStartTime) return 0;
    const elapsed = Date.now() - taskStartTime;
    const percent = Math.min(elapsed / (currentTask?.holdDuration || 1), 1);
    return percent;
  })();

  const isTaskRunning = useMemo<boolean>(() => {
    if (taskStartTime !== null) return true;
    return false;
  }, [taskStartTime]);
  const isStudyComplete = useMemo<boolean>(() => currentTaskIndex !== null && tasks !== null && currentTaskIndex === tasks.length, [currentTaskIndex, tasks]);

  const [collectedData, setCollectedData] = useState<CollectedData[]>([]);
  const [collectedRawData, setCollectedRawData] = useState<CollectedRawData[]>([]);
  const [collectedIMUData, setCollectedIMUData] = useState<CollectedIMUData[]>([]);
  const [isDataSaved, setIsDataSaved] = useState<boolean>(false);

  const goHome = () => {
    if (isDataSaved || window.confirm('Are you sure you want to return to the home page?')) go('#/');
  };

  const saveDataAsCSV = () => {
    const dataCsv = toCSV<CollectedData>(collectedData, Object.keys(collectedData[0]) as (keyof CollectedData)[]);
    const rawDataCsv = toCSV<CollectedRawData>(collectedRawData, Object.keys(collectedRawData[0]) as (keyof CollectedRawData)[]);
    const imuDataCsv = collectedIMUData.length > 0 ? toCSV<CollectedIMUData>(collectedIMUData, Object.keys(collectedIMUData[0]) as (keyof CollectedIMUData)[]) : null;
    downloadZip('handguidance_' + (collectedIMUData.length > 0 ? 'imutrial_' : '') + participantId, dataCsv, rawDataCsv, imuDataCsv, JSON.stringify(tasks, null, 2));
    setIsDataSaved(true);
  };

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const encoded = params.get('data');
    let pId = params.get('participantId');

    if (!pId) pId = window.prompt('Enter Participant ID:');

    if (encoded) {
      try {
        const decoded = decodeBase64(encoded);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          setTasks(parsed);
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
    if (currentTask === null) return;
    if (currentTarget === null) return;
    if (currentRepetition === null) return;
    if (currentTrial === null) return;
    if (currentTaskIndex === null) return;

    const { markers, repetitions, trials } = currentTask;
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
  }, [currentTarget, currentRepetition, currentTrial, currentTaskIndex, currentTask]);

  useEffect(() => {
    if (currentTaskIndex === null) return;
    if (currentTask === null) return;
    if (currentTarget === null) return;
    if (currentRepetition === null) return;
    if (currentTrial === null) return;
    if (isStudyComplete) return;

    const { type, hand, markers, distanceThreshold } = currentTask;

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
      // const vx = (Math.sign(dx) * Math.min(Math.max(Math.abs(dx) - distanceThreshold / 2, 0), 1.5 * distanceThreshold)) / (1.5 * distanceThreshold);
      // const vy = (Math.sign(dy) * Math.min(Math.max(Math.abs(dy) - distanceThreshold / 2, 0), 1.5 * distanceThreshold)) / (1.5 * distanceThreshold);
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
      if (type === 'HOLD') setTimeout(() => progressTask(), currentTask.holdDuration);
    }
    if (type === 'MOVE') progressTask();
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
          <div className="flex flex-row gap-2">
            <button className="px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 hover:bg-gray-100 cursor-pointer" onClick={saveDataAsCSV}>
              <FontAwesomeIcon icon="download" className="mr-2" />
              Download Data
            </button>

            <button className="px-4 py-3 rounded-lg bg-gray-200 text-gray-900 font-bold hover:bg-gray-800 hover:text-white cursor-pointer" onClick={goHome}>
              <FontAwesomeIcon icon="home" className="mr-2" />
              Home
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
      <div className="flex flex-col gap-2" style={{ width: `${testbedWidth}px` }}>
        <div className="w-full bg-gray-200 rounded-lg shadow flex items-center justify-between px-2 py-2">
          <div className="flex items-center px-1 gap-2">
            <span className="text-xl font-semibold">Hand Guidance Study</span>
          </div>
          <div className="flex flex-row gap-2">
            <button className="px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold" onClick={goHome}>
              <FontAwesomeIcon icon="home" />
            </button>
          </div>
        </div>

        <div className="flex flex-row gap-2">
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
                    <span className="font-bold text-blue-800">Move</span> <span className="font-bold text-red-800 border p-1 rounded">{currentTask?.hand} Hand</span> to Target
                  </>
                ) : (
                  <>
                    <span className="font-bold text-blue-800">Hold</span> <span className="font-bold text-red-800 border p-1 rounded">{currentTask?.hand} Hand</span> Inside Target
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
                {currentTask && currentTrial !== null ? currentTrial + 1 + ' / ' + String(currentTask.trials) : '-'}
              </span>
            </div>

            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Repetitions</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">
                {currentTask && currentRepetition !== null ? currentRepetition + 1 + ' / ' + String(currentTask.repetitions) : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
          <div className="absolute inset-0 overflow-hidden rounded-lg shadow-lg">
            {!error && !loading && (
              <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover ${isTaskCorrupt && 'blur'}`} style={{ transform: 'scaleX(-1)' }} />
            )}
            {isTaskCorrupt ? (
              <span className="text-red-600 bg-white border p-2 font-bold text-gray-500 z-9">[ERROR] Corrupt Task Data</span>
            ) : (
              <div className="absolute inset-0">
                <ReactP5Wrapper
                  sketch={sketch}
                  frameWidth={testbedWidth}
                  frameHeight={testbedHeight}
                  devicePPI={devicePPI}
                  devicePixelRatio={devicePixelRatio}
                  markerDiameter={markerDiameter}
                  worldPPI={worldPPI}
                  activeWristPos={activeWrist}
                  task={currentTask}
                  currentTarget={currentTarget}
                  currentRepetition={currentRepetition}
                  isTaskRunning={isTaskRunning}
                  holdProgress={holdProgress}
                  directionPoint={directionPoint}
                  directionPointDistanceMM={directionPointDistanceMM}
                  config={config}
                />
              </div>
            )}
          </div>
        </div>

        <span className="text-center text-md text-gray-500">
          {!isTaskRunning && (
            <>
              <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">Move {currentTask?.hand} Hand</kbd> Inside the{' '}
              <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Red Circle</kbd> to Begin Task
            </>
          )}
          {isTaskRunning && currentTask?.type === 'MOVE' && (
            <>
              Follow the <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Red Circle</kbd> with Your{' '}
              <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">{currentTask?.hand} Hand</kbd>
            </>
          )}
          {isTaskRunning && currentTask?.type === 'HOLD' && (
            <>
              Keep Your <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">{currentTask?.hand} Hand</kbd> Steady Inside the{' '}
              <kbd className="bg-red-200 py-1 font-bold px-2 rounded">Red Circle</kbd> for{' '}
              <span className="font-bold text-red-600">{Math.ceil(((1 - holdProgress) * (currentTask?.holdDuration || 1)) / 1000)} more seconds</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default Study;

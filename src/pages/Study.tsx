import { useEffect, useMemo, useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';
import type { Pos, Task } from '../types/task';
import { useConfig } from '../utils/context';
import { MM_TO_INCH } from '../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Font } from 'p5';
import { uid } from 'uid/single';
import useDetection from '../hooks/useMediaPipeHandDetection';
import { decodeBase64 } from '../utils/encoder';
import { distance } from '../utils/math';

const sketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let markerDiameter = 10;
  let worldPPI = 24;

  let wristPos: { left: Pos | null; right: Pos | null } = { left: null, right: null };

  let f: Font;

  let task: Task | null = null;
  let markers: Pos[] = [];
  let distanceThreshold = 15;

  let currentTarget: number = -1;

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
    wristPos?: { left: Pos | null; right: Pos | null };
  }) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;
    if (typeof props.worldPPI === 'number') worldPPI = props.worldPPI;

    if (props.task) {
      task = props.task;
      markers = props.task.markers;
      distanceThreshold = props.task.distanceThreshold;
    } else {
      task = null;
      markers = [];
      distanceThreshold = 15;
    }

    currentTarget = typeof props.currentTarget === 'number' ? props.currentTarget : -1;
    if (props.wristPos) wristPos = props.wristPos;

    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);
  };

  p5.draw = () => {
    p5.clear();
    if (!task) return;

    if (task.type === 'MOVE') drawMarkers();
    drawWrist();
  };

  const drawMarkers = () => {
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(2);

    for (let i = 0; i < markers.length; i++) {
      const cx = markers[i].x * MM_TO_INCH * worldPPI;
      const cy = markers[i].y * MM_TO_INCH * worldPPI;

      // Draw Markers
      if (i === currentTarget) p5.fill(0, 255, 0, 200);
      else if (i < currentTarget) p5.fill(0, 0, 255, 32);
      else p5.fill(255);
      p5.noStroke();
      p5.circle(cx, cy, markerDiameter);

      // Draw Threshold
      if (i >= currentTarget) {
        if (i === currentTarget) {
          p5.stroke(255, 0, 0, 200);
          p5.strokeWeight(4);
        } else {
          p5.stroke(255, 255, 255);
          p5.strokeWeight(1);
        }
        p5.noFill();
        p5.circle(cx, cy, distanceThreshold * MM_TO_INCH * worldPPI);
      }

      // Draw Lines
      if (i === currentTarget) p5.stroke(255, 0, 0);
      else if (i < currentTarget) p5.stroke(0, 0, 255, 32);
      else p5.stroke(255);
      p5.strokeWeight(i === currentTarget ? 2 : 1);
      if (i > 0) {
        const px = markers[i - 1].x * MM_TO_INCH * worldPPI;
        const py = markers[i - 1].y * MM_TO_INCH * worldPPI;
        p5.line(cx, cy, px, py);
      }

      // Draw Marker Labels
      p5.fill(0);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(12);
      p5.text(String(i + 1), cx, cy);
    }
  };

  const drawWrist = () => {
    p5.noStroke();

    p5.fill(0, 0, 255, 128);
    if (wristPos.left) p5.circle(wristPos.left.x, wristPos.left.y, 12);
    if (wristPos.right) p5.circle(wristPos.right.x, wristPos.right.y, 12);

    p5.fill(255);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textSize(6);
    if (wristPos.left) p5.text('L', wristPos.left.x, wristPos.left.y);
    if (wristPos.right) p5.text('R', wristPos.right.x, wristPos.right.y);
  };
};

const Study = () => {
  const { config } = useConfig();
  const { devicePPI, worldPPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;
  const markerDiameter = markerDiameterMM * factor;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { videoRef, error, loading, wristDetection, pinchDetection, startWebcam } = useDetection('WRIST AND PINCH', true);
  // const { pinchPos, indexPinch, middlePinch } = pinchDetection;
  const { leftWrist, rightWrist } = wristDetection;

  const [participantId, setParticipantId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTaskCorrupt, setIsTaskCorrupt] = useState(false);

  const [currentTaskIndex, setCurrentTaskIndex] = useState<number | null>(null);
  const [currentTrial, setCurrentTrial] = useState<number | null>(null);
  const [currentRepetition, setCurrentRepetition] = useState<number | null>(null);

  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentHoldPos, setCurrentHoldPos] = useState<Pos | null>(null);

  const currentTask: Task | null = useMemo(() => (currentTaskIndex !== null && tasks.length > currentTaskIndex ? tasks[currentTaskIndex] : null), [tasks, currentTaskIndex]);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const encoded = params.get('data');
    const pId = params.get('participantId');
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

  const goHome = () => {
    window.location.hash = '#/';
  };

  // TASK INITIALIZER
  useEffect(() => {
    if (currentTaskIndex === null) return;
    if (currentTaskIndex === tasks.length) {
      endStudy();
      return;
    }
    const task = tasks[currentTaskIndex];
    if (task.type === 'MOVE') setCurrentTarget(0);
    else if (task.type === 'HOLD') setCurrentHoldPos(null);
  }, [tasks, currentTaskIndex]);

  useEffect(() => {
    if (currentTaskIndex === null) return;
    if (currentTask === null) return;
    if (currentTarget === null) return;

    const activeWrist = currentTask.hand === 'Left' ? leftWrist : rightWrist;
    if (activeWrist === null) return;

    const d = distance(activeWrist.x, activeWrist.y, currentTask.markers[currentTarget].x, currentTask.markers[currentTarget].y);
    if (d < currentTask.distanceThreshold) {
      if (currentTarget < currentTask.markers.length - 1) {
        setCurrentTarget(currentTarget + 1);
      } else {
        setCurrentTaskIndex(currentTaskIndex + 1);
      }
    }
  }, [currentTask, currentTarget, leftWrist, rightWrist, currentTaskIndex]);

  const endStudy = () => {
    // TODO: Implement end study logic
  };

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
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">Ready</span>
            </div>
          </div>

          <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 ">
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Participant ID</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">{participantId}</span>
            </div>
          </div>

          <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 grow justify-between">
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Task</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">{currentTaskIndex !== null && currentTaskIndex + 1 + ' / ' + String(tasks.length)}</span>
            </div>

            <div className="flex flex-col h-full items-center justify-center grow">
              <label className="text-sm font-bold text-gray-600">Instruction</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-lg">
                Move <span className="font-bold text-red-800 border p-1 rounded">{currentTask?.hand} Hand</span> to Target
              </span>
            </div>
          </div>

          <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 ">
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

        <div
          className="md:col-span-3 rounded-lg shadow-lg bg-gray-100 overflow-hidden flex items-center justify-center relative"
          style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}
        >
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
                wristPos={{ left: leftWrist, right: rightWrist }}
                task={currentTask}
                currentTarget={currentTarget}
              />
            </div>
          )}
        </div>

        <span className="text-center text-md text-gray-500">
          Press <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">Space</kbd> to Begin Task
        </span>
      </div>
    </div>
  );
};

export default Study;

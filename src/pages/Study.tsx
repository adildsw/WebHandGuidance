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

const sketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let markerDiameter = 10;
  let moveThreshold = 15;
  let worldPPI = 24;
  let pts: Pos[] = [];

  let leftWrist: { x: number; y: number } | null = null;
  let rightWrist: { x: number; y: number } | null = null;

  let f: Font;

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
    moveThreshold?: number;
    markerDiameter?: number;
    worldPPI?: number;
    markers?: Pos[];
    leftWrist?: Pos | null;
    rightWrist?: Pos | null;
  }) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.moveThreshold === 'number') moveThreshold = props.moveThreshold;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;
    if (Array.isArray(props.markers)) pts = props.markers;
    if (typeof props.worldPPI === 'number') worldPPI = props.worldPPI;

    leftWrist = props.leftWrist ?? null;
    rightWrist = props.rightWrist ?? null;

    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);
  };

  p5.draw = () => {
    p5.clear();

    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(2);
    for (let i = 1; i < pts.length; i++) {
      const px = pts[i - 1].x * MM_TO_INCH * worldPPI;
      const py = pts[i - 1].y * MM_TO_INCH * worldPPI;
      const cx = pts[i].x * MM_TO_INCH * worldPPI;
      const cy = pts[i].y * MM_TO_INCH * worldPPI;
      p5.line(px, py, cx, cy);
    }
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].x * MM_TO_INCH * worldPPI;
      const y = pts[i].y * MM_TO_INCH * worldPPI;
      p5.fill(255);
      p5.noStroke();
      p5.circle(x, y, markerDiameter);
      p5.fill(0);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(12);
      p5.text(String(i + 1), x, y);
      p5.stroke(255);
      p5.strokeWeight(1);
      p5.noFill();
      p5.circle(x, y, moveThreshold * MM_TO_INCH * worldPPI);
    }

    const dot = Math.max(10, Math.min(20, markerDiameter * 0.9));
    if (leftWrist) {
      p5.noStroke();
      p5.fill(0, 180, 255);
      p5.circle(leftWrist.x, leftWrist.y, dot);
    }
    if (rightWrist) {
      p5.noStroke();
      p5.fill(255, 200, 0);
      p5.circle(rightWrist.x, rightWrist.y, dot);
    }
  };
};

const Study = () => {
  const { config } = useConfig();
  const { devicePPI, worldPPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;
  const markerDiameter = markerDiameterMM * factor;

  const { videoRef, error, loading, wristDetection, startWebcam } = useDetection('WRIST');
  const wrists = useMemo(() => {
    return {
      left: wristDetection?.leftWrist,
      right: wristDetection?.rightWrist,
    }
  }, [wristDetection]);

  const [participantId, setParticipantId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLoaded, setTaskLoaded] = useState(false);
  const currentTask: Task | null = useMemo(() => (tasks.length > 0 ? tasks[0] : null), [tasks]);

  const [currentTaskIndex, setCurrentTaskIndex] = useState<number>(0);
  const [currentTrial, setCurrentTrial] = useState<number>(1);
  const [currentRepetition, setCurrentRepetition] = useState<number>(1);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1]);
    const encoded = params.get('data');
    const pId = params.get('participantId');
    if (encoded) {
      try {
        const decoded = decodeURIComponent(encoded);
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          setTasks(parsed);
          setTaskLoaded(true);
          setParticipantId(pId || 'P-' + uid(5));
        }
      } catch {
        setTaskLoaded(false);
      }
    }
  }, []);

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);


  const goHome = () => {
    window.location.hash = '#/';
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
          <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 grow justify-center">
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

          <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 ">
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Task</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">{currentTaskIndex + 1 + ' / ' + String(tasks.length)}</span>
            </div>

            <div className="flex flex-col h-full items-center justify-center">
              <label className="text-sm font-bold text-gray-600">Instruction</label>
              <span className="w-48 px-2 py-1 text-center rounded font-semibold text-md">Move Hand to Target</span>
            </div>

            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Use Hand</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">{currentTask?.hand ?? '-'}</span>
            </div>
          </div>

          <div className="flex flex-row p-2 bg-white rounded-lg shadow gap-3 border border-gray-100 ">
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Trials</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">{currentTask ? currentTrial + ' / ' + String(currentTask.trials) : '-'}</span>
            </div>

            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Repetitions</label>
              <span className="px-2 py-1 text-center rounded font-semibold text-xl">{currentTask ? currentRepetition + ' / ' + String(currentTask.repetitions) : '-'}</span>
            </div>
          </div>
        </div>

        <div
          className="md:col-span-3 rounded-lg shadow-lg bg-gray-100 overflow-hidden flex items-center justify-center relative"
          style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}
        >
          {!error && !loading && <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />}
          <div className="absolute inset-0">
            <ReactP5Wrapper
              sketch={sketch}
              frameWidth={testbedWidth}
              frameHeight={testbedHeight}
              moveThreshold={currentTask?.moveThreshold ?? 15}
              devicePPI={devicePPI}
              markers={currentTask?.markers ?? []}
              devicePixelRatio={devicePixelRatio}
              markerDiameter={markerDiameter}
              leftWrist={wrists.left}
              worldPPI={worldPPI}
              rightWrist={wrists.right}
            />
          </div>
        </div>

        <span className="text-center text-md text-gray-500">
          Press <kbd className="bg-gray-200 py-1 font-bold px-2 rounded">Space</kbd> to Begin Task
        </span>
      </div>
    </div>
  );
};

export default Study;

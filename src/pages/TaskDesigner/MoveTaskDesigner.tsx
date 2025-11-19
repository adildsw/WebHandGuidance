import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pos, Task } from '../../types/task';
import { INCH_TO_MM, MM_TO_INCH } from '../../utils/constants';
import { useConfig } from '../../utils/context';
import { ReactP5Wrapper, type Sketch } from '@p5-wrapper/react';
import useDetection from '../../hooks/useMediaPipeHandDetection';
import type { Font } from 'p5';

type MoveTaskDesignerProps = {
  // tasks: Task[];
  // setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  // currentIndex: number;
  task: Task;
  modifyTask: (task: Task) => void;
  detectionProp: ReturnType<typeof useDetection>;
};

const sketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let worldPPI = 26;
  let markerDiameter = 10;
  let distanceThreshold = 50;

  let pts: Pos[] = [];

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
    distanceThreshold?: number;
    markerDiameter?: number;
    worldPPI?: number;
    markers?: Pos[];
  }) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.distanceThreshold === 'number') distanceThreshold = props.distanceThreshold;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;
    if (typeof props.worldPPI === 'number') worldPPI = props.worldPPI;
    if (Array.isArray(props.markers)) pts = props.markers;
    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);
  };

  p5.draw = () => {
    p5.clear();
    drawMarkers();
  };

  const drawMarkers = () => {
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(2);
    for (let i = 1; i < pts.length; i++) {
      const px = pts[i - 1].x * MM_TO_INCH * worldPPI;
      const py = pts[i - 1].y * MM_TO_INCH * worldPPI;
      const cx = pts[i].x * MM_TO_INCH * worldPPI;
      const cy = pts[i].y * MM_TO_INCH * worldPPI;
      p5.line(px, py, cx, cy);

      const pixelDistance = p5.dist(px, py, cx, cy) * (INCH_TO_MM / (worldPPI * 10));
      p5.textAlign(p5.CENTER, p5.BOTTOM);
      p5.textSize(10);
      p5.fill(255);
      p5.text(`${pixelDistance.toFixed(1)} cm`, (px + cx) / 2, (py + cy) / 2);
    }

    for (let i = 0; i < pts.length; i++) {
      const cx = pts[i].x * MM_TO_INCH * worldPPI;
      const cy = pts[i].y * MM_TO_INCH * worldPPI;
      if (i === 0) p5.fill(0, 230, 0);
      else if (i === pts.length - 1) p5.fill(230, 0, 0);
      else p5.fill(255);
      p5.noStroke();
      p5.circle(cx, cy, markerDiameter);

      p5.stroke(255, 255, 255);
      p5.strokeWeight(1);
      p5.noFill();
      p5.circle(cx, cy, distanceThreshold * MM_TO_INCH * worldPPI);

      p5.fill(0);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(12);
      p5.text(String(i + 1), cx, cy);

      p5.textAlign(p5.CENTER, p5.TOP);
      p5.textSize(10);
      p5.text(`(${(pts[i].x / 10).toFixed(1)}, ${(pts[i].y / 10).toFixed(1)})`, cx, cy + markerDiameter);
    }
  };
};

const MoveTaskDesigner = ({ task, modifyTask, detectionProp }: MoveTaskDesignerProps) => {
  const { config } = useConfig();
  const { worldPPI, devicePPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;
  const markerDiameter = markerDiameterMM * factor;

  const taskType = task.type as 'MOVE' | 'HOLD';
  const { distanceThreshold, hand, markers, repetitions, trials } = taskType === 'MOVE' ? task.movePayload : task.holdPayload;
  const { holdDuration } = taskType === 'HOLD' ? task.holdPayload : { holdDuration: 0 };

  const { startWebcam, stopWebcam, videoRef, loading, error } = detectionProp;
  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
    };
  }, [startWebcam, stopWebcam]);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveTaskDistance = useMemo(() => {
    const payload = task.movePayload;

    let distance: number = 0;
    for (let i = 1; i < payload.markers.length; i++) {
      const dx = payload.markers[i].x - payload.markers[i - 1].x;
      const dy = payload.markers[i].y - payload.markers[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }
    return distance;
  }, [task]);

  /**
   * Get mouse position in pixels relative to the center of the testbed overlay (Bottom-Right Positive Axes)
   * @param e Mouse event
   * @returns Object with x and y coordinates
   */
  const getMousePos = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (overlayRef.current as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    return { x, y };
  };

  const findHoverIndex = (pixelX: number, pixelY: number) => {
    let idx: number | null = null;
    const markers = taskType === 'HOLD' ? task.holdPayload.markers : task.movePayload.markers;
    for (let i = 0; i < markers.length; i++) {
      const dx = markers[i].x * MM_TO_INCH * worldPPI - pixelX;
      const dy = markers[i].y * MM_TO_INCH * worldPPI - pixelY;
      const d2 = dx * dx + dy * dy;
      if (d2 <= (markerDiameter / 2 + 4) * (markerDiameter / 2 + 4)) {
        idx = i;
        break;
      }
    }
    return idx;
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getMousePos(e);
    const mx = (x / worldPPI) * INCH_TO_MM;
    const my = (y / worldPPI) * INCH_TO_MM;
    if (dragIndex !== null) {
      const newTask = { ...task };
      if (taskType === 'HOLD') newTask.holdPayload.markers[dragIndex] = { x: mx, y: my };
      else newTask.movePayload.markers[dragIndex] = { x: mx, y: my };
      modifyTask(newTask);
      return;
    }
    setHoverIndex(findHoverIndex(x, y));
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getMousePos(e);
    const mx = (x / worldPPI) * INCH_TO_MM;
    const my = (y / worldPPI) * INCH_TO_MM;
    if (e.button === 0) {
      const idx = findHoverIndex(x, y);
      if (idx !== null) {
        setDragIndex(idx);
      } else {
        if (taskType === 'MOVE') {
          const newTask = { ...task };
          newTask.movePayload.markers.push({ x: mx, y: my });
          modifyTask(newTask);
        }
        else {
          const newTask = { ...task };
          newTask.holdPayload.markers[0] = { x: mx, y: my };
          modifyTask(newTask);
        }
      }
    }
  };

  const onMouseUp = () => {
    setDragIndex(null);
  };

  const onMouseLeave = () => {
    setDragIndex(null);
    setHoverIndex(null);
  };

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const markers = taskType === 'HOLD' ? task.holdPayload.markers : task.movePayload.markers;

    e.preventDefault();
    const { x, y } = getMousePos(e);
    const idx = findHoverIndex(x, y);
    if (idx !== null && markers.length > 1) {
      const newTask = { ...task };
      if (taskType === 'HOLD') {
        newTask.holdPayload.markers = newTask.holdPayload.markers.filter((_, i) => i !== idx);
      } else {
        newTask.movePayload.markers = newTask.movePayload.markers.filter((_, i) => i !== idx);
      }
      modifyTask(newTask);
      setHoverIndex(null);
      setDragIndex(null);
    }
  };

  if (['MOVE', 'HOLD'].includes(taskType) === false) return <></>;

  return (
    <div className="flex flex-col gap-2 items-center">
      {/* Task Form */}
      <div className="px-4 flex flex-row gap-2 overflow-auto p-2 bg-gray-100 rounded-lg w-full">
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Hand</label>
          <select
            className="w-24 px-2 py-1 h-full text-center rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
            value={hand}
            onChange={(e) => {
              const newTask = { ...task };
              if (taskType === 'HOLD') newTask.holdPayload.hand = e.target.value as 'Left' | 'Right';
              else newTask.movePayload.hand = e.target.value as 'Left' | 'Right';
              modifyTask(newTask);
            }}
          >
            <option value="Left">Left</option>
            <option value="Right">Right</option>
          </select>
        </div>
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Reps</label>
          <input
            className={`w-16 px-2 py-1 rounded border border-gray-300 text-center ${taskType === 'HOLD' ? 'opacity-50 cursor-not-allowed' : ''}`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(repetitions)}
            disabled={taskType === 'HOLD'}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              const n = v === '' ? 0 : Number(v);
              const newTask = { ...task };
              if (taskType === 'MOVE') newTask.movePayload.repetitions = n;
              else newTask.holdPayload.repetitions = n;
              modifyTask(newTask);
            }}
          />
        </div>
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Trials</label>
          <input
            className={`w-16 px-2 py-1 rounded border border-gray-300 text-center ${taskType === 'HOLD' ? 'opacity-50 cursor-not-allowed' : ''}`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(trials)}
            disabled={taskType === 'HOLD'}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              const n = v === '' ? 0 : Number(v);
              const newTask = { ...task };
              if (taskType === 'MOVE') newTask.movePayload.trials = n;
              else newTask.holdPayload.trials = n;
              modifyTask(newTask);
            }}
          />
        </div>

        <div className="w-px bg-gray-300 mx-2" />

        <div className="flex flex-row grow justify-between gap-4">
          <div className="flex flex-col grow items-center justify-between">
            <label className="text-sm text-gray-600 font-bold">Distance Threshold</label>
            <span className="text-xs text-gray-400">{distanceThreshold} mm (@ 10ft away)</span>
            <input
              className="w-full"
              type="range"
              min={25}
              max={150}
              step={1}
              value={distanceThreshold}
              onChange={(e) => {
                const newTask = { ...task };
                if (taskType === 'HOLD') newTask.holdPayload.distanceThreshold = Number(e.target.value);
                else newTask.movePayload.distanceThreshold = Number(e.target.value);
                modifyTask(newTask);
              }}
            />
          </div>

          {taskType === 'HOLD' ? (
            <div className="flex flex-col grow items-center justify-between">
              <label className="text-sm text-gray-600 font-bold">Hold Duration</label>
              <span className="text-xs text-gray-400">{holdDuration / 1000} s</span>
              <input
                className="w-full"
                type="range"
                min={1}
                max={10}
                step={1}
                value={holdDuration / 1000}
                onChange={(e) => {
                  const newTask = { ...task };
                  newTask.holdPayload.holdDuration = Number(e.target.value) * 1000;
                  modifyTask(newTask);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col grow items-center justify-between">
              <label className="text-sm text-gray-600 font-bold">Movement Details</label>
              <span className="text-xs text-gray-400">
                {markers.length} markers | {(moveTaskDistance / 10).toFixed(1)} cm
              </span>
              <span className="w-full text-center text-xs text-gray-800">{Math.round((moveTaskDistance / 10) * repetitions)} cm per Trial</span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Feed */}
      <div className="md:col-span-3 bg-gray-100 flex items-center justify-center relative" style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}>
        <div
          ref={overlayRef}
          className="absolute inset-0 overflow-hidden rounded-lg shadow-lg"
          onMouseMove={onMouseMove}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
          style={{ cursor: hoverIndex !== null ? 'pointer' : 'crosshair' }}
        >
          {!loading && !error && <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />}
          <div className="absolute inset-0">
            <ReactP5Wrapper
              sketch={sketch}
              frameWidth={testbedWidth}
              frameHeight={testbedHeight}
              distanceThreshold={taskType === 'HOLD' ? task.holdPayload.distanceThreshold : task.movePayload.distanceThreshold}
              worldPPI={worldPPI}
              markers={taskType === 'HOLD' ? task.holdPayload.markers : task.movePayload.markers}
              markerDiameter={markerDiameter}
            />
          </div>
        </div>
      </div>

      {/* Task Instructions */}
      {taskType === 'MOVE' ? (
        <span className="text-center text-sm text-gray-400 pt-2">
          <span className="bg-gray-200 font-bold rounded p-1">Left Click</span> to Place Marker • <span className="bg-gray-200 font-bold rounded p-1">Left Click + Drag</span> to
          Reposition Marker • <span className="bg-gray-200 font-bold rounded p-1">Right Click</span> to Delete Marker
        </span>
      ) : (
        <span className="text-center text-sm text-gray-400 pt-2">
          <span className="bg-gray-200 font-bold rounded p-1">Left Click + Drag</span> to Reposition Hold Target
        </span>
      )}
    </div>
  );
};

export default MoveTaskDesigner;

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pos, Task } from '../../types/task';
import { INCH_TO_MM, MM_TO_INCH } from '../../utils/constants';
import { useConfig } from '../../utils/context';
import { ReactP5Wrapper, type Sketch } from '@p5-wrapper/react';
import useDetection from '../../hooks/useMediaPipeHandDetection';
import type { Font } from 'p5';

type MoveTaskDesignerProps = {
  tasks: Task[];
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  currentIndex: number;
  detectionProp: ReturnType<typeof useDetection>;
};

const sketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let worldPPI = 26;
  let markerDiameter = 10;
  let distanceThreshold = 50;
  let axis = false;

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
    isAxisVisible?: boolean;
  }) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.distanceThreshold === 'number') distanceThreshold = props.distanceThreshold;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;
    if (typeof props.worldPPI === 'number') worldPPI = props.worldPPI;
    if (Array.isArray(props.markers)) pts = props.markers;
    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);
    axis = props.isAxisVisible ?? false;
  };

  p5.draw = () => {
    p5.clear();

    if (axis) drawAxis();
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

  const drawAxis = () => {
    p5.stroke(255, 255, 255, 128);
    p5.strokeWeight(1);
    p5.line(0, -h, 0, h);
    p5.line(-w, 0, w, 0);
    const maxWidthMM = w * (INCH_TO_MM / worldPPI);
    const maxHeightMM = h * (INCH_TO_MM / worldPPI);
    const tickSize = 50;
    p5.textSize(10);
    p5.fill(255);

    for (let i = 0; i > -maxWidthMM; i -= tickSize) {
      if ((Math.abs(i) / tickSize) % 2 == 1) {
        p5.line(i * (MM_TO_INCH * worldPPI), -2, i * (MM_TO_INCH * worldPPI), 2);
        continue;
      }
      p5.line(i * (MM_TO_INCH * worldPPI), -5, i * (MM_TO_INCH * worldPPI), 5);
      p5.textAlign(p5.CENTER, p5.BOTTOM);
      p5.text(`${Math.round(i) / 10} cm`, i * (MM_TO_INCH * worldPPI), 20);
    }
    for (let i = 0; i <= maxWidthMM; i += tickSize) {
      if ((Math.abs(i) / tickSize) % 2 == 1) {
        p5.line(i * (MM_TO_INCH * worldPPI), -2, i * (MM_TO_INCH * worldPPI), 2);
        continue;
      }
      p5.line(i * (MM_TO_INCH * worldPPI), -5, i * (MM_TO_INCH * worldPPI), 5);
      p5.textAlign(p5.CENTER, p5.BOTTOM);
      p5.text(`${Math.round(i) / 10} cm`, i * (MM_TO_INCH * worldPPI), 20);
    }

    for (let i = 0; i > -maxHeightMM; i -= tickSize) {
      if (i == 0) continue;
      if ((Math.abs(i) / tickSize) % 2 == 1) {
        p5.line(-5, i * (MM_TO_INCH * worldPPI), 5, i * (MM_TO_INCH * worldPPI));
        continue;
      }
      p5.line(-5, i * (MM_TO_INCH * worldPPI), 5, i * (MM_TO_INCH * worldPPI));
      p5.textAlign(p5.LEFT, p5.CENTER);
      p5.text(`${Math.round(i) / 10} cm`, 10, i * (MM_TO_INCH * worldPPI));
    }
    for (let i = 0; i <= maxHeightMM; i += tickSize) {
      if (i == 0) continue;
      if ((Math.abs(i) / tickSize) % 2 == 1) {
        p5.line(-5, i * (MM_TO_INCH * worldPPI), 5, i * (MM_TO_INCH * worldPPI));
        continue;
      }
      p5.line(-5, i * (MM_TO_INCH * worldPPI), 5, i * (MM_TO_INCH * worldPPI));
      p5.textAlign(p5.LEFT, p5.CENTER);
      p5.text(`${Math.round(i) / 10} cm`, 10, i * (MM_TO_INCH * worldPPI));
    }
  };
};

const MoveTaskDesigner = ({ tasks, setTasks, currentIndex, detectionProp }: MoveTaskDesignerProps) => {
  const { config } = useConfig();
  const { worldPPI, devicePPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;
  const markerDiameter = markerDiameterMM * factor;

  const { distanceThreshold, hand, markers, repetitions, trials } = tasks[currentIndex].type === 'MOVE' ? tasks[currentIndex].movePayload : tasks[currentIndex].holdPayload;
  const { holdDuration } = tasks[currentIndex].type === 'HOLD' ? tasks[currentIndex].holdPayload : { holdDuration: 0 };

  const { videoRef, loading, error } = detectionProp;

  const [isAxisVisible, setIsAxisVisible] = useState<boolean>(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v') {
        setIsAxisVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveTaskDistance = useMemo(() => {
    const payload = tasks[currentIndex].movePayload;

    let distance: number = 0;
    for (let i = 1; i < payload.markers.length; i++) {
      const dx = payload.markers[i].x - payload.markers[i - 1].x;
      const dy = payload.markers[i].y - payload.markers[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }
    return distance;
  }, [tasks, currentIndex]);

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
    if (['HOLD', 'MOVE'].includes(tasks[currentIndex].type) === false) return null;

    let idx: number | null = null;
    const markers = tasks[currentIndex].type === 'HOLD' ? tasks[currentIndex].holdPayload.markers : tasks[currentIndex].movePayload.markers;
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
    if (['HOLD', 'MOVE'].includes(tasks[currentIndex].type) === false) return;

    const { x, y } = getMousePos(e);
    const mx = (x / worldPPI) * INCH_TO_MM;
    const my = (y / worldPPI) * INCH_TO_MM;
    if (dragIndex !== null) {
      setTasks((prev) => {
        const newTasks = [...prev];
        if (tasks[currentIndex].type === 'HOLD') newTasks[currentIndex].holdPayload.markers[dragIndex] = { x: mx, y: my };
        else newTasks[currentIndex].movePayload.markers[dragIndex] = { x: mx, y: my };
        return newTasks;
      });
      return;
    }
    setHoverIndex(findHoverIndex(x, y));
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (['HOLD', 'MOVE'].includes(tasks[currentIndex].type) === false) return;

    const { x, y } = getMousePos(e);
    const mx = (x / worldPPI) * INCH_TO_MM;
    const my = (y / worldPPI) * INCH_TO_MM;
    if (e.button === 0) {
      const idx = findHoverIndex(x, y);
      if (idx !== null) {
        setDragIndex(idx);
      } else {
        if (tasks[currentIndex].type === 'MOVE')
          setTasks((prev) => {
            const newTasks = [...prev];
            newTasks[currentIndex].movePayload.markers.push({ x: mx, y: my });
            return newTasks;
          });
        else
          setTasks((prev) => {
            const newTasks = [...prev];
            newTasks[currentIndex].holdPayload.markers = [{ x: mx, y: my }];
            return newTasks;
          });
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
    if (['HOLD', 'MOVE'].includes(tasks[currentIndex].type) === false) return;
    const markers = tasks[currentIndex].type === 'HOLD' ? tasks[currentIndex].holdPayload.markers : tasks[currentIndex].movePayload.markers;

    e.preventDefault();
    const { x, y } = getMousePos(e);
    const idx = findHoverIndex(x, y);
    if (idx !== null && markers.length > 1) {
      setTasks((prev) => {
        const newTasks = [...prev];
        if (tasks[currentIndex].type === 'MOVE') {
          newTasks[currentIndex].movePayload.markers = newTasks[currentIndex].movePayload.markers.filter((_, i) => i !== idx);
        } else {
          newTasks[currentIndex].holdPayload.markers = newTasks[currentIndex].holdPayload.markers.filter((_, i) => i !== idx);
        }
        return newTasks;
      });
      setHoverIndex(null);
      setDragIndex(null);
    }
  };

  if (['MOVE', 'HOLD'].includes(tasks[currentIndex].type) === false) return <></>;

  return (
    <div>
      {/* Task Form */}
      <div className="px-4 flex flex-row gap-2 overflow-auto bg-white p-2">
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Hand</label>
          <select
            className="w-24 px-2 py-1 h-full text-center rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
            value={hand}
            onChange={(e) => {
              const newTasks = [...tasks];
              newTasks[currentIndex].movePayload.hand = e.target.value as 'Left' | 'Right';
              setTasks(newTasks);
            }}
          >
            <option value="Left">Left</option>
            <option value="Right">Right</option>
          </select>
        </div>
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Reps</label>
          <input
            className={`w-16 px-2 py-1 rounded border border-gray-300 text-center ${tasks[currentIndex].type === 'HOLD' ? 'opacity-50 cursor-not-allowed' : ''}`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(repetitions)}
            disabled={tasks[currentIndex].type === 'HOLD'}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              const n = v === '' ? 0 : Number(v);
              setTasks((prev) => {
                const newTasks = [...prev];
                if (tasks[currentIndex].type === 'MOVE') newTasks[currentIndex].movePayload.repetitions = n;
                else newTasks[currentIndex].holdPayload.repetitions = n;
                return newTasks;
              });
            }}
          />
        </div>
        <div className="flex flex-col items-center justify-between">
          <label className="text-sm font-bold text-gray-600">Trials</label>
          <input
            className={`w-16 px-2 py-1 rounded border border-gray-300 text-center ${tasks[currentIndex].type === 'HOLD' ? 'opacity-50 cursor-not-allowed' : ''}`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(trials)}
            disabled={tasks[currentIndex].type === 'HOLD'}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, '');
              const n = v === '' ? 0 : Number(v);
              setTasks((prev) => {
                const newTasks = [...prev];
                if (tasks[currentIndex].type === 'MOVE') newTasks[currentIndex].movePayload.trials = n;
                else newTasks[currentIndex].holdPayload.trials = n;
                return newTasks;
              });
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
                const newTasks = [...tasks];
                if (tasks[currentIndex].type === 'HOLD') newTasks[currentIndex].holdPayload.distanceThreshold = Number(e.target.value);
                else newTasks[currentIndex].movePayload.distanceThreshold = Number(e.target.value);
                setTasks(newTasks);
              }}
            />
          </div>

          {tasks[currentIndex].type === 'HOLD' ? (
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
                  const newTasks = [...tasks];
                  newTasks[currentIndex].holdPayload.holdDuration = Number(e.target.value) * 1000;
                  setTasks(newTasks);
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
            {['HOLD', 'MOVE'].includes(tasks[currentIndex].type) && (
              <ReactP5Wrapper
                sketch={sketch}
                frameWidth={testbedWidth}
                frameHeight={testbedHeight}
                distanceThreshold={tasks[currentIndex].type === 'HOLD' ? tasks[currentIndex].holdPayload.distanceThreshold : tasks[currentIndex].movePayload.distanceThreshold}
                worldPPI={worldPPI}
                markers={tasks[currentIndex].type === 'HOLD' ? tasks[currentIndex].holdPayload.markers : tasks[currentIndex].movePayload.markers}
                markerDiameter={markerDiameter}
                isAxisVisible={isAxisVisible}
              />
            )}
            Í
          </div>
        </div>
      </div>

      {/* Task Instructions */}
      {tasks[currentIndex].type === 'MOVE' ? (
        <span className="text-center text-sm text-gray-400 pt-2">
          <span className="bg-gray-200 font-bold rounded p-1">Left Click</span> to Place Marker • <span className="bg-gray-200 font-bold rounded p-1">Left Click + Drag</span> to
          Reposition Marker • <span className="bg-gray-200 font-bold rounded p-1">Right Click</span> to Delete Marker
        </span>
      ) : (
        <span className="text-center text-sm text-gray-400 pt-2">
          <span className="bg-gray-200 font-bold rounded p-1">Left Click + Drag</span> to Reposition Hold Target
        </span>
      )}
      <span className="text-center text-sm text-gray-400 pt-2">
        Press <span className="bg-gray-200 font-bold rounded p-1">v</span> to Toggle Axis Visualization
      </span>
    </div>
  );
};

export default MoveTaskDesigner;

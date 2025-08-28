import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';

import type { Pos, Task } from '../types/task';
import { useConfig } from '../utils/context';
import { INCH_TO_MM, MM_TO_INCH } from '../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Font } from 'p5';
import useDetection from '../hooks/useMediaPipeHandDetection';
import { go } from '../utils/navigation';

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

const TaskCreator = () => {
  const { config, generateDefaultTask } = useConfig();
  const { worldPPI, devicePPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;
  const markerDiameter = markerDiameterMM * factor;

  const [isAxisVisible, setIsAxisVisible] = useState<boolean>(false);

  const { videoRef, loading, error, startWebcam } = useDetection(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [studyName, setStudyName] = useState<string>('unnamed_study');
  const [tasks, setTasks] = useState<Task[]>([generateDefaultTask()]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const isModified = useMemo(() => tasks.length > 1 || tasks[currentIndex].markers.length > 0, [tasks, currentIndex]);

  const moveTaskDistance = useMemo(() => {
    let distance: number = 0;
    for (let i = 1; i < tasks[currentIndex].markers.length; i++) {
      const dx = tasks[currentIndex].markers[i].x - tasks[currentIndex].markers[i - 1].x;
      const dy = tasks[currentIndex].markers[i].y - tasks[currentIndex].markers[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }
    return distance;
  }, [tasks, currentIndex]);

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

  const newStudyTask = () => {
    if (!isModified || window.confirm('You have unsaved changes. Do you want to discard them?')) {
      setCurrentIndex(0);
      setTasks([generateDefaultTask()]);
    }
  };

  const loadStudyTask = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result;
      if (typeof json === 'string') {
        const loadedTasks = JSON.parse(json);
        setTasks(loadedTasks);
      }
    };
    reader.readAsText(file);
  };

  const saveStudyTask = () => {
    const json = JSON.stringify(tasks);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = studyName + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const returnToHome = () => {
    if (!isModified || window.confirm('You have unsaved changes. Do you want to discard them?')) go('#/');
  };

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
    const markers = tasks[currentIndex].markers;
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
      setTasks((prev) => {
        const newTasks = [...prev];
        newTasks[currentIndex].markers[dragIndex] = { x: mx, y: my };
        return newTasks;
      });
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
        if (tasks[currentIndex].type === 'MOVE')
          setTasks((prev) => {
            const newTasks = [...prev];
            newTasks[currentIndex].markers.push({ x: mx, y: my });
            return newTasks;
          });
        else
          setTasks((prev) => {
            const newTasks = [...prev];
            newTasks[currentIndex].markers = [{ x: mx, y: my }];
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
    e.preventDefault();
    const { x, y } = getMousePos(e);
    const idx = findHoverIndex(x, y);
    if (idx !== null && tasks[currentIndex].markers.length > 1) {
      setTasks((prev) => {
        const newTasks = [...prev];
        newTasks[currentIndex].markers = newTasks[currentIndex].markers.filter((_, i) => i !== idx);
        return newTasks;
      });
      setHoverIndex(null);
      setDragIndex(null);
    }
  };

  const addTask = () => {
    const newTask = generateDefaultTask();
    setTasks((prev) => [...prev, newTask]);
    setCurrentIndex(tasks.length);
  };

  const resetTask = () => {
    const defaultTask = generateDefaultTask();
    setTasks((prev) => {
      const newTasks = [...prev];
      newTasks[currentIndex] = defaultTask;
      return newTasks;
    });
  };

  const deleteTask = () => {
    if (tasks.length === 0) return;
    const nextIndex = currentIndex === 0 ? 0 : currentIndex - 1;
    setCurrentIndex(nextIndex);
    setTasks((prev) => {
      const newTasks = [...prev];
      newTasks.splice(currentIndex, 1);
      return newTasks;
    });
  };

  const gotoPrevTask = () => {
    if (currentIndex <= 0) return;
    const idx = currentIndex - 1;
    setCurrentIndex(idx);
  };

  const gotoNextTask = () => {
    if (currentIndex >= tasks.length - 1) return;
    const idx = currentIndex + 1;
    setCurrentIndex(idx);
  };

  const disablePrev = currentIndex <= 0;
  const atLast = currentIndex === tasks.length - 1 || tasks.length === 0;
  const plusDisabled = tasks[currentIndex].markers.length < 3;

  useEffect(() => {
    startWebcam();
  }, [startWebcam]);

  return (
    <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
      <div className="flex flex-col gap-2" style={{ width: `${testbedWidth}px` }}>
        {/* Create Study Task Top Bar */}
        <div className="w-full bg-gray-200 rounded-lg shadow flex items-center justify-between px-2 py-2">
          <div className="flex items-center px-1 gap-2">
            <span className="text-xl font-semibold">Study Task Designer</span>
          </div>
          <div className="flex flex-row gap-2">
            <input
              type="text"
              value={studyName}
              onChange={(e) => setStudyName(e.target.value)}
              className=" rounded border border-gray-300 px-1 py-1 ml-2 text-sm italic shrink-1"
            />

            <button className={`px-2 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`} onClick={newStudyTask}>
              <FontAwesomeIcon icon="file" />
            </button>
            <label className="px-2 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold">
              <FontAwesomeIcon icon="folder-open" />
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    loadStudyTask(file);
                    setStudyName(file.name.replace('.json', ''));
                  }
                }}
                className="hidden"
              />
            </label>
            <button className={`px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`} onClick={saveStudyTask}>
              <FontAwesomeIcon icon="save" />
            </button>
            <button className={`px-3 py-2 rounded text-lg bg-gray-300 cursor-pointer hover:bg-gray-600 hover:text-white items-center flex gap-1 font-bold`} onClick={returnToHome}>
              <FontAwesomeIcon icon="home" />
            </button>
          </div>
        </div>

        {/* Task Bar */}
        <div className="flex flex-col bg-white rounded-lg shadow border border-gray-100 ">
          {/* Task Navigator */}
          <div className="flex flex-row w-full justify-between items-center border-b border-gray-100 p-2 bg-gray-100">
            <button
              className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold ${
                disablePrev ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600 hover:text-white'
              }`}
              disabled={disablePrev}
              onClick={gotoPrevTask}
            >
              <FontAwesomeIcon icon="chevron-left" />
            </button>

            <span className="font-bold">Task #{currentIndex + 1}</span>

            <div className="flex flex-row gap-2 items-center">
              <input
                className=" rounded border border-gray-300 px-1 py-1 ml-2 text-sm italic shrink-1"
                value={tasks[currentIndex].tag}
                onChange={(e) => {
                  const newTasks = [...tasks];
                  newTasks[currentIndex].tag = e.target.value;
                  setTasks(newTasks);
                }}
              />
              <button
                className={'px-2 py-2 rounded text-xs border border-gray-200 items-center flex gap-1 font-bold cursor-pointer hover:bg-gray-200'}
                onClick={resetTask}
                disabled={tasks.length === 0}
              >
                <FontAwesomeIcon icon="redo" />
              </button>
              <button
                className={`px-2 py-2 rounded text-xs border border-gray-200 items-center flex gap-1 font-bold ${
                  tasks.length <= 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-red-600 hover:text-white'
                }`}
                disabled={tasks.length <= 1}
                onClick={deleteTask}
              >
                <FontAwesomeIcon icon="trash" />
              </button>
              {atLast ? (
                <button
                  className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold ${
                    plusDisabled && tasks[currentIndex].type !== 'HOLD' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600 hover:text-white'
                  }`}
                  disabled={plusDisabled && tasks[currentIndex].type !== 'HOLD'}
                  onClick={addTask}
                >
                  <FontAwesomeIcon icon="plus" />
                </button>
              ) : (
                <button
                  className={`px-3 py-2 rounded text-lg bg-gray-200 items-center flex gap-1 font-bold ${
                    atLast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600 hover:text-white'
                  }`}
                  disabled={atLast}
                  onClick={gotoNextTask}
                >
                  <FontAwesomeIcon icon="chevron-right" />
                </button>
              )}
            </div>
          </div>

          {/* Task Form */}
          <div className="px-4 flex flex-row gap-2 overflow-auto bg-white p-2">
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Hand</label>
              <select
                className="w-24 px-2 py-1 h-full text-center rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={tasks[currentIndex].hand}
                onChange={(e) => {
                  const newTasks = [...tasks];
                  newTasks[currentIndex].hand = e.target.value as 'Left' | 'Right';
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
                value={String(tasks[currentIndex].repetitions)}
                disabled={tasks[currentIndex].type === 'HOLD'}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  const n = v === '' ? 0 : Number(v);
                  setTasks((prev) => {
                    const newTasks = [...prev];
                    newTasks[currentIndex].repetitions = n;
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
                value={String(tasks[currentIndex].trials)}
                disabled={tasks[currentIndex].type === 'HOLD'}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  const n = v === '' ? 0 : Number(v);
                  setTasks((prev) => {
                    const newTasks = [...prev];
                    newTasks[currentIndex].trials = n;
                    return newTasks;
                  });
                }}
              />
            </div>

            <div className="w-px bg-gray-300 mx-2" />

            <div className="flex flex-row grow justify-between gap-4">
              <div className="flex flex-col items-center justify-between">
                <label className="text-sm text-gray-600 font-bold">Task Type</label>
                <select
                  className="text-center w-24 px-2 py-1 rounded border border-gray-300"
                  value={tasks[currentIndex].type}
                  onChange={(e) => {
                    setTasks((prev) => {
                      const newTasks = [...prev];
                      newTasks[currentIndex] = generateDefaultTask(e.target.value as 'MOVE' | 'HOLD');
                      return newTasks;
                    });
                  }}
                >
                  <option value="MOVE">Move</option>
                  <option value="HOLD">Hold</option>
                </select>
              </div>

              <div className="flex flex-col grow items-center justify-between">
                <label className="text-sm text-gray-600 font-bold">Distance Threshold</label>
                <span className="text-xs text-gray-400">{tasks[currentIndex].distanceThreshold} mm (@ 5ft away)</span>
                <input
                  className="w-full"
                  type="range"
                  min={25}
                  max={150}
                  step={1}
                  value={tasks[currentIndex].distanceThreshold}
                  onChange={(e) => {
                    const newTasks = [...tasks];
                    newTasks[currentIndex].distanceThreshold = Number(e.target.value);
                    setTasks(newTasks);
                  }}
                />
              </div>

              {tasks[currentIndex].type === 'HOLD' ? (
                <div className="flex flex-col grow items-center justify-between">
                  <label className="text-sm text-gray-600 font-bold">Hold Duration</label>
                  <span className="text-xs text-gray-400">{tasks[currentIndex].holdDuration / 1000} s</span>
                  <input
                    className="w-full"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={tasks[currentIndex].holdDuration / 1000}
                    onChange={(e) => {
                      const newTasks = [...tasks];
                      newTasks[currentIndex].holdDuration = Number(e.target.value) * 1000;
                      setTasks(newTasks);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col grow items-center justify-between">
                  <label className="text-sm text-gray-600 font-bold">Movement Details</label>
                  <span className="text-xs text-gray-400">
                    {tasks[currentIndex].markers.length} markers | {(moveTaskDistance / 10).toFixed(1)} cm
                  </span>
                  <span className="w-full text-center text-xs text-gray-800">{Math.round((moveTaskDistance / 10) * tasks[currentIndex].repetitions)} cm per Trial</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Camera Feed */}
        <div
          className="md:col-span-3 rounded-lg shadow-lg bg-gray-100 overflow-hidden flex items-center justify-center relative"
          style={{ width: `${testbedWidth}px`, height: `${testbedHeight}px` }}
        >
          <div
            ref={overlayRef}
            className="absolute inset-0"
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
                distanceThreshold={tasks[currentIndex].distanceThreshold}
                worldPPI={worldPPI}
                markers={tasks[currentIndex].markers}
                markerDiameter={markerDiameter}
                isAxisVisible={isAxisVisible}
              />
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
    </div>
  );
};

export default TaskCreator;

import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';

import font from '../assets/sf-ui-display-bold.otf';
import { Pos, Task } from '../types/task';
import { useConfig } from '../utils/context';
import { INCH_TO_MM, MM_TO_INCH } from '../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Font } from 'p5';

const sketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let devicePPI = 96;
  let devicePixelRatio = 1;
  let markerDiameter = 10;

  let moveThreshold = 15;

  let pts: Pos[] = [];

  let f: Font;
  p5.preload = () => {
    f = p5.loadFont(font);
  };

  p5.setup = () => {
    p5.createCanvas(w, h, p5.WEBGL);
    p5.textFont(f);

    p5.drawingContext.antialias = true;
  };

  p5.updateWithProps = (props: any) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.devicePPI === 'number') devicePPI = props.devicePPI;
    if (typeof props.moveThreshold === 'number') moveThreshold = props.moveThreshold;
    if (typeof props.devicePixelRatio === 'number') devicePixelRatio = props.devicePixelRatio;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;

    if (Array.isArray(props.markers)) pts = props.markers;
    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);
  };

  p5.draw = () => {
    p5.clear();
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(2);
    for (let i = 1; i < pts.length; i++) {
      const px = pts[i - 1].x - w / 2;
      const py = pts[i - 1].y - h / 2;
      const cx = pts[i].x - w / 2;
      const cy = pts[i].y - h / 2;
      p5.line(px, py, cx, cy);

      const distance = p5.dist(px, py, cx, cy) * (devicePixelRatio / devicePPI) * INCH_TO_MM;
      p5.textAlign(p5.CENTER, p5.TOP);
      p5.textSize(10);
      p5.fill(255);
      p5.text(`${distance.toFixed(1)} mm`, (px + cx) / 2, (py + cy) / 2);
    }
    for (let i = 0; i < pts.length; i++) {
      const cx = pts[i].x - w / 2;
      const cy = pts[i].y - h / 2;
      if (i === 0) p5.fill(0, 207, 0);
      else if (i === pts.length - 1) p5.fill(207, 0, 0);
      else p5.fill(255);
      p5.noStroke();
      p5.circle(cx, cy, markerDiameter);
      p5.fill(0);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(12);
      p5.text(String(i + 1), cx, cy);

      p5.stroke(255, 255, 255);
      p5.strokeWeight(1);
      p5.noFill();
      p5.circle(cx, cy, moveThreshold * MM_TO_INCH * (devicePPI / devicePixelRatio));
    }
  };
};

const TaskCreator = () => {
  const { config, generateDefaultTask } = useConfig();
  const { devicePPI, devicePixelRatio, testbedWidthMM, testbedHeightMM, markerDiameterMM } = config;
  const factor = (MM_TO_INCH * devicePPI) / devicePixelRatio;
  const testbedWidth = testbedWidthMM * factor;
  const testbedHeight = testbedHeightMM * factor;
  const markerDiameter = markerDiameterMM * factor;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const [studyName, setStudyName] = useState<string>('unnamed_study');
  const [tasks, setTasks] = useState<Task[]>([generateDefaultTask()]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const isModified = useMemo(() => tasks.length > 1 || tasks[currentIndex].markers.length > 0, [tasks, currentIndex]);

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
    if (!isModified || window.confirm('You have unsaved changes. Do you want to discard them?')) {
      window.location.hash = '#/';
    }
  };

  const startStream = async () => {
    if (streamRef.current || isStreaming) return;
    try {
      setIsStreaming(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
  }, []);

  const withinBounds = (x: number, y: number) => {
    const clampedX = Math.max(markerDiameter / 2, Math.min(testbedWidth - markerDiameter / 2, x));
    const clampedY = Math.max(markerDiameter / 2, Math.min(testbedHeight - markerDiameter / 2, y));
    return { x: clampedX, y: clampedY };
  };

  const getMousePos = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (overlayRef.current as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return withinBounds(x, y);
  };

  const findHoverIndex = (x: number, y: number) => {
    let idx: number | null = null;
    const markers = tasks[currentIndex].markers;
    for (let i = 0; i < markers.length; i++) {
      const dx = markers[i].x - x;
      const dy = markers[i].y - y;
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
    if (dragIndex !== null) {
      setTasks((prev) => {
        const newTasks = [...prev];
        newTasks[currentIndex].markers[dragIndex] = { x, y };
        return newTasks;
      });
      return;
    }
    setHoverIndex(findHoverIndex(x, y));
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const { x, y } = getMousePos(e);
    if (e.button === 0) {
      const idx = findHoverIndex(x, y);
      if (idx !== null) {
        setDragIndex(idx);
      } else {
        setTasks((prev) => {
          const newTasks = [...prev];
          newTasks[currentIndex].markers.push({ x, y });
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
    if (idx !== null) {
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

  return (
    <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center select-none">
      <div className="flex flex-col gap-2" style={{ width: `${testbedWidth}px` }}>
        <div className="w-full bg-gray-200 rounded-lg shadow flex items-center justify-between px-2 py-2">
          <div className="flex items-center px-1 gap-2">
            <span className="text-xl font-semibold">Create Study Tasks</span>
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

        <div className="flex flex-col bg-white rounded-lg shadow gap-3 border border-gray-100 ">
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
                    plusDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-600 hover:text-white'
                  }`}
                  disabled={plusDisabled}
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
          <div className="bg-white  p-4 pt-0 flex flex-row gap-3 justify-between overflow-auto">
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Tag</label>
              <input
                className="w-28 px-2 py-1 text-center rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                value={tasks[currentIndex].tag}
                onChange={(e) => {
                  const newTasks = [...tasks];
                  newTasks[currentIndex].tag = e.target.value;
                  setTasks(newTasks);
                }}
              />
            </div>
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
              <label className="text-sm font-bold text-gray-600">Trials</label>
              <input
                className="w-16 px-2 py-1 rounded border border-gray-300 text-center"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(tasks[currentIndex].trials)}
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
            <div className="flex flex-col items-center justify-between">
              <label className="text-sm font-bold text-gray-600">Repetitions</label>
              <input
                className="w-16 px-2 py-1 rounded border border-gray-300 text-center"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(tasks[currentIndex].repetitions)}
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

            <div className="border-l border-gray-200 h-full mx-2" />

            <div className="flex flex-col items-center justify-between">
              <label className="text-sm text-gray-600 font-bold">Task Type</label>
              <select
                className="cursor-not-allowed text-center w-24 px-2 py-1 rounded border border-gray-300 bg-gray-200 text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                value="move"
                disabled
              >
                <option value="move">Move</option>
                <option value="hold">Hold</option>
              </select>
            </div>

            <div className="flex flex-col items-center justify-between">
              <label className="text-sm text-gray-600 font-bold">Move Threshold</label>
              <span className="text-xs text-gray-400">{tasks[currentIndex].moveThreshold} mm</span>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={tasks[currentIndex].moveThreshold}
                onChange={(e) => {
                  const newTasks = [...tasks];
                  newTasks[currentIndex].moveThreshold = Number(e.target.value);
                  setTasks(newTasks);
                }}
              />
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
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute inset-0">
              <ReactP5Wrapper
                sketch={sketch}
                frameWidth={testbedWidth}
                frameHeight={testbedHeight}
                moveThreshold={tasks[currentIndex].moveThreshold}
                devicePPI={devicePPI}
                markers={tasks[currentIndex].markers}
                devicePixelRatio={devicePixelRatio}
                markerDiameter={markerDiameter}
              />
            </div>
          </div>
        </div>
        <span className="text-center text-sm text-gray-400">
          <span className="bg-gray-200 font-bold rounded p-1">Left Click</span> to Place Marker • <span className="bg-gray-200 font-bold rounded p-1">Right Click</span> to Delete
          Marker • <span className="bg-gray-200 font-bold rounded p-1">Left Click + Drag</span> to Reposition Marker
        </span>
      </div>
    </div>
  );
};

export default TaskCreator;

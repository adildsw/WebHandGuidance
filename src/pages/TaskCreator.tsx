import { useEffect, useRef, useState } from 'react';
import { ReactP5Wrapper } from '@p5-wrapper/react';
import type { Sketch } from '@p5-wrapper/react';

import font from '../assets/sf-ui-display-bold.otf';

type Pos = { x: number; y: number };
type Task = {
  tag: string;
  hand: 'left' | 'right';
  moveThreshold: number;
  trials: number;
  repetitions: number;
  markers: Pos[];
};

const TaskCreator = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [markers, setMarkers] = useState<Pos[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [tag, setTag] = useState<string>('task1-tag');
  const [hand, setHand] = useState<'left' | 'right'>('right');
  const [moveThreshold, setMoveThreshold] = useState<number>(50);
  const [trials, setTrials] = useState<number>(3);
  const [repetitions, setRepetitions] = useState<number>(5);

  const aspectRatio = 1.5858;
  const base = 370;
  const frameWidth = base * 2.5;
  const frameHeight = frameWidth / aspectRatio;

  const defaults = () => ({ tag: 'task1-tag', hand: 'right' as const, moveThreshold: 50, trials: 3, repetitions: 5 });
  const resetForm = () => {
    const d = defaults();
    setTag(d.tag);
    setHand(d.hand);
    setMoveThreshold(d.moveThreshold);
    setTrials(d.trials);
    setRepetitions(d.repetitions);
  };

  const startStream = async () => {
    if (streamRef.current || isStarting) return;
    try {
      setIsStarting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } finally {
      setIsStarting(false);
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

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    setMarkers((m) => [...m, { x: rawX, y: rawY }]);
  };

  const commitTask = () => {
    const newTask: Task = { tag, hand, moveThreshold, trials, repetitions, markers: [...markers] };
    setTasks((prev) => [...prev, newTask]);
    setCurrentIndex((prev) => prev + 1);
    setMarkers([]);
    resetForm();
  };

  const gotoPrev = () => {
    if (currentIndex <= 0) return;
    const idx = currentIndex - 1;
    setCurrentIndex(idx);
    const t = tasks[idx];
    setTag(t.tag);
    setHand(t.hand);
    setMoveThreshold(t.moveThreshold);
    setTrials(t.trials);
    setRepetitions(t.repetitions);
    setMarkers(t.markers);
  };

  const gotoNext = () => {
    if (currentIndex < 0) return;
    if (currentIndex >= tasks.length - 1) return;
    const idx = currentIndex + 1;
    setCurrentIndex(idx);
    const t = tasks[idx];
    setTag(t.tag);
    setHand(t.hand);
    setMoveThreshold(t.moveThreshold);
    setTrials(t.trials);
    setRepetitions(t.repetitions);
    setMarkers(t.markers);
  };

  const sketch: Sketch = (p5) => {
    let w = frameWidth;
    let h = frameHeight;
    let pts: Pos[] = [];

    p5.setup = () => {
      p5.createCanvas(w, h, p5.WEBGL);
      p5.loadFont(font, (loadedFont) => {
        p5.textFont(loadedFont);
      });
    };

    p5.updateWithProps = (props: any) => {
      if (typeof props.frameWidth === 'number') w = props.frameWidth;
      if (typeof props.frameHeight === 'number') h = props.frameHeight;
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
      }
      for (let i = 0; i < pts.length; i++) {
        const cx = pts[i].x - w / 2;
        const cy = pts[i].y - h / 2;
        i === 0 ? p5.fill(255, 0, 0) : p5.fill(255);
        p5.noStroke();
        p5.circle(cx, cy, 18);
        p5.fill(0);
        p5.textAlign(p5.CENTER, p5.CENTER);
        p5.textSize(12);
        p5.text(String(i + 1), cx, cy);
      }
    };
  };

  const disablePrev = currentIndex <= 0;
  const atLast = currentIndex === tasks.length - 1 || tasks.length === 0;
  const showPlus = atLast;
  const plusDisabled = markers.length < 3;
  const showIndexNumber = currentIndex >= 0 ? currentIndex + 1 : tasks.length + 1;

  return (
    <div className="w-screen h-screen flex gap-6 flex-col items-center justify-center">
      <div className="w-full flex flex-col text-center">
        <h1 className="text-3xl font-bold">Create Navigation Task</h1>
        <p className="text-gray-600">Click on webcam feed to place navigation markers.</p>
      </div>

      <div className="flex flex-col gap-2" style={{ width: `${frameWidth}px` }}>
        <div className="w-full bg-gray-100 rounded-lg shadow flex items-center justify-between px-4 py-3">
          <button
            className={`px-3 py-1 rounded text-lg font-bold ${disablePrev ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 hover:bg-gray-400'}`}
            onClick={gotoPrev}
            disabled={disablePrev}
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">Task #{showIndexNumber}</span>
          </div>
          {showPlus ? (
            <button
              className={`px-3 py-1 rounded text-lg font-bold ${plusDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-300 hover:bg-gray-400'}`}
              onClick={commitTask}
              disabled={plusDisabled}
            >
              +
            </button>
          ) : (
            <button className="px-3 py-1 rounded text-lg font-bold bg-gray-300 hover:bg-gray-400" onClick={gotoNext}>
              →
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-row gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">Tag</label>
            <input
              className="w-40 px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Hand</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1">
                <input type="radio" name="hand" value="left" checked={hand === 'left'} onChange={() => setHand('left')} />
                <span>Left</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="hand" value="right" checked={hand === 'right'} onChange={() => setHand('right')} />
                <span>Right</span>
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">Move Threshold</label>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={200} step={1} value={moveThreshold} onChange={(e) => setMoveThreshold(Number(e.target.value))} />
              <input
                className="w-16 px-2 py-1 rounded border border-gray-300 text-right"
                inputMode="numeric"
                pattern="[0-9]*"
                value={String(moveThreshold)}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  const n = v === '' ? 0 : Math.min(200, Math.max(0, Number(v)));
                  setMoveThreshold(n);
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">Trials</label>
            <input
              className="w-16 px-2 py-1 rounded border border-gray-300 text-right"
              inputMode="numeric"
              pattern="[0-9]*"
              value={String(trials)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                const n = v === '' ? 0 : Number(v);
                setTrials(n);
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600">Repetitions</label>
            <input
              className="w-16 px-2 py-1 rounded border border-gray-300 text-right"
              inputMode="numeric"
              pattern="[0-9]*"
              value={String(repetitions)}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                const n = v === '' ? 0 : Number(v);
                setRepetitions(n);
              }}
            />
          </div>
        </div>

        <div
          className="md:col-span-3 rounded-lg shadow-lg bg-gray-100 overflow-hidden flex items-center justify-center relative"
          style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}
        >
          <div className="absolute inset-0" onClick={handleClick}>
            <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute inset-0">
              <ReactP5Wrapper sketch={sketch} frameWidth={frameWidth} frameHeight={frameHeight} markers={markers} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-gray-600 font-medium">Navigation Markers: {markers.length}</span>
        <div className="flex items-center gap-3">
          <button
            className={`px-4 py-2 rounded font-bold ${
              markers.length === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-300 text-black hover:bg-gray-400 active:bg-gray-500'
            }`}
            onClick={() => markers.length > 0 && setMarkers([])}
            disabled={markers.length === 0}
          >
            Reset
          </button>
          <button
            className="bg-gray-300 text-black font-bold px-4 py-2 rounded hover:bg-gray-400 active:bg-gray-500"
            onClick={() => {
              stopStream();
              window.location.href = '/';
            }}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskCreator;

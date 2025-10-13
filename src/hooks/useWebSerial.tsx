import { useCallback, useRef, useState } from 'react';
import type { NavigatorSerial, SerialPort, SerialPortFilter, SerialPortInfo } from '../types/webserial';

type UseWebSerialOpts = {
  baudRate: number;
  filters?: SerialPortFilter[];
  lineDelimiter?: string;
};

type ImuVal = {
  ax: number | null;
  ay: number | null;
  az: number | null;
};

type VibrationData = {
  up: number;
  down: number;
  left: number;
  right: number;
};

export const useWebSerial = (opts: UseWebSerialOpts) => {
  const { baudRate, filters, lineDelimiter = '\n' } = opts;
  const [isConnected, setIsConnected] = useState(false);
  const [isSupported, setIsSupported] = useState('serial' in navigator);
  const [portInfo, setPortInfo] = useState<SerialPortInfo | null>(null);
  const [latestLine, setLatestLine] = useState<string | null>(null);
  const [latestBytes, setLatestBytes] = useState<Uint8Array | null>(null);
  const [latestImuVal, setLatestImuVal] = useState<ImuVal>({ ax: null, ay: null, az: null });
  const [lastVibrationData, setLastVibrationData] = useState<VibrationData>({ up: 0, down: 0, left: 0, right: 0 });
  const latestLineRef = useRef<string | null>(null);
  const latestBytesRef = useRef<Uint8Array | null>(null);
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null);
  const decoderRef = useRef<TextDecoder | null>(null);
  const readLoopActiveRef = useRef(false);
  const rxBufRef = useRef<Uint8Array>(new Uint8Array(0));

  const parseIMUBytes = useCallback((chunk: Uint8Array) => {
  const merged = new Uint8Array(rxBufRef.current.length + chunk.length);
  merged.set(rxBufRef.current, 0);
  merged.set(chunk, rxBufRef.current.length);
  let i = 0;
  let latest: { ax: number; ay: number; az: number } | null = null;
  while (i < merged.length) {
    if (merged[i] !== 0xff) { i += 1; continue; }
    if (i + 13 >= merged.length) break;
    if (merged[i + 13] === 0xfe) {
      const view = new DataView(merged.buffer, merged.byteOffset + i + 1, 12);
      const ax = view.getFloat32(0, true);
      const ay = view.getFloat32(4, true);
      const az = view.getFloat32(8, true);
      latest = { ax, ay, az };
      i += 14;
    } else {
      i += 1;
    }
  }
  rxBufRef.current = merged.subarray(i);
  return latest;
}, []);

const connect = useCallback(async () => {
  if (!('serial' in navigator)) {
    setIsSupported(false);
    throw new Error('Web Serial not supported');
  }
  setIsSupported(true);
  const nav = navigator as NavigatorSerial;
  const port = await nav.serial.requestPort(filters ? { filters } : undefined);
  await port.open({ baudRate });
  portRef.current = port;
  setPortInfo(port.getInfo());
  if (port.writable) writerRef.current = port.writable.getWriter();
  const reader = port.readable?.getReader();
  if (!reader) {
    setIsConnected(true);
    return;
  }
  readerRef.current = reader;
  decoderRef.current = new TextDecoder();
  readLoopActiveRef.current = true;
  setIsConnected(true);
  (async () => {
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        latestBytesRef.current = value;
        setLatestBytes(value);
        const imu = parseIMUBytes(value);
        if (imu) setLatestImuVal(imu);
        if (decoderRef.current) {
          buf += decoderRef.current.decode(value, { stream: true });
          for (;;) {
            const idx = buf.indexOf(lineDelimiter);
            if (idx === -1) break;
            const line = buf.slice(0, idx).replace(/\r/g, '');
            latestLineRef.current = line;
            setLatestLine(line);
            buf = buf.slice(idx + lineDelimiter.length);
          }
        }
      }
    } catch (e) {
      console.error('Read loop error', e);
    } finally {
      try { reader.releaseLock(); } catch (e) { console.error('Reader release lock error', e); }
      readLoopActiveRef.current = false;
    }
  })();
}, [baudRate, filters, lineDelimiter, parseIMUBytes]);

  const write = useCallback(async (data: string | Uint8Array) => {
    if (!writerRef.current) throw new Error('Not connected');
    const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    await writerRef.current.write(payload);
  }, []);

  const writeDirection = useCallback(
    async (x: number, y: number) => {
      if (!isConnected) return;
      const up = y < 0 ? Math.round(-y * 255) : 0;
      const down = y > 0 ? Math.round(y * 255) : 0;
      const left = x < 0 ? Math.round(-x * 255) : 0;
      const right = x > 0 ? Math.round(x * 255) : 0;
      const data = new Uint8Array([up, down, left, right, 0, 0]);
      setLastVibrationData({ up, down, left, right });
      await write(data);
    },
    [write, isConnected]
  );

  return {
    isSupported,
    isConnected,
    portInfo,
    latestLine,
    latestBytes,
    connect,
    writeDirection,
    latestImuVal,
    lastVibrationData,
  };
};

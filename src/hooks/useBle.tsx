import { useState, useRef, useCallback } from 'react';
import type { ImuVal, VibrationData } from '../types/webserial';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const MOTOR_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const IMU_CHAR_UUID = '8f022099-36b0-44cd-909e-d24cc105895a';

const useBle = () => {
  const motorChar = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isSupported, setIsSupported] = useState('serial' in navigator);
  const [latestImuVal, setLatestImuVal] = useState<ImuVal>({ ax: null, ay: null, az: null });
  const [lastVibrationData, setLastVibrationData] = useState<VibrationData>({ up: 0, down: 0, left: 0, right: 0 });


  const writeDirection = useCallback(async (x: number, y: number) => {
    if (!motorChar.current) return;
    const up = y < 0 ? Math.round(-y * 255) : 0;
    const down = y > 0 ? Math.round(y * 255) : 0;
    const left = x < 0 ? Math.round(-x * 255) : 0;
    const right = x > 0 ? Math.round(x * 255) : 0;
    const s = `${up},${down},${left},${right},0,0`;
    setLastVibrationData({ up, down, left, right });
    await motorChar.current.writeValue(new TextEncoder().encode(s));
  }, []);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setIsSupported(false);
      throw new Error('Web Serial not supported');
    }
    setIsSupported(true);

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'HandGuidanceDevice' }],
      optionalServices: [SERVICE_UUID],
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('[BLE ERROR] Failed to connect to GATT server');
    const service = await server.getPrimaryService(SERVICE_UUID);
    motorChar.current = await service.getCharacteristic(MOTOR_CHAR_UUID);
    const imuChar = await service.getCharacteristic(IMU_CHAR_UUID);
    await imuChar.startNotifications();

    setIsConnected(true);

    writeDirection(0, 0);

    device.addEventListener('gattserverdisconnected', () => {
      setIsConnected(false);
      console.log('[BLE] Device disconnected');
    });

    imuChar.addEventListener('characteristicvaluechanged', (e) => {
      if (e.target === null) return;
      const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
      const v = new TextDecoder().decode(value);
      setLatestImuVal({
        ax: parseFloat(v.split(',')[0]),
        ay: parseFloat(v.split(',')[1]),
        az: parseFloat(v.split(',')[2]),
      });
    });
  }, [writeDirection]);

  return { isConnected, isSupported, connect, writeDirection, latestImuVal, lastVibrationData };
};

export default useBle;
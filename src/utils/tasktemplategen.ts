import type { Handedness, PolarPos } from "../types/task";

export const generateRandomRomMarkers = (numMarkers: number, romLimit: number): PolarPos[] => {
  const markers: PolarPos[] = [{
    radius: 0,
    angle: 0
  }];
  for (let i = 0; i < numMarkers; i++) {
    markers.push({
      radius: Math.random() * romLimit,
      angle: Math.random() * 2 * Math.PI
    });
  }
  return markers;
};

export const generateLatRaiseMarkers = (hand: Handedness, romLimit: number): PolarPos[] => {
  return [
    { radius: 0, angle: 0 },
    { radius: romLimit, angle: Math.PI / 2 },
    { radius: romLimit, angle: hand === 'Right' ? 0 : Math.PI }
  ];
}

export const generateRoundRaiseMarkers = (hand: Handedness, Markers: number, romLimit: number): PolarPos[] => {
  const markers: PolarPos[] = [{ radius: 0, angle: 0 }];
  for (let i = 0; i < Markers; i++) {
    const angle = Math.PI / 2 + (i / (Markers - 1)) * Math.PI;
    markers.push({ radius: romLimit, angle: hand === 'Left' ? angle : Math.PI - angle });
  }
  return markers;
}

export const generateFullCircleMarkers = (hand: Handedness, Markers: number, romLimit: number): PolarPos[] => {
  const markers: PolarPos[] = [{ radius: 0, angle: 0 }];
  for (let i = 0; i < Markers; i++) {
    const angle = (i / Markers) * 2 * Math.PI;
    markers.push({ radius: romLimit, angle: hand === 'Right' ? angle : Math.PI - angle });
  }
  return markers;
}

export const generateShoulderPressMarkers = (romLimit: number): PolarPos[] => {
  return [
    { radius: 0, angle: 0 },
    { radius: romLimit, angle: -Math.PI / 2 }
  ];
}

export const generateAcrossChestMarkers = (hand: Handedness, romLimit: number): PolarPos[] => {
  return [
    { radius: 0, angle: 0 },
    { radius: romLimit * 0.5, angle: hand === 'Right' ? Math.PI : 0 },
    { radius: romLimit, angle: hand === 'Right' ? 0 : Math.PI },
  ];
}
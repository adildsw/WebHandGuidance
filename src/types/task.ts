export type Pos = { x: number; y: number };

export type Task = {
  tag: string;
  hand: 'left' | 'right';
  moveThreshold: number;
  trials: number;
  repetitions: number;
  markers: Pos[];
};

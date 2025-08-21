export type Pos = { x: number; y: number };

export type Task = {
  tag: string;
  hand: 'Left' | 'Right';
  distanceThreshold: number;
  trials: number;
  repetitions: number;
  type: 'MOVE' | 'HOLD';
  markers: Pos[];
  holdDuration: number;
};

// export interface MoveTask extends BaseTask {
//   type: 'MOVE';
//   markers: Pos[];
// }

// export interface HoldTask extends BaseTask {
//   type: 'HOLD';
//   duration: number;
// }

// export type Task = MoveTask | HoldTask;

// export type Task = {
//   tag: string;
//   hand: 'Left' | 'Right';
//   distanceThreshold: number;

//   trials: number;
//   repetitions: number;
//   markers: Pos[];
// };

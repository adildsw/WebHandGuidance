import { uid } from 'uid/single';
import { Task } from '../types/task';

export const CREDIT_CARD_WIDTH_INCH = 3.37;
export const CREDIT_CARD_HEIGHT_INCH = 2.13;
export const CREDIT_CARD_ASPECT_RATIO = CREDIT_CARD_WIDTH_INCH / CREDIT_CARD_HEIGHT_INCH;

export const MM_TO_INCH = 1 / 25.4;
export const INCH_TO_MM = 25.4;

export const GENERATE_DEFAULT_TASK = () => {
  return {
    tag: `task-${uid(5)}`,
    hand: 'right',
    moveThreshold: 15,
    trials: 3,
    repetitions: 5,
    markers: [],
  } as Task;
};

// export const TESTBED_WIDTH_INCH = 6;
// export const TESTBED_HEIGHT_INCH = 4;

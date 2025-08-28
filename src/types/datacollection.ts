export type DataCollection = {
  time_sec: number;
  task_tag: string;
  task_idx: number;
  trial_idx: number;
  repetition_idx: number;
  task_type: 'HOLD' | 'MOVE';
  target_idx: number;
  target_x_mm: number;
  target_y_mm: number;
  target_threshold_mm: number;
  user_left_x_mm: number;
  user_left_y_mm: number;
  user_right_x_mm: number;
  user_right_y_mm: number;
  target_dist_mm: number;
};

export type DataCollectionRaw = {
  time_sec: number;
  task_tag: string;
  task_idx: number;
  trial_idx: number;
  repetition_idx: number;
  task_type: 'HOLD' | 'MOVE';
  target_idx: number;
  target_x_px: number;
  target_y_px: number;
  target_threshold_px: number;
  user_left_x_px: number;
  user_left_y_px: number;
  user_right_x_px: number;
  user_right_y_px: number;
  target_dist_px: number;
  world_ppi: number;
  scaling_factor: number;
};
const SCALE_FACTOR_KEY = "web-hand-guidance-scaleFactor";

export const getScaleFactor = () : number => {
  const stored = localStorage.getItem(SCALE_FACTOR_KEY);
  return stored ? parseFloat(JSON.parse(stored)) : 1;
};

export const setScaleFactor = (value: number) : void => {
  localStorage.setItem(SCALE_FACTOR_KEY, JSON.stringify(value));
};

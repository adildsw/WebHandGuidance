export const distance = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
};

export const mapVideoToTestbed = (x: number, y: number, vw: number, vh: number, tw: number, th: number) => {
  const s = Math.max(tw / vw, th / vh);
  const dispW = vw * s;
  const dispH = vh * s;
  const ox = (tw - dispW) / 2;
  const oy = (th - dispH) / 2;
  const px = x * s + ox - tw / 2;
  const py = y * s + oy - th / 2;
  return { x: px, y: py };
};

export const closestPointOnLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : -1;
  let xx, yy;
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  return { x: xx, y: yy };
};

export const directionalMap = (d: number, minT: number, maxT: number) => {
  const ad = Math.abs(d);
  if (ad <= minT) return 0;
  if (ad >= maxT) return Math.sign(d);
  return Math.sign(d) * (ad - minT) / (maxT - minT);
};
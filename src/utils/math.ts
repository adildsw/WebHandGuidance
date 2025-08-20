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

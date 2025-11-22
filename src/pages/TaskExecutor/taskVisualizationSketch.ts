import type { Sketch } from '@p5-wrapper/react';
import type { Pos, TaskType } from '../../types/task';
import type { Font } from 'p5';
import type { Config, SilhouetteParams } from '../../types/config';
import { defaultConfig, INCH_TO_MM, MM_TO_INCH, SIL_IMG_HEIGHT, SIL_IMG_WIDTH } from '../../utils/constants';
import { distance } from '../../utils/math';
import type { HeadShoulderDetectionResult } from '../../types/detections';
import type p5 from 'p5';

const taskVisualizationSketch: Sketch = (p5) => {
  let w = 400;
  let h = 300;
  let markerDiameter = 10;
  let worldPPI = 24;

  let activeWristPos: Pos | null = null;
  let directionPoint: Pos | null = null;
  let directionPointDistanceMM: number | null = null;
  let headShoulderDetection: HeadShoulderDetectionResult = {
    nose: null,
    leftShoulder: null,
    rightShoulder: null,
    interShoulderDistance: null,
    noseShoulderDistance: null,
    posErrorX: null,
    posErrorY: null,
    posErrorZ: null,
    guideOpacity: 1,
    posMessage: 'Uncalibrated',
  };

  let f: Font;
  let silImg: p5.Image;
  let silParams: SilhouetteParams = defaultConfig.silParams;

  let type: 'MOVE' | 'HOLD' = 'MOVE';
  let hand: 'Left' | 'Right' = 'Right';
  let markers: Pos[] = [];
  let distanceThreshold = 15;

  let currentTarget: number = -1;
  let isRepeating: boolean = false;
  let isTaskRunning: boolean = false;
  let holdProgress: number = 0;

  // Silhouette Params
  let silH = SIL_IMG_HEIGHT * silParams.silScaleY;
  let silW = SIL_IMG_WIDTH * silParams.silScaleX;
  let silOpacity = 255;

  let config: Config = defaultConfig;

  p5.preload = () => {
    f = p5.loadFont('./fonts/sf-ui-display-bold.otf');
    silImg = p5.loadImage('./assets/standing.png');
  };

  p5.setup = () => {
    p5.createCanvas(w, h, p5.WEBGL);
    p5.textFont(f);
    p5.drawingContext.antialias = true;
  };

  p5.updateWithProps = (props: {
    frameWidth?: number;
    frameHeight?: number;
    markerDiameter?: number;
    worldPPI?: number;

    type?: TaskType;
    distanceThreshold?: number;
    markers?: Pos[];
    isRepeating?: boolean;
    hand?: 'Left' | 'Right';

    headShoulderDetection?: HeadShoulderDetectionResult;
    silParams?: SilhouetteParams;

    activeWristPos?: Pos | null;
    currentTarget?: number | null;
    currentRepetition?: number | null;
    isTaskRunning?: boolean;
    holdProgress?: number;
    directionPoint?: Pos | null;
    directionPointDistanceMM?: number | null;
    config?: Config;
  }) => {
    if (typeof props.frameWidth === 'number') w = props.frameWidth;
    if (typeof props.frameHeight === 'number') h = props.frameHeight;
    if (typeof props.markerDiameter === 'number') markerDiameter = props.markerDiameter;
    if (typeof props.worldPPI === 'number') worldPPI = props.worldPPI;
    if (p5.width !== w || p5.height !== h) p5.resizeCanvas(w, h);

    if (!props.type) type = 'MOVE';
    else if (['ROM_MOVE', 'MOVE'].includes(props.type)) type = 'MOVE';
    else if (['ROM_HOLD', 'HOLD'].includes(props.type)) type = 'HOLD';

    hand = props.hand || 'Right';
    markers = props.markers || [];
    distanceThreshold = typeof props.distanceThreshold === 'number' ? props.distanceThreshold : 15;

    if (props.activeWristPos) activeWristPos = props.activeWristPos;
    currentTarget = typeof props.currentTarget === 'number' ? props.currentTarget : -1;
    isRepeating = typeof props.isRepeating === 'boolean' ? props.isRepeating : false;
    isTaskRunning = typeof props.isTaskRunning === 'boolean' ? props.isTaskRunning : false;
    holdProgress = typeof props.holdProgress === 'number' ? props.holdProgress : 0;
    directionPoint = props.directionPoint || null;
    directionPointDistanceMM = props.directionPointDistanceMM || null;

    if (props.config) config = props.config;

    headShoulderDetection = props.headShoulderDetection ?? {
      nose: null,
      leftShoulder: null,
      rightShoulder: null,
      interShoulderDistance: null,
      noseShoulderDistance: null,
      posErrorX: null,
      posErrorY: null,
      posErrorZ: null,
      guideOpacity: 1,
      posMessage: 'Uncalibrated',
    };
    silParams = props.silParams ?? defaultConfig.silParams;

    silH = SIL_IMG_HEIGHT * silParams.silScaleY;
    silW = SIL_IMG_WIDTH * silParams.silScaleX;
    silOpacity = p5.map(headShoulderDetection.guideOpacity, 0, 1, 0, 255, true);
  };

  const drawHoldMarker = () => {
    if (currentTarget === -1) return;

    const isInsideTarget =
      activeWristPos &&
      distance((activeWristPos.x * INCH_TO_MM) / worldPPI, (activeWristPos.y * INCH_TO_MM) / worldPPI, markers[currentTarget].x, markers[currentTarget].y) < distanceThreshold / 2;

    const cPos: Pos = { x: markers[currentTarget].x * MM_TO_INCH * worldPPI, y: markers[currentTarget].y * MM_TO_INCH * worldPPI };
    p5.noStroke();
    if (isInsideTarget) p5.fill(0, 255, 0, 128);
    else p5.fill(255, 0, 0, 128);
    p5.circle(cPos.x, cPos.y, markerDiameter);

    p5.strokeWeight(2);
    if (isInsideTarget) {
      p5.stroke(0, 255, 0);
      p5.fill(0, 255, 0, 32);
    } else {
      p5.stroke(255, 0, 0);
      p5.fill(255, 0, 0, 32);
    }
    p5.circle(cPos.x, cPos.y, distanceThreshold * MM_TO_INCH * worldPPI);

    // Draw arc to show progress around marker
    p5.noFill();
    p5.strokeWeight(4);
    p5.stroke(255);
    p5.arc(cPos.x, cPos.y, 1.2 * distanceThreshold * MM_TO_INCH * worldPPI, 1.2 * distanceThreshold * MM_TO_INCH * worldPPI, -p5.HALF_PI, -p5.HALF_PI + p5.TWO_PI * holdProgress);
  };

  const drawMarkers = () => {
    if (markers.length === 0 || currentTarget === -1) return;
    
    p5.noFill();
    p5.stroke(255);
    p5.strokeWeight(2);

    // Current Target
    const cPos: Pos = { x: markers[currentTarget].x * MM_TO_INCH * worldPPI, y: markers[currentTarget].y * MM_TO_INCH * worldPPI };

    // Next Target
    let nPos: Pos | null = null;
    if (currentTarget < markers.length - 1) nPos = { x: markers[currentTarget + 1].x * MM_TO_INCH * worldPPI, y: markers[currentTarget + 1].y * MM_TO_INCH * worldPPI };
    else if (isRepeating) nPos = { x: markers[0].x * MM_TO_INCH * worldPPI, y: markers[0].y * MM_TO_INCH * worldPPI };

    // Previous Target
    let pPos: Pos | null = null;
    if (currentTarget > 0) pPos = { x: markers[currentTarget - 1].x * MM_TO_INCH * worldPPI, y: markers[currentTarget - 1].y * MM_TO_INCH * worldPPI };
    else if (isRepeating) pPos = { x: markers[markers.length - 1].x * MM_TO_INCH * worldPPI, y: markers[markers.length - 1].y * MM_TO_INCH * worldPPI };

    // Current Marker
    p5.noStroke();
    p5.fill(0, 255, 0, 200);
    p5.circle(cPos.x, cPos.y, markerDiameter);

    // Current Marker Threshold
    p5.noFill();
    p5.stroke(255, 0, 0);
    p5.strokeWeight(2);
    p5.circle(cPos.x, cPos.y, distanceThreshold * MM_TO_INCH * worldPPI);

    // Current Marker Label
    p5.fill(255);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textSize(12);
    p5.text(String(currentTarget + 1), cPos.x, cPos.y);

    [nPos, pPos].forEach((pos, idx) => {
      if (!pos) return;
      
      // Line
      p5.stroke(255, 0, 0, 128);
      p5.strokeWeight(4);
      p5.line(cPos.x, cPos.y, pos.x, pos.y);

      // Marker
      p5.noStroke();
      p5.fill(255, 255, 255, 64);
      p5.circle(pos.x, pos.y, markerDiameter);

      // Label
      p5.fill(255);
      p5.textAlign(p5.CENTER, p5.CENTER);
      p5.textSize(12);
      if (idx == 0) p5.text(String(currentTarget + 1 + idx), pos.x, pos.y);
      else p5.text(String(currentTarget + 1 - 1), pos.x, pos.y);

    });
  };

  const drawWrist = () => {
    p5.noStroke();

    // Wrist Marker
    p5.fill(0, 0, 255, 128);
    if (activeWristPos) p5.circle(activeWristPos.x, activeWristPos.y, 12);

    // Wrist Label
    p5.fill(255);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.textSize(6);
    if (activeWristPos) p5.text(hand === 'Left' ? 'L' : 'R', activeWristPos.x, activeWristPos.y);

    // Wrist to Target Line
    if (!isTaskRunning) return;
    if (directionPointDistanceMM !== null && directionPoint && activeWristPos !== null) {
      const { x, y } = directionPoint;
      p5.fill(255, 255, 255);
      p5.noStroke();
      p5.circle(x * MM_TO_INCH * worldPPI, y * MM_TO_INCH * worldPPI, markerDiameter * 0.3);

      p5.textSize(10);
      p5.textAlign(p5.CENTER, p5.BOTTOM);
      p5.fill(255);
      p5.text(`${directionPointDistanceMM?.toFixed(1)} mm`, x * MM_TO_INCH * worldPPI, y * MM_TO_INCH * worldPPI);

      if (directionPointDistanceMM < config.minVibrationThresholdMM) {
        const opacity = p5.map(directionPointDistanceMM, 0, config.minVibrationThresholdMM, 0, 128, true);
        const lineWidth = p5.map(directionPointDistanceMM, 0, config.minVibrationThresholdMM, 0, 1, true);
        p5.strokeWeight(lineWidth);
        p5.stroke(255, 255, 255, opacity);
      } else {
        const opacity = p5.map(directionPointDistanceMM, config.minVibrationThresholdMM, config.maxVibrationThresholdMM, 128, 255, true);
        const lineWidth = p5.map(directionPointDistanceMM, config.minVibrationThresholdMM, config.maxVibrationThresholdMM, 1, 3, true);
        p5.strokeWeight(lineWidth);
        p5.stroke(255, 0, 0, opacity);
      }
      p5.line(activeWristPos.x, activeWristPos.y, directionPoint.x * MM_TO_INCH * worldPPI, directionPoint.y * MM_TO_INCH * worldPPI);
    }
  };

  const drawSilhouette = () => {
    p5.imageMode(p5.CENTER);
    p5.tint(255, silOpacity);
    p5.image(silImg, 0, silParams.silY, silW, silH);
  };

  const drawUserPOIs = () => {
    if (!headShoulderDetection.nose || !headShoulderDetection.leftShoulder || !headShoulderDetection.rightShoulder) return;

    // Draw Positional Error Text
    p5.noStroke();
    p5.fill(255, 255, 255, silOpacity);
    p5.textSize(32);
    p5.textAlign(p5.CENTER, p5.CENTER);
    p5.text(headShoulderDetection.posMessage, 0, -h / 2 + 40);
  };

  p5.draw = () => {
    p5.clear();

    drawSilhouette();
    drawUserPOIs();

    if (type === 'MOVE') drawMarkers();
    else if (type === 'HOLD') drawHoldMarker();
    drawWrist();
  };
};

export default taskVisualizationSketch;

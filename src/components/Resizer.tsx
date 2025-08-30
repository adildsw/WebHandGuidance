import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useConfig } from "../utils/context";
import { useState } from "react";
import { INCH_TO_MM } from "../utils/constants";

const Resizer = () => {
  const {config, setTestbedHeight, setTestbedWidth } = useConfig();
  const {devicePPI, devicePixelRatio, testbedWidthMM, testbedHeightMM } = config;
  const factor = INCH_TO_MM * devicePixelRatio / devicePPI;

  const [isDragging, setIsDragging] = useState<boolean>(false);

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const onMouseDown = () => {
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.movementX;
      const deltaY = e.movementY;

      setTestbedWidth(Math.round(testbedWidthMM + (deltaX * factor * 2)));
      setTestbedHeight(Math.round(testbedHeightMM + (deltaY * factor * 2)));
    }
  };

  return (
    <div 
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseUp}
      className="flex items-center justify-center shadow-lg absolute -bottom-4 -right-4 w-8 h-8 rounded-full bg-gray-200 cursor-nwse-resize" 
      style={{transform: "rotate(90deg)"}}>
      <FontAwesomeIcon icon={"up-right-and-down-left-from-center"} className="text-gray-600" />
    </div>
  )
};

export default Resizer;

type CameraSelectorProps = {
  availableCameras: MediaDeviceInfo[];
  selectedCameraId: string | null;
  onSelectCamera: (deviceId: string) => void;
  className?: string;
};

const CameraSelector = ({ availableCameras, selectedCameraId, onSelectCamera, className }: CameraSelectorProps) => {
  const single = availableCameras.length <= 1;
  const tooltip = availableCameras.length === 0
    ? 'No cameras detected'
    : single
      ? 'Only one camera available'
      : 'Select camera';

  const currentValue = selectedCameraId && availableCameras.some((c) => c.deviceId === selectedCameraId)
    ? selectedCameraId
    : availableCameras[0]?.deviceId ?? '';

  return (
    <div className={`absolute top-2 right-2 z-30 ${className ?? ''}`} title={tooltip}>
      <select
        disabled={single}
        value={currentValue}
        onChange={(e) => onSelectCamera(e.target.value)}
        className="bg-black/60 text-white text-xs px-2 py-1 rounded outline-none disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer max-w-[220px]"
      >
        {availableCameras.length === 0 && <option value="">No cameras</option>}
        {availableCameras.map((c, i) => (
          <option key={c.deviceId} value={c.deviceId} className="text-black">
            {c.label || `Camera ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CameraSelector;

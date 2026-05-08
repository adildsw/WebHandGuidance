import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AdjustableCameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  threshold?: number;
  loading?: boolean;
  error?: string | null;
  children?: (dimensions: { width: number; height: number }) => React.ReactNode;
  className?: string;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  topContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
}

const DEFAULT_THRESHOLD = 0.75;
const DEFAULT_DIMENSIONS = { width: 640, height: 480 };

const AdjustableCameraView = ({
  videoRef,
  threshold = DEFAULT_THRESHOLD,
  loading = false,
  error = null,
  children,
  className = '',
  onDimensionsChange,
  topContent,
  bottomContent,
}: AdjustableCameraViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topContentRef = useRef<HTMLDivElement>(null);
  const bottomContentRef = useRef<HTMLDivElement>(null);
  const [videoNativeAspectRatio, setVideoNativeAspectRatio] = useState<number | null>(null);
  const [availableSpace, setAvailableSpace] = useState({ width: 0, height: 0 });
  const [contentHeights, setContentHeights] = useState({ top: 0, bottom: 0 });

  // Store callback in ref to avoid re-running effect when callback reference changes
  const onDimensionsChangeRef = useRef(onDimensionsChange);
  onDimensionsChangeRef.current = onDimensionsChange;

  // Calculate video dimensions based on available space and aspect ratio
  // Layout: [space, top, camera, bottom, space]
  // Camera takes threshold * (remaining height after top + bottom content)
  const calculateVideoDimensions = useCallback(() => {
    if (!videoNativeAspectRatio || availableSpace.width === 0 || availableSpace.height === 0) {
      return DEFAULT_DIMENSIONS;
    }

    // Calculate remaining height after top/bottom content
    const remainingHeight = availableSpace.height - contentHeights.top - contentHeights.bottom;

    const maxWidth = availableSpace.width * threshold;
    const maxHeight = remainingHeight * threshold;

    let finalWidth: number;
    let finalHeight: number;

    // Check if width or height is the limiting factor
    if (maxWidth / videoNativeAspectRatio <= maxHeight) {
      // Width is the limiting factor
      finalWidth = maxWidth;
      finalHeight = maxWidth / videoNativeAspectRatio;
    } else {
      // Height is the limiting factor
      finalHeight = maxHeight;
      finalWidth = maxHeight * videoNativeAspectRatio;
    }

    return { width: finalWidth, height: finalHeight };
  }, [videoNativeAspectRatio, availableSpace, threshold, contentHeights]);

  const videoDimensions = useMemo(() => calculateVideoDimensions(), [calculateVideoDimensions]);

  // Notify parent when dimensions change
  useEffect(() => {
    onDimensionsChangeRef.current?.(videoDimensions);
  }, [videoDimensions]);

  // Capture video's native aspect ratio when metadata is loaded
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        setVideoNativeAspectRatio(video.videoWidth / video.videoHeight);
      }
    };

    // Check if metadata is already loaded
    if (video.videoWidth && video.videoHeight) {
      setVideoNativeAspectRatio(video.videoWidth / video.videoHeight);
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [videoRef, loading]);

  // Track available space using container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateAvailableSpace = () => {
      setAvailableSpace({ width: container.clientWidth, height: container.clientHeight });
    };

    updateAvailableSpace();

    const resizeObserver = new ResizeObserver(updateAvailableSpace);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Track top/bottom content heights using ResizeObserver
  useEffect(() => {
    const updateContentHeights = () => {
      setContentHeights({
        top: topContentRef.current?.offsetHeight ?? 0,
        bottom: bottomContentRef.current?.offsetHeight ?? 0,
      });
    };

    updateContentHeights();

    const resizeObserver = new ResizeObserver(updateContentHeights);
    if (topContentRef.current) resizeObserver.observe(topContentRef.current);
    if (bottomContentRef.current) resizeObserver.observe(bottomContentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`flex flex-col items-center justify-center w-full h-full ${className}`}>
      {/* Top content slot */}
      {topContent && <div ref={topContentRef}>{topContent}</div>}

      {/* Camera view */}
      <div className="relative bg-gray-100 overflow-hidden rounded-lg shadow-lg" style={{ width: `${videoDimensions.width}px`, height: `${videoDimensions.height}px` }}>
        {!loading && !error && <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />}
        {children && <div className="absolute inset-0">{children(videoDimensions)}</div>}
      </div>

      {/* Bottom content slot */}
      {bottomContent && <div ref={bottomContentRef}>{bottomContent}</div>}
    </div>
  );
};

export default AdjustableCameraView;

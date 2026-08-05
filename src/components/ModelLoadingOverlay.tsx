type ModelLoadingOverlayProps = {
  visible: boolean;
  message?: string;
  errorMessage?: string | null;
};

const ModelLoadingOverlay = ({ visible, message = 'Loading detection models...', errorMessage }: ModelLoadingOverlayProps) => {
  const showError = !!errorMessage;
  if (!visible && !showError) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-4">
      <div className="absolute inset-0 backdrop-blur-md bg-black/40" />
      <div className="relative flex flex-col items-center gap-3 px-6 py-4 rounded-lg bg-black/70 text-white max-w-[80%] text-center">
        {showError ? (
          <>
            <span className="text-base font-bold text-red-300">Setup Error</span>
            <span className="text-sm whitespace-pre-wrap break-words">{errorMessage}</span>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-semibold">{message}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelLoadingOverlay;

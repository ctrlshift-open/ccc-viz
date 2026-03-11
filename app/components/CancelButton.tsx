import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

interface CancelButtonProps {
  project: string;
  sessionId: string;
  onCancelled?: () => void;
}

export function CancelButton({ project, sessionId, onCancelled }: CancelButtonProps) {
  const cancelFetcher = useFetcher();
  const statusFetcher = useFetcher<{ active: boolean; hasActiveProcess?: boolean }>();
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());

  // Poll for active process status every 2 seconds
  useEffect(() => {
    const checkStatus = () => {
      if (statusFetcher.state === "idle") {
        statusFetcher.load(`/api/sessions/${encodeURIComponent(project)}/${encodeURIComponent(sessionId)}/active`);
        setLastCheckTime(Date.now());
      }
    };

    // Initial check
    checkStatus();

    // Poll every 2 seconds
    const interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [project, sessionId]);

  // Reset confirmation when cancel completes
  useEffect(() => {
    if (cancelFetcher.state === "idle" && cancelFetcher.data) {
      setShowConfirm(false);
      if ((cancelFetcher.data as any)?.success) {
        onCancelled?.();
      }
    }
  }, [cancelFetcher.state, cancelFetcher.data, onCancelled]);

  const hasActiveProcess = statusFetcher.data?.hasActiveProcess ?? false;
  const isCancelling = cancelFetcher.state === "submitting";

  // Don't show anything if no active process
  if (!hasActiveProcess && !isCancelling) {
    return null;
  }

  const handleCancel = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    // Submit cancel request
    cancelFetcher.submit(
      {},
      {
        method: "post",
        action: `/api/sessions/${encodeURIComponent(project)}/${encodeURIComponent(sessionId)}/cancel`
      }
    );
    setShowConfirm(false);
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
  };

  return (
    <div className="rounded border border-red-800 bg-red-950/30 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-200 mb-1">
            Claude is Processing
          </div>
          <div className="text-xs text-gray-400">
            {showConfirm ? "Are you sure you want to cancel this operation?" : "A Claude CLI process is currently running for this session"}
          </div>
        </div>
        <div className="flex gap-2">
          {showConfirm ? (
            <>
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="px-3 py-2 rounded bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                No, Keep Running
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-3 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                Yes, Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-4 py-2 rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {isCancelling ? "Cancelling..." : "Cancel Process"}
            </button>
          )}
        </div>
      </div>
      {cancelFetcher.data && !isCancelling && (
        <div className={`mt-3 text-sm border rounded p-2 ${
          (cancelFetcher.data as any)?.success
            ? "text-green-400 border-green-800 bg-green-950/30"
            : "text-red-400 border-red-800 bg-red-950/50"
        }`}>
          {(cancelFetcher.data as any)?.message || "Cancellation request processed"}
        </div>
      )}
    </div>
  );
}
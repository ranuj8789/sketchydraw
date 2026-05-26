import { useCallback, useRef, useState } from "react";
import { exportUndoRedoAnimationVideo } from "../../canvas/exportAnimationVideo";

const DEFAULT_GAP_SECONDS = 0.5;

export function useVideoExport({ history, elements, canvasSize, canvasProps }) {
    const [isVideoExporting, setIsVideoExporting] = useState(false);
    const [videoExportProgress, setVideoExportProgress] = useState(0);

    const videoExportingRef = useRef(false);

    const downloadUndoRedoVideo = useCallback(async (options = {}) => {
        if (videoExportingRef.current) return;

        const gapSeconds = Number.isFinite(Number(options.gapSeconds))
            ? Number(options.gapSeconds)
            : DEFAULT_GAP_SECONDS;

        videoExportingRef.current = true;
        setIsVideoExporting(true);
        setVideoExportProgress(0);

        try {
            await exportUndoRedoAnimationVideo({
                historyStates: history || [],
                currentElements: elements || [],
                canvasSize,
                canvasProps,
                gapSeconds,
                onProgress: setVideoExportProgress,
            });
        } catch (error) {
            console.error("Video export failed:", error);
            alert(error?.message || "Video export failed. Check browser console.");
        } finally {
            videoExportingRef.current = false;
            setIsVideoExporting(false);
            setTimeout(() => setVideoExportProgress(0), 600);
        }
    }, [history, elements, canvasSize, canvasProps]);

    return {
        isVideoExporting,
        videoExportProgress,
        downloadUndoRedoVideo,
    };
}

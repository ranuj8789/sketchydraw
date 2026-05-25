import { useRef, useState } from "react";
import { exportUndoRedoAnimationVideo } from "../../canvas/exportAnimationVideo";

const DEFAULT_GAP_SECONDS = 0.5;

export function useVideoExport({ history, elements, canvasSize, canvasProps }) {
    const [isVideoExporting, setIsVideoExporting] = useState(false);
    const [videoExportProgress, setVideoExportProgress] = useState(0);

    const videoExportingRef = useRef(false);

    const downloadUndoRedoVideo = async (options = {}) => {
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
                currentElements: elements,
                canvasSize,
                canvasProps,
                fileName: `sketchy-animation-${gapSeconds}s-gap.webm`,
                gapSeconds,
                onProgress: setVideoExportProgress,
            });
        } catch (error) {
            console.error("Video export failed:", error);
            alert("Video export failed. Check browser console.");
        } finally {
            videoExportingRef.current = false;
            setIsVideoExporting(false);
            setVideoExportProgress(0);
        }
    };

    return {
        isVideoExporting,
        videoExportProgress,
        downloadUndoRedoVideo,
    };
}

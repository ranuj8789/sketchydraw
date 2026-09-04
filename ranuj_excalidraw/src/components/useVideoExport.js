import { useCallback, useRef, useState } from "react";
import { exportUndoRedoAnimationVideo } from "../../canvas/exportAnimationVideo";
import {
    DEFAULT_TIMELINE_PLAYBACK_SPEED,
    normalizeTimelinePlaybackSpeed,
} from "../../canvas/animationTimeline";

const DEFAULT_GAP_SECONDS = 0;

export function useVideoExport({ history, elements, timelineFrames, canvasSize, canvasProps }) {
    const [isVideoExporting, setIsVideoExporting] = useState(false);
    const [videoExportProgress, setVideoExportProgress] = useState(0);
    const [videoExportStatus, setVideoExportStatus] = useState("");

    const videoExportingRef = useRef(false);
    const lastProgressUpdateRef = useRef(0);
    const latestStatusRef = useRef("");

    const downloadUndoRedoVideo = useCallback(async (options = {}) => {
        if (videoExportingRef.current) {
            alert("A video export is already running. Please wait for it to finish.");
            return;
        }

        const gapSeconds = Number.isFinite(Number(options.gapSeconds))
            ? Number(options.gapSeconds)
            : DEFAULT_GAP_SECONDS;
        let playbackSpeed = options.playbackSpeed;
        if (playbackSpeed === undefined) {
            try {
                playbackSpeed = window.localStorage.getItem("sketchydraw.timelinePlaybackSpeed");
            } catch {
                playbackSpeed = DEFAULT_TIMELINE_PLAYBACK_SPEED;
            }
        }
        playbackSpeed = normalizeTimelinePlaybackSpeed(playbackSpeed);
        const exportTimelineFrames = Array.isArray(options.timelineFrames)
        && options.timelineFrames.length > 0
            ? options.timelineFrames
            : (timelineFrames || []);

        if (!exportTimelineFrames.length) {
            alert("There are no frames in the selected export range.");
            return;
        }

        const frameFrom = Number.isFinite(Number(options.frameFrom)) ? Number(options.frameFrom) : 1;
        const frameTo = Number.isFinite(Number(options.frameTo)) ? Number(options.frameTo) : frameFrom + exportTimelineFrames.length - 1;
        const rangeLabel = `frames ${frameFrom}-${frameTo}`;

        videoExportingRef.current = true;
        setIsVideoExporting(true);
        setVideoExportProgress(0);
        const preparingMessage = `Preparing ${rangeLabel} (${exportTimelineFrames.length} frames)...`;
        setVideoExportStatus(preparingMessage);
        latestStatusRef.current = preparingMessage;
        lastProgressUpdateRef.current = 0;
        window.dispatchEvent(new CustomEvent("sketchydraw:video-export-state", {
            detail: { exporting: true, progress: 0, status: preparingMessage },
        }));

        try {
            await exportUndoRedoAnimationVideo({
                historyStates: history || [],
                currentElements: elements || [],
                timelineFrames: exportTimelineFrames,
                canvasSize,
                canvasProps,
                gapSeconds,
                preAnimationDelaySeconds: options.preAnimationDelaySeconds,
                playbackSpeed,
                exportScale: options.exportScale,
                trimTrailingPause: options.trimTrailingPause,
                mode: options.mode || "server",
                fileName: options.fileName || `sketchydraw-frames-${frameFrom}-${frameTo}.${options.mode === "browser" ? "webm" : "mp4"}`,
                onProgress: (progress) => {
                    const normalized = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
                    const now = performance.now();
                    if (normalized < 100 && now - lastProgressUpdateRef.current < 250) return;
                    lastProgressUpdateRef.current = now;
                    setVideoExportProgress(normalized);
                    window.dispatchEvent(new CustomEvent("sketchydraw:video-export-state", {
                        detail: { exporting: true, progress: normalized, status: latestStatusRef.current },
                    }));
                },
                onStatus: (status) => {
                    const message = status?.message || status?.phase || "Exporting video...";
                    latestStatusRef.current = message;
                    setVideoExportStatus(message);
                    window.dispatchEvent(new CustomEvent("sketchydraw:video-export-state", {
                        detail: { exporting: true, progress: status?.progress || 0, status: message },
                    }));
                },
            });
        } catch (error) {
            console.error("Video export failed:", error);
            alert(error?.message || "Video export failed. Check browser console.");
        } finally {
            videoExportingRef.current = false;
            setIsVideoExporting(false);
            window.dispatchEvent(new CustomEvent("sketchydraw:video-export-state", {
                detail: { exporting: false, progress: 0, status: "" },
            }));
            setTimeout(() => {
                setVideoExportProgress(0);
                setVideoExportStatus("");
            }, 1200);
        }
    }, [history, elements, timelineFrames, canvasSize, canvasProps]);

    return {
        isVideoExporting,
        videoExportProgress,
        videoExportStatus,
        downloadUndoRedoVideo,
    };
}

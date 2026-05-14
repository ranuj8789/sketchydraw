import { useRef, useState } from "react";
import { exportUndoRedoAnimationVideo } from "../../canvas/exportAnimationVideo";

export const ANIMATION_SPEED_OPTIONS = [
    {
        value: "slow",
        label: "Slow",
        frameDelayMs: 800,
    },
    {
        value: "normal",
        label: "Normal",
        frameDelayMs: 450,
    },
    {
        value: "fast",
        label: "Fast",
        frameDelayMs: 220,
    },
    {
        value: "superFast",
        label: "Super Fast",
        frameDelayMs: 100,
    },
];

export function useVideoExport({
                                   history,
                                   elements,
                                   canvasSize,
                               }) {
    const [animationSpeed, setAnimationSpeed] = useState("normal");
    const [isVideoExporting, setIsVideoExporting] = useState(false);
    const [videoExportProgress, setVideoExportProgress] = useState(0);

    const videoExportingRef = useRef(false);

    const downloadUndoRedoVideo = async () => {
        if (videoExportingRef.current) return;

        const selectedSpeed =
            ANIMATION_SPEED_OPTIONS.find(
                (option) => option.value === animationSpeed
            ) || ANIMATION_SPEED_OPTIONS[1];

        videoExportingRef.current = true;
        setIsVideoExporting(true);
        setVideoExportProgress(0);

        try {
            await exportUndoRedoAnimationVideo({
                historyStates: history || [],
                currentElements: elements,
                canvasSize,
                fileName: `sketchy-animation-${selectedSpeed.value}.webm`,
                fps: 30,
                frameDelayMs: selectedSpeed.frameDelayMs,
                onProgress: (progress) => {
                    setVideoExportProgress(progress);
                },
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
        animationSpeed,
        setAnimationSpeed,
        animationSpeedOptions: ANIMATION_SPEED_OPTIONS,
        isVideoExporting,
        videoExportProgress,
        downloadUndoRedoVideo,
    };
}
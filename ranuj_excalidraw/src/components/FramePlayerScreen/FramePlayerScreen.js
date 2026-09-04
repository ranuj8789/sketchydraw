import React, { useEffect, useRef, useState } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import { TIMELINE_PLAYBACK_SPEED_OPTIONS } from "../../canvas/animationTimeline";
import {
    ANIMATION_EXPORT_RESOLUTION_OPTIONS,
    ANIMATION_EXPORT_ZOOM_OPTIONS,
    getAnimationExportTransform,
    resolveAnimationExportSize,
} from "../../canvas/animationExportSettings";
import "./FramePlayerScreen.css";

export default function FramePlayerScreen({
                                              open,
                                              frame,
                                              frameIndex = 0,
                                              totalFrames = 1,
                                              mode = "current",
                                              advanceMode = "enter",
                                              canvasSize,
                                              canvasProps,
                                              renderOptions = {},
                                              playing,
                                              timeMs = 0,
                                              waitingForNext,
                                              playbackSpeed = 0.5,
                                              onPlaybackSpeedChange,
                                              exportResolution = "1920x1080",
                                              onExportResolutionChange,
                                              exportZoomPercent = 150,
                                              onExportZoomPercentChange,
                                              onClose,
                                              onRestart,
                                              onRestartAll,
                                              onNext,
                                              onAdvanceModeChange,
                                              onExportGIF,
                                              gifExporting = false,
                                              gifExportProgress = 0,
                                              audioDataUrl = "",
                                              audioName = "",
                                          }) {
    const canvasRef = useRef(null);
    const playerRef = useRef(null);
    const audioRef = useRef(null);
    const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
    const [screenSize, setScreenSize] = useState({
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
    });

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsBrowserFullscreen(document.fullscreenElement === playerRef.current);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () =>
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleBrowserFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen?.();
            } else {
                await playerRef.current?.requestFullscreen?.();
            }
        } catch (error) {
            console.error("Unable to change player fullscreen mode", error);
        }
    };

    useEffect(() => {
        if (!open) return undefined;

        const handleResize = () => {
            setScreenSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const exportSize = resolveAnimationExportSize(exportResolution, canvasSize);
        const maxWidth = Math.max(320, screenSize.width - 96);
        const maxHeight = Math.max(260, screenSize.height - 180);
        const scale = Math.min(maxWidth / exportSize.width, maxHeight / exportSize.height);
        const viewWidth = Math.max(1, Math.round(exportSize.width * scale));
        const viewHeight = Math.max(1, Math.round(exportSize.height * scale));
        const previewTransform = getAnimationExportTransform({
            frames: [frame],
            sourceSize: canvasSize,
            outputSize: { width: viewWidth, height: viewHeight },
            zoomPercent: exportZoomPercent,
            padding: 28,
        });

        canvas.width = viewWidth;
        canvas.height = viewHeight;
        canvas.style.width = `${viewWidth}px`;
        canvas.style.height = `${viewHeight}px`;

        renderCanvas({
            canvas,
            canvasSize: {
                width: viewWidth,
                height: viewHeight,
            },
            elements: frame?.elements || [],
            selectedIds: [],
            connectionHint: null,
            alignmentGuides: [],
            viewport: {
                zoom: previewTransform.scale,
                offsetX: previewTransform.offsetX,
                offsetY: previewTransform.offsetY,
            },
            showGrid: false,
            canvasProps,
            renderOptions: {
                ...renderOptions,
                hiddenElementIds: new Set(frame?.hiddenElementIds || []),
            },
        });
    }, [
        open,
        frame,
        frameIndex,
        canvasSize,
        canvasProps,
        renderOptions,
        screenSize,
        timeMs,
        exportResolution,
        exportZoomPercent,
    ]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!open || !audio || !audioDataUrl) return;
        audio.playbackRate = playbackSpeed;

        if (timeMs <= 80) {
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Browsers may require the user to press Play audio once.
            });
        }
    }, [open, frameIndex, audioDataUrl, timeMs, playbackSpeed]);

    if (!open) return null;

    const hasNextFrame = mode === "all" && frameIndex < totalFrames - 1;
    const hasAnimatedObjects = (frame?.elements || []).some(
        (element) => element?.animation?.type && element.animation.type !== "none"
    );

    return (
        <div className="frame-player-screen" ref={playerRef}>
            <div className="frame-player-storyboard-heading">
                <div>
                    <span>Animation storyboard</span>
                    <strong>Preview this frame before exporting</strong>
                </div>
                <small>
                    Frame {frameIndex + 1} of {totalFrames}
                </small>
            </div>
            <div className="frame-player-topbar">
                <div>
                    <strong>
                        {mode === "all" ? "Playing all frames" : "Playing selected frame"}
                    </strong>
                    <span>
                        Frame {frameIndex + 1} / {totalFrames} · {Math.round(timeMs)}ms
                        {!hasAnimatedObjects ? " · static screen" : ""}
                    </span>
                </div>

                <div className="frame-player-actions">
                    <label>
                        Next frame
                        <select
                            value={advanceMode}
                            onChange={(event) => onAdvanceModeChange?.(event.target.value)}
                        >
                            <option value="enter">Enter key</option>
                            <option value="auto">Auto</option>
                        </select>
                    </label>

                    <label>
                        Speed
                        <select
                            value={playbackSpeed}
                            onChange={(event) => onPlaybackSpeedChange?.(Number(event.target.value) || 1)}
                        >
                            {TIMELINE_PLAYBACK_SPEED_OPTIONS.map((speed) => (
                                <option key={speed} value={speed}>{speed}×{speed === 0.5 ? " · Slow (default)" : ""}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Resolution
                        <select
                            value={exportResolution}
                            onChange={(event) => onExportResolutionChange?.(event.target.value)}
                        >
                            {ANIMATION_EXPORT_RESOLUTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Export zoom
                        <select
                            value={exportZoomPercent}
                            onChange={(event) => onExportZoomPercentChange?.(Number(event.target.value))}
                        >
                            {ANIMATION_EXPORT_ZOOM_OPTIONS.map((zoom) => (
                                <option key={zoom} value={zoom}>{zoom}%</option>
                            ))}
                        </select>
                    </label>

                    <button type="button" onClick={onRestart}>
                        Replay frame
                    </button>

                    {mode === "all" && (
                        <button type="button" className="frame-player-replay-all-btn" onClick={onRestartAll}>
                            Replay all frames
                        </button>
                    )}

                    {hasNextFrame && (
                        <button
                            type="button"
                            className="frame-player-next-btn"
                            onClick={onNext}
                        >
                            Next frame ↵
                        </button>
                    )}

                    <button
                        type="button"
                        className="frame-player-gif-btn"
                        onClick={() => onExportGIF?.({
                            resolution: exportResolution,
                            zoomPercent: exportZoomPercent,
                        })}
                        disabled={gifExporting}
                        title="Export all frames as an animated GIF"
                    >
                        {gifExporting
                            ? `Exporting GIF ${Math.round(
                                (gifExportProgress || 0) * 100
                            )}%`
                            : "Export GIF"}
                    </button>

                    <button
                        type="button"
                        className="frame-player-fullscreen-btn"
                        onClick={toggleBrowserFullscreen}
                    >
                        {isBrowserFullscreen ? "Exit full screen" : "Full screen"}
                    </button>

                    <button type="button" className="frame-player-close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>
            </div>

            <div className="frame-player-stage">
                <canvas ref={canvasRef} />
            </div>

            {audioDataUrl && (
                <div className="frame-player-audio">
                    <div>
                        <strong>Frame narration</strong>
                        <span>{audioName || `Frame ${frameIndex + 1} audio`}</span>
                    </div>
                    <audio ref={audioRef} controls src={audioDataUrl} preload="metadata" />
                </div>
            )}

            <div className="frame-player-hint">
                {waitingForNext && hasNextFrame ? (
                    <strong>Screen complete. Press Enter or click Next frame.</strong>
                ) : playing && hasAnimatedObjects ? (
                    <span>Animation is playing on this frame.</span>
                ) : playing ? (
                    <span>Static frame preview is playing. It will wait or go next based on your setting.</span>
                ) : hasNextFrame ? (
                    <span>Frame complete. Next frame is ready.</span>
                ) : (
                    <span>Last frame complete.</span>
                )}
            </div>
        </div>
    );
}

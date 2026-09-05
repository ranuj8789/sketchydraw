import React, { useEffect, useRef, useState } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import { TIMELINE_PLAYBACK_SPEED_OPTIONS } from "../../canvas/animationTimeline";
import {
    ANIMATION_EXPORT_RESOLUTION_OPTIONS,
    ANIMATION_EXPORT_TEXT_SCALE_OPTIONS,
    ANIMATION_EXPORT_ZOOM_OPTIONS,
    applyAnimationExportTextScale,
    getAnimationExportFitZoomPercent,
    getAnimationExportTransform,
    resolveAnimationExportSize,
} from "../../canvas/animationExportSettings";
import "./FramePlayerScreen.css";

export default function FramePlayerScreen({
                                              open,
                                              frame,
                                              exportFrames = [],
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
                                              exportFitContent = true,
                                              onExportFitContentChange,
                                              exportCameraPan = { x: 0, y: 0 },
                                              onExportCameraPanChange,
                                              exportTextScalePercent = 125,
                                              onExportTextScalePercentChange,
                                              onClose,
                                              onRestart,
                                              onRestartAll,
                                              onNext,
                                              onAdvanceModeChange,
                                              onExportGIF,
                                              onExportVideo,
                                              gifExporting = false,
                                              gifExportProgress = 0,
                                              audioDataUrl = "",
                                              audioName = "",
                                          }) {
    const canvasRef = useRef(null);
    const playerRef = useRef(null);
    const audioRef = useRef(null);
    const panDragRef = useRef(null);
    const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [videoExportState, setVideoExportState] = useState({ exporting: false, progress: 0, status: "" });
    const [screenSize, setScreenSize] = useState({
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
    });

    useEffect(() => {
        const handleVideoExportState = (event) => {
            setVideoExportState(event.detail || { exporting: false, progress: 0, status: "" });
        };
        window.addEventListener("sketchydraw:video-export-state", handleVideoExportState);
        return () => window.removeEventListener("sketchydraw:video-export-state", handleVideoExportState);
    }, []);

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
            frames: exportFrames.length ? exportFrames : [frame],
            sourceSize: canvasSize,
            outputSize: { width: viewWidth, height: viewHeight },
            zoomPercent: exportZoomPercent,
            fitContent: exportFitContent,
            pan: exportCameraPan,
            padding: 56 * scale,
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
            elements: applyAnimationExportTextScale(
                frame?.elements || [],
                exportTextScalePercent
            ),
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
        exportFitContent,
        exportCameraPan,
        exportFrames,
        exportTextScalePercent,
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
    const currentZoom = Math.round(Number(exportZoomPercent) || 100);
    const zoomChoices = [...new Set([...ANIMATION_EXPORT_ZOOM_OPTIONS, currentZoom])]
        .sort((a, b) => a - b);
    const zoomIndex = zoomChoices.indexOf(currentZoom);
    const decreaseZoom = () => {
        const nextIndex = zoomIndex > 0 ? zoomIndex - 1 : 0;
        onExportFitContentChange?.(false);
        onExportZoomPercentChange?.(zoomChoices[nextIndex]);
    };
    const increaseZoom = () => {
        const nextIndex = Math.min(zoomChoices.length - 1, zoomIndex + 1);
        onExportFitContentChange?.(false);
        onExportZoomPercentChange?.(zoomChoices[nextIndex]);
    };
    const fitContent = () => {
        const outputSize = resolveAnimationExportSize(exportResolution, canvasSize);
        const fittedZoom = getAnimationExportFitZoomPercent({
            frames: exportFrames.length ? exportFrames : [frame],
            sourceSize: canvasSize,
            outputSize,
        });
        onExportFitContentChange?.(true);
        onExportZoomPercentChange?.(fittedZoom);
        onExportCameraPanChange?.({ x: 0, y: 0 });
    };
    const startPan = (event) => {
        if (event.button !== 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        panDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            panX: Number(exportCameraPan?.x) || 0,
            panY: Number(exportCameraPan?.y) || 0,
            width: Math.max(1, canvas.clientWidth),
            height: Math.max(1, canvas.clientHeight),
        };
        setIsPanning(true);
    };
    const movePan = (event) => {
        const drag = panDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        onExportCameraPanChange?.({
            x: drag.panX + (event.clientX - drag.startX) / drag.width,
            y: drag.panY + (event.clientY - drag.startY) / drag.height,
        });
    };
    const endPan = (event) => {
        if (panDragRef.current?.pointerId !== event.pointerId) return;
        panDragRef.current = null;
        setIsPanning(false);
    };

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
                        Camera zoom
                        <select
                            value={exportZoomPercent}
                            onChange={(event) => {
                                onExportFitContentChange?.(false);
                                onExportZoomPercentChange?.(Number(event.target.value));
                            }}
                            title="Magnify small content without changing the selected HD resolution"
                        >
                            {zoomChoices.map((zoom) => (
                                <option key={zoom} value={zoom}>{zoom}%</option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Text size
                        <select
                            value={exportTextScalePercent}
                            onChange={(event) => onExportTextScalePercentChange?.(Number(event.target.value))}
                            title="Make all exported text larger without changing the drawing"
                        >
                            {ANIMATION_EXPORT_TEXT_SCALE_OPTIONS.map((size) => (
                                <option key={size} value={size}>{size}%{size === 125 ? " · Clear" : ""}</option>
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
                            fitContent: exportFitContent,
                            pan: exportCameraPan,
                            textScalePercent: exportTextScalePercent,
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
                        className="frame-player-video-btn"
                        onClick={() => onExportVideo?.({
                            resolution: exportResolution,
                            zoomPercent: exportZoomPercent,
                            fitContent: exportFitContent,
                            pan: exportCameraPan,
                            textScalePercent: exportTextScalePercent,
                        })}
                        disabled={videoExportState.exporting}
                        title="Export all frames with the same camera framing"
                    >
                        {videoExportState.exporting
                            ? `Video ${Math.round(videoExportState.progress || 0)}%`
                            : "Export Video"}
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

            <div className={`frame-player-stage${isPanning ? " is-panning" : ""}`}>
                <canvas
                    ref={canvasRef}
                    onPointerDown={startPan}
                    onPointerMove={movePan}
                    onPointerUp={endPan}
                    onPointerCancel={endPan}
                    title="Drag to pan the GIF/video export camera"
                />
                <div className="frame-player-camera-zoom" aria-label="Export camera zoom controls">
                    <button
                        type="button"
                        className="frame-player-fit-btn"
                        onClick={fitContent}
                        title="Fit all visible content inside the export"
                    >
                        Fit Content
                    </button>
                    <button
                        type="button"
                        onClick={decreaseZoom}
                        disabled={zoomIndex <= 0}
                        title="Zoom out"
                        aria-label="Zoom out"
                    >
                        −
                    </button>
                    <span title="The export resolution stays unchanged">
                        {exportFitContent ? "Auto fit" : "Camera zoom"} · {exportZoomPercent}%
                    </span>
                    <button
                        type="button"
                        onClick={increaseZoom}
                        disabled={zoomIndex === zoomChoices.length - 1}
                        title="Zoom in to make small content easier to see"
                        aria-label="Zoom in"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        className="frame-player-reset-pan-btn"
                        onClick={() => onExportCameraPanChange?.({ x: 0, y: 0 })}
                        title="Center the export camera"
                    >
                        Center
                    </button>
                </div>
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

import React, { useEffect, useRef, useState } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import "./FramePlayerScreen.css";

function getDesktopSourceSize(canvasSize) {
    return {
        width: Math.max(1, Number(canvasSize?.width) || 1200),
        height: Math.max(1, Number(canvasSize?.height) || 700),
    };
}

function getScaledDesktopViewport(canvasViewport = {}, scale = 1, padX = 0, padY = 0) {
    return {
        zoom: Math.max(0.01, Number(canvasViewport.zoom) || 1) * scale,
        offsetX: (Number(canvasViewport.offsetX) || 0) * scale + padX,
        offsetY: (Number(canvasViewport.offsetY) || 0) * scale + padY,
    };
}

export default function FramePlayerScreen({
                                              open,
                                              frame,
                                              frameIndex = 0,
                                              totalFrames = 1,
                                              mode = "current",
                                              advanceMode = "enter",
                                              canvasSize,
                                              canvasViewport,
                                              canvasProps,
                                              renderOptions = {},
                                              playing,
                                              timeMs = 0,
                                              waitingForNext,
                                              playbackSpeed = 1,
                                              onPlaybackSpeedChange,
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

        const sourceSize = getDesktopSourceSize(canvasSize);
        const maxWidth = Math.max(320, screenSize.width - 96);
        const maxHeight = Math.max(260, screenSize.height - 180);
        const scale = Math.min(maxWidth / sourceSize.width, maxHeight / sourceSize.height);
        const viewWidth = Math.max(1, Math.round(sourceSize.width * scale));
        const viewHeight = Math.max(1, Math.round(sourceSize.height * scale));

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
            viewport: getScaledDesktopViewport(canvasViewport, scale, 0, 0),
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
        canvasViewport,
        canvasProps,
        renderOptions,
        screenSize,
        timeMs,
    ]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!open || !audio || !audioDataUrl) return;

        if (timeMs <= 80) {
            audio.currentTime = 0;
            audio.play().catch(() => {
                // Browsers may require the user to press Play audio once.
            });
        }
    }, [open, frameIndex, audioDataUrl, timeMs]);

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
                            <option value={0.5}>0.5x slow</option>
                            <option value={0.75}>0.75x</option>
                            <option value={1}>1x normal</option>
                            <option value={1.25}>1.25x</option>
                            <option value={1.5}>1.5x</option>
                            <option value={2}>2x fast</option>
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
                        onClick={onExportGIF}
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

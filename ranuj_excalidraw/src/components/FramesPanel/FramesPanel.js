import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import "./FramesPanel.css";

function getFrameLabel(frame, index) {
    return frame?.name || `Frame ${index + 1}`;
}

function getElementLabel(element, index) {
    if (!element) return `Object ${index + 1}`;

    if (element.type === "text") {
        const text = String(element.text || "Text").trim();
        return text ? `Text: ${text.slice(0, 28)}` : "Text";
    }

    if (element.type === "image") {
        return element.fileName ? `Image: ${element.fileName}` : "Image";
    }

    return `${element.type || "Object"} ${index + 1}`;
}

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

function getFrameRenderOptions(frame, baseOptions = {}, active = false) {
    return {
        ...(active ? baseOptions : {}),
        hiddenElementIds: new Set(frame?.hiddenElementIds || []),
    };
}

function FrameThumbnail({
    frame,
    index,
    active,
    canvasSize,
    canvasViewport,
    canvasProps,
    renderOptions = {},
    onClick,
}) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const thumbSize = {
            width: 220,
            height: 132,
        };

        const sourceSize = getDesktopSourceSize(canvasSize);
        const scale = Math.min(
            thumbSize.width / sourceSize.width,
            thumbSize.height / sourceSize.height
        );
        const padX = (thumbSize.width - sourceSize.width * scale) / 2;
        const padY = (thumbSize.height - sourceSize.height * scale) / 2;

        renderCanvas({
            canvas,
            canvasSize: thumbSize,
            elements: frame?.elements || [],
            selectedIds: [],
            connectionHint: null,
            alignmentGuides: [],
            viewport: getScaledDesktopViewport(canvasViewport, scale, padX, padY),
            showGrid: false,
            canvasProps,
            renderOptions: getFrameRenderOptions(frame, renderOptions, active),
        });
    }, [frame, active, canvasSize, canvasViewport, canvasProps, renderOptions]);

    return (
        <button
            type="button"
            className={`frame-card ${active ? "active" : ""}`}
            onClick={onClick}
        >
            <canvas ref={canvasRef} width={220} height={132} />
            <div className="frame-card-footer">
                <strong>{getFrameLabel(frame, index)}</strong>
                <span>{frame?.elements?.length || 0} objects</span>
            </div>
        </button>
    );
}

function FramePlayerScreen({
    open,
    frame,
    frameIndex,
    totalFrames,
    mode,
    advanceMode,
    canvasSize,
    canvasViewport,
    canvasProps,
    renderOptions = {},
    playing,
    timeMs,
    waitingForNext,
    onClose,
    onRestart,
    onNext,
    onAdvanceModeChange,
}) {
    const canvasRef = useRef(null);
    const [screenSize, setScreenSize] = useState({
        width: typeof window !== "undefined" ? window.innerWidth : 1200,
        height: typeof window !== "undefined" ? window.innerHeight : 800,
    });

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

    if (!open) return null;

    const hasNextFrame = mode === "all" && frameIndex < totalFrames - 1;
    const hasAnimatedObjects = (frame?.elements || []).some(
        (element) => element?.animation?.type && element.animation.type !== "none"
    );

    return (
        <div className="frame-player-screen">
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

                    <button type="button" onClick={onRestart}>
                        Replay frame
                    </button>

                    {hasNextFrame && (
                        <button
                            type="button"
                            className="frame-player-next-btn"
                            onClick={onNext}
                        >
                            Next frame ↵
                        </button>
                    )}

                    <button type="button" className="frame-player-close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>
            </div>

            <div className="frame-player-stage">
                <canvas ref={canvasRef} />
            </div>

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

export default function FramesPanel({
    open,
    frames = [],
    currentIndex = 0,
    canvasSize,
    canvasViewport,
    canvasProps,
    renderOptions = {},
    animationPlaying = false,
    animationTimeMs = 0,
    advanceMode = "enter",
    playerOpen = false,
    playerMode = "current",
    playerFrameIndex = 0,
    playerFrame = null,
    playerRenderOptions = {},
    playerPlaying = false,
    playerTimeMs = 0,
    playerWaitingForNext = false,
    onClose,
    onSelectFrame,
    onAddFrameAfter,
    onDeleteFrame,
    onToggleFrameAnimation,
    onToggleElementHidden,
    onMoveFrameElementOrder,
    onApplyFrameObjectOrderTiming,
    onOpenPlayer,
    onClosePlayer,
    onRestartPlayerFrame,
    onAdvancePlayerFrame,
    onAdvanceModeChange,
    onMergeFrameWithNext,
    onMergeAllFrames,
}) {
    const currentFrame = frames[currentIndex] || frames[0] || null;

    const animatedCount = useMemo(() => {
        return (currentFrame?.elements || []).filter(
            (element) => element?.animation?.type && element.animation.type !== "none"
        ).length;
    }, [currentFrame]);

    const totalAnimatedCount = useMemo(() => {
        return frames.reduce((count, frame) => {
            return (
                count +
                (frame?.elements || []).filter(
                    (element) => element?.animation?.type && element.animation.type !== "none"
                ).length
            );
        }, 0);
    }, [frames]);

    if (!open) return null;

    return (
        <div className="frames-panel-backdrop">
            <aside className="frames-panel">
                <div className="frames-panel-header">
                    <div>
                        <h2>Frames</h2>
                        <p>
                            Frames are separate from undo history. The right Frames sidebar is pinnable; GIF tools stay in the left tab.
                        </p>
                    </div>

                    <button type="button" className="frames-close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="frames-panel-actions">
                    <button type="button" onClick={onAddFrameAfter}>
                        + Add frame
                    </button>

                    <button
                        type="button"
                        onClick={() => onMergeFrameWithNext?.()}
                        disabled={currentIndex >= frames.length - 1}
                    >
                        Merge next
                    </button>

                    <button
                        type="button"
                        onClick={() => onMergeAllFrames?.()}
                        disabled={frames.length <= 1}
                    >
                        Merge all
                    </button>

                    <button
                        type="button"
                        className="frames-danger-btn"
                        onClick={() => onDeleteFrame?.(currentIndex)}
                    >
                        Delete frame
                    </button>
                </div>

                <div className="frames-status-row">
                    <span>Selected: Frame {currentIndex + 1}</span>
                    <span>Objects: {currentFrame?.elements?.length || 0}</span>
                    <span>Animated objects: {animatedCount}</span>
                    <span>Total animations: {totalAnimatedCount}</span>
                </div>

                <div className="frames-grid">
                    {frames.map((frame, index) => (
                        <FrameThumbnail
                            key={frame.id || index}
                            frame={frame}
                            index={index}
                            active={index === currentIndex}
                            canvasSize={canvasSize}
                            canvasViewport={canvasViewport}
                            canvasProps={canvasProps}
                            renderOptions={index === currentIndex ? renderOptions : {}}
                            onClick={() => onSelectFrame?.(index)}
                        />
                    ))}
                </div>

                <div className="frame-object-list">
                    <div className="frame-object-list-header">
                        <div>
                            <h3>Object order / hide-show in this frame</h3>
                            <p>Top object comes first. Use arrows to change play/render order.</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => onApplyFrameObjectOrderTiming?.(currentIndex)}
                            disabled={!currentFrame?.elements?.some?.(
                                (element) => element?.animation?.type && element.animation.type !== "none"
                            )}
                            title="Set animation delays from top to bottom order"
                        >
                            Apply order timing
                        </button>
                    </div>

                    {!currentFrame?.elements?.length && (
                        <p className="frame-empty-text">No objects in this frame yet.</p>
                    )}

                    {(currentFrame?.elements || []).map((element, index) => {
                        const hiddenSet = new Set(currentFrame.hiddenElementIds || []);
                        const visible = !hiddenSet.has(element.id);
                        const animationType = element?.animation?.type || "none";
                        const delayMs = Number(element?.animation?.delayMs) || 0;

                        return (
                            <div className="frame-object-row" key={element.id || index}>
                                <span className="frame-object-order-badge">#{index + 1}</span>

                                <input
                                    type="checkbox"
                                    checked={visible}
                                    onChange={() => onToggleElementHidden?.(currentIndex, element.id)}
                                    title={visible ? "Visible in this frame" : "Hidden in this frame"}
                                />

                                <span title={getElementLabel(element, index)}>
                                    {getElementLabel(element, index)}
                                </span>

                                {animationType !== "none" ? (
                                    <em title={`Delay: ${delayMs}ms`}>
                                        {animationType}{delayMs ? ` · ${delayMs}ms` : ""}
                                    </em>
                                ) : (
                                    <em className="frame-object-static-tag">static</em>
                                )}

                                <div className="frame-object-order-actions">
                                    <button
                                        type="button"
                                        onClick={() => onMoveFrameElementOrder?.(currentIndex, element.id, "first")}
                                        disabled={index === 0}
                                        title="Move first"
                                    >
                                        ⇤
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onMoveFrameElementOrder?.(currentIndex, element.id, "up")}
                                        disabled={index === 0}
                                        title="Move up"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onMoveFrameElementOrder?.(currentIndex, element.id, "down")}
                                        disabled={index === (currentFrame?.elements || []).length - 1}
                                        title="Move down"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onMoveFrameElementOrder?.(currentIndex, element.id, "last")}
                                        disabled={index === (currentFrame?.elements || []).length - 1}
                                        title="Move last"
                                    >
                                        ⇥
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </aside>

            <FramePlayerScreen
                open={playerOpen}
                frame={playerFrame}
                frameIndex={playerFrameIndex}
                totalFrames={frames.length || 1}
                mode={playerMode}
                advanceMode={advanceMode}
                canvasSize={canvasSize}
                canvasViewport={canvasViewport}
                canvasProps={canvasProps}
                renderOptions={playerRenderOptions}
                playing={playerPlaying}
                timeMs={playerTimeMs}
                waitingForNext={playerWaitingForNext}
                onClose={onClosePlayer}
                onRestart={onRestartPlayerFrame}
                onNext={onAdvancePlayerFrame}
                onAdvanceModeChange={onAdvanceModeChange}
            />
        </div>
    );
}

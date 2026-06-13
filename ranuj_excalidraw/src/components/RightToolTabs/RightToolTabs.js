import React, { useEffect, useMemo, useRef } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import "./RightToolTabs.css";

const OBJECT_ORDER_DELAY_STEP_MS = 500;

function getFrameLabel(frame, index) {
    return frame?.name || `Frame ${index + 1}`;
}

function getElementLabel(element, index) {
    if (!element) return `Object ${index + 1}`;

    if (element.type === "text") {
        const text = String(element.text || "Text").trim();
        if (element.emojiObject) return `Emoji: ${text.slice(0, 10)}`;
        if (element.richTextObject) return `Rich text: ${text.slice(0, 24)}`;
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
            width: 244,
            height: 144,
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
            className={`right-frame-card ${active ? "active" : ""}`}
            onClick={onClick}
        >
            <canvas ref={canvasRef} width={244} height={144} />
            <div className="right-frame-card-footer">
                <strong>{getFrameLabel(frame, index)}</strong>
                <span>{frame?.elements?.length || 0} objects</span>
            </div>
        </button>
    );
}

export default function RightToolTabs({
    frames = [],
    currentFrameIndex = 0,
    canvasSize,
    canvasViewport,
    canvasProps,
    renderOptions = {},
    animationPlaying = false,
    animationTimeMs = 0,
    onSelectFrame,
    onAddFrameAfter,
    onDeleteFrame,
    onToggleElementHidden,
    onMoveFrameElementOrder,
    onApplyFrameObjectOrderTiming,
    onMergeFrameWithNext,
    onMergeAllFrames,
}) {
    const currentFrame = frames[currentFrameIndex] || frames[0] || null;

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

    return (
        <aside className="right-tool-tabs right-frames-only">
            <div className="right-tabs-header">
                <strong>Frames</strong>
                <span>Only frames live here. GIF tools are now in the left toolbar tab.</span>
            </div>

            <div className="right-frame-actions">
                <button type="button" onClick={onAddFrameAfter}>+ Add frame</button>
                <button
                    type="button"
                    onClick={onMergeFrameWithNext}
                    disabled={currentFrameIndex >= frames.length - 1}
                >
                    Merge next
                </button>
                <button
                    type="button"
                    onClick={onMergeAllFrames}
                    disabled={frames.length <= 1}
                >
                    Merge all
                </button>
                <button
                    type="button"
                    className="right-frame-danger"
                    onClick={() => onDeleteFrame?.(currentFrameIndex)}
                >
                    Delete
                </button>
            </div>

            <div className="right-frame-status-row">
                <span>{frames.length || 1} frames</span>
                <span>{animatedCount} animated here</span>
                <span>{totalAnimatedCount} total animated</span>
                {animationPlaying && <span>{Math.round(animationTimeMs)}ms</span>}
            </div>

            <div className="right-frames-scroll">
                <div className="right-frames-grid">
                    {(frames.length ? frames : [currentFrame]).map((frame, index) => (
                        <FrameThumbnail
                            key={frame?.id || index}
                            frame={frame}
                            index={index}
                            active={index === currentFrameIndex}
                            canvasSize={canvasSize}
                            canvasViewport={canvasViewport}
                            canvasProps={canvasProps}
                            renderOptions={renderOptions}
                            onClick={() => onSelectFrame?.(index)}
                        />
                    ))}
                </div>

                <div className="right-frame-object-list">
                    <div className="right-object-list-header">
                        <div>
                            <h3>Object order</h3>
                            <p>Top object comes first. Hide/show is frame-specific.</p>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                onApplyFrameObjectOrderTiming?.(currentFrameIndex, {
                                    delayStepMs: OBJECT_ORDER_DELAY_STEP_MS,
                                })
                            }
                            disabled={!animatedCount}
                        >
                            Apply timing
                        </button>
                    </div>

                    {!(currentFrame?.elements || []).length && (
                        <p className="right-frame-empty-text">No objects in this frame.</p>
                    )}

                    {(currentFrame?.elements || []).map((element, objectIndex) => {
                        const hidden = new Set(currentFrame?.hiddenElementIds || []).has(element.id);
                        const animationType = element?.animation?.type || "none";

                        return (
                            <div
                                key={element.id || objectIndex}
                                className={`right-frame-object-row ${hidden ? "hidden" : ""}`}
                            >
                                <span className="right-object-order-badge">#{objectIndex + 1}</span>
                                <span title={getElementLabel(element, objectIndex)}>{getElementLabel(element, objectIndex)}</span>
                                <em className={animationType === "none" ? "right-object-static-tag" : ""}>
                                    {animationType === "none" ? "static" : animationType}
                                </em>

                                <div className="right-object-order-actions">
                                    <button
                                        type="button"
                                        title="First"
                                        onClick={() => onMoveFrameElementOrder?.(currentFrameIndex, element.id, "first")}
                                        disabled={objectIndex === 0}
                                    >
                                        ⇤
                                    </button>
                                    <button
                                        type="button"
                                        title="Up"
                                        onClick={() => onMoveFrameElementOrder?.(currentFrameIndex, element.id, "up")}
                                        disabled={objectIndex === 0}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        title="Down"
                                        onClick={() => onMoveFrameElementOrder?.(currentFrameIndex, element.id, "down")}
                                        disabled={objectIndex === (currentFrame?.elements || []).length - 1}
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        title="Last"
                                        onClick={() => onMoveFrameElementOrder?.(currentFrameIndex, element.id, "last")}
                                        disabled={objectIndex === (currentFrame?.elements || []).length - 1}
                                    >
                                        ⇥
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="right-object-hide-btn"
                                    onClick={() => onToggleElementHidden?.(currentFrameIndex, element.id)}
                                >
                                    {hidden ? "Show" : "Hide"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}

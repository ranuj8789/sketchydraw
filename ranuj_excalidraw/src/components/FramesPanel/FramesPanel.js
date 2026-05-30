import React, { useEffect, useRef } from "react";
import { drawElement } from "../../utils/drawing";
import { getElementBounds } from "../../utils/elementBounds";
import "./FramesPanel.css";

function cloneElements(elements = []) {
    return JSON.parse(JSON.stringify(elements || []));
}

function getFrameBounds(elements = []) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    (elements || []).forEach((element) => {
        const bounds = getElementBounds(element);
        if (!bounds) return;

        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.w);
        maxY = Math.max(maxY, bounds.y + bounds.h);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

function drawNotebookPreview(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(37, 99, 235, 0.25)";
    ctx.lineWidth = 1;

    for (let y = 12; y <= height; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, height);
    ctx.stroke();
    ctx.restore();
}

function drawGridPreview(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y <= height; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    ctx.restore();
}

function FrameThumbnail({ frame, index, active, canvasProps, onClick }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const width = 140;
        const height = 82;

        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = canvasProps?.backgroundColor || "#ffffff";
        ctx.fillRect(0, 0, width, height);

        if (canvasProps?.pattern === "notebook") {
            drawNotebookPreview(ctx, width, height);
        } else if (canvasProps?.pattern === "grid") {
            drawGridPreview(ctx, width, height);
        }

        const elements = cloneElements(frame || []);
        const bounds = getFrameBounds(elements);

        if (!bounds) {
            ctx.save();
            ctx.fillStyle = "#94a3b8";
            ctx.font = "800 11px Inter, Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Empty frame", width / 2, height / 2);
            ctx.restore();
            return;
        }

        const padding = 12;
        const scale = Math.min(
            (width - padding * 2) / bounds.w,
            (height - padding * 2) / bounds.h,
            0.5
        );

        const offsetX = (width - bounds.w * scale) / 2 - bounds.x * scale;
        const offsetY = (height - bounds.h * scale) / 2 - bounds.y * scale;

        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        elements.forEach((element) => drawElement(ctx, element, false));
        ctx.restore();
    }, [frame, canvasProps]);

    return (
        <button
            type="button"
            className={active ? "frame-card active" : "frame-card"}
            onClick={onClick}
            title={`Open frame ${index + 1}`}
        >
            <canvas ref={canvasRef} />
            <span>Frame {index + 1}</span>
        </button>
    );
}

export default function FramesPanel({
                                        open,
                                        frames = [],
                                        currentIndex = 0,
                                        canvasProps = {},
                                        slideshowPlaying = false,
                                        onClose,
                                        onSelectFrame,
                                        onDeleteFrame,
                                        onAddFrameAfter,
                                        onToggleSlideshow,
                                    }) {
    if (!open) return null;

    return (
        <div className="frames-panel-backdrop" onMouseDown={onClose}>
            <div className="frames-panel" onMouseDown={(event) => event.stopPropagation()}>
                <div className="frames-panel-header">
                    <div>
                        <h2>Frames</h2>
                        <p>View slideshow frames, add the current canvas as a frame, or delete unwanted frames.</p>
                    </div>

                    <button type="button" className="frames-panel-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="frames-panel-actions">
                    <button type="button" onClick={() => onAddFrameAfter?.(currentIndex)}>
                        + Add current frame
                    </button>

                    <button type="button" onClick={onToggleSlideshow}>
                        {slideshowPlaying ? "Stop slideshow" : "Play slideshow"}
                    </button>

                    <span>
                        {frames.length} frame{frames.length === 1 ? "" : "s"}
                    </span>
                </div>

                <div className="frames-list">
                    {frames.map((frame, index) => (
                        <div className="frame-item" key={`frame-${index}`}>
                            <FrameThumbnail
                                frame={frame}
                                index={index}
                                active={index === currentIndex}
                                canvasProps={canvasProps}
                                onClick={() => onSelectFrame?.(index)}
                            />

                            <div className="frame-item-actions">
                                <button type="button" onClick={() => onAddFrameAfter?.(index)}>
                                    Add after
                                </button>

                                <button
                                    type="button"
                                    className="danger"
                                    disabled={frames.length <= 1}
                                    onClick={() => onDeleteFrame?.(index)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

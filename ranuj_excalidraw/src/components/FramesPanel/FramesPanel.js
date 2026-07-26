import React, { useEffect, useRef } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import "./FramesPanel.css";

function nameFor(frame, index) {
    return frame?.name || `Frame ${index + 1}`;
}


function FrameThumbnail({ frame, canvasSize, canvasViewport, canvasProps, active, onPlay }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        renderCanvas({
            canvas,
            canvasSize: canvasSize || { width: 1200, height: 700 },
            elements: frame?.elements || [],
            selectedIds: [],
            connectionHint: null,
            alignmentGuides: [],
            viewport: canvasViewport || { zoom: 1, offsetX: 0, offsetY: 0 },
            showGrid: false,
            canvasProps: canvasProps || {},
            renderOptions: {
                exportMode: true,
                animationMode: false,
                hiddenElementIds: new Set(frame?.hiddenElementIds || []),
            },
        });
    }, [frame, canvasSize, canvasViewport, canvasProps]);

    return (
        <div className={`frame-thumbnail ${active ? "active" : ""}`}>
            <canvas ref={canvasRef} aria-label="Frame preview" />
            <button
                type="button"
                className="frame-thumbnail-play"
                title="Play this frame"
                onClick={(event) => {
                    event.stopPropagation();
                    onPlay?.();
                }}
            >
                ▶
            </button>
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
                                        onClose,
                                        onSelectFrame,
                                        onAddFrameAfter,
                                        onDeleteFrame,
                                        onReorderFrames,
                                        onUpdateFrame,
                                        onMergeFrameWithNext,
                                        onPlayCurrent,
                                        onPlayAll,
                                    }) {
    if (!open) return null;

    const move = (from, direction) => {
        const to = direction === "up" ? from - 1 : from + 1;
        if (to >= 0 && to < frames.length) onReorderFrames?.(from, to);
    };

    return (
        <div className="frames-panel-backdrop" onMouseDown={onClose}>
            <section className="frames-manager-dialog" onMouseDown={(event) => event.stopPropagation()}>
                <header className="frames-manager-head">
                    <div>
                        <span>STORYBOARD</span>
                        <h2>Manage frames</h2>
                        <p>Set frame order, timing and transitions. Object animation stays on the canvas.</p>
                    </div>
                    <button type="button" className="frames-close-btn" onClick={onClose}>×</button>
                </header>

                <div className="frames-manager-toolbar">
                    <button type="button" className="frames-gold-btn" onClick={onPlayAll}>▶ Play all</button>
                    <button type="button" onClick={onPlayCurrent}>▶ Play selected</button>
                    <button type="button" onClick={onAddFrameAfter}>＋ Add frame</button>
                </div>

                <div className="frames-common-list">
                    <div className="frames-common-head">
                        <span>Order</span><span>Preview</span><span>Frame</span><span>Duration</span><span>Gap</span><span>Transition</span><span>Actions</span>
                    </div>
                    {frames.map((frame, index) => (
                        <div
                            key={frame.id || index}
                            className={`frames-common-row ${index === currentIndex ? "active" : ""}`}
                            onClick={() => onSelectFrame?.(index)}
                        >
                            <div className="frames-order-controls">
                                <strong>{index + 1}</strong>
                                <button type="button" disabled={index === 0} onClick={(event) => { event.stopPropagation(); move(index, "up"); }}>↑</button>
                                <button type="button" disabled={index === frames.length - 1} onClick={(event) => { event.stopPropagation(); move(index, "down"); }}>↓</button>
                            </div>
                            <FrameThumbnail
                                frame={frame}
                                canvasSize={canvasSize}
                                canvasViewport={canvasViewport}
                                canvasProps={canvasProps}
                                active={index === currentIndex}
                                onPlay={() => {
                                    onSelectFrame?.(index);
                                    window.setTimeout(() => onPlayCurrent?.(), 0);
                                }}
                            />
                            <div className="frames-name-cell">
                                <input value={nameFor(frame, index)} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { name: event.target.value })}/>
                                <small>{frame?.elements?.length || 0} objects</small>
                            </div>
                            <label><input type="number" min="0.5" step="0.1" value={((Number(frame.durationMs) || 1300) / 1000).toFixed(1)} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { durationMs: Math.round(Number(event.target.value) * 1000) })}/><span>s</span></label>
                            <label><input type="number" min="0" step="0.1" value={((Number(frame.gapAfterMs) || 0) / 1000).toFixed(1)} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { gapAfterMs: Math.round(Number(event.target.value) * 1000) })}/><span>s</span></label>
                            <select value={frame.transition || "none"} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateFrame?.(index, { transition: event.target.value })}>
                                <option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option>
                            </select>
                            <div className="frames-row-actions">
                                <button type="button" disabled={index === frames.length - 1} onClick={(event) => { event.stopPropagation(); onMergeFrameWithNext?.(index); }}>Merge next</button>
                                <button type="button" className="danger-link" disabled={frames.length <= 1} onClick={(event) => { event.stopPropagation(); onDeleteFrame?.(index); }}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>

                <footer className="frames-manager-footer">
                    <span>{frames.length || 1} frames · Drag/order controls define presentation order.</span>
                    <button type="button" onClick={onClose}>Done</button>
                </footer>
            </section>
        </div>
    );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderCanvas } from "../../canvas/canvasRender";
import { getFrameTimelineEndMs, resolveFrameAnimationTimings } from "../../canvas/animationTimeline";
import "./RightToolTabs.css";

const OBJECT_ORDER_DELAY_STEP_MS = 500;

function getFrameLabel(frame, index) {
    return frame?.name || `Frame ${index + 1}`;
}

function getElementLabel(element, index, allElements = []) {
    if (!element) return `Object ${index + 1}`;
    if (element.type === "text") {
        const text = String(element.text || "Text").replace(/\s+/g, " ").trim();
        return text ? `Text: ${text.slice(0, 36)}` : "Text";
    }
    if (element.type === "image") return element.fileName ? `Image: ${element.fileName}` : "Image";

    // Shapes are much easier to identify by the title drawn inside them than by labels
    // such as "rect 1". Pick the strongest text whose centre lies inside the shape.
    if (["rect", "ellipse", "diamond"].includes(element.type)) {
        const x = Number(element.x) || 0;
        const y = Number(element.y) || 0;
        const w = Number(element.w) || 0;
        const h = Number(element.h) || 0;
        const containedText = allElements
            .filter((item) => item?.type === "text" && item.id !== element.id)
            .filter((item) => {
                const cx = (Number(item.x) || 0) + (Number(item.w) || 0) / 2;
                const cy = (Number(item.y) || 0) + (Number(item.h) || 0) / 2;
                return cx >= x && cx <= x + w && cy >= y && cy <= y + h;
            })
            .sort((a, b) => (Number(b.fontSize) || 0) - (Number(a.fontSize) || 0));
        const title = String(containedText[0]?.text || "").replace(/\s+/g, " ").trim();
        if (title) return `${element.type}: ${title.slice(0, 32)}`;
    }

    return `${element.type || "Object"} ${index + 1}`;
}

function getDesktopSourceSize(canvasSize) {
    return { width: Math.max(1, Number(canvasSize?.width) || 1200), height: Math.max(1, Number(canvasSize?.height) || 700) };
}

function getScaledDesktopViewport(canvasViewport = {}, scale = 1, padX = 0, padY = 0) {
    return {
        zoom: Math.max(0.01, Number(canvasViewport.zoom) || 1) * scale,
        offsetX: (Number(canvasViewport.offsetX) || 0) * scale + padX,
        offsetY: (Number(canvasViewport.offsetY) || 0) * scale + padY,
    };
}

function getFrameRenderOptions(frame, baseOptions = {}, active = false) {
    return { ...(active ? baseOptions : {}), hiddenElementIds: new Set(frame?.hiddenElementIds || []) };
}

function FrameThumbnail({ frame, index, active, canvasSize, canvasViewport, canvasProps, renderOptions = {}, onClick }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const thumbSize = { width: 244, height: 144 };
        const sourceSize = getDesktopSourceSize(canvasSize);
        const scale = Math.min(thumbSize.width / sourceSize.width, thumbSize.height / sourceSize.height);
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

    return <button type="button" className={`right-frame-card ${active ? "active" : ""}`} onClick={onClick}>
        <canvas ref={canvasRef} width={244} height={144} />
        <div className="right-frame-card-footer"><strong>{getFrameLabel(frame, index)}</strong><span>{frame?.elements?.length || 0} objects</span></div>
    </button>;
}

export default function RightToolTabs({
                                          frames = [], currentFrameIndex = 0, canvasSize, canvasViewport, canvasProps,
                                          renderOptions = {}, animationPlaying = false, animationTimeMs = 0,
                                          onSelectFrame, onOpenPlayer, onAddFrameAfter, onDeleteFrame,
                                          onToggleElementHidden, onMoveFrameElementOrder, onApplyFrameObjectOrderTiming,
                                          onUpdateFrameElementAnimation, onPreviewTimeChange, onToggleFrameAnimation,
                                          onMergeFrameWithNext, onMergeAllFrames,
                                          selectedCanvasObjectId = null, onSelectCanvasObject,
                                      }) {
    const [pinned, setPinned] = useState(() => {
        try { return window.localStorage.getItem("sketchydraw_frames_sidebar_pinned") !== "false"; }
        catch { return true; }
    });
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [editorTab, setEditorTab] = useState("animation");
    const objectRowRefs = useRef(new Map());

    const currentFrame = frames[currentFrameIndex] || frames[0] || null;
    const currentElements = currentFrame?.elements || [];
    const resolvedTimings = useMemo(() => resolveFrameAnimationTimings(currentElements), [currentElements]);
    const timelineEndMs = useMemo(() => Math.max(1000, getFrameTimelineEndMs(currentElements)), [currentElements]);

    useEffect(() => {
        if (!currentElements.length) {
            setSelectedObjectId(null);
            return;
        }

        // Canvas selection is the source of truth whenever it belongs to this frame.
        if (selectedCanvasObjectId && currentElements.some((item) => item.id === selectedCanvasObjectId)) {
            setSelectedObjectId(selectedCanvasObjectId);
            return;
        }

        if (!currentElements.some((item) => item.id === selectedObjectId)) {
            setSelectedObjectId(currentElements[0].id);
        }
    }, [currentFrameIndex, currentElements, selectedCanvasObjectId, selectedObjectId]);

    useEffect(() => {
        if (!selectedObjectId) return;
        const row = objectRowRefs.current.get(selectedObjectId);
        row?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }, [selectedObjectId]);

    const selectedObject = currentElements.find((item) => item.id === selectedObjectId) || currentElements[0] || null;
    const selectedIndex = Math.max(0, currentElements.findIndex((item) => item.id === selectedObject?.id));
    const selectedAnimation = selectedObject?.animation || {};
    const selectedTiming = selectedObject ? (resolvedTimings.get(selectedObject.id) || { startMs: 0, endMs: 0 }) : { startMs: 0, endMs: 0 };

    const animatedCount = useMemo(() => currentElements.filter((e) => e?.animation?.type && e.animation.type !== "none").length, [currentElements]);
    const totalAnimatedCount = useMemo(() => frames.reduce((sum, f) => sum + (f?.elements || []).filter((e) => e?.animation?.type && e.animation.type !== "none").length, 0), [frames]);

    const togglePinned = () => setPinned((value) => {
        const next = !value;
        try { window.localStorage.setItem("sketchydraw_frames_sidebar_pinned", String(next)); } catch {}
        return next;
    });

    if (!pinned) return <aside className="right-tool-tabs right-frames-only unpinned"><button type="button" className="right-frames-rail-btn" onClick={togglePinned}><span>📌</span><strong>Frames</strong><em>{frames.length || 1}</em></button></aside>;

    const hiddenSet = new Set(currentFrame?.hiddenElementIds || []);

    return <aside className="right-tool-tabs right-frames-only pinned">
        <div className="right-tabs-header"><div><strong>Frames</strong><span>Select an object to edit its exact visibility, delay and dependency.</span></div><button type="button" className="right-pin-btn" onClick={togglePinned}>📌 Pinned</button></div>

        <div className="right-frame-actions">
            <button type="button" className="right-frame-play" onClick={() => onOpenPlayer?.("current")} disabled={!currentFrame}>▶ Play frame</button>
            <button type="button" className="right-frame-play" onClick={() => onOpenPlayer?.("all")} disabled={!frames.length}>▶ Play all</button>
            <button type="button" onClick={onAddFrameAfter}>+ Add frame</button>
            <button type="button" onClick={onMergeFrameWithNext} disabled={currentFrameIndex >= frames.length - 1}>Merge next</button>
            <button type="button" onClick={onMergeAllFrames} disabled={frames.length <= 1}>Merge all</button>
            <button type="button" className="right-frame-danger" onClick={() => onDeleteFrame?.(currentFrameIndex)}>Delete</button>
        </div>

        <div className="right-frame-status-row"><span>{frames.length || 1} frames</span><span>{animatedCount} animated here</span><span>{totalAnimatedCount} total animated</span>{animationPlaying && <span>{Math.round(animationTimeMs)}ms</span>}</div>

        <div className="right-frames-scroll">
            <div className="right-frames-grid">{(frames.length ? frames : [currentFrame]).map((frame, index) => <FrameThumbnail key={frame?.id || index} frame={frame} index={index} active={index === currentFrameIndex} canvasSize={canvasSize} canvasViewport={canvasViewport} canvasProps={canvasProps} renderOptions={renderOptions} onClick={() => onSelectFrame?.(index)} />)}</div>

            <section className="right-live-timeline">
                <div className="right-live-head"><div><h3>Live frame preview</h3><p>Delay keeps already shown objects visible while you explain.</p></div><strong>{(animationTimeMs / 1000).toFixed(1)}s / {(timelineEndMs / 1000).toFixed(1)}s</strong></div>
                <input type="range" min="0" max={timelineEndMs} step="50" value={Math.min(animationTimeMs, timelineEndMs)} onChange={(event) => onPreviewTimeChange?.(Number(event.target.value))} />
                <div className="right-live-actions"><button onClick={() => onPreviewTimeChange?.(0)}>Start</button><button className="primary" onClick={onToggleFrameAnimation}>{animationPlaying ? "Pause" : "Play frame"}</button><button onClick={() => onPreviewTimeChange?.(timelineEndMs)}>Final state</button></div>
            </section>

            <div className="right-frame-object-list">
                <div className="right-object-list-header"><div><h3>Objects in this frame</h3><p>Click any row. The editor below stays open.</p></div><button type="button" onClick={() => onApplyFrameObjectOrderTiming?.(currentFrameIndex, { delayStepMs: OBJECT_ORDER_DELAY_STEP_MS })} disabled={!animatedCount}>Auto sequence</button></div>

                {currentElements.map((element, objectIndex) => {
                    const hidden = hiddenSet.has(element.id);
                    const animation = element?.animation || {};
                    const animationType = animation.type || "none";
                    const timing = resolvedTimings.get(element.id) || { startMs: 0, endMs: 0 };
                    const visibleNow = !hidden && (animationType === "none" ? animation.staticVisible !== false : animationTimeMs < timing.startMs ? (animation.beforeStart || "hidden") === "visible" : animationTimeMs > timing.endMs ? (animation.afterEnd || "visible") !== "hidden" : true);
                    return <div key={element.id || objectIndex} ref={(node) => { if (node) objectRowRefs.current.set(element.id, node); else objectRowRefs.current.delete(element.id); }} className={`right-frame-object-row selectable ${hidden ? "hidden" : ""} ${selectedObject?.id === element.id ? "selected" : ""}`} onClick={() => { setSelectedObjectId(element.id); onSelectCanvasObject?.(element.id); }}>
                        <span className="right-object-order-badge">#{objectIndex + 1}</span>
                        <span title={getElementLabel(element, objectIndex, currentElements)}>{getElementLabel(element, objectIndex, currentElements)}</span>
                        <em>{animationType === "none" ? "static" : animationType}</em>
                        <b className={visibleNow ? "visible" : "hidden-now"}>{visibleNow ? "VISIBLE" : "HIDDEN"}</b>
                        <div className="right-object-order-actions">
                            <button title="Up" onClick={(event) => { event.stopPropagation(); onMoveFrameElementOrder?.(currentFrameIndex, element.id, "up"); }} disabled={objectIndex === 0}>↑</button>
                            <button title="Down" onClick={(event) => { event.stopPropagation(); onMoveFrameElementOrder?.(currentFrameIndex, element.id, "down"); }} disabled={objectIndex === currentElements.length - 1}>↓</button>
                        </div>
                        <button type="button" className="right-object-hide-btn" onClick={(event) => { event.stopPropagation(); onToggleElementHidden?.(currentFrameIndex, element.id); }}>{hidden ? "Show" : "Hide"}</button>
                    </div>;
                })}

                {selectedObject && <div className="right-selected-timing-card" key={`${currentFrameIndex}-${selectedObject.id}`}>
                    <div className="right-selected-hero">
                        <div className="right-selected-object-mark">{selectedObject.type === "text" ? "T" : selectedObject.type === "arrow" ? "→" : "□"}</div>
                        <div className="right-selected-title"><div><span>Object #{selectedIndex + 1}</span><strong>{getElementLabel(selectedObject, selectedIndex, currentElements)}</strong></div><em>{(selectedTiming.startMs / 1000).toFixed(1)}s → {(selectedTiming.endMs / 1000).toFixed(1)}s</em></div>
                    </div>

                    <div className="right-selected-actions">
                        <button type="button" onClick={() => onPreviewTimeChange?.(Math.max(0, selectedTiming.startMs - 250))}>Preview before</button>
                        <button type="button" className="primary" onClick={() => onPreviewTimeChange?.(selectedTiming.startMs)}>Preview object</button>
                        <button type="button" onClick={() => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, {
                            durationMs: selectedObject.type === "arrow" ? 2600 : selectedObject.type === "text" ? 1500 : 1900,
                            beforeStart: "hidden",
                            afterEnd: "visible",
                        })}>Slow diagram</button>
                    </div>

                    <div className="right-selected-tabs" role="tablist" aria-label="Object animation editor">
                        <button type="button" className={editorTab === "animation" ? "active" : ""} onClick={() => setEditorTab("animation")}>Animation</button>
                        <button type="button" className={editorTab === "timing" ? "active" : ""} onClick={() => setEditorTab("timing")}>Timing & dependency</button>
                        <button type="button" className={editorTab === "visibility" ? "active" : ""} onClick={() => setEditorTab("visibility")}>Visibility</button>
                    </div>

                    {editorTab === "animation" && <div className="right-selected-panel">
                        <label className="wide">Animation style<select value={selectedAnimation.type || "none"} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, { type: e.target.value })}><option value="none">Static</option><option value="fadeIn">Fade in</option><option value="scaleIn">Scale in</option><option value="slideUp">Slide up</option><option value="draw">Draw line / arrow</option><option value="movingHead">Moving arrow head</option><option value="typewriter">Typewriter</option><option value="pulseRing">Pulse ring</option></select></label>
                        <div className="right-selected-help"><strong>Educational pacing</strong><span>Boxes: 1.6–2.2s · arrows: 2.2–3.0s · text: 1.2–1.8s</span></div>
                    </div>}

                    {editorTab === "timing" && <div className="right-selected-panel two-column">
                        <label>Start rule<select value={selectedAnimation.dependencyMode || "absolute"} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, { dependencyMode: e.target.value })}><option value="absolute">At exact time</option><option value="afterStart">After object starts</option><option value="afterEnd">After object finishes</option></select></label>
                        <label>Duration (ms)<input type="number" min="100" step="100" value={selectedAnimation.durationMs || 1000} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, { durationMs: Number(e.target.value) })} /></label>
                        {(selectedAnimation.dependencyMode === "afterStart" || selectedAnimation.dependencyMode === "afterEnd") && <label className="wide">Depends on<select value={selectedAnimation.dependsOnId || ""} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, { dependsOnId: e.target.value })}><option value="">Choose previous object</option>{currentElements.filter((item) => item.id !== selectedObject.id).map((item, index) => <option key={item.id} value={item.id}>{getElementLabel(item, index, currentElements)}</option>)}</select></label>}
                        <label className={selectedAnimation.dependencyMode && selectedAnimation.dependencyMode !== "absolute" ? "wide" : ""}>{selectedAnimation.dependencyMode && selectedAnimation.dependencyMode !== "absolute" ? "Explanation pause after dependency (ms)" : "Start at (ms)"}<input type="number" min="0" step="100" value={selectedAnimation.dependencyMode && selectedAnimation.dependencyMode !== "absolute" ? (selectedAnimation.dependencyOffsetMs || 0) : (selectedAnimation.delayMs || 0)} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, selectedAnimation.dependencyMode && selectedAnimation.dependencyMode !== "absolute" ? { dependencyOffsetMs: Number(e.target.value) } : { delayMs: Number(e.target.value) })} /></label>
                        <div className="right-selected-help wide"><strong>How delay works</strong><span>Already completed objects remain visible. Only this object waits for its turn.</span></div>
                    </div>}

                    {editorTab === "visibility" && <div className="right-selected-panel two-column">
                        <label>Before animation<select value={selectedAnimation.beforeStart || "hidden"} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, { beforeStart: e.target.value })}><option value="hidden">Hidden until its turn</option><option value="visible">Visible during explanation</option></select></label>
                        <label>After animation<select value={selectedAnimation.afterEnd || "visible"} onChange={(e) => onUpdateFrameElementAnimation?.(currentFrameIndex, selectedObject.id, { afterEnd: e.target.value })}><option value="visible">Keep visible</option><option value="hidden">Hide after animation</option></select></label>
                        <div className="right-selected-help wide"><strong>Recommended for diagrams</strong><span>Before: hidden · After: keep visible. This lets the architecture build step by step.</span></div>
                    </div>}

                    <div className="right-selected-track-label"><span>Frame start</span><strong>{((selectedTiming.endMs - selectedTiming.startMs) / 1000).toFixed(1)}s animation</strong><span>{(timelineEndMs / 1000).toFixed(1)}s</span></div>
                    <div className="right-selected-mini-track"><span style={{ width: `${Math.min(100, selectedTiming.startMs / timelineEndMs * 100)}%` }} /><b style={{ width: `${Math.max(1, (selectedTiming.endMs - selectedTiming.startMs) / timelineEndMs * 100)}%` }} /></div>
                </div>}
            </div>
        </div>
    </aside>;
}

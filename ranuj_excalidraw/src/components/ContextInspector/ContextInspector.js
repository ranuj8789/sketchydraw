import React from "react";
import "./ContextInspector.css";
import { hasProAccess, requestProUpgrade } from "../../utils/proFeatureGate";

function labelFor(element) {
    if (!element) return "Selected object";
    if (element.type === "text") return String(element.text || "Untitled text").trim().slice(0, 36) || "Untitled text";
    if (element.type === "image") return element.fileName || "Image";
    return String(element.type || "Object").replace(/(^|_)(\w)/g, (_, p, c) => `${p ? " " : ""}${c.toUpperCase()}`);
}

export default function ContextInspector({
                                             frame,
                                             frameIndex,
                                             selectedElement,
                                             selectedOrder,
                                             totalObjects,
                                             onCloseSelection,
                                             onUpdateAnimation,
                                             onMoveObject,
                                             onPreviewObject,
                                             onUpdateFrame,
                                             onPlayFrame,
                                         }) {
    if (!frame) return null;

    const proUser = hasProAccess();
    if (!proUser) {
        return selectedElement ? (
            <aside className="context-inspector object-mode pro-locked-inspector">
                <div className="context-inspector-head">
                    <div><span>ANIMATION</span><strong>Unlock object animation</strong></div>
                    <button type="button" onClick={onCloseSelection} aria-label="Close object inspector">×</button>
                </div>
                <p className="inspector-help">Animate objects, control timing, and preview motion with SketchyDraw Pro.</p>
                <button type="button" className="inspector-play" onClick={() => requestProUpgrade("Object animation")}>Unlock Pro</button>
            </aside>
        ) : null;
    }

    if (!selectedElement) {
        return (
            <aside className="context-inspector frame-mode">
                <div className="context-inspector-head">
                    <div><span>FRAME {frameIndex + 1}</span><strong>{frame.name || `Frame ${frameIndex + 1}`}</strong></div>
                </div>
                <label>Frame duration
                    <div className="inspector-input-unit"><input type="number" min="0.5" step="0.1" value={((Number(frame.durationMs) || 1300) / 1000).toFixed(1)} onChange={(event) => onUpdateFrame?.({ durationMs: Math.round(Number(event.target.value) * 1000) })}/><span>sec</span></div>
                </label>
                <label>Gap after frame
                    <div className="inspector-input-unit"><input type="number" min="0" step="0.1" value={((Number(frame.gapAfterMs) || 0) / 1000).toFixed(1)} onChange={(event) => onUpdateFrame?.({ gapAfterMs: Math.round(Number(event.target.value) * 1000) })}/><span>sec</span></div>
                </label>
                <label>Transition
                    <select value={frame.transition || "none"} onChange={(event) => onUpdateFrame?.({ transition: event.target.value })}>
                        <option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option>
                    </select>
                </label>
                <button type="button" className="inspector-play" onClick={onPlayFrame}>▶ Play frame</button>
            </aside>
        );
    }

    const animation = selectedElement.animation || {};
    const type = animation.type || "none";

    return (
        <aside className="context-inspector object-mode">
            <div className="context-inspector-head">
                <div><span>SELECTED OBJECT</span><strong>{labelFor(selectedElement)}</strong></div>
                <button type="button" onClick={onCloseSelection} aria-label="Close object inspector">×</button>
            </div>
            <div className="object-order-row">
                <span>Order in frame</span>
                <strong>{selectedOrder + 1} / {totalObjects}</strong>
                <div><button type="button" disabled={selectedOrder <= 0} onClick={() => onMoveObject?.("up")}>←</button><button type="button" disabled={selectedOrder >= totalObjects - 1} onClick={() => onMoveObject?.("down")}>→</button></div>
            </div>
            <label>Animation
                <select value={type} onChange={(event) => onUpdateAnimation?.({ type: event.target.value })}>
                    <option value="none">Static</option><option value="fadeIn">Fade in</option><option value="scaleIn">Scale in</option><option value="slideUp">Slide up</option><option value="draw">Draw</option><option value="typewriter">Typewriter</option>
                </select>
            </label>
            <div className="inspector-two-col">
                <label>Delay<div className="inspector-input-unit"><input type="number" min="0" step="0.1" disabled={type === "none"} value={((Number(animation.delayMs) || 0) / 1000).toFixed(1)} onChange={(event) => onUpdateAnimation?.({ delayMs: Math.round(Number(event.target.value) * 1000) })}/><span>sec</span></div></label>
                <label>Duration<div className="inspector-input-unit"><input type="number" min="0.1" step="0.1" disabled={type === "none"} value={((Number(animation.durationMs) || 1000) / 1000).toFixed(1)} onChange={(event) => onUpdateAnimation?.({ durationMs: Math.round(Number(event.target.value) * 1000) })}/><span>sec</span></div></label>
            </div>
            <button type="button" className="inspector-play" onClick={onPreviewObject}>▶ Preview object</button>
            <p className="inspector-help">Animation settings appear only for the object selected on this frame.</p>
        </aside>
    );
}

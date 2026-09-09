import React from "react";

export default function CameraPathOverlay({ frame, nextFrame, canvasSize, viewport, onChange }) {
    const keys = Array.isArray(frame?.cameraKeyframes) ? frame.cameraKeyframes : [];
    if (keys.length < 2 && !nextFrame?.camera) return null;
    const centerFor = (camera) => {
        const zoom = Math.max(.05, Number(camera.zoom) || 1);
        const worldX = ((Number(canvasSize.width) || 1200) / 2 - (Number(camera.offsetX) || 0)) / zoom;
        const worldY = ((Number(canvasSize.height) || 700) / 2 - (Number(camera.offsetY) || 0)) / zoom;
        return { x: worldX * viewport.zoom + viewport.offsetX, y: worldY * viewport.zoom + viewport.offsetY };
    };
    const points = keys.map(centerFor);
    const updateKeyCenter = (index, clientX, clientY, svg) => {
        const rect = svg.getBoundingClientRect();
        const screenX = (clientX - rect.left) * canvasSize.width / Math.max(1, rect.width);
        const screenY = (clientY - rect.top) * canvasSize.height / Math.max(1, rect.height);
        const worldX = (screenX - viewport.offsetX) / viewport.zoom;
        const worldY = (screenY - viewport.offsetY) / viewport.zoom;
        const key = keys[index]; const zoom = Math.max(.05, Number(key.zoom) || 1);
        const next = keys.map((item, itemIndex) => itemIndex === index ? { ...item, offsetX: canvasSize.width / 2 - worldX * zoom, offsetY: canvasSize.height / 2 - worldY * zoom } : item);
        onChange?.(next);
    };
    const nextBoundary = nextFrame?.camera ? (() => {
        const camera = nextFrame.camera; const zoom = Math.max(.05, Number(camera.zoom) || 1);
        const left = -(Number(camera.offsetX) || 0) / zoom;
        const top = -(Number(camera.offsetY) || 0) / zoom;
        return { x: left * viewport.zoom + viewport.offsetX, y: top * viewport.zoom + viewport.offsetY, w: canvasSize.width / zoom * viewport.zoom, h: canvasSize.height / zoom * viewport.zoom };
    })() : null;
    return (
        <svg className="camera-path-overlay" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} aria-hidden="true">
            {nextBoundary && <rect className="camera-next-boundary" x={nextBoundary.x} y={nextBoundary.y} width={nextBoundary.w} height={nextBoundary.h} />}
            <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
            {points.map((point, index) => <g key={index} className="camera-key-handle"
                onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); updateKeyCenter(index, event.clientX, event.clientY, event.currentTarget.ownerSVGElement); }}
                onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture?.(event.pointerId)) updateKeyCenter(index, event.clientX, event.clientY, event.currentTarget.ownerSVGElement); }}
                onDoubleClick={() => onChange?.(keys.filter((_, itemIndex) => itemIndex !== index))}
                onClick={(event) => { if (!event.altKey && !event.shiftKey) return; const target = event.altKey ? Math.max(0, index - 1) : Math.min(keys.length - 1, index + 1); if (target === index) return; const next = [...keys]; [next[index], next[target]] = [next[target], next[index]]; onChange?.(next); }}>
                <circle cx={point.x} cy={point.y} r="9"/><text x={point.x} y={point.y + 4}>{index + 1}</text></g>)}
        </svg>
    );
}

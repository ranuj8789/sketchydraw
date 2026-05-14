export function screenToWorld(point, viewport) {
    return {
        x: (point.x - viewport.offsetX) / viewport.zoom,
        y: (point.y - viewport.offsetY) / viewport.zoom,
    };
}

export function worldToScreen(point, viewport) {
    return {
        x: point.x * viewport.zoom + viewport.offsetX,
        y: point.y * viewport.zoom + viewport.offsetY,
    };
}

export function clampZoom(zoom) {
    return Math.max(0.2, Math.min(4, zoom));
}
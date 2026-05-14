export function uid() {
    return Math.random().toString(36).slice(2, 10);
}

export function distance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

export function getPointerPosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
}

export function normalizeRect(x1, y1, x2, y2) {
    return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
    };
}

export function isPointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
}

export function isPointNearLine(px, py, x1, y1, x2, y2, threshold = 6) {
    const lineLength = distance(x1, y1, x2, y2);
    if (lineLength === 0) return distance(px, py, x1, y1) <= threshold;

    const t = Math.max(
        0,
        Math.min(
            1,
            ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (lineLength * lineLength)
        )
    );

    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);

    return distance(px, py, projX, projY) <= threshold;
}

export function isPointInEllipse(px, py, x, y, w, h) {
    if (w === 0 || h === 0) return false;
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    return ((px - cx) ** 2) / (rx ** 2) + ((py - cy) ** 2) / (ry ** 2) <= 1;
}
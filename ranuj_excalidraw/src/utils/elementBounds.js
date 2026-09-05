import { isSystemDesignType } from "../canvas/canvasConstants";

export function getElementBounds(element) {
    if (!element) return null;

    if (
        element.type === "rect" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "user" ||
        element.type === "webgl3d" ||
        isSystemDesignType(element.type) ||
        element.type === "image"
    ) {
        const w = element.w || 0;
        const h = element.h || 0;

        return {
            x: w < 0 ? element.x + w : element.x,
            y: h < 0 ? element.y + h : element.y,
            w: Math.abs(w),
            h: Math.abs(h),
        };
    }

    if (element.type === "text") {
        const w = element.w || 120;
        const h = element.h || 32;

        return {
            x: w < 0 ? element.x + w : element.x,
            y: h < 0 ? element.y + h : element.y,
            w: Math.abs(w),
            h: Math.abs(h),
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        const extraXs = [element.x1, element.x2];
        const extraYs = [element.y1, element.y2];

        if (element.lineStyle === "curved") {
            extraXs.push(element.cx1 ?? element.x1, element.cx2 ?? element.x2);
            extraYs.push(element.cy1 ?? element.y1, element.cy2 ?? element.y2);
        }

        const x = Math.min(...extraXs);
        const y = Math.min(...extraYs);
        const maxX = Math.max(...extraXs);
        const maxY = Math.max(...extraYs);

        return {x, y, w: maxX - x, h: maxY - y};
    }

    if (element.type === "pencil") {
        if (!element.points || element.points.length === 0) return null;

        const xs = element.points.map((p) => p.x);
        const ys = element.points.map((p) => p.y);

        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;

        return {x, y, w, h};
    }

    return null;
}

export function getResizeHandles(element) {
    const bounds = getElementBounds(element);
    if (!bounds) return null;

    const {x, y, w, h} = bounds;

    return {
        nw: {x, y},
        n: {x: x + w / 2, y},
        ne: {x: x + w, y},

        w: {x, y: y + h / 2},
        e: {x: x + w, y: y + h / 2},

        sw: {x, y: y + h},
        s: {x: x + w / 2, y: y + h},
        se: {x: x + w, y: y + h},
    };
}

export function getResizeHandleAtPoint(element, px, py, zoom = 1) {
    const bounds = getElementBounds(element);
    const handles = getResizeHandles(element);

    if (!bounds || !handles) return null;
    if (element.type === "pencil") return null;

    const safeZoom = zoom || 1;
    const size = 8 / safeZoom;

    // 1. First check exact corner / side handle points.
    for (const [key, point] of Object.entries(handles)) {
        const withinX = px >= point.x - size && px <= point.x + size;
        const withinY = py >= point.y - size && py <= point.y + size;

        if (withinX && withinY) return key;
    }

    // Generic resize uses only the visible square handles.
    return null;
}

export function getRectangleBorderResizeHandleAtPoint(element, px, py, zoom = 1) {
    if (!element || (element.type !== "rect" && element.type !== "rectangle")) {
        return null;
    }

    const bounds = getElementBounds(element);
    if (!bounds) return null;

    const safeZoom = Math.max(0.1, Number(zoom) || 1);
    const threshold = 5 / safeZoom;

    const left = bounds.x;
    const right = bounds.x + bounds.w;
    const top = bounds.y;
    const bottom = bounds.y + bounds.h;

    // Do not use a large invisible hit area. The pointer must be on the real
    // rectangle border, with only a small tolerance for usability.
    const withinX = px >= left - threshold && px <= right + threshold;
    const withinY = py >= top - threshold && py <= bottom + threshold;

    if (!withinX || !withinY) return null;

    const nearLeft = Math.abs(px - left) <= threshold;
    const nearRight = Math.abs(px - right) <= threshold;
    const nearTop = Math.abs(py - top) <= threshold;
    const nearBottom = Math.abs(py - bottom) <= threshold;

    if (nearTop && nearLeft) return "nw";
    if (nearTop && nearRight) return "ne";
    if (nearBottom && nearLeft) return "sw";
    if (nearBottom && nearRight) return "se";
    if (nearTop) return "n";
    if (nearBottom) return "s";
    if (nearLeft) return "w";
    if (nearRight) return "e";

    return null;
}


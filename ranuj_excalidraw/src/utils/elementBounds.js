export function getElementBounds(element) {
    if (!element) return null;

    if (
        element.type === "rect" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond"
    ) {
        return {
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
        };
    }

    if (element.type === "text") {
        return {
            x: element.x,
            y: element.y,
            w: element.w || 120,
            h: element.h || 32,
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        const x = Math.min(element.x1, element.x2);
        const y = Math.min(element.y1, element.y2);
        const w = Math.abs(element.x2 - element.x1);
        const h = Math.abs(element.y2 - element.y1);
        return { x, y, w, h };
    }

    if (element.type === "pencil") {
        if (!element.points || element.points.length === 0) return null;

        const xs = element.points.map((p) => p.x);
        const ys = element.points.map((p) => p.y);

        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;

        return { x, y, w, h };
    }

    return null;
}

export function getResizeHandles(element) {
    const bounds = getElementBounds(element);
    if (!bounds) return null;

    const { x, y, w, h } = bounds;

    return {
        nw: { x, y },
        n: { x: x + w / 2, y },
        ne: { x: x + w, y },

        w: { x, y: y + h / 2 },
        e: { x: x + w, y: y + h / 2 },

        sw: { x, y: y + h },
        s: { x: x + w / 2, y: y + h },
        se: { x: x + w, y: y + h },
    };
}

export function getResizeHandleAtPoint(element, px, py) {
    const bounds = getElementBounds(element);
    const handles = getResizeHandles(element);

    if (!bounds || !handles) return null;

    const size = 8;

    // 1. First check exact handle points
    for (const [key, point] of Object.entries(handles)) {
        const withinX = px >= point.x - size && px <= point.x + size;
        const withinY = py >= point.y - size && py <= point.y + size;

        if (withinX && withinY) return key;
    }

    // 2. Then allow resize from edges also
    const edgeThreshold = 8;

    const left = bounds.x;
    const right = bounds.x + bounds.w;
    const top = bounds.y;
    const bottom = bounds.y + bounds.h;

    const withinHorizontalRange = px >= left && px <= right;
    const withinVerticalRange = py >= top && py <= bottom;

    const nearTop = Math.abs(py - top) <= edgeThreshold && withinHorizontalRange;
    const nearBottom = Math.abs(py - bottom) <= edgeThreshold && withinHorizontalRange;
    const nearLeft = Math.abs(px - left) <= edgeThreshold && withinVerticalRange;
    const nearRight = Math.abs(px - right) <= edgeThreshold && withinVerticalRange;

    if (nearTop) return "n";
    if (nearBottom) return "s";
    if (nearLeft) return "w";
    if (nearRight) return "e";

    return null;
}
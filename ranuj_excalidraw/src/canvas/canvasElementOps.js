function getStraightControlPoints(x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return {
        cx1: midX,
        cy1: midY,
        cx2: midX,
        cy2: midY,
    };
}

export function getStableStraightLineEnd(start, point) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const distance = Math.hypot(dx, dy);

    if (distance < 2) {
        return point;
    }

    const axisSnap = Math.max(18, distance * 0.18);

    if (absDy <= axisSnap) {
        return { x: point.x, y: start.y };
    }

    if (absDx <= axisSnap) {
        return { x: start.x, y: point.y };
    }

    const diagonalSnap = Math.max(18, distance * 0.16);

    if (Math.abs(absDx - absDy) <= diagonalSnap) {
        const size = Math.max(absDx, absDy);

        return {
            x: start.x + Math.sign(dx || 1) * size,
            y: start.y + Math.sign(dy || 1) * size,
        };
    }

    return point;
}

export function moveElement(element, dx, dy) {
    if (element.type === "pencil") {
        return {
            ...element,
            points: (element.points || []).map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
            })),
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        const fallbackMidX = (element.x1 + element.x2) / 2;
        const fallbackMidY = (element.y1 + element.y2) / 2;

        return {
            ...element,
            x1: element.x1 + dx,
            y1: element.y1 + dy,
            x2: element.x2 + dx,
            y2: element.y2 + dy,
            cx1: (element.cx1 ?? fallbackMidX) + dx,
            cy1: (element.cy1 ?? fallbackMidY) + dy,
            cx2: (element.cx2 ?? fallbackMidX) + dx,
            cy2: (element.cy2 ?? fallbackMidY) + dy,
        };
    }

    return {
        ...element,
        x: element.x + dx,
        y: element.y + dy,
    };
}

function roundCoordinate(value, fallback = 0) {
    const parsed = Number(value);
    return Math.round(Number.isFinite(parsed) ? parsed : fallback);
}

export function normalizeElementGeometry(element) {
    if (!element || element.type === "pencil") return element;

    if (element.type === "line" || element.type === "arrow") {
        const x1 = roundCoordinate(element.x1);
        const y1 = roundCoordinate(element.y1);
        const x2 = roundCoordinate(element.x2);
        const y2 = roundCoordinate(element.y2);
        return {
            ...element,
            x1,
            y1,
            x2,
            y2,
            cx1: roundCoordinate(element.cx1, (x1 + x2) / 2),
            cy1: roundCoordinate(element.cy1, (y1 + y2) / 2),
            cx2: roundCoordinate(element.cx2, (x1 + x2) / 2),
            cy2: roundCoordinate(element.cy2, (y1 + y2) / 2),
        };
    }

    const next = { ...element };
    if (Object.prototype.hasOwnProperty.call(element, "x")) next.x = roundCoordinate(element.x);
    if (Object.prototype.hasOwnProperty.call(element, "y")) next.y = roundCoordinate(element.y);
    if (Object.prototype.hasOwnProperty.call(element, "w")) next.w = roundCoordinate(element.w);
    if (Object.prototype.hasOwnProperty.call(element, "h")) next.h = roundCoordinate(element.h);
    return next;
}

export function normalizeElementsGeometry(elements = []) {
    return (elements || []).map(normalizeElementGeometry);
}

export function updateDrawnElement(element, dragState, point) {
    if (!element) return element;

    if (element.type === "line" || element.type === "arrow") {
        const x1 = element.x1;
        const y1 = element.y1;
        const stableEnd = getStableStraightLineEnd({ x: x1, y: y1 }, point);
        const x2 = stableEnd.x;
        const y2 = stableEnd.y;

        return {
            ...element,
            x2,
            y2,
            lineStyle: "straight",
            ...getStraightControlPoints(x1, y1, x2, y2),
        };
    }

    if (element.type === "pencil") {
        const points = element.points || [];
        const lastPoint = points[points.length - 1];

        if (
            lastPoint &&
            Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) < 1.5
        ) {
            return element;
        }

        return {
            ...element,
            points: [...points, { x: point.x, y: point.y }],
        };
    }

    return {
        ...element,
        w: point.x - dragState.startX,
        h: point.y - dragState.startY,
    };
}

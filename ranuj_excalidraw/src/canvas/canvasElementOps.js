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

    // Make straight lines stable: a small mouse shake near the tip should not
    // break horizontal/vertical alignment.
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
            points: element.points.map((point) => ({
                x: point.x + dx,
                y: point.y + dy,
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
        return {
            ...element,
            points: [...element.points, { x: point.x, y: point.y }],
        };
    }

    return {
        ...element,
        w: point.x - dragState.startX,
        h: point.y - dragState.startY,
    };
}
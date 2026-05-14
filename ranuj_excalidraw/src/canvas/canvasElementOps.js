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

    if ((element.type === "line" || element.type === "arrow") && element.lineStyle === "curved") {
        return {
            ...element,
            points: element.points.map((point) => ({
                x: point.x + dx,
                y: point.y + dy,
            })),
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        return {
            ...element,
            x1: element.x1 + dx,
            y1: element.y1 + dy,
            x2: element.x2 + dx,
            y2: element.y2 + dy,
            cx1: (element.cx1 ?? element.x1) + dx,
            cy1: (element.cy1 ?? element.y1) + dy,
            cx2: (element.cx2 ?? element.x2) + dx,
            cy2: (element.cy2 ?? element.y2) + dy,
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

    if ((element.type === "line" || element.type === "arrow") && element.lineStyle === "curved") {
        const points = element.points || [];
        if (points.length === 0) {
            return {
                ...element,
                points: [{ x: point.x, y: point.y }],
            };
        }

        const nextPoints = [...points];
        nextPoints[nextPoints.length - 1] = { x: point.x, y: point.y };

        const prev = nextPoints[nextPoints.length - 2];
        const dx = prev ? Math.abs(prev.x - point.x) : 999;
        const dy = prev ? Math.abs(prev.y - point.y) : 999;

        if (dx > 8 || dy > 8) {
            nextPoints.push({ x: point.x, y: point.y });
        }

        return {
            ...element,
            points: nextPoints,
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        const x1 = element.x1;
        const y1 = element.y1;
        const x2 = point.x;
        const y2 = point.y;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        return {
            ...element,
            x2,
            y2,
            cx1: midX,
            cy1: midY,
            cx2: midX,
            cy2: midY,
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
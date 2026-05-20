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
        const x2 = point.x;
        const y2 = point.y;

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
import { getElementBounds } from "../utils/elementBounds";

export function getBindableShapes(elements) {
    return elements.filter(
        (el) =>
            el.type === "rect" ||
            el.type === "ellipse" ||
            el.type === "diamond"
    );
}

export function getElementCenter(element) {
    const bounds = getElementBounds(element);
    if (!bounds) return null;

    return {
        x: bounds.x + bounds.w / 2,
        y: bounds.y + bounds.h / 2,
    };
}

export function getClosestPointOnBounds(element, point) {
    const bounds = getElementBounds(element);
    if (!bounds) return null;

    const x = Math.max(bounds.x, Math.min(point.x, bounds.x + bounds.w));
    const y = Math.max(bounds.y, Math.min(point.y, bounds.y + bounds.h));

    return { x, y };
}

// ⭐ UPDATED: return highlight info cleanly
export function findBindableShapeNearPoint(elements, point, threshold = 14) {
    const shapes = getBindableShapes(elements);

    let best = null;

    for (const shape of shapes) {
        const bounds = getElementBounds(shape);
        if (!bounds) continue;

        const closest = getClosestPointOnBounds(shape, point);
        const dx = closest.x - point.x;
        const dy = closest.y - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= threshold) {
            if (!best || dist < best.dist) {
                best = {
                    shapeId: shape.id,   // ⭐ important
                    shape,
                    point: closest,
                    dist,
                };
            }
        }
    }

    return best;
}
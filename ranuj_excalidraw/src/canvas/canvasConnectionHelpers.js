import { getElementBounds } from "../utils/elementBounds";

export function isConnectorElement(element) {
    return element?.type === "line" || element?.type === "arrow";
}

export function getBindableShapes(elements, options = {}) {
    const excludeIds = new Set(options.excludeIds || []);

    return (elements || []).filter(
        (el) =>
            el &&
            !excludeIds.has(el.id) &&
            !isConnectorElement(el) &&
            (
                el.type === "rect" ||
                el.type === "rectangle" ||
                el.type === "ellipse" ||
                el.type === "diamond" ||
                el.type === "image" ||
                el.type === "text"
            )
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

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

export function getClosestPointOnBounds(element, point) {
    const bounds = getElementBounds(element);
    if (!bounds) return null;

    const left = bounds.x;
    const right = bounds.x + bounds.w;
    const top = bounds.y;
    const bottom = bounds.y + bounds.h;

    const clampedX = clamp(point.x, left, right);
    const clampedY = clamp(point.y, top, bottom);

    const inside =
        point.x >= left &&
        point.x <= right &&
        point.y >= top &&
        point.y <= bottom;

    if (!inside) {
        return {
            x: clampedX,
            y: clampedY,
        };
    }

    const distLeft = Math.abs(point.x - left);
    const distRight = Math.abs(right - point.x);
    const distTop = Math.abs(point.y - top);
    const distBottom = Math.abs(bottom - point.y);
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) return { x: left, y: clampedY };
    if (minDist === distRight) return { x: right, y: clampedY };
    if (minDist === distTop) return { x: clampedX, y: top };

    return { x: clampedX, y: bottom };
}

export function createBindingForPoint(shape, point) {
    const bounds = getElementBounds(shape);

    if (!bounds || !bounds.w || !bounds.h) {
        return {
            elementId: shape.id,
            anchorX: 0.5,
            anchorY: 0.5,
        };
    }

    const exactPoint = getClosestPointOnBounds(shape, point) || point;

    return {
        elementId: shape.id,
        anchorX: clamp((exactPoint.x - bounds.x) / bounds.w, 0, 1),
        anchorY: clamp((exactPoint.y - bounds.y) / bounds.h, 0, 1),
    };
}

export function getPointFromBinding(shape, binding) {
    const bounds = getElementBounds(shape);
    if (!bounds) return null;

    const anchorX = typeof binding?.anchorX === "number" ? binding.anchorX : 0.5;
    const anchorY = typeof binding?.anchorY === "number" ? binding.anchorY : 0.5;

    return {
        x: bounds.x + bounds.w * anchorX,
        y: bounds.y + bounds.h * anchorY,
    };
}

export function findBindableShapeNearPoint(elements, point, threshold = 14, options = {}) {
    const shapes = getBindableShapes(elements, options);
    let best = null;

    for (const shape of shapes) {
        const closest = getClosestPointOnBounds(shape, point);
        if (!closest) continue;

        const dx = closest.x - point.x;
        const dy = closest.y - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= threshold) {
            if (!best || dist < best.dist) {
                best = {
                    shapeId: shape.id,
                    shape,
                    point: closest,
                    dist,
                    binding: createBindingForPoint(shape, closest),
                };
            }
        }
    }

    return best;
}

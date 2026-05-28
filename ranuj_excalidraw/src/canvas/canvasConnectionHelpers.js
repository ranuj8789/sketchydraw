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

function normalizeBounds(bounds) {
    const x1 = Math.min(bounds.x, bounds.x + bounds.w);
    const y1 = Math.min(bounds.y, bounds.y + bounds.h);
    const x2 = Math.max(bounds.x, bounds.x + bounds.w);
    const y2 = Math.max(bounds.y, bounds.y + bounds.h);

    return {
        x: x1,
        y: y1,
        w: Math.max(1, x2 - x1),
        h: Math.max(1, y2 - y1),
        left: x1,
        top: y1,
        right: x2,
        bottom: y2,
    };
}

function getClosestPointOnRectBounds(bounds, point) {
    const b = normalizeBounds(bounds);

    const clampedX = clamp(point.x, b.left, b.right);
    const clampedY = clamp(point.y, b.top, b.bottom);

    const inside =
        point.x >= b.left &&
        point.x <= b.right &&
        point.y >= b.top &&
        point.y <= b.bottom;

    if (!inside) {
        return {
            x: clampedX,
            y: clampedY,
        };
    }

    const distLeft = Math.abs(point.x - b.left);
    const distRight = Math.abs(b.right - point.x);
    const distTop = Math.abs(point.y - b.top);
    const distBottom = Math.abs(b.bottom - point.y);
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    if (minDist === distLeft) return { x: b.left, y: clampedY };
    if (minDist === distRight) return { x: b.right, y: clampedY };
    if (minDist === distTop) return { x: clampedX, y: b.top };

    return { x: clampedX, y: b.bottom };
}

/**
 * This is the important function.
 *
 * It finds where the connector line from `fromPoint` to `toPoint`
 * touches the shape box.
 *
 * Example:
 * line starts left side, mouse near rectangle left edge
 * => attach to rectangle left edge at same Y
 * => no jump to top/bottom/right.
 */
function getLineRectIntersectionPoint(bounds, fromPoint, toPoint) {
    if (!bounds || !fromPoint || !toPoint) {
        return null;
    }

    const b = normalizeBounds(bounds);

    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;

    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
        return getClosestPointOnRectBounds(b, toPoint);
    }

    const candidates = [];

    if (Math.abs(dx) > 0.0001) {
        const tLeft = (b.left - fromPoint.x) / dx;
        const yLeft = fromPoint.y + tLeft * dy;

        if (tLeft >= 0 && yLeft >= b.top && yLeft <= b.bottom) {
            candidates.push({
                x: b.left,
                y: yLeft,
                t: tLeft,
            });
        }

        const tRight = (b.right - fromPoint.x) / dx;
        const yRight = fromPoint.y + tRight * dy;

        if (tRight >= 0 && yRight >= b.top && yRight <= b.bottom) {
            candidates.push({
                x: b.right,
                y: yRight,
                t: tRight,
            });
        }
    }

    if (Math.abs(dy) > 0.0001) {
        const tTop = (b.top - fromPoint.y) / dy;
        const xTop = fromPoint.x + tTop * dx;

        if (tTop >= 0 && xTop >= b.left && xTop <= b.right) {
            candidates.push({
                x: xTop,
                y: b.top,
                t: tTop,
            });
        }

        const tBottom = (b.bottom - fromPoint.y) / dy;
        const xBottom = fromPoint.x + tBottom * dx;

        if (tBottom >= 0 && xBottom >= b.left && xBottom <= b.right) {
            candidates.push({
                x: xBottom,
                y: b.bottom,
                t: tBottom,
            });
        }
    }

    if (!candidates.length) {
        return getClosestPointOnRectBounds(b, toPoint);
    }

    candidates.sort((a, b) => a.t - b.t);

    return {
        x: candidates[0].x,
        y: candidates[0].y,
    };
}

export function getClosestPointOnBounds(element, point, fromPoint = null) {
    const bounds = getElementBounds(element);
    if (!bounds) return null;

    if (fromPoint) {
        return getLineRectIntersectionPoint(bounds, fromPoint, point);
    }

    return getClosestPointOnRectBounds(bounds, point);
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

    const b = normalizeBounds(bounds);

    return {
        elementId: shape.id,
        anchorX: clamp((point.x - b.x) / b.w, 0, 1),
        anchorY: clamp((point.y - b.y) / b.h, 0, 1),
    };
}

export function getPointFromBinding(shape, binding) {
    const bounds = getElementBounds(shape);
    if (!bounds) return null;

    const b = normalizeBounds(bounds);

    const anchorX = typeof binding?.anchorX === "number" ? binding.anchorX : 0.5;
    const anchorY = typeof binding?.anchorY === "number" ? binding.anchorY : 0.5;

    return {
        x: b.x + b.w * anchorX,
        y: b.y + b.h * anchorY,
    };
}

export function findBindableShapeNearPoint(elements, point, threshold = 14, options = {}) {
    const shapes = getBindableShapes(elements, options);
    const fromPoint = options.fromPoint || null;

    let best = null;

    for (const shape of shapes) {
        const closest = getClosestPointOnBounds(shape, point, fromPoint);
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
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = (value) => Math.max(0, Math.min(1, finite(value)));
const smooth = (value) => value * value * (3 - 2 * value);

function interpolate(left, right, key, fallback, progress) {
    return finite(left?.[key], fallback) + (finite(right?.[key], fallback) - finite(left?.[key], fallback)) * progress;
}

export function has2DTransformAnimation(element) {
    return element?.type !== "webgl3d" && Array.isArray(element?.transformKeyframes) && element.transformKeyframes.length > 0;
}

export function get2DTransformEndMs(element) {
    if (!has2DTransformAnimation(element)) return 0;
    return element.transformKeyframes.reduce((maximum, key) => Math.max(maximum, Math.max(0, finite(key?.timeMs))), 0);
}

export function resolve2DElementTransform(element, timeMs = 0) {
    if (!has2DTransformAnimation(element)) return element;
    const keys = element.transformKeyframes.filter(Boolean).slice().sort((a, b) => finite(a.timeMs) - finite(b.timeMs));
    if (!keys.length) return element;

    const now = Math.max(0, finite(timeMs));
    const rightIndex = keys.findIndex((key) => finite(key.timeMs) >= now);
    let left;
    let right;
    let progress = 0;
    if (rightIndex <= 0) {
        left = right = keys[0];
    } else if (rightIndex < 0) {
        left = right = keys[keys.length - 1];
    } else {
        left = keys[rightIndex - 1];
        right = keys[rightIndex];
        progress = smooth(clamp01((now - finite(left.timeMs)) / Math.max(1, finite(right.timeMs) - finite(left.timeMs))));
    }

    const result = { ...element };
    ["x", "y", "w", "h", "rotation", "opacity"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(element, key) || left?.[key] !== undefined || right?.[key] !== undefined) {
            result[key] = interpolate(left, right, key, finite(element[key]), progress);
        }
    });

    if (Object.prototype.hasOwnProperty.call(element, "x1")) {
        ["x1", "y1", "x2", "y2", "cx1", "cy1", "cx2", "cy2"].forEach((key) => {
            result[key] = interpolate(left, right, key, finite(element[key]), progress);
        });
    }

    const scale = interpolate(left, right, "scale2d", 1, progress);
    if (scale !== 1 && Number.isFinite(result.x) && Number.isFinite(result.y) && Number.isFinite(result.w) && Number.isFinite(result.h)) {
        const centerX = result.x + result.w / 2;
        const centerY = result.y + result.h / 2;
        result.w *= scale;
        result.h *= scale;
        result.x = centerX - result.w / 2;
        result.y = centerY - result.h / 2;
    }
    return result;
}

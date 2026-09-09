const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = (value) => Math.max(0, Math.min(1, number(value)));
const smooth = (t) => t * t * (3 - 2 * t);

export function resolve3DTransform(element, timeMs = 0) {
    const base = {
        x: number(element?.x), y: number(element?.y), z: number(element?.z),
        rotationX: number(element?.rotationX, -18), rotationY: number(element?.rotationY, 28),
        rotationZ: number(element?.rotationZ), scale3d: Math.max(.05, number(element?.scale3d, 1)),
        opacity: Math.max(0, Math.min(1, number(element?.opacity, 1))), materialColor: element?.materialColor || element?.fill || "#e2e8f0",
    };
    const keys = (Array.isArray(element?.transformKeyframes) ? element.transformKeyframes : [])
        .filter(Boolean).slice().sort((a, b) => number(a.timeMs) - number(b.timeMs));
    if (!keys.length) return base;
    const now = Math.max(0, number(timeMs));
    const rightIndex = keys.findIndex((key) => number(key.timeMs) >= now);
    if (rightIndex === 0) return { ...base, ...keys[0] };
    if (rightIndex < 0) return { ...base, ...keys[keys.length - 1] };
    const left = { ...base, ...keys[rightIndex - 1] };
    const right = { ...base, ...keys[rightIndex] };
    const span = Math.max(1, number(right.timeMs) - number(left.timeMs));
    const t = smooth(clamp01((now - number(left.timeMs)) / span));
    const result = { ...left };
    ["x", "y", "z", "rotationX", "rotationY", "rotationZ", "scale3d", "opacity"].forEach((key) => {
        result[key] = number(left[key], base[key]) + (number(right[key], base[key]) - number(left[key], base[key])) * t;
    });
    result.materialColor = t < .5 ? (left.materialColor || base.materialColor) : (right.materialColor || base.materialColor);
    return result;
}

export function resolve3DStep(element, timeMs = 0) {
    const steps = Array.isArray(element?.codeSteps) ? element.codeSteps : [];
    if (!steps.length) return { index: -1, step: null, progress: 0 };
    const duration = Math.max(100, number(element?.stepDurationMs, 900));
    const index = Math.min(steps.length - 1, Math.floor(Math.max(0, number(timeMs)) / duration));
    return { index, step: steps[index], progress: (Math.max(0, number(timeMs)) % duration) / duration };
}

export function resolveDataPathPoint(element, timeMs = 0) {
    const path = Array.isArray(element?.dataPath3d) ? element.dataPath3d : [];
    if (path.length < 2) return null;
    const duration = Math.max(100, number(element?.pathDurationMs, 2200));
    const cursor = ((Math.max(0, number(timeMs)) % duration) / duration) * (path.length - 1);
    const index = Math.min(path.length - 2, Math.floor(cursor));
    const t = smooth(cursor - index);
    const a = path[index]; const b = path[index + 1];
    return {
        x: number(a.x) + (number(b.x) - number(a.x)) * t,
        y: number(a.y) + (number(b.y) - number(a.y)) * t,
        z: number(a.z) + (number(b.z) - number(a.z)) * t,
    };
}

export function resolve3DOrbit(element, timeMs = 0) {
    const keys = (Array.isArray(element?.orbitKeyframes) ? element.orbitKeyframes : []).filter(Boolean).slice().sort((a, b) => number(a.timeMs) - number(b.timeMs));
    const base = { yaw: number(element?.cameraYaw), pitch: number(element?.cameraPitch, 12), distance: number(element?.cameraDistance, 900), targetX: number(element?.cameraTargetX), targetY: number(element?.cameraTargetY), targetZ: number(element?.cameraTargetZ) };
    if (!keys.length) return base;
    const now = Math.max(0, number(timeMs)); const right = keys.findIndex((key) => number(key.timeMs) >= now);
    if (right === 0) return { ...base, ...keys[0] }; if (right < 0) return { ...base, ...keys[keys.length - 1] };
    const a = { ...base, ...keys[right - 1] }, b = { ...base, ...keys[right] };
    const t = smooth(clamp01((now - number(a.timeMs)) / Math.max(1, number(b.timeMs) - number(a.timeMs))));
    const result = { ...a }; ["yaw","pitch","distance","targetX","targetY","targetZ"].forEach((key) => { result[key] = number(a[key], base[key]) + (number(b[key], base[key]) - number(a[key], base[key])) * t; });
    return result;
}

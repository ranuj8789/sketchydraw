export function is3DElement(element) {
    return element?.type === "webgl3d";
}

export function getElementBounds3D(element) {
    if (!is3DElement(element)) return null;
    const w = Number(element.w) || 0;
    const h = Number(element.h) || 0;
    return {
        x: w < 0 ? (Number(element.x) || 0) + w : Number(element.x) || 0,
        y: h < 0 ? (Number(element.y) || 0) + h : Number(element.y) || 0,
        w: Math.abs(w),
        h: Math.abs(h),
    };
}

export function getResizeHandles3D(element) {
    const bounds = getElementBounds3D(element);
    if (!bounds) return null;
    const { x, y, w, h } = bounds;
    return {
        nw: {x, y}, n: {x: x + w / 2, y}, ne: {x: x + w, y},
        w: {x, y: y + h / 2}, e: {x: x + w, y: y + h / 2},
        sw: {x, y: y + h}, s: {x: x + w / 2, y: y + h}, se: {x: x + w, y: y + h},
    };
}

export function getResizeHandleAtPoint3D(element, px, py, zoom = 1) {
    const handles = getResizeHandles3D(element);
    if (!handles) return null;
    const size = 8 / (zoom || 1);
    for (const [key, point] of Object.entries(handles)) {
        if (px >= point.x - size && px <= point.x + size && py >= point.y - size && py <= point.y + size) return key;
    }
    return null;
}

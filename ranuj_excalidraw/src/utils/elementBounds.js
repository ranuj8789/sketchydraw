import {
    getElementBounds as getElementBounds2D,
    getResizeHandles as getResizeHandles2D,
    getResizeHandleAtPoint as getResizeHandleAtPoint2D,
    getRectangleBorderResizeHandleAtPoint as getRectangleBorderResizeHandleAtPoint2D,
} from "./elementBounds2d";
import {
    getElementBounds3D,
    getResizeHandles3D,
    getResizeHandleAtPoint3D,
    is3DElement,
} from "./elementBounds3d";

export function getElementBounds(element) {
    return is3DElement(element) ? getElementBounds3D(element) : getElementBounds2D(element);
}

export function getResizeHandles(element) {
    return is3DElement(element) ? getResizeHandles3D(element) : getResizeHandles2D(element);
}

export function getResizeHandleAtPoint(element, px, py, zoom = 1) {
    return is3DElement(element)
        ? getResizeHandleAtPoint3D(element, px, py, zoom)
        : getResizeHandleAtPoint2D(element, px, py, zoom);
}

export function getRectangleBorderResizeHandleAtPoint(element, px, py, zoom = 1) {
    if (is3DElement(element)) return null;
    return getRectangleBorderResizeHandleAtPoint2D(element, px, py, zoom);
}

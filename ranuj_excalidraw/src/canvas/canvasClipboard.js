import { uid } from "../utils/geometry";
import { getElementBounds } from "../utils/elementBounds";

export const SKETCHYDRAW_CLIPBOARD_TYPE = "sketchydraw/clipboard";
export const EXCALIDRAW_CLIPBOARD_TYPE = "excalidraw/clipboard";

export const SUPPORTED_CLIPBOARD_TYPES = [
    SKETCHYDRAW_CLIPBOARD_TYPE,
    EXCALIDRAW_CLIPBOARD_TYPE,
];

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getElementWorldBounds(element) {
    const bounds = getElementBounds(element);

    if (bounds) return bounds;

    if (element?.type === "line" || element?.type === "arrow") {
        const minX = Math.min(element.x1 || 0, element.x2 || 0);
        const minY = Math.min(element.y1 || 0, element.y2 || 0);
        const maxX = Math.max(element.x1 || 0, element.x2 || 0);
        const maxY = Math.max(element.y1 || 0, element.y2 || 0);

        return {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
        };
    }

    if (element?.type === "pencil" && Array.isArray(element.points)) {
        const xs = element.points.map((point) => point.x);
        const ys = element.points.map((point) => point.y);

        if (!xs.length || !ys.length) return null;

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        return {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
        };
    }

    return null;
}

export function getElementsBounds(elements = []) {
    const boundsList = (elements || [])
        .map(getElementWorldBounds)
        .filter(Boolean);

    if (!boundsList.length) return null;

    const minX = Math.min(...boundsList.map((bounds) => bounds.x));
    const minY = Math.min(...boundsList.map((bounds) => bounds.y));
    const maxX = Math.max(...boundsList.map((bounds) => bounds.x + bounds.w));
    const maxY = Math.max(...boundsList.map((bounds) => bounds.y + bounds.h));

    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

function moveElementBy(element, dx, dy) {
    const copy = {
        ...element,
    };

    if ("x" in copy) copy.x += dx;
    if ("y" in copy) copy.y += dy;

    if ("x1" in copy) copy.x1 += dx;
    if ("y1" in copy) copy.y1 += dy;
    if ("x2" in copy) copy.x2 += dx;
    if ("y2" in copy) copy.y2 += dy;

    if (Array.isArray(copy.points)) {
        copy.points = copy.points.map((point) => ({
            ...point,
            x: point.x + dx,
            y: point.y + dy,
        }));
    }

    return copy;
}

export function createSketchyClipboardPayload(elements = []) {
    return {
        type: SKETCHYDRAW_CLIPBOARD_TYPE,
        app: "SketchyDraw",
        version: 1,
        elements: deepClone(elements),
    };
}

export function parseSketchyClipboardText(text) {
    if (!text || typeof text !== "string") return null;

    const trimmed = text.trim();

    if (!trimmed.startsWith("{")) return null;

    try {
        const parsed = JSON.parse(trimmed);

        if (
            SUPPORTED_CLIPBOARD_TYPES.includes(parsed?.type) &&
            Array.isArray(parsed.elements)
        ) {
            return deepClone(parsed.elements);
        }

        return null;
    } catch {
        return null;
    }
}

export async function writeElementsToSystemClipboard(elements = []) {
    const payload = createSketchyClipboardPayload(elements);
    const text = JSON.stringify(payload);

    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (error) {
        console.warn("System clipboard write failed", error);
    }

    return false;
}

export async function readElementsFromSystemClipboard() {
    try {
        if (!navigator?.clipboard?.readText) return null;

        const text = await navigator.clipboard.readText();
        return parseSketchyClipboardText(text);
    } catch (error) {
        console.warn("System clipboard read failed", error);
        return null;
    }
}

export function cloneElementsForPaste(items, options = {}) {
    const {
        offset = 24,
        pastePoint = null,
    } = options;

    const sourceItems = deepClone(items || []);
    const sourceBounds = getElementsBounds(sourceItems);

    let dx = offset;
    let dy = offset;

    if (pastePoint && sourceBounds) {
        const sourceCenterX = sourceBounds.x + sourceBounds.w / 2;
        const sourceCenterY = sourceBounds.y + sourceBounds.h / 2;

        dx = pastePoint.x - sourceCenterX;
        dy = pastePoint.y - sourceCenterY;
    }

    const idMap = new Map();

    const cloned = sourceItems.map((element) => {
        const newId = uid();
        idMap.set(element.id, newId);

        const moved = moveElementBy(element, dx, dy);

        return {
            ...moved,
            id: newId,
        };
    });

    return cloned.map((element) => ({
        ...element,
        parentId: element.parentId ? idMap.get(element.parentId) || null : null,
        arrowStartBinding: element.arrowStartBinding
            ? {
                ...element.arrowStartBinding,
                elementId:
                    idMap.get(element.arrowStartBinding.elementId) ||
                    element.arrowStartBinding.elementId,
            }
            : element.arrowStartBinding,
        arrowEndBinding: element.arrowEndBinding
            ? {
                ...element.arrowEndBinding,
                elementId:
                    idMap.get(element.arrowEndBinding.elementId) ||
                    element.arrowEndBinding.elementId,
            }
            : element.arrowEndBinding,
    }));
}
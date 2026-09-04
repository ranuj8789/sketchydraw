import { isSystemDesignType } from "./canvasConstants";
import { DEFAULT_TEXT_STYLE } from "./textStyle";
import { measureTextBox } from "./textMetrics";

export const DRAWING_SCHEMA_VERSION = 2;

export const DEFAULT_CANVAS_PROPS = {
    backgroundColor: "#ffffff",
    pattern: "blank",
    cornerRadius: 16,
};

function normalizeCanvasProps(canvasProps = {}) {
    return {
        ...DEFAULT_CANVAS_PROPS,
        ...(canvasProps || {}),
    };
}

export function createDrawingJson({
                                      elements = [],
                                      viewport = { zoom: 1, offsetX: 0, offsetY: 0 },
                                      canvasSize = { width: 1200, height: 700 },
                                      canvasProps = DEFAULT_CANVAS_PROPS,
                                      name = "Untitled Drawing",
                                      frames = [],
                                      activeFrameIndex = 0,
                                  }) {
    const now = new Date().toISOString();
    const finalCanvasProps = normalizeCanvasProps(canvasProps);

    return {
        schemaVersion: DRAWING_SCHEMA_VERSION,
        app: "SketchyDraw",
        name,
        createdAt: now,
        updatedAt: now,
        canvas: {
            width: canvasSize.width,
            height: canvasSize.height,
            background: finalCanvasProps.pattern || "blank",
        },
        canvasProps: finalCanvasProps,
        viewport: {
            zoom: viewport.zoom,
            offsetX: viewport.offsetX,
            offsetY: viewport.offsetY,
        },
        elements: elements.map(normalizeElementForSave),
        frames: (Array.isArray(frames) ? frames : []).map((frame, index) => ({
            id: frame?.id || `frame_${index + 1}`,
            name: frame?.name || `Frame ${index + 1}`,
            durationMs: Math.max(1000, Number(frame?.durationMs) || 10000),
            hiddenElementIds: Array.isArray(frame?.hiddenElementIds)
                ? [...frame.hiddenElementIds]
                : [],
            elements: (Array.isArray(frame?.elements) ? frame.elements : [])
                .map(normalizeElementForSave),
        })),
        activeFrameIndex: Math.max(0, Number(activeFrameIndex) || 0),
        currentFrameIndex: Math.max(0, Number(activeFrameIndex) || 0),
    };
}

export function normalizeElementForSave(element) {
    const base = {
        id: element.id,
        type: element.type,
        stroke: element.stroke || "#111827",
        fill: element.fill || "transparent",
        strokeWidth: element.strokeWidth || 2,
        strokeDash: element.strokeDash || "solid",
        opacity: element.opacity ?? 1,
        codeIllustrator: !!element.codeIllustrator,
        animation: element.animation
            ? { ...element.animation }
            : undefined,
    };

    if (
        element.type === "rect" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "user" ||
        isSystemDesignType(element.type)
    ) {
        return {
            ...base,
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
            cornerRadius: element.cornerRadius ?? 0,
        };
    }

    if (element.type === "text") {
        return {
            ...base,
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
            text: element.text || "",
            fontSize: element.fontSize || DEFAULT_TEXT_STYLE.fontSize,
            lineHeight: element.lineHeight || DEFAULT_TEXT_STYLE.lineHeight,
            fontFamily: element.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
            bold: !!element.bold,
            italic: !!element.italic,
            underline: !!element.underline,
            textAlign: element.textAlign || DEFAULT_TEXT_STYLE.textAlign,
            parentId: element.parentId || null,
            richText: Array.isArray(element.richText)
                ? element.richText.map((range) => ({ ...range }))
                : [],
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        return {
            ...base,
            x1: element.x1,
            y1: element.y1,
            x2: element.x2,
            y2: element.y2,
            cx1: element.cx1 ?? element.x1,
            cy1: element.cy1 ?? element.y1,
            cx2: element.cx2 ?? element.x2,
            cy2: element.cy2 ?? element.y2,
            lineStyle: element.lineStyle || "straight",
            arrowStart: !!element.arrowStart,
            arrowEnd:
                element.type === "arrow"
                    ? element.arrowEnd !== false
                    : !!element.arrowEnd,
            startBinding: element.startBinding || null,
            endBinding: element.endBinding || null,
        };
    }

    if (element.type === "pencil") {
        return {
            ...base,
            points: Array.isArray(element.points) ? element.points : [],
        };
    }

    return {
        ...base,
        ...element,
    };
}

function roundFinite(value, fallback = 0) {
    const parsed = Number(value);
    return Math.round(Number.isFinite(parsed) ? parsed : fallback);
}

export function normalizeElementForLoad(element) {
    if (!element || typeof element !== "object") return element;

    const normalized = { ...element };

    if (element.type === "line" || element.type === "arrow") {
        normalized.x1 = roundFinite(element.x1);
        normalized.y1 = roundFinite(element.y1);
        normalized.x2 = roundFinite(element.x2);
        normalized.y2 = roundFinite(element.y2);
        normalized.cx1 = roundFinite(element.cx1, (normalized.x1 + normalized.x2) / 2);
        normalized.cy1 = roundFinite(element.cy1, (normalized.y1 + normalized.y2) / 2);
        normalized.cx2 = roundFinite(element.cx2, (normalized.x1 + normalized.x2) / 2);
        normalized.cy2 = roundFinite(element.cy2, (normalized.y1 + normalized.y2) / 2);
        return normalized;
    }

    if (element.type !== "pencil") {
        if (Object.prototype.hasOwnProperty.call(element, "x")) normalized.x = roundFinite(element.x);
        if (Object.prototype.hasOwnProperty.call(element, "y")) normalized.y = roundFinite(element.y);
        if (Object.prototype.hasOwnProperty.call(element, "w")) normalized.w = roundFinite(element.w, 1);
        if (Object.prototype.hasOwnProperty.call(element, "h")) normalized.h = roundFinite(element.h, 1);
    }

    if (element.type === "text") {
        const fontSize = Math.max(1, roundFinite(element.fontSize, DEFAULT_TEXT_STYLE.fontSize));
        const lineHeight = Math.max(1, roundFinite(element.lineHeight, DEFAULT_TEXT_STYLE.lineHeight));
        const textStyle = {
            ...DEFAULT_TEXT_STYLE,
            ...element,
            fontSize,
            lineHeight,
            fontFamily: element.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
            textAlign: element.textAlign || DEFAULT_TEXT_STYLE.textAlign,
        };
        const measured = measureTextBox(element.text || " ", textStyle);

        normalized.fontSize = fontSize;
        normalized.lineHeight = lineHeight;
        normalized.fontFamily = textStyle.fontFamily;
        normalized.textAlign = textStyle.textAlign;
        normalized.bold = element.bold ?? DEFAULT_TEXT_STYLE.bold;
        normalized.italic = element.italic ?? DEFAULT_TEXT_STYLE.italic;
        normalized.underline = element.underline ?? DEFAULT_TEXT_STYLE.underline;
        normalized.w = Math.max(1, roundFinite(element.w, measured.w));
        normalized.h = Math.max(1, roundFinite(element.h, measured.h));
        normalized.parentId = element.parentId || null;
        normalized.richText = Array.isArray(element.richText)
            ? element.richText.map((range) => ({ ...range }))
            : [];
    }

    return normalized;
}

function normalizeFrameForLoad(frame, index) {
    return {
        ...(frame || {}),
        id: frame?.id || `frame_${index + 1}`,
        name: frame?.name || `Frame ${index + 1}`,
        durationMs: Math.max(1000, Number(frame?.durationMs) || 10000),
        hiddenElementIds: Array.isArray(frame?.hiddenElementIds)
            ? [...frame.hiddenElementIds]
            : [],
        elements: (Array.isArray(frame?.elements) ? frame.elements : [])
            .map(normalizeElementForLoad),
    };
}

export function validateDrawingJson(json) {
    if (!json || typeof json !== "object") {
        throw new Error("Invalid drawing JSON");
    }

    const actualDrawing = json.data || json;

    const hasElements = Array.isArray(actualDrawing.elements);
    const hasFrames = Array.isArray(actualDrawing.frames) ||
        Array.isArray(actualDrawing.timelineFrames);

    if (!hasElements && !hasFrames) {
        throw new Error("Drawing JSON must contain elements or frames");
    }

    return true;
}

export function loadDrawingJson(json) {
    validateDrawingJson(json);

    const actualDrawing = json.data || json;

    const rawFrames = Array.isArray(actualDrawing.frames)
        ? actualDrawing.frames
        : Array.isArray(actualDrawing.timelineFrames)
            ? actualDrawing.timelineFrames
            : [];
    const frames = rawFrames.map(normalizeFrameForLoad);
    const rawElements = Array.isArray(actualDrawing.elements)
        ? actualDrawing.elements
        : (rawFrames[0]?.elements || []);

    return {
        elements: rawElements.map(normalizeElementForLoad),
        viewport: actualDrawing.viewport || { zoom: 1, offsetX: 0, offsetY: 0 },
        canvasSize: {
            width: actualDrawing.canvas?.width || 1200,
            height: actualDrawing.canvas?.height || 700,
        },
        canvasProps:
            actualDrawing.canvasProps ||
            json.canvasProps ||
            DEFAULT_CANVAS_PROPS,
        name:
            actualDrawing.name ||
            json.title ||
            json.name ||
            "Untitled Drawing",
        frames,
        activeFrameIndex:
            actualDrawing.activeFrameIndex ??
            actualDrawing.currentFrameIndex ??
            0,
    };
}

export function downloadDrawingJson(drawingJson, fileName = "sketchy-drawing.json") {
    const blob = new Blob([JSON.stringify(drawingJson, null, 2)], {
        type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
}

export function readDrawingJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result);
                validateDrawingJson(json);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

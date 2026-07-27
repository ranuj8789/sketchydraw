import { isSystemDesignType } from "./canvasConstants";
export const DRAWING_SCHEMA_VERSION = 1;

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
            fontSize: element.fontSize || 20,
            lineHeight: element.lineHeight || 24,
            fontFamily: element.fontFamily || '"Caveat", cursive',
            bold: !!element.bold,
            italic: !!element.italic,
            underline: !!element.underline,
            textAlign: element.textAlign || "left",
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

    return {
        elements: Array.isArray(actualDrawing.elements)
            ? actualDrawing.elements
            : (actualDrawing.frames?.[0]?.elements || actualDrawing.timelineFrames?.[0]?.elements || []),
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
        frames: Array.isArray(actualDrawing.frames)
            ? actualDrawing.frames
            : Array.isArray(actualDrawing.timelineFrames)
                ? actualDrawing.timelineFrames
                : [],
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
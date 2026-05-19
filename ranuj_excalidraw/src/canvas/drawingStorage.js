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
    };

    if (
        element.type === "rect" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond"
    ) {
        return {
            ...base,
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
            cornerRadius: element.cornerRadius ?? 14,
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
            fontFamily: element.fontFamily || "Arial",
            bold: !!element.bold,
            italic: !!element.italic,
            underline: !!element.underline,
            textAlign: element.textAlign || "left",
            parentId: element.parentId || null,
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

    if (!Array.isArray(actualDrawing.elements)) {
        throw new Error("Drawing JSON must contain elements array");
    }

    return true;
}

export function loadDrawingJson(json) {
    validateDrawingJson(json);

    const actualDrawing = json.data || json;

    return {
        elements: actualDrawing.elements || [],
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
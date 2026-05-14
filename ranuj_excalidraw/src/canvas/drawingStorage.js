export const DRAWING_SCHEMA_VERSION = 1;

export function createDrawingJson({
                                      elements = [],
                                      viewport = { zoom: 1, offsetX: 0, offsetY: 0 },
                                      canvasSize = { width: 1200, height: 700 },
                                      name = "Untitled Drawing",
                                  }) {
    const now = new Date().toISOString();

    return {
        schemaVersion: DRAWING_SCHEMA_VERSION,
        app: "SketchyDraw",
        name,
        createdAt: now,
        updatedAt: now,
        canvas: {
            width: canvasSize.width,
            height: canvasSize.height,
            background: "grid",
        },
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

    if (!Array.isArray(json.elements)) {
        throw new Error("Drawing JSON must contain elements array");
    }

    return true;
}

export function loadDrawingJson(json) {
    validateDrawingJson(json);

    return {
        elements: json.elements || [],
        viewport: json.viewport || { zoom: 1, offsetX: 0, offsetY: 0 },
        canvasSize: {
            width: json.canvas?.width || 1200,
            height: json.canvas?.height || 700,
        },
        name: json.name || "Untitled Drawing",
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
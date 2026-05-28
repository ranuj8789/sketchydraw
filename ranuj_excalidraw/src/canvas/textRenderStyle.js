import { DEFAULT_TEXT_STYLE } from "./textStyle";

export function normalizeTextStyle(source = {}) {
    return {
        fontSize: Number(source.fontSize) || DEFAULT_TEXT_STYLE.fontSize,
        lineHeight: Number(source.lineHeight) || DEFAULT_TEXT_STYLE.lineHeight,
        fontFamily: source.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
        bold: source.bold ?? DEFAULT_TEXT_STYLE.bold,
        italic: source.italic ?? DEFAULT_TEXT_STYLE.italic,
        underline: source.underline ?? DEFAULT_TEXT_STYLE.underline,
        textAlign: source.textAlign || DEFAULT_TEXT_STYLE.textAlign || "left",
        stroke: source.stroke || DEFAULT_TEXT_STYLE.stroke || "#111827",
    };
}

export function buildTextCanvasFont(style = {}) {
    const normalized = normalizeTextStyle(style);
    const fontStyle = normalized.italic ? "italic" : "normal";
    const fontWeight = normalized.bold ? "700" : "400";

    return `${fontStyle} ${fontWeight} ${normalized.fontSize}px ${normalized.fontFamily}`;
}

export function buildTextEditorFont(style = {}, zoom = 1) {
    const normalized = normalizeTextStyle(style);
    const fontStyle = normalized.italic ? "italic" : "normal";
    const fontWeight = normalized.bold ? "700" : "400";

    return `${fontStyle} ${fontWeight} ${normalized.fontSize * zoom}px ${normalized.fontFamily}`;
}

export function getTextAnchorX(element, style = {}) {
    const normalized = normalizeTextStyle(style);

    if (normalized.textAlign === "center") {
        return (element?.x || 0) + (element?.w || 0) / 2;
    }

    if (normalized.textAlign === "right") {
        return (element?.x || 0) + (element?.w || 0);
    }

    return element?.x || 0;
}

export function getUnderlineBounds(textX, textWidth, style = {}) {
    const normalized = normalizeTextStyle(style);

    if (normalized.textAlign === "center") {
        return {
            startX: textX - textWidth / 2,
            endX: textX + textWidth / 2,
        };
    }

    if (normalized.textAlign === "right") {
        return {
            startX: textX - textWidth,
            endX: textX,
        };
    }

    return {
        startX: textX,
        endX: textX + textWidth,
    };
}

export function pickTextStylePatch(patch = {}) {
    const allowedKeys = [
        "stroke",
        "fontSize",
        "lineHeight",
        "fontFamily",
        "bold",
        "italic",
        "underline",
        "textAlign",
    ];

    return allowedKeys.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
            acc[key] = patch[key];
        }

        return acc;
    }, {});
}

export function hasTextStylePatch(patch = {}) {
    return Object.keys(pickTextStylePatch(patch)).length > 0;
}
import { DEFAULT_TEXT_STYLE } from "./textStyle";
import { buildTextCanvasFont, normalizeTextStyle } from "./textRenderStyle";

export const TEXT_MIN_WIDTH = 60;
export const TEXT_MIN_HEIGHT = 28;
export const TEXT_FONT_SIZE = DEFAULT_TEXT_STYLE.fontSize;
export const TEXT_LINE_HEIGHT = DEFAULT_TEXT_STYLE.lineHeight;

export const HANDWRITING_FONT_FAMILY = DEFAULT_TEXT_STYLE.fontFamily;
export const TEXT_FONT_FAMILY = HANDWRITING_FONT_FAMILY;

export const FONT_FAMILIES = [
    HANDWRITING_FONT_FAMILY,
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    "Arial, sans-serif",
    "Georgia, serif",
    '"Courier New", monospace',
];

export function buildCanvasFont(style = {}) {
    return buildTextCanvasFont(style);
}

let measureCanvas = null;

export function measureTextBox(text, style = {}) {
    const normalized = normalizeTextStyle(style);
    const lines = String(text || "").split("\n");

    if (typeof document !== "undefined") {
        if (!measureCanvas) {
            measureCanvas = document.createElement("canvas");
        }

        const ctx = measureCanvas.getContext("2d");
        ctx.font = buildTextCanvasFont(normalized);

        const maxLineWidth = Math.max(
            TEXT_MIN_WIDTH,
            ...lines.map((line) => ctx.measureText(line || " ").width)
        );

        return {
            w: Math.ceil(maxLineWidth) + 8,
            h: Math.max(TEXT_MIN_HEIGHT, lines.length * normalized.lineHeight),
            fontSize: normalized.fontSize,
            lineHeight: normalized.lineHeight,
            fontFamily: normalized.fontFamily,
        };
    }

    const longestLineLength = Math.max(1, ...lines.map((line) => line.length));

    return {
        w: Math.max(TEXT_MIN_WIDTH, longestLineLength * normalized.fontSize * 0.6),
        h: Math.max(TEXT_MIN_HEIGHT, lines.length * normalized.lineHeight),
        fontSize: normalized.fontSize,
        lineHeight: normalized.lineHeight,
        fontFamily: normalized.fontFamily,
    };
}
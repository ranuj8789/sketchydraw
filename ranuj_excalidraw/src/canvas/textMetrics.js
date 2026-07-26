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

export function wrapTextLines(ctx, text, maxWidth) {
    const paragraphs = String(text ?? "").split("\n");
    const width = Math.max(1, Number(maxWidth) || 1);
    const output = [];

    paragraphs.forEach((paragraph) => {
        if (!paragraph) {
            output.push("");
            return;
        }

        const words = paragraph.split(/\s+/);
        let line = "";

        words.forEach((word) => {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width <= width) {
                line = candidate;
                return;
            }

            if (line) output.push(line);

            // Break very long words so text never escapes a narrow box.
            if (ctx.measureText(word).width > width) {
                let chunk = "";
                for (const char of word) {
                    const next = chunk + char;
                    if (chunk && ctx.measureText(next).width > width) {
                        output.push(chunk);
                        chunk = char;
                    } else {
                        chunk = next;
                    }
                }
                line = chunk;
            } else {
                line = word;
            }
        });

        output.push(line);
    });

    return output.length ? output : [""];
}

export function measureWrappedTextBox(text, style = {}, maxWidth = TEXT_MIN_WIDTH) {
    const normalized = normalizeTextStyle(style);
    const safeWidth = Math.max(TEXT_MIN_WIDTH, Number(maxWidth) || TEXT_MIN_WIDTH);

    if (typeof document === "undefined") {
        return {
            w: safeWidth,
            h: Math.max(TEXT_MIN_HEIGHT, normalized.lineHeight),
            lines: String(text || "").split("\n"),
        };
    }

    if (!measureCanvas) measureCanvas = document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    ctx.font = buildTextCanvasFont(normalized);
    const lines = wrapTextLines(ctx, text || " ", Math.max(1, safeWidth - 8));

    return {
        w: safeWidth,
        h: Math.max(TEXT_MIN_HEIGHT, Math.ceil(lines.length * normalized.lineHeight)),
        lines,
        fontSize: normalized.fontSize,
        lineHeight: normalized.lineHeight,
        fontFamily: normalized.fontFamily,
    };
}

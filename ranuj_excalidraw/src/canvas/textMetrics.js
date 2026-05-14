export const TEXT_FONT_SIZE = 20;
export const TEXT_LINE_HEIGHT = 24;
export const TEXT_MIN_WIDTH = 60;
export const TEXT_MIN_HEIGHT = 32;
export const TEXT_FONT_FAMILY = "Arial";

export const FONT_FAMILIES = [
    "Arial",
    "Verdana",
    "Georgia",
    "Times New Roman",
    "Courier New",
];

export function buildCanvasFont({
                                    fontSize = TEXT_FONT_SIZE,
                                    fontFamily = TEXT_FONT_FAMILY,
                                    bold = false,
                                    italic = false,
                                } = {}) {
    const style = italic ? "italic" : "normal";
    const weight = bold ? "700" : "400";
    return `${style} ${weight} ${fontSize}px ${fontFamily}`;
}

let measureCanvas = null;

export function measureTextBox(text, style = {}) {
    const lines = String(text || "").split("\n");

    if (typeof document !== "undefined") {
        if (!measureCanvas) {
            measureCanvas = document.createElement("canvas");
        }

        const ctx = measureCanvas.getContext("2d");
        ctx.font = buildCanvasFont(style);

        const maxLineWidth = Math.max(
            TEXT_MIN_WIDTH,
            ...lines.map((line) => ctx.measureText(line || " ").width)
        );

        const lineHeight = style.lineHeight || TEXT_LINE_HEIGHT;

        return {
            w: Math.ceil(maxLineWidth) + 6,
            h: Math.max(TEXT_MIN_HEIGHT, lines.length * lineHeight),
            fontSize: style.fontSize || TEXT_FONT_SIZE,
            lineHeight,
            fontFamily: style.fontFamily || TEXT_FONT_FAMILY,
        };
    }

    const fontSize = style.fontSize || TEXT_FONT_SIZE;
    const lineHeight = style.lineHeight || TEXT_LINE_HEIGHT;
    const longestLineLength = Math.max(1, ...lines.map((line) => line.length));

    return {
        w: Math.max(TEXT_MIN_WIDTH, longestLineLength * fontSize * 0.6),
        h: Math.max(TEXT_MIN_HEIGHT, lines.length * lineHeight),
        fontSize,
        lineHeight,
        fontFamily: style.fontFamily || TEXT_FONT_FAMILY,
    };
}
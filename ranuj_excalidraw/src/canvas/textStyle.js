export const FONT_SIZE_OPTIONS = {
    S: {
        label: "S",
        fontSize: 16,
        lineHeight: 20,
    },
    M: {
        label: "M",
        fontSize: 20,
        lineHeight: 26,
    },
    L: {
        label: "L",
        fontSize: 28,
        lineHeight: 36,
    },
    XL: {
        label: "XL",
        fontSize: 36,
        lineHeight: 46,
    },
};

export function getLineHeightForFontSize(fontSize) {
    const size = Number(fontSize) || FONT_SIZE_OPTIONS.M.fontSize;
    return Math.round(size * 1.3);
}

export const FONT_FAMILY_OPTIONS = [
    { id: "caveat", label: "Caveat", value: '"Caveat", cursive' },
    { id: "patrick-hand", label: "Patrick Hand", value: '"Patrick Hand", cursive' },
    { id: "kalam", label: "Kalam", value: '"Kalam", cursive' },
    { id: "shadows-into-light", label: "Shadows Into Light", value: '"Shadows Into Light", cursive' },
    { id: "architects-daughter", label: "Architects Daughter", value: '"Architects Daughter", cursive' },
    { id: "indie-flower", label: "Indie Flower", value: '"Indie Flower", cursive' },
    { id: "covered-by-your-grace", label: "Covered By Your Grace", value: '"Covered By Your Grace", cursive' },
    { id: "coming-soon", label: "Coming Soon", value: '"Coming Soon", cursive' },
    { id: "schoolbell", label: "Schoolbell", value: '"Schoolbell", cursive' },
    { id: "gloria-hallelujah", label: "Gloria Hallelujah", value: '"Gloria Hallelujah", cursive' },
    { id: "gaegu", label: "Gaegu", value: '"Gaegu", cursive' },
    { id: "reenie-beanie", label: "Reenie Beanie", value: '"Reenie Beanie", cursive' },
    { id: "waiting-for-the-sunrise", label: "Waiting for the Sunrise", value: '"Waiting for the Sunrise", cursive' },
    { id: "homemade-apple", label: "Homemade Apple", value: '"Homemade Apple", cursive' },
    { id: "rock-salt", label: "Rock Salt", value: '"Rock Salt", cursive' },
    { id: "permanent-marker", label: "Permanent Marker", value: '"Permanent Marker", cursive' },
    { id: "gochi-hand", label: "Gochi Hand", value: '"Gochi Hand", cursive' },
    { id: "nanum-pen-script", label: "Nanum Pen Script", value: '"Nanum Pen Script", cursive' },
    {
        id: "notebook",
        label: "Notebook Sans",
        value: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    },
    {
        id: "sans",
        label: "Clean Sans",
        value: "Arial, sans-serif",
    },
    {
        id: "mono",
        label: "Code",
        value: '"Courier New", monospace',
    },
    {
        id: "serif",
        label: "Serif",
        value: "Georgia, serif",
    },
];

export const DEFAULT_TEXT_STYLE = {
    fontSize: FONT_SIZE_OPTIONS.M.fontSize,
    lineHeight: FONT_SIZE_OPTIONS.M.lineHeight,
    fontFamily: '"Kalam", cursive',
    bold: false,
    italic: false,
    underline: false,
    textAlign: "left",
    stroke: "#111827",
};
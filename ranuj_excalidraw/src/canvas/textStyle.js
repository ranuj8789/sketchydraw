export const FONT_SIZE_OPTIONS = {
    S: {
        label: "S",
        fontSize: 16,
        lineHeight: 20,
    },
    M: {
        label: "M",
        fontSize: 20,
        lineHeight: 24,
    },
    L: {
        label: "L",
        fontSize: 28,
        lineHeight: 34,
    },
    XL: {
        label: "XL",
        fontSize: 36,
        lineHeight: 44,
    },
};

export const FONT_FAMILY_OPTIONS = [
    {
        id: "hand",
        label: "Hand",
        value: "Comic Sans MS, cursive",
    },
    {
        id: "sans",
        label: "Sans",
        value: "Arial, sans-serif",
    },
    {
        id: "mono",
        label: "Code",
        value: "Courier New, monospace",
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
    fontFamily: FONT_FAMILY_OPTIONS[0].value,
    bold: false,
};
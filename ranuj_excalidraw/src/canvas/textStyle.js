import { TEXT_FONT_FAMILY } from "./textMetrics";

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

export const FONT_FAMILY_OPTIONS = [
    {
        id: "hand",
        label: "Hand",
        value: TEXT_FONT_FAMILY,
    },
    {
        id: "notebook",
        label: "Notebook Sans",
        value: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif",
    },
    {
        id: "sans",
        label: "Clean Sans",
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
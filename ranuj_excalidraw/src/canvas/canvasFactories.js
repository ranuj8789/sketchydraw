import { uid } from "../utils/geometry";
import {
    TEXT_FONT_SIZE,
    TEXT_LINE_HEIGHT,
    TEXT_FONT_FAMILY,
    measureTextBox,
} from "./textMetrics";

export function buildShapeDraft(tool, point, stroke) {
    return {
        id: uid(),
        type: tool,
        x: point.x,
        y: point.y,
        w: 0,
        h: 0,
        stroke,
        strokeWidth: 2,
        strokeDash: "solid",

        // default rounded rectangle
        cornerRadius: tool === "rect" || tool === "rectangle" ? 14 : 0,
    };
}


export function buildLineDraft(tool, point, stroke, lineStyle = "straight") {
    return {
        id: uid(),
        type: tool,
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        cx1: point.x,
        cy1: point.y,
        cx2: point.x,
        cy2: point.y,
        stroke,
        strokeWidth: 2,
        strokeDash: "solid",
        lineStyle,
        arrowStart: false,
        arrowEnd: tool === "arrow",
        startBinding: null,
        endBinding: null,
    };
}

export function buildPencilDraft(point, stroke) {
    return {
        id: uid(),
        type: "pencil",
        points: [{ x: point.x, y: point.y }],
        stroke,
        strokeWidth: 2,
        strokeDash: "solid",
    };
}

export function buildTextElement({
                                     x,
                                     y,
                                     text,
                                     stroke,
                                     parentId = null,
                                     fontSize = TEXT_FONT_SIZE,
                                     lineHeight = TEXT_LINE_HEIGHT,
                                     fontFamily = TEXT_FONT_FAMILY,
                                     bold = false,
                                     italic = false,
                                     underline = false,
                                     textAlign = "left",
                                 }) {
    const finalText = text && text.trim() ? text : "";

    const box = measureTextBox(finalText, {
        fontSize,
        lineHeight,
        fontFamily,
        bold,
        italic,
    });

    return {
        id: uid(),
        type: "text",
        x,
        y,
        text: finalText,
        stroke,
        parentId,

        fontSize: box.fontSize,
        lineHeight: box.lineHeight,
        fontFamily: box.fontFamily,
        bold,
        italic,
        underline,
        textAlign,

        w: box.w,
        h: box.h,
    };
}
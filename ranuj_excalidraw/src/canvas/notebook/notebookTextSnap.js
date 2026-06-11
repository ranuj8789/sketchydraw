import {
    NOTEBOOK_LINE_GAP,
    NOTEBOOK_PAGE_GAP,
    NOTEBOOK_PAGE_HEIGHT,
    NOTEBOOK_TOP_PADDING,
} from "./notebookPageConstants";
import { DEFAULT_TEXT_STYLE } from "../textStyle";

const NOTEBOOK_TEXT_BASELINE_RATIO = 0.8;

export function isNotebookPattern(canvasProps = {}) {
    return canvasProps?.pattern === "notebook";
}

export function getNotebookTextBaselineOffset(styleOrElement = {}) {
    const fontSize =
        typeof styleOrElement === "number"
            ? DEFAULT_TEXT_STYLE.fontSize || 20
            : styleOrElement?.fontSize || DEFAULT_TEXT_STYLE.fontSize || 20;

    return Math.round(fontSize * NOTEBOOK_TEXT_BASELINE_RATIO);
}

function getNotebookPageTopForY(y) {
    const pageStep = NOTEBOOK_PAGE_HEIGHT + NOTEBOOK_PAGE_GAP;
    const safeY = Math.max(0, Number(y) || 0);
    const pageIndex = Math.floor(safeY / pageStep);

    return pageIndex * pageStep;
}

export function getNotebookTextAlignedTopY(y, styleOrElement = {}) {
    const baselineOffset = getNotebookTextBaselineOffset(styleOrElement);
    const desiredBaselineY = y + baselineOffset;

    const pageTop = getNotebookPageTopForY(desiredBaselineY);
    const firstLineY = pageTop + NOTEBOOK_TOP_PADDING;

    const snappedBaselineY =
        firstLineY +
        Math.round((desiredBaselineY - firstLineY) / NOTEBOOK_LINE_GAP) *
            NOTEBOOK_LINE_GAP;

    return snappedBaselineY - baselineOffset;
}

export function snapTextPointToNotebookLine(point, style, canvasProps) {
    if (!isNotebookPattern(canvasProps)) {
        return point;
    }

    return {
        x: point.x,
        y: getNotebookTextAlignedTopY(point.y, style),
    };
}

export function getNotebookTextStyle(style, canvasProps) {
    if (!isNotebookPattern(canvasProps)) {
        return style;
    }

    return {
        ...style,
        lineHeight: NOTEBOOK_LINE_GAP,
    };
}
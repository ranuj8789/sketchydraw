import {
    DEFAULT_NOTEBOOK_PAGE_COUNT,
    DEFAULT_NOTEBOOK_PAGE_HEIGHT,
    DEFAULT_NOTEBOOK_PAGE_WIDTH,
    MAX_NOTEBOOK_PAGE_COUNT,
    MAX_NOTEBOOK_PAGE_HEIGHT,
    MAX_NOTEBOOK_PAGE_WIDTH,
    MIN_NOTEBOOK_PAGE_HEIGHT,
    MIN_NOTEBOOK_PAGE_WIDTH,
    NOTEBOOK_PAGE_GAP,
} from "./notebookPageConstants";

function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, Math.floor(numeric)));
}

export function isNotebookPageMode(canvasProps = {}) {
    return canvasProps?.pattern === "notebook" && canvasProps?.pageMode !== false;
}

export function getNotebookPageCount(canvasProps = {}) {
    const raw = Number(canvasProps?.pageCount || DEFAULT_NOTEBOOK_PAGE_COUNT);

    if (!Number.isFinite(raw)) {
        return DEFAULT_NOTEBOOK_PAGE_COUNT;
    }

    return Math.max(
        DEFAULT_NOTEBOOK_PAGE_COUNT,
        Math.min(MAX_NOTEBOOK_PAGE_COUNT, Math.floor(raw))
    );
}

export function getNotebookPageSize(canvasProps = {}) {
    return {
        width: clampNumber(
            canvasProps?.pageWidth,
            MIN_NOTEBOOK_PAGE_WIDTH,
            MAX_NOTEBOOK_PAGE_WIDTH,
            DEFAULT_NOTEBOOK_PAGE_WIDTH
        ),
        height: clampNumber(
            canvasProps?.pageHeight,
            MIN_NOTEBOOK_PAGE_HEIGHT,
            MAX_NOTEBOOK_PAGE_HEIGHT,
            DEFAULT_NOTEBOOK_PAGE_HEIGHT
        ),
    };
}

export function getNotebookDocumentSize(canvasProps = {}) {
    const pageCount = getNotebookPageCount(canvasProps);
    const pageSize = getNotebookPageSize(canvasProps);

    return {
        width: pageSize.width,
        height:
            pageCount * pageSize.height +
            Math.max(0, pageCount - 1) * NOTEBOOK_PAGE_GAP,
        pageCount,
        pageWidth: pageSize.width,
        pageHeight: pageSize.height,
    };
}

export function getNotebookPageTop(pageIndex, canvasProps = {}) {
    const { height } = getNotebookPageSize(canvasProps);
    return pageIndex * (height + NOTEBOOK_PAGE_GAP);
}

export function getNotebookPageRect(pageIndex, canvasProps = {}) {
    const { width, height } = getNotebookPageSize(canvasProps);

    return {
        x: 0,
        y: getNotebookPageTop(pageIndex, canvasProps),
        w: width,
        h: height,
    };
}

export function getNotebookPageForPoint(point, canvasProps = {}) {
    const { height } = getNotebookPageSize(canvasProps);
    const step = height + NOTEBOOK_PAGE_GAP;
    const pageIndex = Math.floor((point?.y || 0) / step);

    return Math.max(0, pageIndex);
}

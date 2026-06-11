import {
    NOTEBOOK_BOTTOM_PADDING,
    NOTEBOOK_LEFT_MARGIN,
    NOTEBOOK_LINE_GAP,
    NOTEBOOK_PAGE_HEIGHT,
    NOTEBOOK_PAGE_RADIUS,
    NOTEBOOK_PAGE_SHADOW_BLUR,
    NOTEBOOK_PAGE_WIDTH,
    NOTEBOOK_TOP_PADDING,
} from "./notebookPageConstants";
import {
    getNotebookPageCount,
    getNotebookPageRect,
} from "./notebookPages";

function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function rectsIntersect(a, b) {
    return !(
        a.x + a.w < b.x ||
        b.x + b.w < a.x ||
        a.y + a.h < b.y ||
        b.y + b.h < a.y
    );
}

function getVisibleWorldRect(canvasSize, viewport) {
    const padding = 120 / viewport.zoom;

    return {
        x: -viewport.offsetX / viewport.zoom - padding,
        y: -viewport.offsetY / viewport.zoom - padding,
        w: canvasSize.width / viewport.zoom + padding * 2,
        h: canvasSize.height / viewport.zoom + padding * 2,
    };
}

function drawPageNumber(ctx, pageRect, pageNumber, viewport) {
    ctx.save();
    ctx.fillStyle = "rgba(100, 116, 139, 0.86)";
    ctx.font = `${Math.max(11 / viewport.zoom, 8)}px Inter, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
        `Page ${pageNumber}`,
        pageRect.x + pageRect.w / 2,
        pageRect.y + pageRect.h + 12 / viewport.zoom
    );
    ctx.restore();
}

function drawSingleNotebookPage(ctx, pageRect, pageNumber, viewport) {
    ctx.save();

    // Page shadow
    ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
    ctx.shadowBlur = NOTEBOOK_PAGE_SHADOW_BLUR / viewport.zoom;
    ctx.shadowOffsetY = 8 / viewport.zoom;

    roundedRect(
        ctx,
        pageRect.x,
        pageRect.y,
        pageRect.w,
        pageRect.h,
        NOTEBOOK_PAGE_RADIUS
    );
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.restore();

    // Page border
    ctx.save();
    roundedRect(
        ctx,
        pageRect.x,
        pageRect.y,
        pageRect.w,
        pageRect.h,
        NOTEBOOK_PAGE_RADIUS
    );
    ctx.strokeStyle = "rgba(203, 213, 225, 0.92)";
    ctx.lineWidth = Math.max(1 / viewport.zoom, 0.75);
    ctx.stroke();
    ctx.restore();

    // Clip notebook lines inside page
    ctx.save();
    roundedRect(
        ctx,
        pageRect.x,
        pageRect.y,
        pageRect.w,
        pageRect.h,
        NOTEBOOK_PAGE_RADIUS
    );
    ctx.clip();

    // Very light page tint
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pageRect.x, pageRect.y, pageRect.w, pageRect.h);

    // Horizontal ruled lines
    ctx.strokeStyle = "rgba(37, 99, 235, 0.28)";
    ctx.lineWidth = Math.max(1 / viewport.zoom, 0.65);

    const lineStartX = pageRect.x;
    const lineEndX = pageRect.x + pageRect.w;
    const firstLineY = pageRect.y + NOTEBOOK_TOP_PADDING;
    const lastLineY = pageRect.y + pageRect.h - NOTEBOOK_BOTTOM_PADDING;

    for (let y = firstLineY; y <= lastLineY; y += NOTEBOOK_LINE_GAP) {
        ctx.beginPath();
        ctx.moveTo(lineStartX, y);
        ctx.lineTo(lineEndX, y);
        ctx.stroke();
    }

    // Red margin line
    ctx.strokeStyle = "rgba(239, 68, 68, 0.48)";
    ctx.lineWidth = Math.max(1.2 / viewport.zoom, 0.85);

    ctx.beginPath();
    ctx.moveTo(pageRect.x + NOTEBOOK_LEFT_MARGIN, pageRect.y);
    ctx.lineTo(pageRect.x + NOTEBOOK_LEFT_MARGIN, pageRect.y + pageRect.h);
    ctx.stroke();

    ctx.restore();

    drawPageNumber(ctx, pageRect, pageNumber, viewport);
}

export function drawNotebookPages(ctx, canvasSize, viewport, canvasProps = {}) {
    const pageCount = getNotebookPageCount(canvasProps);
    const visibleWorldRect = getVisibleWorldRect(canvasSize, viewport);

    ctx.save();

    // Outside page background
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(
        visibleWorldRect.x,
        visibleWorldRect.y,
        visibleWorldRect.w,
        visibleWorldRect.h
    );

    const pageViewMode = canvasProps?.pageViewMode || "single";
    const currentPageIndex = Math.max(
        0,
        Math.min(pageCount - 1, Number(canvasProps?.currentPageIndex || 0))
    );
    const firstPageIndex = pageViewMode === "all" ? 0 : currentPageIndex;
    const lastPageIndex = pageViewMode === "all" ? pageCount - 1 : currentPageIndex;

    for (let pageIndex = firstPageIndex; pageIndex <= lastPageIndex; pageIndex += 1) {
        const pageRect = getNotebookPageRect(pageIndex, canvasProps);
        const pageWithLabelBounds = {
            ...pageRect,
            h: pageRect.h + 44,
        };

        if (!rectsIntersect(visibleWorldRect, pageWithLabelBounds)) {
            continue;
        }

        drawSingleNotebookPage(ctx, pageRect, pageIndex + 1, viewport);
    }

    ctx.restore();
}
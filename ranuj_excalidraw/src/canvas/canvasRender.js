import { drawElement } from "../utils/drawing";
import { drawCanvasGrid, drawCurveControls } from "./canvasHelpers";
import { getElementBounds } from "../utils/elementBounds";
import { drawNotebookPages } from "./notebook/notebookRenderer";
import { isElementVisibleAtTime, resolveFrameAnimationTimings } from "./animationTimeline";

function normalizeCanvasProps(canvasProps = {}) {
    return {
        ...(canvasProps || {}),
        backgroundColor: canvasProps.backgroundColor || "#ffffff",
        pattern: canvasProps.pattern || "blank",
        cornerRadius: canvasProps.cornerRadius ?? 16,

        // Keep notebook navigation state available to notebookRenderer.
        pageMode: canvasProps.pageMode !== false,
        pageCount: Math.max(1, Number(canvasProps.pageCount) || 1),
        currentPageIndex: Math.max(0, Number(canvasProps.currentPageIndex) || 0),
        pageViewMode: canvasProps.pageViewMode || "single",
    };
}

function setupCanvasSize(canvas, canvasSize, dpr) {
    const targetWidth = Math.max(1, Math.round(canvasSize.width * dpr));
    const targetHeight = Math.max(1, Math.round(canvasSize.height * dpr));

    if (canvas.width !== targetWidth) {
        canvas.width = targetWidth;
    }

    if (canvas.height !== targetHeight) {
        canvas.height = targetHeight;
    }

    const cssWidth = `${canvasSize.width}px`;
    const cssHeight = `${canvasSize.height}px`;

    if (canvas.style.width !== cssWidth) {
        canvas.style.width = cssWidth;
    }

    if (canvas.style.height !== cssHeight) {
        canvas.style.height = cssHeight;
    }
}

function drawDotsPattern(ctx, canvasSize, viewport) {
    const gap = 24;
    const radius = 1.3 / viewport.zoom;

    const startX = Math.floor((-viewport.offsetX / viewport.zoom) / gap) * gap;
    const startY = Math.floor((-viewport.offsetY / viewport.zoom) / gap) * gap;

    const endX = startX + canvasSize.width / viewport.zoom + gap * 2;
    const endY = startY + canvasSize.height / viewport.zoom + gap * 2;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.22)";

    for (let x = startX; x <= endX; x += gap) {
        for (let y = startY; y <= endY; y += gap) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawBlocksPattern(ctx, canvasSize, viewport) {
    const gap = 48;

    const startX = Math.floor((-viewport.offsetX / viewport.zoom) / gap) * gap;
    const startY = Math.floor((-viewport.offsetY / viewport.zoom) / gap) * gap;

    const endX = startX + canvasSize.width / viewport.zoom + gap * 2;
    const endY = startY + canvasSize.height / viewport.zoom + gap * 2;

    ctx.save();
    ctx.strokeStyle = "rgba(15, 23, 42, 0.09)";
    ctx.lineWidth = 1 / viewport.zoom;

    for (let x = startX; x <= endX; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gap) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }

    ctx.restore();
}

function drawNotebookPattern(ctx, canvasSize, viewport) {
    const lineGap = 28;
    const pageWidth = 900;
    const marginX = 72;

    const visibleWorldLeft = -viewport.offsetX / viewport.zoom;
    const visibleWorldTop = -viewport.offsetY / viewport.zoom;
    const visibleWorldRight =
        visibleWorldLeft + canvasSize.width / viewport.zoom;
    const visibleWorldBottom =
        visibleWorldTop + canvasSize.height / viewport.zoom;

    const startY = Math.floor(visibleWorldTop / lineGap) * lineGap;
    const endY = Math.ceil(visibleWorldBottom / lineGap) * lineGap;
    const firstPage = Math.floor(visibleWorldLeft / pageWidth) * pageWidth;

    ctx.save();

    // Notebook paper background tint.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
        visibleWorldLeft,
        visibleWorldTop,
        visibleWorldRight - visibleWorldLeft,
        visibleWorldBottom - visibleWorldTop
    );

    // Blue horizontal notebook lines.
    ctx.strokeStyle = "rgba(37, 99, 235, 0.30)";
    ctx.lineWidth = Math.max(1 / viewport.zoom, 0.65);

    for (let y = startY; y <= endY; y += lineGap) {
        ctx.beginPath();
        ctx.moveTo(visibleWorldLeft, y);
        ctx.lineTo(visibleWorldRight, y);
        ctx.stroke();
    }

    // Red left margin lines per notebook page.
    ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
    ctx.lineWidth = Math.max(1.2 / viewport.zoom, 0.8);

    for (let pageX = firstPage; pageX <= visibleWorldRight + pageWidth; pageX += pageWidth) {
        const x = pageX + marginX;
        ctx.beginPath();
        ctx.moveTo(x, visibleWorldTop);
        ctx.lineTo(x, visibleWorldBottom);
        ctx.stroke();
    }

    ctx.restore();
}

function drawAlignmentGuides(ctx, alignmentGuides, canvasSize, viewport) {
    if (!alignmentGuides?.length) return;

    const startX = -viewport.offsetX / viewport.zoom;
    const startY = -viewport.offsetY / viewport.zoom;
    const endX = startX + canvasSize.width / viewport.zoom;
    const endY = startY + canvasSize.height / viewport.zoom;

    ctx.save();
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 1.5 / viewport.zoom;
    ctx.setLineDash([8 / viewport.zoom, 5 / viewport.zoom]);

    alignmentGuides.forEach((guide) => {
        ctx.beginPath();

        if (guide.type === "vertical") {
            ctx.moveTo(guide.x, startY);
            ctx.lineTo(guide.x, endY);
        }

        if (guide.type === "horizontal") {
            ctx.moveTo(startX, guide.y);
            ctx.lineTo(endX, guide.y);
        }

        ctx.stroke();
    });

    ctx.restore();
}

function getVisibleWorldRect(canvasSize, viewport) {
    const padding = 80 / viewport.zoom;

    const x = -viewport.offsetX / viewport.zoom - padding;
    const y = -viewport.offsetY / viewport.zoom - padding;
    const w = canvasSize.width / viewport.zoom + padding * 2;
    const h = canvasSize.height / viewport.zoom + padding * 2;

    return { x, y, w, h };
}

function rectsIntersect(a, b) {
    return !(
        a.x + a.w < b.x ||
        b.x + b.w < a.x ||
        a.y + a.h < b.y ||
        b.y + b.h < a.y
    );
}

function shouldDrawElement(element, visibleWorldRect, selectedSet, connectionHint) {
    if (!element) return false;

    if (selectedSet.has(element.id) || connectionHint?.shapeId === element.id) {
        return true;
    }

    const bounds = getElementBounds(element);

    if (!bounds) {
        return true;
    }

    return rectsIntersect(visibleWorldRect, bounds);
}

export function renderCanvas({
                                 canvas,
                                 canvasSize,
                                 elements,
                                 selectedIds,
                                 connectionHint,
                                 alignmentGuides = [],
                                 viewport,
                                 showGrid = true,
                                 canvasProps = {},
                                 renderOptions = {},
                             }) {
    if (!canvas || !canvasSize || !viewport) return;

    const finalCanvasProps = normalizeCanvasProps(canvasProps);
    const dpr = Math.max(
        1,
        Number(renderOptions.pixelRatio) || window.devicePixelRatio || 1
    );

    setupCanvasSize(canvas, canvasSize, dpr);

    const borderRadius = `${finalCanvasProps.cornerRadius}px`;
    if (canvas.style.borderRadius !== borderRadius) {
        canvas.style.borderRadius = borderRadius;
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.fillStyle = finalCanvasProps.backgroundColor;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.restore();

    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    if (finalCanvasProps.pattern === "notebook") {
        drawNotebookPages(ctx, canvasSize, viewport, finalCanvasProps);
    } else {
        const shouldShowGrid = showGrid || finalCanvasProps.pattern === "grid";

        if (shouldShowGrid) {
            drawCanvasGrid(ctx, canvasSize, viewport);
        }

        if (finalCanvasProps.pattern === "dots") {
            drawDotsPattern(ctx, canvasSize, viewport);
        }

        if (finalCanvasProps.pattern === "blocks") {
            drawBlocksPattern(ctx, canvasSize, viewport);
        }
    }

    const selectedSet = new Set(selectedIds || []);
    const hiddenSet = renderOptions?.hiddenElementIds || new Set();
    const visibleWorldRect = getVisibleWorldRect(canvasSize, viewport);
    const resolvedAnimationTimings = renderOptions?.resolvedAnimationTimings || resolveFrameAnimationTimings(elements || []);
    const finalRenderOptions = { ...renderOptions, resolvedAnimationTimings };
    const elementsById = new Map((elements || []).map((element) => [element.id, element]));

    const depthOrderedElements = (elements || [])
        .map((element, index) => ({ element, index }))
        .sort((a, b) => {
            const depthDelta = (Number(a.element?.z) || 0) - (Number(b.element?.z) || 0);
            return depthDelta || a.index - b.index;
        })
        .map(({ element }) => element);

    depthOrderedElements.forEach((element) => {
        if (renderOptions?.webglOverlayActive && element?.type === "webgl3d") return;
        if (hiddenSet?.has?.(element.id)) {
            return;
        }
        if (finalRenderOptions.animationMode && !isElementVisibleAtTime(element, finalRenderOptions.animationTimeMs || 0, resolvedAnimationTimings.get(element.id))) {
            return;
        }
        if (!shouldDrawElement(element, visibleWorldRect, selectedSet, connectionHint)) {
            return;
        }

        const isSelected = selectedSet.has(element.id);
        const isHighlighted = connectionHint?.shapeId === element.id;
        const isSnapTarget = (alignmentGuides || []).some(
            (guide) => guide.targetId === element.id
        );

        const parentBounds = element.type === "text" && element.parentId
            ? getElementBounds(elementsById.get(element.parentId))
            : null;
        drawElement(ctx, element, isSelected, {
            ...finalRenderOptions,
            parentBounds,
        });

        if (isHighlighted || isSnapTarget) {
            const bounds = getElementBounds(element);

            if (bounds) {
                ctx.save();
                ctx.strokeStyle = isSnapTarget ? "#ef4444" : "#3b82f6";
                ctx.lineWidth = isSnapTarget ? 2.5 / viewport.zoom : 2 / viewport.zoom;
                ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
                ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
                ctx.restore();
            }
        }

        if (isSelected && (element.type === "line" || element.type === "arrow")) {
            drawCurveControls(ctx, element, viewport);
        }
    });

    drawAlignmentGuides(ctx, alignmentGuides, canvasSize, viewport);

    if (connectionHint?.bindPoint) {
        ctx.save();
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(
            connectionHint.bindPoint.x,
            connectionHint.bindPoint.y,
            5 / viewport.zoom,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}

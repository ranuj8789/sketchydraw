import { drawElement } from "../utils/drawing";
import { drawCanvasGrid, drawCurveControls } from "./canvasHelpers";
import { getElementBounds } from "../utils/elementBounds";

function normalizeCanvasProps(canvasProps = {}) {
    return {
        backgroundColor: canvasProps.backgroundColor || "#ffffff",
        pattern: canvasProps.pattern || "blank",
        cornerRadius: canvasProps.cornerRadius ?? 16,
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

function drawAlignmentGuides(ctx, alignmentGuides, canvasSize, viewport) {
    if (!alignmentGuides?.length) return;

    const startX = -viewport.offsetX / viewport.zoom;
    const startY = -viewport.offsetY / viewport.zoom;
    const endX = startX + canvasSize.width / viewport.zoom;
    const endY = startY + canvasSize.height / viewport.zoom;

    ctx.save();
    ctx.strokeStyle = "#ff00ff";
    ctx.lineWidth = 1.7 / viewport.zoom;
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

function drawObjectSnapHighlight(ctx, element, viewport) {
    const bounds = getElementBounds(element);
    if (!bounds) return;

    const padding = 5 / viewport.zoom;

    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.2 / viewport.zoom;
    ctx.setLineDash([7 / viewport.zoom, 4 / viewport.zoom]);
    ctx.shadowColor = "rgba(239, 68, 68, 0.35)";
    ctx.shadowBlur = 8 / viewport.zoom;
    ctx.strokeRect(
        bounds.x - padding,
        bounds.y - padding,
        bounds.w + padding * 2,
        bounds.h + padding * 2
    );
    ctx.restore();
}

export function renderCanvas({
                                 canvas,
                                 canvasSize,
                                 elements,
                                 selectedIds,
                                 connectionHint,
                                 alignmentGuides = [],
                                 highlightedElementIds = [],
                                 viewport,
                                 showGrid = true,
                                 canvasProps = {},
                             }) {
    if (!canvas || !canvasSize || !viewport) return;

    const finalCanvasProps = normalizeCanvasProps(canvasProps);
    const dpr = window.devicePixelRatio || 1;

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

    const selectedSet = new Set(selectedIds || []);
    const highlightedSet = new Set(highlightedElementIds || []);
    const visibleWorldRect = getVisibleWorldRect(canvasSize, viewport);

    (elements || []).forEach((element) => {
        if (!shouldDrawElement(element, visibleWorldRect, selectedSet, connectionHint)) {
            return;
        }

        const isSelected = selectedSet.has(element.id);
        const isHighlighted = connectionHint?.shapeId === element.id;
        const isObjectSnapHighlighted = highlightedSet.has(element.id);

        drawElement(ctx, element, isSelected);

        if (isObjectSnapHighlighted) {
            drawObjectSnapHighlight(ctx, element, viewport);
        }

        if (isHighlighted) {
            const bounds = getElementBounds(element);

            if (bounds) {
                ctx.save();
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 2 / viewport.zoom;
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

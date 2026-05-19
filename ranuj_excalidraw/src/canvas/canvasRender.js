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

function drawDotsPattern(ctx, canvasSize, viewport) {
    const gap = 24;
    const radius = 1.3 / viewport.zoom;

    const startX =
        Math.floor((-viewport.offsetX / viewport.zoom) / gap) * gap;
    const startY =
        Math.floor((-viewport.offsetY / viewport.zoom) / gap) * gap;

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

    const startX =
        Math.floor((-viewport.offsetX / viewport.zoom) / gap) * gap;
    const startY =
        Math.floor((-viewport.offsetY / viewport.zoom) / gap) * gap;

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

export function renderCanvas({
                                 canvas,
                                 canvasSize,
                                 elements,
                                 selectedIds,
                                 connectionHint,
                                 viewport,
                                 showGrid = true,
                                 canvasProps = {},
                             }) {
    if (!canvas) return;

    const finalCanvasProps = normalizeCanvasProps(canvasProps);

    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    canvas.style.borderRadius = `${finalCanvasProps.cornerRadius}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Canvas background color from Properties Panel
    ctx.save();
    ctx.fillStyle = finalCanvasProps.backgroundColor;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    ctx.restore();

    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    const shouldShowGrid =
        showGrid || finalCanvasProps.pattern === "grid";

    if (shouldShowGrid) {
        drawCanvasGrid(ctx, canvasSize, viewport);
    }

    if (finalCanvasProps.pattern === "dots") {
        drawDotsPattern(ctx, canvasSize, viewport);
    }

    if (finalCanvasProps.pattern === "blocks") {
        drawBlocksPattern(ctx, canvasSize, viewport);
    }

    elements.forEach((element) => {
        const isSelected = selectedIds.includes(element.id);
        const isHighlighted = connectionHint?.shapeId === element.id;

        drawElement(ctx, element, isSelected);

        if (isHighlighted) {
            const bounds = getElementBounds(element);

            if (bounds) {
                ctx.save();
                ctx.strokeStyle = "#3b82f6";
                ctx.lineWidth = 2 / viewport.zoom;
                ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);

                ctx.strokeRect(
                    bounds.x,
                    bounds.y,
                    bounds.w,
                    bounds.h
                );

                ctx.restore();
            }
        }

        if (isSelected && (element.type === "line" || element.type === "arrow")) {
            drawCurveControls(ctx, element, viewport);
        }
    });

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
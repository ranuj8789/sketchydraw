import { drawElement } from "../utils/drawing";
import { drawCanvasGrid, drawCurveControls } from "./canvasHelpers";
import { getElementBounds } from "../utils/elementBounds";

export function renderCanvas({
                                 canvas,
                                 canvasSize,
                                 elements,
                                 selectedIds,
                                 connectionHint,
                                 viewport,
                             }) {
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const ctx = canvas.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.zoom, viewport.zoom);

    drawCanvasGrid(ctx, canvasSize, viewport);

    elements.forEach((element) => {
        const isSelected = selectedIds.includes(element.id);
        const isHighlighted = connectionHint?.shapeId === element.id;

        drawElement(ctx, element, isSelected);

        // ⭐ highlight shape (THIS IS NEW)
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

        // curve handles
        if (isSelected && (element.type === "line" || element.type === "arrow")) {
            drawCurveControls(ctx, element, viewport);
        }
    });

    // connection point dot
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
import { hitTest } from "../utils/drawing";

export function findTopElementAtPoint(elements, point) {
    const reversed = [...elements].reverse();

    const textTarget = reversed.find(
        (el) => el.type === "text" && hitTest(el, point.x, point.y)
    );
    if (textTarget) return textTarget;

    return reversed.find((el) => hitTest(el, point.x, point.y)) || null;
}

export function getCanvasSizeFromWrapper(wrapper) {
    if (!wrapper) {
        return { width: 1200, height: 700 };
    }

    const rect = wrapper.getBoundingClientRect();

    return {
        width: Math.max(900, Math.floor(rect.width - 24)),
        height: Math.max(600, window.innerHeight - 180),
    };
}

export function drawCanvasGrid(ctx, canvasSize, viewport) {
    const grid = 24;

    const visibleWorldLeft = -viewport.offsetX / viewport.zoom;
    const visibleWorldTop = -viewport.offsetY / viewport.zoom;
    const visibleWorldRight = visibleWorldLeft + canvasSize.width / viewport.zoom;
    const visibleWorldBottom = visibleWorldTop + canvasSize.height / viewport.zoom;

    const startX = Math.floor(visibleWorldLeft / grid) * grid;
    const endX = Math.ceil(visibleWorldRight / grid) * grid;
    const startY = Math.floor(visibleWorldTop / grid) * grid;
    const endY = Math.ceil(visibleWorldBottom / grid) * grid;

    ctx.strokeStyle = "#eef2ff";
    ctx.lineWidth = 1 / viewport.zoom;

    for (let x = startX; x <= endX; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y += grid) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
}

export function drawCurveControls(ctx, element, viewport) {
    if (!element || (element.type !== "line" && element.type !== "arrow")) return;

    const handleRadius = 5 / viewport.zoom;

    const startX = element.x1;
    const startY = element.y1;
    const endX = element.x2;
    const endY = element.y2;

    const cpX = element.cx1 ?? startX;
    const cpY = element.cy1 ?? startY;

    ctx.save();

    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(cpX, cpY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.setLineDash([]);

    const drawHandle = (x, y, fill = "#ffffff", stroke = "#6366f1") => {
        ctx.beginPath();
        ctx.arc(x, y, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.stroke();
    };

    drawHandle(startX, startY, "#ffffff", "#6366f1");
    drawHandle(cpX, cpY, "#c4b5fd", "#a78bfa");
    drawHandle(endX, endY, "#ffffff", "#6366f1");

    ctx.restore();
}

export function getCurveHandleAtPoint(element, point, zoom = 1) {
    if (!element || (element.type !== "line" && element.type !== "arrow")) return null;

    const threshold = 10 / zoom;

    const handles = [
        { key: "start", x: element.x1, y: element.y1 },
        { key: "cp1", x: element.cx1 ?? element.x1, y: element.cy1 ?? element.y1 },
        { key: "end", x: element.x2, y: element.y2 },
    ];

    for (const handle of handles) {
        const dist = Math.hypot(point.x - handle.x, point.y - handle.y);
        if (dist <= threshold) {
            return handle.key;
        }
    }

    return null;
}
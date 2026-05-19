export function findTopElementAtPoint(elements, point) {
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];

        if (isPointInsideElement(el, point)) {
            return el;
        }
    }

    return null;
}

function isPointInsideElement(el, point) {
    if (!el) return false;

    if (
        el.type === "rect" ||
        el.type === "rectangle" ||
        el.type === "ellipse" ||
        el.type === "diamond" ||
        el.type === "text" ||
        el.type === "image"
    ) {
        const x = Math.min(el.x, el.x + (el.w || 0));
        const y = Math.min(el.y, el.y + (el.h || 0));
        const w = Math.abs(el.w || 0);
        const h = Math.abs(el.h || 0);

        return (
            point.x >= x &&
            point.x <= x + w &&
            point.y >= y &&
            point.y <= y + h
        );
    }

    if (el.type === "line" || el.type === "arrow") {
        return distanceToSegment(
            point,
            { x: el.x1, y: el.y1 },
            { x: el.x2, y: el.y2 }
        ) < 10;
    }

    if (el.type === "pencil") {
        const points = el.points || [];

        for (let i = 1; i < points.length; i++) {
            if (distanceToSegment(point, points[i - 1], points[i]) < 10) {
                return true;
            }
        }
    }

    return false;
}

function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
            (dx * dx + dy * dy)
        )
    );

    const projection = {
        x: start.x + t * dx,
        y: start.y + t * dy,
    };

    return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function getCurveHandleAtPoint(element, point, zoom = 1) {
    if (!element || (element.type !== "line" && element.type !== "arrow")) {
        return null;
    }

    const hitSize = 10 / zoom;

    const points = [
        { key: "start", x: element.x1, y: element.y1 },
        { key: "end", x: element.x2, y: element.y2 },
    ];

    if (element.lineStyle === "curved") {
        points.push({
            key: "cp1",
            x: element.cx1 ?? element.x1,
            y: element.cy1 ?? element.y1,
        });
    }

    for (const item of points) {
        if (Math.hypot(point.x - item.x, point.y - item.y) <= hitSize) {
            return item.key;
        }
    }

    return null;
}

export function drawCurveControls(ctx, element, viewport) {
    if (!element || (element.type !== "line" && element.type !== "arrow")) {
        return;
    }

    const zoom = viewport?.zoom || 1;
    const radius = 5 / zoom;

    const points = [
        { x: element.x1, y: element.y1 },
        { x: element.x2, y: element.y2 },
    ];

    if (element.lineStyle === "curved") {
        points.push({
            x: element.cx1 ?? element.x1,
            y: element.cy1 ?? element.y1,
        });
    }

    ctx.save();

    points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
    });

    ctx.restore();
}

export function getCanvasSizeFromWrapper(wrapper) {
    if (!wrapper) {
        return {
            width: 1200,
            height: 700,
        };
    }

    const rect = wrapper.getBoundingClientRect();

    return {
        width: Math.max(900, Math.floor(rect.width)),
        height: Math.max(600, Math.floor(rect.height)),
    };
}

export function drawCanvasGrid(ctx, canvasSize, viewport) {
    const grid = 24;

    const visibleWorldLeft = -viewport.offsetX / viewport.zoom;
    const visibleWorldTop = -viewport.offsetY / viewport.zoom;
    const visibleWorldRight =
        visibleWorldLeft + canvasSize.width / viewport.zoom;
    const visibleWorldBottom =
        visibleWorldTop + canvasSize.height / viewport.zoom;

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
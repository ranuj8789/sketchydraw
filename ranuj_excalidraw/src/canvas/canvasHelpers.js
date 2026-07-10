import { isSystemDesignType } from "./canvasConstants";
export function findTopElementHitAtPoint(elements, point) {
    const hits = [];

    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const hit = getElementHit(el, point);

        if (hit) {
            hits.push({
                element: el,
                index: i,
                kind: hit.kind,
                area: getElementArea(el),
            });
        }
    }

    if (hits.length === 0) return null;

    // Smallest hit object wins, so an object inside a rectangle
    // is selected before the outer rectangle.
    hits.sort((a, b) => {
        if (a.area !== b.area) return a.area - b.area;
        return b.index - a.index;
    });

    return {
        element: hits[0].element,
        kind: hits[0].kind,
    };
}

export function findTopElementAtPoint(elements, point) {
    return findTopElementHitAtPoint(elements, point)?.element || null;
}

function getElementHit(el, point) {
    if (!el || !point) return null;

    const HIT_PADDING = 8;

    if (
        el.type === "rect" ||
        el.type === "rectangle" ||
        el.type === "ellipse" ||
        el.type === "diamond" ||
        isSystemDesignType(el.type) ||
        el.type === "text" ||
        el.type === "image"
    ) {
        const box = getElementBox(el);
        if (!box) return null;

        const inside =
            point.x >= box.x - HIT_PADDING &&
            point.x <= box.x + box.w + HIT_PADDING &&
            point.y >= box.y - HIT_PADDING &&
            point.y <= box.y + box.h + HIT_PADDING;

        if (!inside) return null;

        const nearBorder =
            point.x <= box.x + HIT_PADDING ||
            point.x >= box.x + box.w - HIT_PADDING ||
            point.y <= box.y + HIT_PADDING ||
            point.y >= box.y + box.h - HIT_PADDING;

        return { kind: nearBorder ? "border" : "fill" };
    }

    if (el.type === "line" || el.type === "arrow") {
        return distanceToLineOrCurve(point, el) < 12
            ? { kind: "border" }
            : null;
    }

    if (el.type === "pencil") {
        const points = el.points || [];

        for (let i = 1; i < points.length; i++) {
            if (distanceToSegment(point, points[i - 1], points[i]) < 10) {
                return { kind: "border" };
            }
        }
    }

    return null;
}

function isPointInsideElement(el, point) {
    return !!getElementHit(el, point);
}

function getElementBox(el) {
    const w = el.w || 0;
    const h = el.h || 0;

    return {
        x: Math.min(el.x, el.x + w),
        y: Math.min(el.y, el.y + h),
        w: Math.abs(w),
        h: Math.abs(h),
    };
}

function getElementArea(el) {
    if (el.type === "line" || el.type === "arrow" || el.type === "pencil") {
        return 1;
    }

    const box = getElementBox(el);
    if (!box) return Number.MAX_SAFE_INTEGER;

    return Math.max(1, box.w * box.h);
}



function distanceToLineOrCurve(point, element) {
    if (element.lineStyle === "curved") {
        return distanceToBezier(point, element);
    }

    return distanceToSegment(
        point,
        { x: element.x1, y: element.y1 },
        { x: element.x2, y: element.y2 }
    );
}

function cubicBezierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return {
        x:
            mt2 * mt * p0.x +
            3 * mt2 * t * p1.x +
            3 * mt * t2 * p2.x +
            t2 * t * p3.x,
        y:
            mt2 * mt * p0.y +
            3 * mt2 * t * p1.y +
            3 * mt * t2 * p2.y +
            t2 * t * p3.y,
    };
}

function distanceToBezier(point, element) {
    const p0 = { x: element.x1, y: element.y1 };
    const p1 = {
        x: element.cx1 ?? element.x1,
        y: element.cy1 ?? element.y1,
    };
    const p2 = {
        x: element.cx2 ?? element.x2,
        y: element.cy2 ?? element.y2,
    };
    const p3 = { x: element.x2, y: element.y2 };

    let minDistance = Infinity;
    let previous = p0;

    for (let i = 1; i <= 32; i++) {
        const current = cubicBezierPoint(i / 32, p0, p1, p2, p3);

        minDistance = Math.min(
            minDistance,
            distanceToSegment(point, previous, current)
        );

        previous = current;
    }

    return minDistance;
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

    const midX = (element.x1 + element.x2) / 2;
    const midY = (element.y1 + element.y2) / 2;

    const controlX =
        element.lineStyle === "curved"
            ? element.cx1 ?? midX
            : midX;

    const controlY =
        element.lineStyle === "curved"
            ? element.cy1 ?? midY
            : midY;

    const points = [
        { key: "start", x: element.x1, y: element.y1 },
        { key: "end", x: element.x2, y: element.y2 },
        { key: "cp1", x: controlX, y: controlY },
    ];

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

    const midX = (element.x1 + element.x2) / 2;
    const midY = (element.y1 + element.y2) / 2;

    const controlX =
        element.lineStyle === "curved"
            ? element.cx1 ?? midX
            : midX;

    const controlY =
        element.lineStyle === "curved"
            ? element.cy1 ?? midY
            : midY;

    const points = [
        { x: element.x1, y: element.y1 },
        { x: element.x2, y: element.y2 },
        { x: controlX, y: controlY },
    ];

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
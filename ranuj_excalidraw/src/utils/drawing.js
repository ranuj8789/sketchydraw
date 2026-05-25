function cubicBezierPoint(t, p0, p1, p2, p3) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    const x =
        mt2 * mt * p0.x +
        3 * mt2 * t * p1.x +
        3 * mt * t2 * p2.x +
        t2 * t * p3.x;

    const y =
        mt2 * mt * p0.y +
        3 * mt2 * t * p1.y +
        3 * mt * t2 * p2.y +
        t2 * t * p3.y;

    return { x, y };
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
        return Math.hypot(px - x1, py - y1);
    }

    const t = Math.max(
        0,
        Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))
    );

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.hypot(px - projX, py - projY);
}

function distanceToBezier(px, py, element) {
    const p0 = { x: element.x1, y: element.y1 };
    const p1 = { x: element.cx1 ?? element.x1, y: element.cy1 ?? element.y1 };
    const p2 = { x: element.cx2 ?? element.x2, y: element.cy2 ?? element.y2 };
    const p3 = { x: element.x2, y: element.y2 };

    let min = Infinity;
    let prev = p0;

    for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const curr = cubicBezierPoint(t, p0, p1, p2, p3);
        const d = distanceToSegment(px, py, prev.x, prev.y, curr.x, curr.y);
        min = Math.min(min, d);
        prev = curr;
    }

    return min;
}

function pointInEllipse(px, py, cx, cy, rx, ry) {
    if (rx === 0 || ry === 0) return false;

    const dx = (px - cx) / rx;
    const dy = (py - cy) / ry;

    return dx * dx + dy * dy <= 1;
}

function pointInDiamond(px, py, x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dx = Math.abs(px - cx);
    const dy = Math.abs(py - cy);

    return dx / Math.abs(w / 2 || 1) + dy / Math.abs(h / 2 || 1) <= 1;
}

function applyElementStrokeStyle(ctx, element) {
    ctx.strokeStyle = element.stroke || "#111827";
    ctx.fillStyle = element.fill || element.fillColor || "transparent";
    ctx.lineWidth = element.strokeWidth || 2;

    const dash = element.strokeDash || "solid";

    if (dash === "dashed") {
        ctx.setLineDash([12, 8]);
    } else if (dash === "dotted") {
        ctx.setLineDash([2, 8]);
    } else {
        ctx.setLineDash([]);
    }
}

function drawArrowHead(ctx, fromX, fromY, toX, toY, stroke, strokeWidth = 2) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = Math.max(10, strokeWidth * 4);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - size * Math.cos(angle - Math.PI / 6),
        toY - size * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - size * Math.cos(angle + Math.PI / 6),
        toY - size * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = stroke;
    ctx.fill();
    ctx.restore();
}

const imageElementCache = new Map();

function getCachedCanvasImage(src) {
    if (!src) return null;

    const cached = imageElementCache.get(src);

    if (cached) {
        return cached;
    }

    const img = new Image();

    img.onload = () => {
        window.dispatchEvent(new Event("sketchydraw:image-loaded"));
    };

    img.src = src;
    imageElementCache.set(src, img);

    return img;
}

function normalizeImageBox(element) {
    const x = element.w >= 0 ? element.x : element.x + element.w;
    const y = element.h >= 0 ? element.y : element.y + element.h;
    const w = Math.abs(element.w || 0);
    const h = Math.abs(element.h || 0);

    return { x, y, w, h };
}

function getSelectionBox(element) {
    if (!element) {
        return null;
    }

    if (element.type === "text") {
        return {
            x: element.x,
            y: element.y,
            w: element.w || 120,
            h: element.h || 32,
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        const minX = Math.min(
            element.x1,
            element.x2,
            element.cx1 ?? element.x1,
            element.cx2 ?? element.x2
        );

        const minY = Math.min(
            element.y1,
            element.y2,
            element.cy1 ?? element.y1,
            element.cy2 ?? element.y2
        );

        const maxX = Math.max(
            element.x1,
            element.x2,
            element.cx1 ?? element.x1,
            element.cx2 ?? element.x2
        );

        const maxY = Math.max(
            element.y1,
            element.y2,
            element.cy1 ?? element.y1,
            element.cy2 ?? element.y2
        );

        return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
        };
    }

    if (element.type === "pencil") {
        const points = element.points || [];

        if (!points.length) {
            return null;
        }

        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
        };
    }

    if (element.type === "image") {
        return normalizeImageBox(element);
    }

    return {
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
    };
}

export function hitTest(element, x, y) {
    if (!element) return false;

    if (element.type === "rect" || element.type === "rectangle") {
        const minX = Math.min(element.x, element.x + element.w);
        const minY = Math.min(element.y, element.y + element.h);
        const maxX = Math.max(element.x, element.x + element.w);
        const maxY = Math.max(element.y, element.y + element.h);

        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    if (element.type === "ellipse") {
        const cx = element.x + element.w / 2;
        const cy = element.y + element.h / 2;

        return pointInEllipse(
            x,
            y,
            cx,
            cy,
            Math.abs(element.w / 2),
            Math.abs(element.h / 2)
        );
    }

    if (element.type === "diamond") {
        return pointInDiamond(x, y, element.x, element.y, element.w, element.h);
    }

    if (element.type === "line" || element.type === "arrow") {
        return distanceToBezier(x, y, element) <= 10;
    }

    if (element.type === "pencil") {
        const points = element.points || [];

        for (let i = 0; i < points.length - 1; i++) {
            if (
                distanceToSegment(
                    x,
                    y,
                    points[i].x,
                    points[i].y,
                    points[i + 1].x,
                    points[i + 1].y
                ) <= 8
            ) {
                return true;
            }
        }

        return false;
    }

    if (element.type === "image") {
        const { x: ix, y: iy, w, h } = normalizeImageBox(element);

        return x >= ix && x <= ix + w && y >= iy && y <= iy + h;
    }

    if (element.type === "text") {
        const w = element.w || 120;
        const h = element.h || 32;

        return (
            x >= element.x &&
            x <= element.x + w &&
            y >= element.y &&
            y <= element.y + h
        );
    }

    return false;
}

export function drawElement(ctx, element, selected = false) {
    if (!element) return;

    ctx.save();
    applyElementStrokeStyle(ctx, element);

    const stroke = element.stroke || "#111827";
    const strokeWidth = element.strokeWidth || 2;

    if (element.type === "rect" || element.type === "rectangle") {
        const radius = element.cornerRadius ?? 0;

        if (radius > 0) {
            drawRoundedRectPath(
                ctx,
                element.x,
                element.y,
                element.w,
                element.h,
                radius
            );

            if (element.fill && element.fill !== "transparent") {
                ctx.fill();
            }

            ctx.stroke();
        } else {
            if (element.fill && element.fill !== "transparent") {
                ctx.fillRect(element.x, element.y, element.w, element.h);
            }

            ctx.strokeRect(element.x, element.y, element.w, element.h);
        }
    } else if (element.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(
            element.x + element.w / 2,
            element.y + element.h / 2,
            Math.abs(element.w / 2),
            Math.abs(element.h / 2),
            0,
            0,
            Math.PI * 2
        );

        if (element.fill && element.fill !== "transparent") {
            ctx.fill();
        }

        ctx.stroke();
    } else if (element.type === "diamond") {
        const cx = element.x + element.w / 2;
        const cy = element.y + element.h / 2;

        ctx.beginPath();
        ctx.moveTo(cx, element.y);
        ctx.lineTo(element.x + element.w, cy);
        ctx.lineTo(cx, element.y + element.h);
        ctx.lineTo(element.x, cy);
        ctx.closePath();

        if (element.fill && element.fill !== "transparent") {
            ctx.fill();
        }

        ctx.stroke();
    } else if (element.type === "line" || element.type === "arrow") {
        ctx.beginPath();
        ctx.moveTo(element.x1, element.y1);
        ctx.bezierCurveTo(
            element.cx1 ?? element.x1,
            element.cy1 ?? element.y1,
            element.cx2 ?? element.x2,
            element.cy2 ?? element.y2,
            element.x2,
            element.y2
        );
        ctx.stroke();

        const arrowStart = !!element.arrowStart;
        const arrowEnd =
            element.type === "arrow"
                ? element.arrowEnd !== false
                : !!element.arrowEnd;

        if (arrowStart) {
            drawArrowHead(
                ctx,
                element.cx1 ?? element.x2,
                element.cy1 ?? element.y2,
                element.x1,
                element.y1,
                stroke,
                strokeWidth
            );
        }

        if (arrowEnd) {
            drawArrowHead(
                ctx,
                element.cx2 ?? element.x1,
                element.cy2 ?? element.y1,
                element.x2,
                element.y2,
                stroke,
                strokeWidth
            );
        }
    } else if (element.type === "pencil") {
        const points = element.points || [];

        if (points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.stroke();
        }
    } else if (element.type === "image") {
        const { x, y, w, h } = normalizeImageBox(element);
        const img = getCachedCanvasImage(element.src);

        ctx.setLineDash([]);

        const previousAlpha = ctx.globalAlpha;

        if (element.opacity !== undefined) {
            ctx.globalAlpha = Math.max(0, Math.min(1, Number(element.opacity) || 1));
        }

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x, y, w, h);
        } else {
            ctx.save();
            ctx.fillStyle = "#f8fafc";
            ctx.strokeStyle = "#94a3b8";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = "#64748b";
            ctx.font = "600 14px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Loading image...", x + w / 2, y + h / 2);
            ctx.restore();
        }

        ctx.globalAlpha = previousAlpha;
    } else if (element.type === "text") {
        const fontSize = element.fontSize || 20;
        const lineHeight = element.lineHeight || Math.round(fontSize * 1.2);
        const fontFamily =
            element.fontFamily ||
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif";
        const bold = !!element.bold;
        const italic = !!element.italic;
        const underline = !!element.underline;

        ctx.setLineDash([]);
        ctx.font = `${italic ? "italic" : "normal"} ${bold ? "700" : "400"} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = element.stroke || "#111827";
        ctx.textBaseline = "top";

        const lines = String(element.text || "").split("\n");

        lines.forEach((line, index) => {
            const textX = element.x;
            const textY = element.y + index * lineHeight;

            ctx.fillText(line, textX, textY);

            if (underline && line) {
                const metrics = ctx.measureText(line);
                const underlineY = textY + fontSize + 2;

                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = element.stroke || "#111827";
                ctx.lineWidth = Math.max(1, Math.round(fontSize / 14));
                ctx.moveTo(textX, underlineY);
                ctx.lineTo(textX + metrics.width, underlineY);
                ctx.stroke();
                ctx.restore();
            }
        });
    }

    if (selected) {
        const box = getSelectionBox(element);

        if (box) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#2563eb";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
            ctx.restore();
        }
    }

    ctx.restore();
}

function drawRoundedRectPath(ctx, x, y, w, h, radius = 0) {
    const width = Math.abs(w);
    const height = Math.abs(h);

    const left = w < 0 ? x + w : x;
    const top = h < 0 ? y + h : y;

    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(left + r, top);
    ctx.lineTo(left + width - r, top);
    ctx.quadraticCurveTo(left + width, top, left + width, top + r);
    ctx.lineTo(left + width, top + height - r);
    ctx.quadraticCurveTo(left + width, top + height, left + width - r, top + height);
    ctx.lineTo(left + r, top + height);
    ctx.quadraticCurveTo(left, top + height, left, top + height - r);
    ctx.lineTo(left, top + r);
    ctx.quadraticCurveTo(left, top, left + r, top);
    ctx.closePath();
}
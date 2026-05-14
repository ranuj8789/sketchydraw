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

function drawArrowHead(ctx, fromX, fromY, toX, toY, stroke) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = 10;

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
    ctx.save();
    ctx.strokeStyle = element.stroke || "#111827";
    ctx.fillStyle = "transparent";
    ctx.lineWidth = 2;

    if (element.type === "rect" || element.type === "rectangle") {
        ctx.strokeRect(element.x, element.y, element.w, element.h);
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
        ctx.stroke();
    } else if (element.type === "line") {
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
    } else if (element.type === "arrow") {
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

        const fromX = element.cx2 ?? element.x1;
        const fromY = element.cy2 ?? element.y1;

        drawArrowHead(
            ctx,
            fromX,
            fromY,
            element.x2,
            element.y2,
            element.stroke || "#111827"
        );
    } else if (element.type === "pencil") {
        if (element.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(element.points[0].x, element.points[0].y);
            for (let i = 1; i < element.points.length; i++) {
                ctx.lineTo(element.points[i].x, element.points[i].y);
            }
            ctx.stroke();
        }
    } else if (element.type === "text") {
        const fontSize = element.fontSize || 20;
        const lineHeight = element.lineHeight || Math.round(fontSize * 1.2);
        const fontFamily = element.fontFamily || "Virgil, Comic Sans MS, cursive";
        const bold = !!element.bold;

        ctx.font = `${bold ? "700" : "400"} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = element.stroke || "#111827";
        ctx.textBaseline = "top";

        const lines = String(element.text || "").split("\n");

        lines.forEach((line, index) => {
            ctx.fillText(line, element.x, element.y + index * lineHeight);
        });
    }

    if (selected) {
        let bx = 0;
        let by = 0;
        let bw = 0;
        let bh = 0;

        if (element.type === "text") {
            bx = element.x;
            by = element.y;
            bw = element.w || 120;
            bh = element.h || 32;
        } else if (element.type === "line" || element.type === "arrow") {
            bx = Math.min(
                element.x1,
                element.x2,
                element.cx1 ?? element.x1,
                element.cx2 ?? element.x2
            );
            by = Math.min(
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

            bw = maxX - bx;
            bh = maxY - by;
        } else if (element.type === "pencil") {
            const xs = element.points.map((p) => p.x);
            const ys = element.points.map((p) => p.y);
            bx = Math.min(...xs);
            by = Math.min(...ys);
            bw = Math.max(...xs) - bx;
            bh = Math.max(...ys) - by;
        } else {
            bx = element.x;
            by = element.y;
            bw = element.w;
            bh = element.h;
        }

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "#2563eb";
        ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8);
        ctx.restore();
    }

    ctx.restore();
}
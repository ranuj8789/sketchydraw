import {
    buildTextCanvasFont,
    getTextAnchorX,
    getUnderlineBounds,
    normalizeTextStyle,
} from "../canvas/textRenderStyle";

const SELECTION_COLOR = "#6965db";
const SELECTION_PADDING = 6;
const TEXT_SELECTION_PADDING_X = 7;
const TEXT_SELECTION_PADDING_Y = 5;
const HANDLE_SIZE = 7;
const TEXT_HANDLE_SIZE = 6;

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

    return {x, y};
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
    const p0 = {x: element.x1, y: element.y1};
    const p1 = {x: element.cx1 ?? element.x1, y: element.cy1 ?? element.y1};
    const p2 = {x: element.cx2 ?? element.x2, y: element.cy2 ?? element.y2};
    const p3 = {x: element.x2, y: element.y2};

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

    return {x, y, w, h};
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

function getSelectionVisualBox(element, box) {
    if (!element || !box) return box;

    if (element.type === "text") {
        return {
            x: box.x - TEXT_SELECTION_PADDING_X,
            y: box.y - TEXT_SELECTION_PADDING_Y,
            w: box.w + TEXT_SELECTION_PADDING_X * 2,
            h: box.h + TEXT_SELECTION_PADDING_Y * 2,
        };
    }

    return {
        x: box.x - SELECTION_PADDING,
        y: box.y - SELECTION_PADDING,
        w: box.w + SELECTION_PADDING * 2,
        h: box.h + SELECTION_PADDING * 2,
    };
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function easeOutCubic(t) {
    const value = clamp01(t);
    return 1 - Math.pow(1 - value, 3);
}

function getAnimationProgress(element, renderOptions = {}) {
    const animation = element?.animation || {};
    const type = animation.type || "none";

    const activeAnimatedElementIds = renderOptions.activeAnimatedElementIds;
    const hasActiveElementFilter =
        activeAnimatedElementIds &&
        typeof activeAnimatedElementIds.has === "function";

    if (
        !renderOptions.animationMode ||
        type === "none" ||
        (hasActiveElementFilter && !activeAnimatedElementIds.has(element.id))
    ) {
        return {
            active: false,
            type: "none",
            progress: 1,
            easedProgress: 1,
            localTimeMs: 0,
            durationMs: 1000,
            loop: false,
        };
    }

    const durationMs = Math.max(1, Number(animation.durationMs) || 1000);
    const delayMs = Math.max(0, Number(animation.delayMs) || 0);
    const loopPauseMs = Math.max(0, Number(renderOptions.loopPauseMs) || 0);
    const rawAnimationTimeMs = Math.max(0, Number(renderOptions.animationTimeMs) || 0);
    const loop = !!animation.loop || !!renderOptions.loopAnimation;
    const cycleMs = Math.max(1, delayMs + durationMs + loopPauseMs);
    const animationTimeMs = loop
        ? rawAnimationTimeMs % cycleMs
        : rawAnimationTimeMs;
    const localTimeMs = Math.max(0, animationTimeMs - delayMs);
    const rawProgress = localTimeMs / durationMs;
    const progress = clamp01(rawProgress);

    return {
        active: true,
        type,
        progress,
        easedProgress: easeOutCubic(progress),
        localTimeMs,
        durationMs,
        loop,
    };
}

function getPulseWave(animationState) {
    if (!animationState?.active) return 0;

    const durationMs = Math.max(1, animationState.durationMs || 1000);
    const phase = (animationState.localTimeMs % durationMs) / durationMs;
    return (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
}

function applyAnimationBeforeDraw(ctx, element, animationState) {
    if (!animationState.active) return;

    const box = getSelectionBox(element);
    const wave = getPulseWave(animationState);

    if (animationState.type === "blink") {
        ctx.globalAlpha *= wave > 0.45 ? 1 : 0.22;
    }

    if (animationState.type === "pulse" && box) {
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const scale = 1 + wave * 0.075;

        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
    }

    if (animationState.type === "glow") {
        ctx.shadowColor = element.stroke || "#2563eb";
        ctx.shadowBlur = 8 + wave * 14;
    }

    if (animationState.type === "movingDashes") {
        ctx.setLineDash([12, 8]);
        ctx.lineDashOffset = -(animationState.localTimeMs || 0) / 32;
    }
}

function strokePathWithProgress(ctx, pathLength, progress) {
    const safeLength = Math.max(1, pathLength || 1);

    if (progress >= 0.995) {
        ctx.stroke();
        return;
    }

    ctx.save();
    ctx.setLineDash([safeLength * clamp01(progress), safeLength]);
    ctx.lineDashOffset = 0;
    ctx.stroke();
    ctx.restore();
}

function getRectPathLength(w, h) {
    return Math.max(1, 2 * (Math.abs(w || 0) + Math.abs(h || 0)));
}

function getEllipsePathLength(w, h) {
    const a = Math.abs(w || 0) / 2;
    const b = Math.abs(h || 0) / 2;

    if (!a || !b) return 1;

    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

function getDiamondPathLength(w, h) {
    return Math.max(1, 4 * Math.hypot(Math.abs(w || 0) / 2, Math.abs(h || 0) / 2));
}

function shouldDrawPathProgress(animationState) {
    return (
        animationState.active &&
        (animationState.type === "draw" || animationState.type === "borderDraw")
    );
}

function drawMovingHead(ctx, element, animationState, stroke, strokeWidth) {
    if (!animationState.active || animationState.type !== "movingHead") return;
    if (element.type !== "line" && element.type !== "arrow") return;

    const p0 = {x: element.x1, y: element.y1};
    const p1 = {x: element.cx1 ?? element.x1, y: element.cy1 ?? element.y1};
    const p2 = {x: element.cx2 ?? element.x2, y: element.cy2 ?? element.y2};
    const p3 = {x: element.x2, y: element.y2};
    const t = Math.max(0.04, animationState.progress || 0.04);
    const headPoint = cubicBezierPoint(t, p0, p1, p2, p3);
    const prevPoint = cubicBezierPoint(Math.max(0, t - 0.05), p0, p1, p2, p3);

    drawArrowHead(ctx, prevPoint.x, prevPoint.y, headPoint.x, headPoint.y, stroke, strokeWidth);
}

function drawPulseRing(ctx, element, animationState, stroke) {
    if (!animationState.active) return;
    if (animationState.type !== "pulseRing" && animationState.type !== "spotlight") return;

    const box = getSelectionBox(element);
    if (!box) return;

    const wave = animationState.type === "spotlight" ? getPulseWave(animationState) : animationState.progress;
    const pad = animationState.type === "spotlight" ? 10 + wave * 10 : 8 + wave * 24;
    const alpha = animationState.type === "spotlight" ? 0.16 + wave * 0.10 : Math.max(0, 0.42 * (1 - wave));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke || "#2563eb";
    ctx.fillStyle = stroke || "#2563eb";
    ctx.lineWidth = animationState.type === "spotlight" ? 0 : 3;
    ctx.setLineDash([]);

    const x = box.x - pad;
    const y = box.y - pad;
    const w = box.w + pad * 2;
    const h = box.h + pad * 2;

    if (element.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    } else {
        const radius = Math.min(18, Math.max(6, Math.min(Math.abs(w), Math.abs(h)) * 0.08));
        if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, radius);
        } else {
            ctx.beginPath();
            ctx.rect(x, y, w, h);
        }
    }

    if (animationState.type === "spotlight") {
        ctx.fill();
    } else {
        ctx.stroke();
    }

    ctx.restore();
}

function getAnimatedTextLines(text, animationState) {
    const fullText = String(text || "");

    if (!animationState.active || animationState.type !== "typewriter") {
        return fullText.split("\n");
    }

    const visibleChars = Math.ceil(fullText.length * animationState.progress);
    return fullText.slice(0, visibleChars).split("\n");
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
        const {x: ix, y: iy, w, h} = normalizeImageBox(element);

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

export function drawElement(ctx, element, selected = false, renderOptions = {}) {
    if (!element) return;

    ctx.save();
    applyElementStrokeStyle(ctx, element);

    const stroke = element.stroke || "#111827";
    const strokeWidth = element.strokeWidth || 2;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const animationState = getAnimationProgress(element, renderOptions);
    const easedProgress = easeOutCubic(animationState.progress);

    if (animationState.active && animationState.type === "fadeIn") {
        ctx.globalAlpha = ctx.globalAlpha * easedProgress;
    }

    if (animationState.active && animationState.type === "slideUp") {
        ctx.translate(0, (1 - easedProgress) * 18);
        ctx.globalAlpha = ctx.globalAlpha * easedProgress;
    }

    if (animationState.active && animationState.type === "scaleIn") {
        const box = getSelectionBox(element);

        if (box) {
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const scale = 0.75 + easedProgress * 0.25;

            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha = ctx.globalAlpha * easedProgress;
        }
    }

    applyAnimationBeforeDraw(ctx, element, animationState);

    if (element.type === "rect" || element.type === "rectangle") {
        const radius = element.cornerRadius ?? 0;
        const drawProgressPath = shouldDrawPathProgress(animationState);

        if (radius > 0 || drawProgressPath) {
            drawRoundedRectPath(
                ctx,
                element.x,
                element.y,
                element.w,
                element.h,
                radius
            );

            if (element.fill && element.fill !== "transparent" && !drawProgressPath) {
                ctx.fill();
            }

            if (drawProgressPath) {
                strokePathWithProgress(ctx, getRectPathLength(element.w, element.h), easedProgress);
            } else {
                ctx.stroke();
            }
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

        const drawProgressPath = shouldDrawPathProgress(animationState);

        if (element.fill && element.fill !== "transparent" && !drawProgressPath) {
            ctx.fill();
        }

        if (drawProgressPath) {
            strokePathWithProgress(ctx, getEllipsePathLength(element.w, element.h), easedProgress);
        } else {
            ctx.stroke();
        }
    } else if (element.type === "diamond") {
        const cx = element.x + element.w / 2;
        const cy = element.y + element.h / 2;

        ctx.beginPath();
        ctx.moveTo(cx, element.y);
        ctx.lineTo(element.x + element.w, cy);
        ctx.lineTo(cx, element.y + element.h);
        ctx.lineTo(element.x, cy);
        ctx.closePath();

        const drawProgressPath = shouldDrawPathProgress(animationState);

        if (element.fill && element.fill !== "transparent" && !drawProgressPath) {
            ctx.fill();
        }

        if (drawProgressPath) {
            strokePathWithProgress(ctx, getDiamondPathLength(element.w, element.h), easedProgress);
        } else {
            ctx.stroke();
        }
    } else if (element.type === "line" || element.type === "arrow") {
        const shouldDrawProgress = animationState.active && animationState.type === "draw";
        const progress = shouldDrawProgress ? easedProgress : 1;
        const p0 = { x: element.x1, y: element.y1 };
        const p1 = { x: element.cx1 ?? element.x1, y: element.cy1 ?? element.y1 };
        const p2 = { x: element.cx2 ?? element.x2, y: element.cy2 ?? element.y2 };
        const p3 = { x: element.x2, y: element.y2 };

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);

        if (progress >= 1) {
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
            ctx.stroke();
        } else {
            const steps = Math.max(2, Math.ceil(32 * progress));

            for (let i = 1; i <= steps; i++) {
                const t = Math.min(progress, (i / steps) * progress);
                const point = cubicBezierPoint(t, p0, p1, p2, p3);
                ctx.lineTo(point.x, point.y);
            }

            ctx.stroke();
        }

        const arrowStart = !!element.arrowStart;
        const arrowEnd =
            element.type === "arrow"
                ? element.arrowEnd !== false
                : !!element.arrowEnd;

        if (progress >= 1 && arrowStart) {
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

        if (arrowEnd && progress > 0.04) {
            const headPoint = progress >= 1 ? p3 : cubicBezierPoint(progress, p0, p1, p2, p3);
            const prevPoint = cubicBezierPoint(Math.max(0, progress - 0.05), p0, p1, p2, p3);

            drawArrowHead(
                ctx,
                prevPoint.x,
                prevPoint.y,
                headPoint.x,
                headPoint.y,
                stroke,
                strokeWidth
            );
        }

        drawMovingHead(ctx, element, animationState, stroke, strokeWidth);
    } else if (element.type === "pencil") {
        const points = element.points || [];

        if (points.length > 1) {
            const shouldDrawProgress = animationState.active && animationState.type === "draw";
            const progress = shouldDrawProgress ? easedProgress : 1;
            const lastIndex = Math.max(1, Math.ceil((points.length - 1) * progress));

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i <= lastIndex && i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }

            ctx.stroke();
        }
    } else if (element.type === "image") {
        const {x, y, w, h} = normalizeImageBox(element);
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
        const style = normalizeTextStyle(element);

        ctx.setLineDash([]);
        ctx.font = buildTextCanvasFont(style);
        ctx.fillStyle = style.stroke;
        ctx.textBaseline = "top";
        ctx.textAlign = style.textAlign;

        const lines = getAnimatedTextLines(element.text, animationState);

        lines.forEach((line, index) => {
            const textX = getTextAnchorX(element, style);
            const textY = element.y + index * style.lineHeight;

            ctx.fillText(line, textX, textY);

            if (style.underline && line) {
                const metrics = ctx.measureText(line);
                const underlineY = textY + style.fontSize + 2;
                const underlineBounds = getUnderlineBounds(
                    textX,
                    metrics.width,
                    style
                );

                ctx.save();
                ctx.beginPath();
                ctx.strokeStyle = style.stroke;
                ctx.lineWidth = Math.max(1, Math.round(style.fontSize / 14));
                ctx.moveTo(underlineBounds.startX, underlineY);
                ctx.lineTo(underlineBounds.endX, underlineY);
                ctx.stroke();
                ctx.restore();
            }
        });
    }

    drawPulseRing(ctx, element, animationState, stroke);

    if (selected) {
        const box = getSelectionBox(element);

        if (box) {
            const visualBox = getSelectionVisualBox(element, box);

            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = SELECTION_COLOR;
            ctx.lineWidth = 1;
            ctx.strokeRect(
                visualBox.x,
                visualBox.y,
                visualBox.w,
                visualBox.h
            );
            ctx.restore();

            if (element.type !== "pencil") {
                drawSelectionResizeHandles(ctx, visualBox, {
                    text: element.type === "text",
                });
            }
        }
    }

    ctx.restore();
}


function drawSelectionResizeHandles(ctx, box, options = {}) {
    const isText = !!options.text;

    // Text selection is intentionally quieter: only 4 corner handles.
    const points = isText
        ? [
            { x: box.x, y: box.y },
            { x: box.x + box.w, y: box.y },
            { x: box.x, y: box.y + box.h },
            { x: box.x + box.w, y: box.y + box.h },
        ]
        : [
            { x: box.x, y: box.y },
            { x: box.x + box.w / 2, y: box.y },
            { x: box.x + box.w, y: box.y },
            { x: box.x, y: box.y + box.h / 2 },
            { x: box.x + box.w, y: box.y + box.h / 2 },
            { x: box.x, y: box.y + box.h },
            { x: box.x + box.w / 2, y: box.y + box.h },
            { x: box.x + box.w, y: box.y + box.h },
        ];

    const size = isText ? TEXT_HANDLE_SIZE : HANDLE_SIZE;
    const half = size / 2;

    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;

    points.forEach((point) => {
        ctx.beginPath();

        if (typeof ctx.roundRect === "function") {
            ctx.roundRect(point.x - half, point.y - half, size, size, 1.5);
        } else {
            ctx.rect(point.x - half, point.y - half, size, size);
        }

        ctx.fill();
        ctx.stroke();
    });

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
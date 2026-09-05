import {
    buildTextCanvasFont,
    getTextAnchorX,
    getUnderlineBounds,
    normalizeTextStyle,
} from "../canvas/textRenderStyle";
import { isSystemDesignType } from "../canvas/canvasConstants";
import { wrapTextLines } from "../canvas/textMetrics";
import { draw3DPrimitive } from "../components/3d/threeDRenderer";

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
    img.crossOrigin = "anonymous";

    img.onload = () => {
        window.dispatchEvent(new Event("sketchydraw:image-loaded"));
    };

    img.src = src;
    imageElementCache.set(src, img);

    return img;
}

export async function preloadDrawingImages(elements = []) {
    const sources = Array.from(new Set(
        (elements || [])
            .filter((element) => element?.type === "image" && element.src)
            .map((element) => element.src)
    ));

    await Promise.all(sources.map((src) => new Promise((resolve) => {
        const image = getCachedCanvasImage(src);
        if (!image || image.complete) {
            resolve();
            return;
        }

        const done = () => resolve();
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
    })));
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

    const resolvedTiming = renderOptions?.resolvedAnimationTimings?.get?.(element.id);
    const durationMs = Math.max(1, Number(resolvedTiming?.durationMs ?? animation.durationMs) || 1000);
    const delayMs = Math.max(0, Number(resolvedTiming?.startMs ?? animation.delayMs) || 0);
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

function stableAnimationDirection(id) {
    const value = String(id || "");
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return Math.abs(hash) % 2 === 0 ? 1 : -1;
}

function elasticOut(t) {
    const value = clamp01(t);
    if (value === 0 || value === 1) return value;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * value) * Math.sin((value * 10 - 0.75) * c4) + 1;
}

function formatCountUpText(text, progress) {
    const p = clamp01(progress);
    return String(text || "").replace(/-?\d[\d,]*(?:\.\d+)?/g, (token) => {
        const compact = token.replace(/,/g, "");
        const target = Number(compact);
        if (!Number.isFinite(target)) return token;
        const decimalMatch = compact.match(/\.(\d+)$/);
        const decimals = decimalMatch ? decimalMatch[1].length : 0;
        const current = target * p;
        const rounded = decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
        const [whole, fraction] = rounded.split(".");
        const sign = whole.startsWith("-") ? "-" : "";
        const absWhole = sign ? whole.slice(1) : whole;
        const withCommas = absWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return `${sign}${withCommas}${fraction !== undefined ? `.${fraction}` : ""}`;
    });
}

function traceCurrentElementPath(ctx, element) {
    if (element.type === "rect" || element.type === "rectangle" || element.type === "user" || isSystemDesignType(element.type)) {
        const box = getSelectionBox(element);
        if (!box) return false;
        const radius = element.type === "rect" || element.type === "rectangle" ? Math.max(0, Number(element.cornerRadius) || 0) : 12;
        drawRoundedRectPath(ctx, box.x, box.y, box.w, box.h, Math.min(radius, Math.abs(box.w) / 2, Math.abs(box.h) / 2));
        return true;
    }
    if (element.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(element.x + element.w / 2, element.y + element.h / 2, Math.abs(element.w / 2), Math.abs(element.h / 2), 0, 0, Math.PI * 2);
        return true;
    }
    if (element.type === "diamond") {
        const cx = element.x + element.w / 2;
        const cy = element.y + element.h / 2;
        ctx.beginPath();
        ctx.moveTo(cx, element.y);
        ctx.lineTo(element.x + element.w, cy);
        ctx.lineTo(cx, element.y + element.h);
        ctx.lineTo(element.x, cy);
        ctx.closePath();
        return true;
    }
    if (element.type === "line" || element.type === "arrow") {
        ctx.beginPath();
        ctx.moveTo(element.x1, element.y1);
        ctx.bezierCurveTo(element.cx1 ?? element.x1, element.cy1 ?? element.y1, element.cx2 ?? element.x2, element.cy2 ?? element.y2, element.x2, element.y2);
        return true;
    }
    return false;
}

function drawDataFlow(ctx, element, animationState, stroke, strokeWidth) {
    if (!animationState.active || animationState.type !== "dataFlow") return;
    if (element.type !== "line" && element.type !== "arrow") return;
    const p0 = {x: element.x1, y: element.y1};
    const p1 = {x: element.cx1 ?? element.x1, y: element.cy1 ?? element.y1};
    const p2 = {x: element.cx2 ?? element.x2, y: element.cy2 ?? element.y2};
    const p3 = {x: element.x2, y: element.y2};
    const phase = (animationState.localTimeMs % Math.max(1, animationState.durationMs)) / Math.max(1, animationState.durationMs);
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = stroke || "#2563eb";
    ctx.shadowColor = stroke || "#2563eb";
    ctx.shadowBlur = 12;
    [0, 0.33, 0.66].forEach((offset, index) => {
        const t = (phase + offset) % 1;
        const point = cubicBezierPoint(t, p0, p1, p2, p3);
        const radius = Math.max(2.5, (strokeWidth || 2) * (index === 0 ? 1.8 : 1.35));
        ctx.globalAlpha = index === 0 ? 1 : 0.68;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawEnergyTrace(ctx, element, animationState, stroke, strokeWidth) {
    if (!animationState.active || animationState.type !== "energyTrace") return;
    ctx.save();
    if (!traceCurrentElementPath(ctx, element)) { ctx.restore(); return; }
    const box = getSelectionBox(element);
    const approxLength = element.type === "line" || element.type === "arrow"
        ? Math.max(80, Math.hypot((element.x2 || 0) - (element.x1 || 0), (element.y2 || 0) - (element.y1 || 0)) * 1.25)
        : Math.max(100, 2 * (Math.abs(box?.w || 80) + Math.abs(box?.h || 50)));
    const segment = Math.max(26, approxLength * 0.22);
    const phase = (animationState.localTimeMs % Math.max(1, animationState.durationMs)) / Math.max(1, animationState.durationMs);
    ctx.strokeStyle = stroke || "#2563eb";
    ctx.lineWidth = Math.max(2, (strokeWidth || 2) + 1.5);
    ctx.setLineDash([segment, Math.max(1, approxLength - segment)]);
    ctx.lineDashOffset = -phase * approxLength;
    ctx.shadowColor = stroke || "#2563eb";
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.92;
    ctx.stroke();
    ctx.restore();
}

function drawSignalBeam(ctx, element, animationState, stroke, strokeWidth) {
    if (!animationState.active || animationState.type !== "signalBeam") return;
    if (element.type !== "line" && element.type !== "arrow") return;
    const wave = getPulseWave(animationState);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(element.x1, element.y1);
    ctx.bezierCurveTo(element.cx1 ?? element.x1, element.cy1 ?? element.y1, element.cx2 ?? element.x2, element.cy2 ?? element.y2, element.x2, element.y2);
    ctx.setLineDash([]);
    ctx.strokeStyle = stroke || "#2563eb";
    ctx.lineWidth = Math.max(2, (strokeWidth || 2) + 2 + wave * 3);
    ctx.globalAlpha = 0.22 + wave * 0.34;
    ctx.shadowColor = stroke || "#2563eb";
    ctx.shadowBlur = 12 + wave * 18;
    ctx.stroke();
    ctx.restore();
}

function drawArrivalPulse(ctx, element, animationState, stroke) {
    if (!animationState.active || animationState.type !== "arrivalPulse") return;
    const box = getSelectionBox(element);
    if (!box) return;
    const p = clamp01(animationState.progress);
    const burst = Math.sin(p * Math.PI);
    const pad = 8 + p * 22;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.55 * (1 - p));
    ctx.strokeStyle = stroke || "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = stroke || "#2563eb";
    ctx.shadowBlur = 10 + burst * 14;
    ctx.setLineDash([]);
    if (element.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, Math.abs(box.w / 2) + pad, Math.abs(box.h / 2) + pad, 0, 0, Math.PI * 2);
    } else {
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2, 14);
        else ctx.rect(box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
    }
    ctx.stroke();
    ctx.restore();
}

function drawHighlightSweep(ctx, element, animationState) {
    if (!animationState.active || animationState.type !== "highlightSweep") return;
    const box = getSelectionBox(element);
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y)) return;
    const phase = (animationState.localTimeMs % Math.max(1, animationState.durationMs)) / Math.max(1, animationState.durationMs);
    const sweepW = Math.max(22, Math.abs(box.w) * 0.22);
    const startX = box.x - sweepW * 1.4;
    const x = startX + phase * (Math.abs(box.w) + sweepW * 2.8);
    ctx.save();
    ctx.beginPath();
    if (element.type === "ellipse") {
        ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, Math.abs(box.w / 2), Math.abs(box.h / 2), 0, 0, Math.PI * 2);
    } else {
        ctx.rect(box.x, box.y, box.w, box.h);
    }
    ctx.clip();
    const gradient = ctx.createLinearGradient(x - sweepW, box.y, x + sweepW, box.y);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.46)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.translate(x, box.y + box.h / 2);
    ctx.rotate(-0.20);
    ctx.fillRect(-sweepW, -Math.abs(box.h), sweepW * 2, Math.abs(box.h) * 2);
    ctx.restore();
}

function drawPremiumAnimationOverlay(ctx, element, animationState, stroke, strokeWidth) {
    drawDataFlow(ctx, element, animationState, stroke, strokeWidth);
    drawEnergyTrace(ctx, element, animationState, stroke, strokeWidth);
    drawSignalBeam(ctx, element, animationState, stroke, strokeWidth);
    drawArrivalPulse(ctx, element, animationState, stroke);
    drawHighlightSweep(ctx, element, animationState);
}

function getAnimatedTextLines(text, animationState, ctx, maxWidth) {
    const fullText = String(text || "");

    if (!animationState.active || animationState.type !== "typewriter") {
        return wrapTextLines(ctx, fullText, maxWidth);
    }

    const visibleChars = Math.ceil(fullText.length * animationState.progress);
    return wrapTextLines(ctx, fullText.slice(0, visibleChars), maxWidth);
}

export function hitTest(element, x, y) {
    if (!element) return false;

    if (element.type === "webgl3d") {
        const minX = Math.min(element.x, element.x + element.w);
        const minY = Math.min(element.y, element.y + element.h);
        const maxX = Math.max(element.x, element.x + element.w);
        const maxY = Math.max(element.y, element.y + element.h);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    } else if (element.type === "rect" || element.type === "rectangle") {
        const minX = Math.min(element.x, element.x + element.w);
        const minY = Math.min(element.y, element.y + element.h);
        const maxX = Math.max(element.x, element.x + element.w);
        const maxY = Math.max(element.y, element.y + element.h);

        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    if (element.type === "user" || isSystemDesignType(element.type)) {
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


function getRichStyleAt(element, index, baseStyle) {
    const ranges = Array.isArray(element.richText) ? element.richText : [];
    return ranges.reduce((style, range) => {
        if (index >= Number(range.start) && index < Number(range.end)) {
            return {
                ...style,
                bold: range.bold ?? style.bold,
                italic: range.italic ?? style.italic,
                underline: range.underline ?? style.underline,
                strike: range.strike ?? style.strike,
                stroke: range.stroke || style.stroke,
                fontFamily: range.fontFamily || style.fontFamily,
                fontSize: Number(range.fontSize) > 0 ? Number(range.fontSize) : style.fontSize,
                lineHeight: Number(range.fontSize) > 0
                    ? Math.max(style.lineHeight, Number(range.fontSize) * 1.25)
                    : style.lineHeight,
            };
        }
        return style;
    }, { ...baseStyle });
}

function drawRichTextElement(ctx, element, baseStyle) {
    const text = String(element.text || "");
    const lines = text.split("\n");
    let globalIndex = 0;

    lines.forEach((line, lineIndex) => {
        const segments = [];
        let segmentStart = 0;
        let segmentStyle = getRichStyleAt(element, globalIndex, baseStyle);

        for (let i = 1; i <= line.length; i += 1) {
            const nextStyle = i < line.length
                ? getRichStyleAt(element, globalIndex + i, baseStyle)
                : null;
            const changed = !nextStyle ||
                nextStyle.bold !== segmentStyle.bold ||
                nextStyle.italic !== segmentStyle.italic ||
                nextStyle.underline !== segmentStyle.underline ||
                nextStyle.strike !== segmentStyle.strike ||
                nextStyle.stroke !== segmentStyle.stroke ||
                nextStyle.fontFamily !== segmentStyle.fontFamily ||
                nextStyle.fontSize !== segmentStyle.fontSize;

            if (changed) {
                segments.push({
                    text: line.slice(segmentStart, i),
                    style: segmentStyle,
                });
                segmentStart = i;
                segmentStyle = nextStyle;
            }
        }

        if (!line.length) segments.push({ text: "", style: baseStyle });

        const widths = segments.map((segment) => {
            ctx.font = buildTextCanvasFont(segment.style);
            return ctx.measureText(segment.text).width;
        });
        const totalWidth = widths.reduce((sum, width) => sum + width, 0);

        let cursorX = element.x;
        if (baseStyle.textAlign === "center") cursorX = element.x + (element.w || 120) / 2 - totalWidth / 2;
        if (baseStyle.textAlign === "right") cursorX = element.x + (element.w || 120) - totalWidth;
        const textY = element.y + lineIndex * baseStyle.lineHeight;

        segments.forEach((segment, segmentIndex) => {
            ctx.font = buildTextCanvasFont(segment.style);
            ctx.fillStyle = segment.style.stroke;
            ctx.textAlign = "left";
            ctx.fillText(segment.text, cursorX, textY);

            if ((segment.style.underline || segment.style.strike) && segment.text) {
                ctx.save();
                ctx.strokeStyle = segment.style.stroke;
                ctx.lineWidth = Math.max(1, Math.round(segment.style.fontSize / 14));
                if (segment.style.underline) {
                    const underlineY = textY + segment.style.fontSize + 2;
                    ctx.beginPath();
                    ctx.moveTo(cursorX, underlineY);
                    ctx.lineTo(cursorX + widths[segmentIndex], underlineY);
                    ctx.stroke();
                }
                if (segment.style.strike) {
                    const strikeY = textY + segment.style.fontSize * 0.52;
                    ctx.beginPath();
                    ctx.moveTo(cursorX, strikeY);
                    ctx.lineTo(cursorX + widths[segmentIndex], strikeY);
                    ctx.stroke();
                }
                ctx.restore();
            }

            cursorX += widths[segmentIndex];
        });

        globalIndex += line.length + 1;
    });
}

function drawSystemDesignLabel(ctx, text, x, y, w, fontSize, stroke, lineHeight = 1.15) {
    const lines = String(text || "").split("\n");
    const safeFontSize = Math.max(10, fontSize || 14);

    ctx.save();
    ctx.setLineDash([]);
    ctx.font = `700 ${safeFontSize}px "Caveat", cursive`;
    ctx.fillStyle = stroke || "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    lines.forEach((line, index) => {
        const lineY = y + index * safeFontSize * lineHeight;
        ctx.fillText(line, x + w / 2, lineY);
    });

    ctx.restore();
}

function drawSystemDesignShape(ctx, element) {
    const left = Math.min(element.x, element.x + element.w);
    const top = Math.min(element.y, element.y + element.h);
    const width = Math.max(20, Math.abs(element.w || 0));
    const height = Math.max(20, Math.abs(element.h || 0));
    const fill = element.fill;
    const shouldFill = fill && fill !== "transparent";
    const stroke = element.stroke || "#111827";
    const minSide = Math.min(width, height);
    const pad = minSide * 0.12;

    const strokeCurrentPath = () => {
        if (shouldFill) ctx.fill();
        ctx.stroke();
    };

    if (element.type === "cache") {
        drawRoundedRectPath(ctx, left + width * 0.08, top + height * 0.18, width * 0.84, height * 0.62, minSide * 0.12);
        strokeCurrentPath();
        [0, 1, 2].forEach((index) => {
            const y = top + height * 0.34 + index * height * 0.13;
            ctx.beginPath();
            ctx.moveTo(left + width * 0.23, y);
            ctx.lineTo(left + width * 0.66, y);
            ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(left + width * 0.74, top + height * 0.36);
        ctx.lineTo(left + width * 0.68, top + height * 0.52);
        ctx.lineTo(left + width * 0.77, top + height * 0.52);
        ctx.lineTo(left + width * 0.70, top + height * 0.68);
        ctx.stroke();
        drawSystemDesignLabel(ctx, "cache", left + width * 0.12, top + height * 0.18, width * 0.76, minSide * 0.18, stroke);
        return;
    }

    if (element.type === "database") {
        const rx = width * 0.36;
        const ry = height * 0.11;
        const cx = left + width / 2;
        const topY = top + height * 0.22;
        const bottomY = top + height * 0.78;
        ctx.beginPath();
        ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
        if (shouldFill) ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - rx, topY);
        ctx.lineTo(cx - rx, bottomY);
        ctx.moveTo(cx + rx, topY);
        ctx.lineTo(cx + rx, bottomY);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI);
        ctx.stroke();
        drawSystemDesignLabel(ctx, "database", left + width * 0.1, top + height * 0.49, width * 0.8, minSide * 0.16, stroke);
        return;
    }

    if (element.type === "server") {
        drawRoundedRectPath(ctx, left + width * 0.18, top + height * 0.08, width * 0.64, height * 0.84, minSide * 0.08);
        strokeCurrentPath();
        [0, 1, 2].forEach((index) => {
            const sy = top + height * (0.28 + index * 0.18);
            drawRoundedRectPath(ctx, left + width * 0.28, sy, width * 0.38, height * 0.09, minSide * 0.03);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(left + width * 0.72, sy + height * 0.045, minSide * 0.02, 0, Math.PI * 2);
            if (index === 0 && shouldFill) ctx.fill();
            ctx.stroke();
        });
        drawSystemDesignLabel(ctx, "server", left + width * 0.18, top + height * 0.16, width * 0.64, minSide * 0.15, stroke);
        return;
    }

    if (element.type === "nginx") {
        const cx = left + width / 2;
        const cy = top + height / 2;
        const rx = width * 0.32;
        const ry = height * 0.36;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
            const angle = -Math.PI / 2 + (i * Math.PI) / 3;
            const px = cx + Math.cos(angle) * rx;
            const py = cy + Math.sin(angle) * ry;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        strokeCurrentPath();
        drawSystemDesignLabel(ctx, "nginx", left + width * 0.18, top + height * 0.48, width * 0.64, minSide * 0.18, stroke);
        return;
    }

    if (element.type === "datacenter") {
        drawRoundedRectPath(ctx, left + width * 0.08, top + height * 0.14, width * 0.84, height * 0.72, minSide * 0.06);
        strokeCurrentPath();
        [0, 1, 2].forEach((index) => {
            const rackX = left + width * (0.18 + index * 0.22);
            drawRoundedRectPath(ctx, rackX, top + height * 0.30, width * 0.14, height * 0.38, minSide * 0.03);
            ctx.stroke();
            [0, 1, 2].forEach((slot) => {
                const slotY = top + height * (0.36 + slot * 0.09);
                ctx.beginPath();
                ctx.moveTo(rackX + width * 0.03, slotY);
                ctx.lineTo(rackX + width * 0.11, slotY);
                ctx.stroke();
            });
        });
        drawSystemDesignLabel(ctx, "data\ncentre", left + width * 0.58, top + height * 0.45, width * 0.24, minSide * 0.15, stroke);
        return;
    }

    if (element.type === "kafka") {
        const points = [
            [left + width * 0.22, top + height * 0.30],
            [left + width * 0.22, top + height * 0.70],
            [left + width * 0.50, top + height * 0.20],
            [left + width * 0.50, top + height * 0.50],
            [left + width * 0.50, top + height * 0.80],
            [left + width * 0.78, top + height * 0.30],
            [left + width * 0.78, top + height * 0.70],
        ];
        const links = [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6],[5,6]];
        links.forEach(([a,b]) => {
            ctx.beginPath();
            ctx.moveTo(points[a][0], points[a][1]);
            ctx.lineTo(points[b][0], points[b][1]);
            ctx.stroke();
        });
        points.forEach(([px, py]) => {
            ctx.beginPath();
            ctx.arc(px, py, minSide * 0.045, 0, Math.PI * 2);
            if (shouldFill) ctx.fill();
            ctx.stroke();
        });
        drawSystemDesignLabel(ctx, "kafka", left + width * 0.18, top + height * 0.50, width * 0.64, minSide * 0.18, stroke);
        return;
    }

    if (element.type === "splunk") {
        drawRoundedRectPath(ctx, left + width * 0.10, top + height * 0.18, width * 0.80, height * 0.60, minSide * 0.09);
        strokeCurrentPath();
        ctx.beginPath();
        ctx.moveTo(left + width * 0.24, top + height * 0.52);
        ctx.lineTo(left + width * 0.34, top + height * 0.42);
        ctx.lineTo(left + width * 0.24, top + height * 0.32);
        ctx.stroke();
        [0,1,2].forEach((index) => {
            const barH = height * (0.10 + index * 0.06);
            const bx = left + width * (0.50 + index * 0.09);
            const by = top + height * 0.62 - barH;
            ctx.beginPath();
            ctx.moveTo(bx, by + barH);
            ctx.lineTo(bx, by);
            ctx.stroke();
        });
        drawSystemDesignLabel(ctx, "splunk", left + width * 0.16, top + height * 0.74, width * 0.68, minSide * 0.15, stroke);
        return;
    }

    if (element.type === "security") {
        const cx = left + width / 2;
        ctx.beginPath();
        ctx.moveTo(cx, top + height * 0.14);
        ctx.quadraticCurveTo(left + width * 0.78, top + height * 0.22, left + width * 0.72, top + height * 0.54);
        ctx.quadraticCurveTo(left + width * 0.68, top + height * 0.78, cx, top + height * 0.88);
        ctx.quadraticCurveTo(left + width * 0.32, top + height * 0.78, left + width * 0.28, top + height * 0.54);
        ctx.quadraticCurveTo(left + width * 0.22, top + height * 0.22, cx, top + height * 0.14);
        ctx.closePath();
        strokeCurrentPath();
        drawRoundedRectPath(ctx, left + width * 0.41, top + height * 0.44, width * 0.18, height * 0.16, minSide * 0.03);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, top + height * 0.42, width * 0.07, Math.PI, 0);
        ctx.stroke();
        drawSystemDesignLabel(ctx, "security", left + width * 0.16, top + height * 0.28, width * 0.68, minSide * 0.14, stroke);
        return;
    }

    if (element.type === "broker") {
        drawRoundedRectPath(ctx, left + width * 0.12, top + height * 0.20, width * 0.76, height * 0.54, minSide * 0.08);
        strokeCurrentPath();
        [0,1,2].forEach((index) => {
            const y = top + height * (0.34 + index * 0.10);
            ctx.beginPath();
            ctx.moveTo(left + width * 0.28, y);
            ctx.lineTo(left + width * 0.62, y);
            ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(left + width * 0.10, top + height * 0.47);
        ctx.lineTo(left + width * 0.20, top + height * 0.47);
        ctx.lineTo(left + width * 0.17, top + height * 0.44);
        ctx.moveTo(left + width * 0.20, top + height * 0.47);
        ctx.lineTo(left + width * 0.17, top + height * 0.50);
        ctx.moveTo(left + width * 0.88, top + height * 0.47);
        ctx.lineTo(left + width * 0.78, top + height * 0.47);
        ctx.lineTo(left + width * 0.81, top + height * 0.44);
        ctx.moveTo(left + width * 0.78, top + height * 0.47);
        ctx.lineTo(left + width * 0.81, top + height * 0.50);
        ctx.stroke();
        drawSystemDesignLabel(ctx, "broker", left + width * 0.20, top + height * 0.18, width * 0.60, minSide * 0.16, stroke);
        return;
    }

    if (element.type === "partition") {
        drawRoundedRectPath(ctx, left + width * 0.10, top + height * 0.20, width * 0.80, height * 0.56, minSide * 0.06);
        strokeCurrentPath();
        [1,2].forEach((index) => {
            const x = left + width * (0.10 + index * 0.2666);
            ctx.beginPath();
            ctx.moveTo(x, top + height * 0.20);
            ctx.lineTo(x, top + height * 0.76);
            ctx.stroke();
        });
        drawSystemDesignLabel(ctx, "p0", left + width * 0.10, top + height * 0.48, width * 0.27, minSide * 0.15, stroke);
        drawSystemDesignLabel(ctx, "p1", left + width * 0.37, top + height * 0.48, width * 0.27, minSide * 0.15, stroke);
        drawSystemDesignLabel(ctx, "p2", left + width * 0.63, top + height * 0.48, width * 0.27, minSide * 0.15, stroke);
        drawSystemDesignLabel(ctx, "partition", left + width * 0.18, top + height * 0.14, width * 0.64, minSide * 0.14, stroke);
        return;
    }
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

    if (animationState.active && animationState.type === "appear") {
        ctx.globalAlpha = animationState.progress >= 1 ? ctx.globalAlpha : 0;
    }

    if (animationState.active && animationState.type === "fadeIn") {
        ctx.globalAlpha = ctx.globalAlpha * easedProgress;
    }

    if (animationState.active && animationState.type === "flyInLeft") {
        ctx.translate((1 - easedProgress) * -80, 0);
        ctx.globalAlpha *= easedProgress;
    }
    if (animationState.active && animationState.type === "flyInRight") {
        ctx.translate((1 - easedProgress) * 80, 0);
        ctx.globalAlpha *= easedProgress;
    }
    if (animationState.active && animationState.type === "flyInTop") {
        ctx.translate(0, (1 - easedProgress) * -60);
        ctx.globalAlpha *= easedProgress;
    }
    if (animationState.active && animationState.type === "flyInBottom") {
        ctx.translate(0, (1 - easedProgress) * 60);
        ctx.globalAlpha *= easedProgress;
    }
    if (animationState.active && animationState.type === "floatIn") {
        ctx.translate(0, (1 - easedProgress) * 24);
        ctx.globalAlpha *= easedProgress;
    }

    if (animationState.active && animationState.type === "slideUp") {
        ctx.translate(0, (1 - easedProgress) * 18);
        ctx.globalAlpha = ctx.globalAlpha * easedProgress;
    }

    if (animationState.active && (animationState.type === "scaleIn" || animationState.type === "zoomIn")) {
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

    if (animationState.active && animationState.type === "elasticPop") {
        const box = getSelectionBox(element);
        if (box) {
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const spring = elasticOut(animationState.progress);
            const scale = Math.max(0.05, 0.45 + spring * 0.55);
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha *= clamp01(animationState.progress * 2.4);
        }
    }

    if (animationState.active && animationState.type === "arrivalPulse") {
        const box = getSelectionBox(element);
        if (box) {
            const cx = box.x + box.w / 2;
            const cy = box.y + box.h / 2;
            const bump = Math.sin(clamp01(animationState.progress) * Math.PI) * 0.075;
            ctx.translate(cx, cy);
            ctx.scale(1 + bump, 1 + bump);
            ctx.translate(-cx, -cy);
            ctx.shadowColor = stroke;
            ctx.shadowBlur = 8 + bump * 140;
        }
    }

    if (animationState.active && animationState.type === "arraySwap") {
        const box = getSelectionBox(element);
        if (box) {
            const p = clamp01(animationState.progress);
            const arc = Math.sin(p * Math.PI);
            const direction = stableAnimationDirection(element.id);
            const horizontal = direction * (Math.abs(box.w) + 12) * arc;
            const vertical = -Math.max(14, Math.min(34, Math.abs(box.h) * 0.35)) * arc;
            ctx.translate(horizontal, vertical);
        }
    }

    applyAnimationBeforeDraw(ctx, element, animationState);

    if (element.type === "webgl3d") {
        draw3DPrimitive(ctx, element, renderOptions);
    } else if (element.type === "rect" || element.type === "rectangle") {
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
    } else if (element.type === "user") {
        const left = Math.min(element.x, element.x + element.w);
        const top = Math.min(element.y, element.y + element.h);
        const width = Math.abs(element.w || 0);
        const height = Math.abs(element.h || 0);

        const cx = left + width / 2;
        const headRadius = Math.max(3, Math.min(width * 0.22, height * 0.18));
        const headCy = top + height * 0.27;
        const shoulderY = top + height * 0.58;
        const bodyBottomY = top + height * 0.9;
        const shoulderHalf = width * 0.38;
        const waistHalf = width * 0.24;

        ctx.beginPath();
        ctx.arc(cx, headCy, headRadius, 0, Math.PI * 2);
        if (element.fill && element.fill !== "transparent") ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - shoulderHalf, shoulderY);
        ctx.quadraticCurveTo(cx, top + height * 0.48, cx + shoulderHalf, shoulderY);
        ctx.lineTo(cx + waistHalf, bodyBottomY);
        ctx.lineTo(cx - waistHalf, bodyBottomY);
        ctx.closePath();
        if (element.fill && element.fill !== "transparent") ctx.fill();
        ctx.stroke();
    } else if (isSystemDesignType(element.type)) {
        drawSystemDesignShape(ctx, element);
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
            const brightness = Number(element.brightness ?? 100);
            const contrast = Number(element.contrast ?? 100);
            const saturation = Number(element.saturation ?? 100);
            const blur = Math.max(0, Number(element.blur) || 0);
            const filters = [
                `brightness(${brightness}%)`,
                `contrast(${contrast}%)`,
                `saturate(${saturation}%)`,
                `blur(${blur}px)`,
                element.grayscale ? "grayscale(100%)" : "grayscale(0%)",
                element.sepia ? "sepia(100%)" : "sepia(0%)",
            ].join(" ");
            const rotation = (Number(element.rotation) || 0) * Math.PI / 180;
            const flipX = element.flipX ? -1 : 1;
            const flipY = element.flipY ? -1 : 1;
            ctx.save();
            ctx.filter = filters;
            ctx.translate(x + w / 2, y + h / 2);
            ctx.rotate(rotation);
            ctx.scale(flipX, flipY);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
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
        const parentBounds = renderOptions?.parentBounds;
        if (parentBounds) {
            const padding = 8;
            ctx.save();
            ctx.beginPath();
            ctx.rect(
                parentBounds.x + padding,
                parentBounds.y + padding,
                Math.max(1, parentBounds.w - padding * 2),
                Math.max(1, parentBounds.h - padding * 2)
            );
            ctx.clip();
        }
        const style = normalizeTextStyle(element);

        ctx.setLineDash([]);
        ctx.font = buildTextCanvasFont(style);
        ctx.fillStyle = style.stroke;
        ctx.textBaseline = "top";
        ctx.textAlign = style.textAlign;

        const hasActiveTypewriterAnimation =
            animationState?.active && animationState?.type === "typewriter";

        if (
            Array.isArray(element.richText) &&
            element.richText.length > 0 &&
            !hasActiveTypewriterAnimation
        ) {
            drawRichTextElement(ctx, element, style);
        } else {
            const animatedText = animationState?.active && animationState?.type === "countUp"
                ? formatCountUpText(element.text, animationState.easedProgress ?? animationState.progress)
                : element.text;
            const lines = getAnimatedTextLines(
                animatedText,
                animationState,
                ctx,
                Math.max(1, (element.w || 120) - 8)
            );

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
        if (parentBounds) ctx.restore();
    }

    drawPremiumAnimationOverlay(ctx, element, animationState, stroke, strokeWidth);
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

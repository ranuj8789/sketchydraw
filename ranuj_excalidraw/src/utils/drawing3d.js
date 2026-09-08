import { draw3DPrimitive } from "../components/3d/threeDRenderer";

const SELECTION_COLOR = "#6965db";
const HANDLE_SIZE = 7;

export function is3DElement(element) {
    return element?.type === "webgl3d";
}

function normalizeBox(element) {
    const w = Number(element?.w) || 0;
    const h = Number(element?.h) || 0;
    return {
        x: w < 0 ? (Number(element?.x) || 0) + w : Number(element?.x) || 0,
        y: h < 0 ? (Number(element?.y) || 0) + h : Number(element?.y) || 0,
        w: Math.abs(w),
        h: Math.abs(h),
    };
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function easeOutCubic(t) {
    const value = clamp01(t);
    return 1 - Math.pow(1 - value, 3);
}

function animationState(element, renderOptions = {}) {
    const animation = element?.animation || {};
    const type = animation.type || "none";
    const activeIds = renderOptions.activeAnimatedElementIds;
    const filtered = activeIds && typeof activeIds.has === "function" && !activeIds.has(element.id);
    if (!renderOptions.animationMode || type === "none" || filtered) {
        return { active: false, type: "none", progress: 1, localTimeMs: 0, durationMs: 1000 };
    }
    const resolved = renderOptions?.resolvedAnimationTimings?.get?.(element.id);
    const durationMs = Math.max(1, Number(resolved?.durationMs ?? animation.durationMs) || 1000);
    const delayMs = Math.max(0, Number(resolved?.startMs ?? animation.delayMs) || 0);
    const rawTime = Math.max(0, Number(renderOptions.animationTimeMs) || 0);
    const loopPauseMs = Math.max(0, Number(renderOptions.loopPauseMs) || 0);
    const loop = !!animation.loop || !!renderOptions.loopAnimation;
    const cycleMs = Math.max(1, delayMs + durationMs + loopPauseMs);
    const time = loop ? rawTime % cycleMs : rawTime;
    const localTimeMs = Math.max(0, time - delayMs);
    return { active: true, type, progress: clamp01(localTimeMs / durationMs), localTimeMs, durationMs };
}

function applyAnimation(ctx, element, state) {
    if (!state.active) return;
    const p = easeOutCubic(state.progress);
    const box = normalizeBox(element);
    if (state.type === "appear") ctx.globalAlpha *= state.progress >= 1 ? 1 : 0;
    if (state.type === "fadeIn") ctx.globalAlpha *= p;
    if (state.type === "flyInLeft") { ctx.translate((1 - p) * -80, 0); ctx.globalAlpha *= p; }
    if (state.type === "flyInRight") { ctx.translate((1 - p) * 80, 0); ctx.globalAlpha *= p; }
    if (state.type === "flyInTop") { ctx.translate(0, (1 - p) * -60); ctx.globalAlpha *= p; }
    if (state.type === "flyInBottom") { ctx.translate(0, (1 - p) * 60); ctx.globalAlpha *= p; }
    if (state.type === "floatIn") { ctx.translate(0, (1 - p) * 24); ctx.globalAlpha *= p; }
    if (state.type === "slideUp") { ctx.translate(0, (1 - p) * 18); ctx.globalAlpha *= p; }
    if (state.type === "scaleIn" || state.type === "zoomIn") {
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        const scale = 0.75 + p * 0.25;
        ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
        ctx.globalAlpha *= p;
    }
}

function drawSelection(ctx, element) {
    const box = normalizeBox(element);
    const pad = 6;
    const visual = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.strokeRect(visual.x, visual.y, visual.w, visual.h);
    const points = [
        [visual.x, visual.y], [visual.x + visual.w / 2, visual.y], [visual.x + visual.w, visual.y],
        [visual.x, visual.y + visual.h / 2], [visual.x + visual.w, visual.y + visual.h / 2],
        [visual.x, visual.y + visual.h], [visual.x + visual.w / 2, visual.y + visual.h], [visual.x + visual.w, visual.y + visual.h],
    ];
    const half = HANDLE_SIZE / 2;
    ctx.fillStyle = "#ffffff";
    points.forEach(([x, y]) => {
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x - half, y - half, HANDLE_SIZE, HANDLE_SIZE, 1.5);
        else ctx.rect(x - half, y - half, HANDLE_SIZE, HANDLE_SIZE);
        ctx.fill(); ctx.stroke();
    });
    ctx.restore();
}

export function hitTest3D(element, x, y) {
    if (!is3DElement(element)) return false;
    const box = normalizeBox(element);
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function drawElement3D(ctx, element, selected = false, renderOptions = {}) {
    if (!is3DElement(element)) return;
    ctx.save();
    ctx.strokeStyle = element.stroke || "#111827";
    ctx.fillStyle = element.fill || element.fillColor || "transparent";
    ctx.lineWidth = element.strokeWidth || 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    applyAnimation(ctx, element, animationState(element, renderOptions));
    draw3DPrimitive(ctx, element, renderOptions);
    if (selected) drawSelection(ctx, element);
    ctx.restore();
}

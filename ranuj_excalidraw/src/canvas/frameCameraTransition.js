const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = (value) => Math.max(0, Math.min(1, finite(value, 0)));

export function normalizeFrameCamera(camera, fallback = { zoom: 1, offsetX: 0, offsetY: 0 }) {
    return {
        zoom: Math.max(0.05, finite(camera?.zoom, fallback.zoom || 1)),
        offsetX: finite(camera?.offsetX, fallback.offsetX || 0),
        offsetY: finite(camera?.offsetY, fallback.offsetY || 0),
    };
}

function easeCamera(progress, style = "smooth") {
    const t = clamp01(progress);
    if (style === "linear") return t;
    if (style === "fast") return 1 - Math.pow(1 - t, 4);
    if (style === "cinematic") return t < .5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2;
    if (style === "spring") return clamp01(1 - Math.cos(t * Math.PI * 4) * Math.exp(-t * 6));
    return t * t * (3 - 2 * t);
}

export function interpolateFrameCamera(fromCamera, toCamera, progress, easing = "smooth") {
    const from = normalizeFrameCamera(fromCamera);
    const to = normalizeFrameCamera(toCamera, from);
    const t = easeCamera(progress, easing);
    return {
        zoom: from.zoom + (to.zoom - from.zoom) * t,
        offsetX: from.offsetX + (to.offsetX - from.offsetX) * t,
        offsetY: from.offsetY + (to.offsetY - from.offsetY) * t,
    };
}

export function getFrameCameraAtTime(frame, previousFrame, timeMs = 0) {
    const target = normalizeFrameCamera(frame?.camera);
    const authoredKeys = (Array.isArray(frame?.cameraKeyframes) ? frame.cameraKeyframes : [])
        .filter(Boolean).slice().sort((a, b) => finite(a.timeMs, 0) - finite(b.timeMs, 0));
    if (authoredKeys.length) {
        const keys = previousFrame?.camera && finite(authoredKeys[0]?.timeMs, 0) > 0
            ? [{ ...previousFrame.camera, timeMs: 0 }, ...authoredKeys]
            : authoredKeys;
        const now = Math.max(0, finite(timeMs, 0));
        const rightIndex = keys.findIndex((key) => finite(key.timeMs, 0) >= now);
        if (rightIndex <= 0) return normalizeFrameCamera(keys[0], target);
        if (rightIndex < 0) return normalizeFrameCamera(keys[keys.length - 1], target);
        const left = keys[rightIndex - 1];
        const right = keys[rightIndex];
        const holdMs = Math.max(0, finite(left.holdMs, frame?.cameraHoldMs || 0));
        const movementStart = finite(left.timeMs, 0) + holdMs;
        if (now <= movementStart) return normalizeFrameCamera(left, target);
        return interpolateFrameCamera(left, right, (now - movementStart) / Math.max(1, finite(right.timeMs, 0) - movementStart), right.easing || frame?.cameraEasing);
    }
    const transition = frame?.transition || "none";
    if (!frame?.camera || !previousFrame?.camera || !["camera", "zoom"].includes(transition)) return target;
    const durationMs = Math.max(100, finite(frame?.cameraTransitionMs, 1200));
    const holdMs = Math.max(0, finite(frame?.cameraHoldMs, 0));
    if (finite(timeMs, 0) <= holdMs) return normalizeFrameCamera(previousFrame.camera);
    return interpolateFrameCamera(previousFrame.camera, target, (finite(timeMs, 0) - holdMs) / durationMs, frame?.cameraEasing);
}

export function getCameraTrackDurationMs(frame) {
    const keys = Array.isArray(frame?.cameraKeyframes) ? frame.cameraKeyframes : [];
    return keys.reduce((maximum, key) => Math.max(maximum, Math.max(0, finite(key?.timeMs, 0)) + Math.max(0, finite(key?.holdMs, 0))), 0);
}

export function smoothCameraKeyframes(keyframes = [], { minIntervalMs = 90, strength = 0.35 } = {}) {
    const ordered = keyframes.filter(Boolean).slice().sort((a, b) => finite(a.timeMs, 0) - finite(b.timeMs, 0));
    if (ordered.length < 3) return ordered.map((key) => ({ ...key }));
    const reduced = ordered.filter((key, index) => index === 0 || index === ordered.length - 1 || finite(key.timeMs) - finite(ordered[index - 1].timeMs) >= minIntervalMs);
    return reduced.map((key, index) => {
        if (index === 0 || index === reduced.length - 1 || key.holdMs) return { ...key };
        const before = reduced[index - 1];
        const after = reduced[index + 1];
        const blend = Math.max(0, Math.min(.8, finite(strength, .35)));
        return {
            ...key,
            zoom: finite(key.zoom, 1) * (1 - blend) + ((finite(before.zoom, 1) + finite(after.zoom, 1)) / 2) * blend,
            offsetX: finite(key.offsetX) * (1 - blend) + ((finite(before.offsetX) + finite(after.offsetX)) / 2) * blend,
            offsetY: finite(key.offsetY) * (1 - blend) + ((finite(before.offsetY) + finite(after.offsetY)) / 2) * blend,
            easing: key.easing || "cinematic",
        };
    });
}

export function createFocusCamera(bounds, canvasSize, padding = 96) {
    if (!bounds) return normalizeFrameCamera();
    const width = Math.max(1, finite(bounds.w, 1));
    const height = Math.max(1, finite(bounds.h, 1));
    const canvasWidth = Math.max(1, finite(canvasSize?.width, 1200));
    const canvasHeight = Math.max(1, finite(canvasSize?.height, 700));
    const zoom = Math.max(.1, Math.min(6, Math.min((canvasWidth - padding * 2) / width, (canvasHeight - padding * 2) / height)));
    return { zoom, offsetX: canvasWidth / 2 - (finite(bounds.x) + width / 2) * zoom, offsetY: canvasHeight / 2 - (finite(bounds.y) + height / 2) * zoom };
}

export function createCameraTemplate(template, { wideCamera, focusCamera, durationMs = 5000 } = {}) {
    const wide = normalizeFrameCamera(wideCamera);
    const focus = normalizeFrameCamera(focusCamera, wide);
    const duration = Math.max(800, finite(durationMs, 5000));
    if (template === "slow-pan") return [{ ...wide, timeMs: 0 }, { ...focus, timeMs: duration, easing: "cinematic" }];
    if (template === "quick-zoom") return [{ ...wide, timeMs: 0 }, { ...focus, timeMs: duration * .3, holdMs: duration * .35, easing: "fast" }];
    if (template === "zoom-out") return [{ ...focus, timeMs: 0 }, { ...wide, timeMs: duration, easing: "cinematic" }];
    if (template === "wide-detail-wide") return [{ ...wide, timeMs: 0 }, { ...focus, timeMs: duration * .3, holdMs: duration * .3, easing: "cinematic" }, { ...wide, timeMs: duration, easing: "cinematic" }];
    if (template === "reveal-left-right") return [{ ...wide, offsetX: wide.offsetX + 220, timeMs: 0 }, { ...wide, offsetX: wide.offsetX - 220, timeMs: duration, easing: "cinematic" }];
    if (template === "follow-packet") return [{ ...focus, timeMs: 0, easing: "smooth" }];
    return [{ ...wide, timeMs: 0 }, { ...focus, timeMs: duration, easing: "smooth" }];
}

export function applyCameraFollow(frame, camera, timeMs = 0, canvasSize = { width: 1200, height: 700 }) {
    const followId = frame?.cameraFollowElementId;
    const element = (frame?.elements || []).find((item) => item?.id === followId);
    if (!element) return camera;
    const keys = (element.transformKeyframes || []).slice().sort((a, b) => finite(a.timeMs) - finite(b.timeMs));
    let x = finite(element.x), y = finite(element.y);
    if (keys.length) {
        const right = keys.findIndex((key) => finite(key.timeMs) >= finite(timeMs));
        const a = right <= 0 ? keys[0] : keys[right - 1];
        const b = right < 0 ? keys[keys.length - 1] : keys[right];
        const t = a === b ? 0 : clamp01((finite(timeMs) - finite(a.timeMs)) / Math.max(1, finite(b.timeMs) - finite(a.timeMs)));
        x = finite(a.x, x) + (finite(b.x, x) - finite(a.x, x)) * t;
        y = finite(a.y, y) + (finite(b.y, y) - finite(a.y, y)) * t;
    }
    const desiredX = finite(canvasSize.width, 1200) / 2 - (x + finite(element.w, 0) / 2) * camera.zoom;
    const desiredY = finite(canvasSize.height, 700) / 2 - (y + finite(element.h, 0) / 2) * camera.zoom;
    const deadZone = Math.max(0, finite(frame?.cameraFollowDeadZone, 48));
    const dx = desiredX - camera.offsetX;
    const dy = desiredY - camera.offsetY;
    return {
        ...camera,
        offsetX: Math.abs(dx) <= deadZone ? camera.offsetX : desiredX - Math.sign(dx) * deadZone,
        offsetY: Math.abs(dy) <= deadZone ? camera.offsetY : desiredY - Math.sign(dy) * deadZone,
    };
}

export function mapFrameCameraToOutput(camera, sourceSize, outputSize) {
    const sourceWidth = Math.max(1, finite(sourceSize?.width, 1200));
    const sourceHeight = Math.max(1, finite(sourceSize?.height, 700));
    const outputWidth = Math.max(1, finite(outputSize?.width, sourceWidth));
    const outputHeight = Math.max(1, finite(outputSize?.height, sourceHeight));
    const scale = Math.min(outputWidth / sourceWidth, outputHeight / sourceHeight);
    const letterboxX = (outputWidth - sourceWidth * scale) / 2;
    const letterboxY = (outputHeight - sourceHeight * scale) / 2;
    const normalized = normalizeFrameCamera(camera);
    return {
        zoom: normalized.zoom * scale,
        offsetX: letterboxX + normalized.offsetX * scale,
        offsetY: letterboxY + normalized.offsetY * scale,
    };
}

export function resolveFrameCameraViewport({ frame, previousFrame, timeMs, sourceSize, outputSize, fallbackViewport }) {
    if (!frame?.camera) return fallbackViewport;
    return mapFrameCameraToOutput(applyCameraFollow(frame, getFrameCameraAtTime(frame, previousFrame, timeMs), timeMs, sourceSize), sourceSize, outputSize);
}

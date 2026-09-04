import { getElementBounds } from "../utils/elementBounds";

export const DEFAULT_ANIMATION_EXPORT_RESOLUTION = "1920x1080";
export const DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT = 150;

export const ANIMATION_EXPORT_RESOLUTION_OPTIONS = [
    { value: "original", label: "Original frame size" },
    { value: "1280x720", label: "HD · 1280×720" },
    { value: "1920x1080", label: "Full HD · 1920×1080" },
    { value: "2560x1440", label: "2K · 2560×1440" },
];

export const ANIMATION_EXPORT_ZOOM_OPTIONS = [100, 125, 150, 175, 200];

function evenDimension(value, fallback) {
    const safe = Math.max(2, Math.round(Number(value) || fallback));
    return safe - safe % 2;
}

export function normalizeAnimationExportResolution(value) {
    return ANIMATION_EXPORT_RESOLUTION_OPTIONS.some((option) => option.value === value)
        ? value
        : DEFAULT_ANIMATION_EXPORT_RESOLUTION;
}

export function normalizeAnimationExportZoomPercent(value) {
    const parsed = Number(value);
    return ANIMATION_EXPORT_ZOOM_OPTIONS.includes(parsed)
        ? parsed
        : DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT;
}

export function resolveAnimationExportSize(resolution, sourceSize = {}) {
    const sourceWidth = evenDimension(Math.max(320, Number(sourceSize.width) || 1200), 1200);
    const sourceHeight = evenDimension(Math.max(240, Number(sourceSize.height) || 700), 700);
    const normalized = normalizeAnimationExportResolution(resolution);

    if (normalized === "original") {
        return { width: sourceWidth, height: sourceHeight };
    }

    const [width, height] = normalized.split("x").map(Number);
    return {
        width: evenDimension(width, sourceWidth),
        height: evenDimension(height, sourceHeight),
    };
}

export function getAnimationFramesContentBounds(frames = []) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    (frames || []).forEach((frame) => {
        const hidden = new Set(frame?.hiddenElementIds || []);
        (frame?.elements || []).forEach((element) => {
            if (!element || hidden.has(element.id)) return;
            const bounds = getElementBounds(element);
            if (!bounds) return;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.w);
            maxY = Math.max(maxY, bounds.y + bounds.h);
        });
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

export function getAnimationExportTransform({
    frames = [],
    sourceSize = {},
    outputSize = {},
    zoomPercent = DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT,
    padding = 56,
} = {}) {
    const sourceWidth = Math.max(1, Number(sourceSize.width) || 1200);
    const sourceHeight = Math.max(1, Number(sourceSize.height) || 700);
    const outputWidth = Math.max(2, Number(outputSize.width) || sourceWidth);
    const outputHeight = Math.max(2, Number(outputSize.height) || sourceHeight);
    const safePadding = Math.max(16, Math.min(padding, outputWidth / 8, outputHeight / 8));
    const availableWidth = Math.max(1, outputWidth - safePadding * 2);
    const availableHeight = Math.max(1, outputHeight - safePadding * 2);
    const bounds = getAnimationFramesContentBounds(frames);

    const frameFitScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
    const contentFitScale = bounds
        ? Math.min(availableWidth / bounds.w, availableHeight / bounds.h)
        : frameFitScale;
    const requestedZoom = normalizeAnimationExportZoomPercent(zoomPercent) / 100;
    const scale = Math.max(0.01, Math.min(frameFitScale * requestedZoom, contentFitScale));
    const centerX = bounds ? bounds.x + bounds.w / 2 : sourceWidth / 2;
    const centerY = bounds ? bounds.y + bounds.h / 2 : sourceHeight / 2;

    return {
        scale,
        offsetX: outputWidth / 2 - centerX * scale,
        offsetY: outputHeight / 2 - centerY * scale,
        appliedZoomPercent: Math.round(scale / frameFitScale * 100),
    };
}

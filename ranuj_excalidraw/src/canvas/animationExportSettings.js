import { getElementBounds } from "../utils/elementBounds";

export const DEFAULT_ANIMATION_EXPORT_RESOLUTION = "1920x1080";
export const DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT = 150;
export const DEFAULT_ANIMATION_EXPORT_FIT_CONTENT = true;
export const DEFAULT_ANIMATION_EXPORT_TEXT_SCALE_PERCENT = 125;
export const ANIMATION_EXPORT_TEXT_SCALE_OPTIONS = [100, 110, 125, 135, 150];

export const ANIMATION_EXPORT_RESOLUTION_OPTIONS = [
    { value: "original", label: "Original frame size" },
    { value: "1280x720", label: "HD · 1280×720" },
    { value: "1920x1080", label: "Full HD · 1920×1080" },
    { value: "2560x1440", label: "2K · 2560×1440" },
];

// Camera zoom changes framing only. The selected output resolution remains
// unchanged, so a small drawing can fill an HD/Full-HD export without being
// re-encoded at a smaller resolution.
export const ANIMATION_EXPORT_ZOOM_OPTIONS = [25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500, 600];

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
    if (!Number.isFinite(parsed)) return DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT;
    return Math.max(25, Math.min(600, Math.round(parsed)));
}

export function normalizeAnimationExportTextScalePercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_ANIMATION_EXPORT_TEXT_SCALE_PERCENT;
    return Math.max(100, Math.min(150, Math.round(parsed)));
}

export function applyAnimationExportTextScale(elements = [], value) {
    const percent = normalizeAnimationExportTextScalePercent(value);
    if (percent === 100) return elements;
    const scale = percent / 100;

    return (elements || []).map((element) => {
        if (element?.type !== "text") return element;
        return {
            ...element,
            fontSize: Math.max(1, (Number(element.fontSize) || 20) * scale),
            lineHeight: Math.max(1, (Number(element.lineHeight) || 26) * scale),
            richText: Array.isArray(element.richText)
                ? element.richText.map((range) => ({
                    ...range,
                    ...(Number(range?.fontSize) > 0
                        ? { fontSize: Number(range.fontSize) * scale }
                        : {}),
                }))
                : element.richText,
        };
    });
}

export function normalizeAnimationExportPan(value = {}) {
    const x = Number(value?.x);
    const y = Number(value?.y);
    return {
        x: Math.max(-2, Math.min(2, Number.isFinite(x) ? x : 0)),
        y: Math.max(-2, Math.min(2, Number.isFinite(y) ? y : 0)),
    };
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
                                                pan = { x: 0, y: 0 },
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
    const requestedZoom = normalizeAnimationExportZoomPercent(zoomPercent) / 100;
    // Do not cap the requested camera zoom at content-fit. That cap made the
    // control appear broken for small drawings because larger values could not
    // actually magnify the export. Clipping at higher zoom is intentional and
    // is shown accurately in the preview.
    const scale = Math.max(0.01, frameFitScale * requestedZoom);
    const centerX = bounds ? bounds.x + bounds.w / 2 : sourceWidth / 2;
    const centerY = bounds ? bounds.y + bounds.h / 2 : sourceHeight / 2;
    const safePan = normalizeAnimationExportPan(pan);

    return {
        scale,
        offsetX: outputWidth / 2 - centerX * scale + safePan.x * outputWidth,
        offsetY: outputHeight / 2 - centerY * scale + safePan.y * outputHeight,
        appliedZoomPercent: Math.round(scale / frameFitScale * 100),
    };
}

export function getAnimationExportFitZoomPercent({
                                                     frames = [],
                                                     sourceSize = {},
                                                     outputSize = {},
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
    if (!bounds) return 100;

    const frameFitScale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
    const contentFitScale = Math.min(availableWidth / bounds.w, availableHeight / bounds.h);
    return normalizeAnimationExportZoomPercent((contentFitScale / frameFitScale) * 100);
}

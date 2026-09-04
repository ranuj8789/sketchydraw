import { renderCanvas } from "../canvas/canvasRender";
import { drawExportBranding } from "./exportBoard";
import {
    DEFAULT_TIMELINE_PLAYBACK_SPEED,
    getFramePlaybackDurationMs,
    getTimelinePlaybackDurationMs,
    getTimelineSourceTimeMs,
    normalizeTimelinePlaybackSpeed,
    resolveFrameAnimationTimings,
} from "../canvas/animationTimeline";
import {
    DEFAULT_ANIMATION_EXPORT_RESOLUTION,
    DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT,
    getAnimationExportTransform,
    normalizeAnimationExportZoomPercent,
    resolveAnimationExportSize,
} from "../canvas/animationExportSettings";

const GIF_JS_URLS = [
    "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js",
    "https://unpkg.com/gif.js@0.2.0/dist/gif.js",
];
const GIF_WORKER_URLS = [
    "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js",
    "https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js",
];
const DEFAULT_FPS = 12;

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);

        if (existing) {
            if (window.GIF) {
                resolve();
                return;
            }

            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Unable to load ${src}`));
        document.head.appendChild(script);
    });
}

async function loadFirstAvailableScript() {
    let lastError = null;

    for (const src of GIF_JS_URLS) {
        try {
            await loadScript(src);
            if (window.GIF) return window.GIF;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("GIF encoder could not be loaded.");
}

async function createWorkerScriptUrl() {
    let lastError = null;

    for (const workerUrl of GIF_WORKER_URLS) {
        try {
            const response = await fetch(workerUrl, { mode: "cors", cache: "force-cache" });
            if (!response.ok) {
                throw new Error(`GIF worker returned ${response.status}`);
            }

            const workerSource = await response.text();
            return URL.createObjectURL(
                new Blob([workerSource], { type: "text/javascript" })
            );
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("GIF worker could not be loaded.");
}

async function ensureGifEncoder() {
    const GIF = window.GIF || await loadFirstAvailableScript();

    if (!GIF) {
        throw new Error("GIF encoder was not available after loading gif.js.");
    }

    const workerScript = await createWorkerScriptUrl();
    return { GIF, workerScript };
}

function cloneElements(elements) {
    if (typeof structuredClone === "function") {
        return structuredClone(elements || []);
    }

    return JSON.parse(JSON.stringify(elements || []));
}

function getFrameAnimationDurationMs(frame) {
    return getFramePlaybackDurationMs(frame);
}

function getAnimatedElementIds(elements = []) {
    return new Set(
        (elements || [])
            .filter((el) => el?.animation?.type && el.animation.type !== "none")
            .map((el) => el.id)
    );
}

function getExportSizing(frames, canvasSize = {}, resolution, zoomPercent) {
    const outputSize = resolveAnimationExportSize(resolution, canvasSize);
    const transform = getAnimationExportTransform({
        frames,
        sourceSize: canvasSize,
        outputSize,
        zoomPercent,
    });

    return {
        canvasSize: outputSize,
        viewport: {
            zoom: transform.scale,
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
        },
    };
}

function renderGifFrame({
                            canvas,
                            frame,
                            canvasSize,
                            viewport,
                            canvasProps,
                            animationTimeMs,
                        }) {
    const elements = cloneElements(frame?.elements || []);

    const resolvedAnimationTimings = resolveFrameAnimationTimings(elements);

    renderCanvas({
        canvas,
        canvasSize,
        elements,
        selectedIds: [],
        connectionHint: null,
        alignmentGuides: [],
        viewport,
        showGrid: false,
        canvasProps,
        renderOptions: {
            animationMode: true,
            animationTimeMs,
            activeAnimatedElementIds: getAnimatedElementIds(elements),
            hiddenElementIds: new Set(frame?.hiddenElementIds || []),
            resolvedAnimationTimings,
            loopAnimation: false,
            pixelRatio: 1,
        },
    });

    const ctx = canvas.getContext("2d");
    drawExportBranding(ctx, canvas);
}

function downloadBlob(blob, fileName) {
    if (!blob?.size) throw new Error("The exported GIF file was empty.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "sketchydraw.gif";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);

    // Revoking synchronously can cancel the download, especially in Safari or
    // when the GIF is large. Click after insertion and clean up later.
    window.requestAnimationFrame(() => {
        link.click();
        setTimeout(() => {
            link.remove();
            URL.revokeObjectURL(url);
        }, 60_000);
    });
}

export async function exportTimelineGif({
                                            frames = [],
                                            canvasSize,
                                            canvasProps,
                                            fileName = "sketchydraw.gif",
                                            fps = DEFAULT_FPS,
                                            exportScale = 1.1,
                                            resolution = DEFAULT_ANIMATION_EXPORT_RESOLUTION,
                                            zoomPercent,
                                            playbackSpeed = DEFAULT_TIMELINE_PLAYBACK_SPEED,
                                            onProgress,
                                        } = {}) {
    const safeFrames = frames.length ? frames : [{ elements: [] }];
    const safeFps = Math.max(8, Math.min(15, Number(fps) || DEFAULT_FPS));
    const frameDelayMs = Math.round(1000 / safeFps);
    const safePlaybackSpeed = normalizeTimelinePlaybackSpeed(playbackSpeed);
    const safeZoomPercent = normalizeAnimationExportZoomPercent(
        zoomPercent ?? Math.round((Number(exportScale) || DEFAULT_ANIMATION_EXPORT_ZOOM_PERCENT / 100) * 100)
    );
    const { GIF, workerScript } = await ensureGifEncoder();
    const sizing = getExportSizing(safeFrames, canvasSize, resolution, safeZoomPercent);
    const canvas = document.createElement("canvas");

    // First paint sets the actual pixel size used by renderCanvas.
    renderGifFrame({
        canvas,
        frame: safeFrames[0],
        canvasSize: sizing.canvasSize,
        viewport: sizing.viewport,
        canvasProps,
        animationTimeMs: 0,
    });

    const gif = new GIF({
        workers: 2,
        quality: 5,
        repeat: 0,
        width: canvas.width,
        height: canvas.height,
        workerScript,
    });

    safeFrames.forEach((frame) => {
        const sourceDurationMs = getFrameAnimationDurationMs(frame);
        const durationMs = getTimelinePlaybackDurationMs(sourceDurationMs, safePlaybackSpeed);
        const hasAnimatedObjects = (frame?.elements || []).some(
            (element) => element?.animation?.type && element.animation.type !== "none"
        );

        if (!hasAnimatedObjects) {
            renderGifFrame({
                canvas,
                frame,
                canvasSize: sizing.canvasSize,
                viewport: sizing.viewport,
                canvasProps,
                animationTimeMs: sourceDurationMs,
            });
            gif.addFrame(canvas, { copy: true, delay: durationMs });
            return;
        }

        // Sample the authored timeline deterministically. Every GIF frame gets
        // the exact amount of time until the next sample, including the final
        // remainder. This prevents the animation from becoming faster than the
        // configured delay/duration values.
        for (let timeMs = 0; timeMs < durationMs; timeMs += frameDelayMs) {
            const remainingMs = durationMs - timeMs;
            const renderTimeMs = remainingMs <= frameDelayMs
                ? sourceDurationMs
                : getTimelineSourceTimeMs(timeMs, safePlaybackSpeed);
            renderGifFrame({
                canvas,
                frame,
                canvasSize: sizing.canvasSize,
                viewport: sizing.viewport,
                canvasProps,
                animationTimeMs: renderTimeMs,
            });
            gif.addFrame(canvas, {
                copy: true,
                delay: Math.min(frameDelayMs, remainingMs),
            });
        }
    });

    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            if (workerScript?.startsWith("blob:")) {
                URL.revokeObjectURL(workerScript);
            }
        };
        const fail = (error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error || "GIF export failed.")));
        };

        gif.on("progress", (progress) => {
            onProgress?.(progress);
        });

        gif.on("finished", (blob) => {
            if (settled) return;
            settled = true;
            cleanup();
            downloadBlob(blob, fileName);
            resolve(blob);
        });

        gif.on("abort", () => fail(new Error("GIF export was aborted.")));

        try {
            gif.render();
        } catch (error) {
            fail(error);
        }
    });
}

import { renderCanvas } from "../canvas/canvasRender";
import { drawExportBranding } from "./exportBoard";

const GIF_JS_URLS = [
    "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js",
    "https://unpkg.com/gif.js@0.2.0/dist/gif.js",
];
const GIF_WORKER_URLS = [
    "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js",
    "https://unpkg.com/gif.js@0.2.0/dist/gif.worker.js",
];
const DEFAULT_FPS = 12;
const MAX_EXPORT_WIDTH = 900;
const MAX_EXPORT_HEIGHT = 700;

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
    const animatedElements = (frame?.elements || []).filter(
        (element) => element?.animation?.type && element.animation.type !== "none"
    );

    if (!animatedElements.length) {
        return Math.max(800, Number(frame?.durationMs) || 1100);
    }

    return Math.max(
        Math.max(900, Number(frame?.durationMs) || 0),
        ...animatedElements.map((element) => {
            const animation = element.animation || {};
            const delayMs = Math.max(0, Number(animation.delayMs) || 0);
            const durationMs = Math.max(1, Number(animation.durationMs) || 1000);
            return delayMs + durationMs;
        })
    );
}

function getAnimatedElementIds(elements = []) {
    return new Set(
        (elements || [])
            .filter((el) => el?.animation?.type && el.animation.type !== "none")
            .map((el) => el.id)
    );
}

function getExportSizing(canvasSize = {}, viewport = {}) {
    const sourceWidth = Math.max(1, Number(canvasSize.width) || 1200);
    const sourceHeight = Math.max(1, Number(canvasSize.height) || 700);
    const scale = Math.min(
        1,
        MAX_EXPORT_WIDTH / sourceWidth,
        MAX_EXPORT_HEIGHT / sourceHeight
    );

    return {
        canvasSize: {
            width: Math.max(1, Math.round(sourceWidth * scale)),
            height: Math.max(1, Math.round(sourceHeight * scale)),
        },
        viewport: {
            zoom: (Number(viewport.zoom) || 1) * scale,
            offsetX: (Number(viewport.offsetX) || 0) * scale,
            offsetY: (Number(viewport.offsetY) || 0) * scale,
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
            loopAnimation: false,
        },
    });

    const ctx = canvas.getContext("2d");
    drawExportBranding(ctx, canvas);
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "sketchydraw.gif";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export async function exportTimelineGif({
                                            frames = [],
                                            canvasSize,
                                            viewport,
                                            canvasProps,
                                            fileName = "sketchydraw.gif",
                                            fps = DEFAULT_FPS,
                                            onProgress,
                                        } = {}) {
    const safeFrames = frames.length ? frames : [{ elements: [] }];
    const safeFps = Math.max(4, Math.min(30, Number(fps) || DEFAULT_FPS));
    const frameDelayMs = Math.round(1000 / safeFps);
    const { GIF, workerScript } = await ensureGifEncoder();
    const sizing = getExportSizing(canvasSize, viewport);
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
        quality: 10,
        repeat: 0,
        width: canvas.width,
        height: canvas.height,
        workerScript,
    });

    safeFrames.forEach((frame) => {
        const durationMs = getFrameAnimationDurationMs(frame);
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
                animationTimeMs: durationMs,
            });
            gif.addFrame(canvas, { copy: true, delay: durationMs });
            return;
        }

        for (let timeMs = 0; timeMs <= durationMs; timeMs += frameDelayMs) {
            renderGifFrame({
                canvas,
                frame,
                canvasSize: sizing.canvasSize,
                viewport: sizing.viewport,
                canvasProps,
                animationTimeMs: timeMs,
            });
            gif.addFrame(canvas, { copy: true, delay: frameDelayMs });
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

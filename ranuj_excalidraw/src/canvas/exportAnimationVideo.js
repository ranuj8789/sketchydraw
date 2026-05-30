import { drawElement } from "../utils/drawing";
import { getElementBounds } from "../utils/elementBounds";
import { resetVideoFramesNow, saveVideoFrameNow } from "../utils/indexedDbStorage";

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickSupportedMimeType() {
    if (typeof MediaRecorder === "undefined") {
        return "";
    }

    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4;codecs=h264",
        "video/mp4",
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getFileExtension(mimeType) {
    return mimeType.includes("mp4") ? "mp4" : "webm";
}

function cloneElements(elements = []) {
    return JSON.parse(JSON.stringify(elements || []));
}

function getFrames(historyStates = [], currentElements = []) {
    const usableHistory = (historyStates || [])
        .filter((state) => Array.isArray(state))
        .map(cloneElements)
        .filter((state, index, arr) => {
            if (index === 0) return true;
            return JSON.stringify(state) !== JSON.stringify(arr[index - 1]);
        });

    const currentFrame = cloneElements(currentElements || []);
    const frames = usableHistory.length > 0 ? usableHistory : [currentFrame];

    // Make sure the latest canvas state is always included.
    const lastFrame = frames[frames.length - 1] || [];
    if (JSON.stringify(lastFrame) !== JSON.stringify(currentFrame)) {
        frames.push(currentFrame);
    }

    const MAX_VIDEO_STEPS = 150;
    return frames.slice(Math.max(0, frames.length - MAX_VIDEO_STEPS));
}

function getFramesContentBounds(frames = []) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    frames.forEach((elements) => {
        (elements || []).forEach((element) => {
            const bounds = getElementBounds(element);
            if (!bounds) return;

            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.w);
            maxY = Math.max(maxY, bounds.y + bounds.h);
        });
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
    }

    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

function getVideoTransform(bounds, canvasSize) {
    if (!bounds) {
        return {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
        };
    }

    const padding = 56;
    const availableWidth = Math.max(1, canvasSize.width - padding * 2);
    const availableHeight = Math.max(1, canvasSize.height - padding * 2);
    const scale = Math.min(
        1,
        availableWidth / bounds.w,
        availableHeight / bounds.h
    );

    return {
        scale,
        offsetX: (canvasSize.width - bounds.w * scale) / 2 - bounds.x * scale,
        offsetY: (canvasSize.height - bounds.h * scale) / 2 - bounds.y * scale,
    };
}

function getElementSignature(element) {
    if (!element) return "";

    return JSON.stringify({
        type: element.type,
        text: element.text,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        stroke: element.stroke,
        fontSize: element.fontSize,
        lineHeight: element.lineHeight,
        fontFamily: element.fontFamily,
        bold: element.bold,
        italic: element.italic,
        underline: element.underline,
        textAlign: element.textAlign,
        animation: element.animation,
    });
}

function getAnimatedTextIds(previousElements = [], currentElements = []) {
    const previousById = new Map(
        (previousElements || []).map((element) => [element.id, element])
    );

    const ids = new Set();

    (currentElements || []).forEach((element) => {
        if (element?.type !== "text") return;
        if (!element.animation || element.animation.type === "none") return;

        const previous = previousById.get(element.id);

        if (!previous || getElementSignature(previous) !== getElementSignature(element)) {
            ids.add(element.id);
        }
    });

    return ids;
}

function getMaxAnimationDuration(elements = [], activeAnimatedElementIds = new Set()) {
    let maxDuration = 0;

    (elements || []).forEach((element) => {
        if (!activeAnimatedElementIds.has(element.id)) return;

        const animation = element.animation || {};
        const durationMs = Math.max(1, Number(animation.durationMs) || 1000);
        const delayMs = Math.max(0, Number(animation.delayMs) || 0);
        maxDuration = Math.max(maxDuration, durationMs + delayMs);
    });

    return maxDuration;
}

function drawFrame(
    canvas,
    elements,
    canvasSize,
    transform,
    canvasProps = {},
    renderOptions = {}
) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    canvas.width = Math.max(1, Math.round(canvasSize.width));
    canvas.height = Math.max(1, Math.round(canvasSize.height));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = canvasProps.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    (elements || []).forEach((element) => {
        drawElement(ctx, element, false, renderOptions);
    });

    ctx.restore();
}

function collectImageSources(frames = []) {
    const sources = new Set();

    frames.forEach((elements) => {
        (elements || []).forEach((element) => {
            if (element?.type === "image" && element.src) {
                sources.add(element.src);
            }
        });
    });

    return Array.from(sources);
}

async function preloadImages(frames = []) {
    const sources = collectImageSources(frames);

    await Promise.all(
        sources.map(
            (src) =>
                new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = resolve;
                    img.onerror = resolve;
                    img.src = src;
                })
        )
    );
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 3000);
}

function makeRecorder(stream, mimeType) {
    try {
        return new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 4_000_000,
        });
    } catch {
        return new MediaRecorder(stream);
    }
}

function requestCanvasFrame(videoTrack) {
    if (videoTrack && typeof videoTrack.requestFrame === "function") {
        videoTrack.requestFrame();
    }
}

export async function exportUndoRedoAnimationVideo({
                                                       historyStates = [],
                                                       currentElements = [],
                                                       canvasSize = { width: 1200, height: 700 },
                                                       canvasProps = {},
                                                       fileName,
                                                       frameDelayMs = 500,
                                                       gapSeconds,
                                                       onProgress,
                                                   }) {
    if (typeof MediaRecorder === "undefined") {
        alert("Video export is not supported in this browser. Please use latest Chrome or Edge.");
        return;
    }

    const mimeType = pickSupportedMimeType();

    if (!mimeType) {
        alert("Your browser does not support browser video recording. Please try latest Chrome or Edge.");
        return;
    }

    const frames = getFrames(historyStates, currentElements);

    if (!frames.length || !frames.some((frame) => frame.length > 0)) {
        alert("Nothing to export yet. Draw something first, then export video.");
        return;
    }

    const finalFrameDelayMs = Number.isFinite(Number(gapSeconds))
        ? Math.max(100, Math.min(5000, Number(gapSeconds) * 1000))
        : frameDelayMs;

    const safeCanvasSize = {
        width: Math.max(320, Math.round(canvasSize?.width || 1200)),
        height: Math.max(240, Math.round(canvasSize?.height || 700)),
    };

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = safeCanvasSize.width;
    exportCanvas.height = safeCanvasSize.height;

    await preloadImages(frames);

    const contentBounds = getFramesContentBounds(frames);
    const transform = getVideoTransform(contentBounds, safeCanvasSize);

    await resetVideoFramesNow();

    drawFrame(exportCanvas, frames[0] || [], safeCanvasSize, transform, canvasProps);

    // requestFrame is not reliable everywhere. Use 30 fps stream as fallback so chunks are produced.
    const initialStream = exportCanvas.captureStream(30);
    const videoTrack = initialStream.getVideoTracks()[0];
    const recorder = makeRecorder(initialStream, mimeType);
    const chunks = [];

    recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
        }
    };

    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.error || event);
    });

    const started = new Promise((resolve) => {
        recorder.onstart = resolve;
    });

    recorder.start(250);
    await started;

    for (let i = 0; i < frames.length; i++) {
        const elements = frames[i];
        const previousElements = i > 0 ? frames[i - 1] : [];
        const activeAnimatedElementIds = getAnimatedTextIds(previousElements, elements);
        const maxAnimationDuration = getMaxAnimationDuration(elements, activeAnimatedElementIds);

        const renderAndSaveFrame = async (animationTimeMs = 0, saveFrame = false) => {
            drawFrame(exportCanvas, elements, safeCanvasSize, transform, canvasProps, {
                animationMode: activeAnimatedElementIds.size > 0,
                activeAnimatedElementIds,
                animationTimeMs,
            });

            requestCanvasFrame(videoTrack);

            if (saveFrame) {
                let imageDataUrl = null;
                try {
                    imageDataUrl = exportCanvas.toDataURL("image/webp", 0.86);
                } catch {
                    imageDataUrl = null;
                }

                await saveVideoFrameNow({
                    index: i,
                    elements,
                    imageDataUrl,
                });
            }
        };

        if (activeAnimatedElementIds.size > 0 && maxAnimationDuration > 0) {
            const animationFrameStepMs = 80;
            const subFrameCount = Math.max(
                4,
                Math.min(45, Math.ceil(maxAnimationDuration / animationFrameStepMs))
            );

            for (let subFrame = 0; subFrame <= subFrameCount; subFrame++) {
                const animationTimeMs = Math.round(
                    (maxAnimationDuration * subFrame) / subFrameCount
                );

                await renderAndSaveFrame(animationTimeMs, subFrame === subFrameCount);
                await wait(animationFrameStepMs);
            }
        } else {
            await renderAndSaveFrame(0, true);
            await wait(80);
        }

        const progress = Math.round(((i + 1) / frames.length) * 100);
        onProgress?.(progress);

        await wait(finalFrameDelayMs);
    }

    // Hold final frame, request data, then stop.
    requestCanvasFrame(videoTrack);
    await wait(Math.max(600, finalFrameDelayMs));

    if (recorder.state === "recording") {
        recorder.requestData?.();
        await wait(150);
        recorder.stop();
    }

    await stopped;
    initialStream.getTracks().forEach((track) => track.stop());

    if (chunks.length === 0) {
        alert("Video was not created. No video frames were recorded. Please try latest Chrome/Edge and avoid external images without CORS.");
        return;
    }

    const blob = new Blob(chunks, { type: mimeType });

    if (blob.size === 0) {
        alert("Video file is empty. Please try again after drawing one more step.");
        return;
    }

    const extension = getFileExtension(mimeType);
    const finalFileName = fileName || `sketchy-animation.${extension}`;
    const safeFileName = finalFileName.replace(/\.(webm|mp4)$/i, `.${extension}`);

    downloadBlob(blob, safeFileName);
}

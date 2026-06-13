import { drawElement } from "../utils/drawing";
import { getElementBounds } from "../utils/elementBounds";
import { resetVideoFramesAsync, saveVideoFrameAsync } from "../utils/indexedDbStorage";

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

function clone(value) {
    return JSON.parse(JSON.stringify(value || []));
}

function normalizeTimelineFrames({ timelineFrames = [], historyStates = [], currentElements = [] }) {
    const fromTimeline = (timelineFrames || [])
        .filter((frame) => frame && Array.isArray(frame.elements))
        .map((frame, index) => ({
            id: frame.id || `frame-${index}`,
            name: frame.name || `Frame ${index + 1}`,
            elements: clone(frame.elements),
            hiddenElementIds: Array.isArray(frame.hiddenElementIds)
                ? [...frame.hiddenElementIds]
                : [],
        }));

    if (fromTimeline.length) {
        return fromTimeline;
    }

    const legacyFrames = (historyStates || [])
        .filter((state) => Array.isArray(state))
        .map((state, index) => ({
            id: `history-${index}`,
            name: `Frame ${index + 1}`,
            elements: clone(state),
            hiddenElementIds: [],
        }));

    if (legacyFrames.length) {
        return legacyFrames;
    }

    return [
        {
            id: "current-frame",
            name: "Frame 1",
            elements: clone(currentElements),
            hiddenElementIds: [],
        },
    ];
}

function getFramesContentBounds(frames = []) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    frames.forEach((frame) => {
        const hiddenSet = new Set(frame.hiddenElementIds || []);

        (frame.elements || []).forEach((element) => {
            if (hiddenSet.has(element.id)) return;

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

function getAnimatedElementIds(elements = []) {
    return new Set(
        (elements || [])
            .filter((el) => el?.animation?.type && el.animation.type !== "none")
            .map((el) => el.id)
    );
}

function getFrameAnimationDurationMs(frame, fallbackMs) {
    const maxAnimationMs = (frame?.elements || []).reduce((max, element) => {
        const animation = element?.animation || {};

        if (!animation.type || animation.type === "none") {
            return max;
        }

        const durationMs = Math.max(1, Number(animation.durationMs) || 1000);
        const delayMs = Math.max(0, Number(animation.delayMs) || 0);
        return Math.max(max, durationMs + delayMs);
    }, 0);

    return Math.max(fallbackMs, maxAnimationMs || fallbackMs);
}

function drawFrame(canvas, frame, canvasSize, transform, canvasProps = {}, animationTimeMs = 0) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    canvas.width = Math.max(1, Math.round(canvasSize.width));
    canvas.height = Math.max(1, Math.round(canvasSize.height));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = canvasProps.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const hiddenSet = new Set(frame?.hiddenElementIds || []);
    const visibleElements = (frame?.elements || []).filter(
        (element) => !hiddenSet.has(element.id)
    );

    const renderOptions = {
        animationMode: true,
        animationTimeMs,
        activeAnimatedElementIds: getAnimatedElementIds(visibleElements),
        hiddenElementIds: hiddenSet,
    };

    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    visibleElements.forEach((element) => {
        drawElement(ctx, element, false, renderOptions);
    });

    ctx.restore();
}

function collectImageSources(frames = []) {
    const sources = new Set();

    frames.forEach((frame) => {
        (frame.elements || []).forEach((element) => {
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
                                                       timelineFrames = [],
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

    const frames = normalizeTimelineFrames({
        timelineFrames,
        historyStates,
        currentElements,
    }).filter((frame) => frame.elements.length > 0);

    if (!frames.length) {
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

    await resetVideoFramesAsync();

    drawFrame(exportCanvas, frames[0], safeCanvasSize, transform, canvasProps, 0);

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

    const fps = 30;
    let exportedStillIndex = 0;
    const totalDuration = frames.reduce(
        (sum, frame) => sum + getFrameAnimationDurationMs(frame, finalFrameDelayMs),
        0
    );
    let completedDuration = 0;

    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const durationMs = getFrameAnimationDurationMs(frame, finalFrameDelayMs);
        const stepMs = Math.max(33, Math.round(1000 / fps));

        for (let animationTimeMs = 0; animationTimeMs <= durationMs; animationTimeMs += stepMs) {
            drawFrame(exportCanvas, frame, safeCanvasSize, transform, canvasProps, animationTimeMs);
            requestCanvasFrame(videoTrack);

            if (animationTimeMs === 0 || animationTimeMs + stepMs > durationMs) {
                let imageDataUrl = null;
                try {
                    imageDataUrl = exportCanvas.toDataURL("image/webp", 0.86);
                } catch {
                    imageDataUrl = null;
                }

                saveVideoFrameAsync({
                    index: exportedStillIndex,
                    elements: frame.elements,
                    imageDataUrl,
                });
                exportedStillIndex += 1;
            }

            const progress = Math.min(
                100,
                Math.round(((completedDuration + animationTimeMs) / Math.max(1, totalDuration)) * 100)
            );
            onProgress?.(progress);

            await wait(stepMs);
        }

        completedDuration += durationMs;
    }

    onProgress?.(100);
    requestCanvasFrame(videoTrack);
    await wait(500);

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

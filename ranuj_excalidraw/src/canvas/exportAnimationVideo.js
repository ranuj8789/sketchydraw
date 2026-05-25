import { drawElement } from "../utils/drawing";
import { getElementBounds } from "../utils/elementBounds";
import { resetVideoFramesAsync, saveVideoFrameAsync } from "../utils/indexedDbStorage";

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickSupportedMimeType() {
    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
    ];

    if (typeof MediaRecorder === "undefined") {
        return "";
    }

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function cloneElements(elements = []) {
    return JSON.parse(JSON.stringify(elements || []));
}

function getFrames(historyStates = [], currentElements = []) {
    const usableHistory = (historyStates || [])
        .filter((state) => Array.isArray(state))
        .map(cloneElements)
        .filter((state, index, arr) => {
            // Keep the first frame, but remove repeated identical frames.
            if (index === 0) return true;
            return JSON.stringify(state) !== JSON.stringify(arr[index - 1]);
        });

    const fallback = [cloneElements(currentElements || [])];
    const frames = usableHistory.length > 0 ? usableHistory : fallback;

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

function drawFrame(canvas, elements, canvasSize, transform, canvasProps = {}) {
    const ctx = canvas.getContext("2d");

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = canvasProps.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(transform.offsetX, transform.offsetY);
    ctx.scale(transform.scale, transform.scale);

    (elements || []).forEach((element) => {
        drawElement(ctx, element, false);
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
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1000);
}

export async function exportUndoRedoAnimationVideo({
                                                       historyStates = [],
                                                       currentElements = [],
                                                       canvasSize = { width: 1200, height: 700 },
                                                       canvasProps = {},
                                                       fileName = "sketchy-animation.webm",
                                                       frameDelayMs = 500,
                                                       gapSeconds,
                                                       onProgress,
                                                   }) {
    if (typeof MediaRecorder === "undefined") {
        alert("Video export is not supported in this browser.");
        return;
    }

    const mimeType = pickSupportedMimeType();

    if (!mimeType) {
        alert("Your browser does not support WebM video recording.");
        return;
    }

    const frames = getFrames(historyStates, currentElements);

    if (!frames.length) {
        alert("Nothing to export yet.");
        return;
    }

    const finalFrameDelayMs = Number.isFinite(Number(gapSeconds))
        ? Math.max(100, Math.min(5000, Number(gapSeconds) * 1000))
        : frameDelayMs;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;

    await preloadImages(frames);

    const contentBounds = getFramesContentBounds(frames);
    const transform = getVideoTransform(contentBounds, canvasSize);

    resetVideoFramesAsync();

    drawFrame(exportCanvas, frames[0] || [], canvasSize, transform, canvasProps);

    // 0 means manual frame capture. It avoids blank/unstable recordings in some browsers.
    const stream = exportCanvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];

    const recorder = new MediaRecorder(stream, { mimeType });
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

    recorder.start(100);

    for (let i = 0; i < frames.length; i++) {
        const elements = frames[i];

        drawFrame(exportCanvas, elements, canvasSize, transform, canvasProps);

        let imageDataUrl = null;
        try {
            imageDataUrl = exportCanvas.toDataURL("image/webp", 0.86);
        } catch {
            imageDataUrl = null;
        }

        saveVideoFrameAsync({
            index: i,
            elements,
            imageDataUrl,
        });

        if (videoTrack && typeof videoTrack.requestFrame === "function") {
            videoTrack.requestFrame();
        }

        const progress = Math.round(((i + 1) / frames.length) * 100);
        onProgress?.(progress);

        await wait(finalFrameDelayMs);
    }

    // Hold the final drawing briefly so the video does not end too abruptly.
    if (videoTrack && typeof videoTrack.requestFrame === "function") {
        videoTrack.requestFrame();
    }
    await wait(Math.max(400, finalFrameDelayMs));

    recorder.stop();
    await stopped;

    stream.getTracks().forEach((track) => track.stop());

    if (chunks.length === 0) {
        alert("Video was not created. No video frames were recorded.");
        return;
    }

    const blob = new Blob(chunks, { type: mimeType });

    if (blob.size === 0) {
        alert("Video file is empty.");
        return;
    }

    downloadBlob(blob, fileName);
}

import { drawElement } from "../utils/drawing";
import { getElementBounds } from "../utils/elementBounds";
import { apiUrl } from "../config/api";
import { authHeaders } from "../utils/auth";

const VIDEO_EXPORT_API_BASE = (process.env.REACT_APP_VIDEO_EXPORT_API_BASE || "").replace(/\/$/, "");

function videoApiUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return VIDEO_EXPORT_API_BASE ? `${VIDEO_EXPORT_API_BASE}${cleanPath}` : apiUrl(cleanPath);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
            durationMs: Number.isFinite(Number(frame.durationMs))
                ? Math.max(100, Number(frame.durationMs))
                : undefined,
        }));

    if (fromTimeline.length) return fromTimeline;

    const legacyFrames = (historyStates || [])
        .filter((state) => Array.isArray(state))
        .map((state, index) => ({
            id: `history-${index}`,
            name: `Frame ${index + 1}`,
            elements: clone(state),
            hiddenElementIds: [],
        }));

    if (legacyFrames.length) return legacyFrames;

    return [{
        id: "current-frame",
        name: "Frame 1",
        elements: clone(currentElements),
        hiddenElementIds: [],
    }];
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

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

function getVideoTransform(bounds, canvasSize) {
    if (!bounds) return { scale: 1, offsetX: 0, offsetY: 0 };

    const padding = 56;
    const availableWidth = Math.max(1, canvasSize.width - padding * 2);
    const availableHeight = Math.max(1, canvasSize.height - padding * 2);
    const scale = Math.min(1, availableWidth / bounds.w, availableHeight / bounds.h);

    return {
        scale,
        offsetX: (canvasSize.width - bounds.w * scale) / 2 - bounds.x * scale,
        offsetY: (canvasSize.height - bounds.h * scale) / 2 - bounds.y * scale,
    };
}

function getAnimatedElementIds(elements = []) {
    return new Set(
        elements
            .filter((el) => el?.animation?.type && el.animation.type !== "none")
            .map((el) => el.id)
    );
}

function getFrameDurationMs(frame, fallbackMs) {
    const configured = Number.isFinite(Number(frame?.durationMs))
        ? Math.max(100, Number(frame.durationMs))
        : 0;

    const animationEnd = (frame?.elements || []).reduce((max, element) => {
        const animation = element?.animation || {};
        if (!animation.type || animation.type === "none") return max;
        return Math.max(
            max,
            Math.max(1, Number(animation.durationMs) || 1000)
            + Math.max(0, Number(animation.delayMs) || 0)
        );
    }, 0);

    return Math.max(configured, fallbackMs, animationEnd);
}

function drawFrame(canvas, frame, canvasSize, transform, canvasProps = {}, animationTimeMs = 0) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not create export canvas context.");

    if (canvas.width !== canvasSize.width) canvas.width = canvasSize.width;
    if (canvas.height !== canvasSize.height) canvas.height = canvasSize.height;

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
    visibleElements.forEach((element) => drawElement(ctx, element, false, renderOptions));
    ctx.restore();
}

async function preloadImages(frames = []) {
    const sources = new Set();
    frames.forEach((frame) => {
        (frame.elements || []).forEach((element) => {
            if (element?.type === "image" && element.src) sources.add(element.src);
        });
    });

    await Promise.all(Array.from(sources).map((src) => new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = resolve;
        image.onerror = resolve;
        image.src = src;
    })));
}

function pickWebmMimeType() {
    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function makeRecorder(stream, mimeType) {
    return new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 3_000_000,
    });
}

async function recordFrameSegment({
                                      canvas,
                                      frame,
                                      durationMs,
                                      fps,
                                      canvasSize,
                                      transform,
                                      canvasProps,
                                      onTick,
                                  }) {
    const mimeType = pickWebmMimeType();
    if (!mimeType) throw new Error("Chrome could not create a WebM recording segment.");

    drawFrame(canvas, frame, canvasSize, transform, canvasProps, 0);

    const stream = canvas.captureStream(fps);
    const recorder = makeRecorder(stream, mimeType);
    const chunks = [];

    recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
    };

    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.error || event);
    });

    recorder.start(500);

    const stepMs = Math.max(67, Math.round(1000 / fps));
    const startedAt = performance.now();

    while (true) {
        const elapsed = Math.min(durationMs, performance.now() - startedAt);
        drawFrame(canvas, frame, canvasSize, transform, canvasProps, elapsed);
        onTick?.(elapsed);
        if (elapsed >= durationMs) break;
        await wait(Math.min(stepMs, durationMs - elapsed));
    }

    await wait(100);
    recorder.requestData?.();
    await wait(100);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("A video segment was empty.");
    return blob;
}

async function readError(response, fallback) {
    try {
        const body = await response.json();
        return body.message || body.error || fallback;
    } catch {
        try {
            return (await response.text()) || fallback;
        } catch {
            return fallback;
        }
    }
}

async function startExportSession({ width, height, fps, frameCount }) {
    const response = await fetch(videoApiUrl("/api/video-exports/start"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ width, height, fps, frameCount }),
    });
    if (!response.ok) throw new Error(await readError(response, "Could not start video export."));
    return response.json();
}

async function uploadSegment(exportId, index, blob) {
    const form = new FormData();
    form.append("segment", blob, `segment-${String(index).padStart(4, "0")}.webm`);

    const response = await fetch(videoApiUrl(`/api/video-exports/${exportId}/segments/${index}`), {
        method: "POST",
        headers: { ...authHeaders() },
        body: form,
    });
    if (!response.ok) throw new Error(await readError(response, `Could not upload frame ${index + 1}.`));
}


async function fetchExportStatus(exportId) {
    const response = await fetch(videoApiUrl(`/api/video-exports/${exportId}/status`), {
        method: "GET",
        headers: { ...authHeaders() },
    });
    if (!response.ok) throw new Error(await readError(response, "Could not read video export status."));
    return response.json();
}

async function completeExport(exportId, fileName, onStatus) {
    let polling = true;
    const pollPromise = (async () => {
        while (polling) {
            try {
                const status = await fetchExportStatus(exportId);
                onStatus?.(status);
                if (status.phase === "READY" || status.phase === "FAILED") break;
            } catch (error) {
                console.warn("Video status polling failed:", error);
            }
            await wait(1000);
        }
    })();

    try {
        const response = await fetch(videoApiUrl(`/api/video-exports/${exportId}/complete`), {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ fileName }),
        });
        if (!response.ok) throw new Error(await readError(response, "FFmpeg could not create the MP4."));
        return response.blob();
    } finally {
        polling = false;
        await pollPromise;
    }
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
        link.remove();
        URL.revokeObjectURL(url);
    }, 5000);
}

async function exportServerVideo({
                                     historyStates = [],
                                     currentElements = [],
                                     timelineFrames = [],
                                     canvasSize = { width: 1200, height: 700 },
                                     canvasProps = {},
                                     fileName = "sketchy-animation.mp4",
                                     frameDelayMs = 500,
                                     gapSeconds,
                                     onProgress,
                                     onStatus,
                                 }) {
    if (typeof MediaRecorder === "undefined") {
        throw new Error("Use the latest Chrome or Edge for video export.");
    }

    const frames = normalizeTimelineFrames({
        timelineFrames,
        historyStates,
        currentElements,
    }).filter((frame) => frame.elements.length > 0);

    if (!frames.length) throw new Error("Nothing to export.");

    const fallbackDurationMs = Number.isFinite(Number(gapSeconds))
        ? Math.max(100, Number(gapSeconds) * 1000)
        : frameDelayMs;

    const safeCanvasSize = {
        width: Math.max(320, Math.round(canvasSize?.width || 1200)),
        height: Math.max(240, Math.round(canvasSize?.height || 700)),
    };

    // Even dimensions are required by H.264/yuv420p.
    safeCanvasSize.width -= safeCanvasSize.width % 2;
    safeCanvasSize.height -= safeCanvasSize.height % 2;

    const fps = 12;
    const canvas = document.createElement("canvas");
    canvas.width = safeCanvasSize.width;
    canvas.height = safeCanvasSize.height;

    await preloadImages(frames);

    const transform = getVideoTransform(getFramesContentBounds(frames), safeCanvasSize);
    const durations = frames.map((frame) => getFrameDurationMs(frame, fallbackDurationMs));
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

    onStatus?.({ phase: "STARTING", message: "Starting server export", progress: 0 });
    const session = await startExportSession({
        width: safeCanvasSize.width,
        height: safeCanvasSize.height,
        fps,
        frameCount: frames.length,
    });

    let completedDuration = 0;

    for (let index = 0; index < frames.length; index += 1) {
        onStatus?.({
            phase: "RECORDING",
            message: `Recording frame ${index + 1} of ${frames.length}`,
            progress: Math.round((completedDuration / totalDuration) * 90),
        });
        const durationMs = durations[index];
        const segment = await recordFrameSegment({
            canvas,
            frame: frames[index],
            durationMs,
            fps,
            canvasSize: safeCanvasSize,
            transform,
            canvasProps,
            onTick: (elapsed) => {
                const progress = ((completedDuration + elapsed) / totalDuration) * 90;
                onProgress?.(Math.max(0, Math.min(90, Math.round(progress))));
            },
        });

        onStatus?.({
            phase: "UPLOADING",
            message: `Uploading frame ${index + 1} of ${frames.length}`,
            progress: Math.round((completedDuration / totalDuration) * 90),
        });
        await uploadSegment(session.exportId, index, segment);
        completedDuration += durationMs;
        onProgress?.(Math.round((completedDuration / totalDuration) * 90));
    }

    onProgress?.(94);
    onStatus?.({ phase: "CONVERTING", message: "Server is converting segments to MP4", progress: 94 });
    const mp4Blob = await completeExport(session.exportId, fileName, (status) => {
        const mappedProgress = Math.max(94, Math.min(99, Number(status.progress) || 94));
        onProgress?.(mappedProgress);
        onStatus?.({ ...status, progress: mappedProgress });
    });
    onProgress?.(100);
    onStatus?.({ phase: "READY", message: "MP4 is ready. Downloading now.", progress: 100 });
    downloadBlob(mp4Blob, fileName.replace(/\.(webm|mp4)$/i, ".mp4"));
}


async function exportBrowserVideo({
                                      historyStates = [], currentElements = [], timelineFrames = [],
                                      canvasSize = { width: 1200, height: 700 }, canvasProps = {},
                                      fileName = "sketchy-animation.webm", frameDelayMs = 500, gapSeconds, onProgress,
                                  }) {
    if (typeof MediaRecorder === "undefined") throw new Error("Browser video export needs Chrome or Edge.");
    const mimeType = pickWebmMimeType();
    if (!mimeType) throw new Error("This browser cannot record WebM video.");

    const frames = normalizeTimelineFrames({ timelineFrames, historyStates, currentElements })
        .filter((frame) => frame.elements.length > 0);
    if (!frames.length) throw new Error("Nothing to export.");

    const fallbackDurationMs = Number.isFinite(Number(gapSeconds))
        ? Math.max(100, Number(gapSeconds) * 1000) : frameDelayMs;
    const safeCanvasSize = {
        width: Math.max(320, Math.round(canvasSize?.width || 1200)),
        height: Math.max(240, Math.round(canvasSize?.height || 700)),
    };
    const fps = 12;
    const canvas = document.createElement("canvas");
    canvas.width = safeCanvasSize.width;
    canvas.height = safeCanvasSize.height;
    await preloadImages(frames);
    const transform = getVideoTransform(getFramesContentBounds(frames), safeCanvasSize);
    const durations = frames.map((frame) => getFrameDurationMs(frame, fallbackDurationMs));
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

    drawFrame(canvas, frames[0], safeCanvasSize, transform, canvasProps, 0);
    const stream = canvas.captureStream(fps);
    const recorder = makeRecorder(stream, mimeType);
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.error || event);
    });
    recorder.start(1000);

    let completed = 0;
    for (let index = 0; index < frames.length; index += 1) {
        const durationMs = durations[index];
        const startedAt = performance.now();
        while (true) {
            const elapsed = Math.min(durationMs, performance.now() - startedAt);
            drawFrame(canvas, frames[index], safeCanvasSize, transform, canvasProps, elapsed);
            onProgress?.(Math.round(((completed + elapsed) / totalDuration) * 100));
            if (elapsed >= durationMs) break;
            await wait(Math.max(67, Math.round(1000 / fps)));
        }
        completed += durationMs;
    }

    recorder.requestData?.();
    await wait(150);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("Browser export produced an empty video.");
    downloadBlob(blob, fileName.replace(/\.mp4$/i, ".webm"));
    onProgress?.(100);
}

export async function exportUndoRedoAnimationVideo(options = {}) {
    const mode = options.mode === "browser" ? "browser" : "server";
    if (mode === "browser") return exportBrowserVideo(options);
    return exportServerVideo(options);
}

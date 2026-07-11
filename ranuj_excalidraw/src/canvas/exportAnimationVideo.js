import { drawElement, preloadDrawingImages } from "../utils/drawing";
import { getElementBounds } from "../utils/elementBounds";
import { apiUrl } from "../config/api";
import { authHeaders } from "../utils/auth";

const CONFIGURED_VIDEO_EXPORT_API_BASE = (
    process.env.REACT_APP_VIDEO_EXPORT_API_BASE ||
    process.env.REACT_APP_API_BASE ||
    ""
).replace(/\/$/, "");

function getVideoExportApiBase() {
    if (CONFIGURED_VIDEO_EXPORT_API_BASE) return CONFIGURED_VIDEO_EXPORT_API_BASE;

    // React runs on :3000 and the local Spring Boot API runs on :9191.
    // Without a package.json proxy, a relative /api URL is sent to React and returns 404.
    if (
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
        window.location.port === "3000"
    ) {
        return `${window.location.protocol}//${window.location.hostname}:9191`;
    }

    return "";
}

function videoApiUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    const base = getVideoExportApiBase();
    return base ? `${base}${cleanPath}` : apiUrl(cleanPath);
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

function getFrameAnimationEndMs(frame) {
    return (frame?.elements || []).reduce((max, element) => {
        const animation = element?.animation || {};
        if (!animation.type || animation.type === "none") return max;
        return Math.max(
            max,
            Math.max(1, Number(animation.durationMs) || 1000)
            + Math.max(0, Number(animation.delayMs) || 0)
        );
    }, 0);
}

function getFrameDurationMs(frame, holdAfterMs, preAnimationDelayMs = 0) {
    const configured = Number.isFinite(Number(frame?.durationMs))
        ? Math.max(100, Number(frame.durationMs))
        : 0;

    const animationEnd = getFrameAnimationEndMs(frame);
    const calculated = Math.max(100, preAnimationDelayMs + animationEnd + holdAfterMs);
    return Math.max(configured, calculated);
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
    const elements = frames.flatMap((frame) => frame?.elements || []);
    await preloadDrawingImages(elements);
}

function createRecordingCanvas(canvasSize) {
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
        position: "fixed",
        left: "-100000px",
        top: "0",
        width: `${canvasSize.width}px`,
        height: `${canvasSize.height}px`,
        opacity: "0",
        pointerEvents: "none",
    });
    document.body.appendChild(canvas);
    return canvas;
}

function createCanvasCapture(canvas, fps) {
    let stream = canvas.captureStream(0);
    let track = stream.getVideoTracks()[0];

    if (!track || typeof track.requestFrame !== "function") {
        stream.getTracks().forEach((item) => item.stop());
        stream = canvas.captureStream(fps);
        track = stream.getVideoTracks()[0];
    }

    return {
        stream,
        requestFrame: () => track?.requestFrame?.(),
    };
}

function pickWebmMimeType() {
    const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function makeRecorder(stream, mimeType, canvasSize = {}) {
    const pixels = Math.max(1, Number(canvasSize.width) || 1920)
        * Math.max(1, Number(canvasSize.height) || 1080);
    const fullHdPixels = 1920 * 1080;
    const scale = Math.max(1, pixels / fullHdPixels);
    const videoBitsPerSecond = Math.round(Math.min(60_000_000, 12_000_000 * scale));

    return new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond,
    });
}

async function waitForExportAssets() {
    if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
    }
    // Give the browser one paint after fonts/images have settled before recording starts.
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function yieldToBrowser() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Records every timeline step in order. It never jumps from performance.now()
 * to a later animation state, so a busy main thread cannot skip intermediate
 * animation frames and then suddenly reveal the final state.
 */
async function renderDeterministicRecording({ durationMs, fps, render, onTick, requestFrame }) {
    const safeFps = Math.max(1, Math.min(60, Number(fps) || 30));
    const frameIntervalMs = 1000 / safeFps;
    const frameCount = Math.max(1, Math.ceil(durationMs / frameIntervalMs));
    const startedAt = performance.now();
    let lastProgressAt = -Infinity;

    for (let frameIndex = 0; frameIndex <= frameCount; frameIndex += 1) {
        const animationTimeMs = Math.min(durationMs, frameIndex * frameIntervalMs);

        render(animationTimeMs);
        requestFrame?.();

        const now = performance.now();
        if (frameIndex === frameCount || now - lastProgressAt >= 250) {
            lastProgressAt = now;
            onTick?.(animationTimeMs);
        }

        if (frameIndex === frameCount) break;

        // Keep normal exports close to the requested FPS, but never skip a
        // timeline frame when drawing is slower than real time.
        const nextTargetAt = startedAt + (frameIndex + 1) * frameIntervalMs;
        const remainingMs = nextTargetAt - performance.now();
        if (remainingMs > 1) {
            await wait(remainingMs);
        } else {
            await yieldToBrowser();
        }
    }
}

async function recordFrameSegment({
                                      canvas,
                                      frame,
                                      durationMs,
                                      fps,
                                      canvasSize,
                                      transform,
                                      canvasProps,
                                      preAnimationDelayMs = 0,
                                      onTick,
                                  }) {
    const mimeType = pickWebmMimeType();
    if (!mimeType) throw new Error("Chrome could not create a WebM recording segment.");

    drawFrame(canvas, frame, canvasSize, transform, canvasProps, 0);

    const capture = createCanvasCapture(canvas, fps);
    const { stream } = capture;
    capture.requestFrame();
    const recorder = makeRecorder(stream, mimeType, canvasSize);
    const chunks = [];

    recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
    };

    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.error || event);
    });

    recorder.start(250);

    await renderDeterministicRecording({
        durationMs,
        fps,
        render: (elapsed) => {
            drawFrame(
                canvas,
                frame,
                canvasSize,
                transform,
                canvasProps,
                Math.max(0, elapsed - preAnimationDelayMs)
            );
        },
        onTick,
        requestFrame: capture.requestFrame,
    });

    await wait(Math.ceil(1000 / fps));
    recorder.requestData?.();
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("A video segment was empty.");
    return blob;
}

async function readError(response, fallback) {
    let text = "";
    try {
        text = await response.text();
    } catch {
        return `${fallback} (HTTP ${response.status || "unknown"})`;
    }

    if (text) {
        try {
            const body = JSON.parse(text);
            return body.message || body.error || `${fallback} (HTTP ${response.status})`;
        } catch {
            return `${fallback} (HTTP ${response.status}): ${text.slice(0, 500)}`;
        }
    }

    return `${fallback} (HTTP ${response.status || "unknown"})`;
}

async function startExportSession({ width, height, fps, frameCount }) {
    const url = videoApiUrl("/api/video-exports/start");
    let response;

    try {
        response = await fetch(url, {
            method: "POST",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ width, height, fps, frameCount }),
        });
    } catch (error) {
        throw new Error(
            `Could not connect to the video export API at ${url}. ` +
            `Confirm Spring Boot is running on port 9191. ${error?.message || ""}`.trim()
        );
    }

    if (!response.ok) {
        throw new Error(await readError(response, `Could not start video export at ${url}.`));
    }

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
        const contentType = (response.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("video/mp4")) {
            throw new Error(`Server returned ${contentType || "an unknown content type"} instead of video/mp4.`);
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error("Server returned an empty MP4 response.");
        return blob;
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


async function recordTimelineSegment({
                                         canvas,
                                         frames,
                                         durations,
                                         fps,
                                         canvasSize,
                                         transform,
                                         canvasProps,
                                         preAnimationDelayMs = 0,
                                         onTick,
                                     }) {
    const mimeType = pickWebmMimeType();
    if (!mimeType) throw new Error("Chrome could not create a WebM recording stream.");

    drawFrame(canvas, frames[0], canvasSize, transform, canvasProps, 0);
    const capture = createCanvasCapture(canvas, fps);
    const { stream } = capture;
    capture.requestFrame();

    const recorder = makeRecorder(stream, mimeType, canvasSize);
    const chunks = [];
    recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
    };
    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.error || event);
    });

    recorder.start(250);
    let completedDuration = 0;
    const totalDuration = durations.reduce((sum, value) => sum + value, 0);

    for (let index = 0; index < frames.length; index += 1) {
        const durationMs = durations[index];
        await renderDeterministicRecording({
            durationMs,
            fps,
            render: (elapsed) => {
                drawFrame(
                    canvas,
                    frames[index],
                    canvasSize,
                    transform,
                    canvasProps,
                    Math.max(0, elapsed - preAnimationDelayMs)
                );
            },
            onTick: (elapsed) => onTick?.({
                index,
                elapsed,
                completedDuration,
                totalDuration,
            }),
            requestFrame: capture.requestFrame,
        });
        completedDuration += durationMs;
    }

    await wait(Math.ceil(1000 / fps));
    recorder.requestData?.();
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("The recorded video stream was empty.");
    return blob;
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
                                     preAnimationDelaySeconds = 0,
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

    const holdAfterMs = Number.isFinite(Number(gapSeconds))
        ? Math.max(0, Number(gapSeconds) * 1000)
        : frameDelayMs;
    const preAnimationDelayMs = Number.isFinite(Number(preAnimationDelaySeconds))
        ? Math.max(0, Number(preAnimationDelaySeconds) * 1000)
        : 0;

    const safeCanvasSize = {
        width: Math.max(320, Math.round(canvasSize?.width || 1200)),
        height: Math.max(240, Math.round(canvasSize?.height || 700)),
    };
    safeCanvasSize.width -= safeCanvasSize.width % 2;
    safeCanvasSize.height -= safeCanvasSize.height % 2;

    const fps = 30;
    const canvas = createRecordingCanvas(safeCanvasSize);

    try {
        await preloadImages(frames);
        await waitForExportAssets();
        const transform = getVideoTransform(getFramesContentBounds(frames), safeCanvasSize);
        const durations = frames.map((frame) =>
            getFrameDurationMs(frame, holdAfterMs, preAnimationDelayMs)
        );

        onStatus?.({ phase: "STARTING", message: "Starting server MP4 export", progress: 0 });
        // One continuous browser recording is uploaded as one server segment.
        // This removes MediaRecorder restarts and FFmpeg concat pauses between frames.
        const session = await startExportSession({
            width: safeCanvasSize.width,
            height: safeCanvasSize.height,
            fps,
            frameCount: 1,
        });

        onStatus?.({ phase: "RECORDING", message: `Recording ${frames.length} frames continuously`, progress: 1 });
        const segment = await recordTimelineSegment({
            canvas,
            frames,
            durations,
            fps,
            canvasSize: safeCanvasSize,
            transform,
            canvasProps,
            preAnimationDelayMs,
            onTick: ({ completedDuration, elapsed, totalDuration }) => {
                const progress = ((completedDuration + elapsed) / Math.max(1, totalDuration)) * 90;
                onProgress?.(Math.max(0, Math.min(90, Math.round(progress))));
            },
        });

        onStatus?.({ phase: "UPLOADING", message: "Uploading continuous video stream", progress: 91 });
        await uploadSegment(session.exportId, 0, segment);
        onProgress?.(94);

        onStatus?.({ phase: "CONVERTING", message: "Server is converting WebM to MP4", progress: 94 });
        const mp4Blob = await completeExport(session.exportId, fileName, (status) => {
            const mappedProgress = Math.max(94, Math.min(99, Number(status.progress) || 94));
            onProgress?.(mappedProgress);
            onStatus?.({ ...status, progress: mappedProgress });
        });

        if (!mp4Blob?.size) throw new Error("The server returned an empty MP4 file.");
        onProgress?.(100);
        onStatus?.({ phase: "READY", message: "MP4 is ready. Downloading now.", progress: 100 });
        downloadBlob(mp4Blob, fileName.replace(/\.(webm|mp4)$/i, ".mp4"));
    } finally {
        canvas.remove();
    }
}

async function exportBrowserVideo({
                                      historyStates = [], currentElements = [], timelineFrames = [],
                                      canvasSize = { width: 1200, height: 700 }, canvasProps = {},
                                      fileName = "sketchy-animation.webm", frameDelayMs = 500, gapSeconds,
                                      preAnimationDelaySeconds = 0, onProgress,
                                  }) {
    if (typeof MediaRecorder === "undefined") throw new Error("Browser video export needs Chrome or Edge.");
    const mimeType = pickWebmMimeType();
    if (!mimeType) throw new Error("This browser cannot record WebM video.");

    const frames = normalizeTimelineFrames({ timelineFrames, historyStates, currentElements })
        .filter((frame) => frame.elements.length > 0);
    if (!frames.length) throw new Error("Nothing to export.");

    const holdAfterMs = Number.isFinite(Number(gapSeconds))
        ? Math.max(0, Number(gapSeconds) * 1000) : frameDelayMs;
    const preAnimationDelayMs = Number.isFinite(Number(preAnimationDelaySeconds))
        ? Math.max(0, Number(preAnimationDelaySeconds) * 1000) : 0;
    const safeCanvasSize = {
        width: Math.max(320, Math.round(canvasSize?.width || 1200)),
        height: Math.max(240, Math.round(canvasSize?.height || 700)),
    };
    const fps = 30;
    const canvas = createRecordingCanvas(safeCanvasSize);
    await preloadImages(frames);
    await waitForExportAssets();
    const transform = getVideoTransform(getFramesContentBounds(frames), safeCanvasSize);
    const durations = frames.map((frame) =>
        getFrameDurationMs(frame, holdAfterMs, preAnimationDelayMs)
    );
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

    drawFrame(canvas, frames[0], safeCanvasSize, transform, canvasProps, 0);
    const capture = createCanvasCapture(canvas, fps);
    const { stream } = capture;
    capture.requestFrame();
    const recorder = makeRecorder(stream, mimeType, safeCanvasSize);
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (event) => reject(event.error || event);
    });
    recorder.start(250);

    let completed = 0;
    for (let index = 0; index < frames.length; index += 1) {
        const durationMs = durations[index];
        await renderDeterministicRecording({
            durationMs,
            fps,
            render: (elapsed) => {
                drawFrame(
                    canvas,
                    frames[index],
                    safeCanvasSize,
                    transform,
                    canvasProps,
                    Math.max(0, elapsed - preAnimationDelayMs)
                );
            },
            onTick: (elapsed) => {
                onProgress?.(Math.round(((completed + elapsed) / totalDuration) * 100));
            },
            requestFrame: capture.requestFrame,
        });
        completed += durationMs;
    }

    await wait(Math.ceil(1000 / fps));
    recorder.requestData?.();
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size) throw new Error("Browser export produced an empty video.");
    downloadBlob(blob, fileName.replace(/\.mp4$/i, ".webm"));
    canvas.remove();
    onProgress?.(100);
}

export async function exportUndoRedoAnimationVideo(options = {}) {
    const mode = options.mode === "browser" ? "browser" : "server";
    if (mode === "browser") return exportBrowserVideo(options);

    // Server MP4 means MP4 only. Never silently replace it with a WebM download.
    try {
        return await exportServerVideo(options);
    } catch (error) {
        console.error("Server MP4 export failed:", error);
        options.onStatus?.({
            phase: "FAILED",
            message: error?.message || "Server MP4 export failed.",
            progress: 0,
            error: error?.message || String(error),
        });
        throw error;
    }
}

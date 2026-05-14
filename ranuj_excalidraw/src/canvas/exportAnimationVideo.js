import { drawElement } from "../utils/drawing";

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

function drawFrame(canvas, elements, canvasSize) {
    const ctx = canvas.getContext("2d");

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    elements.forEach((element) => {
        drawElement(ctx, element, false);
    });
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
                                                       fileName = "sketchy-undo-redo-animation.webm",
                                                       fps = 30,
                                                       frameDelayMs = 500,
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

    const usableHistory = historyStates
        .filter((state) => Array.isArray(state))
        .map((state) => JSON.parse(JSON.stringify(state)));

    const frames =
        usableHistory.length > 0
            ? usableHistory
            : [JSON.parse(JSON.stringify(currentElements || []))];

    const undoRedoFrames = [
        ...frames,
        ...frames.slice().reverse(),
    ];

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvasSize.width;
    exportCanvas.height = canvasSize.height;

    // Draw first frame before starting recorder
    drawFrame(exportCanvas, undoRedoFrames[0] || [], canvasSize);

    const stream = exportCanvas.captureStream(fps);
    const videoTrack = stream.getVideoTracks()[0];

    const recorder = new MediaRecorder(stream, {
        mimeType,
    });

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

    for (let i = 0; i < undoRedoFrames.length; i++) {
        const elements = undoRedoFrames[i];

        drawFrame(exportCanvas, elements, canvasSize);

        if (videoTrack && typeof videoTrack.requestFrame === "function") {
            videoTrack.requestFrame();
        }

        const progress = Math.round(((i + 1) / undoRedoFrames.length) * 100);
        onProgress?.(progress);

        await wait(frameDelayMs);
    }

    await wait(300);

    recorder.stop();
    await stopped;

    stream.getTracks().forEach((track) => track.stop());

    if (chunks.length === 0) {
        alert("Video was not created. No video frames were recorded.");
        return;
    }

    const blob = new Blob(chunks, {
        type: mimeType,
    });

    if (blob.size === 0) {
        alert("Video file is empty.");
        return;
    }

    downloadBlob(blob, fileName);
}
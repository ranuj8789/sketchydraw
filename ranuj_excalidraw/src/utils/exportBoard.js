import { jsPDF } from "jspdf";
import { isPaidUser } from "./auth";
import { renderCanvas } from "../canvas/canvasRender";
import { getNotebookPageCount, getNotebookPageSize, getNotebookPageTop } from "../canvas/notebook/notebookPages";
import { getElementBounds } from "./elementBounds";
import { getSocialMediaPreset } from "./socialMediaPresets";

const WATERMARK_TEXT = "SketchyDraw";

function shouldWatermark(options = {}) {
    if (options.watermark === true) return true;
    if (options.watermark === false) return false;

    return !isPaidUser();
}

function drawWatermark(ctx, canvas) {
    const text = WATERMARK_TEXT;

    const fontSize = Math.max(
        18,
        Math.round(Math.min(canvas.width, canvas.height) * 0.035)
    );

    ctx.save();

    ctx.globalAlpha = 0.18;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 7);

    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const stepX = Math.max(260, fontSize * 8);
    const stepY = Math.max(150, fontSize * 5);

    for (let y = -canvas.height; y <= canvas.height; y += stepY) {
        for (let x = -canvas.width; x <= canvas.width; x += stepX) {
            ctx.fillText(text, x, y);
        }
    }

    ctx.restore();
}

export function createCanvasForExport(canvas, options = {}) {
    if (!canvas) return null;

    if (!shouldWatermark(options)) {
        return canvas;
    }

    const out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;

    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0);

    drawWatermark(ctx, out);

    return out;
}

function canvasToBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not create image file."));
        }, type, quality);
    });
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function createHighResolutionCanvas(sourceCanvas, options = {}) {
    const scale = Math.max(1, Math.min(4, Number(options.scale) || 2));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    out.height = Math.max(1, Math.round(sourceCanvas.height * scale));

    const ctx = out.getContext("2d", { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (options.background !== false) {
        ctx.fillStyle = options.background || "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
    }

    ctx.drawImage(sourceCanvas, 0, 0, out.width, out.height);
    return out;
}

export async function exportCanvasToPNG(
    canvas,
    fileName = "sketchy-board.png",
    options = {}
) {
    if (!canvas) return;

    const watermarkedCanvas = createCanvasForExport(canvas, options);
    if (!watermarkedCanvas) return;

    const exportCanvas = createHighResolutionCanvas(watermarkedCanvas, {
        scale: options.scale ?? 2,
        background: options.background ?? "#ffffff",
    });

    const blob = await canvasToBlob(exportCanvas, "image/png");
    downloadBlob(blob, fileName);
}

function getInstagramSceneBounds(elements = []) {
    const visibleElements = (elements || []).filter((element) => !element?.isDeleted);
    const bounds = visibleElements
        .map((element) => getElementBounds(element))
        .filter(Boolean);

    if (bounds.length === 0) {
        return null;
    }

    const minX = Math.min(...bounds.map((bound) => bound.x));
    const minY = Math.min(...bounds.map((bound) => bound.y));
    const maxX = Math.max(...bounds.map((bound) => bound.x + bound.w));
    const maxY = Math.max(...bounds.map((bound) => bound.y + bound.h));

    return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
    };
}

export async function exportCanvasForInstagram(
    scene,
    fileName = "sketchydraw-instagram.png",
    options = {}
) {
    const preset = getSocialMediaPreset(options.preset) || getSocialMediaPreset("portrait");
    const elements = (scene?.elements || []).filter((element) => !element?.isDeleted);
    const canvasProps = scene?.canvasProps || {};
    const bounds = getInstagramSceneBounds(elements);

    if (!bounds) {
        throw new Error("There is nothing to export.");
    }

    const safe = preset.safe || { top: 72, right: 72, bottom: 72, left: 72 };
    const extraSafety = Math.max(12, Number(options.extraSafety ?? 24));
    const safeLeft = safe.left + extraSafety;
    const safeRight = safe.right + extraSafety;
    const safeTop = safe.top + extraSafety;
    const safeBottom = safe.bottom + extraSafety;
    const availableWidth = Math.max(1, preset.width - safeLeft - safeRight);
    const availableHeight = Math.max(1, preset.height - safeTop - safeBottom);
    const zoom = Math.min(
        availableWidth / bounds.width,
        availableHeight / bounds.height
    );

    const renderedWidth = bounds.width * zoom;
    const renderedHeight = bounds.height * zoom;
    const offsetX = safeLeft + (availableWidth - renderedWidth) / 2 - bounds.x * zoom;
    const offsetY = safeTop + (availableHeight - renderedHeight) / 2 - bounds.y * zoom;

    // renderCanvas uses devicePixelRatio internally. Render the clean scene first,
    // then copy it to a canvas with the exact Instagram pixel dimensions.
    const renderedCanvas = document.createElement("canvas");
    renderCanvas({
        canvas: renderedCanvas,
        canvasSize: { width: preset.width, height: preset.height },
        elements,
        selectedIds: [],
        connectionHint: null,
        alignmentGuides: [],
        viewport: {
            zoom,
            offsetX,
            offsetY,
        },
        showGrid: options.showGrid === true,
        canvasProps: {
            ...canvasProps,
            backgroundColor:
                options.background || canvasProps.backgroundColor || "#ffffff",
        },
        renderOptions: {
            exportMode: true,
        },
    });

    const out = document.createElement("canvas");
    out.width = preset.width;
    out.height = preset.height;

    const ctx = out.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = options.background || canvasProps.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(renderedCanvas, 0, 0, out.width, out.height);

    if (shouldWatermark(options)) {
        drawWatermark(ctx, out);
    }

    const blob = await canvasToBlob(out, "image/png");
    const file = new File([blob], fileName, { type: "image/png" });

    const userAgent = navigator.userAgent || "";
    const isTouchMac =
        navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const isMobileDevice =
        navigator.userAgentData?.mobile === true ||
        /Android|iPhone|iPod|IEMobile|Opera Mini/i.test(userAgent) ||
        /iPad/i.test(userAgent) ||
        isTouchMac;

    const canShareFile =
        isMobileDevice &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

    if (canShareFile) {
        try {
            await navigator.share({
                files: [file],
                title: "SketchyDraw Instagram Export",
                text: "Created with SketchyDraw",
            });
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
            console.warn("Instagram share failed; downloading PNG instead.", error);
        }
    }

    downloadBlob(blob, fileName);
}

export function exportCanvasToJPEG(
    canvas,
    fileName = "sketchy-board.jpeg",
    options = {}
) {
    if (!canvas) return;

    const exportCanvas = createCanvasForExport(canvas, options);
    if (!exportCanvas) return;

    const jpegCanvas = document.createElement("canvas");
    jpegCanvas.width = exportCanvas.width;
    jpegCanvas.height = exportCanvas.height;

    const ctx = jpegCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    ctx.drawImage(exportCanvas, 0, 0);

    const link = document.createElement("a");
    link.download = fileName;
    link.href = jpegCanvas.toDataURL("image/jpeg", 0.95);
    link.click();
}


function getPageFilteredElements(elements = [], pageIndex = 0) {
    return (elements || []).filter(
        (element) => Number(element?.pageIndex ?? 0) === Number(pageIndex)
    );
}

function createNotebookPageCanvas({
                                      elements = [],
                                      canvasProps = {},
                                      pageIndex = 0,
                                      options = {},
                                  }) {
    const pageSize = getNotebookPageSize(canvasProps);
    const pageTop = getNotebookPageTop(pageIndex, canvasProps);

    const pageCanvas = document.createElement("canvas");
    const pageCanvasSize = {
        width: pageSize.width,
        height: pageSize.height,
    };

    renderCanvas({
        canvas: pageCanvas,
        canvasSize: pageCanvasSize,
        elements: getPageFilteredElements(elements, pageIndex),
        selectedIds: [],
        connectionHint: null,
        alignmentGuides: [],
        viewport: {
            zoom: 1,
            offsetX: 0,
            offsetY: -pageTop,
        },
        showGrid: false,
        canvasProps: {
            ...canvasProps,
            pattern: "notebook",
            pageMode: true,
            pageViewMode: "single",
            currentPageIndex: pageIndex,
        },
    });

    return createCanvasForExport(pageCanvas, options);
}

function getPdfPageLayout(canvas, options = {}) {
    const margin = Number(options.pdfMargin ?? 32);
    const format = options.pdfFormat || "a4";
    const orientation = canvas.width > canvas.height ? "landscape" : "portrait";

    const pdf = new jsPDF({
        orientation,
        unit: "pt",
        format,
        compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const availableWidth = Math.max(1, pdfWidth - margin * 2);
    const availableHeight = Math.max(1, pdfHeight - margin * 2);

    const scale = Math.min(
        availableWidth / canvas.width,
        availableHeight / canvas.height
    );

    const imageWidth = canvas.width * scale;
    const imageHeight = canvas.height * scale;

    return {
        pdf,
        orientation,
        format,
        x: (pdfWidth - imageWidth) / 2,
        y: (pdfHeight - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
    };
}

function canvasToExportImage(canvas, options = {}) {
    const type = options.pdfImageType || "JPEG";
    const quality = Number(options.pdfImageQuality ?? 0.78);

    if (type === "PNG") {
        return { data: canvas.toDataURL("image/png", 1.0), type: "PNG" };
    }

    const jpegCanvas = document.createElement("canvas");
    jpegCanvas.width = canvas.width;
    jpegCanvas.height = canvas.height;

    const ctx = jpegCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    return {
        data: jpegCanvas.toDataURL("image/jpeg", quality),
        type: "JPEG",
    };
}

export function exportNotebookToPDF({
                                        elements = [],
                                        canvasProps = {},
                                        fileName = "sketchy-notebook.pdf",
                                        options = {},
                                    } = {}) {
    const pageCount = getNotebookPageCount(canvasProps);
    let pdf = null;
    let firstLayout = null;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageCanvas = createNotebookPageCanvas({
            elements,
            canvasProps,
            pageIndex,
            options,
        });

        if (!pageCanvas) continue;

        const layout = getPdfPageLayout(pageCanvas, options);

        if (!pdf) {
            pdf = layout.pdf;
            firstLayout = layout;
        } else {
            pdf.addPage(firstLayout.format, firstLayout.orientation);
        }

        const img = canvasToExportImage(pageCanvas, options);

        pdf.addImage(
            img.data,
            img.type,
            layout.x,
            layout.y,
            layout.width,
            layout.height,
            undefined,
            "FAST"
        );
    }

    pdf?.save(fileName);
}

export function exportCanvasToPDF(
    canvas,
    fileName = "sketchy-board.pdf",
    options = {}
) {
    if (!canvas) return;

    const exportCanvas = createCanvasForExport(canvas, options);
    if (!exportCanvas) return;

    const layout = getPdfPageLayout(exportCanvas, options);
    const img = canvasToExportImage(exportCanvas, options);

    layout.pdf.addImage(
        img.data,
        img.type,
        layout.x,
        layout.y,
        layout.width,
        layout.height,
        undefined,
        "FAST"
    );

    layout.pdf.save(fileName);
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function printCanvas(canvas, title = "SketchyDraw Canvas", options = {}) {
    if (!canvas) return;

    // IMPORTANT: open the print window immediately inside the click event.
    // If we generate image first and then call window.open(), Chrome/Safari may block it.
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
        alert("Popup blocked. Please allow popups to print the canvas.");
        return;
    }

    const safeTitle = escapeHtml(title || "SketchyDraw Canvas");

    printWindow.document.open();
    printWindow.document.write(`
        <!doctype html>
        <html>
            <head>
                <title>${safeTitle}</title>
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                    }

                    body {
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-family: Arial, sans-serif;
                    }

                    .printing-message {
                        color: #334155;
                        font-size: 14px;
                        font-weight: 700;
                    }

                    img {
                        max-width: 100%;
                        max-height: 100vh;
                        object-fit: contain;
                    }

                    @media print {
                        @page {
                            margin: 8mm;
                        }

                        body {
                            min-height: auto;
                        }

                        img {
                            width: 100%;
                            height: auto;
                            max-height: none;
                        }

                        .printing-message {
                            display: none;
                        }
                    }
                </style>
            </head>

            <body>
                <div class="printing-message">Preparing print...</div>
            </body>
        </html>
    `);
    printWindow.document.close();

    window.setTimeout(() => {
        const exportCanvas = createCanvasForExport(canvas, options);

        if (!exportCanvas || printWindow.closed) return;

        const imageData = exportCanvas.toDataURL("image/png", 1.0);
        const img = printWindow.document.createElement("img");

        img.alt = safeTitle;
        img.onload = () => {
            printWindow.focus();
            window.setTimeout(() => {
                printWindow.print();
            }, 100);
        };
        img.src = imageData;

        printWindow.document.body.innerHTML = "";
        printWindow.document.body.appendChild(img);
    }, 0);
}

function normalizeBox(el) {
    const x = el.w >= 0 ? el.x : el.x + el.w;
    const y = el.h >= 0 ? el.y : el.y + el.h;
    const w = Math.abs(el.w || 0);
    const h = Math.abs(el.h || 0);

    return { x, y, w, h };
}

export function exportCanvasToSVG(
    elements,
    canvasWidth = 1600,
    canvasHeight = 900,
    fileName = "sketchy-board.svg",
    options = {}
) {
    const svgText = buildSVGText(elements, canvasWidth, canvasHeight, options);

    const blob = new Blob([svgText], {
        type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
}

function renderLine(el, withArrowHead = false) {
    const stroke = el.stroke || "#111827";
    const strokeWidth = el.strokeWidth || 2;

    if (el.lineStyle === "curved" && Array.isArray(el.points) && el.points.length > 1) {
        const pathData = el.points
            .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");

        let svg = `
  <path
    d="${pathData}"
    fill="none"
    stroke="${stroke}"
    stroke-width="${strokeWidth}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`;

        if (withArrowHead) {
            const len = el.points.length;
            const prev = el.points[len - 2];
            const last = el.points[len - 1];

            if (prev && last) {
                svg += renderArrowHead(prev.x, prev.y, last.x, last.y, stroke);
            }
        }

        return svg;
    }

    let svg = `
  <line
    x1="${el.x1 || 0}"
    y1="${el.y1 || 0}"
    x2="${el.x2 || 0}"
    y2="${el.y2 || 0}"
    stroke="${stroke}"
    stroke-width="${strokeWidth}"
    stroke-linecap="round"
  />
`;

    if (withArrowHead) {
        svg += renderArrowHead(
            el.x1 || 0,
            el.y1 || 0,
            el.x2 || 0,
            el.y2 || 0,
            stroke
        );
    }

    return svg;
}

function renderArrowHead(x1, y1, x2, y2, stroke) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 12;

    const x3 = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const y3 = y2 - headLength * Math.sin(angle - Math.PI / 6);

    const x4 = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const y4 = y2 - headLength * Math.sin(angle + Math.PI / 6);

    return `
  <polygon
    points="${x2},${y2} ${x3},${y3} ${x4},${y4}"
    fill="${stroke}"
    stroke="${stroke}"
    stroke-width="1"
  />
`;
}

function escapeXml(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function buildSVGText(
    elements,
    canvasWidth = 1600,
    canvasHeight = 900,
    options = {}
) {
    const svgParts = [];

    svgParts.push(`
<svg xmlns="http://www.w3.org/2000/svg"
     width="${canvasWidth}"
     height="${canvasHeight}"
     viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <rect width="100%" height="100%" fill="white" />
`);

    (elements || []).forEach((el) => {
        if (!el || !el.type) return;

        if (el.type === "rectangle" || el.type === "rect") {
            const { x, y, w, h } = normalizeBox(el);

            svgParts.push(`
  <rect
    x="${x}"
    y="${y}"
    width="${w}"
    height="${h}"
    fill="${el.fill || "transparent"}"
    stroke="${el.stroke || "#111827"}"
    stroke-width="${el.strokeWidth || 2}"
    rx="${el.cornerRadius || 0}"
    ry="${el.cornerRadius || 0}"
  />
`);
        } else if (el.type === "ellipse") {
            const { x, y, w, h } = normalizeBox(el);

            svgParts.push(`
  <ellipse
    cx="${x + w / 2}"
    cy="${y + h / 2}"
    rx="${w / 2}"
    ry="${h / 2}"
    fill="${el.fill || "transparent"}"
    stroke="${el.stroke || "#111827"}"
    stroke-width="${el.strokeWidth || 2}"
  />
`);
        } else if (el.type === "diamond") {
            const { x, y, w, h } = normalizeBox(el);

            const top = `${x + w / 2},${y}`;
            const right = `${x + w},${y + h / 2}`;
            const bottom = `${x + w / 2},${y + h}`;
            const left = `${x},${y + h / 2}`;

            svgParts.push(`
  <polygon
    points="${top} ${right} ${bottom} ${left}"
    fill="${el.fill || "transparent"}"
    stroke="${el.stroke || "#111827"}"
    stroke-width="${el.strokeWidth || 2}"
  />
`);
        } else if (el.type === "line") {
            svgParts.push(renderLine(el, false));
        } else if (el.type === "arrow") {
            svgParts.push(renderLine(el, true));
        } else if (el.type === "pencil") {
            if (Array.isArray(el.points) && el.points.length > 1) {
                const pathData = el.points
                    .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                    .join(" ");

                svgParts.push(`
  <path
    d="${pathData}"
    fill="none"
    stroke="${el.stroke || "#111827"}"
    stroke-width="${el.strokeWidth || 2}"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
`);
            }
        } else if (el.type === "text") {
            const fontSize = el.fontSize || 20;
            const lineHeight = el.lineHeight || 24;
            const fontFamily = el.fontFamily || "Arial, sans-serif";
            const fontWeight = el.bold ? "700" : "400";
            const fontStyle = el.italic ? "italic" : "normal";
            const textDecoration = el.underline ? "underline" : "none";
            const lines = String(el.text || "").split("\n");

            lines.forEach((line, index) => {
                svgParts.push(`
  <text
    x="${el.x || 0}"
    y="${(el.y || 0) + index * lineHeight}"
    font-size="${fontSize}"
    font-family="${escapeXml(fontFamily)}"
    font-weight="${fontWeight}"
    font-style="${fontStyle}"
    text-decoration="${textDecoration}"
    dominant-baseline="text-before-edge"
    fill="${el.stroke || "#111827"}"
  >${escapeXml(line)}</text>
`);
            });
        }
    });

    if (shouldWatermark(options)) {
        svgParts.push(`
  <g opacity="0.18" transform="translate(${canvasWidth / 2} ${canvasHeight / 2}) rotate(-25)">
    <text
      x="0"
      y="0"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="Arial, sans-serif"
      font-size="${Math.max(24, Math.round(Math.min(canvasWidth, canvasHeight) * 0.04))}"
      font-weight="900"
      fill="#111827"
    >${escapeXml(WATERMARK_TEXT)}</text>
  </g>
`);
    }

    svgParts.push(`</svg>`);

    return svgParts.join("");
}

export async function copyCanvasToPNG(canvas, options = {}) {
    return copyCanvasAsImage(canvas, "image/png", options);
}

export async function copyCanvasToJPEG(canvas, options = {}) {
    return copyCanvasAsImage(canvas, "image/jpeg", options);
}

export async function copyBoardToSVG(
    elements,
    canvasWidth = 1600,
    canvasHeight = 900,
    options = {}
) {
    const svgText = buildSVGText(elements, canvasWidth, canvasHeight, options);

    await navigator.clipboard.writeText(svgText);

    return true;
}

async function copyCanvasAsImage(canvas, type = "image/png", options = {}) {
    if (!canvas) {
        throw new Error("Canvas not found");
    }

    let outputCanvas = createCanvasForExport(canvas, options);

    if (type === "image/jpeg") {
        const jpegCanvas = document.createElement("canvas");
        jpegCanvas.width = outputCanvas.width;
        jpegCanvas.height = outputCanvas.height;

        const ctx = jpegCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
        ctx.drawImage(outputCanvas, 0, 0);

        outputCanvas = jpegCanvas;
    }

    const blob = await canvasToBlob(outputCanvas, type);

    await navigator.clipboard.write([
        new ClipboardItem({
            [type]: blob,
        }),
    ]);

    return true;
}

export async function copyCanvasToClipboard(
    canvas,
    type = "image/png",
    options = {}
) {
    if (!canvas) {
        throw new Error("Canvas not found");
    }

    const outputCanvas = makeCanvasForType(canvas, type, options);
    const blob = await canvasToBlob(outputCanvas, type);

    await navigator.clipboard.write([
        new ClipboardItem({
            [type]: blob,
        }),
    ]);

    return true;
}

export async function copyCanvasAreaToClipboard(
    canvas,
    crop,
    type = "image/png",
    padding = 12,
    options = {}
) {
    if (!canvas) {
        throw new Error("Canvas not found");
    }

    if (!crop) {
        throw new Error("Crop area missing");
    }

    const sx = Math.max(0, crop.x - padding);
    const sy = Math.max(0, crop.y - padding);
    const sw = Math.min(canvas.width - sx, crop.w + padding * 2);
    const sh = Math.min(canvas.height - sy, crop.h + padding * 2);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = Math.max(1, sw);
    tempCanvas.height = Math.max(1, sh);

    const ctx = tempCanvas.getContext("2d");

    if (type === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const outputCanvas = createCanvasForExport(tempCanvas, options);
    const blob = await canvasToBlob(outputCanvas, type);

    await navigator.clipboard.write([
        new ClipboardItem({
            [type]: blob,
        }),
    ]);

    return true;
}

export async function copyTextToClipboard(text) {
    await navigator.clipboard.writeText(text || "");
    return true;
}

function makeCanvasForType(canvas, type, options = {}) {
    const exportCanvas = createCanvasForExport(canvas, options);

    if (type !== "image/jpeg") {
        return exportCanvas;
    }

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = exportCanvas.width;
    outputCanvas.height = exportCanvas.height;

    const ctx = outputCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.drawImage(exportCanvas, 0, 0);

    return outputCanvas;
}


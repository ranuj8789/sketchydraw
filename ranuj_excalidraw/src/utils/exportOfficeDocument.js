import { drawElement } from "./drawing";

const SCRIPT_CACHE = new Map();

function loadScript(src, globalName) {
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (SCRIPT_CACHE.has(src)) return SCRIPT_CACHE.get(src);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Could not load ${globalName || src}.`));
    document.head.appendChild(script);
  });
  SCRIPT_CACHE.set(src, promise);
  return promise;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function frameRows(frames = []) {
  const rows = [[
    "Frame", "Frame name", "Frame duration (ms)", "Gap after (ms)",
    "Object order", "Object type", "Object text", "X", "Y", "Width", "Height",
    "Animation", "Start delay (ms)", "Duration (ms)", "Dependency object", "Dependency mode",
    "Before start", "After end"
  ]];
  frames.forEach((frame, frameIndex) => {
    (frame?.elements || []).forEach((element, objectIndex) => {
      const a = element?.animation || {};
      rows.push([
        frameIndex + 1,
        frame?.name || `Frame ${frameIndex + 1}`,
        Number(frame?.durationMs) || 0,
        Number(frame?.gapAfterMs) || 0,
        objectIndex + 1,
        element?.type || "",
        safeText(element?.text || element?.name || ""),
        Number(element?.x) || 0,
        Number(element?.y) || 0,
        Number(element?.w) || 0,
        Number(element?.h) || 0,
        a.type || "none",
        Number(a.delayMs) || 0,
        Number(a.durationMs) || 0,
        a.dependsOnId || "",
        a.dependencyMode || "absolute",
        a.beforeStart || "hidden",
        a.afterEnd || "visible",
      ]);
    });
  });
  return rows;
}

function csvEscape(value) {
  const text = safeText(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportFramesToCSV(frames, fileName = "sketchydraw-frames.csv") {
  const csv = frameRows(frames).map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), fileName);
}

export async function exportFramesToExcel(frames, fileName = "sketchydraw-frames.xlsx") {
  const XLSX = await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", "XLSX");
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet(frameRows(frames));
  XLSX.utils.book_append_sheet(workbook, summary, "Storyboard");
  frames.forEach((frame, index) => {
    const rows = [["Order", "Type", "Text", "Animation", "Delay ms", "Duration ms"]];
    (frame?.elements || []).forEach((element, objectIndex) => rows.push([
      objectIndex + 1,
      element?.type || "",
      safeText(element?.text || element?.name || ""),
      element?.animation?.type || "none",
      Number(element?.animation?.delayMs) || 0,
      Number(element?.animation?.durationMs) || 0,
    ]));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, String(frame?.name || `Frame ${index + 1}`).slice(0, 31));
  });
  XLSX.writeFile(workbook, fileName);
}

function renderFrameToDataUrl(frame, canvasSize = {}, canvasProps = {}) {
  const width = Math.max(320, Number(canvasSize?.width) || 1200);
  const height = Math.max(240, Number(canvasSize?.height) || 700);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = canvasProps?.background || canvasProps?.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);
  (frame?.elements || []).forEach((element) => drawElement(ctx, element, false, { animationMode: false }));
  return canvas.toDataURL("image/png");
}

export async function exportFramesToPowerPoint({ frames = [], canvasSize, canvasProps, fileName = "sketchydraw.pptx" }) {
  const PptxGenJS = await loadScript("https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js", "PptxGenJS");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SketchyDraw";
  pptx.subject = "SketchyDraw storyboard";
  pptx.title = fileName.replace(/\.pptx$/i, "");
  pptx.company = "madebysketchydraw.com";
  const slideW = 13.333;
  const slideH = 7.5;
  (frames.length ? frames : [{ name: "Frame 1", elements: [] }]).forEach((frame, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    const data = renderFrameToDataUrl(frame, canvasSize, canvasProps);
    slide.addImage({ data, x: 0, y: 0, w: slideW, h: slideH });
    slide.addText("madebysketchydraw.com", {
      x: 10.7, y: 7.12, w: 2.35, h: 0.18,
      fontFace: "Arial", fontSize: 6, color: "8A8A8A", align: "right", margin: 0,
    });
    slide.addNotes?.(`Frame ${index + 1}: ${frame?.name || "Untitled"}. Duration ${Number(frame?.durationMs) || 0}ms.`);
  });
  await pptx.writeFile({ fileName });
}

import { useRef } from "react";
import {
    readDrawingJsonFile,
    loadDrawingJson,
    createDrawingJson,
    downloadDrawingJson,
} from "../canvas/drawingStorage";

import {
    exportCanvasToPNG,
    exportCanvasToJPEG,
    exportCanvasForInstagram,
    exportCanvasToSVG,
    exportCanvasToPDF,
    exportNotebookToPDF,
    printCanvas as printCanvasImage,
} from "../utils/exportBoard";

import { requireProAccess } from "../utils/proAccess";
import {
    detectOfficeImportType,
    importPowerPointFile,
    importSpreadsheetFile,
} from "../canvas/importOfficeDocument";
import { exportFramesToCSV, exportFramesToExcel, exportFramesToPowerPoint } from "../utils/exportOfficeDocument";

export function useSketchyBoardActions({
                                           elements = [],
                                           viewport,
                                           canvasSize,
                                           canvasProps,
                                           drawingTitle,
                                           setElements,
                                           setSelectedIds,
                                           setViewport,
                                           setCanvasSize,
                                           setCanvasProps,
                                           commitHistory,
                                           timelineFrames = [],
                                           currentFrameIndex = 0,
                                           onRestoreTimeline,
                                           socialCreatorPreset = null,
                                       }) {
    const canvasRef = useRef(null);
    const jsonInputRef = useRef(null);
    const importTypeRef = useRef("json");

    const safeTitle = drawingTitle || "sketchydraw";

    const exportPNG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        exportCanvasToPNG(
            canvas,
            `${safeTitle}.png`
        );
    };

    const exportInstagram = async (preset = socialCreatorPreset || "portrait") => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            await exportCanvasForInstagram(
                {
                    elements,
                    canvasProps,
                },
                `${safeTitle}-instagram-${preset}.png`,
                { preset }
            );
        } catch (error) {
            if (error?.name !== "AbortError") {
                console.error(error);
                alert(error?.message || "Could not export for Instagram.");
            }
        }
    };

    const exportJPEG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        exportCanvasToJPEG(
            canvas,
            `${safeTitle}.jpeg`
        );
    };

    const exportSVG = () => {
        exportCanvasToSVG(
            elements,
            canvasSize?.width || 1200,
            canvasSize?.height || 700,
            `${safeTitle}.svg`
        );
    };

    const exportPDF = () => {
        const canvas = canvasRef.current;

        if (canvasProps?.pattern === "notebook") {
            exportNotebookToPDF({
                elements,
                canvasProps,
                fileName: `${safeTitle}.pdf`,
            });
            return;
        }

        if (!canvas) return;

        exportCanvasToPDF(canvas, `${safeTitle}.pdf`);
    };

    const printCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        printCanvasImage(canvas, safeTitle);
    };

    const exportJSON = async () => {
        const allowed = await requireProAccess("Export JSON");

        if (!allowed) {
            return;
        }

        const json = createDrawingJson({
            elements,
            viewport,
            canvasSize,
            canvasProps,
            name: drawingTitle || "Untitled Drawing",
            frames: timelineFrames,
            activeFrameIndex: currentFrameIndex,
        });

        downloadDrawingJson(
            json,
            `${safeTitle}.json`
        );
    };


    const exportPPT = async () => {
        const allowed = await requireProAccess("Export PowerPoint");
        if (!allowed) return;
        try {
            await exportFramesToPowerPoint({
                frames: timelineFrames,
                canvasSize,
                canvasProps,
                fileName: `${safeTitle}.pptx`,
            });
        } catch (error) {
            console.error(error);
            alert(error?.message || "Could not export PowerPoint.");
        }
    };

    const exportExcel = async () => {
        const allowed = await requireProAccess("Export Excel");
        if (!allowed) return;
        try {
            await exportFramesToExcel(timelineFrames, `${safeTitle}.xlsx`);
        } catch (error) {
            console.error(error);
            alert(error?.message || "Could not export Excel.");
        }
    };

    const exportCSV = async () => {
        const allowed = await requireProAccess("Export CSV");
        if (!allowed) return;
        exportFramesToCSV(timelineFrames, `${safeTitle}.csv`);
    };

    const importDrawingJson = async (event) => {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) {
            return;
        }

        const detectedType = detectOfficeImportType(file);
        const requestedType = importTypeRef.current || detectedType;
        const importType = detectedType !== "unknown" ? detectedType : requestedType;
        const label = importType === "ppt" ? "Import PowerPoint" : importType === "excel" ? "Import Excel" : "Import JSON";
        const allowed = await requireProAccess(label);
        if (!allowed) return;

        try {
            if (importType === "ppt" || importType === "excel") {
                const frames = importType === "ppt"
                    ? await importPowerPointFile(file, canvasSize)
                    : await importSpreadsheetFile(file, canvasSize);
                if (!frames.length) throw new Error("The selected file did not contain any importable slides or sheets.");
                onRestoreTimeline?.(frames, 0);
                setElements(frames[0].elements || []);
                setSelectedIds([]);
                commitHistory?.(frames[0].elements || []);
                return;
            }

            const json = await readDrawingJsonFile(file);
            const loaded = loadDrawingJson(json);

            // Accept every JSON shape SketchyDraw has used:
            // { data: { frames } }, { frames }, { timelineFrames }, or loaded.frames.
            const actualDrawing = json?.data && typeof json.data === "object"
                ? json.data
                : json;
            const importedFrames = [
                loaded?.frames,
                actualDrawing?.frames,
                actualDrawing?.timelineFrames,
                json?.frames,
                json?.timelineFrames,
            ].find((candidate) => Array.isArray(candidate) && candidate.length) || [];

            const requestedFrameIndex = Number(
                loaded?.activeFrameIndex ??
                actualDrawing?.activeFrameIndex ??
                actualDrawing?.currentFrameIndex ??
                0
            ) || 0;

            if (importedFrames.length > 0 && typeof onRestoreTimeline === "function") {
                // Restore the timeline as the source of truth. Do not first replace it
                // with a one-frame canvas snapshot.
                onRestoreTimeline(importedFrames, requestedFrameIndex);
                console.info(`[SketchyDraw] Imported ${importedFrames.length} frames`);
            } else {
                const nextElements = loaded.elements || [];
                setElements(nextElements);
                commitHistory?.(nextElements);
                console.info("[SketchyDraw] Imported single-frame drawing");
            }

            setSelectedIds([]);

            if (loaded.viewport) {
                setViewport?.(loaded.viewport);
            }

            if (loaded.canvasSize) {
                setCanvasSize?.(loaded.canvasSize);
            }

            if (loaded.canvasProps) {
                setCanvasProps?.(loaded.canvasProps);
            }

        } catch (error) {
            alert(error?.message || "Could not import this file.");
            console.error(error);
        }
    };

    const openImportPicker = async (type = "json") => {
        const label = type === "ppt" ? "Import PowerPoint" : type === "excel" ? "Import Excel" : "Import JSON";
        const allowed = await requireProAccess(label);
        if (!allowed) return;
        importTypeRef.current = type;
        jsonInputRef.current?.click();
    };

    const openJsonPicker = () => openImportPicker("json");

    return {
        canvasRef,
        jsonInputRef,
        exportPNG,
        exportInstagram,
        exportJPEG,
        exportSVG,
        exportPDF,
        printCanvas,
        exportJSON,
        exportPPT,
        exportExcel,
        exportCSV,
        importDrawingJson,
        openJsonPicker,
        openImportPicker,
    };
}
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
    exportCanvasToSVG,
} from "../utils/exportBoard";

import { requireProAccess } from "../utils/proAccess";

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
                                       }) {
    const canvasRef = useRef(null);
    const jsonInputRef = useRef(null);

    const safeTitle = drawingTitle || "sketchydraw";

    const exportPNG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        exportCanvasToPNG(
            canvas,
            `${safeTitle}.png`
        );
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
        });

        downloadDrawingJson(
            json,
            `${safeTitle}.json`
        );
    };

    const importDrawingJson = async (event) => {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) {
            return;
        }

        const allowed = await requireProAccess("Import JSON");

        if (!allowed) {
            return;
        }

        try {
            const json = await readDrawingJsonFile(file);
            const loaded = loadDrawingJson(json);

            setElements(loaded.elements || []);
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

            commitHistory?.(loaded.elements || []);
        } catch (error) {
            alert("Invalid SketchyDraw JSON file");
            console.error(error);
        }
    };

    const openJsonPicker = async () => {
        const allowed = await requireProAccess("Import JSON");

        if (!allowed) {
            return;
        }

        jsonInputRef.current?.click();
    };

    return {
        canvasRef,
        jsonInputRef,
        exportPNG,
        exportJPEG,
        exportSVG,
        exportJSON,
        importDrawingJson,
        openJsonPicker,
    };
}
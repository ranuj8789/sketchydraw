import { useRef } from "react";
import {
    readDrawingJsonFile,
    loadDrawingJson,
    createDrawingJson,
    downloadDrawingJson,
} from "../canvas/drawingStorage";
import {
    exportCanvasToSVG,
} from "../utils/exportBoard";

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

    const exportPNG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = `${drawingTitle || "sketchydraw"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    const exportJPEG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = `${drawingTitle || "sketchydraw"}.jpeg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
    };

    const exportSVG = () => {
        exportCanvasToSVG(
            elements,
            canvasSize?.width || 1200,
            canvasSize?.height || 700,
            `${drawingTitle || "sketchydraw"}.svg`
        );
    };

    const exportJSON = () => {
        const json = createDrawingJson({
            elements,
            viewport,
            canvasSize,
            canvasProps,
            name: drawingTitle || "Untitled Drawing",
        });

        downloadDrawingJson(
            json,
            `${drawingTitle || "sketchydraw"}.json`
        );
    };

    const importDrawingJson = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const json = await readDrawingJsonFile(file);
            const loaded = loadDrawingJson(json);

            setElements(loaded.elements);
            setSelectedIds([]);
            setViewport?.(loaded.viewport);
            setCanvasSize?.(loaded.canvasSize);

            if (loaded.canvasProps) {
                setCanvasProps?.(loaded.canvasProps);
            }

            commitHistory(loaded.elements);
        } catch (error) {
            alert("Invalid SketchyDraw JSON file");
            console.error(error);
        } finally {
            event.target.value = "";
        }
    };

    const openJsonPicker = () => {
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
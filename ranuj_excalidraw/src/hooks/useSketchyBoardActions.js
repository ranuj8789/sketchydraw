import { useRef } from "react";
import {
    readDrawingJsonFile,
    loadDrawingJson,
} from "../canvas/drawingStorage";

export function useSketchyBoardActions({
                                           setElements,
                                           setSelectedIds,
                                           setViewport,
                                           setCanvasSize,
                                           commitHistory,
                                       }) {
    const canvasRef = useRef(null);
    const jsonInputRef = useRef(null);

    const exportPNG = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = "drawing-board.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
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
            commitHistory(loaded.elements);
        } catch (error) {
            alert("Invalid drawing JSON file");
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
        importDrawingJson,
        openJsonPicker,
    };
}
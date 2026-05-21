import { useEffect } from "react";
import { renderCanvas } from "./canvasRender";

export function useCanvasRender({
                                    canvasRef,
                                    canvasSize,
                                    elements,
                                    selectedIds,
                                    connectionHint,
                                    alignmentGuides = [],
                                    viewport,
                                    showGrid = true,
                                    canvasProps = {},
                                }) {
    useEffect(() => {
        renderCanvas({
            canvas: canvasRef.current,
            canvasSize,
            elements,
            selectedIds,
            connectionHint,
            alignmentGuides,
            viewport,
            showGrid,
            canvasProps,
        });
    }, [
        canvasRef,
        canvasSize,
        elements,
        selectedIds,
        connectionHint,
        alignmentGuides,
        viewport,
        showGrid,
        canvasProps,
    ]);
}
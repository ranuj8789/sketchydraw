import { useEffect } from "react";
import { renderCanvas } from "./canvasRender";

export function useCanvasRender({
                                    canvasRef,
                                    canvasSize,
                                    elements,
                                    selectedIds,
                                    connectionHint,
                                    viewport,
                                }) {
    useEffect(() => {
        renderCanvas({
            canvas: canvasRef.current,
            canvasSize,
            elements,
            selectedIds,
            connectionHint,
            viewport,
        });
    }, [canvasRef, canvasSize, elements, selectedIds, connectionHint, viewport]);
}
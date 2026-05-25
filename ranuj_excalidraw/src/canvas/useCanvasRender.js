import { useEffect, useRef } from "react";
import { renderCanvas } from "./canvasRender";

/**
 * Renders canvas on requestAnimationFrame instead of synchronously inside React.
 * This coalesces many fast state updates into one paint per browser frame.
 */
export function useCanvasRender({
                                    canvasRef,
                                    canvasSize,
                                    elements,
                                    selectedIds,
                                    connectionHint,
                                    alignmentGuides = [],
                                    highlightedElementIds = [],
                                    viewport,
                                    showGrid = true,
                                    canvasProps = {},
                                }) {
    const frameRef = useRef(null);
    const latestPayloadRef = useRef(null);

    useEffect(() => {
        latestPayloadRef.current = {
            canvas: canvasRef.current,
            canvasSize,
            elements,
            selectedIds,
            connectionHint,
            alignmentGuides,
            highlightedElementIds,
            viewport,
            showGrid,
            canvasProps,
        };

        if (frameRef.current !== null) {
            return;
        }

        frameRef.current = window.requestAnimationFrame(() => {
            frameRef.current = null;

            if (latestPayloadRef.current) {
                renderCanvas(latestPayloadRef.current);
            }
        });

        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [
        canvasRef,
        canvasSize,
        elements,
        selectedIds,
        connectionHint,
        alignmentGuides,
        highlightedElementIds,
        viewport,
        showGrid,
        canvasProps,
    ]);
}

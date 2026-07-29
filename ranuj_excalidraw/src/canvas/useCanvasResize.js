import { useEffect } from "react";
import { getCanvasSizeFromWrapper } from "./canvasHelpers";

export function useCanvasResize(wrapRef, setCanvasSize) {
    useEffect(() => {
        const node = wrapRef.current;
        if (!node) return undefined;

        let animationFrame = null;
        const updateSize = () => {
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(() => {
                const nextSize = getCanvasSizeFromWrapper(node);
                setCanvasSize((current) => {
                    if (current?.width === nextSize.width && current?.height === nextSize.height) {
                        return current;
                    }
                    return nextSize;
                });
            });
        };

        updateSize();

        const resizeObserver = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(updateSize)
            : null;
        resizeObserver?.observe(node);
        window.addEventListener("resize", updateSize);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateSize);
            if (animationFrame) window.cancelAnimationFrame(animationFrame);
        };
    }, [wrapRef, setCanvasSize]);
}

import { useEffect } from "react";
import { getCanvasSizeFromWrapper } from "./canvasHelpers";

export function useCanvasResize(wrapRef, setCanvasSize) {
    useEffect(() => {
        const handleResize = () => {
            setCanvasSize(getCanvasSizeFromWrapper(wrapRef.current));
        };

        handleResize();
        window.addEventListener("resize", handleResize);

        return () => window.removeEventListener("resize", handleResize);
    }, [wrapRef, setCanvasSize]);
}
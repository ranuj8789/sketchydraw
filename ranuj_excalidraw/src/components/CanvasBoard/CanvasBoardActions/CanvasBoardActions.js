import React, {useEffect} from "react";
import "./CanvasBoardActions.css";
import {clampZoom} from "../../../canvas/canvasViewport";
import {requireProAccess} from "../../../utils/proAccess";

export default function CanvasBoardActions({
                                               viewport,
                                               setViewport,
                                               onExport,
                                               canvasRef,
                                               drawingTitle = "Untitled",
                                               onDrawingTitleChange,
                                               saveCurrentDrawing,
                                               openMyDrawings,
                                               importDrawingJson,
                                               animationSpeed,
                                               setAnimationSpeed,
                                               animationSpeedOptions = [],
                                               downloadUndoRedoVideo,
                                               isVideoExporting,
                                               videoExportProgress,
                                           }) {
    useEffect(() => {
        const handleSaveDrawing = (event) => {
            saveCurrentDrawing?.({
                saveAsNew: event.detail?.saveAsNew === true,
            });
        };

        const handleOpenMyDrawings = async () => {
            const allowed = await requireProAccess("My Drawings");
            if (!allowed) return;

            openMyDrawings?.();
        };

        window.addEventListener("sketchydraw:save-drawing", handleSaveDrawing);
        window.addEventListener("sketchydraw:open-my-drawings", handleOpenMyDrawings);

        return () => {
            window.removeEventListener("sketchydraw:save-drawing", handleSaveDrawing);
            window.removeEventListener("sketchydraw:open-my-drawings", handleOpenMyDrawings);
        };
    }, [saveCurrentDrawing, openMyDrawings]);

    const resetViewport = () => {
        setViewport({
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
        });
    };

    return (
        <>
            <div className="canvas-zoom-floating">
                <div className="zoom-control">
                    <button
                        className="zoom-btn"
                        type="button"
                        onClick={() =>
                            setViewport((v) => ({
                                ...v,
                                zoom: clampZoom(v.zoom * 0.9),
                            }))
                        }
                    >
                        −
                    </button>

                    <span
                        className="zoom-value"
                        onClick={() =>
                            setViewport((v) => ({
                                ...v,
                                zoom: 1,
                            }))
                        }
                        title="Click to reset zoom"
                    >
                        {Math.round(viewport.zoom * 100)}%
                    </span>

                    <button
                        className="zoom-btn"
                        type="button"
                        onClick={() =>
                            setViewport((v) => ({
                                ...v,
                                zoom: clampZoom(v.zoom * 1.1),
                            }))
                        }
                    >
                        +
                    </button>
                </div>

                <button
                    className="reset-btn"
                    type="button"
                    onClick={resetViewport}
                >
                    Reset
                </button>
            </div>
        </>
    );
}
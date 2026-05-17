import React, { useEffect } from "react";
import "./CanvasBoardActions.css";
import { clampZoom } from "../../../canvas/canvasViewport";
import { requireProAccess } from "../../../utils/proAccess";

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

    const handleDownloadVideo = async () => {
        const allowed = await requireProAccess("Video export");
        if (!allowed) return;

        downloadUndoRedoVideo?.();
    };

    return (
        <div className="canvas-actions">
            <div className="drawing-name-field">
                <span>Drawing</span>

                <input
                    type="text"
                    value={drawingTitle}
                    onChange={(e) => onDrawingTitleChange?.(e.target.value)}
                    placeholder="Untitled"
                    title="Drawing name"
                />
            </div>

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
                onClick={() =>
                    setViewport({
                        zoom: 1,
                        offsetX: 0,
                        offsetY: 0,
                    })
                }
            >
                Reset
            </button>

            {/*<button*/}
            {/*    className="export-btn"*/}
            {/*    type="button"*/}
            {/*    onClick={() => onExport?.(canvasRef.current)}*/}
            {/*>*/}
            {/*    Export*/}
            {/*</button>*/}

            {/*<label className="export-btn open-json-btn">*/}
            {/*    Open JSON*/}
            {/*    <input*/}
            {/*        type="file"*/}
            {/*        accept="application/json"*/}
            {/*        onChange={importDrawingJson}*/}
            {/*        style={{ display: "none" }}*/}
            {/*    />*/}
            {/*</label>*/}

            {/*<select*/}
            {/*    className="animation-speed-select"*/}
            {/*    value={animationSpeed}*/}
            {/*    onChange={(e) => setAnimationSpeed(e.target.value)}*/}
            {/*    title="Animation speed"*/}
            {/*>*/}
            {/*    {animationSpeedOptions.map((option) => (*/}
            {/*        <option key={option.value} value={option.value}>*/}
            {/*            {option.label}*/}
            {/*        </option>*/}
            {/*    ))}*/}
            {/*</select>*/}

            {/*<button*/}
            {/*    className="export-btn video-btn"*/}
            {/*    type="button"*/}
            {/*    onClick={handleDownloadVideo}*/}
            {/*    disabled={isVideoExporting}*/}
            {/*    title="Pro feature"*/}
            {/*>*/}
            {/*    {isVideoExporting*/}
            {/*        ? `Processing ${videoExportProgress}%`*/}
            {/*        : "Download Video PRO"}*/}
            {/*</button>*/}
        </div>
    );
}

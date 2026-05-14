import React from "react";
import { clampZoom } from "../../canvas/canvasViewport";

export default function CanvasBoardActions({
                                               viewport,
                                               setViewport,
                                               onExport,
                                               canvasRef,
                                               saveCurrentDrawing,
                                               isSavingDrawing,
                                               importDrawingJson,
                                               animationSpeed,
                                               setAnimationSpeed,
                                               animationSpeedOptions,
                                               downloadUndoRedoVideo,
                                               isVideoExporting,
                                               videoExportProgress,
                                           }) {
    return (
        <div className="canvas-actions">
            <div className="zoom-control">
                <button
                    className="zoom-btn"
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

            <button
                className="export-btn"
                onClick={() => onExport(canvasRef.current)}
            >
                Export
            </button>

            <button
                className="export-btn"
                onClick={saveCurrentDrawing}
                disabled={isSavingDrawing}
            >
                {isSavingDrawing ? "Saving..." : "Save Drawing"}
            </button>

            <label className="export-btn">
                Open JSON
                <input
                    type="file"
                    accept="application/json"
                    onChange={importDrawingJson}
                    style={{ display: "none" }}
                />
            </label>

            <select
                className="animation-speed-select"
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(e.target.value)}
                title="Animation speed"
            >
                {animationSpeedOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            <button
                className="export-btn"
                onClick={downloadUndoRedoVideo}
                disabled={isVideoExporting}
            >
                {isVideoExporting
                    ? `Processing ${videoExportProgress}%`
                    : "Download Video"}
            </button>
        </div>
    );
}
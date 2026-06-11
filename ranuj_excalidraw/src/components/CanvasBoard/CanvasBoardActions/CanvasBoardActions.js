import React, { useEffect, useState } from "react";
import "./CanvasBoardActions.css";
import { clampZoom } from "../../../canvas/canvasViewport";
import { requireProAccess } from "../../../utils/proAccess";
import CanvasWalkthroughMap from "./CanvasWalkthroughMap";
import {
    DEFAULT_NOTEBOOK_PAGE_COUNT,
    DEFAULT_NOTEBOOK_PAGE_HEIGHT,
    DEFAULT_NOTEBOOK_PAGE_WIDTH,
    MAX_NOTEBOOK_PAGE_COUNT,
    MAX_NOTEBOOK_PAGE_HEIGHT,
    MAX_NOTEBOOK_PAGE_WIDTH,
    MIN_NOTEBOOK_PAGE_HEIGHT,
    MIN_NOTEBOOK_PAGE_WIDTH,
} from "../../../canvas/notebook/notebookPageConstants";
import {
    getNotebookPageCount,
    getNotebookPageSize,
} from "../../../canvas/notebook/notebookPages";

export default function CanvasBoardActions({
                                               viewport,
                                               setViewport,
                                               saveCurrentDrawing,
                                               openMyDrawings,

                                               elements = [],
                                               selectedIds = [],
                                               canvasSize,
                                               showGrid,
                                               canvasProps,
                                               setCanvasProps,
                                           }) {
    const [canvasMapOpen, setCanvasMapOpen] = useState(false);

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

    const isNotebook = canvasProps?.pattern === "notebook";
    const notebookPageCount = getNotebookPageCount(canvasProps);
    const notebookCurrentPageIndex = Math.max(
        0,
        Math.min(notebookPageCount - 1, Number(canvasProps?.currentPageIndex || 0))
    );
    const notebookPageViewMode = canvasProps?.pageViewMode || "single";
    const notebookPageSize = getNotebookPageSize(canvasProps);

    const updateNotebookProps = (patch) => {
        setCanvasProps?.((prev) => ({
            ...(prev || {}),
            pattern: "notebook",
            pageMode: true,
            ...patch,
        }));
    };

    const focusNotebookPage = (pageIndex, direction = "next", zoom = viewport?.zoom || 1) => {
        const nextPageIndex = Math.max(0, Math.min(notebookPageCount - 1, pageIndex));

        updateNotebookProps({
            pageViewMode: "single",
            currentPageIndex: nextPageIndex,
        });

        window.dispatchEvent(
            new CustomEvent("sketchydraw:notebook-page-focus", {
                detail: {
                    pageIndex: nextPageIndex,
                    direction,
                    zoom,
                },
            })
        );
    };

    const addNotebookPage = () => {
        const nextPageCount = Math.min(MAX_NOTEBOOK_PAGE_COUNT, notebookPageCount + 1);
        const nextPageIndex = nextPageCount - 1;

        updateNotebookProps({
            pageCount: nextPageCount,
            pageViewMode: "single",
            currentPageIndex: nextPageIndex,
        });

        window.dispatchEvent(
            new CustomEvent("sketchydraw:notebook-page-added", {
                detail: {
                    pageIndex: nextPageIndex,
                    direction: "next",
                    zoom: 1,
                },
            })
        );
    };

    const toggleShowAllPages = () => {
        const nextMode = notebookPageViewMode === "all" ? "single" : "all";

        updateNotebookProps({
            pageViewMode: nextMode,
        });

        if (nextMode === "single") {
            window.dispatchEvent(
                new CustomEvent("sketchydraw:notebook-page-focus", {
                    detail: {
                        pageIndex: notebookCurrentPageIndex,
                        direction: "next",
                        zoom: viewport?.zoom || 1,
                    },
                })
            );
        } else {
            window.dispatchEvent(new Event("sketchydraw:notebook-center"));
        }
    };

    const changeNotebookSize = (field, value) => {
        const min = field === "pageWidth" ? MIN_NOTEBOOK_PAGE_WIDTH : MIN_NOTEBOOK_PAGE_HEIGHT;
        const max = field === "pageWidth" ? MAX_NOTEBOOK_PAGE_WIDTH : MAX_NOTEBOOK_PAGE_HEIGHT;
        const fallback = field === "pageWidth" ? DEFAULT_NOTEBOOK_PAGE_WIDTH : DEFAULT_NOTEBOOK_PAGE_HEIGHT;
        const numeric = Number(value);
        const nextValue = Number.isFinite(numeric)
            ? Math.max(min, Math.min(max, Math.floor(numeric)))
            : fallback;

        updateNotebookProps({
            [field]: nextValue,
        });

        window.setTimeout(() => {
            window.dispatchEvent(new Event("sketchydraw:notebook-center"));
        }, 0);
    };

    const resetViewport = () => {
        if (isNotebook) {
            focusNotebookPage(notebookCurrentPageIndex, "next", 1);
            return;
        }

        setViewport({
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
        });

        setCanvasMapOpen(true);
    };

    return (
        <>
            {isNotebook && (
                <div className="notebook-page-controls">
                    <button
                        type="button"
                        onClick={() => focusNotebookPage(notebookCurrentPageIndex - 1, "prev")}
                        disabled={notebookCurrentPageIndex <= 0}
                        title="Previous page"
                    >
                        ← Previous
                    </button>

                    <strong>
                        Page {notebookCurrentPageIndex + 1} / {notebookPageCount}
                    </strong>

                    <button
                        type="button"
                        onClick={() => focusNotebookPage(notebookCurrentPageIndex + 1, "next")}
                        disabled={notebookCurrentPageIndex >= notebookPageCount - 1}
                        title="Next page"
                    >
                        Next →
                    </button>

                    <button type="button" onClick={toggleShowAllPages}>
                        {notebookPageViewMode === "all" ? "Single page" : "Show all pages"}
                    </button>

                    <button type="button" onClick={addNotebookPage}>
                        + Add page
                    </button>

                    <label>
                        W
                        <input
                            type="number"
                            min={MIN_NOTEBOOK_PAGE_WIDTH}
                            max={MAX_NOTEBOOK_PAGE_WIDTH}
                            value={notebookPageSize.width}
                            onChange={(event) => changeNotebookSize("pageWidth", event.target.value)}
                        />
                    </label>

                    <label>
                        H
                        <input
                            type="number"
                            min={MIN_NOTEBOOK_PAGE_HEIGHT}
                            max={MAX_NOTEBOOK_PAGE_HEIGHT}
                            value={notebookPageSize.height}
                            onChange={(event) => changeNotebookSize("pageHeight", event.target.value)}
                        />
                    </label>
                </div>
            )}

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
                        title="Zoom out"
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
                        title="Zoom in"
                    >
                        +
                    </button>
                </div>

                <button
                    className="reset-btn"
                    type="button"
                    onClick={resetViewport}
                    title="Reset canvas to 100% and open canvas map"
                >
                    Reset
                </button>
            </div>

            <CanvasWalkthroughMap
                open={canvasMapOpen}
                onClose={() => setCanvasMapOpen(false)}
                elements={elements}
                selectedIds={selectedIds}
                viewport={viewport}
                setViewport={setViewport}
                canvasSize={canvasSize}
                showGrid={showGrid}
                canvasProps={canvasProps}
            />
        </>
    );
}
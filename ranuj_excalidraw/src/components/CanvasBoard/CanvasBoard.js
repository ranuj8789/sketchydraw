import React, { useEffect, useRef, useState } from "react";
import TextEditor from "./../TextEditor";
import { getPointerPosition } from "../../utils/geometry";
import { findBindableShapeNearPoint } from "../../canvas/canvasConnectionHelpers";
import { exportUndoRedoAnimationVideo } from "../../canvas/exportAnimationVideo";
import {
    createDrawingJson,
    readDrawingJsonFile,
    loadDrawingJson,
} from "../../canvas/drawingStorage";
import {
    getElementBounds,
    getResizeHandleAtPoint,
} from "../../utils/elementBounds";
import { resizeElement } from "../../utils/resize";
import {
    AUTO_SELECT_TYPES,
    SHAPE_TYPES,
    LINE_TYPES,
    TEXT_CONTAINER_TYPES,
} from "../../canvas/canvasConstants";
import {
    buildShapeDraft,
    buildLineDraft,
    buildPencilDraft,
} from "../../canvas/canvasFactories";
import {
    moveElement,
    updateDrawnElement,
} from "../../canvas/canvasElementOps";
import {
    findTopElementAtPoint,
    getCurveHandleAtPoint,
} from "../../canvas/canvasHelpers";
import {
    normalizeSelectionRect,
    rectsIntersect,
} from "../../canvas/canvasBoardUtils";
import { getCursorForHandle } from "../../canvas/canvasCursor";
import {
    createTextElementHelper,
    updateTextElementHelper,
} from "../../canvas/canvasText";
import {
    applyArrowStartBinding,
    updateArrowDuringDraw,
    finalizeArrowBinding,
    moveConnectedArrows,
} from "../../canvas/canvasArrowBindings";
import { useCanvasResize } from "../../canvas/useCanvasResize";
import { useCanvasRender } from "../../canvas/useCanvasRender";
import { useCanvasKeyboardShortcuts } from "../../canvas/useCanvasKeyboardShortcuts";
import { screenToWorld, clampZoom } from "../../canvas/canvasViewport";
import BoardContextMenu from "../BoardContextMenu";
import {
    exportCanvasToPDF,
    exportCanvasToSVG,
    exportCanvasToPNG,
} from "../../utils/exportBoard";
import { isLoggedIn, getUser,isPaidUser } from "../../utils/auth";
import { saveDrawing } from "../../api/drawingApi";

export default function CanvasBoard({
                                        tool,
                                        setTool,
                                        stroke,
                                        elements,
                                        setElements,
                                        selectedIds,
                                        setSelectedIds,
                                        commitHistory,
                                        onExport,
                                        history
                                    }) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);

    const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 700 });
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
    });
    const [dragState, setDragState] = useState(null);
    const [isSavingDrawing, setIsSavingDrawing] = useState(false);
    const [editor, setEditor] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [clipboard, setClipboard] = useState([]);
    const [connectionHint, setConnectionHint] = useState(null);
    const [animationSpeed, setAnimationSpeed] = useState("normal");
    const [isVideoExporting, setIsVideoExporting] = useState(false);
    const [videoExportProgress, setVideoExportProgress] = useState(0);
    const videoExportingRef = useRef(false);

    const [viewport, setViewport] = useState({
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
    });

    const [isSpacePressed, setIsSpacePressed] = useState(false);

    useCanvasResize(wrapRef, setCanvasSize);

    const renderElements =
        editor?.mode === "edit" && editor?.id
            ? elements.filter((el) => el.id !== editor.id)
            : elements;

    const renderSelectedIds =
        editor?.mode === "edit" && editor?.id
            ? selectedIds.filter((id) => id !== editor.id)
            : selectedIds;

    useCanvasRender({
        canvasRef,
        canvasSize,
        elements: renderElements,
        selectedIds: renderSelectedIds,
        connectionHint,
        viewport,
    });

    useCanvasKeyboardShortcuts({
        editor,
        selectedIds,
        elements,
        clipboard,
        setClipboard,
        setElements,
        setSelectedIds,
        commitHistory,
    });

    useEffect(() => {
        const onKeyDown = (e) => {
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target?.isContentEditable;

            if (isTyping) return;

            if (e.code === "Space") {
                e.preventDefault();
                setIsSpacePressed(true);
            }

            if (e.key === "Escape") {
                closeContextMenu();
            }
        };

        const onKeyUp = (e) => {
            const isTyping =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target?.isContentEditable;

            if (isTyping) return;

            if (e.code === "Space") {
                setIsSpacePressed(false);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    useEffect(() => {
        const handleWindowMouseUp = () => {
            setDragState((prev) => {
                if (!prev) return prev;
                return null;
            });

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = isSpacePressed ? "grab" : "default";
            }

            setSelectionBox(null);
            setConnectionHint(null);
        };

        window.addEventListener("mouseup", handleWindowMouseUp);
        return () => window.removeEventListener("mouseup", handleWindowMouseUp);
    }, [isSpacePressed]);

    const updateElement = (id, updater) => {
        setElements((prev) => prev.map((el) => (el.id === id ? updater(el) : el)));
    };

    const exportDrawingJson = async () => {
        if (!isLoggedIn()) {
            alert("Please login first to save your drawing.");
            return;
        }

        if (!isPaidUser()) {
            alert("Active subscription required to save drawings.");
            // better: setSubscriptionOpen(true);
            return;
        }

        if (isSavingDrawing) {
            return;
        }

        const user = getUser();

        const title =
            prompt("Enter drawing title", `Drawing ${new Date().toLocaleString()}`) ||
            "Untitled Drawing";

        const localDrawingJson = createDrawingJson({
            elements,
            viewport,
            canvasSize,
            name: title,
        });

        const drawingPayload = {
            version: 1,
            app: "SketchyDraw",
            title,
            userEmail: user?.email,
            data: localDrawingJson,
            savedAt: new Date().toISOString(),
        };

        setIsSavingDrawing(true);

        try {
            const saved = await saveDrawing({
                title,
                drawingJson: JSON.stringify(drawingPayload),
            });

            alert(`Drawing saved successfully. ID: ${saved.id}`);
        } catch (error) {
            console.error("Drawing save failed:", error);
            alert(error?.message || "Failed to save drawing.");
        } finally {
            setIsSavingDrawing(false);
        }
    };

    const ANIMATION_SPEED_OPTIONS = [
        {
            value: "slow",
            label: "Slow",
            frameDelayMs: 800,
        },
        {
            value: "normal",
            label: "Normal",
            frameDelayMs: 450,
        },
        {
            value: "fast",
            label: "Fast",
            frameDelayMs: 220,
        },
        {
            value: "superFast",
            label: "Super Fast",
            frameDelayMs: 100,
        },
    ];

    const downloadUndoRedoVideo = async () => {
        if (videoExportingRef.current) return;

        const selectedSpeed =
            ANIMATION_SPEED_OPTIONS.find(
                (option) => option.value === animationSpeed
            ) || ANIMATION_SPEED_OPTIONS[1];

        videoExportingRef.current = true;
        setIsVideoExporting(true);
        setVideoExportProgress(0);

        try {
            await exportUndoRedoAnimationVideo({
                historyStates: history || [],
                currentElements: elements,
                canvasSize,
                fileName: `sketchy-animation-${selectedSpeed.value}.webm`,
                fps: 30,
                frameDelayMs: selectedSpeed.frameDelayMs,
                onProgress: (progress) => {
                    setVideoExportProgress(progress);
                },
            });
        } catch (error) {
            console.error("Video export failed:", error);
            alert("Video export failed. Check browser console.");
        } finally {
            videoExportingRef.current = false;
            setIsVideoExporting(false);
            setVideoExportProgress(0);
        }
    };

    const handleBoardRightClick = (e) => {
        e.preventDefault();

        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const closeContextMenu = () => {
        setContextMenu({
            visible: false,
            x: 0,
            y: 0,
        });
    };

    const createTextElement = ({ x, y, text, stroke, parentId = null }) => {
        createTextElementHelper({
            elements,
            setElements,
            setSelectedIds,
            commitHistory,
            x,
            y,
            text,
            stroke,
            parentId,
        });

        setTool("select");
    };

    const updateTextElement = (id, value) => {
        updateTextElementHelper({
            elements,
            setElements,
            setSelectedIds,
            commitHistory,
            id,
            value,
        });

        setTool("select");
    };

    const startResize = (target, handle, point) => {
        const bounds = getElementBounds(target);

        setSelectedIds([target.id]);
        setDragState({
            mode: "resize",
            id: target.id,
            handle,
            startX: point.x,
            startY: point.y,
            originalX: bounds?.x || 0,
            originalY: bounds?.y || 0,
            originalW: bounds?.w || 0,
            originalH: bounds?.h || 0,
            originalX1: target.x1,
            originalY1: target.y1,
            originalX2: target.x2,
            originalY2: target.y2,
        });
    };

    const startMove = (target, point) => {
        const idsToMove = selectedIds.includes(target.id) ? selectedIds : [target.id];

        setSelectedIds(idsToMove);
        setDragState({
            mode: "move",
            ids: idsToMove,
            startX: point.x,
            startY: point.y,
        });
    };

    const startTextCreate = (point, parentId = null, forcedStroke = stroke) => {
        setSelectedIds([]);
        setDragState(null);

        setEditor({
            mode: "create",
            x: point.x,
            y: point.y,
            value: "",
            stroke: forcedStroke,
            parentId,
        });
    };

    const startMarqueeSelection = (point) => {
        setSelectedIds([]);
        setSelectionBox({
            x: point.x,
            y: point.y,
            w: 0,
            h: 0,
        });

        setDragState({
            mode: "marquee",
            startX: point.x,
            startY: point.y,
        });
    };

    const handleSelectModeMouseDown = (point) => {
        if (selectedIds.length === 1) {
            const selectedElementObj = elements.find((el) => el.id === selectedIds[0]);
            const selectedHandle = getResizeHandleAtPoint(
                selectedElementObj,
                point.x,
                point.y
            );

            if (selectedElementObj && selectedHandle) {
                startResize(selectedElementObj, selectedHandle, point);
                return;
            }
        }

        const target = findTopElementAtPoint(elements, point);

        if (!target) {
            startMarqueeSelection(point);
            return;
        }

        if (target.type === "text") {
            startMove(target, point);
            return;
        }

        const handle = getResizeHandleAtPoint(target, point.x, point.y);

        if (handle && target.type !== "pencil") {
            startResize(target, handle, point);
            return;
        }

        startMove(target, point);
    };

    const handleDrawModeMouseDown = (point) => {
        let draft = null;

        if (SHAPE_TYPES.has(tool)) {
            draft = buildShapeDraft(tool, point, stroke);
        } else if (LINE_TYPES.has(tool)) {
            draft = buildLineDraft(tool, point, stroke, "straight");
        } else if (tool === "pencil") {
            draft = buildPencilDraft(point, stroke);
        }

        if (!draft) return;

        const finalDraft = applyArrowStartBinding({
            draft,
            tool,
            elements,
            point,
        });

        setElements((prev) => [...prev, finalDraft]);
        setSelectedIds([finalDraft.id]);
        setDragState({
            mode: "draw",
            id: finalDraft.id,
            startX: point.x,
            startY: point.y,
        });
    };

    const importDrawingJson = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const json = await readDrawingJsonFile(file);
            const loaded = loadDrawingJson(json);

            setElements(loaded.elements);
            setSelectedIds([]);
            setViewport(loaded.viewport);
            setCanvasSize(loaded.canvasSize);
            commitHistory(loaded.elements);
        } catch (error) {
            alert("Invalid drawing JSON file");
            console.error(error);
        } finally {
            event.target.value = "";
        }
    };

    const onMouseDown = (event) => {
        closeContextMenu();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rawPoint = getPointerPosition(event, canvas);
        const point = screenToWorld(rawPoint, viewport);

        if (event.button === 1) {
            event.preventDefault();
            setDragState({
                mode: "pan",
                startScreenX: rawPoint.x,
                startScreenY: rawPoint.y,
            });
            canvas.style.cursor = "grab";
            return;
        }

        if (isSpacePressed && event.button === 0) {
            setDragState({
                mode: "pan",
                startScreenX: rawPoint.x,
                startScreenY: rawPoint.y,
            });
            canvas.style.cursor = "grab";
            return;
        }

        if (event.button !== 0) return;
        if (event.detail === 2) return;

        if (tool === "eraser") {
            const target = findTopElementAtPoint(elements, point);
            if (!target) return;

            const next = elements.filter((el) => el.id !== target.id);
            setElements(next);
            setSelectedIds([]);
            commitHistory(next);
            return;
        }

        if (tool === "select") {
            if (selectedIds.length === 1) {
                const el = elements.find((e) => e.id === selectedIds[0]);

                if (el?.type === "line" || el?.type === "arrow") {
                    const handle = getCurveHandleAtPoint(el, point, viewport.zoom);

                    if (handle) {
                        setDragState({
                            mode: "curve-handle",
                            id: el.id,
                            handle,
                        });
                        return;
                    }
                }
            }

            handleSelectModeMouseDown(point);
            return;
        }

        handleDrawModeMouseDown(point);
    };

    const onMouseMove = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rawPoint = getPointerPosition(event, canvas);
        const point = screenToWorld(rawPoint, viewport);

        if (!dragState && isSpacePressed) {
            canvas.style.cursor = "grab";
        }

        if (!dragState && tool === "select" && !isSpacePressed) {
            let cursor = "default";

            if (selectedIds.length === 1) {
                const selectedElementObj = elements.find((el) => el.id === selectedIds[0]);

                if (selectedElementObj?.type === "line" || selectedElementObj?.type === "arrow") {
                    const curveHandle = getCurveHandleAtPoint(
                        selectedElementObj,
                        point,
                        viewport.zoom
                    );

                    if (curveHandle) {
                        cursor = "pointer";
                    } else {
                        const handle = getResizeHandleAtPoint(
                            selectedElementObj,
                            point.x,
                            point.y
                        );

                        if (handle) {
                            cursor = getCursorForHandle(handle);
                        } else {
                            const target = findTopElementAtPoint(elements, point);
                            if (target) cursor = "move";
                        }
                    }
                } else {
                    const handle = selectedElementObj
                        ? getResizeHandleAtPoint(selectedElementObj, point.x, point.y)
                        : null;

                    if (handle) {
                        cursor = getCursorForHandle(handle);
                    } else {
                        const target = findTopElementAtPoint(elements, point);
                        if (target) cursor = "move";
                    }
                }
            } else {
                const target = findTopElementAtPoint(elements, point);
                if (target) cursor = "move";
            }

            canvas.style.cursor = cursor;
        }

        if (!dragState) return;

        if (dragState.mode === "curve-handle") {
            canvas.style.cursor = "pointer";

            const movingEndpoint =
                dragState.handle === "start" || dragState.handle === "end";

            let snapPoint = point;
            let snapShapeId = null;

            if (movingEndpoint) {
                const hint = findBindableShapeNearPoint(elements, point, 18);

                if (hint) {
                    snapPoint = hint.point;
                    snapShapeId = hint.shapeId;
                    setConnectionHint({
                        shapeId: hint.shapeId,
                        bindPoint: hint.point,
                    });
                } else {
                    setConnectionHint(null);
                }
            } else {
                setConnectionHint(null);
            }

            updateElement(dragState.id, (el) => {
                if (!el || (el.type !== "line" && el.type !== "arrow")) return el;

                if (dragState.handle === "start") {
                    return {
                        ...el,
                        x1: snapPoint.x,
                        y1: snapPoint.y,
                        ...(el.type === "arrow"
                            ? {
                                startBinding: snapShapeId
                                    ? { elementId: snapShapeId }
                                    : null,
                            }
                            : {}),
                    };
                }

                if (dragState.handle === "end") {
                    return {
                        ...el,
                        x2: snapPoint.x,
                        y2: snapPoint.y,
                        ...(el.type === "arrow"
                            ? {
                                endBinding: snapShapeId
                                    ? { elementId: snapShapeId }
                                    : null,
                            }
                            : {}),
                    };
                }

                if (dragState.handle === "cp1") {
                    return {
                        ...el,
                        cx1: point.x,
                        cy1: point.y,
                        cx2: point.x,
                        cy2: point.y,
                    };
                }

                return el;
            });

            return;
        }

        if (dragState.mode === "pan") {
            const dx = rawPoint.x - dragState.startScreenX;
            const dy = rawPoint.y - dragState.startScreenY;

            setViewport((prev) => ({
                ...prev,
                offsetX: prev.offsetX + dx,
                offsetY: prev.offsetY + dy,
            }));

            setDragState((prev) => ({
                ...prev,
                startScreenX: rawPoint.x,
                startScreenY: rawPoint.y,
            }));

            canvas.style.cursor = "grabbing";
            return;
        }

        if (dragState.mode === "draw") {
            const drawingElement = elements.find((el) => el.id === dragState.id);

            updateArrowDuringDraw({
                drawingElement,
                elements,
                point,
                dragState,
                updateElement,
                updateDrawnElement,
                setConnectionHint,
            });

            return;
        }

        if (dragState.mode === "move") {
            canvas.style.cursor = "move";

            const dx = point.x - dragState.startX;
            const dy = point.y - dragState.startY;
            const movingIds = new Set(dragState.ids);

            setDragState((prev) => ({
                ...prev,
                startX: point.x,
                startY: point.y,
            }));

            setElements((prev) =>
                moveConnectedArrows(prev, movingIds, dx, dy, moveElement)
            );

            return;
        }

        if (dragState.mode === "resize") {
            const cursor = getCursorForHandle(dragState.handle);
            canvas.style.cursor = cursor;

            updateElement(dragState.id, (element) =>
                resizeElement(element, dragState, point)
            );

            return;
        }

        if (dragState.mode === "marquee") {
            canvas.style.cursor = "crosshair";

            const box = normalizeSelectionRect(
                dragState.startX,
                dragState.startY,
                point.x,
                point.y
            );

            setSelectionBox(box);

            const insideIds = elements
                .filter((el) => {
                    const bounds = getElementBounds(el);
                    if (!bounds) return false;
                    return rectsIntersect(box, bounds);
                })
                .map((el) => el.id);

            setSelectedIds(insideIds);
        }
    };

    const onMouseUp = () => {
        if (!dragState) return;

        if (dragState.mode === "pan") {
            setDragState(null);

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = isSpacePressed ? "grab" : "default";
            }

            return;
        }

        if (dragState.mode === "marquee") {
            setSelectionBox(null);
            setDragState(null);
            setConnectionHint(null);

            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = "default";

            return;
        }

        if (dragState.mode === "curve-handle") {
            const finalAfterHandle = elements;

            setDragState(null);
            setConnectionHint(null);
            commitHistory(finalAfterHandle);

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = isSpacePressed ? "grab" : "default";
            }

            return;
        }

        const finishedElement = dragState.id
            ? elements.find((el) => el.id === dragState.id)
            : null;

        const nextElements = finalizeArrowBinding(elements, finishedElement);
        const finishedMode = dragState.mode;

        if (nextElements !== elements) {
            setElements(nextElements);
        }

        setDragState(null);
        setConnectionHint(null);
        commitHistory(nextElements);

        if (
            finishedMode === "draw" &&
            finishedElement &&
            AUTO_SELECT_TYPES.has(finishedElement.type)
        ) {
            setSelectedIds([finishedElement.id]);
            setTool("select");
        }

        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.cursor = isSpacePressed ? "grab" : "default";
        }
    };

    const onDoubleClick = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rawPoint = getPointerPosition(event, canvas);
        const point = screenToWorld(rawPoint, viewport);

        const target = findTopElementAtPoint(elements, point);

        if (target && target.type === "text") {
            setSelectedIds([target.id]);
            setDragState(null);

            setEditor({
                mode: "edit",
                id: target.id,
                x: target.x,
                y: target.y,
                w: target.w,
                h: target.h,
                value: target.text,
                stroke: target.stroke,
                parentId: target.parentId || null,
            });

            return;
        }

        if (target && TEXT_CONTAINER_TYPES.has(target.type)) {
            setSelectedIds([target.id]);
            setDragState(null);
            startTextCreate(point, target.id, target.stroke || stroke);
            return;
        }

        setSelectedIds([]);
        setDragState(null);
        startTextCreate(point, null, stroke);
    };

    const onWheel = (event) => {
        event.preventDefault();

        setViewport((prev) => {
            if (event.shiftKey) {
                return {
                    ...prev,
                    offsetX: prev.offsetX - event.deltaY,
                };
            }

            return {
                ...prev,
                offsetY: prev.offsetY - event.deltaY,
            };
        });
    };

    return (
        <div className="canvas-wrap" ref={wrapRef}>
            <div className="canvas-stage">
                <canvas
                    ref={canvasRef}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onDoubleClick={onDoubleClick}
                    onWheel={onWheel}
                    onContextMenu={handleBoardRightClick}
                    className="board-canvas"
                />

                {selectionBox && (
                    <div
                        className="selection-box"
                        style={{
                            left: selectionBox.x * viewport.zoom + viewport.offsetX,
                            top: selectionBox.y * viewport.zoom + viewport.offsetY,
                            width: selectionBox.w * viewport.zoom,
                            height: selectionBox.h * viewport.zoom,
                        }}
                    />
                )}

                <TextEditor
                    editor={editor}
                    setEditor={setEditor}
                    createTextElement={createTextElement}
                    updateTextElement={updateTextElement}
                    viewport={viewport}
                />

                <BoardContextMenu
                    visible={contextMenu.visible}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={closeContextMenu}
                    onExportPDF={() => exportCanvasToPDF(canvasRef.current)}
                    onExportSVG={() =>
                        exportCanvasToSVG(
                            elements,
                            canvasSize.width,
                            canvasSize.height
                        )
                    }
                    onExportPNG={() => exportCanvasToPNG(canvasRef.current)}
                />
            </div>

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
                    onClick={exportDrawingJson}
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
                    {ANIMATION_SPEED_OPTIONS.map((option) => (
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
        </div>
    );
}
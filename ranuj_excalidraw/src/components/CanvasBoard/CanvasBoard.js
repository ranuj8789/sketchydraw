import React, { useEffect, useRef, useState } from "react";
import MyDrawingsPopup from "../MyDrawingsPopup/MyDrawingsPopup";
import TextEditor from "./../TextEditor";
import { getPointerPosition } from "../../utils/geometry";
import { findBindableShapeNearPoint } from "../../canvas/canvasConnectionHelpers";
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
import { screenToWorld } from "../../canvas/canvasViewport";
import BoardContextMenu from "../BoardContextMenu";
import {
    exportCanvasToPDF,
    exportCanvasToSVG,
    exportCanvasToPNG,
    copyCanvasToClipboard,
    copyCanvasAreaToClipboard,
} from "../../utils/exportBoard";

import CanvasBoardActions from "./CanvasBoardActions/CanvasBoardActions";
import { useSaveDrawing } from "./useSaveDrawing";
import { useVideoExport } from "./useVideoExport";
import SaveDrawingPopup from "../SaveDrawingPopup/SaveDrawingPopup";
import { DEFAULT_GROUP, DEFAULT_TITLE } from "../DrawingGroupStore/drawingGroupStore";

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
                                        history,
                                        showGrid,
                                        canvasRef,
                                        viewport,
                                        setViewport,
                                        canvasSize,
                                        setCanvasSize,
                                    }) {
    const wrapRef = useRef(null);

    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
    });

    const [dragState, setDragState] = useState(null);
    const [editor, setEditor] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [clipboard, setClipboard] = useState([]);
    const [connectionHint, setConnectionHint] = useState(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [myDrawingsOpen, setMyDrawingsOpen] = useState(false);

    const [currentDrawingMeta, setCurrentDrawingMeta] = useState({
        id: null,
        title: DEFAULT_TITLE,
        groupName: DEFAULT_GROUP,
        description: "",
    });

    const {
        isSavingDrawing,
        savePopupOpen,
        saveMessage,
        openSavePopup,
        closeSavePopup,
        saveCurrentDrawing,
    } = useSaveDrawing({
        elements,
        viewport,
        canvasSize,
        currentDrawingMeta,
        setCurrentDrawingMeta,
    });

    const {
        animationSpeed,
        setAnimationSpeed,
        animationSpeedOptions,
        isVideoExporting,
        videoExportProgress,
        downloadUndoRedoVideo,
    } = useVideoExport({
        history,
        elements,
        canvasSize,
    });

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
        showGrid,
    });

    const closeContextMenu = () => {
        setContextMenu({
            visible: false,
            x: 0,
            y: 0,
        });
    };

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
                canvas.style.cursor =
                    isSpacePressed || tool === "hand" ? "grab" : "default";
            }

            setSelectionBox(null);
            setConnectionHint(null);
        };

        window.addEventListener("mouseup", handleWindowMouseUp);
        return () => window.removeEventListener("mouseup", handleWindowMouseUp);
    }, [isSpacePressed, tool, canvasRef]);

    useEffect(() => {
        const handleAlignSelected = (event) => {
            const type = event.detail?.type;

            if (!type || selectedIds.length < 2) {
                alert("Please select at least 2 items to align.");
                return;
            }

            const selectedSet = new Set(selectedIds);
            const selectedElements = elements.filter((el) =>
                selectedSet.has(el.id)
            );

            if (selectedElements.length < 2) {
                alert("Please select at least 2 items to align.");
                return;
            }

            const getBounds = (el) => {
                const bounds = getElementBounds(el);

                if (bounds) {
                    return bounds;
                }

                if (el.type === "line" || el.type === "arrow") {
                    const minX = Math.min(el.x1 || 0, el.x2 || 0);
                    const minY = Math.min(el.y1 || 0, el.y2 || 0);
                    const maxX = Math.max(el.x1 || 0, el.x2 || 0);
                    const maxY = Math.max(el.y1 || 0, el.y2 || 0);

                    return {
                        x: minX,
                        y: minY,
                        w: maxX - minX,
                        h: maxY - minY,
                    };
                }

                return {
                    x: el.x || 0,
                    y: el.y || 0,
                    w: el.w || 0,
                    h: el.h || 0,
                };
            };

            const moveBy = (el, dx, dy) => {
                if (el.type === "line" || el.type === "arrow") {
                    return {
                        ...el,
                        x1: (el.x1 || 0) + dx,
                        y1: (el.y1 || 0) + dy,
                        x2: (el.x2 || 0) + dx,
                        y2: (el.y2 || 0) + dy,
                    };
                }

                if (el.type === "pencil") {
                    return {
                        ...el,
                        points: (el.points || []).map((point) => ({
                            ...point,
                            x: point.x + dx,
                            y: point.y + dy,
                        })),
                    };
                }

                return {
                    ...el,
                    x: (el.x || 0) + dx,
                    y: (el.y || 0) + dy,
                };
            };

            const boundsList = selectedElements.map((el) => ({
                id: el.id,
                bounds: getBounds(el),
            }));

            const minX = Math.min(...boundsList.map((item) => item.bounds.x));
            const minY = Math.min(...boundsList.map((item) => item.bounds.y));
            const maxX = Math.max(
                ...boundsList.map((item) => item.bounds.x + item.bounds.w)
            );
            const maxY = Math.max(
                ...boundsList.map((item) => item.bounds.y + item.bounds.h)
            );

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const next = elements.map((el) => {
                if (!selectedSet.has(el.id)) {
                    return el;
                }

                const bounds = getBounds(el);

                let dx = 0;
                let dy = 0;

                if (type === "left") {
                    dx = minX - bounds.x;
                }

                if (type === "center") {
                    dx = centerX - (bounds.x + bounds.w / 2);
                }

                if (type === "right") {
                    dx = maxX - (bounds.x + bounds.w);
                }

                if (type === "top") {
                    dy = minY - bounds.y;
                }

                if (type === "middle") {
                    dy = centerY - (bounds.y + bounds.h / 2);
                }

                if (type === "bottom") {
                    dy = maxY - (bounds.y + bounds.h);
                }

                return moveBy(el, dx, dy);
            });

            setElements(next);
            commitHistory(next);
        };

        window.addEventListener("sketchydraw:align-selected", handleAlignSelected);

        return () => {
            window.removeEventListener(
                "sketchydraw:align-selected",
                handleAlignSelected
            );
        };
    }, [elements, selectedIds, setElements, commitHistory]);

    const updateElement = (id, updater) => {
        setElements((prev) =>
            prev.map((el) => (el.id === id ? updater(el) : el))
        );
    };

    const handleBoardRightClick = (e) => {
        e.preventDefault();

        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
        });
    };

    const getSelectedElements = () => {
        const selectedSet = new Set(selectedIds || []);
        return elements.filter((el) => selectedSet.has(el.id));
    };

    const getSelectedScreenCrop = () => {
        const selectedElements = getSelectedElements();

        if (!selectedElements.length) {
            return null;
        }

        const boundsList = selectedElements
            .map((el) => getElementBounds(el))
            .filter(Boolean);

        if (!boundsList.length) {
            return null;
        }

        const minX = Math.min(...boundsList.map((b) => b.x));
        const minY = Math.min(...boundsList.map((b) => b.y));
        const maxX = Math.max(...boundsList.map((b) => b.x + b.w));
        const maxY = Math.max(...boundsList.map((b) => b.y + b.h));

        return {
            x: minX * viewport.zoom + viewport.offsetX,
            y: minY * viewport.zoom + viewport.offsetY,
            w: (maxX - minX) * viewport.zoom,
            h: (maxY - minY) * viewport.zoom,
        };
    };

    const handleCopyWholePNG = async () => {
        try {
            await copyCanvasToClipboard(canvasRef.current, "image/png");
        } catch (error) {
            console.error("Copy whole PNG failed", error);
            alert("Copy PNG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopyWholeJPEG = async () => {
        try {
            await copyCanvasToClipboard(canvasRef.current, "image/jpeg");
        } catch (error) {
            console.error("Copy whole JPEG failed", error);
            alert("Copy JPEG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopyWholeSVG = async () => {
        try {
            alert("SVG copy needs one small exportBoard refactor. PNG/JPEG copy is ready.");
        } catch (error) {
            console.error("Copy whole SVG failed", error);
        }
    };

    const handleCopySelectedPNG = async () => {
        try {
            const crop = getSelectedScreenCrop();

            if (!crop) {
                alert("Select something first.");
                return;
            }

            await copyCanvasAreaToClipboard(canvasRef.current, crop, "image/png");
        } catch (error) {
            console.error("Copy selected PNG failed", error);
            alert("Copy selected PNG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopySelectedJPEG = async () => {
        try {
            const crop = getSelectedScreenCrop();

            if (!crop) {
                alert("Select something first.");
                return;
            }

            await copyCanvasAreaToClipboard(canvasRef.current, crop, "image/jpeg");
        } catch (error) {
            console.error("Copy selected JPEG failed", error);
            alert("Copy selected JPEG failed. Use HTTPS or localhost.");
        }
    };

    const handleCopySelectedSVG = async () => {
        try {
            alert("SVG selected copy needs one small exportBoard refactor. PNG/JPEG copy is ready.");
        } catch (error) {
            console.error("Copy selected SVG failed", error);
        }
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
        const idsToMove = selectedIds.includes(target.id)
            ? selectedIds
            : [target.id];

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
            const selectedElementObj = elements.find(
                (el) => el.id === selectedIds[0]
            );

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

            canvas.style.cursor = "grabbing";
            return;
        }

        if (tool === "hand" && event.button === 0) {
            event.preventDefault();

            setDragState({
                mode: "pan",
                startScreenX: rawPoint.x,
                startScreenY: rawPoint.y,
            });

            canvas.style.cursor = "grabbing";
            return;
        }

        if (isSpacePressed && event.button === 0) {
            event.preventDefault();

            setDragState({
                mode: "pan",
                startScreenX: rawPoint.x,
                startScreenY: rawPoint.y,
            });

            canvas.style.cursor = "grabbing";
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

        if (!dragState && (isSpacePressed || tool === "hand")) {
            canvas.style.cursor = "grab";
        }

        if (!dragState && tool === "select" && !isSpacePressed) {
            let cursor = "default";

            if (selectedIds.length === 1) {
                const selectedElementObj = elements.find(
                    (el) => el.id === selectedIds[0]
                );

                if (
                    selectedElementObj?.type === "line" ||
                    selectedElementObj?.type === "arrow"
                ) {
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
                        ? getResizeHandleAtPoint(
                            selectedElementObj,
                            point.x,
                            point.y
                        )
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
                if (!el || (el.type !== "line" && el.type !== "arrow")) {
                    return el;
                }

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
                canvas.style.cursor =
                    isSpacePressed || tool === "hand" ? "grab" : "default";
            }

            return;
        }

        if (dragState.mode === "marquee") {
            setSelectionBox(null);
            setDragState(null);
            setConnectionHint(null);

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = "default";
            }

            return;
        }

        if (dragState.mode === "curve-handle") {
            const finalAfterHandle = elements;

            setDragState(null);
            setConnectionHint(null);
            commitHistory(finalAfterHandle);

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor =
                    isSpacePressed || tool === "hand" ? "grab" : "default";
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
            canvas.style.cursor =
                isSpacePressed || tool === "hand" ? "grab" : "default";
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

    const getLocalSavedDrawingById = (id) => {
        try {
            const rows = JSON.parse(
                localStorage.getItem("sketchydraw_saved_drawings_cache") || "[]"
            );

            return rows.find((item) => String(item.id) === String(id));
        } catch {
            return null;
        }
    };

    const handleOpenSavedDrawing = (drawing) => {
        try {
            const localDrawing = getLocalSavedDrawingById(drawing.id);

            const raw =
                drawing.drawingJson ||
                drawing.drawing_json ||
                drawing.content ||
                drawing.data ||
                drawing.json ||
                localDrawing?.drawingJson;

            if (!raw) {
                alert("Drawing data missing. Please save this drawing again once.");
                return;
            }

            const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
            const actualDrawing = parsed.data || parsed;

            setCurrentDrawingMeta({
                id: drawing.id || parsed.id || null,
                title: drawing.title || parsed.title || actualDrawing.name || DEFAULT_TITLE,
                groupName:
                    drawing.groupName ||
                    parsed.groupName ||
                    drawing.workspace ||
                    parsed.workspace ||
                    DEFAULT_GROUP,
                description: drawing.description || parsed.description || "",
            });

            const nextElements = actualDrawing.elements || [];

            setElements(nextElements);
            setSelectedIds([]);

            if (actualDrawing.viewport) {
                setViewport(actualDrawing.viewport);
            }

            if (actualDrawing.canvas) {
                setCanvasSize({
                    width: actualDrawing.canvas.width || 1200,
                    height: actualDrawing.canvas.height || 700,
                });
            }

            commitHistory(nextElements);
            setMyDrawingsOpen(false);
        } catch (error) {
            console.error("Open drawing failed", error);
            alert("Unable to open drawing.");
        }
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
                    onCopyWholePNG={handleCopyWholePNG}
                    onCopyWholeJPEG={handleCopyWholeJPEG}
                    onCopyWholeSVG={handleCopyWholeSVG}
                    onCopySelectedPNG={handleCopySelectedPNG}
                    onCopySelectedJPEG={handleCopySelectedJPEG}
                    onCopySelectedSVG={handleCopySelectedSVG}
                    hasSelection={selectedIds.length > 0}
                />
            </div>

            <CanvasBoardActions
                viewport={viewport}
                setViewport={setViewport}
                onExport={onExport}
                canvasRef={canvasRef}
                drawingTitle={currentDrawingMeta.title || DEFAULT_TITLE}
                onDrawingTitleChange={(title) =>
                    setCurrentDrawingMeta((prev) => ({
                        ...prev,
                        title: title || "Untitled",
                    }))
                }
                saveCurrentDrawing={openSavePopup}
                openMyDrawings={() => setMyDrawingsOpen(true)}
                animationSpeed={animationSpeed}
                setAnimationSpeed={setAnimationSpeed}
                animationSpeedOptions={animationSpeedOptions}
                downloadUndoRedoVideo={downloadUndoRedoVideo}
                isVideoExporting={isVideoExporting}
                videoExportProgress={videoExportProgress}
            />

            <SaveDrawingPopup
                open={savePopupOpen}
                onClose={closeSavePopup}
                onSave={saveCurrentDrawing}
                onOpenDrawing={handleOpenSavedDrawing}
                initialValues={currentDrawingMeta}
                loading={isSavingDrawing}
                message={saveMessage}
            />

            <MyDrawingsPopup
                open={myDrawingsOpen}
                onClose={() => setMyDrawingsOpen(false)}
                onOpenDrawing={handleOpenSavedDrawing}
            />
        </div>
    );
}
import React, { useEffect, useRef, useState } from "react";
import { normalizeTextStyle } from "../../canvas/textRenderStyle";
import MyDrawingsPopup from "../MyDrawingsPopup/MyDrawingsPopup";
import { isPaidUser } from "../../utils/auth";
import "./CanvasBoard.css";
import TextEditor from "./../TextEditor";
import { getPointerPosition } from "../../utils/geometry";
import {
    createBindingForPoint,
    findBindableShapeNearPoint,
    isConnectorElement,
} from "../../canvas/canvasConnectionHelpers";
import { DEFAULT_TEXT_STYLE } from "../../canvas/textStyle";
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
    buildImageElement,
} from "../../canvas/canvasFactories";
import {
    getStableStraightLineEnd,
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
    finalizeArrowBinding,
    moveConnectedArrows,
    bindMovedShapesToNearbyConnectors,
    resolveArrowBindings,
} from "../../canvas/canvasArrowBindings";
import { useCanvasResize } from "../../canvas/useCanvasResize";
import { useCanvasRender } from "../../canvas/useCanvasRender";
import { renderCanvas } from "../../canvas/canvasRender";
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
import {
    getLocalDrawingById,
    getLatestLocalDrawing,
    saveLocalDrawing,
} from "../DrawingGroupStore/localDrawingStore";
import { saveDrawingSnapshotAsync } from "../../utils/indexedDbStorage";

const ERASER_CURSOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <g transform="rotate(-35 14 14)">
    <rect x="7" y="5" width="13" height="18" rx="3" fill="#ffffff" stroke="#111827" stroke-width="2"/>
    <rect x="7" y="14" width="13" height="9" rx="2" fill="#fca5a5" stroke="#111827" stroke-width="2"/>
    <line x1="7" y1="14" x2="20" y2="14" stroke="#111827" stroke-width="2"/>
  </g>
</svg>
`;

const ERASER_CURSOR = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    ERASER_CURSOR_SVG
)}") 8 22, pointer`;

const ALIGNMENT_SNAP_THRESHOLD = 18;
const GRID_SIZE = 24;

function snapValueToGrid(value, gridSize = GRID_SIZE) {
    return Math.round(value / gridSize) * gridSize;
}

function snapPointToGrid(point, gridSize = GRID_SIZE) {
    return {
        x: snapValueToGrid(point.x, gridSize),
        y: snapValueToGrid(point.y, gridSize),
    };
}

function isGridSnapActive(showGrid, canvasProps) {
    const pattern = canvasProps?.pattern;
    return !!showGrid || pattern === "grid" || pattern === "notebook";
}

function getGroupBounds(items) {
    const boundsList = (items || [])
        .map((el) => getElementBounds(el))
        .filter(Boolean);

    if (!boundsList.length) return null;

    const minX = Math.min(...boundsList.map((b) => b.x));
    const minY = Math.min(...boundsList.map((b) => b.y));
    const maxX = Math.max(...boundsList.map((b) => b.x + b.w));
    const maxY = Math.max(...boundsList.map((b) => b.y + b.h));

    return {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
    };
}

function isRectangleContainer(element) {
    return element?.type === "rect" || element?.type === "rectangle";
}

function isBoundsInside(inner, outer, padding = 1) {
    if (!inner || !outer) return false;

    return (
        inner.x >= outer.x + padding &&
        inner.y >= outer.y + padding &&
        inner.x + inner.w <= outer.x + outer.w - padding &&
        inner.y + inner.h <= outer.y + outer.h - padding
    );
}

function scaleNumber(value, fromStart, toStart, scale) {
    return toStart + (value - fromStart) * scale;
}

function scaleElementInsideBounds(element, fromBounds, toBounds) {
    if (!element || !fromBounds || !toBounds) return element;

    const scaleX = fromBounds.w === 0 ? 1 : toBounds.w / fromBounds.w;
    const scaleY = fromBounds.h === 0 ? 1 : toBounds.h / fromBounds.h;

    if (
        element.type === "rect" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "image" ||
        element.type === "text"
    ) {
        const scaledElement = {
            ...element,
            x: scaleNumber(element.x, fromBounds.x, toBounds.x, scaleX),
            y: scaleNumber(element.y, fromBounds.y, toBounds.y, scaleY),
            w: Math.max(1, (element.w || 1) * scaleX),
            h: Math.max(1, (element.h || 1) * scaleY),
        };

        if (element.type === "text") {
            const fontScale = Math.max(0.25, Math.min(scaleX, scaleY));

            return {
                ...scaledElement,
                fontSize: element.fontSize
                    ? Math.max(8, element.fontSize * fontScale)
                    : element.fontSize,
                lineHeight: element.lineHeight
                    ? Math.max(10, element.lineHeight * fontScale)
                    : element.lineHeight,
            };
        }

        return scaledElement;
    }

    if (element.type === "line" || element.type === "arrow") {
        const fallbackMidX = (element.x1 + element.x2) / 2;
        const fallbackMidY = (element.y1 + element.y2) / 2;

        return {
            ...element,
            x1: scaleNumber(element.x1, fromBounds.x, toBounds.x, scaleX),
            y1: scaleNumber(element.y1, fromBounds.y, toBounds.y, scaleY),
            x2: scaleNumber(element.x2, fromBounds.x, toBounds.x, scaleX),
            y2: scaleNumber(element.y2, fromBounds.y, toBounds.y, scaleY),
            cx1: scaleNumber(element.cx1 ?? fallbackMidX, fromBounds.x, toBounds.x, scaleX),
            cy1: scaleNumber(element.cy1 ?? fallbackMidY, fromBounds.y, toBounds.y, scaleY),
            cx2: scaleNumber(element.cx2 ?? fallbackMidX, fromBounds.x, toBounds.x, scaleX),
            cy2: scaleNumber(element.cy2 ?? fallbackMidY, fromBounds.y, toBounds.y, scaleY),
        };
    }

    if (element.type === "pencil") {
        return {
            ...element,
            points: (element.points || []).map((point) => ({
                ...point,
                x: scaleNumber(point.x, fromBounds.x, toBounds.x, scaleX),
                y: scaleNumber(point.y, fromBounds.y, toBounds.y, scaleY),
            })),
        };
    }

    return element;
}

function findContainedElementIds(elements, containerElement, containerBounds) {
    if (!isRectangleContainer(containerElement) || !containerBounds) {
        return [];
    }

    return (elements || [])
        .filter((el) => el.id !== containerElement.id)
        .filter((el) => isBoundsInside(getElementBounds(el), containerBounds))
        .map((el) => el.id);
}

const getIdleCanvasCursor = (tool, isSpacePressed) => {
    if (isSpacePressed || tool === "hand") return "grab";
    if (tool === "eraser") return "crosshair";
    return "default";
};

function readImageFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error("Unable to read image."));

        reader.readAsDataURL(file);
    });
}

function getImageSize(src) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            resolve({
                naturalWidth: img.naturalWidth || 640,
                naturalHeight: img.naturalHeight || 360,
            });
        };

        img.onerror = () => {
            resolve({
                naturalWidth: 640,
                naturalHeight: 360,
            });
        };

        img.src = src;
    });
}

function getAlignmentPoints(bounds) {
    return {
        vertical: [
            { key: "left", value: bounds.x },
            { key: "centerX", value: bounds.x + bounds.w / 2 },
            { key: "right", value: bounds.x + bounds.w },
        ],
        horizontal: [
            { key: "top", value: bounds.y },
            { key: "centerY", value: bounds.y + bounds.h / 2 },
            { key: "bottom", value: bounds.y + bounds.h },
        ],
    };
}

function getSmartAlignment({ elements, movingIds, movedElements }) {
    let bestVertical = null;
    let bestHorizontal = null;

    const movedById = new Map(movedElements.map((el) => [el.id, el]));
    const movingElements = elements
        .filter((el) => movingIds.has(el.id))
        .map((el) => movedById.get(el.id) || el);

    const stationaryElements = elements.filter((el) => !movingIds.has(el.id));

    movingElements.forEach((movingElement) => {
        const movingBounds = getElementBounds(movingElement);
        if (!movingBounds) return;

        const movingPoints = getAlignmentPoints(movingBounds);

        stationaryElements.forEach((stationaryElement) => {
            const stationaryBounds = getElementBounds(stationaryElement);
            if (!stationaryBounds) return;

            const stationaryPoints = getAlignmentPoints(stationaryBounds);

            movingPoints.vertical.forEach((movingPoint) => {
                stationaryPoints.vertical.forEach((stationaryPoint) => {
                    const diff = stationaryPoint.value - movingPoint.value;

                    if (
                        Math.abs(diff) <= ALIGNMENT_SNAP_THRESHOLD &&
                        (!bestVertical || Math.abs(diff) < Math.abs(bestVertical.snapDx))
                    ) {
                        bestVertical = {
                            type: "vertical",
                            x: stationaryPoint.value,
                            snapDx: diff,
                            targetId: stationaryElement.id,
                        };
                    }
                });
            });

            movingPoints.horizontal.forEach((movingPoint) => {
                stationaryPoints.horizontal.forEach((stationaryPoint) => {
                    const diff = stationaryPoint.value - movingPoint.value;

                    if (
                        Math.abs(diff) <= ALIGNMENT_SNAP_THRESHOLD &&
                        (!bestHorizontal || Math.abs(diff) < Math.abs(bestHorizontal.snapDy))
                    ) {
                        bestHorizontal = {
                            type: "horizontal",
                            y: stationaryPoint.value,
                            snapDy: diff,
                            targetId: stationaryElement.id,
                        };
                    }
                });
            });
        });
    });

    return {
        guides: [bestVertical, bestHorizontal].filter(Boolean),
        snapDx: bestVertical?.snapDx || 0,
        snapDy: bestHorizontal?.snapDy || 0,
    };
}

function getResizeSmartAlignment({ elements, resizingId, resizedElement, handle }) {
    const resizedBounds = getElementBounds(resizedElement);
    if (!resizedBounds) {
        return { guides: [], snapDx: 0, snapDy: 0 };
    }

    const resizedPoints = getAlignmentPoints(resizedBounds);
    const activeVerticalPoints = [];
    const activeHorizontalPoints = [];

    if (handle.includes("w")) {
        activeVerticalPoints.push(resizedPoints.vertical.find((point) => point.key === "left"));
    }

    if (handle.includes("e")) {
        activeVerticalPoints.push(resizedPoints.vertical.find((point) => point.key === "right"));
    }

    if (handle.includes("n")) {
        activeHorizontalPoints.push(resizedPoints.horizontal.find((point) => point.key === "top"));
    }

    if (handle.includes("s")) {
        activeHorizontalPoints.push(resizedPoints.horizontal.find((point) => point.key === "bottom"));
    }

    let bestVertical = null;
    let bestHorizontal = null;

    elements.forEach((stationaryElement) => {
        if (stationaryElement.id === resizingId) return;

        const stationaryBounds = getElementBounds(stationaryElement);
        if (!stationaryBounds) return;

        const stationaryPoints = getAlignmentPoints(stationaryBounds);

        activeVerticalPoints.filter(Boolean).forEach((resizedPoint) => {
            stationaryPoints.vertical.forEach((stationaryPoint) => {
                const diff = stationaryPoint.value - resizedPoint.value;

                if (
                    Math.abs(diff) <= ALIGNMENT_SNAP_THRESHOLD &&
                    (!bestVertical || Math.abs(diff) < Math.abs(bestVertical.snapDx))
                ) {
                    bestVertical = {
                        type: "vertical",
                        x: stationaryPoint.value,
                        snapDx: diff,
                    };
                }
            });
        });

        activeHorizontalPoints.filter(Boolean).forEach((resizedPoint) => {
            stationaryPoints.horizontal.forEach((stationaryPoint) => {
                const diff = stationaryPoint.value - resizedPoint.value;

                if (
                    Math.abs(diff) <= ALIGNMENT_SNAP_THRESHOLD &&
                    (!bestHorizontal || Math.abs(diff) < Math.abs(bestHorizontal.snapDy))
                ) {
                    bestHorizontal = {
                        type: "horizontal",
                        y: stationaryPoint.value,
                        snapDy: diff,
                    };
                }
            });
        });
    });

    return {
        guides: [bestVertical, bestHorizontal].filter(Boolean),
        snapDx: bestVertical?.snapDx || 0,
        snapDy: bestHorizontal?.snapDy || 0,
    };
}

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
                                        currentDrawingMeta,
                                        setCurrentDrawingMeta,
                                        canvasProps = {},
                                        setCanvasProps,
                                        currentTextStyle = DEFAULT_TEXT_STYLE,
                                    }) {
    const wrapRef = useRef(null);
    const localDraftIdRef = useRef(null);
    const hasRestoredLocalDraftRef = useRef(false);
    const imageInputRef = useRef(null);
    const imageInsertPointRef = useRef(null);
    const pointerMoveFrameRef = useRef(null);
    const latestPointerMoveEventRef = useRef(null);

    const elementsRef = useRef(elements);
    const selectedIdsRef = useRef(selectedIds);
    const viewportRef = useRef(viewport);
    const canvasSizeRef = useRef(canvasSize);
    const canvasPropsRef = useRef(canvasProps);
    const showGridRef = useRef(showGrid);
    const dragBaseElementsRef = useRef(null);
    const dragPreviewElementsRef = useRef(null);
    const textCommitLockRef = useRef(0);

    const [imageRenderTick, setImageRenderTick] = useState(0);

    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
    });

    const [dragState, setDragState] = useState(null);
    const [alignmentGuides, setAlignmentGuides] = useState([]);
    const [editor, setEditor] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [clipboard, setClipboard] = useState([]);
    const [connectionHint, setConnectionHint] = useState(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [myDrawingsOpen, setMyDrawingsOpen] = useState(false);

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
        canvasProps,
        currentDrawingMeta,
        setCurrentDrawingMeta,
    });

    const {
        isVideoExporting,
        videoExportProgress,
        downloadUndoRedoVideo,
    } = useVideoExport({
        history,
        elements,
        canvasSize,
        canvasProps,
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

    useEffect(() => {
        const handleVideoExport = (event) => {
            downloadUndoRedoVideo({
                gapSeconds: event.detail?.gapSeconds,
            });
        };

        window.addEventListener("sketchydraw:export-video", handleVideoExport);

        return () => {
            window.removeEventListener("sketchydraw:export-video", handleVideoExport);
        };
    }, [downloadUndoRedoVideo]);
    useEffect(() => {
        if (!editor || editor.mode !== "edit" || !editor.id) return;

        const latestElement = elements.find(
            (el) => el.id === editor.id && el.type === "text"
        );

        if (!latestElement) return;

        setEditor((prev) => {
            if (!prev || prev.mode !== "edit" || prev.id !== latestElement.id) {
                return prev;
            }

            return {
                ...prev,

                // Do not overwrite prev.value here. User may be typing.
                stroke: latestElement.stroke || prev.stroke,
                fontSize: latestElement.fontSize || DEFAULT_TEXT_STYLE.fontSize,
                lineHeight: latestElement.lineHeight || DEFAULT_TEXT_STYLE.lineHeight,
                fontFamily: latestElement.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
                bold: latestElement.bold ?? DEFAULT_TEXT_STYLE.bold,
                italic: latestElement.italic ?? DEFAULT_TEXT_STYLE.italic,
                underline: latestElement.underline ?? DEFAULT_TEXT_STYLE.underline,
                textAlign: latestElement.textAlign || DEFAULT_TEXT_STYLE.textAlign || "left",

                // Do not overwrite x/y here.
                // x/y must stay stable while editing.
                w: latestElement.w || prev.w,
                h: latestElement.h || prev.h,
            };
        });
    }, [elements, editor?.id, editor?.mode]);

    useCanvasRender({
        canvasRef,
        canvasSize,
        elements: renderElements,
        selectedIds: renderSelectedIds,
        connectionHint,
        alignmentGuides,
        viewport,
        showGrid,
        canvasProps: {
            ...canvasProps,
            __imageRenderTick: imageRenderTick,
        },
    });

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    useEffect(() => {
        if (!editor || editor.mode !== "edit" || !editor.id) return;

        const latestElement = elements.find(
            (el) => el.id === editor.id && el.type === "text"
        );

        if (!latestElement) return;

        setEditor((prev) => {
            if (!prev || prev.mode !== "edit" || prev.id !== latestElement.id) {
                return prev;
            }

            return {
                ...prev,

                // Do not overwrite prev.value here. User may be typing.
                stroke: latestElement.stroke || prev.stroke,
                fontSize: latestElement.fontSize || DEFAULT_TEXT_STYLE.fontSize,
                lineHeight: latestElement.lineHeight || DEFAULT_TEXT_STYLE.lineHeight,
                fontFamily: latestElement.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
                bold: latestElement.bold ?? DEFAULT_TEXT_STYLE.bold,
                italic: latestElement.italic ?? DEFAULT_TEXT_STYLE.italic,
                underline: latestElement.underline ?? DEFAULT_TEXT_STYLE.underline,
                textAlign: latestElement.textAlign || DEFAULT_TEXT_STYLE.textAlign || "left",
                w: latestElement.w || prev.w,
                h: latestElement.h || prev.h,
            };
        });
    }, [elements, editor?.id, editor?.mode]);

    useEffect(() => {
        selectedIdsRef.current = selectedIds;
    }, [selectedIds]);

    useEffect(() => {
        viewportRef.current = viewport;
    }, [viewport]);

    useEffect(() => {
        canvasSizeRef.current = canvasSize;
    }, [canvasSize]);

    useEffect(() => {
        canvasPropsRef.current = canvasProps;
    }, [canvasProps]);

    useEffect(() => {
        showGridRef.current = showGrid;
    }, [showGrid]);

    const clearDragPreviewRefs = () => {
        dragBaseElementsRef.current = null;
        dragPreviewElementsRef.current = null;
    };

    const renderLivePreview = (nextElements, guides = [], hint = null, nextSelectedIds = selectedIdsRef.current) => {
        const canvas = canvasRef.current;

        if (!canvas) return;

        const finalElements =
            editor?.mode === "edit" && editor?.id
                ? (nextElements || []).filter((el) => el.id !== editor.id)
                : nextElements;

        const finalSelectedIds =
            editor?.mode === "edit" && editor?.id
                ? (nextSelectedIds || []).filter((id) => id !== editor.id)
                : nextSelectedIds;

        renderCanvas({
            canvas,
            canvasSize: canvasSizeRef.current,
            elements: finalElements,
            selectedIds: finalSelectedIds,
            connectionHint: hint,
            alignmentGuides: guides,
            viewport: viewportRef.current,
            showGrid: showGridRef.current,
            canvasProps: canvasPropsRef.current,
        });
    };

    useEffect(() => {
        const rerenderImages = () => {
            setImageRenderTick((prev) => prev + 1);
        };

        window.addEventListener("sketchydraw:image-loaded", rerenderImages);

        return () => {
            window.removeEventListener("sketchydraw:image-loaded", rerenderImages);
        };
    }, []);

    useEffect(() => {
        return () => {
            if (pointerMoveFrameRef.current !== null) {
                window.cancelAnimationFrame(pointerMoveFrameRef.current);
                pointerMoveFrameRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (hasRestoredLocalDraftRef.current) return;
        hasRestoredLocalDraftRef.current = true;

        if (elements && elements.length > 0) return;

        const latestDrawing = getLatestLocalDrawing();

        if (!latestDrawing?.drawingJson) return;

        try {
            const parsed =
                typeof latestDrawing.drawingJson === "string"
                    ? JSON.parse(latestDrawing.drawingJson)
                    : latestDrawing.drawingJson;

            const actualDrawing = parsed.data || parsed;
            const nextElements = actualDrawing.elements || [];

            if (!nextElements.length) return;

            localDraftIdRef.current = latestDrawing.id;

            setElements(nextElements);
            setSelectedIds([]);

            const restoredId = latestDrawing.id || parsed.id || null;
            const isRestoredLocalId =
                restoredId && String(restoredId).startsWith("local_");

            setCurrentDrawingMeta((prev) => ({
                ...prev,
                id: isRestoredLocalId ? null : restoredId,
                title:
                    latestDrawing.title ||
                    parsed.title ||
                    actualDrawing.name ||
                    DEFAULT_TITLE,
                groupName:
                    latestDrawing.groupName ||
                    parsed.groupName ||
                    parsed.workspace ||
                    DEFAULT_GROUP,
                description:
                    latestDrawing.description ||
                    parsed.description ||
                    "",
            }));

            if (actualDrawing.viewport) {
                setViewport(actualDrawing.viewport);
            }

            if (actualDrawing.canvas) {
                setCanvasSize({
                    width: actualDrawing.canvas.width || 1200,
                    height: actualDrawing.canvas.height || 700,
                });
            }

            if (actualDrawing.canvasProps && setCanvasProps) {
                setCanvasProps(actualDrawing.canvasProps);
            }

            commitHistory(nextElements);
        } catch (error) {
            console.error("Local drawing restore failed", error);
        }
    }, []);

    useEffect(() => {
        if (!elements || elements.length === 0) return;

        if (dragState) return;

        const timer = setTimeout(() => {
            const existingId = currentDrawingMeta?.id;
            const isLocalId = existingId && String(existingId).startsWith("local_");

            const localSaveId = existingId || localDraftIdRef.current;

            const localRow = saveLocalDrawing({
                id: localSaveId,
                title: currentDrawingMeta?.title || DEFAULT_TITLE,
                groupName: currentDrawingMeta?.groupName || DEFAULT_GROUP,
                description: currentDrawingMeta?.description || "",
                elements,
                viewport,
                canvasSize,
                canvasProps,
            });

            let imageDataUrl = null;
            try {
                imageDataUrl = canvasRef.current?.toDataURL?.("image/png") || null;
            } catch {
                imageDataUrl = null;
            }

            saveDrawingSnapshotAsync({
                id: localRow?.id || localSaveId || "latest",
                json: localRow?.drawingJson || {
                    version: 1,
                    elements,
                    viewport,
                    canvas: canvasSize,
                    canvasProps,
                },
                imageDataUrl,
            });

            if (!localDraftIdRef.current && localRow?.id) {
                localDraftIdRef.current = localRow.id;
            }

            if (isLocalId) {
                localDraftIdRef.current = existingId;
            }
        }, 2500);

        return () => clearTimeout(timer);
    }, [
        elements,
        viewport,
        canvasSize,
        canvasProps,
        currentDrawingMeta?.id,
        currentDrawingMeta?.title,
        currentDrawingMeta?.groupName,
        currentDrawingMeta?.description,
        dragState,
    ]);

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

    const createTextElement = ({
                                   x,
                                   y,
                                   text,
                                   stroke,
                                   parentId = null,
                                   fontSize,
                                   lineHeight,
                                   fontFamily,
                                   bold,
                                   italic,
                                   underline,
                                   textAlign,
                               }) => {
        textCommitLockRef.current = Date.now() + 250;

        createTextElementHelper({
            elements: elementsRef.current,
            setElements: (next) => {
                elementsRef.current = next;
                dragBaseElementsRef.current = null;
                dragPreviewElementsRef.current = null;
                setElements(next);
            },
            setSelectedIds,
            commitHistory,
            x,
            y,
            text,
            stroke,
            parentId,
            fontSize,
            lineHeight,
            fontFamily,
            bold,
            italic,
            underline,
            textAlign,
        });

        dragBaseElementsRef.current = null;
        dragPreviewElementsRef.current = null;
        setDragState(null);
        setTool("select");
    };

    const updateTextElement = (id, value, stylePatch = {}) => {
        textCommitLockRef.current = Date.now() + 250;

        updateTextElementHelper({
            elements: elementsRef.current,
            setElements: (next) => {
                elementsRef.current = next;
                dragBaseElementsRef.current = null;
                dragPreviewElementsRef.current = null;
                setElements(next);
            },
            setSelectedIds,
            commitHistory,
            id,
            value,
            ...stylePatch,
        });

        dragBaseElementsRef.current = null;
        dragPreviewElementsRef.current = null;
        setDragState(null);
        setTool("select");
    };

    const startResize = (target, handle, point) => {
        const bounds = getElementBounds(target);
        const baseElements = elementsRef.current;

        dragBaseElementsRef.current = baseElements;
        dragPreviewElementsRef.current = baseElements;

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
            containedChildIds: findContainedElementIds(baseElements, target, bounds),
        });
    };

    const startMove = (target, point) => {
        const idsToMove = selectedIds.includes(target.id)
            ? selectedIds
            : [target.id];

        dragBaseElementsRef.current = elementsRef.current;
        dragPreviewElementsRef.current = elementsRef.current;

        setSelectedIds(idsToMove);

        setDragState({
            mode: "move",
            ids: idsToMove,
            startX: point.x,
            startY: point.y,
        });
    };

    const startTextCreate = (point, parentId = null, forcedStroke = stroke) => {
        const textPoint = isGridSnapActive(showGridRef.current, canvasPropsRef.current)
            ? snapPointToGrid(point)
            : point;

        setSelectedIds([]);
        setDragState(null);

        const style = normalizeTextStyle({
            ...DEFAULT_TEXT_STYLE,
            ...currentTextStyle,
            stroke: forcedStroke,
        });

        setEditor({
            mode: "create",
            x: textPoint.x,
            y: textPoint.y,
            value: "",
            stroke: style.stroke,
            parentId,

            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            textAlign: style.textAlign,
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
                    dragBaseElementsRef.current = elementsRef.current;
                    dragPreviewElementsRef.current = elementsRef.current;

                    setDragState({
                        mode: "curve-handle",
                        id: selectedElementObj.id,
                        handle: curveHandle,
                    });
                    return;
                }
            }

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
        const gridActive = isGridSnapActive(showGridRef.current, canvasPropsRef.current);
        const drawStartPoint = gridActive ? snapPointToGrid(point) : point;
        let draft = null;

        if (SHAPE_TYPES.has(tool)) {
            draft = buildShapeDraft(tool, drawStartPoint, stroke);
        } else if (LINE_TYPES.has(tool)) {
            draft = buildLineDraft(tool, drawStartPoint, stroke, "straight");
        } else if (tool === "pencil") {
            draft = buildPencilDraft(drawStartPoint, stroke);
        }

        if (!draft) return;

        const finalDraft = applyArrowStartBinding({
            draft,
            tool,
            elements,
            point: drawStartPoint,
            preferInputPoint: gridActive,
        });

        const next = [...elementsRef.current, finalDraft];

        dragBaseElementsRef.current = next;
        dragPreviewElementsRef.current = next;
        elementsRef.current = next;

        setElements(next);
        setSelectedIds([finalDraft.id]);

        setDragState({
            mode: "draw",
            id: finalDraft.id,
            startX: drawStartPoint.x,
            startY: drawStartPoint.y,
        });
    };

    const handleImageFileSelected = async (event) => {
        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) return;

        if (!file.type?.startsWith("image/")) {
            console.warn("Selected file is not an image:", file);
            return;
        }

        try {
            const src = await readImageFileAsDataUrl(file);
            const size = await getImageSize(src);

            const fallbackPoint = screenToWorld(
                {
                    x: canvasSize.width / 2,
                    y: canvasSize.height / 2,
                },
                viewport
            );

            const point = isGridSnapActive(showGridRef.current, canvasPropsRef.current)
                ? snapPointToGrid(imageInsertPointRef.current || fallbackPoint)
                : imageInsertPointRef.current || fallbackPoint;

            const imageElement = buildImageElement({
                point,
                src,
                fileName: file.name,
                naturalWidth: size.naturalWidth,
                naturalHeight: size.naturalHeight,
            });

            const next = [...elements, imageElement];

            setElements(next);
            setSelectedIds([imageElement.id]);
            setTool("select");
            commitHistory(next);

            imageInsertPointRef.current = null;
        } catch (error) {
            console.error("Unable to insert image", error);
        }
    };

    const onMouseDown = (event) => {
        closeContextMenu();

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (Date.now() < textCommitLockRef.current) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

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

        if (tool === "image") {
            const imageCount = elements.filter((el) => el.type === "image").length;

            if (!isPaidUser() && imageCount >= 1) {
                window.dispatchEvent(new Event("sketchydraw:open-subscription"));
                return;
            }

            imageInsertPointRef.current = point;
            imageInputRef.current?.click();
            return;
        }

        if (tool === "select") {
            if (selectedIds.length === 1) {
                const el = elements.find((e) => e.id === selectedIds[0]);

                if (el?.type === "line" || el?.type === "arrow") {
                    const handle = getCurveHandleAtPoint(el, point, viewport.zoom);

                    if (handle) {
                        dragBaseElementsRef.current = elementsRef.current;
                        dragPreviewElementsRef.current = elementsRef.current;

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

    const runMouseMove = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rawPoint = getPointerPosition(event, canvas);
        const point = screenToWorld(rawPoint, viewport);

        if (!dragState && tool === "eraser" && !isSpacePressed) {
            const target = findTopElementAtPoint(elements, point);

            canvas.style.cursor = target ? ERASER_CURSOR : "crosshair";
            return;
        }

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
                            if (target) {
                                cursor =
                                    target.type === "line" || target.type === "arrow"
                                        ? "pointer"
                                        : "move";
                            }
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
                        if (target) {
                            cursor =
                                target.type === "line" || target.type === "arrow"
                                    ? "pointer"
                                    : "move";
                        }
                    }
                }
            } else {
                const target = findTopElementAtPoint(elements, point);
                if (target) {
                    cursor =
                        target.type === "line" || target.type === "arrow"
                            ? "pointer"
                            : "move";
                }
            }

            canvas.style.cursor = cursor;
        }

        if (!dragState) return;

        if (dragState.mode === "curve-handle") {
            canvas.style.cursor = "pointer";

            const baseElements = dragBaseElementsRef.current || elementsRef.current;
            const currentElement = baseElements.find((el) => el.id === dragState.id);

            if (!currentElement) return;

            const movingEndpoint =
                dragState.handle === "start" || dragState.handle === "end";

            const gridActive = isGridSnapActive(showGridRef.current, canvasPropsRef.current);
            let snapPoint = gridActive ? snapPointToGrid(point) : point;
            let snapShapeId = null;
            let snapBinding = null;
            let nextConnectionHint = null;

            if (movingEndpoint) {
                const oppositePoint =
                    dragState.handle === "start"
                        ? { x: currentElement.x2, y: currentElement.y2 }
                        : { x: currentElement.x1, y: currentElement.y1 };

                const rawEndpointPoint = gridActive ? snapPoint : point;

                const bindSearchPoint =
                    currentElement.lineStyle === "curved"
                        ? rawEndpointPoint
                        : getStableStraightLineEnd(oppositePoint, rawEndpointPoint);

                const hint = findBindableShapeNearPoint(baseElements, bindSearchPoint, 24, {
                    excludeIds: [dragState.id],
                    fromPoint: oppositePoint,
                });

                if (hint) {
                    const bindPoint = gridActive ? snapPoint : hint.point;
                    snapPoint = bindPoint;
                    snapShapeId = hint.shapeId;
                    snapBinding = createBindingForPoint(hint.shape, bindPoint);
                    nextConnectionHint = {
                        shapeId: hint.shapeId,
                        bindPoint,
                    };
                }
            }

            const preview = baseElements.map((el) => {
                if (
                    el.id !== dragState.id ||
                    (el.type !== "line" && el.type !== "arrow")
                ) {
                    return el;
                }

                const alreadyCurved = el.lineStyle === "curved";

                if (dragState.handle === "start") {
                    let finalPoint;

                    if (snapBinding || alreadyCurved) {
                        finalPoint = snapPoint;
                    } else {
                        finalPoint = getStableStraightLineEnd(
                            { x: el.x2, y: el.y2 },
                            snapPoint
                        );
                    }

                    const midX = (finalPoint.x + el.x2) / 2;
                    const midY = (finalPoint.y + el.y2) / 2;

                    return {
                        ...el,
                        x1: finalPoint.x,
                        y1: finalPoint.y,
                        lineStyle: alreadyCurved ? "curved" : "straight",
                        cx1: alreadyCurved ? el.cx1 ?? midX : midX,
                        cy1: alreadyCurved ? el.cy1 ?? midY : midY,
                        cx2: alreadyCurved ? el.cx2 ?? el.cx1 ?? midX : midX,
                        cy2: alreadyCurved ? el.cy2 ?? el.cy1 ?? midY : midY,
                        ...(isConnectorElement(el)
                            ? {
                                startBinding: snapShapeId ? snapBinding : null,
                            }
                            : {}),
                    };
                }

                if (dragState.handle === "end") {
                    let finalPoint;

                    if (snapBinding || alreadyCurved) {
                        finalPoint = snapPoint;
                    } else {
                        finalPoint = getStableStraightLineEnd(
                            { x: el.x1, y: el.y1 },
                            snapPoint
                        );
                    }

                    const midX = (el.x1 + finalPoint.x) / 2;
                    const midY = (el.y1 + finalPoint.y) / 2;

                    return {
                        ...el,
                        x2: finalPoint.x,
                        y2: finalPoint.y,
                        lineStyle: alreadyCurved ? "curved" : "straight",
                        cx1: alreadyCurved ? el.cx1 ?? midX : midX,
                        cy1: alreadyCurved ? el.cy1 ?? midY : midY,
                        cx2: alreadyCurved ? el.cx2 ?? el.cx1 ?? midX : midX,
                        cy2: alreadyCurved ? el.cy2 ?? el.cy1 ?? midY : midY,
                        ...(isConnectorElement(el)
                            ? {
                                endBinding: snapShapeId ? snapBinding : null,
                            }
                            : {}),
                    };
                }

                if (dragState.handle === "cp1") {
                    return {
                        ...el,
                        lineStyle: "curved",
                        cx1: snapPoint.x,
                        cy1: snapPoint.y,
                        cx2: snapPoint.x,
                        cy2: snapPoint.y,
                    };
                }

                return el;
            });

            dragPreviewElementsRef.current = preview;
            elementsRef.current = preview;
            renderLivePreview(preview, [], nextConnectionHint);
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
            const baseElements = dragBaseElementsRef.current || elementsRef.current;
            const drawingElement = baseElements.find((el) => el.id === dragState.id);

            if (!drawingElement) return;

            const gridActive = isGridSnapActive(showGridRef.current, canvasPropsRef.current);
            let nextConnectionHint = null;
            let drawPoint = gridActive ? snapPointToGrid(point) : point;
            let endBinding = null;

            if (isConnectorElement(drawingElement)) {
                const oppositePoint = {
                    x: drawingElement.x1,
                    y: drawingElement.y1,
                };

                const rawEndpointPoint = gridActive ? drawPoint : point;

                const bindSearchPoint =
                    drawingElement.lineStyle === "curved"
                        ? rawEndpointPoint
                        : getStableStraightLineEnd(oppositePoint, rawEndpointPoint);

                const hint = findBindableShapeNearPoint(baseElements, bindSearchPoint, 24, {
                    excludeIds: [dragState.id],
                    fromPoint: oppositePoint,
                });

                if (hint) {
                    const bindPoint = gridActive ? bindSearchPoint : hint.point;
                    drawPoint = bindPoint;
                    endBinding = createBindingForPoint(hint.shape, bindPoint);
                    nextConnectionHint = {
                        shapeId: hint.shape.id,
                        bindPoint,
                    };
                }
            }

            const preview = baseElements.map((el) => {
                if (el.id !== dragState.id) return el;

                const updated = updateDrawnElement(el, dragState, drawPoint);

                if (isConnectorElement(el)) {
                    if (endBinding) {
                        const midX = (el.x1 + drawPoint.x) / 2;
                        const midY = (el.y1 + drawPoint.y) / 2;

                        return {
                            ...updated,
                            x2: drawPoint.x,
                            y2: drawPoint.y,
                            lineStyle: updated.lineStyle === "curved" ? "curved" : "straight",
                            cx1: updated.lineStyle === "curved" ? updated.cx1 ?? midX : midX,
                            cy1: updated.lineStyle === "curved" ? updated.cy1 ?? midY : midY,
                            cx2: updated.lineStyle === "curved" ? updated.cx2 ?? updated.cx1 ?? midX : midX,
                            cy2: updated.lineStyle === "curved" ? updated.cy2 ?? updated.cy1 ?? midY : midY,
                            endBinding,
                        };
                    }

                    return {
                        ...updated,
                        endBinding: null,
                    };
                }

                return updated;
            });

            dragPreviewElementsRef.current = preview;
            elementsRef.current = preview;
            renderLivePreview(preview, [], nextConnectionHint);
            return;
        }

        if (dragState.mode === "move") {
            canvas.style.cursor = "move";

            let dx = point.x - dragState.startX;
            let dy = point.y - dragState.startY;
            const movingIds = new Set(dragState.ids);
            const baseElements = dragBaseElementsRef.current || elementsRef.current;
            const gridActive = isGridSnapActive(showGridRef.current, canvasPropsRef.current);

            let guides = [];

            if (gridActive) {
                const rawMovedPreview = moveConnectedArrows(
                    baseElements,
                    movingIds,
                    dx,
                    dy,
                    moveElement
                );

                const rawMovedElements = rawMovedPreview.filter((el) => movingIds.has(el.id));
                const movedBounds = getGroupBounds(rawMovedElements);

                if (movedBounds) {
                    dx += snapValueToGrid(movedBounds.x) - movedBounds.x;
                    dy += snapValueToGrid(movedBounds.y) - movedBounds.y;
                }
            } else {
                const movedPreview = moveConnectedArrows(
                    baseElements,
                    movingIds,
                    dx,
                    dy,
                    moveElement
                );

                const movedElements = movedPreview.filter((el) => movingIds.has(el.id));
                const alignment = getSmartAlignment({
                    elements: baseElements,
                    movingIds,
                    movedElements,
                });

                dx += alignment.snapDx;
                dy += alignment.snapDy;
                guides = alignment.guides;
            }

            let preview = moveConnectedArrows(
                baseElements,
                movingIds,
                dx,
                dy,
                moveElement
            );

            const reverseBindingResult = bindMovedShapesToNearbyConnectors(
                preview,
                movingIds,
                18
            );

            preview = reverseBindingResult.elements;

            dragPreviewElementsRef.current = preview;
            elementsRef.current = preview;
            renderLivePreview(preview, guides, reverseBindingResult.connectionHint);
            return;
        }

        if (dragState.mode === "resize") {
            const cursor = getCursorForHandle(dragState.handle);
            canvas.style.cursor = cursor;

            const baseElements = dragBaseElementsRef.current || elementsRef.current;
            const currentElement = baseElements.find((el) => el.id === dragState.id);
            if (!currentElement) return;

            const gridActive = isGridSnapActive(showGridRef.current, canvasPropsRef.current);
            let resizePoint = gridActive ? snapPointToGrid(point) : point;
            let guides = [];

            if (!gridActive) {
                const resizedPreview = resizeElement(currentElement, dragState, resizePoint);
                const alignment = getResizeSmartAlignment({
                    elements: baseElements,
                    resizingId: dragState.id,
                    resizedElement: resizedPreview,
                    handle: dragState.handle,
                });

                resizePoint = {
                    ...resizePoint,
                    x: resizePoint.x + alignment.snapDx,
                    y: resizePoint.y + alignment.snapDy,
                };
                guides = alignment.guides;
            }

            const resizedElement = resizeElement(currentElement, dragState, resizePoint);
            const originalContainerBounds = {
                x: dragState.originalX,
                y: dragState.originalY,
                w: dragState.originalW,
                h: dragState.originalH,
            };
            const resizedContainerBounds = getElementBounds(resizedElement);
            const childIds = new Set(dragState.containedChildIds || []);

            const resizedPreview = baseElements.map((el) => {
                if (el.id === dragState.id) {
                    return resizedElement;
                }

                if (childIds.has(el.id)) {
                    return scaleElementInsideBounds(
                        el,
                        originalContainerBounds,
                        resizedContainerBounds
                    );
                }

                return el;
            });

            const preview = resolveArrowBindings(resizedPreview);

            dragPreviewElementsRef.current = preview;
            elementsRef.current = preview;
            renderLivePreview(preview, guides);
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

    const onMouseMove = (event) => {
        event.persist?.();
        latestPointerMoveEventRef.current = event;

        if (pointerMoveFrameRef.current !== null) {
            return;
        }

        pointerMoveFrameRef.current = window.requestAnimationFrame(() => {
            pointerMoveFrameRef.current = null;

            const latestEvent = latestPointerMoveEventRef.current;
            latestPointerMoveEventRef.current = null;

            if (latestEvent) {
                runMouseMove(latestEvent);
            }
        });
    };

    const onMouseUp = (event) => {
        if (Date.now() < textCommitLockRef.current) {
            if (pointerMoveFrameRef.current !== null) {
                window.cancelAnimationFrame(pointerMoveFrameRef.current);
                pointerMoveFrameRef.current = null;
                latestPointerMoveEventRef.current = null;
            }

            dragBaseElementsRef.current = null;
            dragPreviewElementsRef.current = null;
            setDragState(null);
            setSelectionBox(null);
            setConnectionHint(null);
            setAlignmentGuides([]);
            return;
        }

        if (dragState && event) {
            runMouseMove(event);
        } else if (dragState && latestPointerMoveEventRef.current) {
            runMouseMove(latestPointerMoveEventRef.current);
        }

        if (pointerMoveFrameRef.current !== null) {
            window.cancelAnimationFrame(pointerMoveFrameRef.current);
            pointerMoveFrameRef.current = null;
        }
        latestPointerMoveEventRef.current = null;

        setAlignmentGuides([]);

        if (!dragState) return;

        if (dragState.mode === "pan") {
            setDragState(null);
            clearDragPreviewRefs();

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
            }

            return;
        }

        if (dragState.mode === "marquee") {
            setSelectionBox(null);
            setDragState(null);
            setConnectionHint(null);
            clearDragPreviewRefs();

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
            }

            return;
        }

        const previewElements = dragPreviewElementsRef.current;
        let finalElements = previewElements || elementsRef.current || elements;

        const finishedElement = dragState.id
            ? finalElements.find((el) => el.id === dragState.id)
            : null;

        finalElements = finalizeArrowBinding(finalElements, finishedElement);
        finalElements = resolveArrowBindings(finalElements);

        const finishedMode = dragState.mode;

        elementsRef.current = finalElements;
        setElements(finalElements);
        setDragState(null);
        setConnectionHint(null);
        clearDragPreviewRefs();
        commitHistory(finalElements);

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
            canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
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

                fontSize: target.fontSize || DEFAULT_TEXT_STYLE.fontSize,
                lineHeight: target.lineHeight || DEFAULT_TEXT_STYLE.lineHeight,
                fontFamily: target.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
                bold: !!target.bold,
                italic: !!target.italic,
                underline: !!target.underline,
                textAlign: target.textAlign || DEFAULT_TEXT_STYLE.textAlign || "left",
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
        return getLocalDrawingById(id);
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
            localDraftIdRef.current = drawing.id || parsed.id || null;
            const actualDrawing = parsed.data || parsed;

            const openedId = drawing.id || parsed.id || null;
            const isOpenedLocalId =
                openedId && String(openedId).startsWith("local_");

            setCurrentDrawingMeta({
                id: isOpenedLocalId ? null : openedId,
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

            if (actualDrawing.canvasProps && setCanvasProps) {
                setCanvasProps(actualDrawing.canvasProps);
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
                <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageFileSelected}
                />

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
                    onCommitStart={() => {
                        textCommitLockRef.current = Date.now() + 250;
                    }}
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
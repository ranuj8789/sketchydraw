import React, {useEffect, useMemo, useRef, useState} from "react";
import {normalizeTextStyle} from "../../canvas/textRenderStyle";
import {getSocialMediaPreset} from "../../utils/socialMediaPresets";
import MyDrawingsPopup from "../MyDrawingsPopup/MyDrawingsPopup";
import {isPaidUser} from "../../utils/auth";
import "./CanvasBoard.css";
import TextEditor from "./../TextEditor";
import {getPointerPosition} from "../../utils/geometry";
import {
    createBindingForPoint,
    findBindableShapeNearPoint,
    isConnectorElement,
} from "../../canvas/canvasConnectionHelpers";
import {DEFAULT_TEXT_STYLE} from "../../canvas/textStyle";
import {
    getElementBounds,
    getResizeHandleAtPoint,
    getRectangleBorderResizeHandleAtPoint,
} from "../../utils/elementBounds";
import {resizeElement} from "../../utils/resize";
import {
    AUTO_SELECT_TYPES,
    SHAPE_TYPES,
    LINE_TYPES,
    TEXT_CONTAINER_TYPES,
    isSystemDesignType,
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
    normalizeElementsGeometry,
    updateDrawnElement,
} from "../../canvas/canvasElementOps";
import {
    findElementHitsAtPoint,
    findTopElementAtPoint,
    findTopElementHitAtPoint,
    getCurveHandleAtPoint,
} from "../../canvas/canvasHelpers";
import {
    normalizeSelectionRect,
    rectsIntersect,
} from "../../canvas/canvasBoardUtils";
import {getCursorForHandle} from "../../canvas/canvasCursor";
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
import {useCanvasResize} from "../../canvas/useCanvasResize";
import {useCanvasRender} from "../../canvas/useCanvasRender";
import {renderCanvas} from "../../canvas/canvasRender";
import {useCanvasKeyboardShortcuts} from "../../canvas/useCanvasKeyboardShortcuts";
import {
    cloneElementsForPaste,
    readElementsFromSystemClipboard,
    writeElementsToSystemClipboard,
} from "../../canvas/canvasClipboard";
import {screenToWorld} from "../../canvas/canvasViewport";
import {buildTextCanvasFont} from "../../canvas/textRenderStyle";
import {
    NOTEBOOK_LINE_GAP,
} from "../../canvas/notebook/notebookPageConstants";
import {
    getNotebookPageRect,
    getNotebookPageSize,
} from "../../canvas/notebook/notebookPages";
import {
    getNotebookTextAlignedTopY,
    getNotebookTextStyle,
    isNotebookPattern,
    snapTextPointToNotebookLine,
} from "../../canvas/notebook/notebookTextSnap";
import BoardContextMenu from "../BoardContextMenu";
import {
    exportCanvasToPDF,
    exportCanvasToSVG,
    exportCanvasToPNG,
    copyCanvasToClipboard,
    copyCanvasAreaToClipboard,
} from "../../utils/exportBoard";

import CanvasBoardActions from "./CanvasBoardActions/CanvasBoardActions";
import {useSaveDrawing} from "./useSaveDrawing";
import {useVideoExport} from "./useVideoExport";
import SaveDrawingPopup from "../SaveDrawingPopup/SaveDrawingPopup";
import {DEFAULT_GROUP, DEFAULT_TITLE} from "../DrawingGroupStore/drawingGroupStore";
import {
    getLocalDrawingById,
    getLatestLocalDrawing,
    saveLocalDrawing,
} from "../DrawingGroupStore/localDrawingStore";
import {saveDrawingSnapshotAsync} from "../../utils/indexedDbStorage";
import {loadDrawingJson} from "../../canvas/drawingStorage";
import {loadCanvasFonts} from "../../canvas/fontLoader";
import {
    createAnimationConfig,
    getAnimationLabel,
    getAnimationPresetsForSelection,
} from "../../canvas/animationRegistry";
import { createAnimeCanvasClock } from "../3d/anime3dEngine";


const SOCIAL_TEXT_PAGINATION_PRESETS = new Set(["post", "story", "status"]);
const MAX_SOCIAL_TEXT_PAGES = 20;

function splitTextIntoSocialPages(text, style, maxWidth, maxHeight) {
    if (typeof document === "undefined") return [String(text || "")];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = buildTextCanvasFont(style);

    const safeWidth = Math.max(80, Number(maxWidth) || 80);
    const safeHeight = Math.max(style.lineHeight, Number(maxHeight) || style.lineHeight);
    const maxLinesPerPage = Math.max(1, Math.floor(safeHeight / style.lineHeight));
    const wrappedLines = [];

    String(text || "").split("\n").forEach((paragraph) => {
        if (!paragraph) {
            wrappedLines.push("");
            return;
        }

        const words = paragraph.split(/\s+/);
        let line = "";

        words.forEach((word) => {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width <= safeWidth) {
                line = candidate;
                return;
            }

            if (line) wrappedLines.push(line);

            if (ctx.measureText(word).width > safeWidth) {
                let chunk = "";
                for (const char of word) {
                    const next = chunk + char;
                    if (chunk && ctx.measureText(next).width > safeWidth) {
                        wrappedLines.push(chunk);
                        chunk = char;
                    } else {
                        chunk = next;
                    }
                }
                line = chunk;
            } else {
                line = word;
            }
        });

        wrappedLines.push(line);
    });

    const pages = [];
    for (let index = 0; index < wrappedLines.length && pages.length < MAX_SOCIAL_TEXT_PAGES; index += maxLinesPerPage) {
        pages.push(wrappedLines.slice(index, index + maxLinesPerPage).join("\n"));
    }

    return pages.length ? pages : [String(text || "")];
}

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
const POINTER_DRAG_THRESHOLD_PX = 3;
const GRID_SIZE = 24;

function isBelowPointerDragThreshold(dragState, point, zoom = 1) {
    if (
        !dragState ||
        !point ||
        !Number.isFinite(dragState.startX) ||
        !Number.isFinite(dragState.startY)
    ) {
        return false;
    }

    return Math.hypot(
        point.x - dragState.startX,
        point.y - dragState.startY
    ) * Math.max(0.1, Number(zoom) || 1) < POINTER_DRAG_THRESHOLD_PX;
}

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

function detachMovedTextOutsideParents(elements, movingIds) {
    const movedSet = movingIds instanceof Set ? movingIds : new Set(movingIds || []);
    if (movedSet.size === 0) return elements;

    const elementsById = new Map((elements || []).map((element) => [element.id, element]));

    return (elements || []).map((element) => {
        if (element.type !== "text" || !element.parentId || !movedSet.has(element.id)) {
            return element;
        }

        const parentBounds = getElementBounds(elementsById.get(element.parentId));
        const textBounds = getElementBounds(element);

        return isBoundsInside(textBounds, parentBounds, 0)
            ? element
            : { ...element, parentId: null };
    });
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
        element.type === "user" ||
        isSystemDesignType(element.type) ||
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

const getIdleCanvasCursor = (tool, isSpacePressed = false) => {
    if (isSpacePressed || tool === "hand") return "grab";
    if (tool === "eraser") return "crosshair";
    if (tool === "select") return "default";
    return "crosshair";
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
            {key: "left", value: bounds.x},
            {key: "centerX", value: bounds.x + bounds.w / 2},
            {key: "right", value: bounds.x + bounds.w},
        ],
        horizontal: [
            {key: "top", value: bounds.y},
            {key: "centerY", value: bounds.y + bounds.h / 2},
            {key: "bottom", value: bounds.y + bounds.h},
        ],
    };
}

function getSmartAlignment({elements, movingIds, movedElements}) {
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

function getResizeSmartAlignment({elements, resizingId, resizedElement, handle}) {
    const resizedBounds = getElementBounds(resizedElement);
    if (!resizedBounds) {
        return {guides: [], snapDx: 0, snapDy: 0};
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
                                        timelineFrames = [],
                                        currentFrameIndex = 0,
                                        renderOptions = {},
                                        onCreateTimelineFrame,
                                        onUpdateTimelineFrame,
                                        onReplaceTimeline,
                                        onRestoreTimeline,
                                        onStartAnimationPreview,
                                        onCreateSocialTextPages,
                                        onSelectTimelineFrame,
                                        socialCreatorPreset = null,
                                        focusMode = false,
                                    }) {
    const wrapRef = useRef(null);
    const localDraftIdRef = useRef(null);
    const hasRestoredLocalDraftRef = useRef(false);
    const imageInputRef = useRef(null);
    const imageInsertPointRef = useRef(null);
    const pointerMoveFrameRef = useRef(null);
    const latestPointerMoveEventRef = useRef(null);

    const lastMouseClientPointRef = useRef(null);
    const lastPastePointRef = useRef(null);
    const contextMenuPastePointRef = useRef(null);

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
    const [live3DTimeMs, setLive3DTimeMs] = useState(0);

    const [contextMenu, setContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        objectId: null,
    });

    const [dragState, setDragState] = useState(null);
    const [alignmentGuides, setAlignmentGuides] = useState([]);
    const [editor, setEditor] = useState(null);
    const [selectionBox, setSelectionBox] = useState(null);
    const [clipboard, setClipboard] = useState([]);
    const [connectionHint, setConnectionHint] = useState(null);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [myDrawingsOpen, setMyDrawingsOpen] = useState(false);
    const [animationMenuOpen, setAnimationMenuOpen] = useState(false);
    const [animationDependencyPicker, setAnimationDependencyPicker] = useState(null);

    const socialGuide = useMemo(() => {
        const preset = getSocialMediaPreset(socialCreatorPreset);
        if (!preset || !canvasSize?.width || !canvasSize?.height) return null;

        const margin = 38;
        const maxWidth = Math.max(120, canvasSize.width - margin * 2);
        const maxHeight = Math.max(160, canvasSize.height - margin * 2);
        const ratio = preset.width / preset.height;

        let width = Math.min(maxWidth, maxHeight * ratio);
        let height = width / ratio;
        if (height > maxHeight) {
            height = maxHeight;
            width = height * ratio;
        }

        const left = (canvasSize.width - width) / 2;
        const top = (canvasSize.height - height) / 2;
        const scaleX = width / preset.width;
        const scaleY = height / preset.height;
        const safe = {
            left: left + preset.safe.left * scaleX,
            top: top + preset.safe.top * scaleY,
            width: width - (preset.safe.left + preset.safe.right) * scaleX,
            height: height - (preset.safe.top + preset.safe.bottom) * scaleY,
        };

        const outsideElements = (elements || []).filter((element) => {
            if (!element || element.isDeleted) return false;
            const bounds = getElementBounds(element);
            if (!bounds) return false;
            const screenBounds = {
                left: bounds.x * viewport.zoom + viewport.offsetX,
                top: bounds.y * viewport.zoom + viewport.offsetY,
                right: (bounds.x + bounds.w) * viewport.zoom + viewport.offsetX,
                bottom: (bounds.y + bounds.h) * viewport.zoom + viewport.offsetY,
            };
            return (
                screenBounds.left < safe.left ||
                screenBounds.top < safe.top ||
                screenBounds.right > safe.left + safe.width ||
                screenBounds.bottom > safe.top + safe.height
            );
        });

        return { preset, left, top, width, height, safe, outsideCount: outsideElements.length };
    }, [socialCreatorPreset, canvasSize, elements, viewport]);

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
        timelineFrames,
        currentFrameIndex,
        currentDrawingMeta,
        setCurrentDrawingMeta,
    });

    useEffect(() => {
        const autoSaveTimer = window.setInterval(() => {
            if (isSavingDrawing || savePopupOpen) return;
            saveCurrentDrawing({ saveAsNew: false, silent: true });
        }, 10000);

        return () => window.clearInterval(autoSaveTimer);
    }, [isSavingDrawing, savePopupOpen, saveCurrentDrawing]);

    const {
        isVideoExporting,
        videoExportProgress,
        downloadUndoRedoVideo,
    } = useVideoExport({
        history,
        elements,
        timelineFrames,
        canvasSize,
        canvasProps,
    });

    useCanvasResize(wrapRef, setCanvasSize);

    const TEXT_EDITOR_PREVIEW_ID = "__text_editor_preview__";

    const getEditorPreviewTextElement = (activeEditor, currentElements) => {
        if (!activeEditor) return null;

        const baseElement =
            activeEditor.mode === "edit" && activeEditor.id
                ? currentElements.find(
                    (el) => el.id === activeEditor.id && el.type === "text"
                )
                : null;

        const value = activeEditor.value ?? "";

        if (!value && activeEditor.mode === "create") {
            return null;
        }

        return {
            ...(baseElement || {}),
            id: baseElement?.id || TEXT_EDITOR_PREVIEW_ID,
            type: "text",

            // Important: edit mode and final mode now use the same canvas renderer.
            x: activeEditor.x,
            y: activeEditor.y,
            w: activeEditor.w || baseElement?.w || 120,
            h: activeEditor.h || baseElement?.h || 32,
            text: value || " ",
            stroke: activeEditor.stroke || baseElement?.stroke || stroke,
            parentId: activeEditor.parentId || baseElement?.parentId || null,

            fontSize:
                activeEditor.fontSize ||
                baseElement?.fontSize ||
                DEFAULT_TEXT_STYLE.fontSize,
            lineHeight: isNotebookPattern(canvasPropsRef.current)
                ? NOTEBOOK_LINE_GAP
                : activeEditor.lineHeight ||
                baseElement?.lineHeight ||
                DEFAULT_TEXT_STYLE.lineHeight,
            fontFamily:
                activeEditor.fontFamily ||
                baseElement?.fontFamily ||
                DEFAULT_TEXT_STYLE.fontFamily,
            bold:
                activeEditor.bold ?? baseElement?.bold ?? DEFAULT_TEXT_STYLE.bold,
            italic:
                activeEditor.italic ?? baseElement?.italic ?? DEFAULT_TEXT_STYLE.italic,
            underline:
                activeEditor.underline ??
                baseElement?.underline ??
                DEFAULT_TEXT_STYLE.underline,
            textAlign:
                activeEditor.textAlign ||
                baseElement?.textAlign ||
                DEFAULT_TEXT_STYLE.textAlign ||
                "left",
            richText: activeEditor.richText || baseElement?.richText || [],

            __textEditorPreview: true,
        };
    };

    const renderElements = (() => {
        if (!editor) return elements;

        const previewElement = getEditorPreviewTextElement(editor, elements);

        if (!previewElement) return elements;

        if (editor.mode === "edit" && editor.id) {
            return elements.map((el) =>
                el.id === editor.id ? previewElement : el
            );
        }

        return [...elements, previewElement];
    })();

    const renderSelectedIds =
        editor?.mode === "edit" && editor?.id
            ? selectedIds.filter((id) => id !== editor.id)
            : selectedIds;

    useEffect(() => {
        const focusNotebookPageInViewport = (event) => {
            const pageIndex = Math.max(0, Number(event?.detail?.pageIndex || 0));
            const requestedZoom = Number(event?.detail?.zoom);
            const zoom = Number.isFinite(requestedZoom) && requestedZoom > 0
                ? requestedZoom
                : 1;
            const pageRect = getNotebookPageRect(pageIndex, canvasPropsRef.current || {});
            const canvasWidth = canvasSizeRef.current?.width || 1200;

            setViewport({
                zoom,
                offsetX: Math.max(30, (canvasWidth - pageRect.w * zoom) / 2),
                offsetY: 40 - pageRect.y * zoom,
            });
        };

        const centerNotebookDocument = () => {
            const pageSize = getNotebookPageSize(canvasPropsRef.current || {});
            const canvasWidth = canvasSizeRef.current?.width || 1200;

            setViewport((prev) => ({
                ...prev,
                offsetX: Math.max(30, (canvasWidth - pageSize.width * prev.zoom) / 2),
                offsetY: 40,
            }));
        };

        window.addEventListener("sketchydraw:notebook-page-added", focusNotebookPageInViewport);
        window.addEventListener("sketchydraw:notebook-page-focus", focusNotebookPageInViewport);
        window.addEventListener("sketchydraw:notebook-center", centerNotebookDocument);

        return () => {
            window.removeEventListener("sketchydraw:notebook-page-added", focusNotebookPageInViewport);
            window.removeEventListener("sketchydraw:notebook-page-focus", focusNotebookPageInViewport);
            window.removeEventListener("sketchydraw:notebook-center", centerNotebookDocument);
        };
    }, [setViewport]);

    useEffect(() => {
        const handleVideoExport = (event) => {
            downloadUndoRedoVideo({
                gapSeconds: event.detail?.gapSeconds,
                preAnimationDelaySeconds: event.detail?.preAnimationDelaySeconds,
                playbackSpeed: event.detail?.playbackSpeed,
                ffmpegSpeed: event.detail?.ffmpegSpeed,
                exportScale: event.detail?.exportScale,
                resolution: event.detail?.resolution,
                zoomPercent: event.detail?.zoomPercent,
                fitContent: event.detail?.fitContent,
                pan: event.detail?.pan,
                textScalePercent: event.detail?.textScalePercent,
                trimTrailingPause: event.detail?.trimTrailingPause,
                timelineFrames: event.detail?.timelineFrames,
                mode: event.detail?.mode || "server",
                frameFrom: event.detail?.frameFrom,
                frameTo: event.detail?.frameTo,
                totalFrames: event.detail?.totalFrames,
                fileName: event.detail?.fileName,
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

    const hasLive3DMotion = useMemo(
        () => (renderElements || []).some(
            (element) => element?.type === "webgl3d" && element.motion3d && element.motion3d !== "none"
        ),
        [renderElements]
    );

    useEffect(() => {
        if (!hasLive3DMotion || renderOptions?.animationMode) return undefined;
        const clock = createAnimeCanvasClock(setLive3DTimeMs);
        return () => clock.cancel();
    }, [hasLive3DMotion, renderOptions?.animationMode]);

    const effectiveRenderOptions = useMemo(() => (
        renderOptions?.animationMode
            ? renderOptions
            : { ...renderOptions, animationTimeMs: live3DTimeMs, live3DPreview: hasLive3DMotion }
    ), [renderOptions, live3DTimeMs, hasLive3DMotion]);

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
        renderOptions: effectiveRenderOptions,
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

    useEffect(() => {
        // Selecting or creating an object must not open animation controls.
        // The user opens them explicitly with the lightning button.
        setAnimationMenuOpen(false);
    }, [selectedIds.join("|")]);

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
        window.addEventListener("sketchydraw:font-loaded", rerenderImages);

        return () => {
            window.removeEventListener("sketchydraw:image-loaded", rerenderImages);
            window.removeEventListener("sketchydraw:font-loaded", rerenderImages);
        };
    }, []);

    useEffect(() => {
        loadCanvasFonts(elements);
    }, [elements]);

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
            const loadedDrawing = loadDrawingJson(parsed);
            const nextElements = loadedDrawing.elements;

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

            const savedFrames = loadedDrawing.frames;
            const savedFrameIndex = loadedDrawing.activeFrameIndex;
            if (Array.isArray(savedFrames) && savedFrames.length) {
                onRestoreTimeline?.(savedFrames, savedFrameIndex);
            } else {
                onReplaceTimeline?.(nextElements);
            }
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

            const safeFrames = Array.isArray(timelineFrames) && timelineFrames.length
                ? timelineFrames
                : [{
                    id: "frame_1",
                    name: "Frame 1",
                    durationMs: 10000,
                    hiddenElementIds: [],
                    elements,
                }];
            const safeFrameIndex = Math.max(0, Math.min(currentFrameIndex, safeFrames.length - 1));
            const autoSavePayload = {
                version: 1,
                app: "SketchyDraw",
                title: currentDrawingMeta?.title || DEFAULT_TITLE,
                groupName: currentDrawingMeta?.groupName || DEFAULT_GROUP,
                workspace: currentDrawingMeta?.groupName || DEFAULT_GROUP,
                description: currentDrawingMeta?.description || "",
                savedAt: new Date().toISOString(),
                data: {
                    version: 1,
                    elements: safeFrames[safeFrameIndex]?.elements || elements,
                    frames: safeFrames,
                    timelineFrames: safeFrames,
                    activeFrameIndex: safeFrameIndex,
                    currentFrameIndex: safeFrameIndex,
                    viewport,
                    canvas: canvasSize,
                    canvasProps,
                },
            };

            const localRow = saveLocalDrawing({
                id: localSaveId,
                title: currentDrawingMeta?.title || DEFAULT_TITLE,
                groupName: currentDrawingMeta?.groupName || DEFAULT_GROUP,
                description: currentDrawingMeta?.description || "",
                elements,
                viewport,
                canvasSize,
                canvasProps,
                drawingJson: JSON.stringify(autoSavePayload),
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
        timelineFrames,
        currentFrameIndex,
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
            objectId: null,
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
                setAnimationDependencyPicker(null);
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

        const onWindowBlur = () => setIsSpacePressed(false);

        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("blur", onWindowBlur);

        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onWindowBlur);
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
                canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
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

            const next = normalizeElementsGeometry(elements.map((el) => {
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
            }));

            setElements(next);
            commitHistory(next);
            onUpdateTimelineFrame?.(next);
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

        lastMouseClientPointRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
        };

        const screenPoint = getPointerPosition(e, canvasRef.current);
        const worldPoint = screenToWorld(screenPoint, viewportRef.current);

        lastPastePointRef.current = worldPoint;
        contextMenuPastePointRef.current = worldPoint;

        const target = findTopElementAtPoint(elementsRef.current || [], worldPoint);
        if (target && !(selectedIdsRef.current || []).includes(target.id)) {
            selectedIdsRef.current = [target.id];
            setSelectedIds([target.id]);
        }

        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            objectId: target?.id || null,
        });
    };

    const getSelectedElements = () => {
        const selectedSet = new Set(selectedIds || []);
        return elements.filter((el) => selectedSet.has(el.id));
    };

    const duplicateSelectedElements = () => {
        const selected = getSelectedElements();
        if (!selected.length) return;

        const makeDuplicateId = (sourceId = "object") => {
            if (
                typeof crypto !== "undefined" &&
                typeof crypto.randomUUID === "function"
            ) {
                return `${sourceId}_copy_${crypto.randomUUID()}`;
            }

            return `${sourceId}_copy_${Date.now()}_${Math.random()
                .toString(16)
                .slice(2)}`;
        };

        const idMap = new Map(
            selected.map((element) => [
                element.id,
                makeDuplicateId(element.id || element.type || "object"),
            ])
        );

        const cloneValue = (value) => {
            if (typeof structuredClone === "function") {
                return structuredClone(value);
            }

            return JSON.parse(JSON.stringify(value));
        };

        const remapBinding = (binding) => {
            if (!binding || typeof binding !== "object") return binding;

            const clonedBinding = cloneValue(binding);
            if (
                clonedBinding.elementId &&
                idMap.has(clonedBinding.elementId)
            ) {
                clonedBinding.elementId = idMap.get(
                    clonedBinding.elementId
                );
            }

            return clonedBinding;
        };

        const offset = 24;

        const duplicates = selected.map((element) => {
            const duplicate = cloneValue(element);
            duplicate.id = idMap.get(element.id);

            if (duplicate.type === "line" || duplicate.type === "arrow") {
                duplicate.x1 = Number(duplicate.x1 || 0) + offset;
                duplicate.y1 = Number(duplicate.y1 || 0) + offset;
                duplicate.x2 = Number(duplicate.x2 || 0) + offset;
                duplicate.y2 = Number(duplicate.y2 || 0) + offset;
            } else if (
                duplicate.type === "pencil" &&
                Array.isArray(duplicate.points)
            ) {
                duplicate.points = duplicate.points.map((point) => ({
                    ...point,
                    x: Number(point.x || 0) + offset,
                    y: Number(point.y || 0) + offset,
                }));
            } else {
                duplicate.x = Number(duplicate.x || 0) + offset;
                duplicate.y = Number(duplicate.y || 0) + offset;
            }

            if (
                duplicate.parentId &&
                idMap.has(duplicate.parentId)
            ) {
                duplicate.parentId = idMap.get(duplicate.parentId);
            }

            duplicate.startBinding = remapBinding(
                duplicate.startBinding
            );
            duplicate.endBinding = remapBinding(
                duplicate.endBinding
            );

            if (Array.isArray(duplicate.boundElements)) {
                duplicate.boundElements =
                    duplicate.boundElements.map((binding) =>
                        remapBinding(binding)
                    );
            }

            return duplicate;
        });

        const nextElements = [...elements, ...duplicates];
        setElements(nextElements);
        setSelectedIds(duplicates.map((element) => element.id));
        setAnimationMenuOpen(false);
        commitHistory(nextElements);
        onUpdateTimelineFrame?.(nextElements);
    };

    const selectedAnimationElements = getSelectedElements();
    const selectedAnimationPresets = getAnimationPresetsForSelection(selectedAnimationElements);
    const selectedAnimationType =
        selectedAnimationElements.length === 1
            ? selectedAnimationElements[0]?.animation?.type || "none"
            : "multiple";
    const contextMenuObject = elements.find(
        (element) => element.id === contextMenu.objectId
    ) || null;
    const contextAnimationPresets = contextMenuObject
        ? getAnimationPresetsForSelection([contextMenuObject])
        : [];

    const applyAnimationToSelected = (animationType) => {
        if (!selectedIds.length) return;

        const selectedSet = new Set(selectedIds);
        const animation = createAnimationConfig(animationType);

        const next = elements.map((element) => {
            if (!selectedSet.has(element.id)) return element;

            return {
                ...element,
                animation,
            };
        });

        elementsRef.current = next;
        setElements(next);
        commitHistory(next);
        onUpdateTimelineFrame?.(next);
        setAnimationMenuOpen(false);

        if (animation.type !== "none") {
            onStartAnimationPreview?.();
        }
    };

    const updateContextObjectAnimation = (updater) => {
        const objectId = contextMenu.objectId;
        if (!objectId) return;

        const next = (elementsRef.current || []).map((element) => {
            if (element.id !== objectId) return element;
            const currentAnimation = element.animation || createAnimationConfig("none");
            return {
                ...element,
                animation: typeof updater === "function" ? updater(currentAnimation) : updater,
            };
        });

        elementsRef.current = next;
        setElements(next);
        commitHistory(next);
        onUpdateTimelineFrame?.(next);
    };

    const setContextObjectAnimation = (animationType) => {
        const previous = (elementsRef.current || []).find(
            (element) => element.id === contextMenu.objectId
        )?.animation;
        updateContextObjectAnimation(createAnimationConfig(animationType, {
            dependsOnId: previous?.dependsOnId || "",
            dependencyMode: previous?.dependencyMode || "absolute",
            dependencyOffsetMs: Number(previous?.dependencyOffsetMs) || 0,
        }));
        if (animationType !== "none") onStartAnimationPreview?.();
    };

    const startContextAnimationDependencyPicker = () => {
        if (!contextMenu.objectId) return;
        setAnimationDependencyPicker({ sourceId: contextMenu.objectId });
    };

    const pickAnimationDependency = (point) => {
        const sourceId = animationDependencyPicker?.sourceId;
        if (!sourceId) return false;

        const target = findTopElementAtPoint(elementsRef.current || [], point);
        if (!target || target.id === sourceId) return true;

        const createsCycle = (() => {
            const byId = new Map((elementsRef.current || []).map((element) => [element.id, element]));
            let cursor = target;
            const visited = new Set();
            while (cursor?.id && !visited.has(cursor.id)) {
                if (cursor.id === sourceId) return true;
                visited.add(cursor.id);
                cursor = byId.get(cursor.animation?.dependsOnId);
            }
            return false;
        })();
        if (createsCycle) return true;

        const next = (elementsRef.current || []).map((element) =>
            element.id === sourceId
                ? {
                    ...element,
                    animation: {
                        ...(element.animation || createAnimationConfig("fadeIn")),
                        dependsOnId: target.id,
                        dependencyMode: "afterEnd",
                        dependencyOffsetMs: 0,
                    },
                }
                : element
        );
        elementsRef.current = next;
        setElements(next);
        commitHistory(next);
        onUpdateTimelineFrame?.(next);
        setSelectedIds([sourceId]);
        setAnimationDependencyPicker(null);
        return true;
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
                                   richText,
                               }) => {
        textCommitLockRef.current = Date.now() + 250;

        if (
            SOCIAL_TEXT_PAGINATION_PRESETS.has(socialCreatorPreset) &&
            socialGuide?.safe &&
            typeof onCreateSocialTextPages === "function"
        ) {
            const safeTopLeft = screenToWorld(
                { x: socialGuide.safe.left, y: socialGuide.safe.top },
                viewportRef.current
            );
            const safeBottomRight = screenToWorld(
                {
                    x: socialGuide.safe.left + socialGuide.safe.width,
                    y: socialGuide.safe.top + socialGuide.safe.height,
                },
                viewportRef.current
            );
            const normalizedStyle = normalizeTextStyle({
                stroke, fontSize, lineHeight, fontFamily, bold, italic, underline, textAlign,
            });
            const availableWidth = Math.max(80, safeBottomRight.x - x);
            const firstPageHeight = Math.max(
                normalizedStyle.lineHeight,
                safeBottomRight.y - y
            );
            const followingPageHeight = Math.max(
                normalizedStyle.lineHeight,
                safeBottomRight.y - safeTopLeft.y
            );

            const firstPass = splitTextIntoSocialPages(
                text,
                normalizedStyle,
                availableWidth,
                firstPageHeight
            );

            let pages = firstPass;
            if (firstPass.length > 1) {
                const remainingText = firstPass.slice(1).join("\n");
                pages = [
                    firstPass[0],
                    ...splitTextIntoSocialPages(
                        remainingText,
                        normalizedStyle,
                        Math.max(80, safeBottomRight.x - safeTopLeft.x),
                        followingPageHeight
                    ),
                ].slice(0, MAX_SOCIAL_TEXT_PAGES);
            }

            if (pages.length > 1) {
                onCreateSocialTextPages({
                    pages,
                    firstPagePosition: { x, y },
                    followingPagePosition: { x: safeTopLeft.x, y: safeTopLeft.y },
                    style: normalizedStyle,
                    parentId,
                });
                setEditor(null);
                setTool("select");
                return;
            }
        }

        createTextElementHelper({
            elements: elementsRef.current,
            setElements: (next) => {
                elementsRef.current = next;
                dragBaseElementsRef.current = null;
                dragPreviewElementsRef.current = null;
                setElements(next);
            },
            setSelectedIds,
            commitHistory: (next) => {
                commitHistory(next);
                onCreateTimelineFrame?.(next);
            },
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
            richText,
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
            commitHistory: (next) => {
                commitHistory(next);
                onUpdateTimelineFrame?.(next);
            },
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

    const startMove = (target, point, forcedSelectedIds = null) => {
        if (!target || !point) return;

        const movingIds = Array.isArray(forcedSelectedIds) && forcedSelectedIds.length > 0
            ? forcedSelectedIds
            : [target.id];

        dragBaseElementsRef.current = elementsRef.current;
        dragPreviewElementsRef.current = null;

        setDragState({
            mode: "move",
            startX: point.x,
            startY: point.y,
            ids: movingIds,
        });
    };

    const startTextCreate = (point, parentId = null, forcedStroke = stroke) => {
        textCommitLockRef.current = Date.now() + 300;

        setSelectedIds([]);
        setDragState(null);

        const baseStyle = normalizeTextStyle({
            ...DEFAULT_TEXT_STYLE,
            ...currentTextStyle,
            stroke: forcedStroke,
        });

        const style = getNotebookTextStyle(
            baseStyle,
            canvasPropsRef.current
        );

        let textPoint = point;
        let maxWidth = null;
        let maxHeight = null;

        if (parentId) {
            const parent = elementsRef.current.find((element) => element.id === parentId);
            const parentBounds = getElementBounds(parent);
            if (parentBounds) {
                const padding = 12;
                maxWidth = Math.max(8, parentBounds.w - padding * 2);
                maxHeight = Math.max(8, parentBounds.h - padding * 2);
                const initialTextWidth = Math.min(60, maxWidth);
                textPoint = {
                    x: Math.min(
                        Math.max(point.x, parentBounds.x + padding),
                        parentBounds.x + parentBounds.w - padding - initialTextWidth
                    ),
                    y: Math.max(point.y, parentBounds.y + padding),
                };
            }
        }

        // Text should never snap in normal grid/blank mode.
        // Only notebook mode aligns text to the ruled writing line.
        if (isNotebookPattern(canvasPropsRef.current)) {
            textPoint = snapTextPointToNotebookLine(
                point,
                style,
                canvasPropsRef.current
            );
        }

        setEditor({
            mode: "create",
            x: textPoint.x,
            y: textPoint.y,
            value: "",
            stroke: style.stroke,
            parentId,
            maxWidth,
            maxHeight,

            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            textAlign: style.textAlign,
        });
    };
    const getPastePointFromMouseCursor = () => {
        const canvas = canvasRef.current;
        const lastMouse = lastMouseClientPointRef.current;

        if (!canvas || !lastMouse) {
            return lastPastePointRef.current;
        }

        const rect = canvas.getBoundingClientRect();

        const screenPoint = {
            x: lastMouse.clientX - rect.left,
            y: lastMouse.clientY - rect.top,
        };

        const worldPoint = screenToWorld(screenPoint, viewportRef.current);

        lastPastePointRef.current = worldPoint;

        return worldPoint;
    };

    useCanvasKeyboardShortcuts({
        editor,
        selectedIds,
        elements,
        clipboard,
        setClipboard,
        setElements,
        setSelectedIds,
        commitHistory: (next) => {
            commitHistory(next);
            onUpdateTimelineFrame?.(next);
        },
        getPastePoint: getPastePointFromMouseCursor,
    });

    const startMarqueeSelection = (point, clickTargetId = null) => {
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
            clickTargetId,
        });
    };

    const isRectangleElement = (element) =>
        element?.type === "rect" || element?.type === "rectangle";

    const isSelectionBoxInsideElement = (selectionBox, element) => {
        const bounds = getElementBounds(element);
        if (!selectionBox || !bounds) return false;

        return (
            selectionBox.x >= bounds.x &&
            selectionBox.y >= bounds.y &&
            selectionBox.x + selectionBox.w <= bounds.x + bounds.w &&
            selectionBox.y + selectionBox.h <= bounds.y + bounds.h
        );
    };

    const shouldSelectElementByMarquee = (selectionBox, element) => {
        const bounds = getElementBounds(element);
        if (!bounds) return false;

        /**
         * Important:
         * If user is dragging selection box INSIDE a rectangle,
         * that rectangle behaves like canvas/frame.
         * So do NOT select that outer rectangle.
         */
        if (
            isRectangleElement(element) &&
            isSelectionBoxInsideElement(selectionBox, element)
        ) {
            return false;
        }

        return rectsIntersect(selectionBox, bounds);
    };

    const isContainerRectangle = (element, currentElements) => {
        if (!isRectangleElement(element)) return false;

        const bounds = getElementBounds(element);
        if (!bounds) return false;

        return findContainedElementIds(
            currentElements,
            element,
            bounds
        ).length > 0;
    };

    const getSelectCursorForPoint = (point) => {
        const currentElements = elementsRef.current || [];
        const currentSelectedIds = selectedIdsRef.current || [];

        const hit = findTopElementHitAtPoint(currentElements, point);
        const target = hit?.element || null;

        if (!target) return "default";

        const isAlreadySelected = currentSelectedIds.includes(target.id);
        const zoom = viewportRef.current?.zoom || 1;

        // Visible handles always resize an already-selected object.
        if (isAlreadySelected && currentSelectedIds.length === 1) {
            const handle = getResizeHandleAtPoint(
                target,
                point.x,
                point.y,
                zoom
            );

            if (handle && target.type !== "pencil") {
                return getCursorForHandle(handle);
            }
        }

        // Only a real rectangle border acts as a resize area. The large fill
        // area inside the rectangle never shows a resize cursor.
        if (isRectangleElement(target)) {
            const borderHandle = getRectangleBorderResizeHandleAtPoint(
                target,
                point.x,
                point.y,
                zoom
            );

            if (borderHandle) {
                return getCursorForHandle(borderHandle);
            }
        }

        if (target.type === "line" || target.type === "arrow") {
            return "pointer";
        }

        return isAlreadySelected ? "move" : "pointer";
    };

    const handleSelectModeMouseDown = (point, event) => {
        const currentSelectedIds = selectedIdsRef.current || [];
        const currentElements = elementsRef.current || [];

        if (event?.altKey) {
            const hits = findElementHitsAtPoint(currentElements, point);
            if (!hits.length) {
                startMarqueeSelection(point);
                return;
            }
            const currentIndex = hits.findIndex((hit) => currentSelectedIds.includes(hit.element.id));
            const nextHit = hits[(currentIndex + 1 + hits.length) % hits.length];
            const nextSelectedIds = [nextHit.element.id];
            selectedIdsRef.current = nextSelectedIds;
            setSelectedIds(nextSelectedIds);
            setDragState(null);
            return;
        }

        // Already selected single element ke handles/curve handles first priority.
        if (currentSelectedIds.length === 1) {
            const selectedElementObj = currentElements.find(
                (el) => el.id === currentSelectedIds[0]
            );

            if (
                selectedElementObj?.type === "line" ||
                selectedElementObj?.type === "arrow"
            ) {
                const curveHandle = getCurveHandleAtPoint(
                    selectedElementObj,
                    point,
                    viewportRef.current.zoom
                );

                if (curveHandle) {
                    dragBaseElementsRef.current = currentElements;
                    dragPreviewElementsRef.current = null;

                    setDragState({
                        mode: "curve-handle",
                        id: selectedElementObj.id,
                        handle: curveHandle,
                        startX: point.x,
                        startY: point.y,
                    });
                    return;
                }
            }

            const selectedHandle = selectedElementObj
                ? getResizeHandleAtPoint(
                    selectedElementObj,
                    point.x,
                    point.y,
                    viewportRef.current?.zoom || 1
                )
                : null;

            if (
                selectedElementObj &&
                selectedHandle &&
                selectedElementObj.type !== "pencil"
            ) {
                startResize(selectedElementObj, selectedHandle, point);
                return;
            }
        }

        const hit = findTopElementHitAtPoint(currentElements, point);
        const target = hit?.element || null;

        if (!target) {
            startMarqueeSelection(point);
            return;
        }

        const isAlreadySelected = currentSelectedIds.includes(target.id);
        const zoom = viewportRef.current?.zoom || 1;

        if (event?.shiftKey) {
            const nextSelectedIds = isAlreadySelected
                ? currentSelectedIds.filter((id) => id !== target.id)
                : [...currentSelectedIds, target.id];
            selectedIdsRef.current = nextSelectedIds;
            setSelectedIds(nextSelectedIds);
            setDragState(null);
            return;
        }

        // The fill of a container behaves like canvas space for the Select
        // tool. Dragging here draws a marquee around inner objects; a simple
        // click still selects the parent rectangle on mouse-up.
        if (
            hit?.kind === "fill" &&
            isContainerRectangle(target, currentElements)
        ) {
            startMarqueeSelection(point, target.id);
            return;
        }

        // A rectangle can resize directly only from its real visible border.
        // Clicking anywhere else inside it never starts resize.
        if (isRectangleElement(target) && isAlreadySelected) {
            const borderHandle = getRectangleBorderResizeHandleAtPoint(
                target,
                point.x,
                point.y,
                zoom
            );

            if (borderHandle) {
                const nextSelectedIds = [target.id];
                selectedIdsRef.current = nextSelectedIds;
                setSelectedIds(nextSelectedIds);
                startResize(target, borderHandle, point);
                return;
            }
        }

        // Large container rectangles keep the safer two-step behaviour.
        // Normal objects (including User and system-design diagrams) select and
        // start moving in the same pointer gesture, which feels natural and
        // fixes the "selected but cannot drag" experience.
        if (!isAlreadySelected) {
            const nextSelectedIds = [target.id];
            selectedIdsRef.current = nextSelectedIds;
            setSelectedIds(nextSelectedIds);

            const keepSelectOnly =
                isRectangleElement(target) &&
                isContainerRectangle(target, currentElements);

            if (!keepSelectOnly) {
                startMove(target, point, nextSelectedIds);
            }
            return;
        }

        // Once selected, dragging the object's actual body moves it. A smaller
        // object inside a rectangle wins hit-testing, so it moves independently.
        const moveIds = isContainerRectangle(target, currentElements)
            ? Array.from(new Set([
                ...currentSelectedIds,
                target.id,
                ...findContainedElementIds(
                    currentElements,
                    target,
                    getElementBounds(target)
                ),
            ]))
            : currentSelectedIds;
        startMove(target, point, moveIds);
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
            onCreateTimelineFrame?.(next);

            imageInsertPointRef.current = null;
        } catch (error) {
            console.error("Unable to insert image", error);
        }
    };

    const onMouseDown = (event) => {
        closeContextMenu();

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (editor) {
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

        if ((tool === "hand" || isSpacePressed) && event.button === 0) {
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

        if (animationDependencyPicker) {
            event.preventDefault();
            pickAnimationDependency(point);
            return;
        }

        if (tool === "eraser") {
            const target = findTopElementAtPoint(elements, point);
            if (!target) return;

            const next = elements.filter((el) => el.id !== target.id);

            setElements(next);
            setSelectedIds([]);
            commitHistory(next);
            onUpdateTimelineFrame?.(next);
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
                            startX: point.x,
                            startY: point.y,
                        });
                        return;
                    }
                }
            }

            handleSelectModeMouseDown(point, event);
            return;
        }

        handleDrawModeMouseDown(point);
    };

    const runMouseMove = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rawPoint = getPointerPosition(event, canvas);
        const point = screenToWorld(rawPoint, viewport);

        if (!dragState && tool === "eraser") {
            const target = findTopElementAtPoint(elements, point);

            canvas.style.cursor = target ? ERASER_CURSOR : "crosshair";
            return;
        }

        if (!dragState && (tool === "hand" || isSpacePressed)) {
            canvas.style.cursor = "grab";
            return;
        }

        if (!dragState && tool === "select") {
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
                            cursor = getSelectCursorForPoint(point);
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
                        cursor = getSelectCursorForPoint(point);
                    }
                }
            } else {
                cursor = getSelectCursorForPoint(point);
            }

            canvas.style.cursor = cursor;
        }

        if (!dragState) return;

        if (dragState.mode === "curve-handle") {
            canvas.style.cursor = "pointer";

            if (isBelowPointerDragThreshold(dragState, point, viewport.zoom)) {
                return;
            }

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
                        ? {x: currentElement.x2, y: currentElement.y2}
                        : {x: currentElement.x1, y: currentElement.y1};

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
                    const bindPoint = hint.point;
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
                            {x: el.x2, y: el.y2},
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
                            {x: el.x1, y: el.y1},
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

// Pencil/freehand must continue from the latest preview element.
// If we always use dragBaseElementsRef, pencil keeps only:
// [startPoint, currentPoint], so it behaves like a straight line.
            const baseDrawingElement = baseElements.find((el) => el.id === dragState.id);
            const drawElementsSource =
                baseDrawingElement?.type === "pencil"
                    ? dragPreviewElementsRef.current || elementsRef.current || baseElements
                    : baseElements;

            const drawingElement =
                drawElementsSource.find((el) => el.id === dragState.id) || baseDrawingElement;

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
                    const bindPoint = hint.point;
                    drawPoint = bindPoint;
                    endBinding = createBindingForPoint(hint.shape, bindPoint);
                    nextConnectionHint = {
                        shapeId: hint.shape.id,
                        bindPoint,
                    };
                }
            }

            const preview = drawElementsSource.map((el) => {
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

            if (isBelowPointerDragThreshold(dragState, point, viewport.zoom)) {
                return;
            }

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

                const rawMovedElements = rawMovedPreview.filter((el) =>
                    movingIds.has(el.id)
                );

                const onlyTextMoving =
                    rawMovedElements.length === 1 && rawMovedElements[0]?.type === "text";

                if (onlyTextMoving) {
                    // Normal grid/blank: text keeps exact dragged position.
                    // Notebook: text snaps only vertically to the ruled writing line.
                    if (isNotebookPattern(canvasPropsRef.current)) {
                        const movedText = rawMovedElements[0];
                        const alignedY = getNotebookTextAlignedTopY(
                            movedText.y,
                            movedText
                        );

                        dy += alignedY - movedText.y;
                    }
                } else {
                    // Shapes/groups still use normal grid snap.
                    const movedBounds = getGroupBounds(rawMovedElements);

                    if (movedBounds) {
                        dx += snapValueToGrid(movedBounds.x) - movedBounds.x;
                        dy += snapValueToGrid(movedBounds.y) - movedBounds.y;
                    }
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

            // A text element is clipped while it belongs to a rectangle.
            // Detach it as soon as the user drags it beyond that rectangle so
            // it stays visible and becomes an independent canvas object.
            preview = detachMovedTextOutsideParents(preview, movingIds);

            dragPreviewElementsRef.current = preview;
            elementsRef.current = preview;
            renderLivePreview(preview, guides, reverseBindingResult.connectionHint);
            return;
        }

        if (dragState.mode === "resize") {
            const cursor = getCursorForHandle(dragState.handle);
            canvas.style.cursor = cursor;

            if (isBelowPointerDragThreshold(dragState, point, viewport.zoom)) {
                return;
            }

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

            const insideIds = elementsRef.current
                .filter((el) => shouldSelectElementByMarquee(box, el))
                .map((el) => el.id);

            setSelectedIds(insideIds);
            selectedIdsRef.current = insideIds;
        }
    };


    const onMouseMove = (event) => {
        event.persist?.();

        lastMouseClientPointRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
        };

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

        const canvas = canvasRef.current;
        const geometryDrag =
            dragState?.mode === "move" ||
            dragState?.mode === "resize" ||
            dragState?.mode === "curve-handle";

        if (geometryDrag && event && canvas) {
            const rawPoint = getPointerPosition(event, canvas);
            const point = screenToWorld(rawPoint, viewportRef.current);

            if (isBelowPointerDragThreshold(dragState, point, viewportRef.current?.zoom)) {
                if (pointerMoveFrameRef.current !== null) {
                    window.cancelAnimationFrame(pointerMoveFrameRef.current);
                    pointerMoveFrameRef.current = null;
                }

                latestPointerMoveEventRef.current = null;
                const baseElements = dragBaseElementsRef.current;
                if (baseElements) {
                    elementsRef.current = baseElements;
                    setElements(baseElements);
                }

                setDragState(null);
                setConnectionHint(null);
                setAlignmentGuides([]);
                clearDragPreviewRefs();
                canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
                return;
            }
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

            if (canvas) {
                canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
            }

            return;
        }

        if (dragState.mode === "marquee") {
            if (dragState.clickTargetId && event && canvas) {
                const rawPoint = getPointerPosition(event, canvas);
                const point = screenToWorld(rawPoint, viewportRef.current);
                const distance = Math.hypot(
                    point.x - dragState.startX,
                    point.y - dragState.startY
                );

                if (distance < 3 / Math.max(0.1, viewportRef.current?.zoom || 1)) {
                    const nextSelectedIds = [dragState.clickTargetId];
                    selectedIdsRef.current = nextSelectedIds;
                    setSelectedIds(nextSelectedIds);
                }
            }

            setSelectionBox(null);
            setDragState(null);
            setConnectionHint(null);
            clearDragPreviewRefs();

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
        finalElements = normalizeElementsGeometry(finalElements);

        const finishedMode = dragState.mode;

        elementsRef.current = finalElements;
        setElements(finalElements);
        setDragState(null);
        setConnectionHint(null);
        clearDragPreviewRefs();
        commitHistory(finalElements);

        if (finishedMode === "draw") {
            onCreateTimelineFrame?.(finalElements);
        } else {
            onUpdateTimelineFrame?.(finalElements);
        }

        if (
            finishedMode === "draw" &&
            finishedElement &&
            AUTO_SELECT_TYPES.has(finishedElement.type)
        ) {
            setSelectedIds([finishedElement.id]);
            setTool("select");
        }

        if (canvas) {
            canvas.style.cursor = getIdleCanvasCursor(tool, isSpacePressed);
        }
    };

    const onDoubleClick = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rawPoint = getPointerPosition(event, canvas);
        const point = screenToWorld(rawPoint, viewport);

        const target = findTopElementAtPoint(elements, point);

        if (target && target.type === "text") {
            const parent = target.parentId
                ? elements.find((element) => element.id === target.parentId)
                : null;
            const parentBounds = getElementBounds(parent);
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
                maxWidth: parentBounds ? Math.max(8, parentBounds.w - 24) : null,
                maxHeight: parentBounds ? Math.max(8, parentBounds.h - 24) : null,

                fontSize: target.fontSize || DEFAULT_TEXT_STYLE.fontSize,
                lineHeight: isNotebookPattern(canvasPropsRef.current)
                    ? NOTEBOOK_LINE_GAP
                    : target.lineHeight || DEFAULT_TEXT_STYLE.lineHeight,
                fontFamily: target.fontFamily || DEFAULT_TEXT_STYLE.fontFamily,
                bold: !!target.bold,
                italic: !!target.italic,
                underline: !!target.underline,
                textAlign: target.textAlign || DEFAULT_TEXT_STYLE.textAlign || "left",
                richText: Array.isArray(target.richText) ? target.richText : [],
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

        const canvas = canvasRef.current;
        if (!canvas) return;

        const zoom = viewportRef.current?.zoom || 1;

        // Trackpad pinch / Ctrl + wheel = zoom around mouse pointer
        if (event.ctrlKey || event.metaKey) {
            const rawPoint = getPointerPosition(event, canvas);
            const beforeZoomPoint = screenToWorld(rawPoint, viewportRef.current);

            const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
            const nextZoom = Math.max(
                0.2,
                Math.min(4, zoom * zoomFactor)
            );

            setViewport((prev) => {
                const nextOffsetX = rawPoint.x - beforeZoomPoint.x * nextZoom;
                const nextOffsetY = rawPoint.y - beforeZoomPoint.y * nextZoom;

                return {
                    ...prev,
                    zoom: nextZoom,
                    offsetX: nextOffsetX,
                    offsetY: nextOffsetY,
                };
            });

            return;
        }

        // Normal wheel = pan canvas
        // Notebook should behave like scrolling a page.
        setViewport((prev) => ({
            ...prev,
            offsetX: prev.offsetX - event.deltaX,
            offsetY: prev.offsetY - event.deltaY,
        }));
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

            const savedType = parsed.documentType || parsed.workspaceType || parsed?.data?.documentType || parsed?.data?.workspaceType;
            if (savedType === "excel") {
                const sheet = parsed?.data?.spreadsheet || parsed.spreadsheet || {};
                window.dispatchEvent(new CustomEvent("sketchydraw:open-spreadsheet", {
                    detail: {
                        rows: sheet.rows || sheet.rowCount,
                        cols: sheet.cols || sheet.columnCount,
                        cells: sheet.cells || {},
                        selected: sheet.selected || sheet.activeCell || { row: 0, col: 0 },
                        fileName: drawing.title || parsed.title || sheet.fileName || "Untitled Excel",
                        currentMeta: {
                            id: drawing.id || parsed.id || null,
                            title: drawing.title || parsed.title || sheet.fileName || "Untitled Excel",
                            groupName: drawing.groupName || parsed.groupName || drawing.workspace || parsed.workspace || DEFAULT_GROUP,
                        },
                    },
                }));
                setMyDrawingsOpen(false);
                return;
            }

            localDraftIdRef.current = drawing.id || parsed.id || null;
            const actualDrawing = parsed.data || parsed;
            const loadedDrawing = loadDrawingJson(parsed);

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

            const nextElements = loadedDrawing.elements;

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

            const savedFrames = loadedDrawing.frames;
            const savedFrameIndex = loadedDrawing.activeFrameIndex;
            if (Array.isArray(savedFrames) && savedFrames.length) {
                onRestoreTimeline?.(savedFrames, savedFrameIndex);
            } else {
                onReplaceTimeline?.(nextElements);
            }
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
                    style={{display: "none"}}
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

                {socialGuide && (
                    <div className="social-guide-layer" aria-hidden="true">
                        <div
                            className={`social-guide-frame ${socialGuide.outsideCount ? "has-overflow" : ""}`}
                            style={{
                                left: socialGuide.left,
                                top: socialGuide.top,
                                width: socialGuide.width,
                                height: socialGuide.height,
                            }}
                        >
                            <div className="social-guide-thirds vertical first" />
                            <div className="social-guide-thirds vertical second" />
                            <div className="social-guide-thirds horizontal first" />
                            <div className="social-guide-thirds horizontal second" />
                            <div
                                className="social-guide-safe"
                                style={{
                                    left: socialGuide.safe.left - socialGuide.left,
                                    top: socialGuide.safe.top - socialGuide.top,
                                    width: socialGuide.safe.width,
                                    height: socialGuide.safe.height,
                                }}
                            />
                            <div className="social-guide-title">
                                <strong>{socialGuide.preset.label}</strong>
                                <span>{socialGuide.preset.width}×{socialGuide.preset.height}</span>
                            </div>
                            <div className={`social-guide-status ${socialGuide.outsideCount ? "warning" : "ready"}`}>
                                {socialGuide.outsideCount
                                    ? `${socialGuide.outsideCount} object${socialGuide.outsideCount === 1 ? "" : "s"} outside safe area · export will auto-fit`
                                    : "Everything is inside the safe area"}
                            </div>
                        </div>
                    </div>
                )}

                {socialGuide && timelineFrames.length > 1 && (
                    <div
                        className="social-carousel-dots"
                        style={{
                            left: socialGuide.left + socialGuide.width / 2,
                            top: Math.min(canvasSize.height - 18, socialGuide.top + socialGuide.height + 12),
                        }}
                        aria-label="Picture navigation"
                    >
                        {timelineFrames.slice(0, MAX_SOCIAL_TEXT_PAGES).map((frame, index) => (
                            <button
                                key={frame.id || index}
                                type="button"
                                className={index === currentFrameIndex ? "active" : ""}
                                onClick={() => onSelectTimelineFrame?.(index)}
                                aria-label={`Open picture ${index + 1}`}
                                title={`Picture ${index + 1}`}
                            />
                        ))}
                    </div>
                )}

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

                {animationDependencyPicker && (
                    <div className="animation-dependency-picker-hint">
                        Click the object that should animate first · Esc to cancel
                    </div>
                )}

                {false && tool === "select" &&
                    !editor &&
                    !dragState &&
                    selectedAnimationElements.length > 0 && (
                        <div
                            className="object-animation-widget"
                            onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                        >
                            <button
                                type="button"
                                className="object-duplicate-trigger"
                                onClick={duplicateSelectedElements}
                                title="Duplicate selected object (offset by 24px)"
                                aria-label="Duplicate selected object"
                            >
                                ⧉
                            </button>

                            <button
                                type="button"
                                className={`object-animation-trigger ${
                                    selectedAnimationType !== "none" && selectedAnimationType !== "multiple"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() => setAnimationMenuOpen((value) => !value)}
                                title="Add GIF / animation to selected object"
                            >
                                ⚡
                            </button>

                            {animationMenuOpen && (
                                <div className="object-animation-popover">
                                    <div className="object-animation-popover-head">
                                        <strong>Animation</strong>
                                        <span>
                                            {selectedAnimationElements.length === 1
                                                ? getAnimationLabel(selectedAnimationType)
                                                : `${selectedAnimationElements.length} objects`}
                                        </span>
                                    </div>

                                    <div className="object-animation-preset-grid">
                                        {selectedAnimationPresets.map((preset) => (
                                            <button
                                                type="button"
                                                key={preset.type}
                                                className={
                                                    selectedAnimationType === preset.type ? "active" : ""
                                                }
                                                onClick={() => applyAnimationToSelected(preset.type)}
                                                title={preset.description}
                                            >
                                                <strong>{preset.label}</strong>
                                                <span>{preset.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
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
                    object={contextMenuObject}
                    animationPresets={contextAnimationPresets}
                    onSetAnimation={setContextObjectAnimation}
                    onAnimateAfter={startContextAnimationDependencyPicker}
                    onToggleAnimationLoop={() =>
                        updateContextObjectAnimation((animation) => ({
                            ...animation,
                            loop: !animation.loop,
                        }))
                    }
                    onRemoveAnimation={() =>
                        updateContextObjectAnimation(createAnimationConfig("none"))
                    }
                />
            </div>

            {!focusMode && <CanvasBoardActions
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
                elements={elements}
                selectedIds={selectedIds}
                canvasSize={canvasSize}
                showGrid={showGrid}
                canvasProps={canvasProps}
                setCanvasProps={setCanvasProps}
            />}

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

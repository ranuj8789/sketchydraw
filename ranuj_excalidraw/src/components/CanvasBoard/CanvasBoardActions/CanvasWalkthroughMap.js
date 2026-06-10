import React, { useEffect, useMemo, useRef, useState } from "react";
import { renderCanvas } from "../../../canvas/canvasRender";
import { getElementBounds } from "../../../utils/elementBounds";

const MAP_PADDING = 220;
const MIN_MAP_WIDTH = 900;
const MIN_MAP_HEIGHT = 560;

const MIN_VIEWPORT_BOX_WIDTH = 170;
const MIN_VIEWPORT_BOX_HEIGHT = 110;

function getElementWorldBounds(element) {
    const bounds = getElementBounds(element);

    if (bounds) {
        return bounds;
    }

    if (element?.type === "line" || element?.type === "arrow") {
        const minX = Math.min(element.x1 || 0, element.x2 || 0);
        const minY = Math.min(element.y1 || 0, element.y2 || 0);
        const maxX = Math.max(element.x1 || 0, element.x2 || 0);
        const maxY = Math.max(element.y1 || 0, element.y2 || 0);

        return {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
        };
    }

    if (element?.type === "pencil" && Array.isArray(element.points)) {
        const xs = element.points.map((point) => point.x);
        const ys = element.points.map((point) => point.y);

        if (!xs.length || !ys.length) return null;

        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        return {
            x: minX,
            y: minY,
            w: Math.max(1, maxX - minX),
            h: Math.max(1, maxY - minY),
        };
    }

    return null;
}

function getContentBounds(elements = [], canvasSize = {}) {
    const canvasWidth = canvasSize?.width || 1200;
    const canvasHeight = canvasSize?.height || 700;

    const boundsList = (elements || [])
        .map(getElementWorldBounds)
        .filter(Boolean);

    if (!boundsList.length) {
        return {
            x: 0,
            y: 0,
            w: canvasWidth,
            h: canvasHeight,
        };
    }

    const minX = Math.min(...boundsList.map((bounds) => bounds.x));
    const minY = Math.min(...boundsList.map((bounds) => bounds.y));
    const maxX = Math.max(...boundsList.map((bounds) => bounds.x + bounds.w));
    const maxY = Math.max(...boundsList.map((bounds) => bounds.y + bounds.h));

    return {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX),
        h: Math.max(1, maxY - minY),
    };
}

export function getCanvasWalkthroughBounds(elements = [], canvasSize = {}) {
    const canvasWidth = canvasSize?.width || 1200;
    const canvasHeight = canvasSize?.height || 700;

    const contentBounds = getContentBounds(elements, canvasSize);

    const minX = Math.min(0, contentBounds.x);
    const minY = Math.min(0, contentBounds.y);
    const maxX = Math.max(canvasWidth, contentBounds.x + contentBounds.w);
    const maxY = Math.max(canvasHeight, contentBounds.y + contentBounds.h);

    return {
        x: minX - MAP_PADDING,
        y: minY - MAP_PADDING,
        w: Math.max(1, maxX - minX + MAP_PADDING * 2),
        h: Math.max(1, maxY - minY + MAP_PADDING * 2),
    };
}

export function getCanvasWalkthroughViewport(worldBounds, previewSize) {
    const previewWidth = Math.max(1, previewSize?.width || MIN_MAP_WIDTH);
    const previewHeight = Math.max(1, previewSize?.height || MIN_MAP_HEIGHT);

    const scale = Math.min(
        previewWidth / worldBounds.w,
        previewHeight / worldBounds.h
    );

    const finalScale = Math.max(0.02, Math.min(scale, 1.2));

    return {
        zoom: finalScale,
        offsetX:
            (previewWidth - worldBounds.w * finalScale) / 2 -
            worldBounds.x * finalScale,
        offsetY:
            (previewHeight - worldBounds.h * finalScale) / 2 -
            worldBounds.y * finalScale,
    };
}

function getCanvasWalkthroughActualViewport(worldBounds) {
    return {
        zoom: 1,
        offsetX: -worldBounds.x,
        offsetY: -worldBounds.y,
    };
}

function worldToPreview(point, mapViewport) {
    return {
        x: point.x * mapViewport.zoom + mapViewport.offsetX,
        y: point.y * mapViewport.zoom + mapViewport.offsetY,
    };
}

function previewToWorld(point, mapViewport) {
    return {
        x: (point.x - mapViewport.offsetX) / mapViewport.zoom,
        y: (point.y - mapViewport.offsetY) / mapViewport.zoom,
    };
}

function getVisibleWorldRect(viewport, canvasSize) {
    const zoom = viewport?.zoom || 1;

    return {
        x: -(viewport?.offsetX || 0) / zoom,
        y: -(viewport?.offsetY || 0) / zoom,
        w: (canvasSize?.width || 1200) / zoom,
        h: (canvasSize?.height || 700) / zoom,
    };
}

function getReadableViewportBox(rawBox, previewSize, isActualMode) {
    if (isActualMode) {
        return {
            left: rawBox.left,
            top: rawBox.top,
            width: Math.max(18, rawBox.width),
            height: Math.max(18, rawBox.height),
        };
    }

    const rawCenterX = rawBox.left + rawBox.width / 2;
    const rawCenterY = rawBox.top + rawBox.height / 2;

    const width = Math.max(MIN_VIEWPORT_BOX_WIDTH, rawBox.width);
    const height = Math.max(MIN_VIEWPORT_BOX_HEIGHT, rawBox.height);

    const maxLeft = Math.max(0, previewSize.width - width);
    const maxTop = Math.max(0, previewSize.height - height);

    return {
        left: Math.max(0, Math.min(maxLeft, rawCenterX - width / 2)),
        top: Math.max(0, Math.min(maxTop, rawCenterY - height / 2)),
        width,
        height,
    };
}

export default function CanvasWalkthroughMap({
                                                 open,
                                                 onClose,
                                                 elements,
                                                 selectedIds,
                                                 viewport,
                                                 setViewport,
                                                 canvasSize,
                                                 showGrid,
                                                 canvasProps,
                                             }) {
    const mapCanvasRef = useRef(null);
    const mapShellRef = useRef(null);
    const isDraggingRef = useRef(false);

    const [mapMode, setMapMode] = useState("fit");

    const [previewSize, setPreviewSize] = useState({
        width: MIN_MAP_WIDTH,
        height: MIN_MAP_HEIGHT,
    });

    useEffect(() => {
        if (!open) return;

        setMapMode("fit");
    }, [open]);

    const contentBounds = useMemo(
        () => getContentBounds(elements, canvasSize),
        [elements, canvasSize]
    );

    const worldBounds = useMemo(
        () => getCanvasWalkthroughBounds(elements, canvasSize),
        [elements, canvasSize]
    );

    const isActualMode = mapMode === "actual";

    const mapCanvasSize = useMemo(() => {
        if (isActualMode) {
            return {
                width: Math.ceil(worldBounds.w),
                height: Math.ceil(worldBounds.h),
            };
        }

        return previewSize;
    }, [isActualMode, worldBounds, previewSize]);

    const mapViewport = useMemo(() => {
        if (isActualMode) {
            return getCanvasWalkthroughActualViewport(worldBounds);
        }

        return getCanvasWalkthroughViewport(worldBounds, previewSize);
    }, [isActualMode, worldBounds, previewSize]);

    useEffect(() => {
        if (!open) return;

        const shell = mapShellRef.current;
        if (!shell) return;

        const updateSize = () => {
            const rect = shell.getBoundingClientRect();

            setPreviewSize({
                width: Math.max(320, Math.floor(rect.width)),
                height: Math.max(260, Math.floor(rect.height)),
            });
        };

        updateSize();

        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(shell);

        return () => resizeObserver.disconnect();
    }, [open]);

    useEffect(() => {
        if (!open) return;

        renderCanvas({
            canvas: mapCanvasRef.current,
            canvasSize: mapCanvasSize,
            elements,
            selectedIds,
            connectionHint: null,
            alignmentGuides: [],
            viewport: mapViewport,
            showGrid,
            canvasProps: {
                ...(canvasProps || {}),
                background: canvasProps?.background || "blank",
            },
        });
    }, [
        open,
        mapCanvasSize,
        elements,
        selectedIds,
        mapViewport,
        showGrid,
        canvasProps,
    ]);

    const scrollActualViewToCurrentArea = () => {
        const shell = mapShellRef.current;
        if (!shell) return;

        const visibleWorld = getVisibleWorldRect(viewport, canvasSize);
        const actualViewport = getCanvasWalkthroughActualViewport(worldBounds);

        const centerPreview = worldToPreview(
            {
                x: visibleWorld.x + visibleWorld.w / 2,
                y: visibleWorld.y + visibleWorld.h / 2,
            },
            actualViewport
        );

        shell.scrollLeft = Math.max(0, centerPreview.x - shell.clientWidth / 2);
        shell.scrollTop = Math.max(0, centerPreview.y - shell.clientHeight / 2);
    };

    useEffect(() => {
        if (!open || !isActualMode) return;

        requestAnimationFrame(() => {
            scrollActualViewToCurrentArea();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, isActualMode, mapCanvasSize.width, mapCanvasSize.height]);

    if (!open) return null;

    const visibleWorld = getVisibleWorldRect(viewport, canvasSize);

    const topLeft = worldToPreview(
        {
            x: visibleWorld.x,
            y: visibleWorld.y,
        },
        mapViewport
    );

    const bottomRight = worldToPreview(
        {
            x: visibleWorld.x + visibleWorld.w,
            y: visibleWorld.y + visibleWorld.h,
        },
        mapViewport
    );

    const rawViewportBox = {
        left: topLeft.x,
        top: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
    };

    const viewportBox = getReadableViewportBox(
        rawViewportBox,
        mapCanvasSize,
        isActualMode
    );

    const moveCanvasToWorldPoint = (worldPoint) => {
        setViewport((currentViewport) => {
            const currentZoom = currentViewport?.zoom || 1;

            return {
                ...currentViewport,
                zoom: currentZoom,
                offsetX: (canvasSize?.width || 1200) / 2 - worldPoint.x * currentZoom,
                offsetY: (canvasSize?.height || 700) / 2 - worldPoint.y * currentZoom,
            };
        });
    };

    const moveCanvasToPreviewPoint = (event) => {
        const rect = mapCanvasRef.current?.getBoundingClientRect();

        if (!rect) return;

        const previewPoint = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };

        const worldPoint = previewToWorld(previewPoint, mapViewport);
        moveCanvasToWorldPoint(worldPoint);
    };

    const handlePointerDown = (event) => {
        event.preventDefault();
        isDraggingRef.current = true;
        moveCanvasToPreviewPoint(event);
    };

    const handlePointerMove = (event) => {
        if (!isDraggingRef.current) return;

        event.preventDefault();
        moveCanvasToPreviewPoint(event);
    };

    const handlePointerUp = () => {
        isDraggingRef.current = false;
    };

    const handleGoToStart = () => {
        setViewport({
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
        });
    };

    const handleScrollToContent = () => {
        const centerX = contentBounds.x + contentBounds.w / 2;
        const centerY = contentBounds.y + contentBounds.h / 2;

        setViewport({
            zoom: 1,
            offsetX: (canvasSize?.width || 1200) / 2 - centerX,
            offsetY: (canvasSize?.height || 700) / 2 - centerY,
        });
    };

    const handleActualView = () => {
        setMapMode("actual");

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scrollActualViewToCurrentArea();
            });
        });
    };

    const handleFitFullCanvas = () => {
        setMapMode("fit");
    };

    return (
        <div className="canvas-map-overlay">
            <div className="canvas-map-panel">
                <div className="canvas-map-header">
                    <div>
                        <div className="canvas-map-title">Canvas Map</div>
                        <div className="canvas-map-subtitle">
                            Use Fit view for overview, or 100% selected view for a scrollable big canvas preview.
                        </div>
                    </div>

                    <button
                        type="button"
                        className="canvas-map-close"
                        onClick={onClose}
                        aria-label="Close canvas map"
                    >
                        ×
                    </button>
                </div>

                <div
                    ref={mapShellRef}
                    className={`canvas-map-shell ${isActualMode ? "actual-view" : "fit-view"}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <canvas
                        ref={mapCanvasRef}
                        className="canvas-map-canvas"
                        style={{
                            width: `${mapCanvasSize.width}px`,
                            height: `${mapCanvasSize.height}px`,
                        }}
                    />

                    <div
                        className="canvas-map-current-view"
                        style={{
                            left: `${viewportBox.left}px`,
                            top: `${viewportBox.top}px`,
                            width: `${viewportBox.width}px`,
                            height: `${viewportBox.height}px`,
                        }}
                    >
                        <span>Current view</span>
                    </div>
                </div>

                <div className="canvas-map-footer">


                    <button
                        type="button"
                        className="canvas-map-footer-btn"
                        onClick={handleScrollToContent}
                    >
                        Scroll to content
                    </button>

                    <button
                        type="button"
                        className="canvas-map-footer-btn"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
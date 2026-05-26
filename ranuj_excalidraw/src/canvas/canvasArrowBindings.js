import {
    createBindingForPoint,
    findBindableShapeNearPoint,
    getBindableShapes,
    getPointFromBinding,
    isConnectorElement,
} from "./canvasConnectionHelpers";

function endpointPoint(element, endpoint) {
    return endpoint === "start"
        ? { x: element.x1, y: element.y1 }
        : { x: element.x2, y: element.y2 };
}

function bindingKey(endpoint) {
    return endpoint === "start" ? "startBinding" : "endBinding";
}

function setEndpoint(element, endpoint, point) {
    const next =
        endpoint === "start"
            ? { ...element, x1: point.x, y1: point.y }
            : { ...element, x2: point.x, y2: point.y };

    if (next.lineStyle !== "curved") {
        const midX = (next.x1 + next.x2) / 2;
        const midY = (next.y1 + next.y2) / 2;

        return {
            ...next,
            lineStyle: "straight",
            cx1: midX,
            cy1: midY,
            cx2: midX,
            cy2: midY,
        };
    }

    return next;
}

function setEndpointBinding(connector, endpoint, shape, bindPoint) {
    if (!shape || !bindPoint) return connector;

    const key = bindingKey(endpoint);
    const binding = createBindingForPoint(shape, bindPoint);

    return {
        ...setEndpoint(connector, endpoint, bindPoint),
        [key]: binding,
    };
}

function snapConnectorEndpointToShape(connector, endpoint, shape) {
    if (!shape) return connector;

    const key = bindingKey(endpoint);
    const binding = connector[key];
    const snapPoint = getPointFromBinding(shape, binding);

    if (!snapPoint) return connector;

    return setEndpoint(connector, endpoint, snapPoint);
}

export function applyArrowStartBinding({ draft, tool, elements, point }) {
    if (tool !== "arrow" && tool !== "line") return draft;

    const startHint = findBindableShapeNearPoint(elements, point, 18, {
        excludeIds: [draft.id],
    });

    if (!startHint) return draft;

    return {
        ...draft,
        x1: startHint.point.x,
        y1: startHint.point.y,
        x2: startHint.point.x,
        y2: startHint.point.y,
        startBinding: startHint.binding,
    };
}

export function updateArrowDuringDraw({
                                          drawingElement,
                                          elements,
                                          point,
                                          dragState,
                                          updateElement,
                                          updateDrawnElement,
                                          setConnectionHint,
                                      }) {
    if (!drawingElement) return;

    if (!isConnectorElement(drawingElement)) {
        updateElement(dragState.id, (element) =>
            updateDrawnElement(element, dragState, point)
        );
        return;
    }

    const hint = findBindableShapeNearPoint(elements, point, 18, {
        excludeIds: [drawingElement.id],
    });

    if (hint) {
        setConnectionHint({
            shapeId: hint.shape.id,
            bindPoint: hint.point,
        });

        updateElement(dragState.id, (element) => ({
            ...updateDrawnElement(element, dragState, hint.point),
            endBinding: hint.binding,
        }));

        return;
    }

    setConnectionHint(null);

    updateElement(dragState.id, (element) => ({
        ...updateDrawnElement(element, dragState, point),
        endBinding: null,
    }));
}

export function finalizeArrowBinding(elements, finishedElement) {
    if (!finishedElement || !isConnectorElement(finishedElement)) {
        return resolveArrowBindings(elements);
    }

    const byId = new Map((elements || []).map((el) => [el.id, el]));
    let updatedConnector = finishedElement;

    const startShape = finishedElement.startBinding?.elementId
        ? byId.get(finishedElement.startBinding.elementId)
        : null;

    const endShape = finishedElement.endBinding?.elementId
        ? byId.get(finishedElement.endBinding.elementId)
        : null;

    if (startShape) {
        updatedConnector = snapConnectorEndpointToShape(
            updatedConnector,
            "start",
            startShape
        );
    }

    if (endShape) {
        updatedConnector = snapConnectorEndpointToShape(
            updatedConnector,
            "end",
            endShape
        );
    }

    const next = (elements || []).map((el) =>
        el.id === updatedConnector.id ? updatedConnector : el
    );

    return resolveArrowBindings(next);
}

export function refreshConnectedArrows(elements) {
    const byId = new Map((elements || []).map((el) => [el.id, el]));

    return (elements || []).map((el) => {
        if (!isConnectorElement(el)) return el;

        let next = el;

        const startShape = next.startBinding?.elementId
            ? byId.get(next.startBinding.elementId)
            : null;

        const endShape = next.endBinding?.elementId
            ? byId.get(next.endBinding.elementId)
            : null;

        if (startShape) {
            next = snapConnectorEndpointToShape(next, "start", startShape);
        }

        if (endShape) {
            next = snapConnectorEndpointToShape(next, "end", endShape);
        }

        return next;
    });
}

export function resolveArrowBindings(elements) {
    return refreshConnectedArrows(elements);
}

export function moveConnectedArrows(elements, movingIds, dx, dy, moveElement) {
    const movedFirst = (elements || []).map((el) => {
        if (movingIds.has(el.id)) {
            return moveElement(el, dx, dy);
        }

        if (!isConnectorElement(el)) return el;

        let next = el;

        if (el.startBinding?.elementId && movingIds.has(el.startBinding.elementId)) {
            next = {
                ...next,
                x1: next.x1 + dx,
                y1: next.y1 + dy,
            };
        }

        if (el.endBinding?.elementId && movingIds.has(el.endBinding.elementId)) {
            next = {
                ...next,
                x2: next.x2 + dx,
                y2: next.y2 + dy,
            };
        }

        return next;
    });

    return refreshConnectedArrows(movedFirst);
}

function findEndpointNearMovedShape({ connector, endpoint, movedShapes, threshold }) {
    const point = endpointPoint(connector, endpoint);
    return findBindableShapeNearPoint(movedShapes, point, threshold);
}

export function bindMovedShapesToNearbyConnectors(elements, movingIds, threshold = 18) {
    const movedShapes = getBindableShapes(elements).filter((shape) =>
        movingIds.has(shape.id)
    );

    if (!movedShapes.length) {
        return { elements, connectionHint: null };
    }

    let connectionHint = null;

    const nextElements = (elements || []).map((el) => {
        if (!isConnectorElement(el) || movingIds.has(el.id)) return el;

        let next = el;

        const startHint = findEndpointNearMovedShape({
            connector: next,
            endpoint: "start",
            movedShapes,
            threshold,
        });

        if (startHint) {
            next = setEndpointBinding(
                next,
                "start",
                startHint.shape,
                startHint.point
            );

            connectionHint = connectionHint || {
                shapeId: startHint.shape.id,
                bindPoint: startHint.point,
            };
        }

        const endHint = findEndpointNearMovedShape({
            connector: next,
            endpoint: "end",
            movedShapes,
            threshold,
        });

        if (endHint) {
            next = setEndpointBinding(
                next,
                "end",
                endHint.shape,
                endHint.point
            );

            connectionHint = connectionHint || {
                shapeId: endHint.shape.id,
                bindPoint: endHint.point,
            };
        }

        return next;
    });

    return {
        elements: resolveArrowBindings(nextElements),
        connectionHint,
    };
}

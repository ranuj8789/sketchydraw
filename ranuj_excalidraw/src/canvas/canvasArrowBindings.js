import { findBindableShapeNearPoint } from "./canvasConnectionHelpers";

export function applyArrowStartBinding({ draft, tool, elements, point }) {
    if (tool !== "arrow") return draft;

    const startHint = findBindableShapeNearPoint(elements, point, 18);
    if (!startHint) return draft;

    return {
        ...draft,
        x1: startHint.point.x,
        y1: startHint.point.y,
        x2: startHint.point.x,
        y2: startHint.point.y,
        startBinding: {
            elementId: startHint.shape.id,
        },
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

    const isArrow = drawingElement.type === "arrow";

    // line & arrow both use bezier update
    if (!isArrow) {
        updateElement(dragState.id, (element) =>
            updateDrawnElement(element, dragState, point)
        );
        return;
    }

    const hint = findBindableShapeNearPoint(elements, point, 18);

    if (hint) {
        setConnectionHint({
            shapeId: hint.shape.id,
            bindPoint: hint.point,
        });

        updateElement(dragState.id, (element) => ({
            ...updateDrawnElement(element, dragState, hint.point),
            endBinding: {
                elementId: hint.shape.id,
            },
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
    if (!finishedElement || finishedElement.type !== "arrow") {
        return elements;
    }

    const startBound = finishedElement.startBinding?.elementId
        ? elements.find((el) => el.id === finishedElement.startBinding.elementId)
        : null;

    const endBound = finishedElement.endBinding?.elementId
        ? elements.find((el) => el.id === finishedElement.endBinding.elementId)
        : null;

    let updatedArrow = finishedElement;

    if (startBound) {
        const snappedStart = findBindableShapeNearPoint(
            [startBound],
            { x: finishedElement.x1, y: finishedElement.y1 },
            9999
        );
        if (snappedStart) {
            updatedArrow = {
                ...updatedArrow,
                x1: snappedStart.point.x,
                y1: snappedStart.point.y,
            };
        }
    }

    if (endBound) {
        const snappedEnd = findBindableShapeNearPoint(
            [endBound],
            { x: finishedElement.x2, y: finishedElement.y2 },
            9999
        );
        if (snappedEnd) {
            updatedArrow = {
                ...updatedArrow,
                x2: snappedEnd.point.x,
                y2: snappedEnd.point.y,
            };
        }
    }

    return elements.map((el) => (el.id === updatedArrow.id ? updatedArrow : el));
}

export function moveConnectedArrows(elements, movingIds, dx, dy, moveElement) {
    return elements.map((el) => {
        if (movingIds.has(el.id)) {
            return moveElement(el, dx, dy);
        }

        if (el.type !== "arrow") return el;

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
}
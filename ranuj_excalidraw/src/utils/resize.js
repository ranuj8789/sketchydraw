function resizeBox({
                       dragState,
                       dx,
                       dy,
                       minW,
                       minH,
                   }) {
    let newX = dragState.originalX;
    let newY = dragState.originalY;
    let newW = dragState.originalW;
    let newH = dragState.originalH;

    const handle = dragState.handle;

    if (handle.includes("e")) {
        newW = Math.max(minW, dragState.originalW + dx);
    }

    if (handle.includes("s")) {
        newH = Math.max(minH, dragState.originalH + dy);
    }

    if (handle.includes("w")) {
        newX = dragState.originalX + dx;
        newW = Math.max(minW, dragState.originalW - dx);

        if (newW === minW) {
            newX = dragState.originalX + (dragState.originalW - minW);
        }
    }

    if (handle.includes("n")) {
        newY = dragState.originalY + dy;
        newH = Math.max(minH, dragState.originalH - dy);

        if (newH === minH) {
            newY = dragState.originalY + (dragState.originalH - minH);
        }
    }

    return {
        x: newX,
        y: newY,
        w: newW,
        h: newH,
    };
}

export function resizeElement(element, dragState, point) {
    const dx = point.x - dragState.startX;
    const dy = point.y - dragState.startY;

    if (
        element.type === "rect" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond"
    ) {
        const box = resizeBox({
            dragState,
            dx,
            dy,
            minW: 20,
            minH: 20,
        });

        return {
            ...element,
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
        };
    }

    if (element.type === "text") {
        const box = resizeBox({
            dragState,
            dx,
            dy,
            minW: 60,
            minH: 32,
        });

        return {
            ...element,
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
        };
    }

    if (element.type === "line" || element.type === "arrow") {
        let x1 = dragState.originalX1;
        let y1 = dragState.originalY1;
        let x2 = dragState.originalX2;
        let y2 = dragState.originalY2;

        if (dragState.handle === "nw") {
            x1 += dx;
            y1 += dy;
        }

        if (dragState.handle === "ne") {
            x2 += dx;
            y1 += dy;
        }

        if (dragState.handle === "sw") {
            x1 += dx;
            y2 += dy;
        }

        if (dragState.handle === "se") {
            x2 += dx;
            y2 += dy;
        }

        return {
            ...element,
            x1,
            y1,
            x2,
            y2,
        };
    }

    return element;
}
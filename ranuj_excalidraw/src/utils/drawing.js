import { drawElement2D, hitTest2D, preloadDrawingImages2D } from "./drawing2d";
import { drawElement3D, hitTest3D, is3DElement } from "./drawing3d";
import { resolve2DElementTransform } from "./elementTransform2d";

export async function preloadDrawingImages(elements = []) {
    return preloadDrawingImages2D((elements || []).filter((element) => !is3DElement(element)));
}

export function hitTest(element, x, y) {
    return is3DElement(element)
        ? hitTest3D(element, x, y)
        : hitTest2D(element, x, y);
}

export function drawElement(ctx, element, selected = false, renderOptions = {}) {
    if (is3DElement(element)) {
        drawElement3D(ctx, element, selected, renderOptions);
        return;
    }
    const renderedElement = renderOptions?.animationMode
        ? resolve2DElementTransform(element, renderOptions.animationTimeMs || 0)
        : element;
    drawElement2D(ctx, renderedElement, selected, renderOptions);
}

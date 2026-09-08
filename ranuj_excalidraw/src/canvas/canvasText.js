import { buildTextElement } from "./canvasFactories";
import { measureTextBox, measureWrappedTextBox } from "./textMetrics";
import { normalizeTextStyle } from "./textRenderStyle";
import { getElementBounds } from "../utils/elementBounds";

const TEXT_CONTAINER_PADDING = 12;

function getParentTextBounds(elements, parentId) {
    if (!parentId) return null;
    const parent = (elements || []).find((element) => element.id === parentId);
    const bounds = getElementBounds(parent);
    if (!bounds) return null;

    return {
        x: bounds.x + TEXT_CONTAINER_PADDING,
        y: bounds.y + TEXT_CONTAINER_PADDING,
        w: Math.max(8, bounds.w - TEXT_CONTAINER_PADDING * 2),
        h: Math.max(8, bounds.h - TEXT_CONTAINER_PADDING * 2),
    };
}

function fitTextGeometry({ text, style, x, y, parentBounds }) {
    const natural = measureTextBox(text || " ", style);
    const maxWidth = parentBounds?.w || Number.POSITIVE_INFINITY;
    const minWidth = parentBounds ? Math.min(60, maxWidth) : 60;
    const width = Math.max(minWidth, Math.min(natural.w, maxWidth));
    const wrapped = measureWrappedTextBox(text || " ", style, width);
    const nextX = parentBounds
        ? Math.min(Math.max(x, parentBounds.x), parentBounds.x + parentBounds.w - width)
        : x;
    const nextY = parentBounds
        ? Math.min(
            Math.max(y, parentBounds.y),
            parentBounds.y + Math.max(0, parentBounds.h - wrapped.h)
        )
        : y;

    return {
        x: Math.round(nextX),
        y: Math.round(nextY),
        w: Math.round(width),
        h: Math.round(wrapped.h),
    };
}

export function createTextElementHelper({
                                            elements,
                                            setElements,
                                            setSelectedIds,
                                            commitHistory,
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
                                            pageIndex,
                                        }) {
    const finalText = text ?? "";
    if (!finalText.trim()) return;

    const style = normalizeTextStyle({
        stroke,
        fontSize,
        lineHeight,
        fontFamily,
        bold,
        italic,
        underline,
        textAlign,
    });

    let newText = buildTextElement({
        x,
        y,
        text: finalText,
        stroke: style.stroke,
        parentId,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        fontFamily: style.fontFamily,
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        textAlign: style.textAlign,
        richText: Array.isArray(richText) ? richText : [],
        pageIndex,
    });

    const parentBounds = getParentTextBounds(elements, parentId);
    if (parentBounds) {
        newText = {
            ...newText,
            ...fitTextGeometry({
                text: finalText,
                style,
                // Preserve the point where the user clicked. `fitTextGeometry`
                // only clamps it when the text would extend beyond the parent.
                // Using parentBounds.x/y here made every new child text jump to
                // the rectangle corner as soon as it was committed.
                x,
                y,
                parentBounds,
            }),
        };
    }

    const next = [...elements, newText];

    setElements(next);
    setSelectedIds([newText.id]);
    commitHistory(next);
}

export function updateTextElementHelper({
                                            elements,
                                            setElements,
                                            setSelectedIds,
                                            commitHistory,
                                            id,
                                            value,
                                            stroke,
                                            fontSize,
                                            lineHeight,
                                            fontFamily,
                                            bold,
                                            italic,
                                            underline,
                                            textAlign,
                                            richText,
                                            pageIndex,
                                        }) {
    // IMPORTANT:
    // Do not trim edited text.
    // Trimming changes visible width/content and can make text feel shifted.
    const finalText = value ?? "";

    let didChange = false;
    const next = elements.map((el) => {
        if (el.id !== id) return el;

        const style = normalizeTextStyle({
            ...el,
            stroke: stroke ?? el.stroke,
            fontSize: fontSize ?? el.fontSize,
            lineHeight: lineHeight ?? el.lineHeight,
            fontFamily: fontFamily ?? el.fontFamily,
            bold: bold ?? el.bold,
            italic: italic ?? el.italic,
            underline: underline ?? el.underline,
            textAlign: textAlign ?? el.textAlign,
        });

        const styleChanged =
            style.stroke !== el.stroke ||
            style.fontSize !== el.fontSize ||
            style.lineHeight !== el.lineHeight ||
            style.fontFamily !== el.fontFamily ||
            style.bold !== !!el.bold ||
            style.italic !== !!el.italic ||
            style.underline !== !!el.underline ||
            style.textAlign !== (el.textAlign || "left");
        const textChanged = finalText !== (el.text ?? "");
        const richTextChanged = JSON.stringify(richText || []) !== JSON.stringify(el.richText || []);

        if (!textChanged && !styleChanged && !richTextChanged) {
            return el;
        }
        didChange = true;

        const parentBounds = getParentTextBounds(elements, el.parentId);
        const geometry = textChanged || styleChanged
            ? fitTextGeometry({
                text: finalText,
                style,
                x: el.x,
                y: el.y,
                parentBounds,
            })
            : { x: el.x, y: el.y, w: el.w, h: el.h };

        return {
            ...el,
            text: finalText,
            stroke: style.stroke,

            // Keep the existing position unless the edited text must be clamped
            // back into its parent rectangle.
            x: geometry.x,
            y: geometry.y,
            w: geometry.w,
            h: geometry.h,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            textAlign: style.textAlign,
            richText: Array.isArray(richText) ? richText : (el.richText || []),
        };
    });

    if (!didChange) {
        setSelectedIds([id]);
        return;
    }

    setElements(next);
    setSelectedIds([id]);
    commitHistory(next);
}

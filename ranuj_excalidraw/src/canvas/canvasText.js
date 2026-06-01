import { buildTextElement } from "./canvasFactories";
import { measureTextBox } from "./textMetrics";
import { normalizeTextStyle } from "./textRenderStyle";

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

    const newText = buildTextElement({
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
    });

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
                                        }) {
    // IMPORTANT:
    // Do not trim edited text.
    // Trimming changes visible width/content and can make text feel shifted.
    const finalText = value ?? "";

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

        const box = measureTextBox(finalText || " ", style);

        return {
            ...el,
            text: finalText,
            stroke: style.stroke,

            // IMPORTANT:
            // Text edit must NEVER change x/y.
            // Only width/height can change.
            x: el.x,
            y: el.y,

            w: box.w,
            h: box.h,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            fontFamily: style.fontFamily,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            textAlign: style.textAlign,
        };
    });

    setElements(next);
    setSelectedIds([id]);
    commitHistory(next);
}
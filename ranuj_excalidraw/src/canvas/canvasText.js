import { buildTextElement } from "./canvasFactories";
import { measureTextBox } from "./textMetrics";

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
    const finalText = text?.trim();
    if (!finalText) return;

    const newText = buildTextElement({
        x,
        y,
        text: finalText,
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
                                        }) {
    const finalText = value?.trim() || "";

    const next = elements.map((el) => {
        if (el.id !== id) return el;

        const box = measureTextBox(finalText, {
            fontSize: el.fontSize,
            lineHeight: el.lineHeight,
            fontFamily: el.fontFamily,
            bold: el.bold,
            italic: el.italic,
        });

        return {
            ...el,
            text: finalText,
            w: box.w,
            h: box.h,
            fontSize: box.fontSize,
            lineHeight: box.lineHeight,
            fontFamily: box.fontFamily,
        };
    });

    setElements(next);
    setSelectedIds([id]);
    commitHistory(next);
}
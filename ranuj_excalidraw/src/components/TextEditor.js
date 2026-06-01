import React, { useEffect, useRef } from "react";
import { measureTextBox } from "../canvas/textMetrics";
import {
    buildTextEditorFont,
    normalizeTextStyle,
} from "../canvas/textRenderStyle";
import { worldToScreen } from "../canvas/canvasViewport";

export default function TextEditor({
                                       editor,
                                       setEditor,
                                       updateTextElement,
                                       createTextElement,
                                       viewport,
                                       onCommitStart,
                                   }) {
    const inputRef = useRef(null);
    const finishingRef = useRef(false);

    useEffect(() => {
        if (!editor || !inputRef.current) return;

        inputRef.current.focus();

        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
    }, [editor?.id, editor?.mode]);

    useEffect(() => {
        finishingRef.current = false;
    }, [editor?.id, editor?.mode]);

    if (!editor) return null;

    const zoom = viewport?.zoom || 1;
    const style = normalizeTextStyle(editor);

    const screenPoint = worldToScreen(
        { x: editor.x, y: editor.y },
        viewport || { zoom: 1, offsetX: 0, offsetY: 0 }
    );

    const liveBox = measureTextBox(editor.value || " ", style);
    const editorBox = editor.mode === "edit"
        ? {
            w: Math.max(editor.w || liveBox.w, liveBox.w),
            h: Math.max(editor.h || liveBox.h, liveBox.h),
        }
        : liveBox;

    const finishEditing = () => {
        if (finishingRef.current) return;
        finishingRef.current = true;

        onCommitStart?.();

        const value = editor.value.trim();

        if (editor.mode === "create") {
            if (!value) {
                setEditor(null);
                return;
            }

            createTextElement({
                x: editor.x,
                y: editor.y,
                text: value,
                stroke: style.stroke,
                parentId: editor.parentId || null,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                fontFamily: style.fontFamily,
                bold: style.bold,
                italic: style.italic,
                underline: style.underline,
                textAlign: style.textAlign,
            });
        } else if (editor.mode === "edit") {
            updateTextElement(editor.id, value, {
                stroke: style.stroke,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                fontFamily: style.fontFamily,
                bold: style.bold,
                italic: style.italic,
                underline: style.underline,
                textAlign: style.textAlign,
            });
        }

        setEditor(null);
    };

    const onKeyDown = (e) => {
        e.stopPropagation();

        if (e.key === "Escape") {
            setEditor(null);
            return;
        }

        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            finishEditing();
        }
    };

    return (
        <textarea
            ref={inputRef}
            className="canvas-text-editor"
            style={{
                position: "absolute",

                // Important:
                // This is always the same x/y as the canvas text element.
                // Do not center-shift it.
                left: screenPoint.x,
                top: screenPoint.y,

                width: editorBox.w * zoom + 4,
                height: editorBox.h * zoom + 4,

                color: style.stroke,
                font: buildTextEditorFont(style, zoom),
                lineHeight: `${style.lineHeight * zoom}px`,
                textAlign: style.textAlign,
                textDecoration: style.underline ? "underline" : "none",

                padding: 0,
                margin: 0,
                border: "none",
                outline: "1px dashed #2563eb",
                background: "transparent",
                resize: "none",
                overflow: "hidden",
                boxSizing: "border-box",
                whiteSpace: "pre",
                tabSize: 4,
            }}
            value={editor.value}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
                setEditor((prev) => ({
                    ...prev,
                    value: e.target.value,
                }))
            }
            onBlur={finishEditing}
            onKeyDown={onKeyDown}
            rows={1}
        />
    );
}
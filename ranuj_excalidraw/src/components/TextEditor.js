import React, { useEffect, useRef } from "react";
import {
    TEXT_FONT_SIZE,
    TEXT_LINE_HEIGHT,
    TEXT_FONT_FAMILY,
    measureTextBox,
} from "../canvas/textMetrics";
import { DEFAULT_TEXT_STYLE } from "../canvas/textStyle";
import { worldToScreen } from "../canvas/canvasViewport";

export default function TextEditor({
                                       editor,
                                       setEditor,
                                       updateTextElement,
                                       createTextElement,
                                       viewport,
                                   }) {
    const inputRef = useRef(null);

    useEffect(() => {
        if (!editor || !inputRef.current) return;

        inputRef.current.focus();

        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
    }, [editor?.id, editor?.mode]);

    if (!editor) return null;

    const zoom = viewport?.zoom || 1;

    const fontSize =
        editor.fontSize ||
        DEFAULT_TEXT_STYLE.fontSize ||
        TEXT_FONT_SIZE;

    const lineHeight =
        editor.lineHeight ||
        DEFAULT_TEXT_STYLE.lineHeight ||
        TEXT_LINE_HEIGHT;

    const fontFamily =
        editor.fontFamily ||
        DEFAULT_TEXT_STYLE.fontFamily ||
        TEXT_FONT_FAMILY;

    const bold = !!editor.bold;
    const italic = !!editor.italic;

    const screenPoint = worldToScreen(
        { x: editor.x, y: editor.y },
        viewport || { zoom: 1, offsetX: 0, offsetY: 0 }
    );

    const liveBox = measureTextBox(editor.value || "", {
        fontSize,
        lineHeight,
        fontFamily,
        bold,
        italic,
    });

    const finishEditing = () => {
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
                stroke: editor.stroke,
                parentId: editor.parentId || null,

                fontSize,
                lineHeight,
                fontFamily,
                bold,
                italic,
                underline: !!editor.underline,
                textAlign: editor.textAlign || "left",
            });
        } else if (editor.mode === "edit") {
            updateTextElement(editor.id, value, {
                fontSize,
                lineHeight,
                fontFamily,
                bold,
                italic,
                underline: !!editor.underline,
                textAlign: editor.textAlign || "left",
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
                left: screenPoint.x,
                top: screenPoint.y,

                width: liveBox.w * zoom + 4,
                height: liveBox.h * zoom + 4,

                color: editor.stroke || "#111827",
                font: `${italic ? "italic" : "normal"} ${
                    bold ? "700" : "400"
                } ${fontSize * zoom}px ${fontFamily}`,
                lineHeight: `${lineHeight * zoom}px`,

                padding: 0,
                margin: 0,
                border: "none",
                outline: "1px dashed #2563eb",
                background: "transparent",
                resize: "none",
                overflow: "hidden",
                boxSizing: "border-box",
                whiteSpace: "pre",
            }}
            value={editor.value}
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
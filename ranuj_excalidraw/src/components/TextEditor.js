import React, { useEffect, useRef } from "react";
import {
    TEXT_FONT_SIZE,
    TEXT_LINE_HEIGHT,
    measureTextBox,
} from "../canvas/textMetrics";
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

        // Only move cursor to end when editor opens
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
    }, [editor?.id, editor?.mode]);

    if (!editor) return null;

    const zoom = viewport?.zoom || 1;

    const screenPoint = worldToScreen(
        { x: editor.x, y: editor.y },
        viewport || { zoom: 1, offsetX: 0, offsetY: 0 }
    );

    const liveBox = measureTextBox(editor.value || "");

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
            });
        } else if (editor.mode === "edit") {
            updateTextElement(editor.id, value);
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
                font: `${TEXT_FONT_SIZE * zoom}px Arial`,
                lineHeight: `${TEXT_LINE_HEIGHT * zoom}px`,

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
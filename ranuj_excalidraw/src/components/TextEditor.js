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

        const input = inputRef.current;
        input.focus();

        const len = input.value.length;
        input.setSelectionRange(len, len);

        input.scrollTop = 0;
        input.scrollLeft = 0;
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

    const editorBox = {
        w: Math.max(editor.w || liveBox.w, liveBox.w, 40),
        h: Math.max(editor.h || liveBox.h, liveBox.h, style.lineHeight),
    };

    const finishEditing = () => {
        if (finishingRef.current) return;
        finishingRef.current = true;

        onCommitStart?.();

        const rawValue = editor.value ?? "";
        const hasText = rawValue.trim().length > 0;

        if (editor.mode === "create") {
            if (!hasText) {
                setEditor(null);
                return;
            }

            createTextElement({
                x: editor.x,
                y: editor.y,
                text: rawValue,
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
            updateTextElement(editor.id, hasText ? rawValue : "", {
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

                // x/y is the stored top-left anchor. Never shift it in editor mode.
                left: `${screenPoint.x}px`,
                top: `${screenPoint.y}px`,

                // Keep the textarea in world-size and scale the whole editor.
                // Scaling font-size directly can create 1px visual drift between edit/final modes.
                width: `${editorBox.w}px`,
                height: `${editorBox.h}px`,
                transform: `scale(${zoom})`,
                transformOrigin: "top left",

                minWidth: 0,
                minHeight: 0,

                // Visible text is drawn on canvas using drawElement().
                // Textarea is kept only for keyboard input, caret, selection, copy/paste, IME.
                color: "transparent",
                caretColor: style.stroke,
                font: buildTextEditorFont(style, 1),
                fontSize: `${style.fontSize}px`,
                lineHeight: `${style.lineHeight}px`,
                fontFamily: style.fontFamily,
                fontWeight: style.bold ? 700 : 400,
                fontStyle: style.italic ? "italic" : "normal",
                textAlign: style.textAlign,
                textDecoration: style.underline ? "underline" : "none",

                padding: 0,
                margin: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                resize: "none",
                overflow: "hidden",
                boxSizing: "border-box",

                whiteSpace: "pre",
                tabSize: 4,

                display: "block",
                appearance: "none",
                WebkitAppearance: "none",
                borderRadius: 0,
                verticalAlign: "top",
                letterSpacing: "normal",
                wordSpacing: "normal",
                textTransform: "none",
                textIndent: 0,
                textShadow: "none",
                fontKerning: "normal",
                fontVariantLigatures: "normal",
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
            }}
            value={editor.value}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
                const value = e.target.value;

                e.target.scrollTop = 0;
                e.target.scrollLeft = 0;

                const nextBox = measureTextBox(value || " ", style);

                setEditor((prev) => ({
                    ...prev,
                    value,
                    w: nextBox.w,
                    h: nextBox.h,
                }));
            }}
            onBlur={finishEditing}
            onKeyDown={onKeyDown}
            rows={1}
            spellCheck={false}
        />
    );
}
